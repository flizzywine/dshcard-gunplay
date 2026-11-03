import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',args:['--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try {
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});
  await page.goto(process.env.BASE_URL||'http://127.0.0.1:8089');
  await page.waitForFunction(()=>window.game?.state==='menu',null,{timeout:120000});
  const results=await page.evaluate(async()=>{
    await game.startGame('mp',{map:'dust2',mode:'tdm',allies:0,enemies:1});
    const g=game,p=g.player,ws=p.ws;g.renderer.setAnimationLoop(null);
    const enemy=g.bots[0],results=[];
    const check=(ok,message)=>{if(!ok)throw Error(message);};
    for(const action of ['switch','reload']){
      g.godMode=false;ws.switchTo(0);ws.state='idle';ws.switchTo(3);
      if(action==='reload'){ws.state='idle';ws.w.mag=0;ws.w.reserve=3;ws.startReload();}
      check(ws.state===action,'fixture not in '+action);
      p.takeDamage(9999,{attacker:enemy,weapon:'M4A1',head:true,dir:p.pos.clone().set(0,0,1)});
      check(g.dead&&!p.alive&&g.mode.respawns.some(r=>r.e===p),'death did not schedule respawn');
      g.godMode=true; const time=g.time,remaining=g.mode.timeLeft;
      for(let i=0;i<285;i++){g.input.keys.Space=i>=280;g.update(1/60,g.snapshotInput());}
      g.input.keys.Space=false;
      check(p.alive&&!g.dead,'player did not respawn after '+action);
      check(g.time>time+4&&g.mode.timeLeft<remaining-4,'simulation stopped after death');
      check(document.getElementById('deathScreen').classList.contains('hidden'),'death overlay did not close');
      check(ws.slots.every(w=>w.mag===w.stats.mag),'respawn failed to reset ammunition');
      check(!g.mode.respawns.some(r=>r.e===p),'respawn queue leaked player');
      results.push({action,alive:p.alive,deathCount:p.stats.deaths,characters:g.world.physics.characters.size});
    }
    return results;
  });
  console.log('Player death during launcher switch/reload',results);assert.deepEqual(errors,[]);
}finally{await browser.close();}
