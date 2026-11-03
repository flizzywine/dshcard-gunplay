import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Vector3 } from 'three';
import { initPhysics, PhysicsWorld } from '../js/physics.js';
import { LayeredNavigation } from '../js/layered-navigation.js';
import { parseVmf, children, field, brushFaces, triangulateFace } from '../scripts/lib/vmf.mjs';

await initPhysics();
const data = JSON.parse(await readFile(new URL('../assets/maps/dust2.json', import.meta.url)));
const nav = new LayeredNavigation(data.navigation);
const meshes = [data.collision, { ...data.clips, surface: { ray: false } }].map(m => ({ ...m, vertices: new Float32Array(m.vertices), indices: new Uint32Array(m.indices) }));
const vec = a => new Vector3(...a);
const world = new PhysicsWorld({ meshes });
test.after(() => world.dispose());

test('VMF repeated blocks survive parsing and malformed input fails', () => {
  const result = parseVmf('entity { "classname" "a" } entity { "classname" "b" }');
  assert.deepEqual(children(result, 'entity').map(e => field(e, 'classname')), ['a', 'b']);
  assert.throws(() => parseVmf('world { "id" "1"'));
});
test('VMF convex brush reconstructs the original planes rather than its bounding box', () => {
  const planes = ['(0 0 0) (0 1 0) (1 0 0)', '(0 0 1) (1 0 2) (0 1 1)', '(0 0 0) (1 0 0) (0 0 1)', '(0 1 0) (0 1 1) (1 1 0)', '(0 0 0) (0 0 1) (0 1 0)', '(1 0 0) (1 1 0) (1 0 1)'];
  const [solid] = parseVmf('solid {' + planes.map(p => `side { "plane" "${p}" }`).join('') + '}');
  const faces = brushFaces(solid); assert.equal(faces.length, 6);
  assert.ok(faces.every(f => f.points.length === 4));
  const slope = faces.find(f => f.normal[0] < -0.5 && f.normal[2] > 0.5);
  assert.ok(slope); assert.ok(slope.points.every(p => Math.abs(p[2] - p[0] - 1) < 1e-6));
});
test('displacement rows start at the authored corner and preserve asymmetric relief', () => {
  const [disp] = parseVmf('dispinfo { "power" "1" "startposition" "[0 0 0]" normals { "row0" "0 0 1 0 0 1 0 0 1" } distances { "row0" "0 1 0" } }');
  const tris = triangulateFace({ points: [[0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0]], displacement: disp });
  assert.equal(tris.length, 8);
  assert.ok(tris.flat().some(p => p[0] === 1 && p[1] === 0 && p[2] === 1));
  assert.ok(tris.flat().every(p => p[2] === 0 || p[1] === 0));
});
test('player-clip triangles block movement while bullets and thrown props pass through', () => {
  const clipWorld = new PhysicsWorld({ meshes: [{ vertices: new Float32Array([0, 0, -5, 0, 5, -5, 0, 5, 5, 0, 0, 5]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]), surface: { ray: false } }] });
  const body = clipWorld.createCharacter({ x: -2, y: 1, z: 0 });
  try {
    assert.equal(clipWorld.raycast({ x: -2, y: 2, z: 0 }, { x: 1, y: 0, z: 0 }, 4), null);
    const move = body.move({ x: -2, y: 1, z: 0 }, { x: 4, y: 0, z: 0 }); assert.ok(move.position.x < -0.34);
    const thrown = clipWorld.createProjectile({ x: -2, y: 3, z: 2 }, { x: 20, y: 0, z: 0 });
    for (let i = 0; i < 20; i++) clipWorld.step(1 / 60);
    assert.ok(thrown.snapshot().position.x > 2, 'player clip caught a throwable'); thrown.dispose();
  } finally { body.dispose(); clipWorld.dispose(); }
});
test('complete Source Dust II has both original 20-spawn teams, terrain and connected layered navigation', () => {
  assert.equal(data.spawns.A.length, 20); assert.equal(data.spawns.B.length, 20);
  assert.ok(data.stats.brushes > 2000); assert.ok(data.stats.displacements > 50);
  assert.ok(nav.nodes.length > 7000);
  const cells = new Map(); let overlaps = 0;
  for (const n of nav.nodes) { const key = n[0] + ',' + n[2]; if (cells.has(key) && Math.abs(cells.get(key) - n[1]) > 2) overlaps++; cells.set(key, n[1]); }
  assert.ok(overlaps > 5, 'upper and lower floors must coexist');
});
test('all original spawn locations settle on solid floors with player clearance', () => {
  const body = world.createCharacter({ x: 0, y: 80, z: 0 }, 0.35, 1.8);
  try { for (const p of [...data.spawns.A, ...data.spawns.B]) {
    const point = vec(p), hit = world.raycast(point, { x: 0, y: -1, z: 0 }, 4);
    assert.ok(hit, `missing ground ${p}`); point.y = hit.point.y + 0.1;
    assert.ok(body.canFit(point, 1.8), `spawn obstructed ${p}`);
    const nearest = nav.point(nav.nearest(point)); assert.ok(nearest.distanceTo(point) < 1.5);
  } } finally { body.dispose(); }
});
for (const [from, to] of [['T', 'A'], ['T', 'B'], ['T', 'long'], ['T', 'short'], ['CT', 'A'], ['CT', 'B'], ['tunnels', 'mid'], ['long', 'B']]) test(`bot-sized capsule physically walks Dust II ${from} → ${to}`, () => {
  const landmarks = { ...data.landmarks, T: data.spawns.A[0], CT: data.spawns.B[0] };
  const path = nav.findPath(vec(landmarks[from]), vec(landmarks[to])); assert.ok(path?.length);
  const body = world.createCharacter(path[0], 0.5032, 1.955);
  let position = path[0].clone(), vy = 0;
  try {
    for (const target of path) {
      let budget = 140;
      while (Math.hypot(target.x - position.x, target.z - position.z) > 0.16 && budget-- > 0) {
        const dx = target.x - position.x, dz = target.z - position.z, length = Math.hypot(dx, dz), step = Math.min(length, 4.5 / 60);
        vy -= 18 / 60;
        const move = body.move(position, { x: dx / length * step, y: vy / 60, z: dz / length * step }, 1.955);
        position.copy(move.position); if (move.grounded) vy = 0;
      }
      assert.ok(budget > 0, `stuck ${position.toArray()} -> ${target.toArray()}`);
      assert.ok(Math.abs(position.y - target.y) < 0.65, 'wrong floor');
    }
  } finally { body.dispose(); }
});
