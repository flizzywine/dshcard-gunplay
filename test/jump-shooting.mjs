// Real Player -> Rapier -> WeaponSystem -> bullet rays, without map obstacles/random spread.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('output/playwright', { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = () => Promise.resolve(); localStorage.setItem('mf_settings', JSON.stringify({ quality: 'medium' })); });
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8089');
  await page.waitForFunction(() => window.game?.state === 'menu', null, { timeout: 120000 });
  const report = await page.evaluate(async () => {
    const { PhysicsWorld } = await import('/js/physics.js');
    const { Vector3 } = await import('three');
    await game.startGame('mp', { map: 'dust2', mode: 'tdm', allies: 0, enemies: 0 });
    const g = game, p = g.player, ws = p.ws; g.renderer.setAnimationLoop(null); g.godMode = true;
    const oldPhysics = g.world.physics;
    p.physicsBody.dispose();
    g.world.physics = new PhysicsWorld({ boxes: [{ x0: -150, x1: 150, y0: -1, y1: 0, z0: -150, z1: 150, mat: 'concrete' }] });
    p.physicsBody = g.world.physics.createCharacter({ x: 0, y: 0.015, z: 0 });
    g.settings.spreadScale = 0; g.settings.recoilScale = 0;
    const originalRay = g.world.raycast.bind(g.world); let shot = null;
    g.world.raycast = (origin, direction, distance) => { if (distance === 400) shot = { origin: origin.clone(), direction: direction.clone(), muzzleRigError: ws.pivot.position.distanceTo(g.camera.position) }; return originalRay(origin, direction, distance); };
    const scenarios = [];
    for (const fps of [30, 60, 120]) for (const ads of [false, true]) {
      const dt = 1 / fps;
      p.respawn(new Vector3(0, 0.015, 0), 0); ws.state = 'idle'; ws.cool = 0; ws.rp = 0; p.aimLatched = ads;
      const input = { mdx: 0, mdy: 0, fire: false, fwd: true };
      for (let i = 0; i < fps / 2; i++) { g.world.physics.step(dt); p.update(dt, input); }
      let originError = 0, aimError = 0, rigError = 0, eyeLag = 0, maxDip = 0, maxHipSpreadStep = 0, apex = 0, shots = 0;
      let lastSpread = 0, air = false, landed = false;
      const groundY = p.pos.y;
      g.settings.spreadScale = 1;
      for (let i = 0; i < fps * 1.2; i++) {
        const beforeShots = p.stats.shots; shot = null;
        input.jumpPressed = i === 0; input.fire = i < fps * 0.7; input.mdx = 90 * dt; input.mdy = 18 * dt;
        g.world.physics.step(dt); p.update(dt, input);
        const spread = ws.currentSpread();
        if (lastSpread) maxHipSpreadStep = Math.max(maxHipSpreadStep, Math.abs(spread / lastSpread - 1)); lastSpread = spread;
        if (!p.onGround) { air = true; eyeLag = Math.max(eyeLag, Math.abs(p.eyeSmooth - p.pos.y - p.curEye())); }
        else if (air) landed = true;
        apex = Math.max(apex, p.pos.y - groundY); maxDip = Math.max(maxDip, p.landDip);
        rigError = Math.max(rigError, ws.pivot.position.distanceTo(g.camera.position));
        if (p.stats.shots > beforeShots && shot) {
          shots++; originError = Math.max(originError, shot.origin.distanceTo(g.camera.position));
          // Spread-free samples below check exact direction; this pass captures live jump feel.
        }
      }
      // Fast-turn jump shot with spread/recoil disabled isolates frame synchronization.
      g.settings.spreadScale = 0; ws.cool = 0; ws.state = 'idle'; ws.w.mag = 20;
      p.onGround = false; p.vel.y = 3; shot = null;
      p.update(dt, { mdx: 12, mdy: -7, fire: true });
      if (!shot) throw new Error('No bullet ray captured');
      const freshOriginError = shot.origin.distanceTo(g.camera.position);
      aimError = shot.direction.angleTo(g.camera.getWorldDirection(new Vector3()));
      scenarios.push({ fps, ads, originError, freshOriginError, aimError, rigError, muzzleRigError: shot.muzzleRigError, eyeLag, maxDip, maxHipSpreadStep, apex, shots, landed });
    }
    oldPhysics.dispose(); return scenarios;
  });
  await writeFile('output/playwright/jump-shooting.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  const issues = [];
  if (Math.max(...report.map(s => s.apex)) - Math.min(...report.map(s => s.apex)) > 0.035) issues.push('jump height changes too much with render rate');
  for (const s of report) {
    const label = `${s.fps}fps ${s.ads ? 'ADS' : 'hip'}`;
    if (s.freshOriginError > 0.0001 || s.aimError > 0.00001) issues.push(label + ': shot uses stale camera pose');
    if (s.rigError > 0.0001) issues.push(label + ': weapon rig lags behind camera');
    if (s.muzzleRigError > 0.0001) issues.push(label + ': muzzle effects use stale weapon transform');
    if (s.eyeLag > 0.03) issues.push(label + ': camera floats behind jump body');
    if (s.maxDip < 0.005 || s.maxDip > 0.08) issues.push(label + ': ordinary jump has no controlled landing feedback');
    if (!s.ads && s.maxHipSpreadStep > 0.35) issues.push(label + ': abrupt airborne spread transition');
    if (!s.landed || s.shots < 2 || s.apex < 0.5) issues.push(label + ': jump shooting did not run');
  }
  assert.deepEqual(errors, []); assert.deepEqual(issues, []);
  console.log('PASS: jump shooting synchronization, airborne tracking and landing at 30/60/120 fps');
} finally { await browser.close(); }
