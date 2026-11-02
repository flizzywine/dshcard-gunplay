import assert from 'node:assert/strict';
import { WeaponSystem, tunePlayerWeapon } from '../js/weapons.js';
import { computeStats } from '../js/data.js';
for (const id of ['m4', 'm870', 'l115']) {
  const ws = Object.create(WeaponSystem.prototype);
  Object.assign(ws, { slots: [{ stats: tunePlayerWeapon(computeStats(id)) }], cur: 0,
    owner: { pitch: .2, yaw: -.3, crouchT: 0, vel: { x: 4, z: 0 }, onGround: true }, adsT: 1 });
  ws.resetRecoil();
  for (let i = 0; i < 100; i++) { ws.shotsInRow++; ws.kickRecoil(); ws.updateRecoil(1 / 60); }
  assert.equal(ws.rp, 0); assert.equal(ws.ry, 0);
  assert.equal(ws.vmKick, 0); assert.equal(ws.vmRot, 0);
  assert.equal(ws.owner.pitch, .2); assert.equal(ws.owner.yaw, -.3);
  assert.equal(ws.consumeRecoil('rp', -.02), -.02, 'mouse input is not spent on recoil');
  if (id === 'm870') assert(ws.currentSpread() > 0, 'shotgun retains pellet spread');
  else assert.equal(ws.currentSpread(), 0, 'fully aimed single projectile stays precise even while moving');
  ws.adsT = 0; assert(ws.currentSpread() > 0, 'hip fire retains spread');
}
console.log('PASS disabled camera/model recoil, direct mouse input and precise ADS; hip/shotgun spread preserved.');
