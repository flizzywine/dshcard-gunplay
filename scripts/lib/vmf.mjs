// Valve KeyValues/VMF reader. Repeated keys remain ordered (solids/sides/entities).
export function parseVmf(text) {
  const tokens = text.match(/\/\/[^\r\n]*|"(?:\\.|[^"\\])*"|[{}]|[^\s{}"]+/g)?.filter(t => !t.startsWith('//')) || [];
  let index = 0;
  const value = token => token?.startsWith('"') ? token.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\') : token;
  function block(nested = false) {
    const result = [];
    while (index < tokens.length) {
      const key = tokens[index++];
      if (key === '}') { if (!nested) throw new Error('Unexpected VMF closing brace'); return result; }
      const next = tokens[index++];
      if (next === undefined) throw new Error('Truncated VMF');
      result.push(next === '{' ? { key: value(key), children: block(true) } : { key: value(key), value: value(next) });
    }
    if (nested) throw new Error('Unclosed VMF block');
    return result;
  }
  return block();
}
export const children = (node, key) => (node.children || node).filter(n => n.key === key);
export const field = (node, key, fallback = '') => children(node, key)[0]?.value ?? fallback;
export const numbers = text => (text.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = a => Math.hypot(...a);
const unit = a => a.map(x => x / length(a));

export function brushFaces(solid) {
  const sides = children(solid, 'side');
  let planes = sides.map(side => {
    const p = numbers(field(side, 'plane'));
    const a = p.slice(0, 3), b = p.slice(3, 6), c = p.slice(6, 9);
    const normal = unit(cross(sub(b, a), sub(c, a)));
    return { normal, distance: dot(normal, a), side };
  });
  function intersect(planes) {
    const vertices = [];
    for (let i = 0; i < planes.length; i++) for (let j = i + 1; j < planes.length; j++) for (let k = j + 1; k < planes.length; k++) {
      const a = planes[i], b = planes[j], c = planes[k], bc = cross(b.normal, c.normal), det = dot(a.normal, bc);
      if (Math.abs(det) < 1e-7) continue;
      const ca = cross(c.normal, a.normal), ab = cross(a.normal, b.normal);
      const p = bc.map((x, n) => (a.distance * x + b.distance * ca[n] + c.distance * ab[n]) / det);
      if (planes.some(plane => dot(plane.normal, p) > plane.distance + 0.05)) continue;
      if (!vertices.some(v => length(sub(v, p)) < 0.05)) vertices.push(p);
    }
    return vertices;
  }
  let vertices = intersect(planes);
  if (!vertices.length) {
    planes = planes.map(p => ({ ...p, normal: p.normal.map(x => -x), distance: -p.distance }));
    vertices = intersect(planes);
  }
  return planes.flatMap(plane => {
    const points = vertices.filter(v => Math.abs(dot(plane.normal, v) - plane.distance) < 0.1);
    if (points.length < 3) return [];
    const center = points.reduce((p, v) => p.map((x, n) => x + v[n] / points.length), [0, 0, 0]);
    const axis = Math.abs(plane.normal[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = unit(cross(axis, plane.normal)), v = cross(plane.normal, u);
    points.sort((a, b) => Math.atan2(dot(sub(a, center), v), dot(sub(a, center), u)) - Math.atan2(dot(sub(b, center), v), dot(sub(b, center), u)));
    return [{ points, normal: plane.normal, material: field(plane.side, 'material').toLowerCase(), displacement: children(plane.side, 'dispinfo')[0] }];
  });
}

export function triangulateFace(face) {
  const disp = face.displacement;
  if (!disp || face.points.length !== 4) return face.points.slice(1, -1).map((p, i) => [face.points[0], p, face.points[i + 2]]);
  const start = numbers(field(disp, 'startposition')), n = 2 ** Number(field(disp, 'power'));
  let first = 0;
  for (let i = 1; i < 4; i++) if (length(sub(face.points[i], start)) < length(sub(face.points[first], start))) first = i;
  const corners = Array.from({ length: 4 }, (_, i) => face.points[(first + i) % 4]);
  const normals = children(disp, 'normals')[0], distances = children(disp, 'distances')[0], offsets = children(disp, 'offsets')[0];
  const vertices = [];
  for (let y = 0; y <= n; y++) {
    const nr = numbers(field(normals || [], 'row' + y)), dr = numbers(field(distances || [], 'row' + y)), or = numbers(field(offsets || [], 'row' + y));
    for (let x = 0; x <= n; x++) {
      const u = x / n, v = y / n;
      vertices.push(corners[0].map((a, i) => a * (1 - u) * (1 - v) + corners[1][i] * u * (1 - v) + corners[2][i] * u * v + corners[3][i] * (1 - u) * v + (nr[x * 3 + i] || 0) * (dr[x] || 0) + (or[x * 3 + i] || 0)));
    }
  }
  const triangles = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const a = y * (n + 1) + x, b = a + 1, c = a + n + 1, d = c + 1;
    triangles.push([vertices[a], vertices[b], vertices[d]], [vertices[a], vertices[d], vertices[c]]);
  }
  return triangles;
}
