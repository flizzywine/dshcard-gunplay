// 菜单系统：主菜单、多人大厅、固定武器、设置、暂停、结算
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { WEAPONS, MP_MAPS, MP_MODES } from './data.js';
import { HERO_WEAPONS, WEAPON_ROLES } from './arsenal.js';
import { buildGun } from './gunmodel.js';
import { createSoldierModel, animateSoldier } from './soldier.js';
import { mat, camoSwatch } from './materials.js';
import { damp } from './util.js';

const DIFF_NAMES = ['新兵', '正规军', '老兵'];

// 地图缩略插画（内联SVG）
const MAP_ART = {
  cracked: `<img src="./assets/maps/cracked-radar.svg" alt="烬区通路俯视图" style="width:100%;height:100%;object-fit:contain;background:#383a37">`,
  karkand: `<img src="./assets/maps/karkand-radar.svg" alt="Karkand 通路俯视图" style="width:100%;height:100%;object-fit:contain;background:#383a37">`,
  dust2: `<img src="./assets/maps/dust2-radar.svg" alt="Dust II 通路俯视图" style="width:100%;height:100%;object-fit:contain;background:#383a37">`,
};

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Menu {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('menu');
    this.overlayOpen = false;
    this.camTarget = { pos: new THREE.Vector3(-0.3, 1.45, 4.2), look: new THREE.Vector3(0.6, 1.15, 0) };
    this.camLook = this.camTarget.look.clone();
    this.gunRotY = -Math.PI / 2; this.gunRotX = 0; this.gunSpin = true;
    this.lobby = { mode: 'breakthrough', map: 'cracked', diff: 1, allies: 5, enemies: 6, time: 15 };
    this.selClass = game.profile.selClass || 0;
    this.buildScene();
    this.el.addEventListener('pointerdown', () => game.audio.init());
    this.el.addEventListener('mouseover', e => { const t = e.target.closest('.mbtn,.btn,.pick,.cls,.slotc,.gs-att,.gs-slot,.mode,.mapc,.diff'); if (t && t !== this._hov) { this._hov = t; game.audio.ui('hover'); } });
    this.el.addEventListener('click', e => { if (e.target.closest('.mbtn,.btn,.pick,.cls,.slotc,.gs-att,.gs-slot,.mode,.mapc,.diff,.seg div,.camo')) game.audio.ui('click'); });
    window.addEventListener('keydown', e => {
      if (e.code === 'Escape' && game.paused && this.screen === 'pause' && performance.now() - this.pauseAt > 300) this.resume();
    });
    // 枪匠拖拽旋转
    let drag = null;
    this.el.addEventListener('pointerdown', e => { if (this.screen === 'gunsmith' && !e.target.closest('.gs-left,.gs-right,.gs-stats,.gs-foot')) { drag = { x: e.clientX, y: e.clientY }; this.gunSpin = false; } });
    window.addEventListener('pointermove', e => { if (drag) { this.gunRotY += (e.clientX - drag.x) * 0.01; this.gunRotX = Math.max(-0.6, Math.min(0.6, this.gunRotX + (e.clientY - drag.y) * 0.006)); drag.x = e.clientX; drag.y = e.clientY; } });
    window.addEventListener('pointerup', () => { drag = null; });
    this.el.addEventListener('wheel', e => { if (this.screen === 'gunsmith') { this.gsZoom = Math.max(0.8, Math.min(2.2, (this.gsZoom || 1.45) + Math.sign(e.deltaY) * 0.1)); this.camTarget.pos.z = this.gsZoom; } }, { passive: true });
  }

  // ---------------- 3D 场景 ----------------
  buildScene() {
    const game = this.game;
    const s = this.scene3d = new THREE.Scene();
    s.background = new THREE.Color(0x06080a);
    s.fog = new THREE.FogExp2(0x06080a, 0.07);
    const pm = new THREE.PMREMGenerator(game.renderer);
    s.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    s.environmentIntensity = 0.3;
    pm.dispose();
    const cam = this.camera3d = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.05, 100);
    cam.position.copy(this.camTarget.pos);
    const plane = (w, h, m, sc) => {
      const g = new THREE.PlaneGeometry(w, h);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / sc, uv.getY(i) * h / sc);
      const me = new THREE.Mesh(g, m); me.receiveShadow = true; return me;
    };
    const floor = plane(40, 40, mat('concreteDark'), 3); floor.rotation.x = -Math.PI / 2; s.add(floor);
    const wall = plane(40, 12, mat('concreteDark'), 3); wall.position.set(0, 6, -5); s.add(wall);
    // 道具：箱子、沙袋、油桶
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat('crate')); crate.position.set(-1.4, 0.5, -1.6); crate.rotation.y = 0.3; crate.castShadow = crate.receiveShadow = true; s.add(crate);
    const crate2 = crate.clone(); crate2.scale.setScalar(0.7); crate2.position.set(-1.35, 1.35, -1.6); crate2.rotation.y = 0.7; s.add(crate2);
    const case1 = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.35, 0.5), mat('darkMetal')); case1.position.set(2.4, 0.175, -1.2); case1.rotation.y = -0.4; case1.castShadow = true; s.add(case1);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 20), mat('containerGreen')); barrel.position.set(2.9, 0.45, -2.4); barrel.castShadow = true; s.add(barrel);
    const sb = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.5, 4, 8).rotateZ(Math.PI / 2), mat('sandbag'));
    for (let i = 0; i < 5; i++) { const b = sb.clone(); b.position.set(-3 + (i % 3) * 0.75 + (i > 2 ? 0.37 : 0), 0.18 + (i > 2 ? 0.32 : 0), -2.6); b.castShadow = true; s.add(b); }
    // 灯光
    const key = new THREE.SpotLight(0xffe2c0, 60, 20, 0.55, 0.6, 1.4);
    key.position.set(3, 5, 4); key.target.position.set(0.6, 1, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0005;
    s.add(key, key.target);
    const rim = new THREE.SpotLight(0x6aa8ff, 70, 20, 0.6, 0.7, 1.3);
    rim.position.set(-3, 4, -3); rim.target.position.set(0.6, 1.2, 0); s.add(rim, rim.target);
    const rim2 = new THREE.PointLight(0xffa040, 6, 8, 1.5); rim2.position.set(3.5, 1.2, -1.5); s.add(rim2);
    this.fireLight = rim2;
    s.add(new THREE.HemisphereLight(0x8090a0, 0x201810, 0.25));
    // 浮尘
    const N = 400, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 10; pos[i * 3 + 1] = Math.random() * 4; pos[i * 3 + 2] = (Math.random() - 0.5) * 8; }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dot = document.createElement('canvas'); dot.width = dot.height = 32; const dc = dot.getContext('2d'); const gr = dc.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); dc.fillStyle = gr; dc.fillRect(0, 0, 32, 32);
    this.dust = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.025, map: new THREE.CanvasTexture(dot), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe0c0 }));
    s.add(this.dust);
    // 枪械展示
    this.gunHolder = new THREE.Group(); this.gunHolder.position.set(0, 1.25, 0); s.add(this.gunHolder);
    const gl = new THREE.SpotLight(0xffffff, 45, 6, 0.6, 0.5, 1.2); gl.position.set(0.6, 2.8, 1.6); gl.target = this.gunHolder; s.add(gl);
    const gl2 = new THREE.PointLight(0x9fc4ff, 4, 5, 1.5); gl2.position.set(-1, 1.6, 1.2); s.add(gl2);
    this.gunLight = gl; gl.visible = false; this.gunLight2 = gl2; gl2.visible = false;
    this.soldierAnim = { speed: 0, phase: 0, crouch: 0, pitch: -0.12, dead: false, recoil: 0 };
    this.setSoldier(this.game.profile.classes[this.selClass]);
  }
  setSoldier(cls) {
    const key = cls.primary + JSON.stringify(cls.patt) + cls.pcamo;
    if (this.soldierKey === key) return;
    this.soldierKey = key;
    if (this.soldier) this.scene3d.remove(this.soldier.root);
    const p = this.soldier = createSoldierModel('ally', cls.primary, cls.patt, cls.pcamo);
    p.root.position.set(0.95, 0, 0.2);
    p.root.rotation.y = Math.PI - 0.95;
    this.scene3d.add(p.root);
  }
  showGun(id, att, camo) {
    const key = id + JSON.stringify(att) + camo;
    if (this.gunKey === key) return;
    this.gunKey = key;
    if (this.gun) { this.gunHolder.remove(this.gun); this.gun.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    const info = buildGun(id, att, camo);
    const g = new THREE.Group(); g.add(info.group);
    const box = new THREE.Box3().setFromObject(info.group);
    const c = box.getCenter(new THREE.Vector3());
    info.group.position.sub(c);
    const size = box.getSize(new THREE.Vector3());
    const sc = 1.25 / Math.max(size.x, size.y, size.z);
    g.scale.setScalar(Math.min(2.2, sc));
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    this.gun = g; this.gunHolder.add(g);
  }
  setCam(kind) {
    this.camKind = kind;
    const T = this.camTarget;
    if (kind === 'gunsmith') { T.pos.set(0, 1.3, this.gsZoom || 1.45); T.look.set(0, 1.22, 0); }
    else if (kind === 'loadout') { T.pos.set(-1.1, 1.35, 3.5); T.look.set(-0.55, 1.1, 0); }
    else if (kind === 'lobby') { T.pos.set(-1.2, 1.2, 3.8); T.look.set(-0.3, 1.2, 0); }
    else { T.pos.set(-0.3, 1.45, 4.2); T.look.set(0.6, 1.15, 0); }
    const gs = kind === 'gunsmith';
    this.gunHolder.visible = gs; this.gunLight.visible = gs; this.gunLight2.visible = gs;
    if (this.soldier) this.soldier.root.visible = !gs;
    if (gs) { this.gunSpin = true; this.gunRotX = 0.05; }
  }
  update(dt) {
    const t = performance.now() * 0.001;
    const cam = this.camera3d, T = this.camTarget;
    cam.position.x = damp(cam.position.x, T.pos.x + Math.sin(t * 0.3) * 0.04, 4, dt);
    cam.position.y = damp(cam.position.y, T.pos.y + Math.sin(t * 0.4) * 0.02, 4, dt);
    cam.position.z = damp(cam.position.z, T.pos.z, 4, dt);
    this.camLook.x = damp(this.camLook.x, T.look.x, 4, dt); this.camLook.y = damp(this.camLook.y, T.look.y, 4, dt); this.camLook.z = damp(this.camLook.z, T.look.z, 4, dt);
    cam.lookAt(this.camLook);
    if (this.soldier && this.soldier.root.visible) {
      const a = this.soldierAnim;
      a.pitch = -0.1 + Math.sin(t * 1.3) * 0.015;
      animateSoldier(this.soldier, a, dt);
      this.soldier.torso.rotation.z = Math.sin(t * 0.9) * 0.015;
      this.soldier.hips.position.y = 0.95 + Math.sin(t * 2.6) * 0.004;
    }
    if (this.gunHolder.visible) {
      if (this.gunSpin) this.gunRotY += dt * 0.35;
      this.gunHolder.rotation.y = damp(this.gunHolder.rotation.y, this.gunRotY, 8, dt);
      this.gunHolder.rotation.x = damp(this.gunHolder.rotation.x, this.gunRotX, 8, dt);
      this.gunHolder.position.y = 1.25 + Math.sin(t * 1.2) * 0.01;
    }
    const p = this.dust.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * 0.03; if (y > 4) y = 0;
      p.setXYZ(i, p.getX(i) + Math.sin(t * 0.5 + i) * dt * 0.02, y, p.getZ(i));
    }
    p.needsUpdate = true;
    this.fireLight.intensity = 5 + Math.sin(t * 13) * 0.8 + Math.sin(t * 7.3) * 0.8;
  }
  onResize() {
    this.camera3d.aspect = window.innerWidth / window.innerHeight;
    this.camera3d.updateProjectionMatrix();
  }

  // ---------------- 工具 ----------------
  render(html, cls = 'dim', screen = '') {
    this.screen = screen;
    this.el.innerHTML = `<div class="screen ${cls}">${html}</div>`;
    return this.el.firstChild;
  }
  on(root, sel, fn) { root.querySelectorAll(sel).forEach((el, i) => el.addEventListener('click', e => fn(el, e, i))); }
  hide() { this.el.innerHTML = ''; this.screen = ''; this.overlayOpen = false; }
  level() {
    const xp = this.game.profile.xp || 0;
    const lv = Math.min(55, Math.floor(Math.sqrt(xp / 300)) + 1);
    const a = Math.pow(lv - 1, 2) * 300, b = Math.pow(lv, 2) * 300;
    return { lv, frac: lv >= 55 ? 1 : (xp - a) / (b - a), xp };
  }
  playerCard() {
    const L = this.level();
    return `<div class="player-card"><div class="lvl">${L.lv}</div><div><div style="font-weight:700;letter-spacing:2px">指挥官</div><div style="font-size:11px;color:#999">等级 ${L.lv} · ${L.xp} XP</div><div class="xpbar"><div style="width:${Math.round(L.frac * 100)}%"></div></div></div></div>`;
  }
  showLoadingOverlay(text) {
    this.render(`<div style="margin:auto;text-align:center"><div class="logo"><div class="l1">现代战线</div><div class="l2">MODERN FRONTLINE</div></div><div class="load-bar" style="width:420px;margin:0 auto"><div style="height:100%;width:100%;background:var(--acc);animation:ldpulse 1s infinite"></div></div><div style="margin-top:14px;color:#999;letter-spacing:3px;font-size:13px">${esc(text)}</div></div><style>@keyframes ldpulse{0%{opacity:.2}50%{opacity:1}100%{opacity:.2}}</style>`, 'solid', 'loading');
  }

  // ---------------- 主菜单 ----------------
  showMain() {
    this.setCam('main');
    this.setSoldier(this.game.profile.classes[this.game.profile.selClass || 0]);
    const r = this.render(`
      <div class="menu-left">
        <div class="menu-title">现代战线</div>
        <div class="menu-sub">MODERN FRONTLINE</div>
        <div class="mbtn" data-a="mp"><div class="ico">⚔</div><div><div class="mt">多人对战</div><div class="md">烬区攻防 · Dust II / Karkand 团队死斗（AI）</div></div></div>
        <div class="mbtn" data-a="loadout"><div class="ico">⚙</div><div><div class="mt">武器装备</div><div class="md">腾龙 / M870 / AWM / AT4</div></div></div>
        <div class="mbtn" data-a="settings"><div class="ico">☰</div><div><div class="mt">设置</div><div class="md">画面 · 操作 · 音频</div></div></div>
      </div>
      ${this.playerCard()}
      <div style="position:absolute;right:40px;bottom:30px;text-align:right;font-size:12px;color:#777;line-height:1.9">
        <div><span class="kbd">WASD</span>移动 <span class="kbd">Shift</span>冲刺 <span class="kbd">C</span>蹲/滑铲 <span class="kbd">空格</span>跳跃 <span class="kbd">R</span>换弹 <span class="kbd">1–4</span>切换武器</div>
        <div> <span class="kbd">Tab</span>记分板</div>
        <div style="color:#555;margin-top:6px">现代战线 v1.0 · 程序化实时渲染 · 本作为原创致敬作品</div>
      </div>`, 'dim', 'main');
    this.on(r, '[data-a]', el => {
      const a = el.dataset.a;
      if (a === 'mp') this.showLobby();
      else if (a === 'loadout') this.showLoadouts('main');
      else if (a === 'settings') this.showSettings('main');
    });
  }

  // ---------------- 多人大厅 ----------------
  showLobby() {
    this.setCam('lobby');
    const L = this.lobby, P = this.game.profile;
    const cls = P.classes[P.selClass || 0];
    const seg = (key, vals, labels) => `<div class="seg" data-k="${key}">${vals.map((v, i) => `<div data-v="${v}" class="${L[key] == v ? 'sel' : ''}">${labels ? labels[i] : v}</div>`).join('')}</div>`;
    const r = this.render(`
      <div class="lobby">
        <div class="hdr">多人对战<small>对战 AI · 本地对局</small></div>
        <div class="lobby-body">
          <div class="lobby-col">
            <div style="font-size:12px;color:#888;letter-spacing:3px">游戏模式</div>
            <div class="modes">${MP_MODES.map(m => `<div class="mode ${m.id === L.mode ? 'sel' : ''}" data-m="${m.id}"><b>${m.name}</b><span>${m.desc}</span></div>`).join('')}</div>
            <div style="font-size:12px;color:#888;letter-spacing:3px;margin-top:10px">地图</div>
            <div class="maps">${MP_MAPS.map(m => `<div class="mapc ${m.id === L.map ? 'sel' : ''}" data-map="${m.id}"><div class="mapart">${MAP_ART[m.id] || ''}</div><div class="mapinfo"><b>${m.name}</b><span>${m.style} — ${m.desc}</span></div></div>`).join('')}</div>
          </div>
          <div class="lobby-col" style="flex:1;max-width:460px">
            <div class="panel"><div class="opts">
              <div>AI 难度</div>${seg('diff', [0, 1, 2], DIFF_NAMES)}
              <div class="tm-only">队友数量</div><div class="tm-only">${seg('allies', [3, 5], ['3', '5'])}</div>
              <div>敌人数量</div>${seg('enemies', [4, 6, 8], ['4', '6', '8'])}
              <div>时间限制</div>${seg('time', [5, 10, 15], ['5 分钟', '10 分钟', '15 分钟'])}
              <div>胜利条件</div><div id="limitTxt" style="color:var(--acc)"></div>
            </div></div>
            <div class="panel">
              <div style="font-size:12px;color:#888;letter-spacing:3px;margin-bottom:8px">主角武器</div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div><div style="font-size:20px;font-weight:800">${esc(cls.name)}</div><div style="font-size:12px;color:#aaa;margin-top:4px">腾龙 · M870 · AWM · AT4</div></div>
                <button class="btn small ghost" data-a="loadout">查看</button>
              </div>
            </div>
            <div class="lobby-foot" style="margin-top:auto"><button class="btn ghost" data-a="back">返回</button><button class="btn" data-a="go">开始对局</button></div>
          </div>
        </div>
      </div>`, 'solid', 'lobby');
    const upd = () => {
      L.mode=L.map==='cracked'?'breakthrough':'tdm';
      r.querySelector('#limitTxt').textContent = L.mode==='breakthrough'?'攻占 A → B1/B2 → C1/C2；进攻方 100 增援，推进补充 40':'先达到 50 击杀，或时间结束时领先';
      r.querySelectorAll('.mode').forEach(d => {d.classList.toggle('sel', d.dataset.m === L.mode);d.style.display=d.dataset.m===L.mode?'':'none';});
      r.querySelectorAll('.mapc').forEach(d => d.classList.toggle('sel', d.dataset.map === L.map));
    };
    upd();
    this.on(r, '.mapc', el => { L.map = el.dataset.map; upd(); });
    r.querySelectorAll('.seg').forEach(sg => sg.querySelectorAll('div').forEach(d => d.addEventListener('click', () => { L[sg.dataset.k] = +d.dataset.v; sg.querySelectorAll('div').forEach(x => x.classList.toggle('sel', x === d)); })));
    this.on(r, '[data-a=back]', () => this.showMain());
    this.on(r, '[data-a=loadout]', () => this.showLoadouts('lobby'));
    this.on(r, '[data-a=go]', () => {
      const scoreLimit = 50;
      this.showLoadingOverlay('正在匹配对局…');
      setTimeout(() => this.game.startGame('mp', { mode: L.mode, map: L.map, diff: L.diff, allies: L.allies, enemies: L.enemies, scoreLimit, timeLimit: L.time }), 600);
    });
  }
  showLoadouts(from) {
    this.setCam('loadout');
    const r = this.render(`<div class="loadout"><div class="hdr">武器装备<small>腾龙 / M870 / AWM / AT4 · 数字 1–4 或滚轮切换</small></div><div class="pick-grid" style="margin-top:30px">${HERO_WEAPONS.map((id,i) => `<div class="panel"><div style="font-size:24px">${i+1} · ${WEAPON_ROLES[id]}</div><p>${WEAPONS[id].name}</p><p>弹匣 ${WEAPONS[id].mag} · 备用 ${WEAPONS[id].reserve}</p></div>`).join('')}</div><button class="btn ghost" data-a="back">返回</button></div>`, 'solid', 'arsenal');
    this.on(r, '[data-a=back]', () => from === 'lobby' ? this.showLobby() : this.showMain());
  }

  // ---------------- 设置 ----------------
  showSettings(from) {
    this.settingsFrom = from;
    const S = this.game.settings;
    const inGame = from === 'pause';
    if (!inGame) this.setCam('lobby');
    const rng = (k, label, min, max, step, fmt = v => v) => `<div class="set-row"><span>${label}</span><div style="display:flex;align-items:center;gap:12px"><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${S[k]}"><span class="val" data-v="${k}">${fmt(S[k])}</span></div></div>`;
    const sensitivity = (k, label, max) => `<div class="set-row"><span>${label}</span><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><button class="btn ghost small" aria-label="${label}降低20%" data-adjust="${k}" data-factor="0.8">−20%</button><input aria-label="${label}滑块" type="range" data-k="${k}" min="0.1" max="${max}" step="0.01" value="${S[k]}"><input aria-label="${label}数值" type="number" data-number="${k}" min="0.1" max="${max}" step="0.01" value="${S[k]}" style="width:84px;padding:8px;background:#171c20;color:#fff;border:1px solid #59636c"><button class="btn ghost small" aria-label="${label}提高25%" data-adjust="${k}" data-factor="1.25">+25%</button></div></div>`;
    const tog = (k, label) => `<div class="set-row"><span>${label}</span><div class="seg" data-t="${k}"><div data-v="1" class="${S[k] ? 'sel' : ''}">开</div><div data-v="0" class="${!S[k] ? 'sel' : ''}">关</div></div></div>`;
    const fmts = { recoilScale: v => Math.round(v * 100) + '%', spreadScale: v => Math.round(v * 100) + '%', sens: v => (+v).toFixed(2), fov: v => v, volume: v => Math.round(v * 100) };
    const r = this.render(`
      <div class="settings">
        <div class="hdr" style="margin-bottom:20px">设置<small>画面 · 操作 · 音频</small></div>
        <div class="set-row"><span>画面质量</span><div class="seg" data-q="1">${['low', 'medium', 'high'].map((q, i) => `<div data-v="${q}" class="${S.quality === q ? 'sel' : ''}">${['低', '中', '高'][i]}</div>`).join('')}</div></div>
        ${rng('fov', '垂直视野（越小目标越大）', 65, 100, 1, fmts.fov)}
        ${sensitivity('sens', '鼠标灵敏度', 20)}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">${[1, 2, 3, 5, 8, 12].map(v => `<button class="btn ghost small" data-sens="${v}">灵敏度 ${v}</button>`).join('')}<button class="btn ghost small" data-a="reset-sens">恢复默认灵敏度</button></div>
        <div style="font-size:12px;color:#aaa;line-height:1.8">滑动或直接输入，自动保存，无需刷新。灵敏度 0.1–20，统一控制普通视角和开镜；开镜后按瞄准镜倍率自动减速。</div>
        ${inGame ? '<button class="btn" data-a="test-sens" style="margin:12px 0">返回对局试手感</button>' : ''}
        ${rng('recoilScale', '后坐力强度', 0, 2, 0.05, fmts.recoilScale)}
        ${rng('spreadScale', '子弹随机散布', 0, 2, 0.05, fmts.spreadScale)}
        <div style="font-size:12px;color:#aaa;line-height:1.8">100% 为原版，0% 关闭对应效果。后坐力影响实际枪口方向，散布影响子弹偏离准星的程度。修改自动保存。</div>
        ${rng('volume', '主音量', 0, 1, 0.01, fmts.volume)}
        ${tog('invertY', '反转 Y 轴')}
        ${tog('voice', '语音播报')}
        ${tog('showFps', '显示帧数')}
        <div style="font-size:11px;color:#777;margin-top:8px">画面质量中的阴影与纹理分辨率将在下次加载地图 / 刷新页面后完全生效。</div>
        <div class="keys">
          <div><b>WASD</b>移动</div><div><b>鼠标左/右键</b>射击 / 瞄准</div>
          <div><b>Shift</b>战术冲刺</div><div><b>C / Ctrl</b>蹲伏 · 冲刺中滑铲</div>
          <div><b>Z</b>趴下 / 起身</div><div><b>空格</b>起身 / 跳跃</div><div><b>R</b>换弹</div>
          <div><b>1 / 2</b>步枪 / 霰弹枪</div><div><b>3 / 4</b>精确步枪 / 重炮</div>
          <div><b>滚轮</b>循环切换四把武器</div><div><b>Tab</b>记分板</div>
        </div>
        <div style="margin-top:24px;display:flex;gap:12px"><button class="btn" data-a="back">返回</button><button class="btn ghost small" data-a="resetp">重置存档</button></div>
      </div>`, inGame ? 'solid' : 'dim', 'settings');
    r.querySelectorAll('input[type=range]').forEach(inp => inp.addEventListener('input', () => {
      const k = inp.dataset.k; S[k] = +inp.value;
      const label = r.querySelector(`[data-v="${k}"]`);
      if (label) label.textContent = fmts[k](S[k]);
      const number = r.querySelector(`[data-number="${k}"]`);
      if (number) number.value = S[k];
      if (k === 'volume') this.game.audio.setVolume(S[k]);
      this.game.saveSettings();
    }));
    const setSensitivity = (k, value) => {
      const slider = r.querySelector(`input[data-k="${k}"]`);
      if (!Number.isFinite(value)) return;
      S[k] = Math.round(Math.max(+slider.min, Math.min(+slider.max, value)) * 100) / 100;
      slider.value = S[k];
      r.querySelector(`[data-number="${k}"]`).value = S[k];
      this.game.saveSettings();
    };
    r.querySelectorAll('[data-number]').forEach(inp => {
      inp.addEventListener('input', () => {
        if (inp.value !== '' && inp.validity.valid) setSensitivity(inp.dataset.number, inp.valueAsNumber);
      });
      inp.addEventListener('change', () => setSensitivity(inp.dataset.number, Number.isFinite(inp.valueAsNumber) ? inp.valueAsNumber : S[inp.dataset.number]));
    });
    this.on(r, '[data-adjust]', el => setSensitivity(el.dataset.adjust, S[el.dataset.adjust] * +el.dataset.factor));
    this.on(r, '[data-sens]', el => setSensitivity('sens', +el.dataset.sens));
    this.on(r, '[data-a=reset-sens]', () => setSensitivity('sens', 0.8));
    this.on(r, '[data-a=test-sens]', () => this.resume());
    r.querySelectorAll('.seg[data-t]').forEach(sg => sg.querySelectorAll('div').forEach(d => d.addEventListener('click', () => {
      const k = sg.dataset.t; S[k] = d.dataset.v === '1';
      sg.querySelectorAll('div').forEach(x => x.classList.toggle('sel', x === d));
      if (k === 'voice') this.game.audio.voice = S[k];
      if (k === 'showFps') { const f = document.getElementById('fps'); if (f) f.classList.toggle('hidden', !S[k]); }
      this.game.saveSettings();
    })));
    r.querySelectorAll('.seg[data-q] div').forEach(d => d.addEventListener('click', () => {
      S.quality = d.dataset.v; r.querySelectorAll('.seg[data-q] div').forEach(x => x.classList.toggle('sel', x === d));
      this.game.saveSettings(); this.game.applyQuality();
    }));
    this.on(r, '[data-a=back]', () => { if (inGame) this.showPause(); else this.showMain(); });
    this.on(r, '[data-a=resetp]', () => { if (confirm('确定要重置经验值吗？')) { localStorage.removeItem('mf_profile'); location.reload(); } });
  }

  // ---------------- 暂停 ----------------
  showPause() {
    this.pauseAt = performance.now();
    const g = this.game;
    const r = this.render(`
      <div class="pause">
        <div class="hdr" style="margin-bottom:30px">已暂停<small>多人对战</small></div>
        <div class="mbtn" data-a="resume"><div class="ico">▶</div><div class="mt">继续游戏</div></div>
        <div class="mbtn" data-a="restart"><div class="ico">⟲</div><div class="mt">重新开始对局</div></div>
        <div class="mbtn" data-a="sensitivity"><div class="ico">◎</div><div class="mt">灵敏度调试</div></div>
        <div class="mbtn" data-a="settings"><div class="ico">☰</div><div class="mt">设置</div></div>
        <div class="mbtn" data-a="quit"><div class="ico">✕</div><div class="mt">退出到主菜单</div></div>
        <div style="margin-top:20px;font-size:12px;color:#777">按 Esc 继续</div>
      </div>`, 'solid', 'pause');
    this.on(r, '[data-a=resume]', () => this.resume());
    this.on(r, '[data-a=restart]', () => { const cfg = g.mode.cfg; g.paused = false; g.startGame('mp', cfg); });
    this.on(r, '[data-a=sensitivity]', () => {
      this.showSettings('pause');
      const field = this.el.querySelector('[data-number="sens"]');
      field.focus(); field.select();
    });
    this.on(r, '[data-a=settings]', () => this.showSettings('pause'));
    this.on(r, '[data-a=quit]', () => g.exitToMenu());
  }
  resume() {
    const g = this.game;
    g.pause(false);
    setTimeout(() => { if (g.state === 'play' && !g.paused && document.pointerLockElement !== g.canvas) document.getElementById('clickToPlay').classList.remove('hidden'); }, 400);
  }

  // ---------------- 结算 ----------------
  showResults(res) {
    this.overlayOpen = true;
    const g = this.game;
    g.hud.showScoreboard(false);
    const L = this.level();
    const r = this.render(`
      <div class="results">
        <div class="big ${res.win === 'win' ? 'win' : res.win === 'lose' ? 'lose' : ''}">${esc(res.title)}</div>
        <div style="font-size:18px;color:#ccc;letter-spacing:4px">${esc(res.sub || '')}</div>
        <div class="res-stats">${res.stats.map(([k, v]) => `<div><b>${v}</b>${k}</div>`).join('')}</div>
        ${res.board ? `<div id="sbCopy" style="max-height:38vh;overflow-y:auto;text-align:left;margin-bottom:20px">${res.board}</div>` : ''}
        <div style="font-size:13px;color:#999;margin-bottom:20px">等级 ${L.lv} · <div style="display:inline-block;width:200px;height:4px;background:#333;vertical-align:middle"><div style="height:100%;width:${Math.round(L.frac * 100)}%;background:var(--acc)"></div></div></div>
        <div style="display:flex;gap:12px;justify-content:center"><button class="btn" data-a="again">再来一局</button><button class="btn ghost" data-a="menu">返回主菜单</button></div>
      </div>`, 'solid', 'results');
    this.on(r, '[data-a=again]', () => { this.overlayOpen = false; res.again(); });
    this.on(r, '[data-a=menu]', () => { this.overlayOpen = false; g.exitToMenu(); });
  }
}
