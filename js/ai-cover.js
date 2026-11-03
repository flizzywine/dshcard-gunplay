import * as THREE from 'three';

const SEARCH_RADIUS = 11, MEMORY_SECONDS = 8;
const horizontal = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function knownThreat(bot) {
  const age = bot.game.time - bot.lastSeenT;
  if (!bot.lastSeenPos || age < 0 || age > MEMORY_SECONDS) return null;
  return bot.lastSeenEye?.clone() || bot.lastSeenPos.clone().add(new THREE.Vector3(0, 1.7, 0));
}

// Use actual hit-region heights, including the top of the head, not just capsule height.
export function protectedAt(world, bot, point, threat, crouch = 0) {
  const shape = bot.coverShape(crouch), direction = point.clone().sub(threat).setY(0).normalize();
  const side = new THREE.Vector3(-direction.z, 0, direction.x);
  const samples = [[shape.headTop, 0], [shape.head, -0.13], [shape.head, 0.13], [shape.chest, -shape.shoulder], [shape.chest, shape.shoulder], [0.35, 0]];
  return samples.every(([height, offset]) => world.lineBlocked(threat, point.clone().addScaledVector(side, offset).add(new THREE.Vector3(0, height, 0))));
}

export function scoreCoverPoint(world, bot, threat, point) {
  const distance = point.distanceTo(bot.pos);
  if (distance > SEARCH_RADIUS + 1 || Math.abs(point.y - bot.pos.y) > 2.5 || horizontal(point, threat) < 2) return null;
  if (bot.leash && point.distanceTo(bot.home) > bot.leash) return null;
  if (!bot.physicsBody.canFit(point, bot.coverShape(1).height)) return null;
  if (!protectedAt(world, bot, point, threat, 1)) return null;
  for (const other of bot.game.bots) {
    if (other === bot || !other.alive) continue;
    const claimed = other.coverReload?.position;
    if (Math.abs(other.pos.y - point.y) < 1.5 && horizontal(other.pos, point) < 1.2) return null;
    if (claimed && Math.abs(claimed.y - point.y) < 1.5 && horizontal(claimed, point) < 1.4) return null;
  }
  const standing = bot.physicsBody.canFit(point, bot.coverShape(0).height) && protectedAt(world, bot, point, threat, 0);
  const side = point.clone().sub(threat).setY(0).normalize(); side.set(-side.z, 0, side.x);
  let peek = false;
  for (const sign of [-1, 1]) {
    const p = point.clone().addScaledVector(side, sign * (bot.radius + 0.65));
    if (bot.physicsBody.canFit(p, bot.coverShape(standing ? 0 : 1).height) && !world.lineBlocked(threat, p.clone().add(new THREE.Vector3(0, bot.coverShape(standing ? 0 : 1).head, 0)))) peek = true;
  }
  return { position: point.clone(), crouch: !standing, score: 80 + (standing ? 9 : 0) + (peek ? 6 : 0) - distance * 2 - Math.abs(point.y - bot.pos.y) * 5 };
}

function candidatePoints(bot) {
  const world = bot.game.world, origin = bot.pos, points = [], seen = new Set();
  function add(raw) {
    let point;
    if (world.navigation) {
      point = world.navigation.point(world.navigation.nearest(raw));
      if (horizontal(point, raw) > 1.3 || Math.abs(point.y - raw.y) > 2.5) return;
    } else {
      const [x, z] = world.cellOf(raw.x, raw.z);
      if (!world.walkable(x, z)) return;
      const px = (x + 0.5) * world.cs - world.half, pz = (z + 0.5) * world.cs - world.half;
      point = new THREE.Vector3(px, world.groundHeight(px, pz, origin.y, bot.radius) + 0.025, pz);
    }
    if (point.distanceTo(origin) > SEARCH_RADIUS + 0.5) return;
    const key = point.toArray().map(n => n.toFixed(1)).join(',');
    if (!seen.has(key)) { seen.add(key); points.push(point); }
  }
  // Current position may already be safe. Wall-side probes find narrow covers
  // that a sparse radial sample can miss, without relying on map AABBs.
  add(origin.clone());
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8, direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const hit = world.raycast(origin.clone().add(new THREE.Vector3(0, 1, 0)), direction, SEARCH_RADIUS);
    if (!hit) continue;
    const near = hit.point.clone().addScaledVector(direction, -(bot.radius + 0.3)).setY(origin.y);
    add(near);
    const side = new THREE.Vector3(-direction.z, 0, direction.x);
    add(near.clone().addScaledVector(side, 1.1)); add(near.clone().addScaledVector(side, -1.1));
  }
  for (const radius of [2, 4, 7, 10]) for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6; add(origin.clone().add(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius)));
  }
  return points.slice(0, 80);
}

function pathLength(from, path) {
  let length = 0, previous = from;
  for (const point of path) { length += horizontal(previous, point); previous = point; }
  return length;
}

