import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player } from '../dist/js/player.js';
import { initTextures } from '../dist/js/materials.js';
import { setTextureSize } from '../dist/js/textures.js';

const noop = () => {};
const context = new Proxy({ createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) }, { get: (t, k) => t[k] || noop });
globalThis.document = { createElement: () => ({ getContext: () => context }) };
globalThis.ImageData = class { constructor(data, width, height) { Object.assign(this, { data, width, height }); } };
setTextureSize(16); await initTextures();
const game = { scene: new THREE.Scene(), vmScene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(78, 16 / 9, .05, 200), vmCamera: new THREE.PerspectiveCamera(52, 16 / 9, .01, 10),
  settings: { fov: 78 }, effects: { texFlash: new THREE.Texture() }, audio: { ui: noop, setListener: noop } };
const p = game.player = new Player(game, { pos: new THREE.Vector3() });
p.equip({ weapons: ['m4', 'm870', 'l115', 'rpg'].map(id => ({ id, att: {} })) });
const ws = p.ws;
assert.equal(ws.slots[0].info.optic, 'reddot', 'default rifle needs an actual optic');
assert.equal(ws.slots[1].info.optic, 'holo', 'default shotgun needs a visible sight');
assert.equal(ws.slots[3].info.optic, 'ladder', 'launcher needs an open aiming frame');
assert.equal(ws.slots[0].stats.zoom, 1.2, 'visual optics preserve rifle balance');
for (const index of [0, 1, 3]) {
  ws.switchTo(index); ws.state = 'idle'; ws.adsT = 1;
  // Idle and a rapid mouse movement must both keep the reticle on the shot axis.
  for (const movement of [0, 180, -180]) {
    if (movement === -180) { ws.shotsInRow++; ws.kickRecoil(); }
    p.updateCamera(0);
    ws.updateViewmodel(1 / 60, { mdx: movement, mdy: -movement });
    p.syncCamera(); game.vmScene.updateMatrixWorld(true); game.vmCamera.updateMatrixWorld(true);
    const optic = ws.w.info;
    assert(optic.reticle && ws.holder.visible);
    const position = optic.reticle.getWorldPosition(new THREE.Vector3());
    const projected = position.clone().project(game.vmCamera);
    if (movement === -180) {
      const local = position.clone().applyMatrix4(game.vmCamera.matrixWorldInverse);
      assert(local.z > -optic.eyeRelief + .001, 'ADS must preserve visible rearward recoil');
    }
    assert(Math.abs(projected.x) < 1e-6 && Math.abs(projected.y) < 1e-6, 'reticle must project to center even with gun sway');
    assert(projected.z > -1 && projected.z < 1, 'reticle cannot be clipped behind the near plane');
    const opaque = [];
    ws.w.group.traverse(o => { if (o.isMesh && !o.material.transparent) opaque.push(o); });
    const ray = new THREE.Raycaster(game.vmCamera.position, game.vmCamera.getWorldDirection(new THREE.Vector3()), .01, .6);
    assert.equal(ray.intersectObjects(opaque, false).length, 0, 'opaque optic housing or gun body cannot seal the center of the lens');
  }
}
ws.switchTo(2); ws.state = 'idle'; ws.adsT = 1; ws.updateViewmodel(0, { mdx: 0, mdy: 0 });
assert.equal(game.scopeState, 'sniper'); assert.equal(ws.holder.visible, false);
ws.adsT = 0; ws.updateViewmodel(0, { mdx: 0, mdy: 0 });
assert.equal(game.scopeState, null); assert(ws.holder.visible);
ws.dispose();
console.log('PASS optics: default red-dot/holo/launcher sight; centered visible reticles under sway; open lens apertures; sniper scope/hipfire transition.');
