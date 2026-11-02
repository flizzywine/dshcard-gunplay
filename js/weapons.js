// 玩家武器系统 + 第一人称视图模型
import * as THREE from 'three';
import { computeStats, WEAPONS } from './data.js';
import { buildGun, buildArms } from './gunmodel.js';
import { mat } from './materials.js';
import { fireHitscan, Projectile } from './combat.js';
import { clamp, damp, lerp, rand, spreadDir, DEG } from './util.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();

export function tunePlayerWeapon(stats) {
  // Preserve the accepted recoil calibration without importing damage/ammo buffs.
  stats.ads = Math.max(.07, stats.ads * .42);
  stats.recoilV *= .22; stats.recoilH *= .22;
  return stats;
}

export class WeaponSystem {
  constructor(game, owner) {
    this.game = game; this.owner = owner;
    this.slots = [];
    this.cur = 0;
    this.state = 'idle'; this.stateT = 0; this.stateDur = 0;
    this.adsT = 0; this.cool = 0; this.triggerHeld = false; this.cycleT = 0;
    this.rp = 0; this.ry = 0; this.shotAge = 1; this.shotsInRow = 0;
    this.vmKick = 0; this.vmRot = 0; this.bobPhase = 0;
    this.sway = new THREE.Vector2(); this.flashT = 0;
    this.pivot = new THREE.Group();
    game.vmScene.add(this.pivot);
    this.holder = new THREE.Group();
    this.pivot.add(this.holder);
    this.sprintT = 0; this.equipT = 1;
    this.grenade = null; this.cookT = 0;
    this.reloadStage = 0;
    this.meleeHit = false;
  }
  disposeSlot(slot) {
    if (!slot || slot.disposed) return;
    slot.disposed = true;
    this.holder.remove(slot.group);
    // Gun/arm meshes own their geometries. Sprite geometry and mat()/textures
    // are engine-shared: do not dispose those with a single weapon slot.
    const geometries = new Set();
    slot.group.traverse(o => { if (o.isMesh && o.geometry) geometries.add(o.geometry); });
    for (const geometry of geometries) geometry.dispose();
    slot.flash?.material.dispose();
    if (slot.laserDot) {
      this.game.scene.remove(slot.laserDot);
      slot.laserDot.geometry.dispose(); slot.laserDot.material.dispose();
    }
  }
  dispose() {
    for (const slot of this.slots) this.disposeSlot(slot);
    this.slots = [];
    this.game.vmScene.remove(this.pivot);
  }

