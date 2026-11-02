import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {World} from '../dist/js/world.js';
import {MAPS} from '../dist/js/maps.js';
globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillStyle:''})})};
const game={scene:new THREE.Scene(),settings:{quality:'low'},bots:[{path:[1],pathT:0}],hud:{popup(){}}};
const world=new World(game,MAPS.jinqu);game.world=world;MAPS.jinqu.build(world);world.finalize();
let routes=0;
for(const sector of MAPS.jinqu.sectors){
 for(const objective of sector.objectives){
  assert(world.walkable(...world.cellOf(objective.pos.x,objective.pos.z)),`${objective.id} objective must be on navigable ground`);
  for(const spawn of [...sector.attackSpawns,...sector.defendSpawns]){
   assert(world.walkable(...world.cellOf(spawn.x,spawn.z)),`spawn blocked: ${spawn.x},${spawn.z}`);
   const path=world.findPath(spawn,objective.pos);assert(path?.length,`unreachable ${objective.id} from ${spawn.x},${spawn.z}`);
   for(const p of path)assert(world.walkable(...world.cellOf(p.x,p.z)),`path inside collider ${p.x},${p.z}`);
   let previous=spawn.clone();
   for(const next of path){
    const length=previous.distanceTo(next),count=Math.max(1,Math.ceil(length/.3));
    for(let i=1;i<=count;i++){
     const sample=previous.clone().lerp(next,i/count),after=sample.clone();
     world.collide(after,new THREE.Vector3(),.35,1.7);
     assert(after.distanceTo(sample)<.08,`nav segment clips collider ${objective.id}: ${sample.x},${sample.z}`);
    }
    previous=next;
   }
   routes++;
  }
 }
}
for(const point of world.points.routeChecks){const p=world.findPath(new THREE.Vector3(-92,0,25),point);assert(p?.length,`flank unreachable ${point.x},${point.z}`);routes++;}
// A rocket breach must alter actual geometry/collision/navigation, not merely its label.
const part=world.destructibles.find(p=>Math.abs(p.box.x0-82.25)<.01&&p.box.z0===-41);
assert(part,'warehouse breach panel');
const a=new THREE.Vector3(80,1.5,-39),b=new THREE.Vector3(85,1.5,-39);
assert(world.lineBlocked(a,b));
const oldRevision=world.navRevision;
assert(world.damageDestructibles(new THREE.Vector3(82.5,1.5,-39),7,240)>=1);
assert(!world.lineBlocked(a,b),'breach still blocks LOS');
assert(!world.boxes.includes(part.box));assert(!world.root.children.includes(part.mesh));
assert.equal(world.navRevision,oldRevision+1);assert.equal(game.bots[0].path,null);
assert(world.findPath(a,b)?.length,'breach not pathable');
// Stair treads climb within the controller's 0.45m step budget to the A high route.
let height=0;for(let z=42.2;z<=56;z+=.2)height=world.groundHeight(-68,z,height,.35);
assert(height>=3,'A southern high route inaccessible');
// Camp roof and connected shanty roofs remain optional player traversal, not bot objectives.
height=0;for(let z=-47;z<=-34;z+=.1)height=world.groundHeight(-15,z,height,.35);
assert(height>=3.59,'camp roof ramp inaccessible');
height=0;for(let z=2.5;z<=18;z+=.1)height=world.groundHeight(-5,z,height,.35);
assert(height>=3.79,'B2 first roof inaccessible');
for(let x=-5;x<=17;x+=.1)height=world.groundHeight(x,18,height,.35);
assert(height>=4.79,'B2 connected roof bridge inaccessible');
height=0;for(let z=52;z>=34;z-=.1)height=world.groundHeight(57,z,height,.35);
assert(height>=4.4,'C2 scaffold inaccessible');
console.log(`PASS map: ${routes} spawn/objective/flank paths; all five ground objectives; breach mesh/collision/LOS/nav removal; A elevated stair route`);
console.log(`Map metrics: ${world.boxes.length} colliders, ${world.destructibles.length} breach panels, ${world.root.children.length} regional/detail meshes; not an FPS benchmark.`);
