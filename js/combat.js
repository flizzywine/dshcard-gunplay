// 战斗系统：弹道判定、伤害、爆炸、投掷物
import * as THREE from 'three';
import { mat } from './materials.js';
import { rand, clamp } from './util.js';

const _p = new THREE.Vector3(), _q = new THREE.Vector3();

export function damageAt(stats, dist, part) {
  let d;
  if (dist <= stats.rangeNear) d = stats.dmgNear;
  else if (dist >= stats.rangeFar) d = stats.dmgFar;
  else d = stats.dmgNear + (stats.dmgFar - stats.dmgNear) * (dist - stats.rangeNear) / (stats.rangeFar - stats.rangeNear);
  if (part === 'head') d *= stats.headMul;
  else if (part === 'legs') d *= 0.85;
  return d;
}

export function traceBullet(game, shooter, o, d, maxDist = 400) {
  const wh = game.world.raycast(o, d, maxDist);
  let best = wh ? wh.t : maxDist, ent = null, part = null;
  for (const e of game.entities) {
    if (e === shooter || !e.alive) continue;
    if (shooter && e.team === shooter.team) continue;
    const h = e.hitTest(o, d, best);
    if (h && h.t < best) { best = h.t; ent = e; part = h.part; }
  }
  const point = new THREE.Vector3().copy(o).addScaledVector(d, best);
  return { t: best, point, ent, part, world: ent ? null : wh };
}

// Personal combat score is independent of objective/team score.
const suppressionAwards = new WeakMap();
function suppressNearMiss(game, shooter, o, d, trace) {
  if (shooter !== game.player) return;
  const now = performance.now();
  let awards = suppressionAwards.get(shooter);
  if (!awards) { awards = new WeakMap(); suppressionAwards.set(shooter, awards); }
  for (const e of game.entities) {
    if (!e.alive || e === shooter || e === trace.ent || e.team === shooter.team || !e.chestPos || !e.eyePos) continue;
    // Only the unobstructed travelled segment can suppress someone.
    let near = false;
    for (const sample of [e.chestPos(new THREE.Vector3()), e.eyePos(new THREE.Vector3())]) {
      const t = sample.clone().sub(o).dot(d);
      if (t <= 0.5 || t >= trace.t) continue;
      const closest = o.clone().addScaledVector(d, t);
      if (closest.distanceToSquared(sample) <= 1 && !game.world.lineBlocked(closest, sample)) { near = true; break; }
    }
    if (!near) continue;
    e.suppressedUntil = now + 1200;
    if (now - (awards.get(e) ?? -Infinity) < 2000) continue;
    awards.set(e, now);
    shooter.stats.score += 5;
    game.hud.combatScore('压制', 5);
  }
}

// 统一的射击：返回命中信息
export function fireHitscan(game, shooter, o, d, stats, weaponName, opts = {}) {
  const r = traceBullet(game, shooter, o, d, opts.maxDist || stats.bulletRange || 400);
  if (r.ent) {
    const dmg = damageAt(stats, r.t, r.part) * (opts.dmgMul || 1);
    const hpBefore = r.ent.hp;
    const killed = r.ent.takeDamage(dmg, { attacker: shooter, head: r.part === 'head', dir: d, weapon: weaponName, point: r.point });
    game.effects.blood(r.point, d, r.part === 'head');
    r.killed = killed; r.dmg = dmg;
    r.dealt = Math.max(0, hpBefore - Math.max(0, r.ent.hp));
    if (shooter === game.player) {
      const dealt = Math.max(0, hpBefore - Math.max(0, r.ent.hp));
      const points = Math.round(dealt);
      if (points > 0) {
        shooter.stats.score += points;
        game.hud.combatScore(r.part === 'head' ? '爆头命中' : '命中', points);
      }
    }
  } else if (r.world) {
    game.effects.impact(r.point, r.world.normal, r.world.box.mat || 'concrete');
  }
  suppressNearMiss(game, shooter, o, d, r);
  return r;
}

