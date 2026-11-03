import * as THREE from 'three';
import { LayeredNavigation } from './layered-navigation.js';

let data;
export const DUST2 = {
  id: 'dust2', name: 'Dust II · 经典灰盒', size: 160, seed: 2, surface: 'concrete', styles: ['ally', 'insurgent'],
  env: { sky: 'day', sunDir: [0.45, 0.8, 0.3], sunColor: 0xfff1dc, sun: 3, hemi: 0.9, sky2: 0xcfe2ff, ground: 0xaaa08e, fog: 0xd9d0bd, fogDensity: 0.001, turbidity: 6, rayleigh: 1.2, mie: 0.005, exposure: 0.85, envIntensity: 0.35, weather: null, ambient: 'wind' },
  async prepare() {
    if (data) return;
    const response = await fetch(new URL('../assets/maps/dust2.json', import.meta.url));
    if (!response.ok) throw new Error('Dust II 地图加载失败');
    const loaded = await response.json();
    if (!loaded.navigation?.nodes.length) throw new Error('Dust II 导航数据缺失');
    data = loaded;
  },
  build(w) {
    if (!data) throw new Error('Call Dust II prepare before building');
    w.importedGeometry = true;
    w.mapSource = data.provenance;
    w.physicsMeshes = [
      { vertices: new Float32Array(data.collision.vertices), indices: new Uint32Array(data.collision.indices), surface: { mat: 'concrete' } },
      { vertices: new Float32Array(data.clips.vertices), indices: new Uint32Array(data.clips.indices), surface: { mat: 'concrete', ray: false } },
    ];
    for (const group of data.groups) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(group.vertices, 3));
      geometry.setIndex(group.indices); geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: group.color, roughness: 1 }));
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.ownedMaterial = true;
      w.root.add(mesh);
    }
    w.navigation = new LayeredNavigation(data.navigation);
    for (const team of ['A', 'B']) w.spawns[team] = data.spawns[team].map(p => new THREE.Vector3(...p));
    w.points = Object.fromEntries(Object.entries(data.landmarks).map(([key, p]) => [key, new THREE.Vector3(...p)]));
    w.flagPos = [w.points.A, w.points.mid, w.points.B].map(p => w.navigation.point(w.navigation.nearest(p)));
    // Radar shows reachable floors, including the lower tunnel, rather than roof silhouettes.
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d'), k = 512 / w.def.size;
    ctx.fillStyle = '#383a37'; ctx.fillRect(0, 0, 512, 512);
    for (const n of [...data.navigation.nodes].sort((a, b) => a[1] - b[1])) {
      const shade = Math.round(100 + n[1] * 4);
      ctx.fillStyle = `rgb(${shade + 15},${shade + 5},${shade - 15})`;
      ctx.fillRect((n[0] + w.half) * k - 2, (n[2] + w.half) * k - 2, 4, 4);
    }
    w.topDown = canvas; w.topK = k;
  },
};
