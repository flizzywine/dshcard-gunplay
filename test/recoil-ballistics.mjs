import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player } from '../js/player.js';
import { computeStats } from '../js/data.js';
import { tunePlayerWeapon } from '../js/weapons.js';
const noop = () => {};
function fixture() {
  const impacts = [];
  const g = { scene: new THREE.Scene(), vmScene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(), vmCamera: new THREE.PerspectiveCamera(),
    settings: { fov: 78 }, entities: [], audio: new Proxy({}, { get: () => noop }),
    hud: { hitmarker: noop }, makeNoise: noop,
    effects: new Proxy({ impact: p => impacts.push(p.clone()), smokeBlocks: () => false }, { get: (t, k) => t[k] || noop }),
    world: { lineBlocked: () => false, raycast(o, d) {
      const t = (-20 - o.z) / d.z;
      return t > 0 ? { t, normal: new THREE.Vector3(0, 0, 1), box: { mat: 'concrete' } } : null;
    } } };
  const p = g.player = new Player(g, { pos: new THREE.Vector3() });
  const w = p.ws, stats = tunePlayerWeapon(computeStats('m4'));
  // Remove random spread so this test measures recoil alone.
  stats.adsSpread = stats.hip = 0;
  w.slots = [{ stats, mag: 200, reserve: 999, flash: { visible: false, material: {} } }];
  w.adsT = 1; w.state = 'idle'; w.updateViewmodel = noop;
  w.muzzleWorld = out => out.copy(g.camera.position);
  p.updateCamera(0);
  return { g, p, w, impacts };
}
const burst = fixture();
for (let i = 0; i < 60; i++) burst.w.update(.02, { fire: true, ads: true });
assert(burst.impacts.length >= 10, 'exercise actual automatic fire');
const climb = burst.impacts.at(-1).y - burst.impacts[0].y;
assert.equal(burst.p.pitch, 0, 'mouse baseline stays independent');
for (let i = 0; i < 60; i++) burst.w.update(.02, { ads: true });
burst.w.update(.02, { fire: true, ads: true });
assert(Math.abs(burst.impacts.at(-1).y - burst.impacts[0].y) < .005, 'new burst returns to original aim');

const aimed = fixture(); let hits = 0;
const chest = new THREE.Vector3(.3, 1.62, -19);
aimed.g.entities.push({ team: 'B', alive: true,
  chestPos: out => out.copy(chest),
  hitTest(o, d, max) {
    const t = (chest.z - o.z) / d.z;
    return t > 0 && t < max && o.clone().addScaledVector(d, t).distanceTo(chest) < .02 ? { t, part: 'body' } : null;
  }, takeDamage() { hits++; return false; } });
aimed.w.update(.02, { fire: true, ads: true });
assert.equal(hits, 0, 'a nearby enemy must not pull an off-target shot away from the sight ray');
assert.equal(aimed.impacts.length, 1, 'off-target shot reaches the wall');
assert(Math.abs(aimed.impacts[0].x) < 1e-8);
assert(climb > 2.2 && climb < 2.5, `20m wall burst must visibly climb but remain controllable; got ${climb}m`);
console.log(`PASS actual recoil ballistics: burst climbs ${climb.toFixed(3)}m at 20m, recovery, no bullet magnetism.`);
