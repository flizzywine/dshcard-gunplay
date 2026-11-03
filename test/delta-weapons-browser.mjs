import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
const out=path.resolve('output/playwright');fs.mkdirSync(out,{recursive:true});
process.env.TEMP=process.env.TMP=path.resolve('output/tmp');fs.mkdirSync(process.env.TEMP,{recursive:true});
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',args:['--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{HTMLCanvasElement.prototype.requestPointerLock=()=>{};localStorage.setItem('mf_settings',JSON.stringify({quality:'medium'}));});
 await page.goto(process.env.BASE_URL||'http://127.0.0.1:8089/');await page.waitForFunction(()=>window.game?.state==='menu');
 await page.getByText('武器装备',{exact:true}).click();await page.screenshot({path:path.join(out,'delta-arsenal.png')});
 await page.getByRole('button',{name:'返回',exact:true}).click();await page.getByText('多人对战',{exact:true}).click();await page.getByRole('button',{name:'开始对局'}).click();
 await page.waitForFunction(()=>game.state==='play',null,{timeout:120000});
 await page.evaluate(()=>{game.renderer.setAnimationLoop(null);game.godMode=true;document.getElementById('clickToPlay').classList.add('hidden');document.getElementById('announce').style.opacity=0;});
 const report=[];
 for(let i=0;i<4;i++){
  report.push(await page.evaluate(i=>{
   const g=game,ws=g.player.ws;g.effects.clear();ws.switchTo(i);ws.state='idle';ws.adsT=0;ws.cool=ws.cycleT=0;
   for(let t=0;t<60;t++)ws.update(1/60,{mdx:0,mdy:0});
   const w=ws.w;g.hud.update(0);g.composer.render(1/60);
   if(!w.info.delta||w.authored)throw Error('Old model in slot '+i);
   if(!w.group.children.every(c=>c.visible!==undefined))throw Error('Invalid model');
   return {id:w.id,name:w.stats.name,parts:w.info.group.children.length,mag:w.mag,reload:w.reloadStyle};
  },i));
  await page.screenshot({path:path.join(out,`delta-${i+1}-hip.png`)});
  await page.evaluate(()=>{const ws=game.player.ws;ws.state='idle';ws.adsT=1;ws.updateViewmodel(1/60,{mdx:0,mdy:0});game.hud.update(0);game.composer.render(1/60);});
  await page.screenshot({path:path.join(out,`delta-${i+1}-ads.png`)});
  await page.evaluate(()=>{
   const g=game,ws=g.player.ws,w=ws.w,before=w.mag;ws.state='idle';ws.cool=ws.cycleT=0;ws.adsT=0;ws.fire();
   if(w.mag!==before-1)throw Error('Did not fire '+w.id);
   const duration=60/w.stats.rpm;
   ws.cycleT=duration*.5;ws.updateViewmodel(0,{mdx:0,mdy:0});
   if(w.stats.fire==='pump'&&!(w.info.pump.position.z>.05))throw Error('Pump not moving');
   if(w.stats.fire==='bolt'&&!(w.info.bolt.position.z>w.boltRest.z+.04))throw Error('Bolt not moving');
   ws.cycleT=0;ws.state='idle';ws.startReload();ws.stateT=ws.stateDur*.5;ws.updateViewmodel(0,{mdx:0,mdy:0});g.hud.update(0);g.composer.render(1/60);
   if(w.id==='rpg'&&(w.info.loadedTube.visible||!w.info.replacementTube.visible||g.scopeState!==null))throw Error('AT4 tube exchange or scope exit missing');
  });
  await page.screenshot({path:path.join(out,`delta-${i+1}-reload.png`)});
  await page.evaluate(()=>{const ws=game.player.ws,w=ws.w;for(let t=0;t<600;t++)ws.update(1/60,{mdx:0,mdy:0});if(w.mag!==w.stats.mag||w.reserve!==w.stats.reserve-1)throw Error('Reload failed '+w.id);});
 }
 await page.evaluate(()=>{
   const ws=game.player.ws,w=ws.w;ws.state='idle';w.mag=0;w.reserve=2;ws.startReload();ws.stateT=ws.stateDur*.55;ws.updateViewmodel(0,{mdx:0,mdy:0});
   if(w.mag!==0||w.reserve!==2||!w.info.replacementTube.visible)throw Error('AT4 reload granted ammunition early');
   ws.switchTo(0);ws.switchTo(3);if(w.mag!==0||w.reserve!==2||w.info.replacementTube.visible||!w.info.loadedTube.visible)throw Error('AT4 cancellation did not restore its model');
   ws.state='idle';ws.startReload();ws.stateT=ws.stateDur*.5;ws.updateViewmodel(0,{mdx:0,mdy:0});game.player.respawn(game.player.pos.clone(),0);
   if(w.mag!==1||w.reserve!==3||w.info.replacementTube.visible||!w.info.loadedTube.visible)throw Error('AT4 respawn did not cancel its exchange');
 });
 assert.deepEqual(report.map(w=>w.name),['腾龙突击步枪','M870 霰弹枪','AWM 狙击步枪','AT4 火箭筒']);
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'delta-weapons-report.json'),JSON.stringify({weapons:report,errors},null,2));console.log(report);
}finally{await browser.close();}
