import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { separateBots } from '../js/ai-movement.js';
const bot = (id, x, y = 0, z = 0) => ({ id, alive: true, pos: new Vector3(x, y, z), radius: 0.503, physicsBody: { height: 1.955 } });
test('bots on separate floors do not push each other', () => {
  const a = bot(1, 0), b = bot(2, 0.1, 3), wanted = new Vector3(1, 0, 0);
  assert.deepEqual(separateBots(a, [a, b], wanted).toArray(), [1, 0, 0]);
});
test('separation starts before same-floor body capsules overlap', () => {
  const a = bot(1, 0), b = bot(2, 1.05), wanted = new Vector3();
  separateBots(a, [b], wanted); assert.ok(wanted.x < 0);
});
test('coincident bots choose opposite deterministic escape directions', () => {
  const a = bot(1, 0), b = bot(2, 0), da = new Vector3(), db = new Vector3();
  separateBots(a, [b], da); separateBots(b, [a], db);
  assert.ok(da.length() > 0.1); assert.ok(da.clone().add(db).length() < 1e-8);
});
test('crowding correction is bounded and static/dead bots do not move', () => {
  const a = bot(1, 0), neighbours = Array.from({ length: 20 }, (_, i) => bot(i + 2, 0.1));
  const desired = separateBots(a, neighbours, new Vector3()); assert.ok(desired.length() <= 1.8 + 1e-8);
  a.static = true; assert.deepEqual(separateBots(a, neighbours, new Vector3()).toArray(), [0, 0, 0]);
  a.static = false; neighbours.forEach(b => b.alive = false);
  assert.deepEqual(separateBots(a, neighbours, new Vector3()).toArray(), [0, 0, 0]);
});
