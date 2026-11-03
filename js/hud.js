// HUD 显示
import * as THREE from 'three';
import { KILLSTREAKS } from './data.js';
import { fmtTime, clamp } from './util.js';

const $ = id => document.getElementById(id);
const _v = new THREE.Vector3();

export class HUD {
  constructor(game) {
    this.game = game;
    this.el = $('hud');
    this.mm = $('minimap').getContext('2d');
    this.hitT = 0; this.flashT = 0; this.flashMax = 1; this.alertT = 0;
    this.dmgDirs = [];
    this.subQueue = []; this.subT = 0;
    this.announceT = 0;
    this.buildCompass();
    this.fpsAcc = 0; this.fpsN = 0;
  }
  show(v) { this.el.classList.toggle('hidden', !v); }
  buildCompass() {
    const strip = $('compassStrip');
    const names = { 0: '北', 45: '东北', 90: '东', 135: '东南', 180: '南', 225: '西南', 270: '西', 315: '西北' };
    let html = '';
    for (let rep = -1; rep <= 1; rep++) {
      for (let a = 0; a < 360; a += 15) {
        const x = (a + rep * 360) * 4;
        html += names[a] !== undefined ? `<span style="left:${x}px">${names[a]}</span>` : `<span class="minor" style="left:${x}px">${a}</span>`;
      }
    }
    strip.innerHTML = html;
  }
  reset() {
    if (this.combatLines) { for (const entry of this.combatLines.values()) clearTimeout(entry.timer); this.combatLines.clear(); }
    $('killfeed').innerHTML = ''; $('popups').innerHTML = ''; $('subtitles').innerHTML = ''; $('objective').innerHTML = '';
    $('markers').innerHTML = ''; $('dmgDirs').innerHTML = ''; this.dmgDirs = []; this.subQueue = []; this.subT = 0;
    $('fade').style.opacity = 0; $('flashOverlay').style.opacity = 0; this.flashT = 0;
    $('announce').style.opacity = 0; $('scorebar').innerHTML = ''; $('streaks').innerHTML = '';
    this.markerEls = {};
  }
  hitmarker(kill, head) {
    const h = $('hitmarker');
    h.classList.toggle('kill', !!kill);
    h.classList.toggle('head', !!head && !kill);
    h.style.opacity = 1; this.hitT = kill ? 0.35 : 0.18;
    h.style.transform = `scale(${kill ? 1.3 : 1})`;
  }
  flash(t) { this.flashT = t; this.flashMax = t; }
  damageFrom(pos) {
    const el = document.createElement('div'); el.className = 'dmgdir';
    $('dmgDirs').appendChild(el);
    this.dmgDirs.push({ el, pos: pos.clone(), t: 1.6 });
  }
  highAlert(pos) {
    const pl = this.game.player; if (!pl) return;
    const cam = this.game.camera;
    _v.copy(pos).project(cam);
    if (_v.z > 1 || Math.abs(_v.x) > 1 || Math.abs(_v.y) > 1) this.alertT = 0.4;
  }
  killfeed(killer, victim, weapon, head) {
    const kf = $('killfeed');
    const cls = e => !e ? '' : e.isPlayer ? 'me' : this.game.mode && this.game.mode.ffa ? 'B' : (e.team === this.game.player.team ? 'A' : 'B');
    const d = document.createElement('div'); d.className = 'kf';
    const kn = killer && killer !== victim ? `<span class="${cls(killer)}">${killer.name}</span>` : '';
    d.innerHTML = `${kn}<span class="w">${weapon || '击杀'}${head ? ' ✹' : ''}</span><span class="${cls(victim)}">${victim.name}</span>`;
    kf.prepend(d);
    while (kf.children.length > 6) kf.lastChild.remove();
    setTimeout(() => d.remove(), 6000);
  }
  popup(text, color = '#fff', medal = false) {
    const p = $('popups');
    const d = document.createElement('div'); d.className = 'pop' + (medal ? ' medal' : ''); d.style.color = medal ? '' : color; d.textContent = text;
    p.appendChild(d);
    while (p.children.length > 5) p.firstChild.remove();
    setTimeout(() => d.remove(), 2200);
  }
  combatScore(label, points) {
    // Accumulate sustained fire in one line rather than flooding the kill medals.
    this.combatLines ||= new Map();
    let entry = this.combatLines.get(label);
    if (!entry || !entry.el.isConnected) {
      if (entry) clearTimeout(entry.timer);
      const el = document.createElement('div'); el.className = 'pop';
      el.style.color = label === '压制' ? '#9cc8da' : label === '爆头命中' ? '#ffd479' : '#fff';
      $('popups').appendChild(el);
      entry = { el, points: 0, timer: null }; this.combatLines.set(label, entry);
    }
    entry.points += points;
    entry.el.textContent = `${label} +${entry.points}`;
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => { entry.el.remove(); this.combatLines.delete(label); }, 1200);
  }
  announce(title, sub = '', dur = 3) {
    const a = $('announce');
    a.innerHTML = title + (sub ? `<small>${sub}</small>` : '');
    a.style.opacity = 1; this.announceT = dur;
  }
  subtitle(speaker, text, dur) {
    this.subQueue.push({ speaker, text, dur: dur || Math.max(2.5, text.length * 0.16) });
  }
  objective(title, desc, sub = '') {
    $('objective').innerHTML = title ? `<div class="obj-t">${title}</div><div class="obj-d">${desc}</div>${sub ? `<div class="obj-s">${sub}</div>` : ''}` : '';
  }
  prompt(text) {
    const p = $('prompt');
    if (!text) { p.style.display = 'none'; return; }
    p.style.display = 'block'; p.innerHTML = text;
  }
  progress(v) {
    const p = $('progress');
    if (v === null || v === undefined) { p.style.display = 'none'; return; }
    p.style.display = 'block'; $('progressFill').style.width = (v * 100) + '%';
  }
  fade(v, dur = 1) { const f = $('fade'); f.style.transition = `opacity ${dur}s`; f.style.opacity = v; }
  scorebar(html) { $('scorebar').innerHTML = html; }
  streaks(list, kills) {
    const el = $('streaks');
    if (!list) { el.innerHTML = ''; return; }
    el.innerHTML = list.map((s, i) => {
      const def = KILLSTREAKS.find(k => k.id === s.id);
      return `<div class="stk ${s.ready ? 'ready' : ''}"><span>${s.ready ? `[${i + 3}] ` : ''}${def.name}</span><span class="k">${s.ready ? '就绪' : s.cost}</span><span class="ic">${def.icon}</span></div>`;
    }).join('') + `<div class="stk"><span>连杀</span><span class="k">${kills}</span></div>`;
  }

  update(dt) {
    const game = this.game, pl = game.player;
    if (!pl) return;
    // FPS
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 0.5) { $('fps').textContent = game.settings.showFps ? Math.round(this.fpsN / this.fpsAcc) + ' FPS' : ''; this.fpsAcc = 0; this.fpsN = 0; }
    const ws = pl.ws, w = ws.w;
    // 准星
    const ch = $('crosshair');
    const scoped = game.scopeState;
    const hideCross = ws.adsT > 0.4 || pl.sprinting || !pl.alive || (w && w.stats.type === 'sniper');
    ch.style.display = hideCross ? 'none' : 'block';
    if (w && !hideCross) {
      const spread = ws.currentSpread();
      const px = 4 + spread * (window.innerHeight / game.camera.fov) * 0.5;
      const cs = ch.children;
      cs[0].style.top = (-px - 9) + 'px'; cs[1].style.top = px + 'px';
      cs[2].style.left = (-px - 9) + 'px'; cs[3].style.left = px + 'px';
    }
    // 瞄准镜
    const sc = $('scope');
    if (scoped) { sc.classList.remove('hidden'); sc.className = scoped === 'sniper' ? '' : scoped; }
    else sc.classList.add('hidden');
    // 命中
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) $('hitmarker').style.opacity = 0; }
    // 闪光
    if (this.flashT > 0) { this.flashT -= dt; $('flashOverlay').style.opacity = clamp(this.flashT / Math.min(1.5, this.flashMax), 0, 1); }
    else $('flashOverlay').style.opacity = 0;
    // 受伤
    const hpk = pl.hp / pl.maxHp;
    $('vignette').style.opacity = clamp((1 - hpk) * 1.3, 0, 1);
    const hf = $('healthFill'); hf.style.width = (hpk * 100) + '%'; hf.classList.toggle('low', hpk < 0.35);
    // 伤害方向
    for (let i = this.dmgDirs.length - 1; i >= 0; i--) {
      const d = this.dmgDirs[i];
      d.t -= dt;
      if (d.t <= 0) { d.el.remove(); this.dmgDirs.splice(i, 1); continue; }
      const dx = d.pos.x - pl.pos.x, dz = d.pos.z - pl.pos.z;
      const ang = Math.atan2(dx, -dz) + pl.yaw; // 屏幕角
      d.el.style.transform = `rotate(${ang}rad)`;
      d.el.style.opacity = Math.min(1, d.t);
    }
    // 警觉
    this.alertT -= dt;
    $('alertEdge').style.opacity = this.alertT > 0 ? 1 : 0;
    // 弹药
    if (w) {
      $('weaponName').textContent = w.stats.name + (w.stats.suppressed ? ' · 消音' : '');
      const m = $('ammoMag'); m.textContent = w.mag; m.classList.toggle('low', w.mag <= Math.ceil(w.stats.mag * 0.25));
      $('ammoRes').textContent = '/ ' + w.reserve;
      let eq = '';
      if (pl.lethal) eq += `<span>[G] ${pl.lethal.name}<b>×${pl.lethal.count}</b></span>`;
      if (pl.tactical) eq += `<span>[Q] ${pl.tactical.name}<b>×${pl.tactical.count}</b></span>`;
      if (game.mode && game.mode.nvgAvailable) eq += `<span>[N] 夜视仪</span>`;
      $('equipRow').innerHTML = eq;
    }
    // 罗盘
    const deg = ((-pl.yaw * 180 / Math.PI) % 360 + 360) % 360;
    $('compassStrip').style.left = (230 - deg * 4 - 0) + 'px';
    // 字幕
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) $('subtitles').innerHTML = ''; }
    if (this.subT <= 0 && this.subQueue.length) {
      const s = this.subQueue.shift();
      $('subtitles').innerHTML = `<span class="sp">${s.speaker}：</span>${s.text}`;
      this.subT = s.dur;
      game.audio.say(s.text, 1.15, s.speaker.includes('指挥部') ? 0.7 : 0.9);
      if (s.speaker) game.audio.beep(1);
    }
    if (this.announceT > 0) { this.announceT -= dt; if (this.announceT <= 0) $('announce').style.opacity = 0; }
    // 瞄准敌人名称
    const en = $('enemyName');
    let name = '';
    if (pl.alive) {
      const cam = game.camera;
      const d = cam.getWorldDirection(_v);
      let best = 60;
      const wh = game.world.raycast(cam.position, d, 60);
      if (wh) best = wh.t;
      for (const e of game.entities) {
        if (e === pl || !e.alive || e.team === pl.team || !e.hitTest) continue;
        const h = e.hitTest(cam.position, d, best);
        if (h) { name = e.name; best = h.t; }
      }
    }
    en.textContent = name;
    this.drawMinimap();
    this.drawTacticalMap();
    this.updateMarkers();
  }

  // 3D标记
  setMarkers(list) { this.markerList = list; }
  updateMarkers() {
    const list = this.markerList || [];
    const box = $('markers');
    if (!this.markerEls) this.markerEls = {};
    const seen = new Set();
    const cam = this.game.camera, pl = this.game.player;
    const W = window.innerWidth, H = window.innerHeight;
    for (const m of list) {
      seen.add(m.id);
      let el = this.markerEls[m.id];
      if (!el) { el = document.createElement('div'); box.appendChild(el); this.markerEls[m.id] = el; }
      el.className = 'marker ' + (m.cls || '');
      _v.copy(m.pos).project(cam);
      const behind = _v.z > 1;
      let x = (_v.x * 0.5 + 0.5) * W, y = (-_v.y * 0.5 + 0.5) * H;
      if (behind) { x = W - x; y = H - 40; }
      x = clamp(x, 40, W - 40); y = clamp(y, 60, H - 40);
      const dist = Math.round(m.pos.distanceTo(pl.pos));
      el.style.left = x + 'px'; el.style.top = y + 'px';
      el.innerHTML = `<div class="dia"><span>${m.label || ''}</span></div>${m.text ? m.text + ' ' : ''}${m.hideDist ? '' : dist + 'm'}`;
    }
    for (const id in this.markerEls) if (!seen.has(id)) { this.markerEls[id].remove(); delete this.markerEls[id]; }
  }

  drawMinimap() {
    const game = this.game, pl = game.player, world = game.world;
    const ctx = this.mm, S = 220, R = 45; // 显示半径（米）
    const scale = S / (R * 2);
    ctx.save();
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(20,24,20,.6)'; ctx.fillRect(0, 0, S, S);
    ctx.translate(S / 2, S / 2);
    ctx.rotate(pl.yaw);
    const k = world.topK;
    const sz = world.def.size * scale;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(world.topDown, (-pl.pos.x - world.half) * scale, (-pl.pos.z - world.half) * scale, sz, sz);
    ctx.globalAlpha = 1;
    const dot = (x, z, color, r = 4, tri = false, yaw = 0) => {
      const px = (x - pl.pos.x) * scale, pz = (z - pl.pos.z) * scale;
      ctx.save(); ctx.translate(px, pz);
      ctx.fillStyle = color;
      if (tri) { ctx.rotate(-yaw); ctx.beginPath(); ctx.moveTo(0, -r * 1.4); ctx.lineTo(r, r); ctx.lineTo(-r, r); ctx.closePath(); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); }
      ctx.restore();
    };
    // 目标点
    const mode = game.mode;
    if (mode && mode.flags) for (const f of mode.flags) {
      const px = (f.pos.x - pl.pos.x) * scale, pz = (f.pos.z - pl.pos.z) * scale;
      ctx.save(); ctx.translate(px, pz); ctx.rotate(-pl.yaw);
      ctx.fillStyle = f.owner === pl.team ? '#4fb4ff' : f.owner ? '#ff4a3d' : '#fff';
      ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillText(f.name, 0, 1);
      ctx.restore();
    }
    if (mode && mode.minimapMarkers) for (const m of mode.minimapMarkers()) dot(m.x, m.z, m.color || '#ffb400', 5);
    const uav = mode && mode.uavActive && mode.uavActive(pl.team);
    for (const e of game.entities) {
      if (e === pl || !e.alive || !e.pos) continue;
      if (e.team === pl.team && !(mode && mode.ffa)) dot(e.pos.x, e.pos.z, '#4fb4ff', 3.5, true, e.yaw || 0);
      else {
        const show = uav || (e.revealT > 0);
        if (show) dot(e.pos.x, e.pos.z, '#ff3b30', 4);
      }
    }
    ctx.restore();
    // 玩家
    ctx.fillStyle = '#d4f24a';
    ctx.beginPath(); ctx.moveTo(S / 2, S / 2 - 8); ctx.lineTo(S / 2 + 6, S / 2 + 6); ctx.lineTo(S / 2 - 6, S / 2 + 6); ctx.closePath(); ctx.fill();
    // 视野锥
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.beginPath(); ctx.moveTo(S / 2, S / 2); ctx.lineTo(S / 2 - 70, 0); ctx.lineTo(S / 2 + 70, 0); ctx.closePath(); ctx.fill();
    if (uav) { ctx.strokeStyle = 'rgba(212,242,74,.6)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, S - 2, S - 2); }
  }

  drawTacticalMap() {
    const game = this.game, w = game.world, mode = game.mode;
    if (!this.tacticalEl) {
      this.tacticalEl = document.createElement('div'); this.tacticalEl.id = 'tacticalMap';
      this.tacticalCanvas = document.createElement('canvas'); this.tacticalCanvas.width = 1000; this.tacticalCanvas.height = 760;
      this.tacticalEl.appendChild(this.tacticalCanvas); $('hud').appendChild(this.tacticalEl);
    }
    const show = !!(w.sectors && game.input.keys.KeyM && !game.paused);
    this.tacticalEl.style.display = show ? 'flex' : 'none';
    if (!show) return;
    const ctx = this.tacticalCanvas.getContext('2d'), scale = 3.35;
    const [x0, z0, x1, z1] = w.def.extents, sx = 55, sy = 85;
    ctx.fillStyle = '#17221f'; ctx.fillRect(0, 0, 1000, 760);
    ctx.fillStyle = '#e2e8d6'; ctx.font = 'bold 26px sans-serif'; ctx.fillText('烬区 / 战术地图', 40, 42);
    ctx.font = '14px sans-serif'; ctx.fillStyle = '#a9baac'; ctx.fillText('N ↑    A 岩下村 → B1 / B2 → C1 / C2     ·     松开 M 返回', 40, 66);
    ctx.drawImage(w.topDown, (x0 + w.half) * w.topK, (z0 + w.half) * w.topK, (x1 - x0) * w.topK, (z1 - z0) * w.topK, sx, sy, (x1 - x0) * scale, (z1 - z0) * scale);
    const px = x => sx + (x - x0) * scale, pz = z => sy + (z - z0) * scale;
    for (let i = 0; i < (mode.breakthrough?.sectors || w.sectors).length; i++) {
      const sector = (mode.breakthrough?.sectors || w.sectors)[i];
      for (const f of sector.objectives) {
        const active = mode.breakthrough && mode.breakthrough.stage === i;
        const completed = mode.breakthrough && mode.breakthrough.stage > i;
        ctx.strokeStyle = completed ? '#60b5f0' : active ? '#edb967' : '#b7b8a6';
        ctx.fillStyle = active ? 'rgba(237,185,103,.22)' : 'rgba(20,30,25,.4)'; ctx.lineWidth = active ? 3 : 1;
        ctx.beginPath(); ctx.arc(px(f.x), pz(f.z), f.radius * scale, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.font = 'bold 18px sans-serif'; ctx.fillText(f.name, px(f.x), pz(f.z) + 6);
        ctx.font = '13px sans-serif'; ctx.fillText(f.title, px(f.x), pz(f.z) + f.radius * scale + 19);
      }
    }
    for (const e of game.entities) {
      if (!e.alive || !e.pos || e.team !== game.player.team) continue;
      ctx.fillStyle = e.isPlayer ? '#e1f58e' : '#60b5f0'; ctx.beginPath(); ctx.arc(px(e.pos.x), pz(e.pos.z), e.isPlayer ? 6 : 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.textAlign = 'left'; ctx.font = '16px sans-serif'; ctx.fillStyle = '#d8dfca';
    ctx.fillText('西侧高地 / 岩下村     ·     营地围墙 / 贫民窟屋顶     ·     仓库双墙 / 办公区三路入口', 40, 729);
  }

  showScoreboard(v) {
    const el = $('scoreboard');
    if (!v) { el.classList.add('hidden'); return; }
    const mode = this.game.mode;
    if (!mode || !mode.scoreboardHTML) return;
    el.innerHTML = mode.scoreboardHTML();
    el.classList.remove('hidden');
  }
}
