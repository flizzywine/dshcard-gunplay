import assert from 'node:assert/strict';
import { WeaponSystem, tunePlayerWeapon } from '../dist/js/weapons.js';
import { computeStats } from '../dist/js/data.js';
const DEG = Math.PI / 180;
function make(id = 'm4') {
  const ws = Object.create(WeaponSystem.prototype);
  Object.assign(ws, { slots: [{ stats: tunePlayerWeapon(computeStats(id)) }], cur: 0,
    owner: { pitch: 0.2, yaw: -0.3, crouchT: 0 }, adsT: 1 });
  ws.resetRecoil();
  return ws;
}
function shot(ws) { ws.shotAge = 0; ws.shotsInRow++; ws.kickRecoil(); }
const ws = make();
for (let i = 0; i < 500; i++) shot(ws);
assert(ws.rp > 0 && ws.rp <= 4.5 * DEG, 'sustained fire must have a bounded upward displacement');
assert(Math.abs(ws.ry) <= 0.55 * DEG, 'horizontal displacement stays controllable');
assert(ws.vmKick <= 0.08 && ws.vmRot <= 0.16, 'gun cannot accumulate unbounded movement');
assert.deepEqual(ws.owner, { pitch: .2, yaw: -.3, crouchT: 0 }, 'fire preserves mouse aim');
const paused = ws.rp; ws.updateRecoil(0); assert.equal(ws.rp, paused, 'pause does not recover recoil');
ws.owner.pitch = -.4; ws.owner.yaw = .8;
for (let i = 0; i < 60; i++) ws.updateRecoil(1 / 60);
assert(ws.rp < .002 * DEG && Math.abs(ws.ry) < .001 * DEG, 'recoil recovers after release');
assert.equal(ws.owner.pitch, -.4); assert.equal(ws.owner.yaw, .8, 'recovery preserves new aim');
assert.equal(ws.shotsInRow, 0);
const results = [30, 60, 120].map(fps => {
  const r = make();
  // Identical timed bursts at all tested frame rates.
  for (let frame = 0; frame < fps; frame++) {
    r.updateRecoil(1 / fps);
    if (frame % (fps / 10) === 0) shot(r);
  }
  // Include the remaining interval to the same end time after the final shot.
  r.updateRecoil(1 / fps);
  return r.rp;
});
assert(Math.max(...results) - Math.min(...results) < 1e-12, 'recovery matches across frame rates');
const rifle = make(), shotgun = make('m870'), sniper = make('l115');
[rifle, shotgun, sniper].forEach(shot);
assert(shotgun.rp > rifle.rp && sniper.rp > rifle.rp, 'heavy weapons give stronger feedback');
assert(rifle.vmKick > 0.03, 'rifle has visible rearward motion');
ws.resetRecoil(); assert.equal(ws.rp + ws.ry + ws.vmKick + ws.vmRot, 0);
console.log('PASS recoil: bounded bursts, independent mouse aim, pause, recovery at 30/60/120 FPS, weapon feedback.');
