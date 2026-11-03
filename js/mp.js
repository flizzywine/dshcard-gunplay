// 团队死斗：主角固定武器与普通步枪兵。
import * as THREE from 'three';
import { Player } from './player.js';
import { Bot } from './ai.js';
import { MAPS } from './maps.js';
import { BOT_NAMES } from './data.js';
import { heroLoadout } from './arsenal.js';
import { rand, pick, fmtTime } from './util.js';

export class MPMatch {
  constructor(game, cfg) {
    this.game = game; this.cfg = cfg;
    if (!['tdm','breakthrough'].includes(cfg.mode)) throw new Error('不支持的对战模式');
    this.type = cfg.mode;
    this.scoreLimit = cfg.scoreLimit || 50;
    this.timeLeft = (cfg.timeLimit || 10) * 60;
    this.scores = { A: 0, B: 0 };
    this.respawns = [];
    this.canChangeClass = false;
    this.firstBlood = false;
    this.over = false;
    this.lastKillTimes = [];
  }
  start() {
    const game = this.game, w = game.world, def = MAPS[this.cfg.map];
    const pteam = 'A';
    // 玩家
    const lo = heroLoadout();
    game.playerSleeve = 'fab_ally';
    const sp = this.spawnPoint(pteam);
    const pl = game.player = new Player(game, { team: pteam, pos: sp.pos, yaw: sp.yaw, name: '你' });
    pl.equip(lo);
    game.entities.push(pl);
    // 机器人
    const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    let ni = 0;
    const allyCount = this.cfg.allies ?? 5;
    const enemyCount = this.cfg.enemies ?? 6;
    const opposite = 'B';
    for (let i = 0; i < allyCount; i++) this.addBot(pteam, names[ni++ % names.length], def.styles[0]);
    for (let i = 0; i < enemyCount; i++) this.addBot(opposite, names[ni++ % names.length], def.styles[1]);
    game.hud.reset();
    if(this.announceStart)this.announceStart();
    else{game.hud.announce('团队死斗', `${def.name} · 目标分数 ${this.scoreLimit}`, 4);game.audio.say('团队死斗，行动开始');}
  }
  addBot(team, name, style) {
    const game = this.game;
    const wid = 'm4';
    const sp = this.spawnPoint(team);
    const bot = new Bot(game, { team, name, style, weaponId: wid, att: {}, grenades: 0, difficulty: this.cfg.diff, pos: sp.pos, yaw: sp.yaw, role: 'mp', tag: team === game.player.team, tagColor: '#6cf', camo: 'none' });
    game.addBot(bot);
    return bot;
  }
  enemiesOf(team) { return this.game.entities.filter(e => e.alive && e.team !== team && e.pos && e.targetable !== false); }
  spawnPoint(team) {
    const w = this.game.world;
    let cands = team === 'A' ? w.spawns.A : w.spawns.B;
    const enemies = this.game.entities.filter(e => e.alive && e.team !== team && e.pos);
    // 加入可行走随机点提升出生位置多样性
    if (Math.random() < 0.25) for (let i = 0; i < 6; i++) cands = cands.concat([w.randomWalkable()]);
    let best = cands[0], bs = -1;
    for (const c of cands) {
      let md = 1e9;
      for (const e of enemies) md = Math.min(md, e.pos.distanceTo(c));
      const s = Math.min(md, 60) + Math.random() * 8;
      if (s > bs) { bs = s; best = c; }
    }
    const pos = best.clone();
    const target = new THREE.Vector3();
    const yaw = Math.atan2(pos.x - target.x, pos.z - target.z);
    return { pos, yaw };
  }

  // ---------- 机器人目标 ----------
  botGoal(bot) {
    const w = this.game.world;
    // Patrol may use recent own/team reports, never unseen live enemy positions.
    const reports = this.game.bots.filter(o => o.alive && o.team === bot.team && o.lastSeenPos && this.game.time - o.lastSeenT >= 0 && this.game.time - o.lastSeenT < 8);
    if (reports.length && Math.random() < 0.55) {
      const position = pick(reports).lastSeenPos;
      if (w.navigation) return w.navigation.point(w.navigation.nearest(new THREE.Vector3(position.x + rand(-8, 8), position.y, position.z + rand(-8, 8))));
      return w.randomWalkable(position.x, position.z, 12);
    }
    return w.randomWalkable();
  }

