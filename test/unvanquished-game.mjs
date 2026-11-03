import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
await mkdir('output/playwright',{recursive:true});
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',args:['--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();localStorage.setItem('mf_settings',JSON.stringify({quality:'medium'}));});
  await page.goto(process.env.BASE_URL||'http://127.0.0.1:8089');
  await page.waitForFunction(()=>window.game?.state==='menu',null,{timeout:120000});
  await page.evaluate(async()=>{await game.startGame('mp',{map:'dust2',mode:'tdm',allies:1,enemies:2});game.renderer.setAnimationLoop(null);game.godMode=true;});
  const results=[];
  for(let index=0;index<4;index++){
    const idle=await page.evaluate(index=>{
      const g=game,p=g.player,ws=p.ws,check=(v,m)=>{if(!v)throw Error(m);};
      p.resetAim();ws.switchTo(index);for(let i=0;i<60;i++)g.update(1/60,g.snapshotInput());
      check(ws.cur===index&&ws.state==='idle','switch did not finish');
      const w=ws.w;check(!!w.authored,'legacy model in hero slot');
      g.hud.show(false);document.getElementById('clickToPlay').classList.add('hidden');g.composer.render();
      return {slot:index+1,model:w.authored.id,bones:w.authored.model.bones.length,name:w.stats.name};
    },index);
    await page.screenshot({path:`output/playwright/uv-game-${idle.model}-idle.png`});
    const result=await page.evaluate(()=>{
      const g=game,p=g.player,ws=p.ws,w=ws.w,check=(v,m)=>{if(!v)throw Error(m);};
      const input={mdx:0,mdy:0};const mag=w.mag,shots=p.stats.shots;
      p.update(1/60,{...input,fire:true,firePressed:true});check(w.mag===mag-1&&p.stats.shots===shots+1,'fire failed');
      p.update(1/60,input);check(w.authored.current==='fire','author fire animation missing');
      w.mag=0;w.reserve=2;ws.state='idle';ws.startReload();check(ws.state==='reload','reload did not start');
      ws.stateT=ws.stateDur*.05;ws.updateViewmodel(0,input);const before=w.authored.model.bones.map(b=>b.matrixWorld.elements.slice(12,15));
      ws.stateT=ws.stateDur*.5;ws.updateViewmodel(0,input);check(w.mag===0&&w.reserve===2,'ammo refilled before completion');
      check(w.authored.current==='reload','author reload animation missing');
      const moved=w.authored.model.bones.some((b,i)=>Math.hypot(...b.matrixWorld.elements.slice(12,15).map((x,k)=>x-before[i][k]))>.005);check(moved,'reload bones did not move');
      g.composer.render();return {reloadSeconds:ws.stateDur,moved};
    });
    await page.screenshot({path:`output/playwright/uv-game-${idle.model}-reload.png`});
    const completed=await page.evaluate(()=>{
      const g=game,p=g.player,ws=p.ws,w=ws.w,input={mdx:0,mdy:0};
      for(let i=0;i<180&&ws.state==='reload';i++){g.world.physics.step(1/60);p.update(1/60,input);}
      if(w.mag!==Math.min(2,w.stats.mag)||w.reserve!==2-w.mag)throw Error('reload failed ammo conservation');
      p.resetAim();for(let i=0;i<70;i++){g.world.physics.step(1/60);p.update(1/60,{...input,adsPressed:i===0});}
      if(ws.adsT<.99||g.camera.fov>=65)throw Error('ADS lost');
      if(w.stats.type==='sniper'&&g.scopeState!=='sniper')throw Error('precision scope missing');
      g.composer.render();return {mag:w.mag,ads:ws.adsT,fov:g.camera.fov,scope:g.scopeState};
    });
    await page.screenshot({path:`output/playwright/uv-game-${idle.model}-ads.png`});
    results.push({...idle,...result,...completed});
  }
  const interrupted=await page.evaluate(()=>{
    const g=game,p=g.player,ws=p.ws; p.resetAim();ws.switchTo(0);ws.state='idle';ws.w.mag=0;ws.w.reserve=8;ws.startReload();
    for(let i=0;i<30;i++)p.update(1/60,{mdx:0,mdy:0});
    ws.switchTo(1);for(let i=0;i<180;i++)p.update(1/60,{mdx:0,mdy:0});
    if(ws.slots[0].mag!==0||ws.slots[0].reserve!==8)throw Error('switch granted cancelled reload ammo');
    p.respawn(p.pos.clone(),0);for(let i=0;i<40;i++)p.update(1/60,{mdx:0,mdy:0});
    if(ws.slots.some(w=>w.mag!==w.stats.mag))throw Error('respawn lost ammo');return true;
  });
  assert.ok(interrupted);assert.deepEqual(errors,[]);console.log('Four authored weapons in game',results,{interruption:true,respawn:true});
}finally{await browser.close();}
