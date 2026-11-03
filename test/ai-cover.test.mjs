import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { Bot } from '../js/ai.js';
import { World } from '../js/world.js';
import { CoverReload, protectedAt, scoreCoverPoint } from '../js/ai-cover.js';
import { initPhysics, PhysicsWorld } from '../js/physics.js';
await initPhysics();
function fixture(t, height = 2.6) {
  const boxes = height ? [{ x0: 2, x1: 4, y0: 0, y1: height, z0: -2, z1: -1.4 }] : [];
  const physics = new PhysicsWorld({ boxes: [{ x0: -20, x1: 20, y0: -1, y1: 0, z0: -20, z1: 20 }, ...boxes] });
  t.after(() => physics.dispose());
  const world = Object.assign(Object.create(World.prototype), { physics, boxes, half: 20, def: { size: 40 } });
  world.buildGrid();
  const game = { time: 10, world, bots: [], audio: { reload() {} } };
  const bot = Object.assign(Object.create(Bot.prototype), { game, pos: new Vector3(0, .025, 0), radius: .503,
    stats: { mag: 30, reload: 1, mobility: 1 }, mag: 2, reloadT: 0, reloadPending: false,
    lastSeenPos: new Vector3(0, 0, -12), lastSeenEye: new Vector3(0, 1.8, -12), lastSeenT: 10,
    crouchT: 0, coverReload: new CoverReload(), alive: true, pathT: -99, home: new Vector3() });
  bot.physicsBody = physics.createCharacter(bot.pos, bot.radius, 1.955); game.bots.push(bot);
  return { bot, game, world, threat: bot.lastSeenEye, point: new Vector3(3, .025, 0), desired: new Vector3() };
}
test('reload grants ammunition only after completion; cancellation preserves the magazine', t => {
  const { bot } = fixture(t);
  bot.reload(); assert.equal(bot.mag, 2); bot.updateReload(.5); assert.equal(bot.mag, 2);
  bot.cancelReload(); bot.updateReload(10); assert.equal(bot.mag, 2);
  bot.reload(); bot.updateReload(1.1); assert.equal(bot.mag, 30); assert.equal(bot.reloadPending, false);
});
test('cover scoring checks head clearance and differentiates crouched and standing cover', t => {
  const full = fixture(t), low = fixture(t, 1.7), shallow = fixture(t, 1.1);
  assert.equal(scoreCoverPoint(full.world, full.bot, full.threat, full.point)?.crouch, false);
  assert.equal(scoreCoverPoint(low.world, low.bot, low.threat, low.point)?.crouch, true);
  assert.equal(scoreCoverPoint(shallow.world, shallow.bot, shallow.threat, shallow.point), null);
  assert.equal(scoreCoverPoint(full.world, full.bot, full.threat, full.bot.pos), null);
});
test('occupied or reserved cover on the same floor is rejected', t => {
  const { bot, game, world, threat, point } = fixture(t);
  const other = { alive: true, pos: point.clone() }; game.bots.push(other);
  assert.equal(scoreCoverPoint(world, bot, threat, point), null);
  other.pos.y = 4; assert.ok(scoreCoverPoint(world, bot, threat, point));
  other.coverReload = { position: point.clone() }; assert.equal(scoreCoverPoint(world, bot, threat, point), null);
});
test('planner selects reachable shelter, moves before reloading, then completes there', t => {
  const { bot, game, world, desired } = fixture(t); const c = bot.coverReload;
  c.update(bot, 1/60, desired); assert.equal(c.state, 'seek'); assert.equal(bot.reloadT, 0);
  let began = false;
  for (let i = 0; i < 300 && c.stats.completed === 0; i++) {
    game.time += 1/60; world.physics.step(1/60); c.update(bot, 1/60, desired);
    bot.crouchT += ((c.crouch ? 1 : 0) - bot.crouchT) * .15;
    const moved = bot.physicsBody.move(bot.pos, { x: desired.x/60, y: -.01, z: desired.z/60 }, bot.coverShape(bot.crouchT).height);
    bot.pos.copy(moved.position);
    if (bot.reloadT > 0) { began = true; assert.ok(protectedAt(world, bot, bot.pos, bot.lastSeenEye, bot.crouchT)); }
    bot.updateReload(1/60);
  }
  assert.ok(began); assert.equal(c.stats.completed, 1); assert.equal(bot.mag, 30);
});
test('unreachable shelter and empty terrain use a finite fallback', t => {
  for (const height of [0, 2.6]) {
    const { bot, game, world, desired } = fixture(t, height); world.findPath = () => [];
    for (let i = 0; i < 60 && bot.reloadT === 0; i++) { game.time += 1/60; bot.coverReload.update(bot, 1/60, desired); }
    assert.equal(bot.coverReload.state, 'fallback'); assert.ok(bot.reloadT > 0); assert.equal(bot.mag, 2);
  }
});
test('planning respects shared budgets and eventually falls back if starved', t => {
  const { bot, game, desired } = fixture(t); game.coverBudget = 0; game.pathBudget = 0;
  bot.coverReload.update(bot, .01, desired); assert.equal(bot.coverReload.state, 'search'); assert.equal(bot.reloadT, 0);
  game.time += .9; bot.coverReload.update(bot, .01, desired); assert.equal(bot.coverReload.state, 'fallback');
});
test('a flank interrupts reload without free ammunition; stun clears the reservation', t => {
  const { bot, game, point, desired } = fixture(t); const c = bot.coverReload;
  bot.pos.copy(point); c.state = 'reload'; c.position = point.clone(); c.threat = bot.lastSeenEye.clone(); c.crouch = false; c.checkAt = 0; c.replans = 0;
  bot.reload(); bot.lastSeenEye.set(12, 1.8, 0); game.time += .2; bot.lastSeenT = game.time;
  c.update(bot, .01, desired); assert.notEqual(c.state, 'reload'); assert.equal(bot.mag, 2);
  bot.stunT = 0; bot.stun(2); assert.equal(c.state, 'idle'); assert.equal(c.position, null); assert.equal(bot.reloadPending, false);
});
