import * as THREE from 'three';
import { LayeredNavigation } from './layered-navigation.js';

// Imported geometry, physical surfaces, spawn placement and multi-floor navigation
// share one asset; game modes need no knowledge of VMF or source coordinate systems.
export function createImportedMap(config) {
  let data;
  return {
    ...config,
    async prepare() {
      if (data) return;
      const response = await fetch(new URL(`../assets/maps/${config.id}.json`, import.meta.url));
      if (!response.ok) throw new Error(`${config.name} 地图加载失败`);
      const loaded = await response.json();
      if (!loaded.navigation?.nodes.length) throw new Error(`${config.name} 导航数据缺失`);
      data = loaded;
    },
    build(w) {
      if (!data) throw new Error(`Call ${config.id}.prepare before building`);
      w.importedGeometry = true; w.mapSource = data.provenance;
      w.physicsMeshes = [
        { vertices: new Float32Array(data.collision.vertices), indices: new Uint32Array(data.collision.indices), surface: { mat: 'concrete' } },
        { vertices: new Float32Array(data.clips.vertices), indices: new Uint32Array(data.clips.indices), surface: { mat: 'concrete', ray: false } },
      ];
      for (const group of data.groups) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(group.vertices, 3));
        geometry.setIndex(group.indices); geometry.computeVertexNormals();
        const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: group.color, roughness: 1 }));
        mesh.castShadow = mesh.receiveShadow = true; mesh.userData.ownedMaterial = true;
        w.root.add(mesh);
      }
      w.navigation = new LayeredNavigation(data.navigation);
      w.points = Object.fromEntries(Object.entries(data.landmarks).map(([key, p]) => [key, new THREE.Vector3(...p)]));
      w.flagPos = config.flagKeys.map(key => w.navigation.point(w.navigation.nearest(w.points[key])));
      if (config.patrolKeys) w.navigation.goals = config.patrolKeys.map(key => w.points[key]);
      for (const team of ['A', 'B']) w.spawns[team] = data.spawns[team].map(p => {
        const point = new THREE.Vector3(...p);
        return config.snapSpawns ? w.navigation.point(w.navigation.nearest(point)) : point;
      });
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
      const ctx = canvas.getContext('2d'), k = 512 / w.def.size;
      ctx.fillStyle = '#383a37'; ctx.fillRect(0, 0, 512, 512);
      for (const n of [...data.navigation.nodes].sort((a, b) => a[1] - b[1])) {
        const shade = Math.min(185, Math.round(100 + (n[1] - (config.radarBaseHeight || 0)) * 4));
        ctx.fillStyle = `rgb(${shade + 15},${shade + 5},${shade - 15})`;
        const side = Math.max(2, data.navigation.cellSize * k * 1.3);
        ctx.fillRect((n[0] + w.half) * k - side / 2, (n[2] + w.half) * k - side / 2, side, side);
      }
      w.topDown = canvas; w.topK = k;
    },
  };
}
