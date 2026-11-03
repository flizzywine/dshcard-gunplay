import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
await mkdir('output/playwright',{recursive:true});
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',args:['--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.BASE_URL||'http://127.0.0.1:8089')+'/weapon-preview.html');
  await page.waitForFunction(()=>document.body.dataset.ready||document.body.dataset.error,null,{timeout:60000});
  assert.equal(await page.locator('body').getAttribute('data-ready'),'true',await page.locator('#status').textContent());
  const stats=await page.evaluate(()=>({bones:weaponPreview.model.bones.length,meshes:weaponPreview.model.meshes.length,clips:Object.keys(weaponPreview.clips),frames:weaponPreview.clips.reload.userData.frameCount,duration:weaponPreview.clips.reload.duration,weights:weaponPreview.model.root.userData.maxInfluences}));
  assert.equal(stats.bones,46);assert.equal(stats.meshes,3);assert.equal(stats.frames,139);assert.equal(stats.duration,2.3);assert.ok(stats.weights<=4);
  await page.getByRole('button',{name:'暂停',exact:true}).click();
  const positions=[];
  for(const progress of [.05,.45,.72,.95]){
    await page.locator('#timeline').fill(String(progress));
    positions.push(await page.evaluate(()=>{
      weaponPreview.model.root.updateMatrixWorld(true);
      return ['b_magazine','L_palm'].map(n=>weaponPreview.model.bones.find(b=>b.name===n).matrixWorld.elements.slice(12,15));
    }));
    await page.screenshot({path:`output/playwright/unvanquished-reload-${progress}.png`});
  }
  const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  assert.ok(distance(positions[0][0],positions[1][0])>.02,'magazine did not move');
  assert.ok(distance(positions[0][1],positions[1][1])>.02,'support hand did not move');
  await page.getByRole('button',{name:'模型观察',exact:true}).click();
  assert.equal(await page.evaluate(()=>weaponPreview.mode),'orbit');
  await page.screenshot({path:'output/playwright/unvanquished-orbit.png'});
  await page.getByRole('button',{name:'第一人称',exact:true}).click();
  for(const name of ['开火 F','举枪','收枪','待机','换弹 R']){
    await page.getByRole('button',{name,exact:true}).click();
    assert.equal(await page.locator('#actions button.active').textContent(),name);
  }
  await page.locator('#speed').selectOption('0.5');await page.locator('#loop').uncheck();
  await page.getByRole('button',{name:'换弹 R',exact:true}).click();
  await page.waitForFunction(()=>weaponPreview.action.time>.1);
  assert.equal(await page.evaluate(()=>weaponPreview.action.loop),2200,'one-shot playback was not selected');
  assert.deepEqual(errors,[]);console.log('Unvanquished original-asset preview',stats,{handAndMagazineMove:true,views:true,controls:true});
}finally{await browser.close();}
