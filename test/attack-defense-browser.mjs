import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
process.env.TEMP=process.env.TMP=path.resolve('output/tmp');fs.mkdirSync(process.env.TEMP,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{HTMLCanvasElement.prototype.requestPointerLock=()=>{};localStorage.setItem('mf_settings',JSON.stringify({quality:'medium'}));});
 await page.goto('http://127.0.0.1:8089/');await page.waitForFunction(()=>window.game?.state==='menu');await page.getByText('多人对战',{exact:true}).click();
 assert.equal(await page.locator('[data-map="cracked"].sel').count(),1);assert.equal(await page.locator('[data-m="breakthrough"]:visible').count(),1);
 await page.screenshot({path:'output/playwright/attack-defense-lobby.png'});
 await page.evaluate(async()=>{await game.startGame('mp',{map:'cracked',mode:'breakthrough',allies:0,enemies:1});game.renderer.setAnimationLoop(null);game.godMode=true;document.getElementById('clickToPlay').classList.add('hidden');});
 const report=await page.evaluate(()=>{
  const g=game,m=g.mode,c=m.control,p=g.player,b=g.bots[0],w=g.world,checks=[];
  const check=(v,s)=>{if(!v)throw Error(s);checks.push(s);};
  check(m.type==='breakthrough'&&c.index===0,'initial A sector');
  check(m.activeSector.spawns.A.some(q=>q.distanceTo(p.pos)<.2),'player starts at authored A spawn');
  check(b.pos.distanceTo(m.activeSector.points[0].pos)<65,'defender starts at A rather than C');
  m.scores.A=50;m.update(.01,{});check(!m.over&&c.index===0,'kills cannot skip attack objectives');
  const respawnHere=()=>{const before=c.tickets;g.godMode=false;p.takeDamage(9999,{attacker:b,weapon:'test',dir:p.pos.clone().set(0,0,1)});g.godMode=true;check(c.tickets===before-1,'attacker death consumes one reinforcement');g.input.keys.Space=true;m.update(5,{});g.input.keys.Space=false;check(p.alive&&m.activeSector.spawns.A.some(q=>q.distanceTo(p.pos)<.2),'player respawns on current frontline');};
  respawnHere();
  for(let stage=0;stage<3;stage++)for(const team of ['A','B'])for(const s of c.sectors[stage].spawns[team])check(p.physicsBody.canFit(s,1.8),`safe ${stage} ${team} spawn`);
  const move=(e,pos)=>{e.pos.copy(pos);e.physicsBody.reset(e.pos);};
  move(b,c.active.points[0].pos.clone().add(new p.pos.constructor(0,0,-80)));
  move(p,c.sectors[2].points[0].pos);m.update(22,{});check(c.index===0&&c.sectors[2].points[0].progress===0,'C stays locked before A');
  move(p,c.active.points[0].pos);move(b,p.pos);m.update(2,{});check(c.active.points[0].contested&&c.active.points[0].progress===0,'actual defender contests A');
  move(b,p.pos.clone().add(new p.pos.constructor(0,0,-80)));m.update(20,{});check(c.index===1,'A capture advances to B');
  const forward=m.spawnPoint('A');check(c.active.spawns.A.some(q=>q.distanceTo(forward.pos)<.01),'B forward spawn unlocked');
  respawnHere();
  check(b.pos.distanceTo(c.active.spawns.B[0])<25,'living defenders retreat to B');
  move(b,c.active.points[0].pos.clone().add(new p.pos.constructor(0,0,-100)));
  move(p,c.active.points[0].pos);m.update(20,{});check(c.index===1&&c.active.points[0].captured,'B1 alone does not unlock C');
  move(p,c.active.points[1].pos);m.update(20,{});check(c.index===2,'B1 and B2 unlock C');
  move(b,c.active.points[0].pos.clone().add(new p.pos.constructor(0,0,-100)));
  move(p,c.active.points[0].pos);m.update(20,{});check(!m.over,'C1 alone does not win');
  move(p,c.active.points[1].pos);m.update(20,{});check(m.over&&c.winner==='A','C1 and C2 complete attack victory');
  return {checks,stage:c.index,tickets:c.tickets,winner:c.winner};
 });
 assert.deepEqual(errors,[]);fs.writeFileSync('output/playwright/attack-defense-report.json',JSON.stringify(report,null,2));console.log('Attack / defense',report);
 // Exercise ordinary AI movement with the actual sector goals and collision.
 const simulation=await page.evaluate(async()=>{
  const g=game;await g.startGame('mp',{map:'cracked',mode:'breakthrough',allies:5,enemies:6});g.renderer.setAnimationLoop(null);g.godMode=true;
  const start=g.bots.map(b=>b.pos.clone());let minY=Infinity;
  for(let f=0;f<1800;f++){g.update(1/60,g.snapshotInput());for(const b of g.bots)minY=Math.min(minY,b.pos.y);}
  const moving=g.bots.filter((b,i)=>b.pos.distanceTo(start[i])>5).length;
  if(moving<4||minY<-45)throw Error('AI did not reach the current frontline safely');
  document.getElementById('clickToPlay').classList.add('hidden');g.hud.update(0);g.composer.render(1/60);
  if(g.menu.screen==='results')throw Error('Previous match result timer interrupted the new attack');
  return {moving,minY,stage:g.mode.activeSector.label,markers:g.hud.markerList.map(p=>p.label)};
 });
 await page.screenshot({path:'output/playwright/attack-defense-gameplay.png'});assert.notEqual(await page.evaluate(()=>game.menu.screen),'results','old match results must not interrupt a new match');console.log('Frontline simulation',simulation);assert.deepEqual(errors,[]);
}finally{await browser.close();}
