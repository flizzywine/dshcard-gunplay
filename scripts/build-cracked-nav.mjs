import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initPhysics, PhysicsWorld } from '../js/physics.js';
import { readGrayboxCollision } from '../js/graybox-geometry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), file = path.join(root, 'assets/maps/cracked.json');
const data = JSON.parse(fs.readFileSync(file)), bytes = fs.readFileSync(path.join(root, 'assets/maps/cracked-collision.bin'));
const mesh = readGrayboxCollision(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
await initPhysics();
const world = new PhysicsWorld({ meshes: [mesh] }), probe = world.createCharacter({ x: 0, y: 100, z: 0 }, 0.51, 1.955);
const cs = 0.8, [x0, z0, x1, z1] = data.navigationBounds, [y0, y1] = data.navigationHeights, candidates = new Map(), cells = new Map(), nodes = [];
const key = (x, z) => `${x},${z}`, v = mesh.vertices, ix = mesh.indices;
if (process.argv.includes('--reuse-graph')) {
  const cached = JSON.parse(fs.readFileSync(path.join(root, 'output/cracked/navigation-graph.json')));
  if (cached.sourceSha256 !== data.provenance.sha256 || cached.cellSize !== cs) throw new Error('Navigation cache does not match current geometry');
  for (const n of cached.nodes) nodes.push(n);
} else {
for (let i = 0; i < ix.length; i += 3) {
  const ai = ix[i] * 3, bi = ix[i + 1] * 3, ci = ix[i + 2] * 3;
  const ax = v[ai], ay = v[ai + 1], az = v[ai + 2], bx = v[bi], by = v[bi + 1], bz = v[bi + 2], cx = v[ci], cy = v[ci + 1], cz = v[ci + 2];
  const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay), ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az), nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  // Imported meshes render and collide on both sides. Some authored floors
  // wind downwards, so orientation cannot decide whether a floor supports feet.
  // The capsule fit/settling checks below reject undersides inside solid floors.
  if (Math.abs(ny) < Math.hypot(nx, ny, nz) * 0.65 || Math.abs(ny) < 1e-5) continue;
  const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
  const minX = Math.max(x0, Math.min(ax, bx, cx)), maxX = Math.min(x1, Math.max(ax, bx, cx)), minZ = Math.max(z0, Math.min(az, bz, cz)), maxZ = Math.min(z1, Math.max(az, bz, cz));
  for (let z = Math.ceil(minZ / cs); z <= Math.floor(maxZ / cs); z++) for (let x = Math.ceil(minX / cs); x <= Math.floor(maxX / cs); x++) {
    const wx = x * cs, wz = z * cs, u = ((bz - cz) * (wx - cx) + (cx - bx) * (wz - cz)) / det, w = ((cz - az) * (wx - cx) + (ax - cx) * (wz - cz)) / det;
    if (u < -1e-5 || w < -1e-5 || u + w > 1.00001) continue;
    const y = ay * u + by * w + cy * (1 - u - w) + 0.025;
    if (y < y0 || y > y1) continue;
    const k = key(x, z), heights = candidates.get(k) || []; if (!heights.some(h => Math.abs(h - y) < 0.15)) heights.push(y); candidates.set(k, heights);
  }
}
console.log('Cracked candidate cells', candidates.size);
for (const [k, heights] of candidates) {
  const [x, z] = k.split(',').map(Number);
  for (const y of heights) {
    const p = { x: x * cs, y: y + 0.12, z: z * cs };
    if (!probe.canFit(p, 1.955)) continue;
    const moved = probe.move(p, { x: 0, y: -0.3, z: 0 }, 1.955);
    if (!moved.grounded || Math.abs(moved.position.y - y) > 0.2) continue;
    const n = { p: moved.position, edges: [] }, id = nodes.length; nodes.push(n); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(id);
  }
}
console.log('Cracked floor nodes', nodes.length);
function traverse(a, b) {
  let p = { ...a }; const steps = Math.ceil(cs / 0.28);
  for (let j = 0; j < steps; j++) p = probe.move(p, { x: (b.x - p.x) / (steps - j), y: -0.18, z: (b.z - p.z) / (steps - j) }, 1.955).position;
  // Finish descending a small step after horizontal motion reaches its target.
  p = probe.move(p, { x: 0, y: -0.4, z: 0 }, 1.955).position;
  return Math.hypot(p.x - b.x, p.z - b.z) < 0.18 && Math.abs(p.y - b.y) < 0.28;
}
for (let id = 0; id < nodes.length; id++) {
  if (id % 5000 === 0) console.log('Cracked links', id, '/', nodes.length);
  const a = nodes[id], x = Math.round(a.p.x / cs), z = Math.round(a.p.z / cs);
  for (const [dx, dz] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) for (const other of cells.get(key(x + dx, z + dz)) || []) {
    const b = nodes[other]; if (Math.abs(a.p.y - b.p.y) > cs * Math.hypot(dx, dz) * 0.9) continue;
    if (traverse(a.p, b.p) && traverse(b.p, a.p)) { a.edges.push(other); b.edges.push(id); }
  }
}
}
const distance = (p, a) => Math.hypot(p.x - a[0], p.y - a[1], p.z - a[2]);
function nearest(anchor, ids = nodes.map((_, i) => i)) { let best = ids[0], d = Infinity; for (const id of ids) { const v = distance(nodes[id].p, anchor); if (v < d) { best = id; d = v; } } return best; }
// An approximate deployment anchor can be closest to an isolated rooftop or
// rock. Select the main connected battlefield before snapping deployment points.
const visited = new Set(), components = [];
for (let seed = 0; seed < nodes.length; seed++) {
  if (visited.has(seed)) continue;
  const queue = [seed]; visited.add(seed);
  for (let j = 0; j < queue.length; j++) for (const next of nodes[queue[j]].edges) if (!visited.has(next)) { visited.add(next); queue.push(next); }
  components.push(queue);
}
components.sort((a, b) => b.length - a.length);
console.log('Cracked connected components', components.slice(0, 12).map(a => a.length));
fs.mkdirSync(path.join(root, 'output/cracked'), { recursive: true });
fs.writeFileSync(path.join(root, 'output/cracked/navigation-graph.json'), JSON.stringify({ sourceSha256: data.provenance.sha256, cellSize: cs, nodes, components: components.map(a => a.length) }));
const ids = components[0], seen = new Set(ids), remap = new Map(ids.map((id, i) => [id, i]));
if (ids.length < 1000) throw new Error('Cracked navigation component is too small');
const point = id => { const p = nodes[id].p; return [p.x, p.y, p.z].map(v => +v.toFixed(4)); };
data.navigation = { cellSize: cs, nodes: ids.map(id => [...point(id), ...nodes[id].edges.filter(n => seen.has(n)).map(n => remap.get(n))]) };
data.spawns = Object.fromEntries(Object.entries(data.spawnAnchors).map(([team, anchors]) => [team, anchors.map(anchor => point(nearest(anchor, ids)))]));
const anchors = Object.fromEntries(Object.entries(data.landmarks).map(([name, p]) => [name, { distance: +distance(nodes[nearest(p, ids)].p, p).toFixed(2), point: point(nearest(p, ids)) }]));
if (anchors.a.distance > 20 || anchors.c1.distance > 20 || anchors.c2.distance > 20) throw new Error('Cracked A/C area missing from connected navigation: ' + JSON.stringify(anchors));
fs.writeFileSync(file, JSON.stringify(data));
const rows = new Map(), half = data.size / 2;
for (const n of data.navigation.nodes) { const z = Math.round(n[2] / cs), x = Math.round(n[0] / cs); if (!rows.has(z)) rows.set(z, new Set()); rows.get(z).add(x); }
let d = ''; for (const [z, cells] of rows) { const xs = [...cells].sort((a, b) => a - b); for (let i = 0; i < xs.length; i++) { const start = xs[i]; while (xs[i + 1] === xs[i] + 1) i++; d += `M${(start * cs + half).toFixed(1)} ${(z * cs + half).toFixed(1)}h${((xs[i] - start + 1) * cs).toFixed(1)}v${cs}H${(start * cs + half).toFixed(1)}z`; } }
fs.writeFileSync(path.join(root, 'assets/maps/cracked-radar.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${data.size} ${data.size}"><rect width="${data.size}" height="${data.size}" fill="#383a37"/><path d="${d}" fill="#c6b396"/></svg>`);
console.log(JSON.stringify({ connected: ids.length, allNodes: nodes.length, anchors, spawns: data.spawns }));
probe.dispose(); world.dispose();
