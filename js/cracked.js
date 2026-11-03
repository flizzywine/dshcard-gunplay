import * as THREE from 'three';
import { LayeredNavigation } from './layered-navigation.js';
import { readGraybox, readGrayboxCollision } from './graybox-geometry.js';

let asset;
export const CRACKED = {
  id: 'cracked', name: '烬区 · 战场灰盒', size: 840, seed: 11,
  surface: 'concrete', styles: ['ally', 'insurgent'],
  sourceSubtitle: '原尺度地形与建筑 · 完整初始状态',
  landmarkLabels: { a: 'A 点 · 水塔房', b1: 'B1 · 城区', b2: 'B2 · 长街', c1: 'C1 · 厂房', c2: 'C2 · 街区' },
  env: { sky: 'day', sunDir: [0.45, 0.8, 0.3], sunColor: 0xffedcb, sun: 2.6, hemi: 1.0, sky2: 0xc7d5db, ground: 0x929387, fog: 0xc7d0d2, fogDensity: 0.0008, turbidity: 8, rayleigh: 1.2, mie: 0.005, exposure: 0.85, envIntensity: 0.3, weather: null, ambient: 'wind' },
  async prepare() {
    if (asset) return;
    const names = ['cracked.json', 'cracked.glb', 'cracked-collision.bin'];
    const responses = await Promise.all(names.map(name => fetch(new URL(`../assets/maps/${name}`, import.meta.url))));
    for (let i = 0; i < responses.length; i++) if (!responses[i].ok) throw new Error(`烬区地图加载失败：${names[i]}`);
    const [meta, render, collision] = await Promise.all([responses[0].json(), responses[1].arrayBuffer(), responses[2].arrayBuffer()]);
    if (!meta.navigation?.nodes.length || !meta.spawns?.A?.length || !meta.spawns?.B?.length) throw new Error('烬区导航或出生点缺失');
    asset = { meta, meshes: readGraybox(render), collision: readGrayboxCollision(collision) };
  },
  build(w) {
    if (!asset) throw new Error('Call cracked.prepare before building');
    const { meta, meshes, collision } = asset;
    w.importedGeometry = true; w.mapSource = meta.provenance;
    w.physicsMeshes = [collision];
    const materials = new Map(), matrix = new THREE.Matrix4();
    for (const m of meshes) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(m.vertices, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
      geometry.setIndex(new THREE.BufferAttribute(m.indices, 1));
      const key = m.color.join(','), ownsMaterial = !materials.has(key);
      if (ownsMaterial) materials.set(key, new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...m.color), roughness: 1, side: THREE.DoubleSide }));
      const mesh = new THREE.InstancedMesh(geometry, materials.get(key), m.matrices.length);
      m.matrices.forEach((values, i) => mesh.setMatrixAt(i, matrix.fromArray(values)));
      mesh.name = m.name; mesh.receiveShadow = true; mesh.userData.ownedMaterial = ownsMaterial;
      mesh.computeBoundingSphere(); w.root.add(mesh);
    }
    const [x0, z0, x1, z1] = meta.extents;
    for (const b of [
      { x0: x0 - 1, x1: x1 + 1, z0: z0 - 1, z1: z0 }, { x0: x0 - 1, x1: x1 + 1, z0: z1, z1: z1 + 1 },
      { x0: x0 - 1, x1: x0, z0, z1 }, { x0: x1, x1: x1 + 1, z0, z1 },
    ]) w.boxes.push({ ...b, y0: -100, y1: 100, ray: false });
    w.navigation = new LayeredNavigation(meta.navigation);
    w.points = Object.fromEntries(Object.entries(meta.landmarks).map(([name, p]) => [name, new THREE.Vector3(...p)]));
    w.flagPos = ['a', 'b2', 'c1'].map(name => w.navigation.point(w.navigation.nearest(w.points[name])));
    w.navigation.goals = Object.values(w.points);
    for (const team of ['A', 'B']) w.spawns[team] = meta.spawns[team].map(p => new THREE.Vector3(...p));
    const area=([x,y,z])=>[[-5,-4],[0,0],[5,-4],[-5,4],[5,4],[0,8]].map(([dx,dz])=>w.navigation.point(w.navigation.nearest(new THREE.Vector3(x+dx,y,z+dz))));
    const point=(id,label,radius=14)=>({id,label,pos:w.navigation.point(w.navigation.nearest(w.points[id])),radius});
    w.sectors=[
      {label:'A',points:[point('a','A')],spawns:{A:w.spawns.A.flatMap(p=>area(p.toArray())),B:area([-173,-14,-84])}},
      {label:'B',points:[point('b1','B1'),point('b2','B2')],spawns:{A:area([-130,-12,15]),B:area([44,-12,38])}},
      {label:'C',points:[point('c1','C1',17),point('c2','C2',17)],spawns:{A:area([57,-10,95]),B:area([215,-11,110])}},
    ];
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d'), k = 512 / w.def.size;
    ctx.fillStyle = '#383a37'; ctx.fillRect(0, 0, 512, 512);
    for (const n of [...meta.navigation.nodes].sort((a, b) => a[1] - b[1])) {
      const shade = Math.min(185, Math.max(80, Math.round(110 + (n[1] + 15) * 3)));
      ctx.fillStyle = `rgb(${shade + 15},${shade + 5},${shade - 15})`;
      const side = Math.max(2, meta.navigation.cellSize * k * 1.3);
      ctx.fillRect((n[0] + w.half) * k - side / 2, (n[2] + w.half) * k - side / 2, side, side);
    }
    w.topDown = canvas; w.topK = k;
  },
};
