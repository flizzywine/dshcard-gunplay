import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { initPhysics, PhysicsWorld } from '../js/physics.js';
import { World } from '../js/world.js';
import { Bot } from '../js/ai.js';
import { traceBullet, fireHitscan, Projectile } from '../js/combat.js';
import { computeStats } from '../js/data.js';

await initPhysics();
test('AT4 flies below zero elevation and detonates at the actual wall', t => {
  const physics=new PhysicsWorld({boxes:[{x0:-5,x1:5,y0:-20,y1:0,z0:-10,z1:-9.9}]});
  t.after(()=>physics.dispose());
  const world=Object.assign(Object.create(World.prototype),{physics});
  const game={world,entities:[],effects:{smoke:{emit(){}},add:{emit(){}}}};
  const rocket=Object.assign(Object.create(Projectile.prototype),{game,type:'rocket',pos:new THREE.Vector3(0,-10,0),vel:new THREE.Vector3(0,0,-50),alive:true,age:0,fuse:6,mesh:new THREE.Object3D()});
  rocket.detonate=function(){this.alive=false;};
  rocket.update(1/60);
  assert.equal(rocket.alive,true,'negative battlefield elevation must not cause immediate detonation');
  assert.ok(rocket.pos.z<-.8);
  for(let i=0;i<30&&rocket.alive;i++)rocket.update(1/60);
  assert.equal(rocket.alive,false);assert.ok(rocket.pos.z<-9&&rocket.pos.z>-10.1);
});
function setup(t, wall = false) {
  const physics = new PhysicsWorld({ boxes: wall ? [{ x0: -3, x1: 3, y0: 0, y1: 3, z0: -4, z1: -3.9, mat: 'metal' }] : [] });
  t.after(() => physics.dispose());
  const world = Object.assign(Object.create(World.prototype), { physics });
  // Use the production Bot hit regions without constructing rendering assets.
  const enemy = Object.assign(Object.create(Bot.prototype), { alive: true, team: 'B', pos: new THREE.Vector3(), anim: { crouch: 0 }, hp: 100 });
  enemy.takeDamage = function (damage, info) { this.hp -= damage; this.lastDamage = info; return this.hp <= 0; };
  const shooter = { alive: true, team: 'A', stats: { score: 0 } };
  const impacts = [];
  const game = { world, player: shooter, entities: [shooter, enemy], effects: { blood() {}, impact(...args) { impacts.push(args); } }, hud: { combatScore() {} } };
  physics.createCharacter(enemy.pos, 0.503, 1.955);
  physics.step(1 / 60);
  return { physics, world, enemy, shooter, game, impacts };
}
const direction = new THREE.Vector3(0, 0, 1);

for (const [part, y] of [['head', 1.68 * 1.15], ['body', 1.4], ['legs', 0.5]]) {
  test(`Rapier environment rays preserve ${part} hits and damage`, t => {
    const { enemy, shooter, game } = setup(t), stats = computeStats('m4');
    const result = fireHitscan(game, shooter, new THREE.Vector3(0, y, -10), direction, stats, 'M4A1');
    assert.equal(result.ent, enemy); assert.equal(result.part, part);
    const multiplier = part === 'head' ? stats.headMul : part === 'legs' ? 0.85 : 1;
    assert.ok(Math.abs(result.dmg - stats.dmgNear * multiplier) < 1e-6);
    assert.equal(enemy.lastDamage.head, part === 'head');
    assert.equal(shooter.stats.score, Math.round(result.dmg));
  });
}

test('a wall blocks head/body hits, reports its material and causes no damage', t => {
  const { enemy, shooter, game, impacts } = setup(t, true);
  const result = fireHitscan(game, shooter, new THREE.Vector3(0, 1.4, -10), direction, computeStats('m4'), 'M4A1');
  assert.equal(result.ent, null); assert.equal(enemy.hp, 100);
  assert.equal(result.world.box.mat, 'metal'); assert.ok(Math.abs(result.t - 6) < 0.001);
  assert.equal(impacts[0][2], 'metal'); assert.equal(shooter.stats.score, 0);
});

test('the movement capsule cannot widen a target hitbox', t => {
  const { game, shooter } = setup(t);
  const result = traceBullet(game, shooter, new THREE.Vector3(0.45, 1.4, -10), direction);
  assert.equal(result.ent, null); assert.equal(result.world, null);
});

test('friendly/dead entities and the shooter are still excluded from hits', t => {
  const { game, enemy, shooter } = setup(t);
  const friendly = Object.assign(Object.create(Bot.prototype), { alive: true, team: 'A', pos: new THREE.Vector3(0, 0, -3), anim: { crouch: 0 } });
  game.entities.unshift(friendly);
  const origin = new THREE.Vector3(0, 1.4, -10);
  assert.equal(traceBullet(game, shooter, origin, direction).ent, enemy);
  enemy.alive = false;
  assert.equal(traceBullet(game, shooter, origin, direction).ent, null);
});

test('moving props block hits and AI sight using the same environment query', t => {
  const { physics, game, shooter, enemy, world } = setup(t);
  const origin = new THREE.Vector3(0, 1.4, -10), end = new THREE.Vector3(0, 1.4, 0);
  assert.equal(world.lineBlocked(origin, end), false);
  const prop = physics.createProjectile({ x: 0, y: 1.4, z: -5 }, { x: 0, y: 0, z: 0 }, { gravityScale: 0 });
  physics.step(1 / 60);
  const result = traceBullet(game, shooter, origin, direction);
  assert.equal(result.ent, null); assert.equal(result.world.box.mat, 'metal');
  assert.equal(world.lineBlocked(origin, end), true);
  prop.dispose(); physics.step(1 / 60);
  assert.equal(world.lineBlocked(origin, end), false);
  assert.equal(traceBullet(game, shooter, origin, direction).ent, enemy);
});

test('maximum range still limits entity hits', t => {
  const { game, shooter } = setup(t);
  const result = traceBullet(game, shooter, new THREE.Vector3(0, 1.4, -10), direction, 5);
  assert.equal(result.ent, null); assert.equal(result.t, 5);
});