export class CoverReload {
  constructor() {
    this.state = 'idle'; this.position = null; this.retryAfter = 0;
    this.stats = { searches: 0, completed: 0, interrupted: 0, fallbacks: 0 };
  }
  get active() { return this.state !== 'idle'; }
  reset(bot) {
    this.state = 'idle'; this.position = null; this.candidates = null; this.threat = null;
    this.retryAfter = 0; this.replans = 0;
    bot.path = null; bot.pathGoal = null;
  }
  cancel(bot) {
    if (this.active) this.stats.interrupted++;
    bot.cancelReload(); this.reset(bot); this.retryAfter = bot.game.time + 0.4;
  }
  search(bot, threat) {
    this.state = 'search'; this.position = null; this.candidates = null;
    this.threat = threat.clone(); this.deadline = bot.game.time + 0.8;
    bot.path = null; bot.pathGoal = null;
  }
  fallback(bot, threat) {
    this.state = 'fallback'; this.position = null; this.threat = threat?.clone() || null;
    this.stats.fallbacks++; bot.reload();
  }
  update(bot, dt, desired) {
    const game = bot.game, world = game.world, now = game.time, threat = knownThreat(bot);
    if (this.state === 'idle') {
      const low = bot.mag < bot.stats.mag && bot.mag <= Math.max(2, Math.ceil(bot.stats.mag * 0.2));
      const quietTopUp = !threat && bot.mag < bot.stats.mag * 0.6;
      if (bot.reloadT > 0 || !low && !quietTopUp || now < this.retryAfter) return null;
      this.replans = 0;
      if (threat && !bot.static) this.search(bot, threat); else this.fallback(bot, threat);
    }
    if (this.state === 'fallback') {
      // A threat discovered during a quiet top-up can interrupt it and seek cover.
      if (!this.threat && threat && !bot.static) { bot.cancelReload(); this.search(bot, threat); }
      else if (bot.reloadT <= 0) {
        this.reset(bot); this.retryAfter = now + 0.6; return null;
      } else { desired.set(0, 0, 0); return { crouch: !!this.threat, lookAt: this.threat }; }
    }
    if (this.state === 'reload') {
      if (bot.reloadT <= 0) {
        if (bot.mag === bot.stats.mag) this.stats.completed++;
        this.reset(bot); this.retryAfter = now + 0.6; return null;
      }
      if (now >= this.checkAt) {
        this.checkAt = now + 0.15;
        const currentThreat = threat || this.threat;
        if (!protectedAt(world, bot, bot.pos, currentThreat, bot.crouchT)) {
          bot.cancelReload(); this.stats.interrupted++;
          if (this.replans++ < 2) this.search(bot, currentThreat); else this.fallback(bot, currentThreat);
        }
      }
      if (this.state === 'reload') { desired.set(0, 0, 0); return { crouch: this.crouch, lookAt: threat || this.threat }; }
    }
    if (this.state === 'seek') {
      const distance = horizontal(bot.pos, this.position);
      if (distance < 0.4 && Math.abs(bot.pos.y - this.position.y) < 0.65) {
        desired.set(0, 0, 0);
        if (protectedAt(world, bot, bot.pos, threat || this.threat, bot.crouchT)) {
          bot.reload(); this.state = 'reload'; this.checkAt = now + 0.15;
          return { crouch: this.crouch, lookAt: threat || this.threat };
        }
      } else bot.steer(this.position, 4.6 * bot.stats.mobility, desired, 0.24);
      if (now >= this.checkAt) {
        this.checkAt = now + 0.2;
        const currentThreat = threat || this.threat;
        const lostCover = !protectedAt(world, bot, this.position, currentThreat, this.crouch ? 1 : 0);
        if (lostCover || now > this.moveDeadline || now - this.progressAt > 1.2 && horizontal(bot.pos, this.progressPosition) < 0.25) {
          if (this.replans++ < 1) this.search(bot, currentThreat); else this.fallback(bot, currentThreat);
        } else if (now - this.progressAt > 1.2) { this.progressAt = now; this.progressPosition.copy(bot.pos); }
      }
      if (this.state === 'seek') return { crouch: this.crouch && distance < 1.3, lookAt: threat || this.threat };
    }
    if (this.state === 'search') {
      desired.set(0, 0, 0);
      if (now > this.deadline) this.fallback(bot, threat || this.threat);
      else {
        if (!this.candidates && (game.coverBudget ?? 1) > 0) {
          if (game.coverBudget !== undefined) game.coverBudget--;
          this.stats.searches++;
          this.candidates = candidatePoints(bot).map(p => scoreCoverPoint(world, bot, this.threat, p)).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 8);
        }
        if (this.candidates) {
          let attempts = 0, best = null;
          while (this.candidates.length && attempts < 2 && (game.pathBudget ?? 1) > 0) {
            attempts++; if (game.pathBudget !== undefined) game.pathBudget--;
            const candidate = this.candidates.shift();
            const path = horizontal(candidate.position, bot.pos) < 0.35 ? [candidate.position.clone()] : world.findPath(bot.pos, candidate.position);
            if (!path?.length || horizontal(path[path.length - 1], candidate.position) > 0.8) continue;
            const length = pathLength(bot.pos, path);
            if (length > 22 || !protectedAt(world, bot, candidate.position, this.threat, candidate.crouch ? 1 : 0)) continue;
            // Prefer shorter, less exposed approaches among reachable options.
            // Sample a bounded number of route points to keep large maps cheap.
            let exposed = 0;
            for (let i = 0; i < 3; i++) {
              const p = path[Math.min(path.length - 1, Math.floor(path.length * (i + 1) / 4))].clone();
              if (!world.navigation) p.y = world.groundHeight(p.x, p.z, bot.pos.y, bot.radius) + 0.025;
              p.y += bot.coverShape(0).chest;
              if (!world.lineBlocked(this.threat, p)) exposed++;
            }
            candidate.path = path; candidate.score -= length * 0.7 + exposed * 4;
            if (!best || candidate.score > best.score) best = candidate;
          }
          if (best) {
            this.state = 'seek'; this.position = best.position; this.crouch = best.crouch;
            this.candidates = null; this.moveDeadline = now + 4.5; this.checkAt = now;
            this.progressAt = now; this.progressPosition = bot.pos.clone();
            bot.path = best.path; bot.pathGoal = best.position.clone(); bot.pathT = now;
          } else if (!this.candidates.length) this.fallback(bot, this.threat);
        }
      }
    }
    if (this.state === 'fallback') desired.set(0, 0, 0);
    return { crouch: this.state === 'fallback', lookAt: threat || this.threat };
  }
}