  // ---------- 击杀 ----------
  onKill(killer, victim, weapon, head, info) {
    const game = this.game, pl = game.player;
    game.hud.killfeed(killer, victim, weapon, head);
    const kTeam = killer ? killer.team : null;
    if (killer && killer !== victim) {
      if (killer.isPlayer) this.playerKill(victim, weapon, head, info);
      else if (killer.kills !== undefined) {
        killer.kills++; killer.score += 100; killer.streak = (killer.streak || 0) + 1;
      }
      this.scores[kTeam === pl.team ? 'A' : 'B'] = (this.scores[kTeam === pl.team ? 'A' : 'B'] || 0) + 1;
    }
    // 助攻
    if (victim.dmgTaken && pl.alive !== undefined) {
      const d = victim.dmgTaken.get(pl);
      if (d && killer !== pl) { pl.stats.assists++; pl.stats.score += 25; game.hud.popup('+25 助攻', '#ddd');  }
    }
    if (!this.firstBlood && killer && killer !== victim) {
      this.firstBlood = true;
      if (killer.isPlayer) { game.hud.popup('首杀', '', true); pl.stats.score += 50; }
    }
    // 掉落武器
    // 复活安排
    if (victim.isPlayer) {
      game.dead = true; game.deathKiller = killer;
      this.respawns.push({ e: victim, t: 4.5 });
      const el = document.getElementById('deathScreen');
      el.classList.remove('hidden');
      document.getElementById('killerInfo').innerHTML = killer && killer !== victim ? `被 <b>${killer.name}</b> 使用 ${weapon || ''} ${head ? '爆头' : ''}击杀` : '你自杀了';
      pl.stats.streak = 0;
      if (document.pointerLockElement) document.exitPointerLock();
    } else {
      victim.streak = 0;
      this.respawns.push({ e: victim, t: 4 + Math.random() * 2 });
    }
  }
  playerKill(victim, weapon, head, info) {
    const game = this.game, pl = game.player;
    pl.stats.kills++; pl.stats.streak++;
    let pts = 100;
    game.hud.popup('+100 击杀', '#fff');
    if (head) { pl.stats.headshots++; pts += 50; game.hud.popup('爆头 +50', '', true); }
    if (info && info.melee) { pts += 50; game.hud.popup('近战击杀', '', true); }
    const dist = victim.pos.distanceTo(pl.pos);
    if (dist > 40 && !info.explosive) { pts += 50; game.hud.popup('远距离击杀 +50', '', true); }
    const now = game.time;
    this.lastKillTimes = this.lastKillTimes.filter(t => now - t < 4); this.lastKillTimes.push(now);
    const n = this.lastKillTimes.length;
    if (n >= 2) { const names = ['', '', '双杀', '三杀', '四杀', '暴走', '无人可挡']; game.hud.popup(names[Math.min(n, 6)] + ` +${n * 50}`, '', true); pts += n * 50; game.audio.say(names[Math.min(n, 6)]); }
    if (pl.lastAttacker === victim) { game.hud.popup('复仇 +50', '', true); pts += 50; pl.lastAttacker = null; }
    if (pl.stats.streak % 5 === 0) game.hud.popup(`连杀 ×${pl.stats.streak}`, '', true);
    pl.stats.score += pts;
  }
  // ---------- 更新 ----------
  update(dt, inp) {
    const game = this.game, pl = game.player;
    if (this.over) { return; }
    if(this.type==='tdm')this.timeLeft -= dt;
    // 复活
    for (let i = this.respawns.length - 1; i >= 0; i--) {
      const r = this.respawns[i];
      if(this.canRespawn&&!this.canRespawn(r.e)){if(r.e.isPlayer)document.getElementById('respawnText').textContent='增援耗尽 · 等待队友完成进攻';continue;}
      r.t -= dt;
      if (r.e.isPlayer) {
        document.getElementById('respawnText').textContent = r.t > 0 ? `${Math.ceil(r.t)} 秒后重新部署…` : '按 [空格] 重新部署';
        if (r.t <= 0 && (game.input.keys.Space || r.t < -4)) {
          const sp = this.spawnPoint(pl.team);
          pl.respawn(sp.pos, sp.yaw);
          game.dead = false;
          document.getElementById('deathScreen').classList.add('hidden');
          this.respawns.splice(i, 1);
          game.lock();
        }
      } else if (r.t <= 0) {
        const sp = this.spawnPoint(r.e.team);
        r.e.respawn(sp.pos, sp.yaw);
        this.respawns.splice(i, 1);
      }
    }
    // HUD
    if(this.updateObjectives)this.updateObjectives(dt);
    this.hudScore();
    if(this.type==='tdm'){
      game.hud.setMarkers([]);
      if (this.scores.A >= this.scoreLimit) this.end('A');
      else if (this.scores.B >= this.scoreLimit) this.end('B');
      if (this.timeLeft <= 0) this.end(this.scores.A > this.scores.B ? 'A' : this.scores.B > this.scores.A ? 'B' : 'draw');
    }
  }
  hudScore() {
    const game = this.game, pl = game.player;
    const t = fmtTime(this.timeLeft);
    game.hud.scorebar(`<div class="sb-team a">${Math.floor(this.scores.A)}</div><div class="sb-time">${t}</div><div class="sb-team b">${Math.floor(this.scores.B)}</div>`);
  }
  ranking() {
    const game = this.game, pl = game.player;
    const list = [{ e: pl, k: pl.stats.kills, d: pl.stats.deaths, s: pl.stats.score }];
    for (const b of game.bots) list.push({ e: b, k: b.kills, d: b.deaths, s: b.score });
    return list.sort((a, b) => b.k - a.k || b.s - a.s);
  }
  scoreboardHTML() {
    const game = this.game, pl = game.player;
    const row = (x, i) => `<tr class="${x.e.isPlayer ? 'me' : ''} ${x.e.alive ? '' : 'dead'}"><td>${i + 1}. ${x.e.name}</td><td>${x.s}</td><td>${x.k}</td><td>${x.d}</td><td>${x.e.isPlayer ? pl.stats.assists : '-'}</td></tr>`;
    const head = (t, cls) => `<table class="sbt ${cls}"><tr><th>${t}</th><th>得分</th><th>击杀</th><th>死亡</th><th>助攻</th></tr>`;
    const all = this.ranking();
    const A = all.filter(x => x.e.team === pl.team), B = all.filter(x => x.e.team !== pl.team);
    return head(`联合特遣队 · ${Math.floor(this.scores.A)}`, 'A') + A.map(row).join('') + '</table>' + head(`敌方部队 · ${Math.floor(this.scores.B)}`, 'B') + B.map(row).join('') + '</table>';
  }
  minimapMarkers() { return []; }
  end(winner) {
    if (this.over) return;
    this.over = true;
    const game = this.game, pl = game.player;
    game.ending = true;
    let win;
    win = winner === 'draw' ? 'draw' : winner === pl.team ? 'win' : 'lose';
    const xp = pl.stats.score + (win === 'win' ? 500 : 150);
    game.profile.xp += xp; game.saveProfile();
    game.audio.say(win === 'win' ? '胜利' : win === 'draw' ? '平局' : '失败');
    game.hud.announce(win === 'win' ? '胜利' : win === 'draw' ? '平局' : '失败', '', 3);
    this.resultsTimer=setTimeout(() => {
      if(game.mode!==this)return;
      if (document.pointerLockElement) document.exitPointerLock();
      game.menu.showResults({
        win, title: win === 'win' ? '胜利' : win === 'draw' ? '平局' : '失败',
        sub: this.type==='breakthrough'?`攻防 · ${this.activeSector.label} 区 · 剩余增援 ${this.control.tickets}`:`${Math.floor(this.scores.A)} : ${Math.floor(this.scores.B)}`,
        stats: [['得分', pl.stats.score], ['击杀', pl.stats.kills], ['死亡', pl.stats.deaths], ['K/D', (pl.stats.kills / Math.max(1, pl.stats.deaths)).toFixed(2)], ['命中率', Math.round(pl.stats.hits / Math.max(1, pl.stats.shots) * 100) + '%'], ['经验值', '+' + xp]],
        board: this.scoreboardHTML(), again: () => game.startGame('mp', this.cfg),
      });
    }, 2500);
  }
  dispose() {
    clearTimeout(this.resultsTimer);
    this.game.hud.progress(null);
  }
}
