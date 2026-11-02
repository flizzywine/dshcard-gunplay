// Actual VoxelWorld + existing Player/Bot/Projectile/ballistics, without WebGL.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { VoxelWorld } from '../dist/js/voxel/world.js';
import { VoxelMatch } from '../dist/js/voxel/match.js';
import { Projectile, traceBullet, fireHitscan } from '../dist/js/combat.js';
import { mulberry32 } from '../dist/js/util.js';

Math.random = mulberry32(2401);
const noop = () => {};
const context = new Proxy({ measureText: s => ({ width: s.length * 8 }) }, { get: (t, k) => t[k] || noop });
const node = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop }, getContext: () => context });
globalThis.document = { createElement: node, getElementById: node, pointerLockElement: {}, exitPointerLock: noop };
let shots = 0;
const game = {
  scene: new THREE.Scene(), vmScene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), vmCamera: new THREE.PerspectiveCamera(),
  time: 0, entities: [], bots: [], noises: [], projectiles: [], hazards: [],
  settings: { sens: 1, adsSens: 1, fov: 78 }, input: { keys: {} },
  hud: new Proxy({}, { get: () => noop }), audio: new Proxy({ shot() { shots++; } }, { get: (t, k) => t[k] || noop }),
  effects: new Proxy({ fires: [], smokeBlocks: () => false, smoke: { emit: noop }, add: { emit: noop } }, { get: (t, k) => t[k] || noop }),
  addBot(b) { this.bots.push(b); this.entities.push(b); return b; },
  onKill(...args) { this.mode.onKill(...args); }, makeNoise: noop, alertGroup: noop, menu: { showResults: noop }, pause: noop,
};
const world = game.world = new VoxelWorld(game); world.build();
const mode = game.mode = new VoxelMatch(game, {}); mode.start();
const ally = game.bots.find(b => b.team === 'A'), enemy = game.bots.find(b => b.team === 'B');
const eye = game.player.eyePos(new THREE.Vector3());
const aim = enemy.chestPos(new THREE.Vector3()).sub(eye).normalize();
assert.equal(game.entities.length, 3);
assert.equal(game.player.ws.slots.length, 4);
assert.equal(world.findPath(ally.pos, mode.flags[0].pos), null, 'sealed wall must have no route');
assert.equal(traceBullet(game, game.player, eye, aim).ent, null, 'bullets must stop at voxels');
assert(world.lineBlocked(eye, enemy.chestPos(new THREE.Vector3())));
function tick(frames) {
  for (let i = 0; i < frames; i++) {
    game.time += .05; game.pathBudget = 3;
    for (const bot of game.bots) bot.update(.05);
  }
}
tick(40);
assert.equal(shots, 0, 'neither bot can shoot through the wall');
assert(ally.pos.z > 1, 'ally cannot cross before the wall is removed');
const revision = world.navVersion;
const rocket = new Projectile(game, 'rocket', eye, aim.clone().multiplyScalar(45), game.player, 5);
for (let i = 0; i < 30 && rocket.alive; i++) rocket.update(.05);
assert(!rocket.alive, 'actual rocket must strike and detonate');
assert(world.removedBlocks > 0);
assert.equal(world.navVersion, revision + 1, 'one atomic blast revision');
assert(world.findPath(ally.pos, mode.flags[0].pos)?.length, 'A* sees the new hole');
assert(!world.lineBlocked(eye, enemy.chestPos(new THREE.Vector3())), 'LOS sees the same hole');
assert.equal(traceBullet(game, game.player, eye, aim).ent, enemy);
const hit = fireHitscan(game, game.player, eye, aim, game.player.ws.slots[0].stats, '步枪');
assert.equal(hit.ent, enemy); assert(enemy.hp < enemy.maxHp, 'actual rifle damages enemy after breach');
const probe = new THREE.Vector3(.5, 0, .5);
world.collide(probe, new THREE.Vector3(), .35, 1.7);
assert(probe.distanceTo(new THREE.Vector3(.5, 0, .5)) < .01, 'physical hole is passable');
tick(240);
assert(shots > 0, 'real bots resume combat after breach');
assert(ally.pos.z < -.6, `ally crosses with real Bot.update, z=${ally.pos.z}`);
assert(world.walkable(...world.cellOf(ally.pos.x, ally.pos.z)));
console.log(`PASS voxel breach: actual rocket removed ${world.removedBlocks} blocks; collision/LOS/ballistics/A* agree; ally crossed and ${shots} bot shots fired.`);

