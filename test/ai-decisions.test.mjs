import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { MPMatch } from '../js/mp.js';

function scenario() {
  const bot = { team: 'A', alive: true, pos: new Vector3(), lastSeenPos: null, lastSeenT: -99 };
  const enemy = { team: 'B', alive: true, pos: new Vector3(50, 0, 30) };
  const world = { randomWalkable: (x = 0, z = 0) => new Vector3(x, 0, z) };
  const game = { time: 10, world, bots: [bot], entities: [bot, enemy] };
  const match = Object.assign(Object.create(MPMatch.prototype), { game, type: 'tdm' });
  return { bot, enemy, game, match };
}
function fixedRandom(run) {
  const random = Math.random; Math.random = () => 0.1;
  try { run(); } finally { Math.random = random; }
}
test('unseen enemy movement cannot steer a patrol goal', () => fixedRandom(() => {
  const { bot, enemy, match } = scenario();
  const first = match.botGoal(bot); enemy.pos.set(-80, 20, -95);
  assert.deepEqual(match.botGoal(bot), first);
}));
test('patrol investigates remembered information, not the live target position', () => fixedRandom(() => {
  const { bot, match } = scenario(); bot.lastSeenPos = new Vector3(12, 0, 18); bot.lastSeenT = 9;
  assert.deepEqual(match.botGoal(bot).toArray(), [12, 0, 18]);
}));
test('expired, hostile and dead-team reports do not reveal enemy locations', () => fixedRandom(() => {
  const { bot, game, match } = scenario();
  game.bots.push({ alive: true, team: 'B', lastSeenT: 9, lastSeenPos: new Vector3(70, 0, 80) }, { alive: false, team: 'A', lastSeenT: 9, lastSeenPos: new Vector3(90, 0, 100) });
  bot.lastSeenT = 0; bot.lastSeenPos = new Vector3(5, 0, 6);
  assert.deepEqual(match.botGoal(bot).toArray(), [0, 0, 0]);
  game.bots.push({ alive: true, team: 'A', lastSeenT: 9, lastSeenPos: new Vector3(7, 0, 8) });
  assert.deepEqual(match.botGoal(bot).toArray(), [7, 0, 8]);
}));
