import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8089');
  await page.waitForFunction(() => window.game?.state === 'menu', null, { timeout: 120000 });
  await page.evaluate(() => game.menu.showLobby());
  await page.getByRole('button', { name: '开始对局' }).click();
  await page.waitForFunction(() => game.state === 'play');
  const lab = await page.evaluate(async () => {
    const { PhysicsWorld } = await import('/js/physics.js');
    const { World } = await import('/js/world.js');
    const { protectedAt } = await import('/js/ai-cover.js');
    const g = game; g.renderer.setAnimationLoop(null); const originalWorld = g.world, originalBots = g.bots;
    const actor = g.bots[0], V = actor.pos.constructor;
    const boxes = [{ x0: 2, x1: 4, y0: 0, y1: 1.7, z0: -2, z1: -1.4 }];
    const physics = new PhysicsWorld({ boxes: [{ x0: -20, x1: 20, y0: -1, y1: 0, z0: -20, z1: 20 }, ...boxes] });
    const world = Object.assign(Object.create(World.prototype), { physics, boxes, half: 20, def: { size: 40 } }); world.buildGrid();
    const originalBody = actor.physicsBody;
    actor.physicsBody.disable(); actor.physicsBody = physics.createCharacter(new V(0, .025, 0), actor.radius, 1.955);
    g.world = world; g.bots = [actor]; actor.respawn(new V(0, .025, 0), 0);
    actor.perceive = () => {}; actor.behave = () => {}; actor.mag = 2; actor.lastSeenPos = new V(0, 0, -12);
    actor.lastSeenEye = new V(0, 1.8, -12); actor.lastSeenT = g.time; actor.static = false;
    let firstReload = null, violations = 0;
    for (let i = 0; i < Math.ceil((actor.stats.reload * 1.1 + 5) * 60); i++) {
      g.time += 1/60; g.pathBudget = 3; g.coverBudget = 2; physics.step(1/60); actor.update(1/60);
      if (actor.reloadT > 0 && actor.coverReload.state === 'reload') {
        firstReload ??= { moved: actor.pos.length(), crouch: actor.crouchT, mag: actor.mag };
        if (!protectedAt(world, actor, actor.pos, actor.lastSeenEye, actor.crouchT)) violations++;
      }
      if (actor.coverReload.stats.completed) break;
    }
    const result = { firstReload, violations, mag: actor.mag, capacity: actor.stats.mag, ...actor.coverReload.stats };
    actor.mag = 1; actor.reload(); actor.stun(2); actor.updateReload(5); result.stunMag = actor.mag;
    actor.reload(); actor.die({ dir: new V(0, 0, 1) }); actor.updateReload(5); result.deathMag = actor.mag;
    actor.respawn(new V(0, .025, 0), 0); result.respawn = actor.coverReload.state;
    physics.dispose(); actor.physicsBody = originalBody; g.world = originalWorld; g.bots = originalBots; return result;
  });
  console.log('Production Bot cover/reload', lab);
  assert.ok(lab.firstReload?.moved > 1); assert.ok(lab.firstReload.crouch > .7); assert.equal(lab.firstReload.mag, 2);
  assert.equal(lab.violations, 0); assert.equal(lab.completed, 1); assert.equal(lab.mag, lab.capacity);
  assert.equal(lab.stunMag, 1); assert.equal(lab.deathMag, 1); assert.equal(lab.respawn, 'idle');
  for (const map of ['dust2', 'karkand']) {
    const result = await page.evaluate(async map => {
      await game.startGame('mp', { map, mode: 'tdm', allies: 2, enemies: 3 }); game.renderer.setAnimationLoop(null); game.godMode = true;
      const g = game;
      // Low magazines plus genuine perception/memory exercise map-independent planning.
      g.bots.forEach(b => { b.mag = 2; b.hint(g.world.spawns[b.team === 'A' ? 'B' : 'A'][0]); });
      let worstMs = 0;
      for (let i = 0; i < 900; i++) { const start = performance.now(); g.update(1/60, g.snapshotInput()); worstMs = Math.max(worstMs, performance.now() - start); }
      return { map, searches: g.bots.reduce((n,b) => n+b.coverReload.stats.searches, 0), completed: g.bots.reduce((n,b) => n+b.coverReload.stats.completed, 0), worstMs: Math.round(worstMs), finite: g.bots.every(b => Number.isFinite(b.pos.y) && b.pos.y > -10), waiting: g.bots.filter(b => ['seek','search'].includes(b.coverReload.state)).length };
    }, map);
    console.log('Imported map cover smoke', result); assert.ok(result.searches > 0); assert.ok(result.finite); assert.equal(result.waiting, 0);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
