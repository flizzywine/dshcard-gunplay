// Actual game modules, geometry, collisions, AI, weapons and objectives. No WebGL/browser.
// Only browser canvas, visible effects, sound and HUD are inert adapters.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {World} from '../dist/js/world.js';
import {MAPS} from '../dist/js/maps.js';
import {Abilities} from '../dist/js/abilities.js';
import {MPMatch} from '../dist/js/mp.js';
import {initTextures} from '../dist/js/materials.js';
import {setTextureSize} from '../dist/js/textures.js';
import {mulberry32} from '../dist/js/util.js';
const noop=()=>{};
const context=new Proxy({measureText:s=>({width:s.length*8}),createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop})},{get:(t,k)=>t[k]||noop});
const node=()=>({style:{},classList:{add:noop,remove:noop,toggle:noop},getContext:()=>context,appendChild:noop,remove:noop});
globalThis.window={};globalThis.document={createElement:node,getElementById:()=>node(),pointerLockElement:{},exitPointerLock:noop};
globalThis.ImageData=class {constructor(data,width,height){Object.assign(this,{data,width,height})}};
const seed=Number(process.env.SEED || 2401);Math.random=mulberry32(seed);setTextureSize(16);await initTextures();
let shots=0,kills=0;let assist=process.env.ASSISTED==='1';let route=[],routeRefresh=0;

const game={scene:new THREE.Scene(),vmScene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),vmCamera:new THREE.PerspectiveCamera(),time:0,pathBudget:3,
 entities:[],bots:[],projectiles:[],pickups:[],noises:[],hazards:[],settings:{sens:1,adsSens:1,fov:78,invertY:false},input:{keys:{}},
 hud:new Proxy({},{get:()=>noop}),audio:new Proxy({shot(){shots++;}},{get:(t,k)=>t[k]||noop}),
 effects:new Proxy({texFlash:new THREE.Texture(),fires:[],smokeBlocks:()=>false},{get:(t,k)=>t[k]||noop}),
 addBot(b){this.bots.push(b);this.entities.push(b);return b},onKill(...args){kills++;this.mode.onKill(...args)},makeNoise(pos,r,team,footstep=false){this.noises.push({pos:pos.clone(),r,team,footstep,t:this.time})},
 pause(v){this.paused=v},menu:{showResults:noop},spawnPickup:noop,alertGroup:noop};
