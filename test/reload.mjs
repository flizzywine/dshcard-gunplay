// Exercise the rendered weapon rig, sound timing and reload state transitions.
// Start the local HTTP server, then: npm run test:reload
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const out = 'output/playwright';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('mf_settings', JSON.stringify({ quality: 'medium' }));
    HTMLCanvasElement.prototype.requestPointerLock = () => Promise.resolve();
  });
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8089');
  await page.waitForFunction(() => window.game?.state === 'menu', null, { timeout: 120000 });
  await page.evaluate(() => game.menu.showLobby());
  await page.getByRole('button', { name: '开始对局' }).click();
  await page.waitForFunction(() => game.state === 'play');
  const results = await page.evaluate(async () => {
    const { WEAPONS } = await import('/js/data.js');
    const { reloadPose } = await import('/js/reload-animation.js');
    const g = game, ws = g.player.ws, input = { ads: false, fire: false, mdx: 0, mdy: 0 };
    g.renderer.setAnimationLoop(null); g.godMode = true; g.paused = false; g.frame();
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const sounds = [];
    const realAudio = g.audio.reload;
    g.audio.reload = cue => sounds.push(cue);
    const results = [];
    const cases = Object.keys(WEAPONS).map(id => ({ id }));
    try {
      for (const cfg of cases) for (const empty of [false, true]) {
        if (!empty && WEAPONS[cfg.id].mag === 1) continue;
        g.player.perks = new Set(cfg.fast ? ['sleight'] : []);
        ws.setLoadout([cfg, { id: 'm4' }]); ws.state = 'idle';
        const w = ws.w;
        w.mag = empty ? 0 : Math.max(1, w.stats.mag - 2);
        w.reserve = 1; // Verify partial reserves, not just a full free refill.
        const before = w.mag, startSounds = sounds.length;
        ws.adsT = 1; ws.startReload();
        const duration = ws.stateDur;
        // Aiming held throughout must not hide a scoped reload.
        const dt = Math.min(1 / 120, duration / 120);
        let previous = null;
        for (let elapsed = 0; elapsed < duration - dt; elapsed += dt) {
          ws.update(dt, { ...input, ads: true });
          const pose = reloadPose(ws.stateT / duration, w.reloadStyle, ws.reloadNeedsBolt);
          const hand = w.arms.children.at(-1);
          check(hand.position.toArray().every(Number.isFinite), `${cfg.id}: invalid hand transform`);
          if (pose.reach === 1 && pose.handAction === 0) {
            const grip = w.magGrip.clone().applyMatrix4(w.info.mag.matrix);
            check(grip.distanceTo(hand.position) < 1e-6, `${cfg.id}: hand detached from magazine at ${ws.stateT / duration}: ${grip.toArray()} vs ${hand.position.toArray()}`);
          }
          if (previous) check(previous.distanceTo(hand.position) < 0.12, `${cfg.id}: hand teleported`);
          previous = hand.position.clone();
          if (ws.stateT > duration * 0.5) check(g.scopeState === null, `${cfg.id}: scope hides reload`);
        }
        ws.update(duration - ws.stateT + 0.00001, input);
        check(ws.state === 'idle', `${cfg.id}: reload did not finish`);
        check(w.mag === before + 1 && w.reserve === 0, `${cfg.id}: ammo conservation failed`);
        check(w.info.mag.position.distanceTo(w.magRest.position) < 1e-9, `${cfg.id}: magazine did not reset`);
        check(w.info.mag.rotation.equals(w.magRest.rotation), `${cfg.id}: magazine rotation did not reset`);
        check(w.info.mag.visible === !w.stats.shellReload, `${cfg.id}: invalid magazine visibility after reload`);
        check(w.arms.children.at(-1).position.distanceTo(w.arms.userData.restHand) < 1e-9, `${cfg.id}: hand did not regrip`);
        const cues = sounds.slice(startSounds);
        check(cues.filter(c => c === 'in').length === (w.stats.shellReload ? 0 : 1), `${cfg.id}: duplicate/missing seat sound`);
        check(cues.filter(c => c === 'bolt').length === (w.stats.shellReload || ws.reloadNeedsBolt ? 1 : 0), `${cfg.id}: incorrect action sound`);
        // Cancel while the magazine is out, then reselect the same weapon.
        w.mag = 0; w.reserve = 5; ws.startReload();
        ws.stateT = ws.stateDur * 0.44; ws.updateViewmodel(0, input);
        ws.switchTo(1); ws.switchTo(0);
        check(w.info.mag.position.distanceTo(w.magRest.position) < 1e-9, `${cfg.id}: cancelled reload leaked pose`);
        check(w.info.mag.visible === !w.stats.shellReload, `${cfg.id}: cancelled reload left hidden magazine`);
        results.push({ weapon: cfg.id, attachment: cfg.att?.mag, fast: !!cfg.fast, empty, duration, cues });
      }
    } finally { g.audio.reload = realAudio; }
    // Leave an M4 ready for repeatable visual captures.
    g.player.perks = new Set(); ws.setLoadout([{ id: 'm4' }, { id: 'm4' }]);
    ws.state = 'idle'; ws.w.mag = 0; ws.startReload(); ws.adsT = 0;
    g.camera.position.set(-117, 14, 53); g.camera.lookAt(-70, 2, 57);
    document.getElementById('clickToPlay').classList.add('hidden');
    g.hud.show(false); g.menu.el?.classList.add('hidden');
    return results;
  });
  assert.equal(results.length, 7);
  for (const [name, progress] of [['ready', 0], ['grasp', 0.22], ['withdraw', 0.32], ['insert', 0.59], ['seat', 0.67], ['bolt', 0.82], ['finish', 1]]) {
    await page.evaluate(k => {
      const ws = game.player.ws;
      ws.stateT = ws.stateDur * k;
      ws.updateViewmodel(0, { mdx: 0, mdy: 0 });
      game.composer.render();
    }, progress);
    await page.screenshot({ path: `${out}/reload-${name}.png` });
  }
  if (process.env.RELOAD_VIDEO === '1') {
    const video = await page.evaluate(async () => {
      const g = game, ws = g.player.ws, input = { ads: false, fire: false, mdx: 0, mdy: 0 };
      ws.state = 'idle'; ws.w.mag = 8; ws.w.reserve = 100; ws.startReload();
      const stream = g.renderer.domElement.captureStream(30), chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      recorder.ondataavailable = e => chunks.push(e.data);
      const stopped = new Promise(resolve => { recorder.onstop = resolve; });
      recorder.start();
      let previous = performance.now(), rest = 0, round = 0;
      await new Promise(resolve => {
        const frame = now => {
          const dt = Math.min(0.05, (now - previous) / 1000); previous = now;
          ws.update(dt, input); g.composer.render();
          if (ws.state === 'idle') {
            rest += dt;
            if (rest > 0.35) {
              if (round++) { resolve(); return; }
              ws.w.mag = 0; ws.startReload(); rest = 0;
            }
          }
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      recorder.stop(); await stopped; stream.getTracks().forEach(track => track.stop());
      return await new Promise(resolve => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(new Blob(chunks, { type: 'video/webm' }));
      });
    });
    await writeFile(`${out}/reload-preview.webm`, Buffer.from(video, 'base64'));
  }
  assert.deepEqual(errors, []);
  console.log(`Checked ${results.length} cases across the four fixed weapons.`);
  console.log('PASS: reload hand contact/continuity, ammo, ADS, sound cues and cancellation reset.');
} finally { await browser.close(); }
