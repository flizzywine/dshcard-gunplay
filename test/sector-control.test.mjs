import test from 'node:test';
import assert from 'node:assert/strict';
import {SectorControl} from '../js/sector-control.js';
const point=(id,x)=>({id,label:id,pos:{x,y:-12,z:0},radius:10});
const sectors=()=>[{label:'A',points:[point('a',0)]},{label:'B',points:[point('b1',100),point('b2',130)]},{label:'C',points:[point('c1',200),point('c2',230)]}];
const actor=(team,x,y=-12)=>({team,alive:true,pos:{x,y,z:0}});
test('future sectors stay locked, and a contested point does not capture',()=>{
 const c=new SectorControl(sectors());c.update(40,[actor('A',100)]);assert.equal(c.sectors[1].points[0].progress,0);assert.equal(c.index,0);
 c.update(10,[actor('A',0),actor('B',0)]);assert.equal(c.active.points[0].progress,0);assert.equal(c.active.points[0].contested,true);
 c.update(10,[actor('A',0)]);assert.equal(c.active.points[0].progress,.5);
});
test('dead actors and actors on another floor cannot capture',()=>{
 const c=new SectorControl(sectors()),dead=actor('A',0);dead.alive=false;c.update(30,[dead,actor('A',0,-1)]);assert.equal(c.active.points[0].progress,0);
});
test('A unlocks B; both B points are required before C; all C points win',()=>{
 const c=new SectorControl(sectors());let ev=c.update(20,[actor('A',0)]);assert.equal(c.index,1);assert.equal(c.tickets,140);assert.ok(ev.some(e=>e.type==='advance'));
 c.update(20,[actor('A',100)]);assert.equal(c.index,1);c.update(20,[actor('A',130)]);assert.equal(c.index,2);assert.equal(c.tickets,180);
 c.update(20,[actor('A',200)]);assert.equal(c.winner,null);c.update(20,[actor('A',230)]);assert.equal(c.winner,'A');
});
test('defenders can reverse unfinished progress; completed points remain held',()=>{
 const c=new SectorControl(sectors());c.update(10,[actor('A',0)]);c.update(10,[actor('B',0)]);assert.equal(c.active.points[0].progress,.25);
 c.update(20,[actor('A',0)]);c.update(20,[actor('A',100)]);c.update(30,[actor('B',100)]);assert.equal(c.active.points[0].captured,true);assert.equal(c.index,1);
});
test('time expiry, overtime and final reinforcements have distinct outcomes',()=>{
 const c=new SectorControl(sectors(),{timeLimit:1});c.update(1,[]);assert.equal(c.winner,'B');
 const overtime=new SectorControl(sectors(),{timeLimit:1});overtime.update(1,[actor('A',0)]);assert.equal(overtime.winner,null);assert.equal(overtime.overtime,true);overtime.update(1,[]);assert.equal(overtime.winner,'B');
 const last=new SectorControl(sectors(),{tickets:1});last.loseTicket();last.update(1,[actor('A',0)]);assert.equal(last.winner,null);last.update(1,[]);assert.equal(last.winner,'B');
});
