import * as THREE from 'three';
import { MAPS } from '../maps.js';
import { World } from '../world.js';
import { MPMatch } from '../mp.js';
import { VoxelWorld } from './world.js';

// Keep the project's own district layout, doors, stairs and merged buildings.
// Only the blueprint's explicitly destructible pieces become editable blocks.
export const JINQU_VOXEL_MAP = {
  ...MAPS.jinqu, id: 'voxel-jinqu', name: '烬区 · 体素破墙', maxBuildHeight: 12,
};

function cells(min, max) {
  if (max - min < 1) return [Math.floor((min + max) / 2)];
  const result = [];
  for (let i = Math.ceil(min - .5); i + .5 < max; i++) result.push(i);
  return result;
}

export class JinquVoxelWorld extends VoxelWorld {
  constructor(game) {
    super(game, JINQU_VOXEL_MAP);
    this.breachSites = [];
    this.env = MAPS.jinqu.env;
  }
  build() {
    MAPS.jinqu.build(this);
    this.fixedBoxes = this.boxes.slice();
    const ground = this.fixedBoxes.find(b => b.y0 === -1 && b.y1 === 0);
    if (ground) ground.foundation = true;
    // Existing material/region merging keeps the static city inexpensive.
    World.prototype.finalize.call(this);
    this.commit();
  }
  destructible(cx, y0, cz, width, height, depth, material = 'plaster') {
    const type = material === 'sandbag' ? 'wood' : 'brick';
    const blocks = [];
    for (const x of cells(cx - width / 2, cx + width / 2))
      for (const y of cells(y0, y0 + height))
        for (const z of cells(cz - depth / 2, cz + depth / 2)) {
          this.terrain.set(x, y, z, type);
          blocks.push({ x, y, z });
        }
    this.breachSites.push({ pos: new THREE.Vector3(cx, y0 + height / 2, cz), blocks });
  }
}

export class JinquVoxelMatch extends MPMatch {
  constructor(game, cfg) {
    super(game, cfg);
    Object.assign(this.cfg, { map: 'voxel-jinqu', allies: 3, enemies: 6 });
  }
  start() {
    super.start();
    this.game.hud.announce('烬区 · 体素破墙', '岩下村 → 营地 / 贫民窟 → 仓库 / 办公区 · 红墙可用火箭炸开', 6);
  }
  scoreboardHTML() {
    return super.scoreboardHTML().replace('你与九名友军', '你与三名友军').replace('二十名敌军', '六名敌军');
  }
}
