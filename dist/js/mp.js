// 私人推进战：A → B1+B2 → C1+C2；旧战役使用的模型辅助函数保留。
import * as THREE from 'three';
import { Player } from './player.js';
import { Bot } from './ai.js';
import { MAPS } from './maps.js';
import { KILLSTREAKS, BOT_NAMES, WEAPONS, ATTACHMENTS, attachmentAllowed, computeStats } from './data.js';
import { fireHitscan, Projectile } from './combat.js';
import { mat } from './materials.js';
import { rand, pick, fmtTime, spreadDir, DEG, clamp, rayAABB } from './util.js';

export class MPMatch {
  constructor(game, cfg = {}) {
    this.game = game;
    this.cfg = { ...cfg, map: 'jinqu', mode: 'assault', allies: 9, enemies: 20, timeLimit: 10 };
    this.type = 'assault'; this.ffa = false; this.canChangeClass = false;
    this.timeLeft = 600; this.tickets = 160; this.maxTickets = 200;
    this.scores = { A: 0, B: 0 }; this.sectorIndex = 0; this.sectors = [];
    this.flags = []; this.respawns = []; this.active = []; this.over = false;
    this.lastKillTimes = []; this.capturedCount = 0; this.targeting = null;
  }
  start() {
    const game = this.game, def = game.world.def || MAPS[this.cfg.map];
    this.sectors = def.sectors;
    if (!this.sectors?.length) throw new Error('推进地图缺少 sectors 定义');
    this.activateSector(0, false);
    game.playerSleeve = 'fab_ally';
    const sp = this.spawnPoint('A');
    const pl = game.player = new Player(game, { team: 'A', pos: sp.pos, yaw: sp.yaw, name: '你' });
    pl.equip(this.buildLoadout()); game.entities.push(pl);
    const names = BOT_NAMES.slice();
    for (let i = 0; i < this.cfg.allies; i++) { const b = this.addBot('A', names[i % names.length], def.styles[0]); b.squadIndex = i; }
    for (let i = 0; i < this.cfg.enemies; i++) this.addBot('B', names[(i + this.cfg.allies) % names.length], def.styles[1]);
    game.hud.reset(); game.hud.streaks(null, 0);
    game.hud.announce('烬区 · 据点推进', '占领全部区域 · 10 分钟 · 我方 160 增援', 5);
    game.audio.say('先夺下岩下村，再向前推进'); this.hudScore();
  }
  buildLoadout() {
    return { weapons: ['m4', 'm870', 'l115', 'rpg'].map(id => ({ id, att: {}, camo: 'none' })), lethal: null, tactical: null, perks: [] };
  }
  addBot(team, name, style) {
    const sp = this.spawnPoint(team), wid = pick(['m4', 'm4', 'm4', 'm4', 'm870', 'l115']);
    const bot = new Bot(this.game, { team, name, style, weaponId: wid, att: {}, difficulty: team === 'A' ? 1 : 0,
      easyEnemy: team !== 'A', pos: sp.pos, yaw: sp.yaw, role: 'mp', tag: team === 'A', tagColor: '#6cf', grenades: 0 });
    this.game.addBot(bot); return bot;
  }
  activateSector(index, announce = true) {
    for (const f of this.flags) if (f.mesh) this.game.world.root.remove(f.mesh);
    this.commandMarker = null;
    this.sectorIndex = index;
    const sector = this.sectors[index];
    this.flags = sector.objectives.map(o => ({ ...o, pos: o.pos.clone(), radius: o.radius || 7, owner: 'B', prog: 0,
      captured: false, contested: false, mesh: this.flagMesh(o.pos, o.radius || 7) }));
    for (const bot of this.game.bots) { bot.command = null; bot.goal = null; bot.goalT = 0; bot.path = null; bot.missionGoal = null; bot.missionRefresh = 0; }
    if (announce) {
      this.tickets = Math.min(this.maxTickets, this.tickets + 40);
      this.game.hud.announce('战线推进：' + sector.name, '增援 +40 · 出生点前移 · 已占据点不会丢失', 4);
      this.game.audio.say('区域突破，推进下一目标');
    }
  }
  flagMesh(pos, radius) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius - .15, radius, 32), new THREE.MeshBasicMaterial({ color: 0xff704b, transparent: true, opacity: .75, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .08; g.add(ring);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(.1, 3.5, .1), mat('steel')); pole.position.y = 1.75; g.add(pole);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.25, .8), new THREE.MeshBasicMaterial({ color: 0xff704b, side: THREE.DoubleSide }));
    cloth.position.set(.65, 3.05, 0); g.add(cloth); g.position.copy(pos); g.userData = { ring, cloth };
    this.game.world.root.add(g); return g;
  }
  spawnPoint(team) {
    const sector = this.sectors[this.sectorIndex];
    const candidates = sector ? (team === 'A' ? sector.attackSpawns : sector.defendSpawns) : this.game.world.spawns[team];
    let best = candidates[0], score = -Infinity;
    for (const p of candidates) {
      let distance = 100;
      for (const e of this.game.entities) if (e.alive && e.team !== team && e.pos) distance = Math.min(distance, e.pos.distanceTo(p));
      const separation = this.game.entities.filter(e => e.alive && e.team === team && e.pos.distanceTo(p) < 2).length;
      const s = distance - separation * 8 + Math.random() * 3;
      if (s > score) { score = s; best = p; }
    }
    const world = this.game.world;
    const occupied = p => this.game.entities.some(e => e.alive && e.pos && e.pos.distanceTo(p) < .35 + (e.radius || .35) + .12);
    let pos = best.clone();
    if (occupied(pos)) {
      // Deterministic local rings avoid identical bot positions without moving spawns to arbitrary map cells.
      outer: for (const anchor of [best, ...candidates.filter(p => p !== best)]) {
        for (const radius of [0, 1.1, 2.2]) for (let i = 0; i < (radius ? 8 : 1); i++) {
          const trial = anchor.clone().add(new THREE.Vector3(Math.cos(i * Math.PI / 4) * radius, 0, Math.sin(i * Math.PI / 4) * radius));
          if (world.cellOf && world.walkable && !world.walkable(...world.cellOf(trial.x, trial.z))) continue;
          if (world.groundHeight) trial.y = world.groundHeight(trial.x, trial.z, anchor.y + .3, .35);
          if (Math.abs(trial.y - anchor.y) > .45 || occupied(trial)) continue;
          if (world.ceilingHeight && world.ceilingHeight(trial.x, trial.z, trial.y, .35) < trial.y + 1.8) continue;
          if (world.collide) { const checked = trial.clone(); world.collide(checked, new THREE.Vector3(), .35, 1.8); if (checked.distanceTo(trial) > .05) continue; }
          pos = trial; break outer;
        }
      }
    }
    const target = this.flags.find(f => !f.captured)?.pos || sector.objectives[0].pos;
    return { pos, yaw: Math.atan2(-(target.x - pos.x), -(target.z - pos.z)) };
  }
  issueCommand(kind, targetPos, targetEntity = null, scope = 'squad') {
    if (this.over || !['follow', 'attack', 'defend', 'focus'].includes(kind)) return false;
    const pl = this.game.player;
    if (!pl?.alive) return false;
    if (kind === 'focus' && (!targetEntity?.alive || targetEntity.team === 'A')) {
      this.game.hud.popup('请瞄准可见敌人后再标记', '#ffc86a'); return false;
    }
    if (kind === 'focus') {
      const eye = pl.eyePos(new THREE.Vector3()), chest = targetEntity.chestPos(new THREE.Vector3());
      if (this.game.world.lineBlocked(eye, chest) || this.game.effects?.smokeBlocks?.(eye, chest)) return false;
    }
    const pos = (kind === 'follow' ? pl.pos : kind === 'focus' ? targetEntity.pos : targetPos)?.clone();
    if (!pos) return false;
    const bots = this.game.bots.filter(b => b.team === 'A' && (scope === 'all' || b.squadIndex < 3));
    for (const b of bots) { b.command = { kind, pos: pos.clone(), target: kind === 'focus' ? targetEntity : null, expiresAt: this.game.time + 35, scope }; b.goal = null; b.goalT = 0; b.path = null; }
    const names = { follow: '跟随我', attack: '攻击标记位置', defend: '守住标记位置', focus: '集火可见目标' };
    this.game.hud.popup(`${scope === 'all' ? '全队' : '三人小队'}：${names[kind]}`, '#75d6ff');
    this.commandMarker = { pos, text: names[kind], expiresAt: this.game.time + 35 };
    return true;
  }
  commandGoal(bot) {
    const c = bot.command;
    if (!c) return null;
    if (c.expiresAt <= this.game.time || (c.kind === 'focus' && !c.target?.alive)) { bot.command = null; return null; }
    if (c.kind === 'follow') {
      if (!this.game.player.alive) return c.pos.clone();
      c.pos.copy(this.game.player.pos);
      const a = (bot.squadIndex || 0) * 2.399;
      return c.pos.clone().add(new THREE.Vector3(Math.cos(a) * 3, 0, Math.sin(a) * 3));
    }
    // A focus order carries only the last visible position, never a wall-tracking feed.
    if (c.kind === 'focus' && bot.target === c.target && bot.targetVisible && bot.hasLineOfFire?.(c.target)) c.pos.copy(c.target.pos);
    return c.pos.clone();
  }
  botGoal(bot) {
    const commanded = this.commandGoal(bot); if (commanded) return commanded;
    const remaining = this.flags.filter(f => !f.captured);
    const targets = remaining.length ? remaining : this.flags;
    const goal = targets[(bot.squadIndex ?? bot.id ?? 0) % targets.length];
    // Public objective locations guide movement, not hidden enemy positions.
    const a = ((bot.id || 1) * 2.399) % (Math.PI * 2);
    const radius = bot.team === 'A' ? goal.radius * .35 : goal.radius * (Math.floor((bot.id || 0) / targets.length) % 2 === 0 ? .65 : 1.35);
    return goal.pos.clone().add(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  enemiesOf(team) { return this.game.entities.filter(e => e.alive && e.team !== team && e.pos && e.targetable !== false); }
  uavActive() { return false; }
  get interactPrompt() { return false; }
  onKill(killer, victim, weapon, head, info = {}) {
    if (this.over) return;
    const game = this.game, pl = game.player;
    game.hud.killfeed(killer, victim, weapon, head);
    if (killer && killer !== victim && killer.team !== victim.team) {
      this.scores[killer.team] = (this.scores[killer.team] || 0) + 1;
      if (killer.isPlayer) this.playerKill(victim, weapon, head, info);
      else { killer.kills++; killer.score += 100; }
    }
    const damage = victim.dmgTaken?.get(pl);
    if (damage && killer !== pl && victim.team !== pl.team) { pl.stats.assists++; pl.stats.score += 25; game.hud.popup('+25 助攻', '#ddd'); }
    if (victim.team === 'A') this.tickets = Math.max(0, this.tickets - 1);
    if (victim.isPlayer) {
      game.dead = true; game.deathKiller = killer; pl.stats.streak = 0;
      document.getElementById('deathScreen').classList.remove('hidden');
      document.getElementById('killerInfo').textContent = killer && killer !== victim ? `${killer.name} 击倒了你 · 增援 -1` : '重新部署中 · 增援 -1';
    }
    this.respawns.push({ e: victim, t: victim.isPlayer ? 1 : victim.team === 'A' ? 2.5 : 3.5 });
    if (this.tickets <= 0) this.end('B', '增援耗尽');
  }
  playerKill(victim, weapon, head, info) {
    const game = this.game, pl = game.player;
    pl.stats.kills++; pl.stats.streak++; pl.stats.score += head ? 150 : 100;
    if (head) pl.stats.headshots++;
    game.hud.popup(head ? '+150 爆头击杀' : '+100 击杀', '#fff');
    this.lastKillTimes = this.lastKillTimes.filter(t => game.time - t < 4); this.lastKillTimes.push(game.time);
    const n = this.lastKillTimes.length;
    if (n >= 2) { const label = ['', '', '双杀', '三杀', '四杀', '暴走', '无人可挡'][Math.min(n, 6)]; game.hud.popup(label, '', true); game.audio.say(label); }
  }
  updateCaptures(dt) {
    for (const f of this.flags) {
      if (f.captured) continue;
      let attackers = 0, defenders = 0;
      for (const e of this.game.entities) {
        if (!e.alive || !e.pos || e.targetable === false || (e.isMech && !e.piloted)) continue;
        if (Math.hypot(e.pos.x - f.pos.x, e.pos.z - f.pos.z) <= f.radius && Math.abs(e.pos.y - f.pos.y) < 2.5) {
          if (e.team === 'A') attackers++; else defenders++;
        }
      }
      f.contested = attackers > 0 && defenders > 0;
      if (attackers && !defenders) f.prog = Math.min(1, f.prog + dt * Math.min(2, 1 + (attackers - 1) * .25) / 10);
      // Partial capture persists: no tedious back-capture, but live defenders contest.
      if (f.prog >= 1) {
        f.captured = true; f.owner = 'A'; this.capturedCount++;
        this.game.player.stats.score += 250; this.game.player.stats.captures++;
        this.game.hud.popup(`${f.id} ${f.name} 已占领`, '#75d6ff', true);
        f.mesh?.userData.ring.material.color.setHex(0x4fb4ff); f.mesh?.userData.cloth.material.color.setHex(0x4fb4ff);
      }
    }
    if (this.flags.length && this.flags.every(f => f.captured)) {
      if (this.sectorIndex + 1 >= this.sectors.length) this.end('A', '全部据点已突破');
      else this.activateSector(this.sectorIndex + 1);
    }
  }
  update(dt) {
    if (this.over) return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft <= 0) { this.end('B', '进攻时间耗尽'); return; }
    for (let i = this.respawns.length - 1; i >= 0; i--) {
      const r = this.respawns[i]; r.t -= dt;
      if (r.e.isPlayer) document.getElementById('respawnText').textContent = `${Math.max(0, r.t).toFixed(1)} 秒后自动回到战场`;
      if (r.t <= 0) {
        const sp = this.spawnPoint(r.e.team); r.e.respawn(sp.pos, sp.yaw); this.respawns.splice(i, 1);
        r.e.goal = null; r.e.goalT = 0;
        if (r.e.isPlayer) { this.game.dead = false; document.getElementById('deathScreen').classList.add('hidden'); if (!document.pointerLockElement) this.game.pause(true); }
      }
    }
    this.updateCaptures(dt); this.hudScore();
  }
  hudScore() {
    const game = this.game, sector = this.sectors[this.sectorIndex];
    game.hud.scorebar(`<div class="sb-team a">${this.tickets}<small style="display:block;font-size:11px">增援</small></div><div class="sb-time">${fmtTime(this.timeLeft)}<br><small style="font-size:12px">${sector?.name || '据点推进'}</small></div><div class="sb-team b">${this.capturedCount}/5</div>`);
    game.hud.objective('据点推进 · ' + (sector?.name || ''), this.flags.map(f => `${f.id} ${f.name}：${f.captured ? '已占领 ✓' : f.contested ? '争夺中 ' + Math.floor(f.prog * 100) + '%' : Math.floor(f.prog * 100) + '%'}`).join(' · '), '圈内无敌军即可占领 · 本阶段所有点完成后前移');
    const markers = this.flags.map(f => ({ id: 'objective-' + f.id, pos: f.pos.clone().add(new THREE.Vector3(0, 4, 0)), label: f.id, text: f.captured ? '已占领' : f.contested ? '争夺中' : '进攻', cls: 'flag ' + (f.captured ? 'ally' : 'enemy') }));
    if (this.commandMarker && this.commandMarker.expiresAt > game.time) markers.push({ id: 'command', pos: this.commandMarker.pos.clone().add(new THREE.Vector3(0, 2, 0)), label: '令', text: this.commandMarker.text, cls: 'ally' });
    game.hud.setMarkers(markers);
  }
  minimapMarkers() { return []; }
  ranking() {
    const pl = this.game.player;
    return [{ e: pl, k: pl.stats.kills, d: pl.stats.deaths, s: pl.stats.score }, ...this.game.bots.map(b => ({ e: b, k: b.kills, d: b.deaths, s: b.score }))].sort((a, b) => b.k - a.k || b.s - a.s);
  }
  scoreboardHTML() {
    const row = x => `<tr class="${x.e.isPlayer ? 'me' : ''}"><td>${x.e.name}</td><td>${x.s}</td><td>${x.k}</td><td>${x.d}</td></tr>`;
    return ['A', 'B'].map(t => `<table class="sbt ${t}"><tr><th>${t === 'A' ? '进攻方 · 你与九名友军' : '防守方 · 二十名敌军'}</th><th>得分</th><th>击杀</th><th>阵亡</th></tr>${this.ranking().filter(x => x.e.team === t).map(row).join('')}</table>`).join('');
  }
  end(winner, reason = '') {
    if (this.over) return; this.over = true;
    const game = this.game, pl = game.player, win = winner === 'A' ? 'win' : 'lose';
    game.ending = true; game.paused = true; document.getElementById('deathScreen').classList.add('hidden');
    game.audio.say(win === 'win' ? '突破成功' : '本次进攻结束');
    this.resultTimer = setTimeout(() => {
      if (game.mode !== this) return;
      if (document.pointerLockElement) document.exitPointerLock();
      game.menu.showResults({ win, title: win === 'win' ? '突破成功' : '再试一次', sub: reason,
        stats: [['占领据点', `${this.capturedCount}/5`], ['击杀', pl.stats.kills], ['死亡', pl.stats.deaths], ['剩余增援', this.tickets], ['用时', fmtTime(600 - this.timeLeft)]],
        board: this.scoreboardHTML(), again: () => game.startGame('mp', this.cfg) });
    }, 600);
  }
  dispose() { clearTimeout(this.resultTimer); this.commandMarker = null; for (const b of this.game.bots) b.command = null; this.game.hud.progress(null); }
}