export function explode(game, pos, radius, maxDmg, attacker, weapon, opts = {}) {
  game.effects.explosion(pos, opts.scale || 1);
  game.audio.explosion(pos, opts.scale || 1);
  const pl = game.player;
  if (pl && pl.alive) {
    const d = pl.pos.distanceTo(pos);
    if (d < radius * 4) pl.shake(clamp(1.2 - d / (radius * 4), 0, 1) * 1.2);
    if (d < radius * 1.2) game.audio.ring(1.5, 0.05);
  }
  const src = _p.copy(pos); src.y += 0.4;
  for (const e of game.entities) {
    if (!e.alive || !e.chestPos) continue;
    const c = e.chestPos(_q);
    const dist = c.distanceTo(src);
    if (dist > radius) continue;
    if (attacker && e !== attacker && e.team === attacker.team && !opts.ff) continue;
    if (game.world.lineBlocked(src, c)) continue;
    let dmg = maxDmg * Math.pow(1 - dist / radius, 0.8);
    if (e.isPlayer && e.hasPerk && e.hasPerk('eod')) dmg *= 0.5;
    if (e === attacker && e.isPlayer) dmg *= 0.6;
    const dir = new THREE.Vector3().subVectors(c, src).normalize();
    e.takeDamage(dmg, { attacker, dir, weapon, explosive: true, point: c.clone() });
  }
  game.makeNoise(pos, 80, attacker ? attacker.team : null);
}

export function flashAt(game, pos, owner) {
  game.effects.flashbang(pos);
  game.audio.explosion(pos, 0.4);
  const eye = new THREE.Vector3();
  for (const e of game.entities) {
    if (!e.alive || !e.eyePos) continue;
    e.eyePos(eye);
    const d = eye.distanceTo(pos);
    if (d > 18) continue;
    if (owner && e.team === owner.team && e !== owner) continue;
    if (game.world.lineBlocked(pos.clone().setY(pos.y + 0.2), eye)) continue;
    const dir = new THREE.Vector3().subVectors(pos, eye).normalize();
    const facing = e.forward ? Math.max(0, e.forward(new THREE.Vector3()).dot(dir)) : 1;
    let t = (1 - d / 18) * (0.5 + facing * 0.7) * 5;
    if (e.isPlayer) {
      if (e.hasPerk('eod')) t *= 0.5;
      game.hud.flash(Math.min(4.5, t));
      game.audio.ring(Math.min(4, t), 0.15);
    } else if (e.stun) e.stun(Math.min(4.5, t + 0.5));
  }
}

