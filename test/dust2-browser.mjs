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
  await page.locator('[data-map="dust2"]').click();
  await page.getByRole('button', { name: '开始对局' }).click();
  await page.waitForFunction(() => game.state === 'play', null, { timeout: 60000 });
  const report = await page.evaluate(() => {
    const g = game, w = g.world; g.renderer.setAnimationLoop(null); g.godMode = true;
    const start = g.bots.map(b => b.pos.clone()), minimum = new Map(g.bots.map(b => [b, b.pos.y]));
    const positions = new Map(g.bots.map(b => [b, b.pos.clone()])); let travel = 0;
    for (let i = 0; i < 1800; i++) {
      g.update(1 / 60, g.snapshotInput());
      for (const b of g.bots) { minimum.set(b, Math.min(minimum.get(b), b.pos.y)); const old = positions.get(b); const d = old.distanceTo(b.pos); if (d < 1) travel += d; old.copy(b.pos); }
    }
    if (!g.player.onGround) throw new Error('Player did not settle');
    if ([...minimum.values()].some(y => y < 1)) throw new Error('Bot fell out of map');
    if (w.physics.characters.size !== 1 + g.bots.length) throw new Error('Character leak');
    return { map: w.def.id, floors: w.navigation.nodes.length, bots: g.bots.length, travel: Math.round(travel), displaced: g.bots.filter((b, i) => b.pos.distanceTo(start[i]) > 5).length, kills: g.mode.scores.A + g.mode.scores.B };
  });
  console.log('Dust II browser', report);
  assert.equal(report.map, 'dust2'); assert.ok(report.travel > 150); assert.ok(report.displaced >= 5);
  assert.ok(await page.evaluate(() => {
    game.paused = false; game.input.keys.KeyM = true; game.hud.drawTacticalMap();
    const shown = game.hud.tacticalEl.style.display === 'flex';
    game.input.keys.KeyM = false; game.hud.drawTacticalMap(); return shown;
  }), 'Dust II tactical map');
  // Capture clear geometry views without the pointer-lock pause overlay.
  for (const [name, position, target] of [
    ['overview', [0, 105, 5], [0, 6, 0]],
    ['a', [37, 16, -32], [25, 13, -37]],
    ['b', [-45, 13, -34], [-35, 11, -43]],
    ['mid', [-8, 9, -9], [-11, 8, -24]],
    ['tunnels', [-40, 12, -5], [-40, 11, -13]],
  ]) {
    await page.evaluate(([position, target, name]) => {
      const g = game; g.hud.show(false);
      document.getElementById('clickToPlay').classList.add('hidden');
      document.getElementById('deathScreen').classList.add('hidden');
      if (name === 'mid' || name === 'tunnels') {
        const w = g.world, start = w.points[name], end = w.points[name === 'mid' ? 'B' : 'mid'];
        const path = w.findPath(start, end), eye = path[0].clone(); eye.y += 1.65;
        const look = path[Math.min(6, path.length - 1)].clone(); look.y += 1.65;
        g.camera.position.copy(eye); g.camera.lookAt(look);
      } else { g.camera.position.set(...position); g.camera.lookAt(...target); }
      g.renderer.toneMappingExposure = 0.85;
      g.renderer.render(g.scene, g.camera);
    }, [position, target, name]);
    await page.screenshot({ path: `output/playwright/dust2-${name}.png` });
  }
  for (const mode of ['tdm']) {
    const result = await page.evaluate(async mode => {
      await game.startGame('mp', { map: 'dust2', mode, allies: 1, enemies: 2 });
      game.renderer.setAnimationLoop(null);
      for (let i = 0; i < 90; i++) game.update(1 / 60, game.snapshotInput());
      return { grounded: game.player.onGround, flags: game.mode.flags?.length, characters: game.world.physics.characters.size, expected: game.bots.length + 1 };
    }, mode);
    assert.ok(result.grounded); assert.equal(result.characters, result.expected);
  }
  await page.evaluate(async () => { await game.startGame('mp', { map: 'karkand', mode: 'tdm', allies: 0, enemies: 1 }); game.renderer.setAnimationLoop(null); });
  assert.deepEqual(errors, []);
  console.log('Dust II TDM, map switching, rendering: passed');
} finally { await browser.close(); }