// ---------- 哨戒机枪 ----------
class Sentry {
  constructor(game, pos, owner) {
    this.game = game; this.owner = owner; this.team = owner.team; this.name = '哨戒机枪'; this.isTurret = true;
    this.pos = pos.clone(); this.pos.y = game.world.groundHeight(pos.x, pos.z, pos.y + 0.5, 0.3);
    this.hp = 300; this.alive = true; this.t = 60; this.yaw = owner.yaw; this.fireT = 0; this.target = null; this.scanT = 0;
    this.stats = { dmgNear: 20, dmgFar: 16, rangeNear: 20, rangeFar: 50, headMul: 1.2, name: '哨戒机枪' };
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), mat('darkMetal')); const a = i / 3 * Math.PI * 2; l.position.set(Math.cos(a) * 0.3, 0.45, Math.sin(a) * 0.3); l.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); g.add(l); }
    const head = new THREE.Group(); head.position.y = 0.95; g.add(head);
    head.add(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.5), mat('gunGreen')));
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8).rotateX(Math.PI / 2), mat('gunMetal')); b.position.set(0, 0.02, -0.55); head.add(b);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.25), mat('gunGreen')); box.position.set(0.25, -0.05, 0); head.add(box);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: owner.isPlayer ? new THREE.Color(0.3, 1.5, 3) : new THREE.Color(3, 0.3, 0.3) })); lamp.position.set(0, 0.17, 0.1); head.add(lamp);
    this.muzzle = new THREE.Object3D(); this.muzzle.position.set(0, 0.02, -0.92); head.add(this.muzzle);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.position.copy(this.pos); game.scene.add(g);
    this.mesh = g; this.head = head;
    game.entities.push(this);
  }
  eyePos(o) { return o.set(this.pos.x, this.pos.y + 1.0, this.pos.z); }
  chestPos(o) { return o.set(this.pos.x, this.pos.y + 0.8, this.pos.z); }
  hitTest(o, d, maxT) {
    if (!this.alive) return null;
    const b = { x0: this.pos.x - 0.3, x1: this.pos.x + 0.3, y0: this.pos.y, y1: this.pos.y + 1.15, z0: this.pos.z - 0.3, z1: this.pos.z + 0.3 };
    const t = rayAABB(o.x, o.y, o.z, d.x, d.y, d.z, b, maxT);
    return t >= 0 ? { t, part: 'body' } : null;
  }
  takeDamage(d, info) {
    if (!this.alive) return false;
    this.hp -= info.explosive ? d * 2 : d * 0.5;
    if (this.hp <= 0) { this.destroy(); if (info.attacker && info.attacker.isPlayer) this.game.hud.popup('摧毁哨戒机枪 +100', '', true); return true; }
    return false;
  }
  destroy() {
    this.alive = false;
    this.game.effects.explosion(this.pos.clone().setY(this.pos.y + 0.8), 0.6); this.game.audio.explosion(this.pos, 0.5);
    this.dispose();
  }
  dispose() { this.game.scene.remove(this.mesh); this.game.entities = this.game.entities.filter(e => e !== this); }
  update(dt) {
    const game = this.game;
    this.t -= dt;
    if (this.t <= 0) { this.alive = false; this.dispose(); return; }
    this.fireT -= dt; this.scanT -= dt;
    const eye = this.eyePos(new THREE.Vector3());
    if (this.scanT <= 0) {
      this.scanT = 0.25; this.target = null;
      let bd = 45;
      for (const e of game.entities) {
        if (!e.alive || e.team === this.team || !e.chestPos || e.isTurret) continue;
        const c = e.chestPos(new THREE.Vector3());
        const d = c.distanceTo(eye);
        if (d > bd) continue;
        if (e.isPlayer && e.hasPerk('coldblooded')) continue;
        if (game.world.lineBlocked(eye, c)) continue;
        bd = d; this.target = e;
      }
    }
    if (this.target && this.target.alive) {
      const c = this.target.chestPos(new THREE.Vector3());
      const want = Math.atan2(-(c.x - eye.x), -(c.z - eye.z));
      let da = want - this.yaw; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      this.yaw += clamp(da, -5 * dt, 5 * dt);
      if (Math.abs(da) < 0.15 && this.fireT <= 0) {
        this.fireT = 0.1;
        const dir = spreadDir(c.sub(eye).normalize(), 2.2 * DEG, new THREE.Vector3());
        const r = fireHitscan(game, this.owner.alive !== undefined ? this.owner : this, eye, dir, this.stats, '哨戒机枪');
        const m = this.muzzle.getWorldPosition(new THREE.Vector3());
        game.effects.tracer(m, r.point, [2, 1.4, 0.6]); game.effects.muzzle(m, dir, 0.7, false);
        game.audio.shot('turret', this.pos);
        if (r.ent && this.owner.isPlayer) { game.hud.hitmarker(r.killed); }
      }
    } else this.yaw += dt * 0.6;
    this.head.rotation.y = this.yaw;
  }
}

