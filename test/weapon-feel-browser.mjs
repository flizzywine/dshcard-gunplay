import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('output/playwright', { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({viewport:{width:1280,height:800}}); const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8089');
  await page.waitForFunction(()=>window.game?.state==='menu',null,{timeout:120000});
  await page.evaluate(()=>game.menu.showLobby());
  await page.getByRole('button',{name:'开始对局'}).click();
  await page.waitForFunction(()=>game.state==='play');
  const report = await page.evaluate(async()=>{
    const THREE=await import('three'), g=game, pl=g.player, ws=pl.ws;
    g.renderer.setAnimationLoop(null); g.godMode=true; pl.vel.set(0,0,0); pl.airT=0; pl.crouchT=0;
    g.settings.spreadScale=0; g.settings.recoilScale=0;
    const input={mdx:0,mdy:0,ads:false,fire:false};
    ws.switchTo(0); ws.state='idle';
    pl.resetAim();
    for(let i=0;i<60;i++)pl.update(1/60,{...input,adsPressed:i===0});
    const rifle={optic:ws.w.info.optic,zoom:ws.w.stats.zoom,ads:ws.adsT,fov:g.camera.fov};
    ws.switchTo(1); ws.state='idle'; ws.adsT=0; ws.shotsInRow=0;
    const rays=[], original=g.world.raycast;
    g.world.raycast=function(o,d,len){rays.push(new THREE.Vector3().copy(d)); return original.call(this,o,d,len);};
    try{ws.fire();}finally{g.world.raycast=original;}
    const pelletRays=rays.slice(0,ws.w.stats.pellets), cone=Math.max(...pelletRays.map(d=>d.angleTo(g.camera.getWorldDirection(new THREE.Vector3()))));
    const shotgun={pellets:pelletRays.length,cone,spread:ws.currentSpread()};
    const { PhysicsWorld } = await import('/js/physics.js');
    const { World } = await import('/js/world.js');
    const { Bot } = await import('/js/ai.js');
    const originalWorld=g.world, originalEntities=g.entities;
    const physics=new PhysicsWorld(); g.world=Object.assign(Object.create(World.prototype),{physics});
    const damage=[];
    try {
      g.camera.position.set(0,1.4,0); g.camera.lookAt(0,1.4,-1); g.camera.updateMatrixWorld(true);
      for(const distance of [5,25]) {
        const target={alive:true,team:'B',pos:new THREE.Vector3(0,0,-distance),anim:{crouch:0},hp:1000,
          hitTest:Bot.prototype.hitTest,chestPos:Bot.prototype.chestPos,eyePos:Bot.prototype.eyePos,
          takeDamage(d){this.hp-=d;return false;}};
        g.entities=[pl,target]; ws.shotsInRow=0; ws.adsT=0; ws.w.mag=6; ws.fire();
        damage.push({distance,damage:1000-target.hp});
      }
      ws.adsT=1; shotgun.adsSpread=ws.currentSpread(); shotgun.damage=damage;
    } finally {physics.dispose();g.world=originalWorld;g.entities=originalEntities;}
    ws.switchTo(3); ws.state='idle'; ws.adsT=0; ws.vmKick=0; ws.vmRot=0; ws.cycleT=0;
    pl.vel.set(0,0,0); ws.sway.set(0,0); ws.sprintT=0;
    const ray=new THREE.Raycaster(), frames=[];
    const occlusion=()=>{
      ws.pivot.updateMatrixWorld(true); g.vmCamera.updateMatrixWorld(true);
      let blocked=0;
      for(let y=-4;y<=4;y++)for(let x=-4;x<=4;x++){
        ray.setFromCamera(new THREE.Vector2(x*.05,y*.05),g.vmCamera);
        const hits=ray.intersectObject(ws.holder,true).filter(h=>{
          if(!h.object.isMesh||h.distance<g.vmCamera.near)return false;
          for(let o=h.object;o;o=o.parent)if(!o.visible)return false;
          return true;
        });
        if(hits.length)blocked++;
      }
      return blocked/81;
    };
    ws.updateViewmodel(0,input); const idle=occlusion();
    ws.w.mag=0; ws.startReload();
    for(let i=0;i<=20;i++){
      ws.stateT=ws.stateDur*i/20; ws.updateViewmodel(0,input);
      frames.push({progress:i/20,blocked:occlusion()});
    }
    // The production timer must also lower the launcher when reload starts
    // from full ADS, rather than relying on a hand-picked hip-fire pose.
    ws.state='idle';ws.w.mag=0;ws.adsT=1;ws.startReload();
    let adsPeak=0;
    for(let i=0;i<Math.ceil(ws.stateDur*120);i++){
      ws.update(1/120,input);
      if(ws.state==='reload'&&ws.stateT>.4)adsPeak=Math.max(adsPeak,occlusion());
    }
    const launcher={idle,peak:Math.max(...frames.map(f=>f.blocked)),adsPeak,frames};
    return {rifle,shotgun,launcher};
  });
  console.log(JSON.stringify({rifle:report.rifle,shotgun:report.shotgun,launcher:{idle:report.launcher.idle,peak:report.launcher.peak,adsPeak:report.launcher.adsPeak}}));
  await writeFile('output/playwright/weapon-feel.json',JSON.stringify(report,null,2));
  assert.deepEqual(errors,[]);
  const failures=[];
  if(report.rifle.optic!=='iron'||report.rifle.zoom<1.39||report.rifle.ads<.99||report.rifle.fov>=65)failures.push('authored rifle lost aimed zoom');
  if(report.shotgun.pellets!==9||report.shotgun.cone<.01)failures.push('shotgun pellets collapse into one ray with zero random spread');
  if(report.shotgun.adsSpread>report.shotgun.spread||report.shotgun.damage[0].damage<100||report.shotgun.damage[1].damage>=60)failures.push('shotgun lost its close-range damage / aimed grouping');
  if(report.launcher.peak>.2||report.launcher.adsPeak>.2)failures.push('launcher reload blocks central aiming area');
  assert.deepEqual(failures,[]);
  for(const [name,slot,progress] of [['rifle-holo-ads',0,null],['launcher-reload-mid',3,.5]]){
    await page.evaluate(([slot,progress])=>{
      const g=game,ws=g.player.ws; ws.switchTo(slot); ws.state='idle';ws.adsT=progress===null?1:0;ws.vmKick=0;ws.vmRot=0;ws.sprintT=0;ws.cycleT=0;
      if(progress!==null){ws.w.mag=0;ws.w.reserve=3;ws.startReload();ws.stateT=ws.stateDur*progress;}
      g.player.yaw=0;g.player.pitch=0;g.camera.position.copy(g.world.points.push_a||g.world.points.a||g.player.pos).add(new g.player.pos.constructor(0,1.6,0));g.camera.lookAt(g.camera.position.clone().add(new g.player.pos.constructor(0,0,-10)));
      ws.updateViewmodel(0,{mdx:0,mdy:0});g.menu.hide();g.hud.show(false);document.getElementById('clickToPlay').classList.add('hidden');g.composer.render();
    },[slot,progress]);
    await page.screenshot({path:`output/playwright/${name}.png`});
  }
} finally {await browser.close();}