// Placement immediately closes the route again; occupied cells cannot be built into.
for (let x = -19; x < 19; x++) for (let y = 0; y < 4; y++) world.terrain.set(x, y, 0, 'brick');
world.commit();
assert.equal(world.findPath(new THREE.Vector3(.5, 0, 8.5), mode.flags[0].pos), null);
assert(world.lineBlocked(eye, enemy.chestPos(new THREE.Vector3())));
const nearWall = new THREE.Vector3(.5, 1.5, 3.5), north = new THREE.Vector3(0, 0, -1);
assert(world.edit(nearWall, north, true), 'manual placement works');
assert(world.terrain.get(0, 1, 1));
assert(world.edit(nearWall, north, false), 'manual removal of placed block works');
assert(!world.terrain.get(0, 1, 1));
assert(world.edit(nearWall, north, false), 'manual removal of original block works');
assert(!world.terrain.get(0, 1, 0));
assert(!world.edit(game.player.pos.clone().setY(1.5), new THREE.Vector3(0, -1, 0), true), 'cannot place inside player');
const ground = world.terrain.get(5, -1, 5);
assert(!world.terrain.set(5, -1, 5, null)); assert.equal(world.terrain.get(5, -1, 5), ground);
// Exercise the real input -> Player -> weapon presentation path. A camera turn
// must not leave the gun render camera looking at the preceding frame.
game.player.update(1 / 60, { mdx: 100, mdy: 20 });
assert(game.camera.quaternion.angleTo(game.vmCamera.quaternion) < 1e-7, 'gun camera must turn with world camera in the same frame');
assert(game.camera.position.distanceTo(game.vmCamera.position) < 1e-7, 'gun camera must use current eye position');
assert(game.player.ws.pivot.quaternion.angleTo(game.camera.quaternion) < 1e-7, 'weapon pivot must follow current aim');
const rays = [], raycast = world.raycast;
world.raycast = function(origin, direction, ...args) { rays.push(direction.clone()); return raycast.call(this, origin, direction, ...args); };
game.player.ws.state = 'idle'; game.player.ws.cool = game.player.ws.cycleT = -1;
// Inspect the actual damaging ray rather than an aim-assist probe. Disable
// random spread only for this input-timing assertion.
const shotStats = game.player.ws.w.stats;
const originalSpread = { hip: shotStats.hip, adsSpread: shotStats.adsSpread };
shotStats.hip = shotStats.adsSpread = 0;
const expectedShotYaw = game.player.yaw + 50 * game.settings.sens * .0022;
game.player.update(1 / 60, { mdx: -50, mdy: 0, fire: true });
assert(rays.length > 0);
const shotYaw = Math.atan2(-rays[0].x, -rays[0].z);
assert(Math.abs(shotYaw - expectedShotYaw - (game.player.cameraShakeX || 0)) < 1e-7, 'turn-and-fire must trace this frame\'s aim, before recoil');
assert(game.camera.quaternion.angleTo(game.vmCamera.quaternion) < 1e-7, 'gun and world camera remain synchronized after recoil');
world.raycast = raycast;
Object.assign(shotStats, originalSpread);
// Toggle ADS must persist after RMB release and through LMB fire, while hold ADS
// remains available. Exercise actual weapon ADS transitions, not just a latch.
const aimStep = input => game.player.update(.1, { mdx: 0, mdy: 0, ...input });
game.settings.aimMode = 'toggle';
aimStep({ ads: true, adsPressed: true });
for (let i = 0; i < 5; i++) aimStep({});
assert.equal(game.player.ws.adsT, 1, 'toggle ADS persists after releasing RMB');
const shotsBeforeAds = game.player.stats.shots;
game.player.ws.cool = game.player.ws.cycleT = -1;
aimStep({ fire: true });
assert.equal(game.player.stats.shots, shotsBeforeAds + 1, 'LMB fires while aim is latched');
assert.equal(game.player.ws.adsT, 1);
aimStep({ ads: true, adsPressed: true });
for (let i = 0; i < 5; i++) aimStep({});
assert.equal(game.player.ws.adsT, 0, 'second RMB click exits ADS');
game.settings.aimMode = 'hold';
aimStep({ ads: true }); assert(game.player.ws.adsT > 0);
aimStep({}); aimStep({}); assert.equal(game.player.ws.adsT, 0, 'hold mode exits on release');
game.settings.aimMode = 'toggle'; aimStep({ adsPressed: true });
aimStep({ fwd: true, sprint: true }); assert(!game.player.aimLatched, 'sprint cancels toggle ADS');
aimStep({ adsPressed: true }); mode.editMode = true;
const buildInput = {}; mode.prepareInput(buildInput); aimStep(buildInput);
assert(!game.player.aimLatched, 'building cannot retain gun ADS');
mode.editMode = false; aimStep({ adsPressed: true });
game.player.respawn(new THREE.Vector3(.5, 0, 12.5), 0);
assert(!game.player.aimLatched); assert.equal(game.player.ws.adsT, 0, 'respawn clears toggle ADS');
console.log('PASS aim modes: RMB toggle survives release/LMB fire, second click exits; hold mode, sprint, building and respawn reset correctly.');
mode.dispose(); game.player.ws.dispose(); for (const b of game.bots) b.dispose(); world.dispose();
assert.equal(world.terrain.blocks.size, 0); assert.equal(world.terrain.chunks.size, 0);
console.log('PASS voxel edits: rebuilt wall blocks navigation and bullets; remove/place update occupancy; protected foundation and actor-overlap guard; resources disposed.');
