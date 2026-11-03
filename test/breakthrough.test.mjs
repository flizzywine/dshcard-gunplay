import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Breakthrough } from '../js/breakthrough.js';

const sectors = () => [
  { objectives: [{ name: 'A', x: 0, z: 0, radius: 5 }] },
  { objectives: [{ name: 'B1', x: 20, z: 0, radius: 5 }, { name: 'B2', x: 40, z: 0, radius: 5 }] },
  { objectives: [{ name: 'C1', x: 60, z: 0, radius: 5 }, { name: 'C2', x: 80, z: 0, radius: 5 }] },
];
const soldier = (team, x = 0, y = 0, alive = true) => ({ team, pos: { x, y, z: 0 }, alive });
const match = () => new Breakthrough(sectors(), { captureSeconds: 10 });

test('A unlocks B, both B objectives unlock C, and both C objectives win', () => {
  const b = match();
  assert.equal(b.update(10, [soldier('A')], 600).advanced, true);
  assert.equal(b.stage, 1); assert.equal(b.tickets, 260);
  b.update(10, [soldier('A', 20)], 600);
  assert.equal(b.stage, 1);
  b.update(10, [soldier('A', 40)], 600);
  assert.equal(b.stage, 2); assert.equal(b.tickets, 340);
  b.update(10, [soldier('A', 60), soldier('A', 80)], 600);
  assert.equal(b.winner, 'A');
});
test('only active-sector objectives can be captured', () => {
  const b = match(); b.update(100, [soldier('A', 20), soldier('A', 60)], 600);
  assert.equal(b.stage, 0); assert.equal(b.sectors[1].objectives[0].prog, 0);
});
test('contested points freeze, defenders reverse partial captures, empty points decay', () => {
  const b = match(); b.update(4, [soldier('A')], 600);
  b.update(4, [soldier('A'), soldier('B')], 600);
  assert.equal(b.objectives[0].prog, 0.4); assert.equal(b.objectives[0].contested, true);
  b.update(2, [soldier('B')], 600); assert.equal(b.objectives[0].prog, 0.2);
  b.update(10, [], 600); assert.equal(b.objectives[0].prog, 0);
});
test('defenders can recapture B1 while B2 is still held', () => {
  const b = match(); b.update(10, [soldier('A')], 600);
  b.update(10, [soldier('A', 20)], 600); assert.equal(b.objectives[0].owner, 'A');
  b.update(10, [soldier('B', 20)], 600); assert.equal(b.objectives[0].owner, 'B');
  assert.equal(b.stage, 1);
});
test('defender deaths do not cost tickets, attacker deaths do, exhaustion wins for defenders', () => {
  const b = match(); b.casualty('B'); assert.equal(b.tickets, 180);
  b.casualty('A'); assert.equal(b.tickets, 179);
  for (let i = 0; i < 200; i++) b.casualty('A');
  b.update(0, [], 600); assert.equal(b.winner, 'B'); assert.equal(b.tickets, 0);
});
test('capture continues in overtime, ending when attackers leave', () => {
  const b = match(); const r = b.update(2, [soldier('A')], 0);
  assert.equal(r.overtime, true); assert.equal(b.winner, null);
  b.update(0.1, [], -1); assert.equal(b.winner, 'B');
});
test('dead soldiers, turrets, distant units and floors above capture volume do not capture', () => {
  const b = match(); b.update(50, [soldier('A', 0, 0, false), soldier('A', 10), soldier('A', 0, 8), { ...soldier('A'), isTurret: true }], 600);
  assert.equal(b.objectives[0].prog, 0); assert.equal(b.stage, 0);
});
test('two match instances do not share captured sector state', () => {
  const s = sectors(), a = new Breakthrough(s), b = new Breakthrough(s);
  a.update(20, [soldier('A')], 600);
  assert.equal(b.stage, 0); assert.equal(b.objectives[0].prog, 0);
});
