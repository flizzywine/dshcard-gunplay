import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
process.env.TEMP=process.env.TMP=path.resolve('output/tmp');fs.mkdirSync(process.env.TEMP,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.addInitScript(()=>{HTMLCanvasElement.prototype.requestPointerLock=()=>{};localStorage.setItem('mf_settings',JSON.stringify({quality:'medium'}));});
 await page.goto('http://127.0.0.1:8089/');await page.waitForFunction(()=>window.game?.state==='menu');
 const report=await page.evaluate(async()=>{
  const g=game;await g.startGame('mp',{map:'cracked',mode:'tdm',allies:0,enemies:1});g.renderer.setAnimationLoop(null);g.godMode=true;
  const {PhysicsWorld}=await import('/js/physics.js'),{World}=await import('/js/world.js'),{Bot}=await import('/js/ai.js'),{fireHitscan}=await import('/js/combat.js'),{computeStats}=await import('/js/data.js');
  const V=g.player.pos.constructor,pl=g.player,ws=pl.ws,oldWorld=g.world,oldEntities=g.entities,physics=new PhysicsWorld();
  g.world=Object.assign(Object.create(World.prototype),{physics});const damage=[];
  const actual=[];
  try{for(const id of ['m4','l115'])for(const distance of [5,50,100,200,500]){
   const target={alive:true,team:'B',pos:new V(0,0,-distance),anim:{crouch:0},hp:1000,hitTest:Bot.prototype.hitTest,chestPos:Bot.prototype.chestPos,eyePos:Bot.prototype.eyePos,takeDamage(d){this.hp-=d;return false;}};
   g.entities=[pl,target];const st=computeStats(id);
   const r=fireHitscan(g,pl,new V(0,1.4,0),new V(0,0,-1),st,st.name);
   damage.push({id,distance,damage:1000-target.hp,part:r.part,shotsToKill:Math.ceil(100/(1000-target.hp))});
  }
  g.settings.spreadScale=g.settings.recoilScale=0;pl.vel.set(0,0,0);pl.airT=0;
  const enemy=g.bots[0];enemy.maxHp=enemy.hp=1000;enemy.pos.set(0,0,-100);g.entities=[pl,enemy];
  for(const slot of [0,2]){ws.switchTo(slot);ws.state='idle';ws.cool=ws.cycleT=0;ws.adsT=1;g.camera.position.set(0,1.4,0);g.camera.lookAt(0,1.4,-100);g.camera.updateMatrixWorld(true);const before=enemy.hp;ws.fire();actual.push({name:ws.w.stats.name,damage:before-enemy.hp,maxHp:enemy.maxHp});}
  }finally{physics.dispose();g.world=oldWorld;g.entities=oldEntities;}
  ws.switchTo(3);ws.state='idle';ws.adsT=1;ws.updateViewmodel(0,{mdx:0,mdy:0});
  const at4={scope:g.scopeState,optic:ws.w.info.optic};ws.w.mag=0;ws.startReload();ws.stateT=ws.stateDur*.5;ws.updateViewmodel(0,{mdx:0,mdy:0});at4.replacement=!!ws.w.info.replacementTube;
  return {damage,actual,at4,mode:g.mode.type,spawn:pl.pos.toArray()};
 });
 console.log(JSON.stringify(report,null,2));fs.writeFileSync('output/playwright/combat-feedback.json',JSON.stringify(report,null,2));
 assert.ok(report.damage.find(d=>d.id==='m4'&&d.distance===100).shotsToKill<=4,'rifle should remain effective at battlefield distance');
 assert.equal(report.damage.find(d=>d.id==='l115'&&d.distance===500).shotsToKill,1,'AWM should reach a distant battlefield target');
 assert.ok(Math.abs(report.actual[0].damage-report.damage.find(d=>d.id==='m4'&&d.distance===100).damage)<.001,'actual weapon fire and AI damage must agree');
 assert.equal(report.at4.scope,'at4','AT4 needs a sight picture, not shoulder zoom alone');
 assert.equal(report.at4.replacement,true,'AT4 needs a visible replacement tube reload');
}finally{await browser.close();}
