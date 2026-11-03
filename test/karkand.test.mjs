import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Vector3 } from 'three';
import { initPhysics, PhysicsWorld } from '../js/physics.js';
import { LayeredNavigation } from '../js/layered-navigation.js';

await initPhysics();
const data = JSON.parse(await readFile(new URL('../assets/maps/karkand.json', import.meta.url)));
const nav = new LayeredNavigation(data.navigation), vec = a => new Vector3(...a);
const world = new PhysicsWorld({ meshes: [data.collision, { ...data.clips, surface: { ray: false } }].map(m => ({ ...m, vertices: new Float32Array(m.vertices), indices: new Uint32Array(m.indices) })) });
test.after(() => world.dispose());
test('Karkand is the downloaded full PVP geometry, with both teams and separated city / industrial districts', () => {
  assert.equal(data.spawns.A.length, 64); assert.equal(data.spawns.B.length, 64);
  assert.ok(data.stats.brushes > 4500); assert.ok(data.stats.displacements >= 200);
  assert.ok(data.stats.modelProxies > 300);
  assert.ok(vec(data.landmarks.push_a).distanceTo(vec(data.landmarks.push_cache)) > 180);
  assert.ok(vec(data.landmarks.industrial).distanceTo(vec(data.landmarks.strike_b)) > 300);
});
test('spatial nearest-node queries agree with exhaustive 3D floor selection', () => {
  const targets = [...Object.values(data.landmarks), data.spawns.A[0], data.spawns.B[0], [800, 80, -900]];
  for (const p of targets) {
    const score = n => (n[0] - p[0]) ** 2 + (n[1] - p[1]) ** 2 * 4 + (n[2] - p[2]) ** 2;
    const got = nav.nodes[nav.nearest(vec(p))];
    const best = nav.nodes.reduce((best, n) => Math.min(best, score(n)), Infinity);
    assert.ok(Math.abs(score(got) - best) < 1e-8);
  }
});
test('all 128 source spawn positions map to nearby safe floors', () => {
  const body = world.createCharacter({ x: 0, y: 100, z: 0 }, 0.5032, 1.955);
  try { for (const p of [...data.spawns.A, ...data.spawns.B]) {
    const safe = nav.point(nav.nearest(vec(p)));
    assert.ok(safe.distanceTo(vec(p)) < 1.5, `spawn moved too far ${p} -> ${safe.toArray()}`);
    const result = body.move(safe, { x: 0, y: -0.2, z: 0 }, 1.955);
    assert.ok(result.grounded, `missing spawn floor ${p}`);
  } } finally { body.dispose(); }
});
test('the authored bridge deck supports a continuous crossing above the canal', () => {
  let p = nav.point(nav.nearest(new Vector3(100, 33.53, -135.7376))), vy = 0;
  const body = world.createCharacter(p, 0.5032, 1.955);
  try {
    for (let i = 0; i < 900 && p.x < 150; i++) {
      vy -= 18 / 60;
      const result = body.move(p, { x: 4.5 / 60, y: vy / 60, z: 0 }, 1.955);
      p.copy(result.position); if (result.grounded) vy = 0;
      assert.ok(p.y > 32.8, 'crossing fell off the bridge deck');
    }
    assert.ok(p.x >= 150, `bridge blocked at ${p.toArray()}`);
  } finally { body.dispose(); }
});
for (const [from, to] of [['south_spawn', 'push_a'], ['push_a', 'strike_b'], ['push_a', 'push_c'], ['push_c', 'push_cache'], ['push_cache', 'bridge'], ['bridge', 'industrial'], ['push_a', 'industrial'], ['north_spawn', 'push_a']]) test(`bot-sized character traverses Karkand ${from} → ${to}`, () => {
  const landmarks = { ...data.landmarks, south_spawn: data.spawns.A[0], north_spawn: data.spawns.B[0] };
  const path = nav.findPath(vec(landmarks[from]), vec(landmarks[to])); assert.ok(path?.length);
  const body = world.createCharacter(path[0], 0.5032, 1.955); let position = path[0].clone(), vy = 0;
  try {
    for (const target of path) {
      let budget = 160;
      while (Math.hypot(target.x - position.x, target.z - position.z) > 0.16 && budget-- > 0) {
        const dx = target.x - position.x, dz = target.z - position.z, distance = Math.hypot(dx, dz), step = Math.min(distance, 4.5 / 60);
        vy -= 18 / 60;
        const move = body.move(position, { x: dx / distance * step, y: vy / 60, z: dz / distance * step }, 1.955);
        position.copy(move.position); if (move.grounded) vy = 0;
      }
      assert.ok(budget > 0, `stuck at ${position.toArray()} -> ${target.toArray()}`);
      assert.ok(Math.abs(position.y - target.y) < 0.65, `wrong floor ${position.y} / ${target.y}`);
    }
  } finally { body.dispose(); }
});
