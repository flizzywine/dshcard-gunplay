import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { pelletDirection } from '../js/shotgun-pattern.js';

test('nine pellets keep a centre hit and symmetric, distinct coverage within the cone', () => {
  const aim=new Vector3(0,0,-1), angle=.03;
  const pellets=Array.from({length:9},(_,i)=>pelletDirection(aim,angle,i,9));
  assert.deepEqual(pellets[0],aim);
  assert.equal(new Set(pellets.map(d=>d.toArray().join(','))).size,9);
  const sum=new Vector3();
  for(const p of pellets){assert.ok(Math.abs(p.length()-1)<1e-10);assert.ok(p.angleTo(aim)<=angle);sum.add(p);}
  assert.ok(Math.abs(sum.x)<1e-10&&Math.abs(sum.y)<1e-10);
  assert.ok(pellets[1].angleTo(aim)>.02);
});
test('pellet pattern stays finite while aiming vertically or diagonally', () => {
  for(const aim of [new Vector3(0,1,0),new Vector3(0,-1,0),new Vector3(1,2,3).normalize()])
    for(let i=0;i<9;i++){const p=pelletDirection(aim,.04,i,9);assert.ok(p.toArray().every(Number.isFinite));assert.ok(p.angleTo(aim)<.041);}
});
test('single projectile and zero cone preserve exact aim without mutating it', () => {
  const aim=new Vector3(1,0,0);
  assert.deepEqual(pelletDirection(aim,0,3,9),aim);
  assert.deepEqual(pelletDirection(aim,.04,0,1),aim);
  assert.deepEqual(aim.toArray(),[1,0,0]);
});
