import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
await mkdir('output/playwright', { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('mf_settings', JSON.stringify({ quality: 'medium' }));
    HTMLCanvasElement.prototype.requestPointerLock = () => Promise.resolve();
  });
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8089');
  await page.waitForFunction(() => window.game?.state === 'menu', null, { timeout: 120000 });
  await page.evaluate(() => game.menu.showLobby());
  await page.locator('[data-map="karkand"]').click();
  await page.getByRole('button', { name: '开始对局' }).click();
  await page.waitForFunction(() => game.state === 'play', null, { timeout: 120000 });
  const report = await page.evaluate(() => {
    const g = game, w = g.world; g.renderer.setAnimationLoop(null); g.godMode = true;
    const positions = new Map(g.bots.map(b => [b, b.pos.clone()]));
    const starts = g.bots.map(b => b.pos.clone()); let travel = 0, minY = Infinity, worstFrameMs = 0;
    const start = performance.now();
    for (let i = 0; i < 5400; i++) {
      const time = performance.now(); g.update(1 / 60, g.snapshotInput());
      worstFrameMs = Math.max(worstFrameMs, performance.now() - time);
      for (const b of g.bots) {
        minY = Math.min(minY, b.pos.y); const old = positions.get(b), d = old.distanceTo(b.pos);
        if (d < 1) travel += d; old.copy(b.pos);
      }
    }
    if (!g.player.onGround) throw new Error('Player did not settle');
    if (minY < 15) throw new Error('Bot fell out of playable terrain');
    if (w.physics.characters.size !== g.bots.length + 1) throw new Error('Character leak');
    g.paused = false; g.input.keys.KeyM = true; g.hud.drawTacticalMap();
    const tactical = g.hud.tacticalEl.style.display === 'flex'; g.input.keys.KeyM = false; g.hud.drawTacticalMap();
    return { map: w.def.id, nodes: w.navigation.nodes.length, bots: g.bots.length, travel: Math.round(travel), displaced: g.bots.filter((b, i) => b.pos.distanceTo(starts[i]) > 10).length, kills: g.mode.scores.A + g.mode.scores.B, minY, tactical, simulationMs: Math.round(performance.now() - start), worstFrameMs: Math.round(worstFrameMs) };
  });
  console.log('Karkand browser', report);
  assert.equal(report.map, 'karkand'); assert.ok(report.travel > 500); assert.ok(report.displaced >= 6); assert.ok(report.tactical);
  // Turn off all screen overlays for geometry inspection, retaining the real map meshes.
  await page.addStyleTag({ content: 'body > :not(#app){visibility:hidden!important}' });
  for (const [name, position, target] of [
    ['overview', [0, 380, 15], [0, 32, 0]],
    ['city', [-55, 44, 45], [-40, 38, -10]],
    ['bridge', [100, 35.3, -135.7376], [155, 35, -135.7376]],
    ['industrial', [220, 40, -80], [215, 34, -120]],
  ]) {
    await page.evaluate(([position, target, name]) => {
      const g = game;
      if (name === 'industrial') {
        const path = g.world.findPath(g.world.points.industrial, g.world.points.bridge);
        const eye = path[0].clone(); eye.y += 1.65;
        const look = path[Math.min(10, path.length - 1)].clone(); look.y += 1.65;
        g.camera.position.copy(eye); g.camera.lookAt(look);
      } else { g.camera.position.set(...position); g.camera.lookAt(...target); }
      g.renderer.toneMappingExposure = 0.85; g.renderer.render(g.scene, g.camera);
    }, [position, target, name]);
    await page.screenshot({ path: `output/playwright/karkand-${name}.png` });
  }
  for (const mode of ['tdm']) {
    const result = await page.evaluate(async mode => {
      await game.startGame('mp', { map: 'karkand', mode, allies: 1, enemies: 2 }); game.renderer.setAnimationLoop(null);
      for (let i = 0; i < 90; i++) game.update(1 / 60, game.snapshotInput());
      return { grounded: game.player.onGround, flags: game.mode.flags?.length, span: game.world.flagPos[0].distanceTo(game.world.flagPos[2]), characters: game.world.physics.characters.size, expected: game.bots.length + 1 };
    }, mode);
    assert.ok(result.grounded); assert.equal(result.characters, result.expected); assert.ok(result.span > 250);
  }
  await page.evaluate(async () => { await game.startGame('mp', { map: 'dust2', mode: 'tdm', allies: 0, enemies: 1 }); game.renderer.setAnimationLoop(null); });
  assert.deepEqual(errors, []);
  console.log('Karkand TDM, map switching, tactical map, rendering: passed');
} finally { await browser.close(); }
