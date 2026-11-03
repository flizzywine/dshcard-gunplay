import assert from 'node:assert/strict';
import test from 'node:test';
import { initPhysics, PhysicsWorld } from '../js/physics.js';

await initPhysics();
const floor = { x0: -50, x1: 50, y0: -1, y1: 0, z0: -50, z1: 50 };
const box = (x0, y0, z0, x1, y1, z1) => ({ x0, y0, z0, x1, y1, z1 });
function setup(t, boxes = [], terrain = null) {
  const world = new PhysicsWorld({ boxes: [floor, ...boxes], terrain });
  t.after(() => world.dispose()); return world;
}
function walk(character, start, xSpeed, seconds = 2) {
  let position = start, vy = 0, grounded = false;
  for (let i = 0; i < seconds * 120; i++) {
    vy -= 18 / 120;
    const result = character.move(position, { x: xSpeed / 120, y: vy / 120, z: 0 });
    position = result.position; grounded = result.grounded;
    if (grounded) vy = 0;
  }
  return { position, grounded };
}

test('character lands on the floor with a stable skin gap', t => {
  const world = setup(t), start = { x: 0, y: 3, z: 0 };
  const result = walk(world.createCharacter(start), start, 0);
  assert.equal(result.grounded, true);
  assert.ok(result.position.y >= 0 && result.position.y < 0.04);
});

test('a single dash cannot cross a thin wall and diagonal movement slides along it', t => {
  const world = setup(t, [box(0, 0, -10, 0.04, 3, 10)]), start = { x: -3, y: 0.02, z: 0 };
  const character = world.createCharacter(start);
  const result = character.move(start, { x: 12, y: -0.03, z: 2 });
  assert.ok(result.position.x < -0.34 && result.position.x > -0.5, JSON.stringify(result));
  assert.ok(result.position.z > 1.5, JSON.stringify(result));
});

test('automatic step climbs a low stair but cannot climb a tall wall', t => {
  const world = setup(t, [box(0, 0, -2, 3, 0.3, 2)]), start = { x: -1, y: 0.02, z: 0 };
  const result = walk(world.createCharacter(start), start, 1, 3);
  assert.ok(result.position.x > 0.8, JSON.stringify(result));
  assert.ok(result.position.y > 0.28 && result.position.y < 0.35, JSON.stringify(result));
});

test('the character follows the actual ramp triangles', t => {
  const terrain = { vertices: new Float32Array([0, 0, -2, 4, 2, -2, 0, 0, 2, 4, 2, 2]), indices: new Uint32Array([0, 2, 1, 1, 2, 3]) };
  const world = setup(t, [], terrain), start = { x: -0.5, y: 0.02, z: 0 };
  const result = walk(world.createCharacter(start), start, 1, 3);
  assert.ok(result.position.x > 1.5, JSON.stringify(result));
  assert.ok(Math.abs(result.position.y - result.position.x / 2) < 0.08, JSON.stringify(result));
});

test('prone fits a low tunnel; standing and growing the capsule are rejected', t => {
  const world = setup(t, [box(-2, 0.8, -2, 2, 1, 2)]), start = { x: 0, y: 0.02, z: 0 };
  const character = world.createCharacter(start, 0.35, 0.6);
  assert.equal(character.canFit(start, 0.6), true);
  assert.equal(character.canFit(start, 1.25), false);
  assert.equal(character.canFit(start, 1.8), false);
  assert.equal(character.move(start, { x: 0.1, y: -0.01, z: 0 }, 1.8).height, 0.6);
  assert.equal(character.canFit({ x: 4, y: 0.02, z: 0 }, 1.8), true);
});

test('jumping hits a ceiling without pushing the character through it', t => {
  const world = setup(t, [box(-2, 2.2, -2, 2, 2.4, 2)]), start = { x: 0, y: 0.02, z: 0 };
  const result = world.createCharacter(start).move(start, { x: 0, y: 3, z: 0 });
  assert.ok(result.position.y < 0.41, JSON.stringify(result));
  assert.ok(result.normals.some(n => n.y < -0.5));
});

test('thrown bodies fall, bounce, and stop on the floor', t => {
  const world = setup(t), projectile = world.createProjectile({ x: 0, y: 3, z: 0 }, { x: 0, y: 0, z: 0 });
  let contacts = 0, bounced = false, snapshot;
  for (let i = 0; i < 600; i++) {
    world.step(1 / 120); snapshot = projectile.snapshot(); contacts += snapshot.contacts;
    if (snapshot.velocity.y > 0.5) bounced = true;
  }
  assert.ok(contacts > 0); assert.equal(bounced, true);
  assert.ok(snapshot.position.y > 0.03 && snapshot.position.y < 0.08);
  assert.ok(Math.abs(snapshot.velocity.y) < 0.2);
});

