// Actual maps/player/projectiles through the standalone browser entry point.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:8089';
await mkdir('output/playwright', { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', e => { errors.push(e.message); console.error('Browser:', e.message); });
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
  await page.addInitScript(() => {
    localStorage.setItem('mf_settings', JSON.stringify({ quality: 'medium' }));
    HTMLCanvasElement.prototype.requestPointerLock = () => Promise.resolve();
  });
  await page.goto(base);
  await page.waitForFunction(() => window.game?.state === 'menu', null, { timeout: 120000 });
  await page.evaluate(() => game.menu.showLobby());
  await page.getByRole('button', { name: '开始对局' }).click();
  await page.waitForFunction(() => game.state === 'play');
  const gameplay = await page.evaluate(async () => {
    const { Projectile } = await import('/js/combat.js');
    const { MAPS } = await import('/js/maps.js');
    const { PhysicsWorld } = await import('/js/physics.js');
    const g = game, w = g.world, pl = g.player;
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const dt = 1 / 60, input = { mdx: 0, mdy: 0 };
    // Drive the real Player, including jumps and stance transitions.
    pl.pos.copy(w.spawns.A[0]); pl.vel.set(0, 0, 0);
    let jumped = false;
    for (let i = 0; i < 90; i++) {
      w.physics.step(dt); pl.update(dt, { ...input, jumpPressed: i === 10 });
      if (pl.vel.y > 1) jumped = true;
    }
    check(jumped && pl.onGround, 'real Player failed to jump and land');
    pl.update(dt, { ...input, pronePressed: true });
    for (let i = 0; i < 45; i++) pl.update(dt, input);
    check(pl.prone && pl.physicsBody.height < 0.61, 'real Player failed to go prone');
    pl.update(dt, { ...input, pronePressed: true });
    for (let i = 0; i < 45; i++) pl.update(dt, input);
    check(!pl.prone && pl.physicsBody.height > 1.79, 'real Player failed to stand');
    const thrown = [];
    for (const type of ['frag', 'semtex', 'molotov', 'flash', 'smoke']) {
      const p = pl.pos.clone(); p.y += 2;
      const projectile = new Projectile(g, type, p, pl.vel.clone().set(0, -2, 0), pl, type === 'semtex' ? 3 : type === 'molotov' ? 99 : 0.8);
      for (let i = 0; i < 120 && projectile.alive; i++) { w.physics.step(dt); projectile.update(dt); }
      if (type === 'semtex') check(projectile.stuck && projectile.bounces > 0, 'semtex did not stick');
      else if (type === 'smoke') check(projectile.smoking, 'smoke did not activate');
      else check(!projectile.alive, type + ' failed to detonate');
      projectile.remove(); thrown.push(type);
      check(w.physics.projectiles.size === 0, type + ' leaked a physics body');
    }
    // Drive a production Bot against a stair and thin wall, independently of
    // its tactical choice of direction. Its actual update/stance/lifecycle run.
    const actor = g.bots[0], oldBody = actor.physicsBody, oldPosition = actor.pos.clone();
    const oldBehavior = actor.behave, oldPerceive = actor.perceive, oldStatic = actor.static;
    const aiWorld = new PhysicsWorld({ boxes: [
      { x0: -10, x1: 10, y0: -1, y1: 0, z0: -10, z1: 10 },
      { x0: 0, x1: 3, y0: 0, y1: 0.3, z0: -2, z1: 2 },
      { x0: 4, x1: 4.04, y0: 0, y1: 3, z0: -10, z1: 10 },
    ] });
    let aiPeak = 0;
    try {
      oldBody.disable();
      actor.physicsBody = aiWorld.createCharacter({ x: -2, y: 0.02, z: 0 }, actor.radius, 1.955);
      actor.respawn(actor.pos.clone().set(-2, 0.02, 0), 0); actor.static = false;
      actor.perceive = () => {}; actor.behave = (_dt, desired) => desired.set(5, 0, 0);
      for (let i = 0; i < 180; i++) {
        aiWorld.step(dt); actor.update(dt); aiPeak = Math.max(aiPeak, actor.pos.y);
      }
      check(aiPeak > 0.28, 'real Bot failed to climb the step');
      check(actor.pos.x > 3.2 && actor.pos.x < 3.51, 'real Bot failed to stop at the thin wall');
      for (let i = 0; i < 3; i++) {
        actor.die({ dir: actor.vel.clone().set(1, 0, 0), attacker: null, weapon: 'test' });
        actor.respawn(actor.pos.clone().set(-2, 0.02, 0), 0);
        aiWorld.step(dt); actor.update(dt);
        check(aiWorld.characters.size === 1, 'Bot respawn leaked a controller');
      }
      actor.static = true; actor.respawn(actor.pos.clone().set(1, 0.315, 0), 0);
      const sentryPosition = actor.pos.clone();
      for (let i = 0; i < 60; i++) { aiWorld.step(dt); actor.update(dt); }
      check(actor.pos.distanceTo(sentryPosition) < 0.001, 'static sentry drifted');
      actor.physicsBody.dispose(); check(aiWorld.characters.size === 0, 'Bot cleanup leaked a controller');
    } finally {
      aiWorld.dispose(); actor.physicsBody = oldBody; actor.pos.copy(oldPosition);
      oldBody.reset(oldPosition, 1.955); actor.behave = oldBehavior; actor.perceive = oldPerceive; actor.static = oldStatic;
    }
    const maps = [];
    for (const map of Object.keys(MAPS)) {
      await g.startGame('mp', { map, mode: 'tdm', bots: 2 });
      g.renderer.setAnimationLoop(null);
      for (let i = 0; i < 90; i++) { g.world.physics.step(dt); g.player.update(dt, input); }
      check(Number.isFinite(g.player.pos.y) && g.player.onGround, map + ': player did not settle');
      check(g.world.physics.characters.size === 1 + g.bots.length, map + ': leaked character controller');
      maps.push(map);
    }
    return { jumped, stances: true, thrown, ai: { step: aiPeak > 0.28, wall: true, respawns: 3, sentry: true }, maps };
  });
  console.log('Gameplay', JSON.stringify(gameplay));
  await page.goto(base + '/physics-lab.html');
  await page.locator('body[data-ready=true]').waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: '低洞与趴下' }).click();
  await page.locator('body').press('z');
  await page.waitForFunction(() => window.physicsLab.height === 0.6);
  await page.locator('body').press('e');
  await page.waitForFunction(() => window.physicsLab.balls === 1);
  await page.screenshot({ path: 'output/playwright/physics-lab.png' });
  await page.keyboard.down('w');
  await page.waitForFunction(() => physicsLab.position.z < 0, null, { timeout: 6000 });
  await page.keyboard.up('w');
  await page.locator('body').press('z');
  assert.equal(await page.evaluate(() => physicsLab.height), 0.6, 'standing under the tunnel must be rejected');
  await page.getByRole('button', { name: '薄墙与突进' }).click();
  await page.keyboard.down('w'); await page.keyboard.press('Shift');
  await page.waitForFunction(() => physicsLab.position.z < -1.2, null, { timeout: 3000 });
  await page.keyboard.up('w');
  assert.ok(await page.evaluate(() => physicsLab.position.z > -1.7), 'lab dash crossed the thin wall');
  assert.deepEqual(errors, []);
  console.log('PASS: real player, five throwable types, all maps, cleanup and lab controls.');
} finally { await browser.close(); }