  makeSlot(cfg) {
    const stats = computeStats(cfg.id, cfg.att || {});
    // Player-only tuning: bot computeStats remains unchanged.
    if (this.owner.isPlayer) tunePlayerWeapon(stats);
    // Training optics change presentation, not the existing weapon balance.
    const modelAtt = { ...(cfg.att || {}) };
    if (this.owner.isPlayer && !modelAtt.optic) {
      if (cfg.id === 'm4') modelAtt.optic = 'reddot';
      if (cfg.id === 'm870') modelAtt.optic = 'holo';
    }
    const info = buildGun(cfg.id, modelAtt, cfg.camo || 'none', { noShadow: true });
    const sleeve = mat(this.game.playerSleeve || 'fab_ally');
    const arms = buildArms(info, sleeve);
    const g = new THREE.Group();
    g.add(info.group); g.add(arms);
    g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.game.effects.texFlash, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: new THREE.Color(3, 2.2, 1.4) }));
    flash.scale.setScalar(stats.suppressed ? 0.08 : 0.22); flash.visible = false;
    info.muzzle.add(flash);
    // 激光点
    let laserDot = null;
    if (stats.laser) {
      laserDot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 0.5, 0.5) }));
      this.game.scene.add(laserDot); laserDot.visible = false;
    }
    return { id: cfg.id, att: cfg.att || {}, camo: cfg.camo, stats, info, group: g, flash, mag: stats.mag, reserve: stats.reserve, laserDot };
  }
  setLoadout(list) {
    for (const s of this.slots) this.disposeSlot(s);
    this.slots = list.map(c => this.makeSlot(c));
    this.cur = 0;
    this.showCurrent();
    this.state = 'switch'; this.stateT = 0; this.stateDur = 0.22;
  }
  replaceSlot(i, cfg, mag, reserve) {
    const old = this.slots[i];
    if (old) this.disposeSlot(old);
    const s = this.makeSlot(cfg);
    if (mag !== undefined) { s.mag = mag; s.reserve = reserve; }
    this.slots[i] = s;
    this.cur = i; this.showCurrent();
    this.state = 'switch'; this.stateT = 0; this.stateDur = 0.22;
  }
  get w() { return this.slots[this.cur]; }
  showCurrent() {
    this.slots.forEach((s, i) => { if (i === this.cur) { if (!s.group.parent) this.holder.add(s.group); } else if (s.group.parent) this.holder.remove(s.group); if (s.laserDot) s.laserDot.visible = false; });
  }
  switchTo(i) {
    if (i === this.cur || !this.slots[i] || this.state === 'throw') return;
    this.cur = i; this.showCurrent();
    this.state = 'switch'; this.stateT = 0;
    this.stateDur = this.owner.hasPerk('amped') ? 0.3 : 0.55;
    this.game.audio.ui('equip');
    this.adsT = Math.min(this.adsT, 0.3);
  }
  canAct() { return this.state === 'idle'; }
  startReload() {
    const w = this.w;
    if (!w || this.state !== 'idle' || w.mag >= w.stats.mag || w.reserve <= 0) return;
    this.state = 'reload'; this.stateT = 0; this.reloadStage = 0;
    let t = w.stats.reload;
    if (this.owner.hasPerk('sleight')) t *= 0.65;
    if (w.stats.type === 'launcher' && this.owner.hasPerk('amped')) t *= 0.6;
    if (w.stats.shellReload) t = w.stats.reload * (this.owner.hasPerk('sleight') ? 0.65 : 1);
    this.stateDur = t;
  }
  refill(frac = 1) {
    for (const s of this.slots) s.reserve = Math.min(s.stats.reserve * 2, s.reserve + Math.ceil(s.stats.reserve * frac));
  }
  fullAmmo() { for (const s of this.slots) { s.mag = s.stats.mag; s.reserve = s.stats.reserve; } }

  resetRecoil() {
    this.rp = this.ry = this.vmKick = this.vmRot = this.shotsInRow = 0;
    this.shotAge = 1;
  }
  consumeRecoil(axis, delta) {
    // Counter-steering spends the current displacement. Otherwise a player
    // could offset the cap once and hold a perfectly stable endless spray.
    const offset = this[axis];
    if (offset * delta >= 0) return delta;
    const used = Math.sign(delta) * Math.min(Math.abs(delta), Math.abs(offset));
    this[axis] += used;
    return delta - used;
  }
  updateRecoil(dt) {
    // Exponential recovery is independent of render rate and pauses with play.
    // Keep input angles untouched: recovery must never restore an old mouse aim.
    const hold = Math.max(0.14, 90 / this.w.stats.rpm);
    const heldTime = Math.min(dt, Math.max(0, hold - this.shotAge));
    this.shotAge += dt;
    // Retain climb between automatic shots; recover quickly after the burst.
    // Split at the deadline so a frame crossing it has the same decay integral.
    this.rp *= Math.exp(-0.35 * heldTime - 10 * (dt - heldTime));
    this.ry = damp(this.ry, 0, 10, dt);
    this.vmKick = damp(this.vmKick, 0, 18, dt);
    this.vmRot = damp(this.vmRot, 0, 14, dt);
    if (this.shotAge > Math.max(0.18, 90 / this.w.stats.rpm)) this.shotsInRow = 0;
  }
  kickRecoil() {
    const st = this.w.stats, pl = this.owner;
    const adsMul = lerp(1, 0.75, this.adsT) * (pl.crouchT > 0.5 ? 0.85 : 1);
    // Short bursts stay manageable; sustained fire builds more force after
    // the first three shots, with a ceiling rather than runaway rotation.
    const burstForce = 1 + 0.5 * clamp((this.shotsInRow - 3) / 9, 0, 1);
    this.rp = Math.min(6.8 * DEG, this.rp + st.recoilV * 4.93 * DEG * adsMul * burstForce);
    const side = Math.sin(this.shotsInRow * 0.75) * 0.65 + Math.sin(this.shotsInRow * 2.4) * 0.35;
    this.ry = clamp(this.ry + side * st.recoilH * 2.55 * DEG * adsMul * burstForce, -0.935 * DEG, 0.935 * DEG);
    this.vmKick = Math.min(0.08, this.vmKick + 0.03 + st.recoilV * 0.025);
    this.vmRot = Math.min(0.16, this.vmRot + 0.05 + st.recoilV * 0.04);
  }

  update(dt, input) {
    const game = this.game, pl = this.owner, w = this.w;
    if (!w) return;
    const st = w.stats;
    this.updateRecoil(dt); this.owner.syncCamera();
    this.stateT += dt;
    this.cool -= dt; this.cycleT -= dt;
    const sprinting = pl.sprinting;
    // 状态机
    if (this.state === 'reload') {
      const k = this.stateT / this.stateDur;
      if (st.shellReload) {
        if (this.stateT >= this.stateDur) {
          w.mag++; w.reserve--; game.audio.reload('shell');
          if (w.mag < st.mag && w.reserve > 0 && !input.fire) { this.stateT = 0; }
          else { this.state = 'idle'; game.audio.reload('bolt'); }
        }
      } else {
        if (this.reloadStage === 0 && k > 0.2) { this.reloadStage = 1; game.audio.reload('out'); }
        if (this.reloadStage === 1 && k > 0.62) { this.reloadStage = 2; game.audio.reload('in'); }
        if (this.stateT >= this.stateDur) {
          const need = st.mag - w.mag, take = Math.min(need, w.reserve);
          w.mag += take; w.reserve -= take;
          this.state = 'idle';
          if (st.fire === 'bolt' || st.type === 'lmg') game.audio.reload('bolt');
        }
      }
      if (sprinting && !st.shellReload && false) this.state = 'idle';
    } else if (this.state === 'switch' || this.state === 'melee' || this.state === 'throw' || this.state === 'use') {
      if (this.state === 'melee' && !this.meleeHit && this.stateT > 0.12) { this.meleeHit = true; this.doMelee(); }
      if (this.state === 'throw' && this.grenade && this.stateT > 0.22) this.releaseGrenade();
      if (this.stateT >= this.stateDur) this.state = 'idle';
    }
    // 瞄准
    const wantAds = input.ads && !sprinting && !['switch', 'melee', 'throw', 'cook', 'use'].includes(this.state) && !(this.state === 'reload' && st.shellReload === false && false);
    this.adsT = clamp(this.adsT + (wantAds ? dt / st.ads : -dt / (st.ads * 0.8)), 0, 1);
    this.sprintT = damp(this.sprintT, sprinting ? 1 : 0, 10, dt);
    // 射击
    const semi = st.fire !== 'auto';
    const fireInput = input.fire && (!semi || !this.triggerHeld);
    if (input.fire && sprinting) pl.cancelSprint();
    if (fireInput && this.sprintT < 0.35 && this.state === 'idle' && this.cool <= 0 && this.cycleT <= 0 && !pl.sliding) {
      if (w.mag > 0) this.fire();
      else if (!this.triggerHeld) { game.audio.empty(); if (w.reserve > 0) this.startReload(); }
    } else if (fireInput && this.state === 'reload' && st.shellReload && w.mag > 0) {
      this.state = 'idle';
    }
    this.triggerHeld = input.fire;
    if (w.mag === 0 && this.state === 'idle' && w.reserve > 0 && this.cool < -0.15) this.startReload();
    this.flashT -= dt;
    w.flash.visible = this.flashT > 0;
    if (w.flash.visible) w.flash.material.rotation = Math.random() * 6;
    // 手雷烹饪
    if (this.cooking) {
      this.cookT += dt;
      if (this.grenade && this.grenade.type === 'frag' && this.cookT >= 3.0) { this.cooking = false; this.releaseGrenade(true); }
    }
    this.updateViewmodel(dt, input);
    // 激光
    if (w.laserDot) {
      const cam = game.camera;
      const d = cam.getWorldDirection(_v);
      const hit = game.world.raycast(cam.position, d, 60);
      w.laserDot.visible = !!hit && this.adsT < 0.5 && this.sprintT < 0.3;
      if (hit) w.laserDot.position.copy(hit.point).addScaledVector(hit.normal, 0.02);
    }
  }

  currentSpread() {
    const pl = this.owner, st = this.w.stats;
    const spd = Math.hypot(pl.vel.x, pl.vel.z);
    let hip = st.hip * (1 + spd / 6 * 0.6) * (pl.onGround ? 1 : 2.2) * (pl.crouchT > 0.5 ? 0.8 : 1);
    hip *= 1 + Math.min(this.shotsInRow, 10) * 0.03;
    const ads = st.adsSpread * (1 + spd / 6 * (st.type === 'sniper' ? 6 : 1.2));
    return lerp(hip, ads, this.adsT);
  }

  fire() {
    const game = this.game, pl = this.owner, w = this.w, st = w.stats;
    w.mag--;
    this.cool = 60 / st.rpm;
    if (st.fire === 'bolt' || st.fire === 'pump') { this.cycleT = 60 / st.rpm; }
    this.shotAge = 0;
    this.shotsInRow++;
    pl.stats.shots++;
    const cam = game.camera;
    const origin = cam.position.clone();
    const fwd = cam.getWorldDirection(new THREE.Vector3());
    const muzzleW = this.muzzleWorld(new THREE.Vector3());
    if (st.projectile === 'rocket') {
      const p = new Projectile(game, 'rocket', origin.clone(), fwd.clone().multiplyScalar(55), pl, 10);
      game.projectiles.push(p);
    } else {
      const spread = this.currentSpread() * DEG * 0.5;
      let anyHit = false, kill = false, head = false;
      for (let i = 0; i < st.pellets; i++) {
        // The same recoil-bearing sight ray drives damage, impact and tracer.
        // Target magnetism would silently erase the recoil the player must aim.
        const d = spreadDir(fwd, spread, new THREE.Vector3());
        const r = fireHitscan(game, pl, origin, d, st, st.name);
        if (r.ent) { anyHit = true; if (r.killed) kill = true; if (r.part === 'head') head = true; }
        if (i < 3 && (this.shotsInRow % 2 === 1 || st.pellets > 1 || st.fire !== 'auto')) game.effects.tracer(muzzleW.clone().addScaledVector(fwd, 0.5), r.point, [1.4, 1.0, 0.55]);
      }
      if (anyHit) { pl.stats.hits++; game.hud.hitmarker(kill, head); game.audio.hit(kill, head); }
    }
    // 特效
    this.flashT = 0.035;
    if (!st.suppressed) game.effects.flashLight(muzzleW, 0xffb060, st.flashHide ? 1.5 : 4, 0.05, 8);
    if (st.type !== 'launcher' && st.type !== 'shotgun') {
      const right = _v2.set(1, 0, 0).applyQuaternion(cam.quaternion);
      if (st.fire !== 'pump') game.effects.shell(muzzleW.clone().addScaledVector(fwd, -0.4).addScaledVector(right, 0.05), right);
    }
    game.audio.shot(st.sound, null, st.suppressed);
    if (st.fire === 'bolt') setTimeout(() => game.audio.reload('bolt'), 250);
    if (st.fire === 'pump') setTimeout(() => game.audio.reload('shell'), 200);
    game.makeNoise(pl.pos, st.suppressed ? 12 : 70, pl.team);
    if (!st.suppressed) pl.revealT = 1.5;
    // 后坐力
    this.kickRecoil();
  }
  muzzleWorld(out) {
    const w = this.w;
    this.pivot.updateMatrixWorld(true);
    w.info.muzzle.getWorldPosition(out);
    // 视图模型坐标系与世界同步（pivot = 相机变换）
    return out;
  }
  doMelee() {
    const game = this.game, pl = this.owner, cam = game.camera;
    const fwd = cam.getWorldDirection(new THREE.Vector3());
    let best = null, bd = 2.3;
    for (const e of game.entities) {
      if (!e.alive || e === pl || e.team === pl.team) continue;
      const c = e.chestPos(new THREE.Vector3());
      const d = c.distanceTo(cam.position);
      if (d > bd) continue;
      const dir = c.clone().sub(cam.position).normalize();
      if (dir.dot(fwd) < 0.6) continue;
      best = e; bd = d;
    }
    if (best) {
      const killed = best.takeDamage(135, { attacker: pl, dir: fwd, weapon: '近战', melee: true });
      game.hud.hitmarker(killed, false); game.audio.hit(killed);
      game.effects.blood(best.chestPos(new THREE.Vector3()), fwd, false);
    } else {
      const hit = game.world.raycast(cam.position, fwd, 1.8);
      if (hit) { game.effects.impact(hit.point, hit.normal, hit.box.mat || 'concrete'); game.audio.click(700, 0.08, 0.4); }
    }
  }
  melee() {
    if (this.state !== 'idle' && this.state !== 'reload') return;
    this.state = 'melee'; this.stateT = 0; this.stateDur = 0.55; this.meleeHit = false;
    this.game.audio.whoosh && this.game.audio.click(500, 0.12, 0.25);
  }
  // 投掷
  beginThrow(kind, id) {
    const pl = this.owner;
    const inv = kind === 'lethal' ? pl.lethal : pl.tactical;
    if (!inv || inv.count <= 0 || (this.state !== 'idle' && this.state !== 'reload')) return false;
    if (id === 'stim') {
      inv.count--; pl.hp = pl.maxHp; pl.dmgT = 99;
      this.state = 'use'; this.stateT = 0; this.stateDur = 0.5;
      this.game.audio.tone(900, 0.15, 0.15, 'triangle'); this.game.hud.popup('兴奋剂 生命已恢复', '#7cf');
      return false;
    }
    inv.count--;
    this.grenade = { type: id };
    this.cooking = true; this.cookT = 0;
    this.state = 'cook'; this.stateT = 0;
    this.game.audio.click(2000, 0.05, 0.3);
    return true;
  }
  endThrow() {
    if (this.state === 'cook' && this.grenade) {
      this.cooking = false;
      this.state = 'throw'; this.stateT = 0; this.stateDur = this.owner.hasPerk('amped') ? 0.4 : 0.6;
    }
  }
  releaseGrenade(inHand = false) {
    const g = this.grenade; if (!g) return;
    this.grenade = null;
    const game = this.game, pl = this.owner, cam = game.camera;
    const fwd = cam.getWorldDirection(new THREE.Vector3());
    const fuseBase = { frag: 3.0, semtex: 2.0, molotov: 99, flash: 1.4, smoke: 1.3 }[g.type];
    const fuse = g.type === 'frag' ? Math.max(0.05, fuseBase - this.cookT) : fuseBase;
    const pos = cam.position.clone().addScaledVector(fwd, 0.4).add(new THREE.Vector3(0, -0.1, 0));
    const vel = inHand ? new THREE.Vector3() : fwd.clone().multiplyScalar(17).add(new THREE.Vector3(0, 3.5, 0)).add(pl.vel.clone().multiplyScalar(0.5));
    game.projectiles.push(new Projectile(game, g.type, pos, vel, pl, fuse));
    if (inHand) { this.state = 'idle'; }
  }

  syncViewmodelCamera() {
    const game = this.game;
    const cam = game.camera;
    this.pivot.position.copy(cam.position);
    this.pivot.quaternion.copy(cam.quaternion);
    game.vmCamera.position.copy(cam.position);
    game.vmCamera.quaternion.copy(cam.quaternion);
  }
  updateViewmodel(dt, input) {
    const game = this.game, pl = this.owner, w = this.w, st = w.stats;
    this.syncViewmodelCamera();
    // 摆动
    this.sway.x = damp(this.sway.x, clamp(-input.mdx * 0.0006, -0.05, 0.05), 8, dt);
    this.sway.y = damp(this.sway.y, clamp(input.mdy * 0.0006, -0.05, 0.05), 8, dt);
    const spd = Math.hypot(pl.vel.x, pl.vel.z);
    if (pl.onGround) this.bobPhase += dt * spd * (pl.sprinting ? 1.5 : 1.9);
    const bobAmt = Math.min(1, spd / 5) * (1 - this.adsT * 0.9);
    const a = this.adsT, ae = a * a * (3 - 2 * a);
    const hip = st.type === 'pistol' ? new THREE.Vector3(0.12, -0.13, -0.3) : st.type === 'launcher' ? new THREE.Vector3(0.15, -0.16, -0.25) : new THREE.Vector3(0.15, -0.16, -0.3);
    const extra = w.info.eyeRelief ?? (st.type === 'pistol' ? 0.26 : st.type === 'launcher' ? 0.12 : w.info.optic === 'iron' ? 0.18 : 0.0);
    const ads = _v.set(-w.info.sight.x, -w.info.sight.y, -w.info.sight.z - extra);
    const pos = hip.clone().lerp(ads, ae);
    const bx = Math.sin(this.bobPhase) * 0.012 * bobAmt, by = -Math.abs(Math.cos(this.bobPhase)) * 0.012 * bobAmt;
    pos.x += bx + this.sway.x * (1 - ae * 0.8); pos.y += by + this.sway.y * (1 - ae * 0.8);
    pos.z += this.vmKick * (1 - ae * 0.5);
    // 呼吸
    const t = performance.now() * 0.001;
    pos.y += Math.sin(t * 1.6) * 0.002 * (1 - ae);
    let rx = this.vmRot * (1 - ae * 0.6), ry = 0, rz = bx * 2;
    // 冲刺姿势
    const s = this.sprintT;
    pos.x += -0.06 * s; pos.y += -0.05 * s; pos.z += 0.03 * s;
    rx += -0.25 * s; ry += 0.7 * s; rz += 0.35 * s;
    // 滑铲
    if (pl.sliding) { rz -= 0.3; }
    // 状态动画
    const k = this.stateDur ? clamp(this.stateT / this.stateDur, 0, 1) : 1;
    if (this.state === 'reload') {
      if (st.shellReload) { rz += 0.25; rx += 0.1 + Math.sin(k * Math.PI) * 0.08; pos.y -= 0.03; }
      else {
        const e = Math.sin(k * Math.PI);
        rz += e * 0.55; rx += e * 0.25; pos.y -= e * 0.05; pos.x -= e * 0.03;
        if (w.info.mag) {
          const m = w.info.mag;
          if (!m.userData.base) m.userData.base = m.position.clone();
          let off = 0;
          if (k > 0.2 && k < 0.62) off = Math.min(1, (k - 0.2) / 0.12);
          if (k >= 0.62 && k < 0.75) off = 1 - (k - 0.62) / 0.13;
          m.position.copy(m.userData.base).add(new THREE.Vector3(0, -0.25 * off, 0.05 * off));
          m.visible = !(k > 0.33 && k < 0.5);
        }
      }
    } else if (w.info.mag && w.info.mag.userData.base) { w.info.mag.position.copy(w.info.mag.userData.base); w.info.mag.visible = true; }
    if (this.state === 'switch') { const e = 1 - k; pos.y -= e * 0.3; rx -= e * 0.6; }
    if (this.state === 'melee') { const e = Math.sin(k * Math.PI); pos.z -= e * 0.15; pos.x -= e * 0.1; ry += e * 0.8; rz -= e * 0.4; }
    if (this.state === 'throw' || this.state === 'cook' || this.state === 'use') {
      const e = this.state === 'cook' ? 1 : Math.sin(k * Math.PI);
      pos.y -= e * 0.25; rx -= e * 0.5; pos.x += e * 0.05;
    }
    if (st.fire === 'bolt' && this.cycleT > 0) { const e = Math.sin((1 - this.cycleT / (60 / st.rpm)) * Math.PI); rz += e * 0.2 * (1 - ae * 0.5); pos.y -= e * 0.02; }
    if (st.fire === 'pump' && this.cycleT > 0) { const e = Math.sin((1 - this.cycleT / (60 / st.rpm)) * Math.PI); pos.z += e * 0.04; }
    this.holder.position.copy(pos);
    this.holder.rotation.set(rx, ry, rz);
    if (w.info.reticle && w.info.eyeRelief) {
      // Pivot gun animation around the sight axis. The dot must stay on the
      // camera's shot ray instead of drifting away with decorative weapon sway.
      const sight = w.info.sight.clone().applyEuler(this.holder.rotation);
      // Recoil changes eye relief along the shot axis without moving the dot
      // off target. Do not cancel the rearward kick when aligning the optic.
      const aligned = new THREE.Vector3(0, 0, -w.info.eyeRelief + this.vmKick * 0.5).sub(sight);
      this.holder.position.lerp(aligned, ae);
    }
    // 瞄具遮罩：高倍镜隐藏模型
    const scoped = (w.info.optic === 'sniper' || w.info.optic === 'acog' || w.info.optic === 'thermal') && this.adsT > 0.85;
    this.holder.visible = !scoped;
    game.scopeState = scoped ? w.info.optic : null;
    game.vmCamera.fov = lerp(52, st.type === 'pistol' ? 45 : 40, ae);
    game.vmCamera.updateProjectionMatrix();
  }
}
