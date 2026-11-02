import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Abilities, Mech, SKILLS } from '../dist/js/abilities.js';
import { Player } from '../dist/js/player.js';
import { rayAABB } from '../dist/js/util.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),noop=()=>{};
function fixture(){
 const boxes=[],world={half:120,boxes,ceilingHeight:()=>100,groundHeight:()=>0,collide(p,v,r,h){for(const b of boxes)if(p.x+r>b.x0&&p.x-r<b.x1&&p.z+r>b.z0&&p.z-r<b.z1&&b.y1>p.y+.45){p.z=b.z1+r;v.z=0;}},queryBoxes:()=>boxes,raycast(o,d,max){let best=null;for(const b of boxes){const t=rayAABB(o.x,o.y,o.z,d.x,d.y,d.z,b,max);if(t>=0&&(!best||t<best.t))best={t,point:o.clone().addScaledVector(d,t),normal:V(0,0,1),box:b};}return best;},lineBlocked(a,b){const d=b.clone().sub(a),n=d.length();return !!this.raycast(a,d.normalize(),n-.05);}};
 const fires=[],g={time:0,scene:new THREE.Scene(),vmScene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),world,settings:{sens:1,fov:78,adsSens:1},hud:{popup:noop,damageFrom:noop,hitmarker:noop},audio:{click:noop,explosion:noop,hurt:noop,setListener:noop,shot:noop,hit:noop},effects:{addFireSource(pos,r,dur,dmg){fires.push({pos,r,dur,dmg});},flashLight:noop,explosion:noop,tracer:noop,smokeBlocks:()=>false,blood:noop,impact:noop},entities:[],bots:[],makeNoise:noop,onKill(){g.deaths=(g.deaths||0)+1;},mode:{spawnPoint:()=>({pos:V(-10,0,0)})}};
 const p=g.player=new Player(g,{pos:V()});p.ws.fullAmmo=()=>{g.replenished=true;};p.hp=100;g.entities=[p];const a=g.abilities=new Abilities(g);return {g,p,a,boxes,fires};
}
assert.equal(SKILLS.length,4);assert.deepEqual(SKILLS.map(s=>s.id),['dash','incendiary','support','recon']);
{
 const {a,p,boxes}=fixture();boxes.push({x0:-3,x1:3,y0:0,y1:3,z0:-2,z1:-1.8});assert.equal(a.use('dash',{fwd:true}),true);assert(p.pos.z>-1.8,'dash stays on near side of wall');assert.equal(a.use('dash',{fwd:true}),false,'cooldown gates repeated dash');assert.equal(p.protectedUntil,1.5,'dash never changes protection');
}
{
 const {a,p,g}=fixture();assert(a.use('support'));assert.equal(p.hp,185);assert(g.replenished);assert(!a.use('support'));a.update(28,{});assert(a.use('support'));
 const enemy={alive:true,team:'B',pos:V(10,0,0),revealT:0},far={alive:true,team:'B',pos:V(100,0,0),revealT:0};g.bots=[enemy,far];assert(a.use('recon'));assert.equal(enemy.revealT,6);assert.equal(far.revealT,0);
}
{
 const {a,g,p,fires,boxes}=fixture();assert(a.use('incendiary'));assert.equal(a.projectiles.length,1);for(let i=0;i<80;i++){g.time+=.05;a.update(.05,{});}assert.equal(a.projectiles.length,0);assert.equal(fires.length,1);assert.equal(g.hazards.length,1);
 let damage=0;const center=fires[0].pos;g.entities.push({alive:true,targetable:true,team:'B',pos:center.clone().add(V(1,0,0)),chestPos:o=>o.copy(center).add(V(1,1.2,0)),takeDamage:d=>damage+=d});fires[0].dmg(1,fires[0]);assert.equal(damage,42);
 boxes.push({x0:center.x+.4,x1:center.x+.6,y0:0,y1:3,z0:center.z-3,z1:center.z+3});fires[0].dmg(1,fires[0]);assert.equal(damage,42,'fire does not hurt through wall');g.time+=8;a.update(.1,{});assert.equal(g.hazards.length,0);
}
{
 const {a,g,p}=fixture();assert(a.summon());assert.equal(g.entities.length,2);const idleShots=p.stats.shots;a.update(1,{fire:true});assert.equal(p.stats.shots,idleShots,'unpiloted mech never fires itself');assert.equal(a.summonCooldown,89);assert(!a.summon(),'only one live mech');assert(a.toggleMount());assert(a.mounted);assert.equal(p.targetable,false);assert.equal(p.mountedMech,a.mech);assert.equal(g.scopeState,null);assert(!a.use('support'),'skills disabled while piloting');
 const start=p.pos.clone();a.update(.1,{});assert(a.updatePlayer(.1,{fwd:true,mdx:0,mdy:0}));assert(p.pos.distanceTo(start)>.2);assert.equal(p.pos.y,0);assert.equal(g.camera.position.y,2.45);
 const shots=p.stats.shots;for(let i=0;i<70;i++){g.time+=.05;a.update(.05,{fire:true});a.updatePlayer(.05,{fire:true});}assert(p.stats.shots>shots);assert(a.mech.overheated);const stopped=p.stats.shots;a.updatePlayer(.01,{fire:true});assert.equal(p.stats.shots,stopped,'overheat prevents fire');
 const beforeHP=p.hp;a.mech.takeDamage(800,{attacker:{team:'B',pos:V(5,0,0)}});assert(!a.mounted);assert(!a.mech.alive);assert(p.targetable);assert.equal(p.mountedMech,null);assert.equal(p.hp,beforeHP-75);assert.equal(g.entities.length,1);assert(!a.summon(),'destroying mech does not bypass recall cooldown');a.dispose();assert.equal(g.hazards.length,0);
}
{
 const {a,p,g}=fixture();a.summon();a.toggleMount();p.hp=50;a.mech.takeDamage(999,{attacker:{pos:V(1,0,0)}});assert(!p.alive);assert.equal(g.deaths,1);assert(!a.mounted);assert(p.targetable,'destroyed mech does not leave hidden player');
}
{
 const {a,g,p}=fixture();a.summon();a.toggleMount();const hp=a.mech.hp;p.takeDamage(100,{attacker:{pos:V(5,0,0)}});assert.equal(a.mech.hp,hp-100,'direct hazard routes to mech armor');assert.equal(p.hp,100);assert(a.toggleMount());assert(p.targetable);assert(!p.mountedMech);assert(a.mech.alive);assert(a.mech.mesh.visible);a.dispose();assert.equal(g.entities.length,1);assert.equal(g.scene.children.length,0);
}
console.log('PASS abilities: four cooldown skills; collision-safe dash; healing/ammo; scan radius; throwable ground fire / wall occlusion / hazard expiry; summon/mount/manual movement/fire/overheat/destroy/eject/death/direct damage/cleanup.');
