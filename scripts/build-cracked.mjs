import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Matrix4, Vector3 } from 'three';
import { readGraybox } from '../js/graybox-geometry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = path.resolve(process.argv[2] || 'D:/Workspace/deltaforce-map-extract/exports/graybox/cracked-graybox.glb');
const bytes = fs.readFileSync(input), gameBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), meshes = readGraybox(gameBuffer);
// UE-authored meshes use the opposite front-face winding from Three/Rapier.
// The exporter rotates their coordinates but does not reverse their triangles.
// Its generated terrain already has the correct upward winding.
for (const m of meshes) if (m.name !== 'Terrain_4m_graybox') {
  for (let i = 0; i < m.indices.length; i += 3) { const b = m.indices[i + 1]; m.indices[i + 1] = m.indices[i + 2]; m.indices[i + 2] = b; }
  for (let i = 0; i < m.normals.length; i++) m.normals[i] = -m.normals[i];
}
const out = path.join(root, 'assets/maps'); fs.mkdirSync(out, { recursive: true });
let vertexCount = 0, indexCount = 0;
for (const m of meshes) { vertexCount += m.vertices.length / 3 * m.matrices.length; indexCount += m.indices.length * m.matrices.length; }
const vertices = new Float32Array(vertexCount * 3), indices = new Uint32Array(indexCount), v = new Vector3(), matrix = new Matrix4();
let vo = 0, io = 0;
for (const m of meshes) for (const values of m.matrices) {
  matrix.fromArray(values); const base = vo / 3, flip = matrix.determinant() < 0;
  for (let i = 0; i < m.vertices.length; i += 3) { v.fromArray(m.vertices, i).applyMatrix4(matrix); vertices[vo++] = v.x; vertices[vo++] = v.y; vertices[vo++] = v.z; }
  for (let i = 0; i < m.indices.length; i += 3) { indices[io++] = base + m.indices[i]; indices[io++] = base + m.indices[i + (flip ? 2 : 1)]; indices[io++] = base + m.indices[i + (flip ? 1 : 2)]; }
}
const header = Buffer.alloc(12); header.writeUInt32LE(0x444b5243); header.writeUInt32LE(vertexCount, 4); header.writeUInt32LE(indexCount, 8);
fs.writeFileSync(path.join(out, 'cracked-collision.bin'), Buffer.concat([header, Buffer.from(vertices.buffer), Buffer.from(indices.buffer)]));
fs.writeFileSync(path.join(out, 'cracked.glb'), Buffer.from(gameBuffer));
const meta = {
  size: 840, extents: [-398, -248, 398, 248],
  provenance: { title: '三角洲行动 · 烬区（Cracked）本地灰盒', sourceSha256: createHash('sha256').update(bytes).digest('hex'), sha256: createHash('sha256').update(Buffer.from(gameBuffer)).digest('hex'), transform: 'Unreal (x,z,-y)/100, centered at (950,0,900) metres; authored triangle winding and normals reversed', note: 'Static low-detail geometry. A rooftop water tank, A destructible village house and C1 warehouse use intact initial geometry. Runtime destruction is not implemented.' },
  stats: { uniqueMeshes: meshes.length, instances: meshes.reduce((n, m) => n + m.matrices.length, 0), collisionVertices: vertexCount, collisionTriangles: indexCount / 3 },
  landmarks: { a: [-151.76375, -15.753585, -50.3192], b1: [-89.09375, -8.47342, 38.6008], b2: [10.7211, -11.876471, 36.7519], c1: [101.7755, -9.8281836, 137.2181], c2: [181.6155, -11.671328, 45.6881] },
  spawnAnchors: { A: [[-133.32, -13.713082, -19.85], [-138.28, -13.191271, -18.41], [-123.04, -11.781403, -59.4], [-130.81, -12.207896, -55.19]], B: [[123, -11, 106], [135, -11, 111], [119, -11, 120], [143, -11, 95]] },
  navigationBounds: [-235, -135, 235, 190], navigationHeights: [-40, 25],
};
fs.writeFileSync(path.join(out, 'cracked.json'), JSON.stringify(meta));
console.log(JSON.stringify({ ...meta.stats, renderBytes: bytes.length, collisionBytes: 12 + vertices.byteLength + indices.byteLength }));