// ---------- 武装直升机 ----------
export class Heli {
  constructor(game, team, owner, opts = {}) {
    this.game = game; this.team = team; this.owner = owner; this.alive = true;
    this.t = opts.duration || 45; this.ang = Math.random() * 6; this.fireT = 0; this.target = null; this.scanT = 0;
    this.radius = Math.min(28, game.world.half * 0.55); this.height = opts.height || 24;
    this.stats = { dmgNear: 26, dmgFar: 22, rangeNear: 30, rangeFar: 80, headMul: 1.2, name: '武装直升机' };
    this.mesh = buildHeli(team === game.player.team ? 0x3a4a3a : 0x2a2a2a);
    this.rotor = this.mesh.userData.rotor; this.tail = this.mesh.userData.tail;
    game.scene.add(this.mesh);
    this.pos = new THREE.Vector3();
    this.enter = 1;
    game.audio.loop('heli' + this.ang, 'rotor', 0.0);
    this.loopName = 'heli' + this.ang;
  }
  update(dt) {
    const game = this.game;
    this.t -= dt;
    if (this.t <= 0) { this.alive = false; this.dispose(); return; }
    this.ang += dt * 0.18;
    this.enter = Math.max(0, this.enter - dt * 0.3);
    const r = this.radius + this.enter * 120;
    this.pos.set(Math.cos(this.ang) * r, this.height + this.enter * 20, Math.sin(this.ang) * r);
    this.mesh.position.copy(this.pos);
    this.rotor.rotation.y += dt * 30; this.tail.rotation.x += dt * 40;
    const d = game.player ? this.pos.distanceTo(game.camera.position) : 100;
    game.audio.setLoopVol(this.loopName, clamp(0.5 - d / 150, 0.02, 0.5));
    this.scanT -= dt; this.fireT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 0.5; this.target = null; let bd = 90;
      for (const e of game.entities) {
        if (!e.alive || e.team === this.team || !e.chestPos) continue;
        if (e.isPlayer && e.hasPerk('coldblooded')) continue;
        const c = e.chestPos(new THREE.Vector3());
        const dd = c.distanceTo(this.pos);
        if (dd > bd || game.world.lineBlocked(this.pos, c)) continue;
        bd = dd; this.target = e;
      }
    }
    let look = this.ang + Math.PI;
    if (this.target && this.target.alive) {
      const c = this.target.chestPos(new THREE.Vector3());
      look = Math.atan2(-(c.x - this.pos.x), -(c.z - this.pos.z));
      if (this.fireT <= 0 && this.enter <= 0) {
        this.fireT = 0.09;
        const dir = spreadDir(c.clone().sub(this.pos).normalize(), 2.6 * DEG, new THREE.Vector3());
        const shooter = { team: this.team, isPlayer: false, name: '武装直升机', kills: undefined, alive: true };
        const res = fireHitscan(game, this.owner && this.owner.isPlayer ? this.owner : shooter, this.pos.clone().add(new THREE.Vector3(0, -1, 0)), dir, this.stats, '武装直升机');
        game.effects.tracer(this.pos.clone().add(new THREE.Vector3(0, -1.2, 0)), res.point, [2, 1.3, 0.5]);
        game.audio.shot('turret', this.pos);
        if (res.ent && this.owner && this.owner.isPlayer) game.hud.hitmarker(res.killed);
      }
    } else look = this.ang + Math.PI;
    this.mesh.rotation.y = look;
    this.mesh.rotation.z = Math.sin(this.ang * 3) * 0.05;
    this.mesh.rotation.x = -0.1;
  }
  dispose() { this.game.scene.remove(this.mesh); this.game.audio.stopLoop(this.loopName); }
}

