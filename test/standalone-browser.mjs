import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8089');
  await page.waitForFunction(() => window.game?.state === 'menu', null, { timeout: 120000 });
  await page.getByText('多人对战', { exact: true }).click();
  assert.deepEqual(await page.locator('[data-map]').evaluateAll(es => es.map(e => e.dataset.map)), ['cracked', 'karkand', 'dust2']);
  assert.deepEqual(await page.locator('[data-m]').evaluateAll(es => es.map(e => e.dataset.m)), ['breakthrough','tdm']);
  assert.equal(await page.locator('[data-map="cracked"].sel').count(), 1);
  await page.locator('[data-map="karkand"]').click();
  assert.equal(await page.getByText('攻防阵营', { exact: true }).count(), 0);
  await page.getByRole('button', { name: '开始对局' }).click();
  await page.waitForFunction(() => game.state === 'play');
  const result = await page.evaluate(async () => {
    const { MAPS } = await import('/js/maps.js');
    const check = (v, msg) => { if (!v) throw new Error(msg); };
    game.renderer.setAnimationLoop(null); const current = game.world;
    for (const cfg of [{ map: 'jinqu', mode: 'tdm' }, ...['dom','ffa','breakthrough'].map(mode => ({ map: 'dust2', mode }))]) {
      let rejected = false; try { await game.startGame('mp', cfg); } catch { rejected = true; }
      check(rejected && game.world === current, 'removed selection must be rejected before clearing the match');
    }
    const g = game, m = g.mode; g.godMode = true;
    const enemy = g.bots.find(b => b.team !== g.player.team);
    enemy.takeDamage(9999, { attacker: g.player, weapon: 'test', dir: enemy.pos.clone().set(0,0,1) });
    check(m.scores.A === 1 && g.player.stats.kills === 1, 'TDM scoring failed');
    for (let i=0;i<420;i++) g.update(1/60, g.snapshotInput());
    check(enemy.alive && !m.respawns.some(r => r.e === enemy), 'TDM respawn failed');
    check(m.scoreboardHTML().includes('联合特遣队'), 'team scoreboard missing');
    m.scores.A = m.scoreLimit; m.update(1/60, g.snapshotInput()); check(m.over, 'score limit failed');
    return { maps: Object.keys(MAPS), scored: true, respawn: true, victory: true };
  });
  await page.getByRole('button', { name: /再来/ }).waitFor({ timeout: 10000 });
  console.log('Standalone lobby, removed selections, TDM lifecycle', result);
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
