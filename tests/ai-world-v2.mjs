import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {World} from '../dist/js/world.js';
import {MAPS} from '../dist/js/maps.js';
import {Bot} from '../dist/js/ai.js';
globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillStyle:''})})};
const noop=()=>{};
const game={scene:new THREE.Scene(),settings:{quality:'low'},time:0,bots:[],entities:[],noises:[],hazards:[],pathBudget:3,hud:{popup:noop},effects:{fires:[],smokeBlocks:()=>false},audio:{step:noop,reload:noop},onKill:noop};
const world=new World(game,MAPS.jinqu);game.world=world;MAPS.jinqu.build(world);world.finalize();
let completed=0,slowest=0;
for(const sector of MAPS.jinqu.sectors)for(const objective of sector.objectives){
 game.mode={type:'assault',botGoal:()=>objective.pos.clone(),commandGoal:()=>null};game.bots=[];game.entities=[];
 // All attack/defense spawn routes: actual Bot.update uses real A*, smoothing and collision.
 for(const [index,pos] of [...sector.attackSpawns,...sector.defendSpawns].entries()) {
  const bot=new Bot(game,{team:'A',pos:pos.clone(),weaponId:'m4',role:'mp',name:`route ${index}`});game.bots.push(bot);game.entities.push(bot);
 }
 for(let frame=0;frame<1800;frame++){game.time+=.05;game.pathBudget=3;for(const bot of game.bots){bot.update(.05);if(bot.arrivedAt===undefined&&Math.hypot(bot.pos.x-objective.pos.x,bot.pos.z-objective.pos.z)<5)bot.arrivedAt=frame*.05;}}
 for(const bot of game.bots){const d=Math.hypot(bot.pos.x-objective.pos.x,bot.pos.z-objective.pos.z);assert(d<5,`${objective.id}: bot at ${bot.pos.x.toFixed(1)},${bot.pos.z.toFixed(1)} stopped ${d.toFixed(1)}m away`);assert(world.walkable(...world.cellOf(bot.pos.x,bot.pos.z)));assert(bot.arrivedAt<40,`slow route ${objective.id}: ${bot.arrivedAt}s`);slowest=Math.max(slowest,bot.arrivedAt);bot.dispose();completed++;}
}
console.log(`PASS actual-world AI: ${completed} attack/defense routes reach five objective areas through real World paths/collision; slowest first arrival ${slowest.toFixed(1)}s; no enemies or renderer in this navigation simulation.`);
