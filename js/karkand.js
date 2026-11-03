import { createImportedMap } from './imported-map.js';

export const KARKAND = createImportedMap({
  id: 'karkand', name: 'Karkand · 大战场灰盒', size: 840, seed: 3, surface: 'concrete', styles: ['ally', 'insurgent'],
  sourceSubtitle: 'Insurgency 社区重制 · 原始建筑与地形尺度',
  env: { sky: 'day', sunDir: [0.45, 0.8, 0.3], sunColor: 0xffedcb, sun: 3, hemi: 0.9, sky2: 0xd4e0e5, ground: 0xaaa08e, fog: 0xd7c9af, fogDensity: 0.0013, turbidity: 8, rayleigh: 1.2, mie: 0.005, exposure: 0.85, envIntensity: 0.35, weather: null, ambient: 'wind' },
  flagKeys: ['push_a', 'push_c', 'industrial'],
  patrolKeys: ['push_a', 'push_b', 'push_c', 'push_cache', 'strike_a', 'strike_b', 'strike_c', 'bridge', 'industrial'],
  landmarkLabels: { push_a: '城区南口', push_b: '西侧街区', push_c: '城区北部', push_cache: '西桥头', strike_b: '西侧高地', bridge: '桥梁', industrial: '工业区' },
  snapSpawns: true, radarBaseHeight: 30,
});
