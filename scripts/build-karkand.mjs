// Preserve the downloaded community map's authored brush/displacement geometry.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseVmf, children, field, numbers, brushFaces, triangulateFace } from './lib/vmf.mjs';

const path = process.argv[2] || 'output/sources/karkand/karkand_b3.vmf';
const bytes = await readFile(path), vmf = parseVmf(bytes.toString()), entities = children(vmf, 'entity');
const scale = 0.0254, offset = [4096, -2048, 2560];
const convert = ([x, y, z]) => [(x + offset[0]) * scale, (z + offset[2]) * scale, -(y + offset[1]) * scale].map(v => +v.toFixed(4));
const groups = new Map(), collision = { vertices: [], indices: [] }, clips = { vertices: [], indices: [] };
const stats = { brushes: 0, displacements: 0, modelProxies: 0, omittedModels: 0 };
function append(mesh, triangle) { const i = mesh.vertices.length / 3; mesh.vertices.push(...triangle.flat()); mesh.indices.push(i, i + 1, i + 2); }
function emit(triangle, color, clip = false, collide = true) {
  const points = triangle.map(convert);
  if (collide) append(clip ? clips : collision, points);
  if (color) {
    if (!groups.has(color)) groups.set(color, { color, vertices: [], indices: [] });
    append(groups.get(color), points);
  }
}
function solid(node) {
  const faces = brushFaces(node), displaced = faces.some(f => f.displacement);
  if (!faces.length) return;
  stats.brushes++;
  for (const face of faces) {
    if (displaced && !face.displacement) continue;
    if (/skybox|tools(?:trigger|hint|skip|areaportal|occluder|blocklight)/.test(face.material)) continue;
    // Fences and player clips block actors but keep the original sight lines.
    const clip = /tools.*clip/.test(face.material), tool = face.material.startsWith('tools/');
    if (face.displacement) stats.displacements++;
    const color = clip || tool ? null : /water|liquid/.test(face.material) ? '#526f74' : /wood|crate|plywood/.test(face.material) ? '#866748' : /metal|asphalt|road/.test(face.material) ? '#626967' : face.normal[2] > 0.65 ? '#9c927e' : '#bfa886';
    for (const tri of triangulateFace(face)) emit(tri, color, clip, !/water|liquid/.test(face.material));
  }
}
for (const w of children(vmf, 'world')) for (const s of children(w, 'solid')) solid(s);
for (const e of entities) if (['func_detail', 'func_brush', 'func_wall', 'func_breakable'].includes(field(e, 'classname'))) for (const s of children(e, 'solid')) solid(s);

