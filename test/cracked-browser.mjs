import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

await mkdir('output/playwright', { recursive: true });
await mkdir('output/tmp', { recursive: true });
process.env.TEMP = path.resolve('output/tmp'); process.env.TMP = process.env.TEMP;
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('mf_settings', JSON.stringify({ quality: 'medium' }));
    HTMLCanvasElement.prototype.requestPointerLock = () => Promise.resolve();
  });
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8089/');
  await page.waitForFunction(() => window.game?.state === 'menu', null, { timeout: 120000 });
  await page.evaluate(() => game.menu.showLobby());
  await page.locator('[data-map="cracked"]').click();
  await page.screenshot({ path: 'output/playwright/cracked-lobby.png' });
  await page.getByRole('button', { name: '开始对局' }).click();
  await page.waitForFunction(() => game.state === 'play', null, { timeout: 120000 });
  const report = await page.evaluate(() => {
    const g = game, w = g.world; g.renderer.setAnimationLoop(null); g.godMode = true;
    const starts = g.bots.map(b => b.pos.clone());
    let minY = Infinity, travel = 0; const previous = g.bots.map(b => b.pos.clone()), start = performance.now();
    for (let frame = 0; frame < 3600; frame++) {
      g.update(1 / 60, g.snapshotInput());
      for (let i = 0; i < g.bots.length; i++) { const b = g.bots[i], d = b.pos.distanceTo(previous[i]); if (d < 1) travel += d; previous[i].copy(b.pos); minY = Math.min(minY, b.pos.y); }
    }
    if (!g.player.onGround) throw new Error('Cracked player failed to settle');
    if (minY < -45) throw new Error('Cracked bot fell through terrain');
    if (w.physics.characters.size !== g.bots.length + 1) throw new Error('Cracked character leak');
    g.input.keys.KeyM = true; g.hud.drawTacticalMap(); const tactical = g.hud.tacticalEl.style.display === 'flex'; g.input.keys.KeyM = false; g.hud.drawTacticalMap();
    const enemy = g.bots.find(b => b.alive && b.team !== g.player.team), kills = g.mode.scores.A;
    enemy.takeDamage(9999, { attacker: g.player, weapon: 'test', dir: enemy.pos.clone().set(0, 0, 1) });
    if (g.mode.scores.A !== kills + 1) throw new Error('Cracked scoring failed');
    for (let i = 0; i < 450; i++) g.update(1 / 60, g.snapshotInput());
    if (!enemy.alive) throw new Error('Cracked respawn failed');
    return { map: w.def.id, nodes: w.navigation.nodes.length, bots: g.bots.length, displaced: g.bots.filter((b, i) => b.pos.distanceTo(starts[i]) > 10).length, travel: Math.round(travel), minY, tactical, simulationMs: Math.round(performance.now() - start), kills: g.mode.scores, geometryTriangles: w.mapSource.title };
  });
  assert.equal(report.map, 'cracked'); assert.ok(report.travel > 200); assert.ok(report.displaced >= 4); assert.ok(report.tactical);
  // Pointer lock is stubbed in this test; dismiss its prompt and render the
  // simulated state before capturing the actual first-person frame.
  await page.evaluate(() => { document.getElementById('clickToPlay').classList.add('hidden'); game.composer.render(1 / 60); });
  await page.screenshot({ path: 'output/playwright/cracked-gameplay.png' });
  await page.addStyleTag({ content: 'body > :not(#app){visibility:hidden!important}' });
  for (const [name, position, target] of [
    ['overview', [0, 470, 390], [0, -10, 0]],
    ['a-roof', [-128, 18, -12], [-154, -9, -37]],
    ['c1', [155, 48, 200], [102, -4, 137]],
  ]) {
    await page.evaluate(([position, target]) => { const g = game; g.camera.position.set(...position); g.camera.lookAt(...target); g.renderer.render(g.scene, g.camera); }, [position, target]);
    await page.screenshot({ path: `output/playwright/cracked-${name}.png` });
  }
  const switched = await page.evaluate(async () => {
    for (const map of ['dust2', 'cracked']) { await game.startGame('mp', { map, mode: 'tdm', allies: 1, enemies: 2 }); game.renderer.setAnimationLoop(null); for (let i = 0; i < 120; i++) game.update(1 / 60, game.snapshotInput()); if (!game.player.onGround) throw new Error('Map switch spawn failed: ' + map); }
    return game.world.physics.characters.size;
  });
  assert.equal(switched, 4); assert.deepEqual(errors, []);
  await writeFile('output/playwright/cracked-report.json', JSON.stringify({ ...report, errors, mapSwitching: true }, null, 2));
  console.log('Cracked gameplay', report);
} finally { await browser.close(); }
