import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Vector3 } from 'three';
import { readGraybox, readGrayboxCollision } from '../js/graybox-geometry.js';
import { initPhysics, PhysicsWorld } from '../js/physics.js';
import { LayeredNavigation } from '../js/layered-navigation.js';

const file = name => new URL('../assets/maps/' + name, import.meta.url);
const arrayBuffer = bytes => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const data = JSON.parse(fs.readFileSync(file('cracked.json'))), nav = new LayeredNavigation(data.navigation);
const meshes = readGraybox(arrayBuffer(fs.readFileSync(file('cracked.glb'))));
await initPhysics();
const world = new PhysicsWorld({ meshes: [readGrayboxCollision(arrayBuffer(fs.readFileSync(file('cracked-collision.bin'))))] });
test.after(() => world.dispose());
const vec = p => new Vector3(...p);

test('Cracked includes the authored A water tank, intact A house and C1 warehouse roof', () => {
  const tank = meshes.find(m => m.name === 'SM_M_Residential_Storage_WaterTank_03');
  assert.ok(tank?.matrices.some(m => Math.hypot(m[12] + 157.2546, m[14] + 35.4241) < 0.05));
  for (const part of ['Base', '1', '2', '3', '4', '5', '6']) assert.ok(meshes.find(m => m.name === 'SM_M_Building_Village_01_Cut' + part)?.matrices.some(m => Math.hypot(m[12] + 149.7316, m[14] + 43.2277) < 0.05));
  const c1 = data.landmarks.c1; let roofs = 0;
  for (const dz of [-5, 0, 5]) for (const dx of [-5, 0, 5]) {
    const hit = world.raycast({ x: c1[0] + dx, y: 40, z: c1[2] + dz }, { x: 0, y: -1, z: 0 }, 80);
    if (hit && hit.point.y > -4 && hit.point.y < 15) roofs++;
  }
  assert.ok(roofs >= 5, `C1 roof missing from gameplay collision: ${roofs}/9`);
  const hit = world.raycast({ x: c1[0], y: -4, z: c1[2] }, { x: 0, y: -1, z: 0 }, 30);
  const body = world.createCharacter({ x: c1[0], y: hit.point.y + 0.1, z: c1[2] }, 0.5032, 1.955);
  try { assert.ok(body.move({ x: c1[0], y: hit.point.y + 0.1, z: c1[2] }, { x: 0, y: -0.3, z: 0 }, 1.955).grounded, 'C1 authored floor must be recognised as ground, not only stop penetration'); }
  finally { body.dispose(); }
});

test('both teams deploy on safe floors in the same connected battlefield', () => {
  const body = world.createCharacter({ x: 0, y: 80, z: 0 }, 0.5032, 1.955);
  try {
    for (const p of [...data.spawns.A, ...data.spawns.B]) {
      assert.ok(body.canFit({ x: p[0], y: p[1] + 0.1, z: p[2] }, 1.955));
      assert.ok(body.move(vec(p), { x: 0, y: -0.2, z: 0 }, 1.955).grounded, `No spawn floor at ${p}`);
    }
    assert.ok(nav.findPath(vec(data.spawns.A[0]), vec(data.spawns.B[0]))?.length);
  } finally { body.dispose(); }
});

for (const [from, to] of [['a', 'b1'], ['b1', 'b2'], ['b2', 'c1'], ['c1', 'c2']]) test(`bot capsule traverses Cracked ${from} → ${to}`, () => {
  const route = nav.findPath(vec(data.landmarks[from]), vec(data.landmarks[to]));
  assert.ok(route?.length, 'Missing cross-sector route');
  const body = world.createCharacter(route[0], 0.5032, 1.955); let position = route[0].clone(), vy = 0;
  try {
    for (const target of route) {
      let budget = 160;
      while (Math.hypot(target.x - position.x, target.z - position.z) > 0.15 && budget-- > 0) {
        const dx = target.x - position.x, dz = target.z - position.z, distance = Math.hypot(dx, dz), step = Math.min(distance, 4.5 / 60);
        vy -= 18 / 60;
        const move = body.move(position, { x: dx / distance * step, y: vy / 60, z: dz / distance * step }, 1.955);
        position.copy(move.position); if (move.grounded) vy = 0;
      }
      assert.ok(budget > 0, `Stuck ${position.toArray()} → ${target.toArray()}`);
      assert.ok(Math.abs(position.y - target.y) < 0.65, 'Character took the wrong floor');
    }
  } finally { body.dispose(); }
});
