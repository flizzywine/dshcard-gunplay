import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('mf_profile', JSON.stringify({ xp: 1234, selClass: 4, classes: [{ primary: 'pkm', secondary: 'm1911' }], streaks: ['heli'] })));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8089');
  await page.waitForFunction(() => window.game?.state === 'menu', null, { timeout: 120000 });
  await page.getByText('武器装备', { exact: true }).click();
  assert.equal(await page.getByText('腾龙 / M870 / AWM / AT4 · 数字 1–4 或滚轮切换', { exact: true }).count(), 1);
  assert.equal(await page.getByText('枪匠', { exact: true }).count(), 0);
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByText('多人对战', { exact: true }).click();
  await page.getByRole('button', { name: '开始对局' }).click();
  await page.waitForFunction(() => game.state === 'play');
  const report = await page.evaluate(async () => {
    const { WEAPONS } = await import('/js/data.js');
    const { PhysicsWorld } = await import('/js/physics.js');
    const { World } = await import('/js/world.js');
    const g = game, pl = g.player, ws = pl.ws, V = pl.pos.constructor;
    g.renderer.setAnimationLoop(null); g.godMode = true;
    const check = (ok,msg) => { if (!ok) throw new Error(msg); };
    check(g.profile.xp === 1234 && g.profile.selClass === 0, 'legacy profile migration lost XP or kept old class');
    check(pl.perks.size === 0 && !pl.lethal && !pl.tactical, 'legacy equipment leaked into player');
    check(g.bots.every(b => b.weaponId === 'm4' && Object.keys(b.att).length === 0 && b.grenades === 0), 'NPC loadouts are not basic infantry');
    for (const b of g.bots) { b.respawn(b.pos.clone(),0); check(b.grenades === 0, 'NPC respawn restored grenade'); }
    const ids = ws.slots.map(w => w.id); check(ids.join() === 'm4,m870,l115,rpg', 'four weapon inventory missing');
    const shots = [];
    for (let i=0;i<4;i++) {
      g.input.pressed['Digit'+(i+1)] = true; const input = g.snapshotInput(); pl.update(1/60,input);
      check(ws.cur === i, 'hotkey did not select slot '+i);
      ws.state = 'idle'; ws.cool = 0; ws.cycleT = 0; const w = ws.w, before = w.mag;
      pl.update(1/60, { fire: true, firePressed: true, mdx: 0, mdy: 0 });
      check(w.mag === before - 1, w.id+' did not fire'); shots.push(w.id);
    }
    ws.state = 'idle'; pl.update(1/60,{ swapPressed: true, mdx: 0, mdy: 0 }); check(ws.cur === 0, 'wheel did not wrap four slots');
    ws.slots.forEach(w => { w.mag = 0; w.reserve = 0; }); pl.respawn(pl.pos.clone(),0);
    check(ws.slots.every(w => w.mag === w.stats.mag && w.reserve === w.stats.reserve), 'respawn failed to replenish all four weapons');
    // A wall only 25 cm in front of the camera must catch the rocket rather
    // than being skipped by a forward spawn offset. Use actual weapon firing.
    const originalWorld = g.world;
    const physics = new PhysicsWorld({ boxes: [{ x0:-5,x1:5,y0:0,y1:4,z0:-.3,z1:-.25 }] });
    g.world = Object.assign(Object.create(World.prototype), { physics });
    g.projectiles.forEach(p=>p.remove()); g.projectiles = []; g.entities = [pl];
    g.camera.position.set(0,2,0); g.camera.lookAt(0,2,-1); g.camera.updateMatrixWorld(true);
    ws.switchTo(3); ws.state = 'idle'; ws.cool = 0; ws.fire(); const rocket = g.projectiles[0];
    check(rocket?.type === 'rocket', 'launcher did not create rocket'); rocket.update(1/60);
    check(!rocket.alive && rocket.pos.z > -.31, 'rocket skipped point-blank wall');
    physics.dispose(); g.world = originalWorld;
    return { catalog: Object.keys(WEAPONS), inventory: ids, shots, npcWeapons: [...new Set(g.bots.map(b=>b.weaponId))], rocketWall: true, migration: true };
  });
  console.log('Four weapon arsenal', report);
  assert.deepEqual(report.catalog, ['m4','m870','l115','rpg']); assert.deepEqual(errors, []);
} finally { await browser.close(); }
