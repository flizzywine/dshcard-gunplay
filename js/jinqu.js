// Layout reconstructed from the Delta Force team's public 烬区 guide and overheads:
// https://www.taptap.cn/moment/562314642454482868
// World scale and architecture are rebuilt for this game's infantry movement.
import * as THREE from 'three';
import { mulberry32, clamp } from './util.js';

const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function jinquHeight(x, z) {
  const town = 2 * smooth(-54, -36, x);
  const ridge = 9 * (1 - smooth(-123, -79, x)) * smooth(3, 31, z);
  const camp = 2 * (1 - smooth(17, 31, Math.max(Math.abs(x + 18), Math.abs(z + 34))));
  return town + ridge + camp;
}
const P = (x, z) => new THREE.Vector3(x, jinquHeight(x, z), z);
export const JINQU_SECTORS = [
  { name: 'A · 岩下村', objectives: [{ name: 'A', title: '岩下村', x: -70, z: 57, radius: 9 }],
    spawns: { A: [[-120, 40], [-117, 50], [-116, 65], [-113, 78]], B: [[-48, 41], [-43, 58], [-45, 76], [-40, 79]] } },
  { name: 'B · 营地与贫民窟', objectives: [{ name: 'B1', title: '临时营地', x: -18, z: -34, radius: 9 }, { name: 'B2', title: '贫民窟', x: 14, z: 9, radius: 8 }],
    spawns: { A: [[-67, 38], [-60, 48], [-59, 66], [-73, 72]], B: [[38, -48], [40, -28], [45, 16], [38, 40]] } },
  { name: 'C · 城区纵深', objectives: [{ name: 'C1', title: '军需仓库', x: 65, z: -57, radius: 11 }, { name: 'C2', title: '办公区', x: 81, z: 17, radius: 10 }],
    spawns: { A: [[-16, -9], [15, -14], [17, 32], [34, 10]], B: [[117, -69], [120, -42], [119, 2], [119, 31]] } },
];

