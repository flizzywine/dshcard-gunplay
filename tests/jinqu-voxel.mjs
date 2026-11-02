import assert from 'node:assert/strict';
import * as THREE from 'three';
import { JinquVoxelWorld, JinquVoxelMatch } from '../dist/js/voxel/jinqu.js';
import { MAPS } from '../dist/js/maps.js';
import { Projectile } from '../dist/js/combat.js';
const noop = () => {};
const context = new Proxy({ measureText: s => ({ width: s.length * 8 }) }, { get: (t, k) => t[k] || noop });
const node = () => ({ style: {}, classList: { add: noop, remove: noop }, getContext: () => context });
globalThis.document = { createElement: node, getElementById: node, pointerLockElement: null };
const game = { scene: new THREE.Scene(), vmScene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), vmCamera: new THREE.PerspectiveCamera(),
  time: 0, entities: [], bots: [], projectiles: [], hazards: [], noises: [], settings: { quality: 'low', fov: 78 },
  hud: new Proxy({}, { get: () => noop }), audio: new Proxy({}, { get: () => noop }),
  effects: new Proxy({ fires: [], smoke: { emit: noop }, add: { emit: noop }, smokeBlocks: () => false }, { get: (t, k) => t[k] || noop }),
  addBot(b) { this.bots.push(b); this.entities.push(b); },
  onKill(...args) { this.mode.onKill(...args); }, makeNoise: noop, alertGroup: noop, menu: { showResults: noop }, pause: noop,
};
const world = game.world = new JinquVoxelWorld(game); world.build();
assert.equal(world.def.sectors, MAPS.jinqu.sectors, 'districts and coordinates come from the existing project map');
assert.equal(world.breachSites.length, 21);
assert(world.terrain.blocks.size < 300, 'only selected breach pieces are voxelized, not the entire city');
let paths = 0;
for (const sector of world.def.sectors) for (const objective of sector.objectives) {
  assert(world.walkable(...world.cellOf(objective.pos.x, objective.pos.z)), `${objective.id} is on walkable ground`);
  for (const spawn of [...sector.attackSpawns, ...sector.defendSpawns]) {
    assert(world.walkable(...world.cellOf(spawn.x, spawn.z)), 'spawn remains clear');
    const path = world.findPath(spawn, objective.pos);
    assert(path?.length, `unreachable ${objective.id} from ${spawn.x},${spawn.z}`);
    let previous = spawn.clone();
    for (const next of path) {
      const steps = Math.max(1, Math.ceil(previous.distanceTo(next) / .3));
      for (let i = 1; i <= steps; i++) {
        const point = previous.clone().lerp(next, i / steps), checked = point.clone();
        world.collide(checked, new THREE.Vector3(), .35, 1.7);
        assert(checked.distanceTo(point) < .08, 'navigation follows physical openings');
      }
      previous = next;
    }
    paths++;
  }
}
for (const point of world.points.routeChecks) {
  assert(world.findPath(new THREE.Vector3(-92, 0, 25), point)?.length, `side route ${point.x},${point.z}`); paths++;
}
const a = new THREE.Vector3(80, 1.5, -39), b = new THREE.Vector3(85, 1.5, -39);
assert(world.lineBlocked(a, b), 'warehouse side panel blocks bullets before demolition');
const fixed = world.fixedBoxes.slice(), revision = world.navVersion;
const mode = game.mode = new JinquVoxelMatch(game, {}); mode.start();
assert.equal(game.bots.filter(b => b.team === 'A').length, 3);
assert.equal(game.bots.filter(b => b.team === 'B').length, 6);
assert.equal(game.player.ws.slots.length, 4);
const direction = b.clone().sub(a).normalize();
const rocket = new Projectile(game, 'rocket', a, direction.multiplyScalar(45), game.player, 5);
for (let i = 0; i < 20 && rocket.alive; i++) rocket.update(.05);
assert(!rocket.alive && world.removedBlocks > 0);
assert(!world.lineBlocked(a, b), 'actual rocket opens the warehouse wall');
assert(world.findPath(a, b)?.length);
assert.equal(world.navVersion, revision + 1);
assert.deepEqual(world.fixedBoxes, fixed, 'demolition never replaces or deletes the fixed city');
assert(fixed.every(box => world.boxes.includes(box)), 'fixed collision survives every edit');
// Fixed floor cannot be dug out.
assert(!world.edit(new THREE.Vector3(-100, 1, 0), new THREE.Vector3(0, -1, 0), false));
// Roof approaches retain their original sub-metre treads instead of 1m steps.
let height = 0; for (let z = 42.2; z <= 56; z += .2) height = world.groundHeight(-68, z, height, .35);
assert(height >= 3);
const count = world.terrain.blocks.size;
for (const entity of game.entities) if (entity !== game.player) entity.alive = false;
for (let i = 0; i < 5 && !mode.over; i++) {
  game.player.pos.copy(mode.flags.find(f => !f.captured).pos);
  mode.updateCaptures(11);
}
assert.equal(mode.capturedCount, 5, 'all five actual map objectives can be captured');
assert.equal(mode.sectorIndex, 2); assert(mode.over, 'full map reaches victory');
mode.dispose(); game.player.ws.dispose(); for (const bot of game.bots) bot.dispose(); world.dispose();
assert.equal(world.terrain.blocks.size, 0);
console.log(`PASS Jinqu hybrid: ${paths} physical spawn/goal/flank routes; 21 voxel breach sites / ${count} remaining blocks; fixed buildings, stairs, actual rocket breach, 3 allies + 6 enemies, cleanup.`);