const def=MAPS.jinqu;game.world=new World(game,def);game.world.env=def.env;def.build(game.world,game);game.world.finalize();
game.mode=new MPMatch(game,{});game.mode.start();
assert.equal(game.entities.length,30);assert.equal(game.player.ws.slots.length,4);
for(let i=0;i<game.entities.length;i++)for(let j=i+1;j<game.entities.length;j++)assert(game.entities[i].pos.distanceTo(game.entities[j].pos)>=.8,`spawn overlap ${i}/${j}`);
for(const b of game.bots){const cell=game.world.cellOf(b.pos.x,b.pos.z);assert(game.world.walkable(...cell),`blocked spawn ${b.name}: ${b.pos.x},${b.pos.z}`);const path=game.world.findPath(b.pos,game.mode.flags[0].pos);assert(path?.length,`unreachable spawn ${b.name}`);}
const initial=game.bots.map(b=>b.pos.clone());
function controller(){
 const p=game.player, goal=game.mode.flags.find(f=>!f.captured)?.pos;
 if(!goal)return {mdx:0,mdy:0};
 if(game.time>routeRefresh || !route.length){route=game.world.findPath(p.pos,goal)||[];routeRefresh=game.time+.6;}
 while(route.length>1 && route[0].distanceTo(p.pos)<1)route.shift();
 const next=route[0]||goal, move=next.clone().sub(p.pos);move.y=0;if(move.length()>1)move.normalize();else move.set(0,0,0);
 const eye=p.eyePos(new THREE.Vector3());
 const visible=game.bots.filter(b=>b.alive&&b.team==='B'&&b.pos.distanceTo(p.pos)<65&&!game.world.lineBlocked(eye,b.chestPos(new THREE.Vector3()))).sort((a,b)=>a.pos.distanceTo(p.pos)-b.pos.distanceTo(p.pos));
 const target=visible[0], aim=(target?target.chestPos(new THREE.Vector3()):next.clone().add(new THREE.Vector3(0,1.5,0))).sub(eye);
 const yaw=Math.atan2(-aim.x,-aim.z),pitch=Math.atan2(aim.y,Math.hypot(aim.x,aim.z));let delta=yaw-p.yaw;while(delta>Math.PI)delta-=2*Math.PI;while(delta<-Math.PI)delta+=2*Math.PI;
 const zoom=1+(p.ws.w.stats.zoom-1)*p.ws.adsT,sens=game.settings.sens*.0022*(p.ws.adsT>.5?game.settings.adsSens/Math.pow(zoom,.85):1);
 const f=move.x*-Math.sin(yaw)+move.z*-Math.cos(yaw),r=move.x*Math.cos(yaw)-move.z*Math.sin(yaw);
 return {mdx:-delta/sens,mdy:-(pitch-p.pitch)/sens,fwd:f>.3,back:f<-.3,right:r>.3,left:r<-.3,fire:!!target,ads:!!target,reloadPressed:p.ws.w.mag===0};
}
function tick(count,dt=.05){for(let i=0;i<count;i++){game.time+=dt;game.pathBudget=3;game.noises=game.noises.filter(n=>game.time-n.t<.6);if(game.player.alive)game.player.update(dt,assist?controller():{mdx:0,mdy:0});for(const b of game.bots)b.update(dt);for(const p of game.projectiles)p.update(dt);game.projectiles=game.projectiles.filter(p=>p.alive);game.mode.update(dt);game.scene.updateMatrixWorld(true);if(game.mode.over)break;}}
tick(1200);
const moved=game.bots.filter((b,i)=>b.pos.distanceTo(initial[i])>3).length;
assert(moved>=24,`only ${moved}/29 moved`);assert(shots>10,`only ${shots} AI shots`);assert(kills>0,'real combat should cause deaths');
console.log(JSON.stringify({test:'60 simulated seconds actual AI/mode/world',bots:game.bots.length,moved,shots,kills,sector:game.mode.sectorIndex,captures:game.mode.capturedCount,tickets:game.mode.tickets}));
// Continue the natural battle, then restart the actual mode/world/player/bots.
if(!game.mode.over)tick(10820);
console.log(JSON.stringify({test:assist?'ideal-controller battle observation':'natural battle observation',seed,playerKills:game.player.stats.kills,time:game.time,over:game.mode.over,sector:game.mode.sectorIndex,captures:game.mode.capturedCount,shots,kills}));
assert(game.mode.over,'natural observation runs to actual victory, tickets or time terminal');
if(assist) assert.equal(game.mode.capturedCount,5,'ideal actual-input controller must be able to complete the map');
assert(game.paused,'completed battle freezes simulation');
assist=false;game.mode.dispose();for(const b of game.bots)b.dispose();game.player.ws.dispose();game.world.dispose();
game.entities=[];game.bots=[];game.projectiles=[];game.noises=[];game.time=0;game.paused=false;game.ending=false;
game.world=new World(game,def);game.world.env=def.env;def.build(game.world,game);game.world.finalize();game.mode=new MPMatch(game,{});game.mode.start();
assert.equal(game.mode.over,false);assert.equal(game.mode.tickets,160);assert.equal(game.mode.capturedCount,0);assert.equal(game.entities.length,30);
// Controlled capture fixture retains actual capture, geometry and collision methods.
for(const b of game.bots)b.alive=false;game.mode.respawns=[];
const ally=game.bots.find(b=>b.team==='A'), attack=game.mode.spawnPoint('A').pos;
ally.respawn(attack,0);const commandRoute=game.world.findPath(attack,game.mode.flags[0].pos);assert(commandRoute?.length);
const commanded=commandRoute[Math.min(commandRoute.length-1,12)].clone(), beforeCommand=ally.pos.distanceTo(commanded);
assert(game.mode.issueCommand('defend',commanded,null,'squad'));tick(220);
assert(ally.pos.distanceTo(commanded)<beforeCommand-2,'actual AI must move toward commander location');
console.log(JSON.stringify({test:'actual command movement',before:beforeCommand,after:ally.pos.distanceTo(commanded)}));
for(const b of game.bots)b.alive=false;game.mode.respawns=[];
// Real mech occupancy and destruction use the same live map and mode.
game.player.pos.copy(game.mode.flags[0].pos);game.player.yaw=-Math.PI/2;game.player.hp=200;
game.abilities=new Abilities(game);assert(game.abilities.summon(),'summon must find actual clear space');
const mech=game.abilities.mech;game.player.pos.copy(mech.pos).add(new THREE.Vector3(-1.6,0,0));
assert(game.abilities.toggleMount());assert.equal(game.player.targetable,false);const prior=game.mode.flags[0].prog;game.mode.updateCaptures(1);assert(Math.abs(game.mode.flags[0].prog-prior-.1)<1e-6,'piloted mech counts once, not pilot twice');
mech.takeDamage(1000,{attacker:null});assert.equal(game.abilities.mounted,false);assert.equal(game.player.targetable,true);assert.equal(game.player.hp,125);assert(!game.entities.includes(mech));game.abilities.dispose();game.abilities=null;
console.log('PASS real mech mount/objective single occupancy/destruction eject and 75 pilot damage');
for(let stage=game.mode.sectorIndex;stage<3;stage++){
 const goals=game.mode.flags.map(f=>f.pos.clone());
 for(const goal of goals){game.player.alive=true;game.player.pos.copy(goal);game.mode.updateCaptures(10.1);}
}
assert(game.mode.over);assert.equal(game.mode.capturedCount,5);
// Real destruction changes both physical blocking and navigation revision.
const part=game.world.destructibles.find(p=>!p.destroyed);assert(part);const box=part.box;
const middle=new THREE.Vector3((box.x0+box.x1)/2,(box.y0+box.y1)/2,(box.z0+box.z1)/2),revision=game.world.navRevision;
assert(game.world.boxes.includes(box));assert(game.world.damageDestructibles(middle,3,1000)>0);assert(part.destroyed);assert(!game.world.boxes.includes(box));assert(game.world.navRevision>revision);assert(game.bots.every(b=>b.path===null));
console.log('PASS integration: current modules start; 29 bot spawn paths; actual AI movement/fire/damage/deaths; controlled five-point capture; destruction removes collider and invalidates navigation. Simulated only, no WebGL/frame-rate claim.');
game.mode.dispose();
