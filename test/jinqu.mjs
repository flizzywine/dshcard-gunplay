// Integration and traversal checks against the actual browser-built map.
// Start the local HTTP server, then: node test/jinqu.mjs
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:8089';
const out = 'output/playwright'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
  await page.addInitScript(() => {
    localStorage.setItem('mf_settings', JSON.stringify({ quality: 'medium' }));
    HTMLCanvasElement.prototype.requestPointerLock = () => Promise.resolve();
  });
  await page.goto(base); await page.waitForFunction(() => window.game?.state === 'menu', null, { timeout: 120000 });
  await page.evaluate(() => game.menu.showLobby());
  await page.screenshot({ path: `${out}/jinqu-lobby.png` });
  assert.equal(await page.locator('[data-map=jinqu].sel').count(), 1);
  assert.equal(await page.locator('[data-m=breakthrough].sel').count(), 1);
  await page.getByRole('button', { name: '开始对局' }).click();
  await page.waitForFunction(() => game.state === 'play');
  await page.evaluate(() => { game.renderer.setAnimationLoop(null); game.godMode = true; document.getElementById('clickToPlay').classList.add('hidden'); });
  const nav = await page.evaluate(() => {
    const w = game.world, issues = [], routes = [];
    for (let i = 0; i < w.sectors.length; i++) {
      const s = w.sectors[i];
      for (const [team, points] of Object.entries(s.spawns)) for (let j = 0; j < points.length; j++) {
        const p = points[j];
        if (!w.walkable(...w.cellOf(p.x, p.z))) issues.push(`blocked spawn ${i}/${team}/${j}: ${p.x},${p.z}`);
        const occupied = w.boxes.some(b => b.y1 > p.y + 0.45 && b.y0 < p.y + 1.7 && p.x > b.x0 - 0.35 && p.x < b.x1 + 0.35 && p.z > b.z0 - 0.35 && p.z < b.z1 + 0.35);
        if (occupied) issues.push(`colliding spawn ${i}/${team}/${j}`);
        for (const f of s.objectives) {
          const path = w.findPath(p, f.pos);
          if (!path) issues.push(`no path ${i}/${team}/${j} → ${f.name}`);
          routes.push({ stage: i, team, point: j, objective: f.name, waypoints: path?.length });
        }
      }
      for (const f of s.objectives) if (!w.walkable(...w.cellOf(f.pos.x, f.pos.z))) issues.push(`blocked objective ${f.name}`);
    }
    const high = w.terrainHeight(-120, 50), low = w.terrainHeight(-70, 57);
    const p = game.player.pos.clone().set(-120, high + 20, 50), down = p.clone().set(0, -1, 0);
    const hit = w.raycast(p, down, 40);
    return { issues, routes, high, low, rayGround: hit?.point.y, boxes: w.boxes.length };
  });
  console.log(JSON.stringify({ ...nav, routes: nav.routes.length }, null, 2)); assert.deepEqual(nav.issues, []);
  assert.ok(nav.high - nav.low > 6); assert.ok(Math.abs(nav.rayGround - nav.high) < 0.03);
  const traversal = await page.evaluate(() => {
    const w = game.world, failures = [];
    const walk = (from, path) => {
      const p = from.clone(), v = from.clone().set(0, 0, 0);
      for (const target of path) {
        let steps = Math.ceil(Math.hypot(target.x - p.x, target.z - p.z) / 0.14) * 3 + 40;
        while (Math.hypot(target.x - p.x, target.z - p.z) > 0.2 && steps-- > 0) {
          v.set(target.x - p.x, 0, target.z - p.z).normalize(); p.addScaledVector(v, 0.14);
          w.collide(p, v, 0.35, 1.7); p.y = w.groundHeight(p.x, p.z, p.y, 0.35);
        }
        if (steps <= 0) return { stuck: p.toArray(), target: target.toArray(), blockers: w.boxes.filter(b => b.y1 > p.y + 0.45 && b.y0 < p.y + 1.7 && p.x >= b.x0 - 0.5 && p.x <= b.x1 + 0.5 && p.z >= b.z0 - 0.5 && p.z <= b.z1 + 0.5) };
      }
      return { y: p.y };
    };
    for (const s of w.sectors) for (const [team, points] of Object.entries(s.spawns)) for (const p of points) for (const f of s.objectives) {
      const result = walk(p, w.findPath(p, f.pos));
      if (result.stuck) failures.push({ from: p.toArray(), to: f.name, team, ...result });
    }
    const roofs = [];
    for (const [x, z, tx, expected] of [[-70, 42.1, -80, 4.6 + 0.3222436138], [-70, 76.1, -81, 4.6 + 0.4564237415], [-9.5, 1.6, 0, 6.6], [38.5, 27.6, 29, 6.6], [68.5, 30.6, 59, 6.6]]) {
      const p = game.player.pos.clone().set(x, w.terrainHeight(x, z), z), target = p.clone().setX(tx);
      const result = walk(p, [target]); roofs.push(result);
      if (result.stuck || Math.abs(result.y - expected) > 0.1) failures.push({ roof: [x, z], expected, ...result });
    }
    for (const [x, z] of [[-32, -48], [-6, -20]]) {
      const p = game.player.pos.clone().set(x, w.terrainHeight(x, z + 9), z + 9), target = p.clone().setZ(z);
      const result = walk(p, [target]);
      if (result.stuck || Math.abs(result.y - 8.5) > 0.1) failures.push({ tower: [x, z], ...result });
    }
    for (const [x, z, tx, tz] of [[8, -2, 21, -2], [25, 0, 25, 10], [23, 11, 23, 24]]) {
      const p = game.player.pos.clone().set(x, 6.6, z), target = p.clone().set(tx, 6.6, tz), result = walk(p, [target]);
      if (result.stuck || Math.abs(result.y - 6.6) > 0.1) failures.push({ bridge: [x, z, tx, tz], ...result });
    }
    return { failures, roofs };
  });
  console.log('Traversal', JSON.stringify(traversal)); assert.deepEqual(traversal.failures, []);
  const look = async (x, y, z, tx, ty, tz, name) => {
    await page.evaluate(([x, y, z, tx, ty, tz]) => {
      const g = game; g.camera.position.set(x, y, z); g.camera.lookAt(tx, ty, tz);
      g.vmPass.enabled = false; g.effects.setWeather(null); g.hud.show(false);
      g.world.update(0, g.time, g.camera.position); g.composer.render();
    }, [x, y, z, tx, ty, tz]);
    await page.screenshot({ path: `${out}/${name}.png` });
  };
  await look(-134, 115, 127, 0, 0, -8, 'jinqu-overview');
  await look(-117, 14, 53, -70, 2, 57, 'jinqu-village');
  await look(-54, 35, 6, -16, 4, -34, 'jinqu-camp');
  await look(-9, 29, 44, 15, 2, 9, 'jinqu-slum');
  await look(26, 38, -20, 65, 2, -57, 'jinqu-warehouse');
  await look(47, 35, 53, 81, 2, 17, 'jinqu-offices');
  const combat = await page.evaluate(() => {
    const before = game.bots.map(b => b.pos.clone());
    game.hud.show(true); game.vmPass.enabled = true;
    for (let i = 0; i < 900; i++) game.update(1 / 30, game.snapshotInput());
    return { moved: game.bots.reduce((sum, b, i) => sum + b.pos.distanceTo(before[i]), 0), kills: game.bots.reduce((sum, b) => sum + b.kills, 0) };
  });
  assert.ok(combat.moved > 30); console.log('AI combat', combat);
  const phases = await page.evaluate(async () => {
    await game.startGame('mp', { mode: 'breakthrough', map: 'jinqu', allies: 0, enemies: 0, diff: 0 });
    game.renderer.setAnimationLoop(null);
    const m = game.mode, phases = [];
    game.entities.forEach(e => { if (!e.isPlayer) e.alive = false; });
    for (let stage = 0; stage < 3; stage++) {
      for (const f of [...m.flags]) { game.player.pos.copy(f.pos); m.updateBreakthrough(20); }
      phases.push({ stage: m.breakthrough.stage, tickets: m.breakthrough.tickets, winner: m.breakthrough.winner });
    }
    return phases;
  });
  assert.deepEqual(phases.map(p => p.tickets), [260, 340, 340]); assert.equal(phases[2].winner, 'A');
  // Defending as the player must swap ally/enemy teams and face the active objective.
  const side = await page.evaluate(async () => {
    await game.startGame('mp', { mode: 'breakthrough', map: 'jinqu', side: 'B', allies: 3, enemies: 4, diff: 0 });
    game.renderer.setAnimationLoop(null);
    return { team: game.player.team, allies: game.bots.filter(b => b.team === 'B').length, enemies: game.bots.filter(b => b.team === 'A').length };
  });
  assert.deepEqual(side, { team: 'B', allies: 3, enemies: 4 });
  // Advance with a living defending player: player and defending AI fall back to B.
  const retreat = await page.evaluate(() => {
    const m = game.mode;
    game.entities.forEach(e => { e.alive = false; });
    game.player.alive = true;
    const f = m.flags[0];
    const attacker = { alive: true, team: 'A', pos: f.pos.clone() };
    game.entities.push(attacker); m.updateBreakthrough(20);
    game.entities.pop();
    return { stage: m.breakthrough.stage, x: game.player.pos.x, flags: m.flags.map(f => f.name) };
  });
  assert.equal(retreat.stage, 1); assert.deepEqual(retreat.flags, ['B1', 'B2']); assert.ok(retreat.x > 30);
  const tactical = await page.evaluate(() => {
    document.getElementById('clickToPlay').classList.add('hidden');
    game.input.keys.KeyM = true; game.paused = false; game.hud.drawTacticalMap();
    return getComputedStyle(document.getElementById('tacticalMap')).display;
  });
  assert.equal(tactical, 'flex'); await page.screenshot({ path: `${out}/jinqu-tactical.png` });
  // Legacy modes still construct/score normally after leaving the terrain map.
  for (const [map, mode] of [['dune', 'tdm'], ['frost', 'dom'], ['neon', 'tdm'], ['yard', 'ffa']]) {
    await page.evaluate(async ([map, mode]) => { game.input.keys.KeyM = false; await game.startGame('mp', { map, mode, allies: 1, enemies: 2, diff: 0 }); game.renderer.setAnimationLoop(null); game.update(1 / 30, game.snapshotInput()); }, [map, mode]);
    assert.equal(await page.evaluate(() => game.state), 'play');
  }
  assert.deepEqual(errors, []);
  console.log('PASS: 40 spawn-to-objective paths, terrain rays, three phases, defender side/retreat, tactical map, four legacy maps.');
} finally { await browser.close(); }