// MDLs are not in this map package. Keep important model covers as explicit,
// documented proxies; decorative windows, grass and wires add no collision.
function box(origin, size, angles, color) {
  const yaw = (angles[1] || 0) * Math.PI / 180;
  const v = Array.from({ length: 8 }, (_, i) => {
    const x = (i & 1 ? 1 : -1) * size[0] / 2, y = (i & 2 ? 1 : -1) * size[1] / 2;
    return [origin[0] + x * Math.cos(yaw) - y * Math.sin(yaw), origin[1] + x * Math.sin(yaw) + y * Math.cos(yaw), origin[2] + (i & 4 ? size[2] : 0)];
  });
  for (const f of [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]) {
    emit([v[f[0]], v[f[1]], v[f[2]]], color); emit([v[f[0]], v[f[2]], v[f[3]]], color);
  }
  stats.modelProxies++;
}
const omissions = new Map(), proxies = [];
for (const e of entities) {
  if (!field(e, 'classname').startsWith('prop_') || field(e, 'solid') === '0') continue;
  const model = field(e, 'model').toLowerCase(), p = numbers(field(e, 'origin')), angles = numbers(field(e, 'angles', '0 0 0'));
  if (p.length !== 3) continue;
  let size = null, color = '#727e7b';
  if (model.startsWith('models/vehicles/')) {
    size = /transport|truck|minibus/.test(model) ? [250, 90, 95] : /train/.test(model) ? [440, 110, 125] : /abrams/.test(model) ? [280, 135, 65] : [185, 80, 55];
    if (/windows|turret/.test(model)) size = null;
  } else if (/train_cart/.test(model)) size = [440, 110, 110];
  else if (/crate|ply_box/.test(model)) { size = [50, 50, 50]; color = '#866748'; }
  else if (/barrel_01/.test(model)) size = [24, 24, 40];
  else if (/gas_pump/.test(model)) size = [32, 28, 64];
  else if (/dumpster/.test(model)) size = [100, 60, 55];
  else if (/sandbag/.test(model)) { size = [96, 30, 36]; color = '#8c8261'; }
  else if (/concrete_barrier|barrier_crete/.test(model)) { size = [112, 24, 40]; color = '#9c9786'; }
  else if (/ir_concrete_block/.test(model)) { size = [64, 32, 32]; color = '#9c9786'; }
  else if (/mog_metal_wall/.test(model)) { size = [/01s/.test(model) ? 64 : 128, 8, 88]; color = '#68716a'; }
  else if (/brickwall/.test(model) && !/pillar/.test(model)) { size = [128, 12, /fence/.test(model) ? 72 : 96]; color = '#b39a79'; }
  else if (/container_01_closed/.test(model)) size = [240, 96, 96];
  // Open containers retain their entrance: two side walls and a roof, not a solid box.
  else if (/container_01_open/.test(model)) {
    const yaw = (angles[1] || 0) * Math.PI / 180;
    for (const [x, y, z, sx, sy, sz] of [[0, -46, 0, 240, 4, 96], [0, 46, 0, 240, 4, 96], [0, 0, 92, 240, 96, 4]]) box([p[0] + x * Math.cos(yaw) - y * Math.sin(yaw), p[1] + x * Math.sin(yaw) + y * Math.cos(yaw), p[2] + z], [sx, sy, sz], angles, color);
    continue;
  }
  if (size) { box(p, size, angles, color); proxies.push({ model, origin: p, size, angles }); }
  else { omissions.set(model, (omissions.get(model) || 0) + 1); stats.omittedModels++; }
}
const spawnEntities = entities.filter(e => field(e, 'classname') === 'ins_spawnpoint');
const spawns = team => spawnEntities.filter(e => field(e, 'TeamNum') === team).map(e => convert(numbers(field(e, 'origin'))));
const landmarks = Object.fromEntries(entities.filter(e => field(e, 'classname') === 'point_controlpoint').map(e => [field(e, 'targetname'), convert(numbers(field(e, 'origin')))]));
// Inspection anchors on the authored bridge deck / eastern industrial street.
landmarks.bridge = convert([1024, 7392, -1248]);
landmarks.industrial = convert([4544, 6384, -1248]);
const data = {
  size: 840,
  provenance: { title: 'Karkand b3 — gehstur / G4RY, Insurgency 2014 community remake', url: 'https://steamcommunity.com/sharedfiles/filedetails/?id=394489681', sha256: createHash('sha256').update(bytes).digest('hex'), scale, offset, transform: '(x+4096,z+2560,2048-y) * 0.0254', note: 'Source remake, not BF2 original assets. Original brush geometry and terrain; model covers approximate; decorations omitted.' },
  stats, groups: [...groups.values()], collision, clips,
  spawns: { A: spawns('2'), B: spawns('3') }, landmarks, proxies, omittedModels: Object.fromEntries(omissions),
  // Rasterisation bounds only; all authored geometry remains rendered/collidable.
  navigationBounds: [-195, -230, 300, 245], navigationHeights: [20, 60],
};
await mkdir('assets/maps', { recursive: true });
await writeFile('assets/maps/karkand.json', JSON.stringify(data));
console.log(JSON.stringify({ ...stats, triangles: collision.indices.length / 3, spawns: [data.spawns.A.length, data.spawns.B.length], landmarks, bytes: JSON.stringify(data).length }));
