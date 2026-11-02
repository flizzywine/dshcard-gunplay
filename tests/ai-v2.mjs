import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import { Bot } from '../dist/js/ai.js';
import { mulberry32, rayAABB } from '../dist/js/util.js';
globalThis.window={};
Math.random=mulberry32(122);
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const noop=()=>{};
let blocked=false,smoke=false,shots=0;
const world={def:{},navVersion:0,half:40,cellOf:(x,z)=>[Math.floor(x),Math.floor(z)],walkable:()=>true,gridLOS:()=>!blocked,findPath:(a,b)=>[b.clone()],lineBlocked:()=>blocked,collide:noop,groundHeight:()=>0};
const effects={smokeBlocks:()=>smoke,fires:[],tracer:noop,flashLight:noop,blood:noop,impact:noop};
const game={scene:new THREE.Scene(),time:0,world,effects,bots:[],entities:[],noises:[],pathBudget:3,hazards:[],audio:{reload:noop,shot:()=>shots++,step:noop,click:noop},makeNoise:noop,hud:{highAlert:noop},onKill:noop};
const bot=new Bot(game,{team:'B',pos:V(),weaponId:'m4',easyEnemy:true,role:'mp'});game.bots=[bot];game.entities=[bot];
const target={team:'A',alive:true,pos:V(0,0,-10),vel:V(),chestPos(out){return out.copy(this.pos).add(V(0,1.2,0));},eyePos(out){return out.copy(this.pos).add(V(0,1.6,0));},hitTest(){return null;}};
game.entities.push(target);world.raycast=()=>null;
bot.perceive();assert.equal(bot.target,target);assert.equal(bot.targetVisible,true);
blocked=true;bot.burstLeft=2;bot.fireT=0;const mag=bot.mag;bot.tryFire(.1,target,10);assert.equal(bot.mag,mag);assert.equal(shots,0);assert.equal(bot.targetVisible,false,'cached visibility cannot fire through new wall');
bot.perceive();assert.equal(bot.targetVisible,false);blocked=false;smoke=true;bot.tryFire(.1,target,10);assert.equal(shots,0);smoke=false;
bot.targetVisible=true;bot.tryFire(.1,target,10);assert.equal(shots,1);assert.equal(bot.mag,mag-1);
bot.mag=0;bot.reload();assert.equal(bot.mag,0,'reload is not immediate');assert.equal(bot.reloadPending,true);bot.tryFire(.1,target,10);assert.equal(shots,1);
game.mode={type:'assault',botGoal:()=>V(15,0,0),commandGoal:()=>null};game.entities=[bot];bot.target=null;bot.targetVisible=false;
for(let i=0;i<100;i++){game.time+=.05;game.pathBudget=3;bot.update(.05);}
assert.equal(bot.reloadPending,false);assert.equal(bot.mag,bot.stats.mag);assert(bot.pos.x>10,'bot advances toward objective');
// Orders are executed even while a distant target is visible.
bot.pos.set(0,0,0);bot.path=null;bot.nextPathT=0;bot.target=target;bot.targetVisible=true;bot.acquireT=1e6;game.entities=[bot,target];
game.mode.commandGoal=()=>V(15,0,0);bot.command={kind:'attack',expiresAt:game.time+20};
for(let i=0;i<50;i++){game.time+=.05;game.pathBudget=3;bot.update(.05);}
assert(bot.pos.x>7,'attack order overrides distant combat strafe');
// Failed paths must wait and must not push into an obstacle indefinitely.
bot.pos.set(0,0,0);bot.path=null;bot.nextPathT=0;blocked=true;let paths=0;world.findPath=()=>{paths++;return null;};const out=V();
bot.steer(V(10,0,0),4,out);assert.equal(out.length(),0);bot.steer(V(10,0,0),4,out);assert.equal(paths,1,'failed path bounded retry');
blocked=false;game.pathBudget=0;bot.path=null;bot.nextPathT=0;world.navVersion++;bot.steer(V(10,0,0),4,out);assert(out.x>0,'safe direct route usable without budget');
// Fire alters approach, pushes bots out of the dangerous disk.
game.hazards=[{pos:V(),radius:3,expiresAt:game.time+10}];bot.pos.set(2,0,0);out.set(-4,0,0);bot.avoidFire(out);assert(out.x>0);assert(Math.abs(out.z)>0);game.time+=11;out.set(-4,0,0);bot.avoidFire(out);assert.equal(out.x,-4,'expired hazard ignored');game.hazards=[];
// Visible mech draws focus; an occluded mech never becomes target.
const mech={...target,isMech:true,pos:V(1,0,-14)};game.entities=[bot,target,mech];bot.pos.set(0,0,0);bot.yaw=0;bot.target=null;bot.perceive();assert.equal(bot.target,mech);blocked=true;bot.perceive();assert.equal(bot.targetVisible,false);
// Coincident spawn separation is finite rather than division-by-zero.
blocked=false;game.entities=[bot];game.bots=[bot,{alive:true,pos:bot.pos.clone()}];game.mode.commandGoal=()=>null;game.mode.botGoal=()=>bot.pos.clone();bot.target=null;bot.lastSeenPos=null;bot.goal=null;game.time+=.05;bot.update(.05);assert(Number.isFinite(bot.pos.x));assert(Number.isFinite(bot.pos.z));
let meshes=0;bot.model.root.traverse(o=>{if(o.isMesh)meshes++;});assert(meshes<=10,`battle model mesh budget ${meshes}`);
console.log('PASS AI v2: staggered perception + fresh LOS/smoke; delayed reload; objective advance; command movement; bounded path retries; fire avoidance; visible-mech priority; separation; simple model <=10 meshes.');