export class Projectile {
  constructor(game, type, pos, vel, owner, fuse) {
    this.game = game; this.type = type; this.pos = pos.clone(); this.vel = vel.clone(); this.owner = owner;
    this.fuse = fuse; this.alive = true; this.stuck = false; this.age = 0; this.bounces = 0;
    let geo, m;
    if (type === 'frag') { geo = new THREE.SphereGeometry(0.05, 10, 8); m = mat('gunGreen'); }
    else if (type === 'semtex') { geo = new THREE.BoxGeometry(0.08, 0.05, 0.05); m = mat('yellowPaint'); }
    else if (type === 'molotov') { geo = new THREE.CylinderGeometry(0.03, 0.035, 0.2, 8); m = mat('glass'); }
    else if (type === 'flash') { geo = new THREE.CylinderGeometry(0.03, 0.03, 0.11, 8); m = mat('darkMetal'); }
    else if (type === 'smoke') { geo = new THREE.CylinderGeometry(0.035, 0.035, 0.13, 8); m = mat('metal'); }
    else if (type === 'rocket') { geo = new THREE.ConeGeometry(0.06, 0.4, 10).rotateX(-Math.PI / 2); m = mat('gunGreen'); }
    else if (type === 'bomb') { geo = new THREE.CapsuleGeometry(0.12, 0.6, 4, 8).rotateX(Math.PI / 2); m = mat('darkMetal'); }
    this.mesh = new THREE.Mesh(geo, m);
    this.mesh.castShadow = true;
    this.mesh.position.copy(this.pos);
    game.scene.add(this.mesh);
    if (!['rocket', 'bomb'].includes(type)) this.physicsBody = game.world.physics.createProjectile(pos, vel);
    if (type === 'semtex') { this.light = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.3, 0.3) })); this.light.position.y = 0.05; this.mesh.add(this.light); }
  }
  update(dt) {
    if (!this.alive) return;
    const g = this.game;
    this.age += dt;
    this.fuse -= dt;
    if (this.type === 'rocket') {
      const steps = 4;
      for (let i = 0; i < steps; i++) {
        const sd = dt / steps;
        const next = _p.copy(this.pos).addScaledVector(this.vel, sd);
        const dir = _q.copy(this.vel).normalize();
        const len = this.vel.length() * sd;
        const hit = g.world.raycast(this.pos, dir, len + 0.1);
        let entHit = null;
        for (const e of g.entities) { if (e === this.owner || !e.alive || (this.owner && e.team === this.owner.team)) continue; const h = e.hitTest(this.pos, dir, len + 0.3); if (h) entHit = e; }
        if (hit || entHit || this.age > 6) {
          if (hit) this.pos.copy(hit.point).addScaledVector(hit.normal, 0.2);
          return this.detonate();
        }
        this.pos.copy(next);
      }
      this.vel.y -= 1.5 * dt;
      g.effects.smoke.emit({ x: this.pos.x, y: this.pos.y, z: this.pos.z, vx: rand(-0.3, 0.3), vy: rand(0, 0.4), vz: rand(-0.3, 0.3), drag: 1, life: 1.6, s0: 0.2, s1: 1.2, c0: [0.7, 0.7, 0.7], a0: 0.4 });
      g.effects.add.emit({ x: this.pos.x, y: this.pos.y, z: this.pos.z, vx: 0, vy: 0, vz: 0, life: 0.06, s0: 0.4, s1: 0.2, c0: [5, 3, 1], a0: 1 });
      this.mesh.position.copy(this.pos);
      this.mesh.lookAt(_p.copy(this.pos).add(this.vel));
      return;
    }
    if (this.type === 'bomb') {
      this.vel.y -= 12 * dt;
      this.pos.addScaledVector(this.vel, dt);
      this.mesh.position.copy(this.pos);
      this.mesh.lookAt(_p.copy(this.pos).add(this.vel));
      const gh = g.world.groundHeight(this.pos.x, this.pos.z, this.pos.y + 0.5, 0.1);
      if (this.pos.y <= gh + 0.2) { this.pos.y = gh + 0.1; return this.detonate(); }
      return;
    }
    const previousSpeed = this.vel.length(), motion = this.physicsBody.snapshot();
    this.pos.copy(motion.position); this.vel.copy(motion.velocity);
    this.mesh.quaternion.copy(motion.rotation);
    if (motion.contacts && !this.stuck) {
      this.bounces += motion.contacts;
      if (this.type === 'molotov') return this.detonate();
      if (this.type === 'semtex') {
        this.stuck = true; this.physicsBody.stop(); this.vel.set(0, 0, 0);
        g.audio.click(900, 0.05, 0.3, this.pos);
      } else if (previousSpeed > 1.5) g.audio.bounce(this.pos);
    }
    this.mesh.position.copy(this.pos);
    if (this.light) this.light.visible = Math.sin(this.age * 20) > 0;
    if (this.type === 'smoke' && this.fuse <= 0 && !this.smoking) {
      this.physicsBody.stop(); this.vel.set(0, 0, 0);
      this.smoking = true; g.effects.smokeGrenade(this.pos); g.audio.click(600, 0.6, 0.3, this.pos);
      this.fuse = 16;
      return;
    }
    if (this.smoking) { if (this.fuse <= 0) this.remove(); return; }
    if (this.fuse <= 0) this.detonate();
  }
  detonate() {
    const g = this.game;
    this.remove();
    const wn = { frag: '破片手雷', semtex: '粘性炸弹', molotov: '燃烧瓶', rocket: 'AT4 火箭筒', bomb: '集束空袭' }[this.type];
    if (this.type === 'frag' || this.type === 'semtex') explode(g, this.pos, 7, 160, this.owner, wn);
    else if (this.type === 'rocket') explode(g, this.pos, 6, 170, this.owner, wn, { scale: 1.2 });
    else if (this.type === 'bomb') explode(g, this.pos, 8, 180, this.owner, wn, { scale: 1.3 });
    else if (this.type === 'flash') flashAt(g, this.pos, this.owner);
    else if (this.type === 'molotov') {
      const owner = this.owner;
      const center = this.pos.clone(); center.y = g.world.groundHeight(center.x, center.z, center.y + 0.2, 0.1) + 0.05;
      g.audio.explosion(center, 0.35);
      g.audio.click(2500, 0.3, 0.4, center);
      g.effects.addFireSource(center, 3, 7, (dt, f) => {
        for (const e of g.entities) {
          if (!e.alive) continue;
          if (owner && e.team === owner.team && e !== owner) continue;
          const dx = e.pos.x - f.pos.x, dz = e.pos.z - f.pos.z;
          if (dx * dx + dz * dz < 9 && Math.abs(e.pos.y - f.pos.y) < 1.5) {
            let d = 35 * dt; if (e.isPlayer && e.hasPerk('eod')) d *= 0.5;
            e.takeDamage(d, { attacker: owner, weapon: '燃烧瓶', explosive: true, burn: true, dir: new THREE.Vector3(0, 1, 0) });
          }
        }
      });
      g.effects.flashLight(center.clone().setY(1), 0xff7020, 20, 7, 14);
    }
  }
  remove() { this.alive = false; this.physicsBody?.dispose(); this.game.scene.remove(this.mesh); }
}
