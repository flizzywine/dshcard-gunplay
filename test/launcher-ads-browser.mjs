import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

await mkdir('output/playwright', { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8089');
  await page.waitForFunction(() => window.game?.state === 'menu');
  await page.evaluate(async () => {
    await game.startGame('mp', { map: 'dust2', mode: 'tdm', allies: 1, enemies: 1 });
    game.renderer.setAnimationLoop(null); game.godMode = true;
  });
  const results = await page.evaluate(async () => {
    const THREE = await import('three'), g = game, p = g.player, ws = p.ws;
    const input = { mdx: 0, mdy: 0 }, ray = new THREE.Raycaster(), results = [];
    ws.switchTo(3); ws.state = 'idle'; p.resetAim();
    // Drive the actual aim toggle and its transition, not a synthetic pose.
    for (let i = 0; i < 70; i++) p.update(1 / 60, { ...input, adsPressed: i === 0 });
    for (const aspect of [1, 1.6, 16 / 9]) {
      g.vmCamera.aspect = aspect; g.vmCamera.updateProjectionMatrix();
      for (const ads of [0, .5, 1]) {
        ws.adsT = ads; ws.updateViewmodel(0, input);
        ws.pivot.updateMatrixWorld(true); g.vmCamera.updateMatrixWorld(true);
        let blocked = 0;
        for (const x of [-.12, 0, .12]) for (const y of [-.12, 0, .12]) {
          ray.setFromCamera(new THREE.Vector2(x, y), g.vmCamera);
          if (ws.holder.visible&&ray.intersectObject(ws.w.info.group, true).some(hit => hit.distance >= g.vmCamera.near)) blocked++;
        }
        results.push({ aspect, ads, blocked });
      }
    }
    ws.adsT = 1; g.vmCamera.aspect = innerWidth / innerHeight; ws.updateViewmodel(0, input);
    g.hud.show(true); g.hud.update(0); document.getElementById('clickToPlay').classList.add('hidden'); g.composer.render();
    return { samples: results, fov: g.camera.fov, scope: g.scopeState, reticle: getComputedStyle(document.querySelector('.at4-reticle')).display };
  });
  await page.screenshot({ path: 'output/playwright/launcher-ads-fixed.png' });
  console.log(JSON.stringify(results));
  assert.deepEqual(errors, []);
  assert.ok(results.fov < 40 && results.scope === 'at4', 'AT4 must use its magnified sight');
  assert.notEqual(results.reticle, 'none', 'AT4 needs a visible sight reticle');
  assert.ok(results.samples.every(sample => sample.blocked === 0), 'launcher ADS obstructs the central aiming area');
} finally { await browser.close(); }