test('CCD prevents a fast projectile passing through a thin wall', t => {
  const world = setup(t, [box(0, 0, -2, 0.02, 3, 2)]);
  const projectile = world.createProjectile({ x: -1, y: 1, z: 0 }, { x: 200, y: 0, z: 0 });
  world.step(1 / 30);
  assert.ok(projectile.snapshot().position.x < 0, 'projectile crossed the wall');
});

test('fixed stepping is independent of render rate and does not advance while paused', t => {
  const a = setup(t), b = setup(t), p = { x: 0, y: 10, z: 0 }, v = { x: 2, y: 0, z: 0 };
  const pa = a.createProjectile(p, v), pb = b.createProjectile(p, v);
  for (let i = 0; i < 30; i++) a.step(1 / 30);
  for (let i = 0; i < 120; i++) b.step(1 / 120);
  assert.deepEqual(pa.snapshot().position, pb.snapshot().position);
  const before = pa.snapshot().position; a.step(0);
  assert.deepEqual(pa.snapshot().position, before);
});

test('removal releases bodies/controllers and cleanup is idempotent', t => {
  const world = setup(t), character = world.createCharacter({ x: 0, y: 0.02, z: 0 });
  const projectile = world.createProjectile({ x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: 0 });
  character.dispose(); character.dispose(); projectile.dispose(); projectile.dispose();
  assert.equal(world.characters.size, 0); assert.equal(world.projectiles.size, 0);
  world.dispose(); world.dispose();
});

test('environment rays report the closest surface, material and outward normal', t => {
  const wall = { ...box(0, 0, -2, 0.04, 3, 2), mat: 'metal', pen: 0.4 };
  const world = setup(t, [wall]), origin = { x: -3, y: 1, z: 0 }, direction = { x: 1, y: 0, z: 0 };
  assert.equal(world.raycast(origin, direction, 2), null);
  const hit = world.raycast(origin, direction, 10);
  assert.ok(Math.abs(hit.t - 3) < 0.001);
  assert.deepEqual(hit.surface, wall);
  assert.deepEqual(hit.normal, { x: -1, y: 0, z: 0 });
  assert.ok(Math.abs(hit.point.x) < 0.001);
  assert.equal(world.raycast({ x: 0.02, y: 1, z: 0 }, direction, 10).t, 0, 'a ray starting inside a wall cannot escape it');
});

test('rays intersect the same ramp triangles as character movement', t => {
  const terrain = { vertices: new Float32Array([0, 0, -2, 4, 2, -2, 0, 0, 2, 4, 2, 2]), indices: new Uint32Array([0, 2, 1, 1, 2, 3]), surface: { mat: 'sand' } };
  const world = setup(t, [], terrain);
  const hit = world.raycast({ x: 2, y: 5, z: 0 }, { x: 0, y: -1, z: 0 }, 10);
  assert.ok(Math.abs(hit.point.y - 1) < 0.001);
  assert.equal(hit.surface.mat, 'sand');
  assert.ok(hit.normal.y > 0.8 && hit.normal.x < -0.4);
});

test('movement capsules never occlude environment rays, including after death and respawn', t => {
  const world = setup(t, [box(0, 0, -2, 0.04, 3, 2)]);
  const a = world.createCharacter({ x: -2, y: 0.02, z: 0 });
  const b = world.createCharacter({ x: -1, y: 0.02, z: 0 });
  world.step(1 / 60);
  const ray = () => world.raycast({ x: -3, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 10);
  assert.ok(Math.abs(ray().t - 3) < 0.001);
  a.disable(); b.reset({ x: -2.5, y: 0.02, z: 0 }); world.step(1 / 60);
  assert.ok(Math.abs(ray().t - 3) < 0.001);
});

test('dynamic props occlude environment rays and removal clears their surface metadata', t => {
  const world = setup(t, [box(2, 0, -2, 2.04, 3, 2)]);
  const prop = world.createProjectile({ x: -1, y: 1.5, z: 0 }, { x: 0, y: 0, z: 0 }, { gravityScale: 0 });
  world.step(1 / 60);
  const ray = () => world.raycast({ x: -3, y: 1.5, z: 0 }, { x: 1, y: 0, z: 0 }, 10);
  assert.ok(ray().t > 1.9 && ray().t < 2);
  assert.equal(ray().surface.mat, 'metal');
  prop.dispose(); world.step(1 / 60);
  assert.ok(Math.abs(ray().t - 5) < 0.001);
});