export function buildHeli(color = 0x3a4a3a) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.2, 3.2, 6, 12).rotateX(Math.PI / 2), paint); g.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), mat('windowDark')); nose.position.set(0, 0.2, -2.2); nose.scale.set(0.9, 0.8, 0.8); g.add(nose);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 5.5, 8).rotateX(Math.PI / 2), paint); boom.position.set(0, 0.4, 4.6); g.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 1), paint); fin.position.set(0, 1.1, 7.1); g.add(fin);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.6, 8), mat('darkMetal')); mast.position.y = 1.5; g.add(mast);
  const rotor = new THREE.Group(); rotor.position.y = 1.8; g.add(rotor);
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 7.5), mat('darkMetal')); b.rotation.y = i * Math.PI / 4 * 2 / 2 + i * Math.PI / 4; b.position.z = 0; rotor.add(b); }
  const tail = new THREE.Group(); tail.position.set(0.2, 1.2, 7.1); g.add(tail);
  for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.6, 0.15), mat('darkMetal')); b.rotation.x = i * Math.PI / 2; tail.add(b); }
  for (const x of [-0.9, 0.9]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 3), mat('darkMetal')); s.position.set(x, -1.35, 0); g.add(s); const st = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), mat('darkMetal')); st.position.set(x, -1.15, 0); g.add(st); }
  for (const x of [-1.3, 1.3]) { const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.2, 8).rotateX(Math.PI / 2), mat('darkMetal')); pod.position.set(x, -0.3, -0.3); g.add(pod); }
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.3, 0.3) })); light.position.set(0, -1.2, 0); g.add(light);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData = { rotor, tail };
  return g;
}
