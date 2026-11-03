import { readFile, writeFile } from 'node:fs/promises';
import { initPhysics, PhysicsWorld } from '../js/physics.js';
await initPhysics();
const mapId = process.argv[2] || 'dust2';
if (!/^[a-z0-9-]+$/.test(mapId)) throw new Error('Invalid map id');
const file = `assets/maps/${mapId}.json`, data = JSON.parse(await readFile(file, 'utf8'));
const mapSize = data.size || 160, half = mapSize / 2;
const [x0, z0, x1, z1] = data.navigationBounds || [-65, -65, 65, 65];
const [y0, y1] = data.navigationHeights || [0, 30];
const meshes = [data.collision, { ...data.clips, surface: { ray: false } }].map(m => ({ ...m, vertices: new Float32Array(m.vertices), indices: new Uint32Array(m.indices) }));
const world = new PhysicsWorld({ meshes }), probe = world.createCharacter({ x: 0, y: 80, z: 0 }, 0.51, 1.955);
const cs = 32 * 0.0254, cells = new Map(), candidates = new Map();
const key = (x, z) => x + ',' + z;
// Rasterise upward-facing triangles, retaining every floor at a coordinate.
const v = data.collision.vertices;
for (let i = 0; i < v.length; i += 9) {
  const a = v.slice(i, i + 3), b = v.slice(i + 3, i + 6), c = v.slice(i + 6, i + 9);
  const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
  if (det >= -1e-5) continue;
  for (let iz = Math.ceil(Math.min(a[2], b[2], c[2]) / cs); iz <= Math.floor(Math.max(a[2], b[2], c[2]) / cs); iz++) for (let ix = Math.ceil(Math.min(a[0], b[0], c[0]) / cs); ix <= Math.floor(Math.max(a[0], b[0], c[0]) / cs); ix++) {
    const x = ix * cs, z = iz * cs;
    if (x < x0 || x > x1 || z < z0 || z > z1) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det;
    const w = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det;
    if (u < -1e-4 || w < -1e-4 || u + w > 1.0001) continue;
    const y = a[1] * u + b[1] * w + c[1] * (1 - u - w) + 0.025;
    if (y < y0 || y > y1) continue;
    const k = key(ix, iz), heights = candidates.get(k) || [];
    if (!heights.some(h => Math.abs(h - y) < 0.12)) heights.push(y);
    candidates.set(k, heights);
  }
}
const nodes = [];
for (const [k, heights] of candidates) {
  const [ix, iz] = k.split(',').map(Number);
  for (const y of heights) {
    let p = { x: ix * cs, y: y + 0.2, z: iz * cs };
    if (!probe.canFit(p, 1.955)) continue;
    const settled = probe.move(p, { x: 0, y: -0.4, z: 0 }, 1.955);
    if (!settled.grounded || Math.abs(settled.position.y - y) > 0.3) continue;
    p = settled.position;
    const id = nodes.length; nodes.push({ p, edges: [] });
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(id);
  }
}
console.log('Floor nodes', nodes.length);
function traverse(a, b) {
  let pos = { ...a }; const n = mapId === 'karkand' && Math.abs(a.y - b.y) < 0.08 ? 1 : 6;
  for (let i = 0; i < n; i++) pos = probe.move(pos, { x: (b.x - pos.x) / (n - i), y: -0.13, z: (b.z - pos.z) / (n - i) }, 1.955).position;
  return Math.hypot(pos.x - b.x, pos.z - b.z) < 0.22 && Math.abs(pos.y - b.y) < 0.3;
}
for (let id = 0; id < nodes.length; id++) {
  if (id % 10000 === 0) console.log('Validate links', id, '/', nodes.length);
  const a = nodes[id], ix = Math.round(a.p.x / cs), iz = Math.round(a.p.z / cs);
  for (const [dx, dz] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) for (const other of cells.get(key(ix + dx, iz + dz)) || []) {
    const b = nodes[other];
    if (Math.abs(a.p.y - b.p.y) > 0.65) continue;
    if (traverse(a.p, b.p) && traverse(b.p, a.p)) { a.edges.push(other); b.edges.push(id); }
  }
}
// Keep only the playable component connected to the original T spawn, excluding roofs/sky.
const distance = (p, a) => Math.hypot(p.x - a[0], p.y - a[1], p.z - a[2]);
const nearest = a => nodes.reduce((best, n, i) => distance(n.p, a) < distance(nodes[best].p, a) ? i : best, 0);
const seen = new Set(), queue = [nearest(data.spawns.A[0])];
for (let q = 0; q < queue.length; q++) { const id = queue[q]; if (seen.has(id)) continue; seen.add(id); for (const edge of nodes[id].edges) if (!seen.has(edge)) queue.push(edge); }
const ids = [...seen], remap = new Map(ids.map((id, i) => [id, i]));
data.navigation = { cellSize: cs, nodes: ids.map(id => { const n = nodes[id]; return [+n.p.x.toFixed(4), +n.p.y.toFixed(4), +n.p.z.toFixed(4), ...n.edges.filter(i => seen.has(i)).map(i => remap.get(i))]; }) };
console.log('Connected', ids.length, 'spawn distances', Object.fromEntries(Object.entries(data.spawns).map(([team, list]) => [team, Math.max(...list.map(p => ids.reduce((best, id) => Math.min(best, distance(nodes[id].p, p)), Infinity)))])));
await writeFile(file, JSON.stringify(data));
// Compact vector thumbnail made from the actual reachable floor cells.
const rows = new Map();
for (const n of data.navigation.nodes) { const z = Math.round(n[2] / cs), x = Math.round(n[0] / cs); if (!rows.has(z)) rows.set(z, new Set()); rows.get(z).add(x); }
let path = '';
for (const [z, cells] of rows) {
  const xs = [...cells].sort((a, b) => a - b);
  for (let i = 0; i < xs.length; i++) { const start = xs[i]; while (xs[i + 1] === xs[i] + 1) i++; path += `M${(start * cs + half).toFixed(2)} ${(z * cs + half).toFixed(2)}h${((xs[i] - start + 1) * cs).toFixed(2)}v${cs.toFixed(2)}H${(start * cs + half).toFixed(2)}z`; }
}
await writeFile(`assets/maps/${mapId}-radar.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${mapSize} ${mapSize}"><rect width="${mapSize}" height="${mapSize}" fill="#383a37"/><path d="${path}" fill="#c6b396"/></svg>`);
probe.dispose(); world.dispose();
