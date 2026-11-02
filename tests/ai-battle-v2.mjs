import assert from 'node:assert/strict';
import * as THREE from '../dist/lib/three.module.js';
import {World} from '../dist/js/world.js';
import {MAPS} from '../dist/js/maps.js';
import {Bot} from '../dist/js/ai.js';
import {mulberry32} from '../dist/js/util.js';
globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillStyle:''})})};
const random=Math.random;Math.random=mulberry32(177);
const noop=()=>{},counts={A:{shots:0,kills:0,reloads:0},B:{shots:0,kills:0,reloads:0}},respawns=[];
const game={scene:new THREE.Scene(),settings:{quality:'low'},time:0,bots:[],entities:[],noises:[],hazards:[],pathBudget:3,hud:{popup:noop},effects:{fires:[],smokeBlocks:()=>false,tracer:noop,flashLight:noop,blood:noop,impact:noop},audio:{step:noop,reload:noop,shot:noop},makeNoise:noop,onKill(k,v){if(k)counts[k.team].kills++;respawns.push({bot:v,at:game.time+5});}};
const world=new World(game,MAPS.jinqu);game.world=world;MAPS.jinqu.build(world);world.finalize();
const sector=MAPS.jinqu.sectors[0],objective=sector.objectives[0];
game.mode={type:'assault',commandGoal:()=>null,botGoal:bot=>objective.pos.clone().add(new THREE.Vector3(Math.cos(bot.id*2.4)*3,0,Math.sin(bot.id*2.4)*3))};
for(const [team,n] of [['A',9],['B',20]])for(let i=0;i<n;i++){
 const points=team==='A'?sector.attackSpawns:sector.defendSpawns;
 const bot=new Bot(game,{team,pos:points[i%points.length].clone(),yaw:team==='A'?-Math.PI/2:Math.PI/2,weaponId:'m4',role:'mp',easyEnemy:team==='B',difficulty:1});
 bot.routeSpawn=points[i%points.length].clone();game.bots.push(bot);game.entities.push(bot);
 const fire=bot.tryFire.bind(bot);bot.tryFire=(dt,t,d)=>{const mag=bot.mag;fire(dt,t,d);if(bot.mag<mag)counts[team].shots++;};
 const reload=bot.reload.bind(bot);bot.reload=()=>{if(!bot.reloadPending)counts[team].reloads++;reload();};
}
for(let frame=0;frame<4000;frame++){
 game.time+=.05;game.pathBudget=3;
 for(const bot of game.bots){bot.update(.05);assert(Number.isFinite(bot.pos.x)&&Number.isFinite(bot.pos.z),'nonfinite actor position');}
 for(let i=respawns.length-1;i>=0;i--)if(respawns[i].at<=game.time){const bot=respawns[i].bot;bot.respawn(bot.routeSpawn,bot.team==='A'?-Math.PI/2:Math.PI/2);respawns.splice(i,1);}
}
Math.random=random;
for(const team of ['A','B']){assert(counts[team].shots>50,`${team} failed to engage`);assert(counts[team].kills>0,`${team} failed basic combat`);assert(counts[team].reloads>0,`${team} never reloaded`);}
console.log('PASS 200s seeded actual-world infantry battle (9 allies vs20 enemies; no player or renderer):',JSON.stringify(counts));
console.log('This proves simulated basic engagement/reload/death/respawn, not graphical performance or final game difficulty.');