export const JINQU = {
  id: 'jinqu', name: '烬区', size: 280, extents: [-133, -88, 132, 103], seed: 73,
  surface: 'sand', styles: ['ally', 'insurgent'], sectors: JINQU_SECTORS,
  env: { sky: 'day', sunDir: [-0.48, 0.65, 0.38], sunColor: 0xffeed6, sun: 2.5, hemi: 0.7,
    sky2: 0xc7d6dc, ground: 0xa99a7c, fog: 0xd3c3a5, fogDensity: 0.0035,
    turbidity: 8, rayleigh: 1.1, mie: 0.008, exposure: 0.72, mountains: 'jinquStone', mountainHeightScale: 0.45, envIntensity: 0.55, weather: 'dust', ambient: 'wind' },
  build(w) {
    w.ground('jinquSand', 1200); w.terrain(jinquHeight, 'jinquSand'); w.bounds();
    const r = mulberry32(73);
    const at = (x, z, fn) => w.elevated(jinquHeight(x, z), fn);
    const box = (x, z, width, height, depth, m, y = 0, opt = {}) => at(x, z, () => w.box(x, y, z, width, height, depth, m, opt));
    const road = (x0, z0, x1, z1, width, m = 'asphalt') => {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(len / 1.5), dx = (x1 - x0) / len, dz = (z1 - z0) / len;
      // A ribbon follows the terrain without floating road slabs at elevation changes.
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= n; i++) for (const s of [-1, 1]) {
        const x = x0 + (x1 - x0) * i / n - dz * width / 2 * s, z = z0 + (z1 - z0) * i / n + dx * width / 2 * s;
        pos.push(x, w.terrainHeight(x, z) + 0.025, z); uv.push(i * len / n / 6, s * width / 12);
        if (s === -1 && i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      w.mesh(g, m, 0, 0, 0, { cast: false });
    };
    const wall = (x0, z0, x1, z1, openings = [], h = 2.2, m = 'jinquStucco') => at((x0 + x1) / 2, (z0 + z1) / 2, () => {
      w.wall(x0, z0, x1, z1, h, m === 'sandbag' ? 0.9 : 0.55, m, openings.map(([c, width]) => ({ c, w: width, y1: h })));
      if (m === 'sandbag') {
        const len = Math.hypot(x1 - x0, z1 - z0), horizontal = z0 === z1;
        for (let d = 0.1; d < len; d += 1.4) {
          if (openings.some(([c, width]) => Math.abs(d - c) < width / 2 + 0.15)) continue;
          const x = x0 + (x1 - x0) * d / len, z = z0 + (z1 - z0) * d / len;
          w.box(x, 0, z, horizontal ? 0.06 : 0.96, h, horizontal ? 0.96 : 0.06, 'metal', { collide: false });
        }
      }
    });
    const prop = (method, x, z, ...args) => at(x, z, () => w[method](x, z, ...args));

    const house = (x, z, width, depth, h, m = 'plaster', roofAccess = false, roofGaps = {}) => {
      m = ({ plaster: 'jinquStucco', plasterWhite: 'jinquWhite', plasterRed: 'jinquOchre', plasterBlue: 'jinquBlue' })[m] || m;
      at(x, z, () => {
        w.building(x, z, width, depth, h, { mat: m, floor: 'concrete', roofMat: 'concrete', doorWidth: 2.8,
          doors: { n: [0], s: [0], e: [0], w: [0] }, windows: { n: [-width / 2 + 2, width / 2 - 2], s: [-width / 2 + 2, width / 2 - 2] } });
        // Roof edges with a real stair landing opening on the east side.
        const gaps = (side, length) => roofGaps[side] === undefined ? [] : [{ c: length / 2 + roofGaps[side], w: 3, y1: 0.65 }];
        for (const side of [-1, 1]) w.wall(x - width / 2, z + side * depth / 2, x + width / 2, z + side * depth / 2, 0.65, 0.25, m, gaps(side < 0 ? 'n' : 's', width), h + 0.3);
        const west = roofAccess === 'w';
        w.wall(x - width / 2, z - depth / 2, x - width / 2, z + depth / 2, 0.65, 0.25, m,
          west ? [{ c: depth - 1.4, w: 2.4, y1: 0.65 }, ...gaps('w', depth)] : gaps('w', depth), h + 0.3);
        w.wall(x + width / 2, z - depth / 2, x + width / 2, z + depth / 2, 0.65, 0.25, m,
          roofAccess && !west ? [{ c: depth - 1.4, w: 2.4, y1: 0.65 }, ...gaps('e', depth)] : gaps('e', depth), h + 0.3);
        // Cornices, shuttered upper windows, exposed lintels and rooftop services.
        w.box(x, h - 0.25, z, width + 0.2, 0.18, depth + 0.2, 'plasterWhite', { collide: false });
        if (h > 6) for (const dz of [-depth / 2 - 0.17, depth / 2 + 0.17]) for (let dx = -width / 2 + 1.8; dx < width / 2 - 1; dx += 3.3) {
          w.box(x + dx, 4.2, z + dz, 1.25, 1.65, 0.12, 'windowDark', { collide: false });
          w.box(x + dx, 4.1, z + dz * 1.004, 1.45, 0.12, 0.2, 'plasterWhite', { collide: false });
        }
        w.box(x - width / 2 + 1.2, h + 0.3, z - depth / 2 + 1.2, 1.2, 0.8, 1, 'metal');
        if (width > 11) {
          const dish = w.mesh(new THREE.SphereGeometry(0.65, 12, 8, 0, Math.PI * 2, 0, 0.6), 'concrete', x + width / 2 - 1.5, h + 1, z - depth / 2 + 1.5);
          dish.rotation.x = -0.6;
          w.box(x + width / 2 - 1.5, h + 0.3, z - depth / 2 + 1.5, 0.1, 0.7, 0.1, 'darkMetal', { collide: false });
        }
        // Lintels and window sills add depth without sealing the playable openings.
        for (const dz of [-depth / 2 - 0.16, depth / 2 + 0.16]) {
          w.box(x, 2.4, z + dz, 1.85, 0.16, 0.35, 'concrete', { collide: false });
          for (const dx of [-width / 2 + 2, width / 2 - 2]) {
            w.box(x + dx, 0.92, z + dz, 1.55, 0.12, 0.4, 'concrete', { collide: false });
            w.box(x + dx - 0.72, 1, z + dz, 0.13, 1.15, 0.14, 'wood', { collide: false });
            w.box(x + dx + 0.72, 1, z + dz, 0.13, 1.15, 0.14, 'wood', { collide: false });
          }
        }
        if (roofAccess) {
          const side = west ? -1 : 1;
          const stairZ = z + depth / 2 - 1.4;
          const footY = jinquHeight(x + side * (width / 2 + 7.5), stairZ) - jinquHeight(x, z);
          w.elevated(footY, () => w.stairs(x + side * (width / 2 + 4), stairZ, 1.8, 7, h + 0.3 - footY, west ? 'e' : 'w', 'concrete'));
          w.box(x + side * (width / 2 + 0.35), h, z + depth / 2 - 1.4, 1.1, 0.3, 2, 'concrete');
        }
      });
    };
    const sign = (x, z, text, sub, rot = 0, y = 2.6) => {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
      const ctx = cv.getContext('2d'); ctx.fillStyle = '#34433c'; ctx.fillRect(0, 0, 512, 128);
      ctx.strokeStyle = '#c9c3a8'; ctx.lineWidth = 5; ctx.strokeRect(8, 8, 496, 112);
      ctx.fillStyle = '#eee5c8'; ctx.textAlign = 'center'; ctx.font = 'bold 44px sans-serif'; ctx.fillText(text, 256, 59);
      ctx.font = '22px sans-serif'; ctx.fillText(sub, 256, 99);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide });
      const mesh = w.mesh(new THREE.PlaneGeometry(5, 1.25), material, x, jinquHeight(x, z) + y, z, { rotY: rot });
      mesh.userData.ownedTexture = tex;
    };

    // The highway bends out of the western valley into a T junction at the town.
    road(-131, -10, -54, -10, 10); road(-54, -10, -37, -18, 10);
    road(-37, -18, 127, -18, 10); road(39, -85, 39, 87, 9);
    road(-45, 24, 126, 48, 5, 'dirt'); road(-120, 73, -70, 57, 5, 'dirt'); road(-70, 57, -43, 21, 5, 'dirt');
    for (let x = -125; x < 127; x += 9) if (x < -57 || x > -30) box(x, x < -57 ? -10 : -18, 3.4, 0.015, 0.14, 'whitePaint', 0.05, { collide: false });
    for (let z = -77; z < 81; z += 9) box(39, z, 0.14, 0.015, 3.4, 'yellowPaint', 0.05, { collide: false });

    // A: low village under the western cliff, two accessible firing roofs.
    house(-84, 39, 12, 9, 4.3, 'plaster', true);
    house(-67, 33, 11, 10, 4.3, 'plasterWhite');
    house(-85, 73, 12, 9, 4.3, 'plasterWhite', true);
    house(-63, 76, 12, 10, 4.3, 'plaster');
    house(-49, 22, 10, 8, 5.2, 'plasterRed');
    house(-49, 91, 11, 8, 4.3, 'plaster');
    wall(-91, 49, -91, 64, [[8, 4]], 1.3); wall(-77, 83, -53, 83, [[12, 4]], 1.3);
    prop('car', -62, 54, 0.5, 0x8a805c, true); prop('crateStack', -77, 57);
    prop('sandbags', -91, 56, 4, Math.PI / 2); prop('jersey', -57, 44);
    prop('awning', -72, 45, 6, 3.5, 2.8, 'tarp');
    prop('sandbags', -111, 37, 5); prop('sandbags', -108, 67, 5);
    sign(-84, 34.3, '岩下村', 'ROCK VILLAGE', Math.PI);

    // B1: compact sand-walled compound, one central building, two guard towers.
    house(-18, -34, 12, 10, 4.2, 'plasterRed', true);
    wall(-37, -53, -1, -53, [[27, 4]], 2.2, 'sandbag');
    wall(-37, -14, -1, -14, [[17, 5], [31, 2.6]], 2.2, 'sandbag');
    wall(-37, -53, -37, -14, [[24, 4]], 2.2, 'sandbag');
    wall(-1, -53, -1, -14, [[17, 4]], 2.2, 'sandbag');
    for (const [x, z] of [[-32, -48], [-6, -20]]) at(x, z, () => {
      for (const dx of [-1.3, 1.3]) for (const dz of [-1.3, 1.3]) w.box(x + dx, 0, z + dz, 0.2, 6.6, 0.2, 'wood');
      w.box(x, 4.3, z, 3.2, 0.2, 3.2, 'wood');
      w.box(x, 4.5, z - 1.55, 3.2, 1, 0.12, 'wood');
      for (const dx of [-1.55, 1.55]) w.box(x + dx, 4.5, z, 0.12, 1, 3.2, 'wood');
      const footY = jinquHeight(x, z + 8.5) - jinquHeight(x, z);
      w.elevated(footY, () => w.stairs(x, z + 5, 1.8, 7, 4.5 - footY, 'n', 'wood'));
      w.box(x, 6.6, z, 3.8, 0.15, 3.8, 'metalRoof');
    });
    prop('crateStack', -9, -39); prop('crateStack', -29, -29); prop('container', -12, -47, 0, 'containerGreen');
    prop('sandbags', -22, -19, 5); prop('truck', -8, -8, Math.PI / 2, 0x62604c); prop('truckCollider', -8, -8, Math.PI / 2);
    w.elevated(8.5, () => w.tank(-21, -35, 0.85, 1.2, 'metal'));
    sign(-18, -28.8, '临时营地', 'B1 / FORWARD CAMP', 0, 3.2);
    // Radio antenna.
    box(-22, -36, 0.18, 12, 0.18, 'darkMetal', 4.5);
    for (let y = 7; y < 15; y += 2) box(-22, -36, 2.2, 0.08, 0.08, 'darkMetal', y);

    // B2: connected, uneven roofs enclosing a three-entry slum courtyard.
    house(5, -2, 13, 10, 4.3, 'plaster', 'w', { e: 0 });
    house(22, -2, 13, 10, 4.3, 'plasterWhite', false, { w: 0, s: 3 });
    house(1, 19, 10, 13, 4.3, 'plasterBlue');
    house(24, 24, 13, 10, 4.3, 'plaster', true, { n: -1 });
    house(25, 10, 9, 8, 4.3, 'plasterRed', false, { n: 0, s: -2 });
    house(-15, 15, 12, 11, 5.2, 'plaster');
    house(-16, 37, 13, 10, 4.3, 'plasterRed');
    house(10, 43, 14, 9, 4.3, 'plasterWhite');
    // Short planks bridge the roof gaps; they are walkable, with open landings.
    box(13.5, -2, 5, 0.22, 2.4, 'wood', 4.3);
    box(25, 4.5, 2.4, 0.22, 5, 'wood', 4.3);
    box(23, 17.5, 2.4, 0.22, 7, 'wood', 4.3);
    box(9, 11, 3, 0.25, 1, 'wood', 0); // low courtyard cover
    prop('awning', 14, 7, 6, 4, 3, 'clothYellow'); prop('crateStack', 13, 16);
    prop('barrel', 19, 13, 'containerBlue'); prop('car', 30, -10, Math.PI / 2, 0xaaa591, true);
    sign(9, 3.2, '集市 / 贫民窟', 'B2 / OLD QUARTER');

    // C1: isolated northern logistics warehouse with two perimeter walls.
    wall(47, -82, 91, -82, [[12, 4], [34, 4]], 2.8, 'concrete');
    wall(47, -33, 91, -33, [[18, 6]], 2.8, 'concrete');
    wall(47, -82, 47, -33, [[29, 5]], 2.8, 'concrete');
    wall(91, -82, 91, -33, [[28, 4]], 2.8, 'concrete');
    wall(51, -77, 86, -77, [[9, 4], [29, 4]], 1.5);
    wall(51, -38, 86, -38, [[14, 6]], 1.5);
    at(65, -57, () => {
      w.building(65, -57, 26, 27, 8, { mat: 'concrete', roofMat: 'metalRoof', floor: 'concrete', doorWidth: 3.2,
        doors: { s: [-6, 5], n: [-7, 7], e: [0], w: [-5] }, windows: { s: [-10, 10], w: [6], e: [-8, 8] } });
      // Raised catwalk facing the main gate, with two climbable staircases.
      w.box(65, 3.3, -66, 25, 0.25, 7, 'wood');
      w.box(65, 3.55, -62.5, 16, 0.65, 0.15, 'darkMetal');
      w.stairs(55, -58.5, 1.8, 8, 3.55, 'n', 'concrete');
      w.stairs(75, -58.5, 1.8, 8, 3.55, 'n', 'concrete');
      for (const x of [58, 67, 72]) w.crateStack(x, -53);
      for (let z = -68; z <= -48; z += 5) {
        w.box(52.7, 0, z, 0.4, 7.8, 0.4, 'darkMetal'); w.box(77.3, 0, z, 0.4, 7.8, 0.4, 'darkMetal');
      }
      for (let x = 53; x < 78; x += 4) w.box(x, 8, -57, 0.18, 0.3, 27, 'darkMetal', { collide: false });
    });
    prop('container', 82, -58, Math.PI / 2, 'containerGray'); prop('crateStack', 56, -42);
    prop('sandbags', 66, -39, 5); prop('truck', 87, -26, Math.PI / 2, 0x86816b); prop('truckCollider', 87, -26, Math.PI / 2);
    sign(65, -43.2, '军需仓库', 'C1 / LOGISTICS', 0, 5);

    // C2: medium-rise offices around an open court, west/northeast/south lanes.
    house(77, -3, 27, 11, 9, 'plasterWhite');
    house(101, 16, 12, 29, 8, 'plasterRed');
    house(76, 39, 26, 10, 7, 'plaster');
    house(55, 25, 11, 14, 4.3, 'plasterWhite', true);
    house(55, 3, 11, 10, 6, 'plaster');
    house(110, -48, 12, 13, 7, 'plaster');
    house(107, 63, 15, 12, 6, 'plasterWhite');
    house(67, 67, 15, 12, 6, 'plaster');
    house(9, -66, 14, 13, 5, 'plaster');
    // Courtyard colonnade and north-east pedestrian passage remain open below.
    for (const z of [4, 12, 20, 28]) box(93, z, 0.5, 4.2, 0.5, 'concrete');
    box(93, 16, 3.5, 0.3, 30, 'concrete', 4.2);
    prop('car', 84, 12, 0.7, 0x303b36, true); prop('sandbags', 73, 7, 4);
    prop('crateStack', 88, 28); prop('jersey', 65, 17, Math.PI / 2); prop('barrel', 75, 24, 'containerGreen');
    sign(77, 2.8, '行政办公区', 'C2 / ADMINISTRATION', 0, 3.4);

    // Shared streetscape: curbs, power lines, palms, shutters, wrecks and rubble.
    for (const [x, z, rot] of [[-46, -6, 0], [7, -23, 0], [34, -61, 0], [44, 37, Math.PI], [106, -23, 0]]) prop('lampPost', x, z, 0xffe2b1, rot, 12, false);
    for (const [x, z] of [[-97, 23], [-59, 85], [-42, 5], [-32, -59], [-5, -60], [29, 36], [46, 66], [89, 47], [114, -17], [116, 78]]) prop('tree', x, z, 0.8 + r() * 0.25, 'palm');
    prop('car', 39, -3, 0.1, 0xb6aa8c, true); prop('car', 43, 56, -0.3, 0x625746, true); prop('jersey', 33, -31);
    for (const [x, z] of [[-106, 9], [-62, -25], [16, -27], [64, -27], [112, -28]]) {
      box(x, z, 0.18, 10, 0.18, 'wood'); box(x, z, 3, 0.1, 0.12, 'darkMetal', 9.5);
      if (x < 100) {
        const points = [new THREE.Vector3(x, jinquHeight(x, z) + 9.5, z), new THREE.Vector3(x + 15, jinquHeight(x, z) + 8, z), new THREE.Vector3(x + 30, jinquHeight(x + 30, z) + 9.5, z)];
        const curve = new THREE.CatmullRomCurve3(points);
        w.mesh(new THREE.TubeGeometry(curve, 14, 0.025, 3, false), 'darkMetal', 0, 0, 0, { cast: false });
      }
    }
    // Rock escarpments frame the western approach without blocking its three lanes.
    for (const [x, z, s] of [[-127, 16, 9], [-111, 9, 8], [-94, 15, 7], [-97, 89, 7], [-112, 94, 9], [-41, 85, 5], [-41, -63, 8], [-56, -48, 6], [-71, -30, 7]]) {
      at(x, z, () => { const mesh = w.mesh(new THREE.DodecahedronGeometry(s, 0), 'jinquStone', x, s * 0.3, z); mesh.scale.set(1.5, 0.9, 1); });
      const y = jinquHeight(x, z); w.collider(x - s, y, z - s * 0.65, x + s, y + s * 0.8, z + s * 0.65);
    }
    for (let i = 0; i < 85; i++) {
      const x = -125 + r() * 250, z = -83 + r() * 180;
      // Small fragments do not introduce invisible navigation blockers.
      if (Math.abs(z + 18) < 7 || Math.abs(x - 39) < 6) continue;
      box(x, z, 0.25 + r() * 0.6, 0.08 + r() * 0.15, 0.3 + r() * 0.7, i % 3 ? 'rock' : 'brick', 0, { collide: false, rotY: r() * Math.PI });
    }
    // Outside the boundary, silhouettes continue the settlement into the desert.
    for (let i = 0; i < 15; i++) {
      const x = -26 + i * 11, z = -101 - r() * 12;
      at(x, z, () => w.block(x, z, 7 + r() * 4, 5 + r() * 8, 9, i % 2 ? 'plaster' : 'plasterWhite', { windows: true }));
    }
    w.spawns.A = JINQU_SECTORS[0].spawns.A.map(([x, z]) => P(x, z));
    w.spawns.B = JINQU_SECTORS[0].spawns.B.map(([x, z]) => P(x, z));
    w.flagPos = [P(-70, 57), P(14, 9), P(81, 17)];
    w.sectors = JINQU_SECTORS.map(s => ({ ...s, objectives: s.objectives.map(o => ({ ...o, pos: P(o.x, o.z) })),
      spawns: Object.fromEntries(Object.entries(s.spawns).map(([team, points]) => [team, points.map(([x, z]) => P(x, z))])) }));
    w.mapRoads = [[-131, -10, -54, -10], [-54, -10, -37, -18], [-37, -18, 127, -18], [39, -85, 39, 87]];
  },
};
