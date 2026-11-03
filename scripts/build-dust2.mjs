// Offline, deterministic VMF -> flat-colour geometry. No Valve textures/models required.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseVmf, children, field, numbers, brushFaces, triangulateFace } from './lib/vmf.mjs';

const source = process.argv[2] || 'output/sources/dust2/de_dust2.vmf';
const bytes = await readFile(source), vmf = parseVmf(bytes.toString());
const scale = 0.0254;
const convert = ([x, y, z]) => [x * scale, (z + 384) * scale, -(y - 1024) * scale].map(v => +v.toFixed(4));
const groups = new Map(), collision = { vertices: [], indices: [] }, clips = { vertices: [], indices: [] };
const stats = { brushes: 0, displacements: 0, crateProxies: 0, otherProxies: 0, excludedSkybox: 0 };
function append(mesh, triangle) { const i = mesh.vertices.length / 3; mesh.vertices.push(...triangle.flat()); mesh.indices.push(i, i + 1, i + 2); }
function emit(triangle, color, clip = false) {
  const points = triangle.map(convert);
  append(clip ? clips : collision, points);
  if (color) {
    if (!groups.has(color)) groups.set(color, { color, vertices: [], indices: [] });
    append(groups.get(color), points);
  }
}
function colorFor(face) {
  if (face.material.startsWith('tools/')) return null;
  if (/crate|wood|door/.test(face.material)) return '#796049';
  if (/metal/.test(face.material)) return '#69716e';
  if (face.normal[2] > 0.65) return '#938978';
  return '#c0a680';
}
function solid(node) {
  const faces = brushFaces(node);
  if (!faces.length) return;
  if (faces.some(f => f.points.some(p => Math.abs(p[0]) > 4096 || Math.abs(p[1]) > 4096))) { stats.excludedSkybox++; return; }
  stats.brushes++;
  const displaced = faces.some(f => f.displacement);
  for (const face of faces) {
    if (displaced && !face.displacement) continue; // Source displacement brushes have no solid base.
    if (/skybox|tools(?:trigger|hint|skip|areaportal|occluder)/.test(face.material)) continue;
    const clip = /tools.*clip/.test(face.material);
    if (face.displacement) stats.displacements++;
    for (const triangle of triangulateFace(face)) emit(triangle, clip ? null : colorFor(face), clip);
  }
}
for (const world of children(vmf, 'world')) for (const s of children(world, 'solid')) solid(s);
const entities = children(vmf, 'entity');
for (const e of entities) if (['func_detail', 'func_brush', 'func_wall'].includes(field(e, 'classname'))) for (const s of children(e, 'solid')) solid(s);

// Preserve authored crate positions/orientations. Other model covers use deliberately
// coarse proxies: the VMF references MDLs but does not contain their actual hulls.
function propBox(origin, size, angles, color) {
  const yaw = angles[1] * Math.PI / 180;
  const vertices = Array.from({ length: 8 }, (_, i) => {
    const x = (i & 1 ? 1 : -1) * size[0] / 2, y = (i & 2 ? 1 : -1) * size[1] / 2;
    return [origin[0] + x * Math.cos(yaw) - y * Math.sin(yaw), origin[1] + x * Math.sin(yaw) + y * Math.cos(yaw), origin[2] + (i & 4 ? 1 : -1) * size[2] / 2];
  });
  for (const f of [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]) {
    emit([vertices[f[0]], vertices[f[1]], vertices[f[2]]], color);
    emit([vertices[f[0]], vertices[f[2]], vertices[f[3]]], color);
  }
}
const omittedModels = new Map();
for (const e of entities) {
  const classname = field(e, 'classname');
  if (!classname.startsWith('prop_') || field(e, 'solid') === '0') continue;
  const origin = numbers(field(e, 'origin')), angles = numbers(field(e, 'angles', '0 0 0'));
  if (origin.length !== 3 || Math.abs(origin[0]) > 4096 || Math.abs(origin[1]) > 4096) continue;
  const model = field(e, 'model').toLowerCase(), crate = model.match(/du_crate_(\d+)x(\d+)/);
  if (crate) { propBox(origin, [+crate[1], +crate[1], +crate[2]], angles, '#876548'); stats.crateProxies++; }
  else if (/oildrum001/.test(model)) { propBox([origin[0], origin[1], origin[2] + 24], [24, 24, 48], angles, '#606b66'); stats.otherProxies++; }
  else if (/car00[234]/.test(model)) { propBox([origin[0], origin[1], origin[2] + 24], [180, 72, 48], angles, '#707d79'); stats.otherProxies++; }
  else omittedModels.set(model, (omittedModels.get(model) || 0) + 1);
}
const spawns = kind => entities.filter(e => field(e, 'classname') === kind).map(e => convert(numbers(field(e, 'origin'))));
const data = {
  provenance: { title: 'Dust II — Counter-Strike: Source', url: 'https://temaps.com/files/source/vmf-maps/de_dust2.vmf', sha256: createHash('sha256').update(bytes).digest('hex'), scale, transform: 'Source (x,y,z) -> (x,z+384,1024-y) * 0.0254; 72-unit player ≈ 1.83 m', note: 'Local graybox study. Original brush/displacement geometry; model covers are approximations. No Valve textures or models included.' },
  stats, groups: [...groups.values()], collision, clips,
  spawns: { A: spawns('info_player_terrorist'), B: spawns('info_player_counterterrorist') },
  landmarks: Object.fromEntries(Object.entries({ A: [1160, 2480, 96], B: [-1536, 2680, 0], mid: [-448, 1536, -128], long: [1280, 1280, 0], short: [480, 1792, 96], tunnels: [-1568, 1248, 0] }).map(([name, p]) => [name, convert(p)])),
  omittedModels: Object.fromEntries(omittedModels),
};
await mkdir('assets/maps', { recursive: true });
await writeFile('assets/maps/dust2.json', JSON.stringify(data));
console.log(JSON.stringify({ ...stats, triangles: collision.indices.length / 3, clipTriangles: clips.indices.length / 3, bytes: JSON.stringify(data).length, spawns: [data.spawns.A.length, data.spawns.B.length] }));
