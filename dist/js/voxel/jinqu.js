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
    Object.assign(this.cfg, { map: 'voxel-jinqu', allies: 0, enemies: 0 });
    this.mapInspection = true;
  }
  start() {
    super.start();
    for (const objective of this.sectors.slice(1).flatMap(s => s.objectives)) {
      this.flags.push({ ...objective, pos: objective.pos.clone(), captured: false, prog: 0,
        mesh: this.flagMesh(objective.pos, objective.radius) });
    }
    this.game.hud.announce('烬区 · 地图检查', '无敌人、无队友、无倒计时 · 五个区域均可自由前往', 6);
    this.hudScore();
  }
  updateCaptures() {} // Inspection never advances sectors or ends the session.
  hudScore() {
    const hud = this.game.hud;
    hud.scorebar('<div class="sb-team a">仅玩家</div><div class="sb-time">地图检查</div><div class="sb-team b">不限时</div>');
    hud.objective('自由检查烬区', '岩下村 · 临时营地 · 贫民窟 · 军需仓库 · 办公区', 'WASD 移动 · Shift 冲刺 · 4 火箭破墙 · Esc 暂停 / 重置地图');
    hud.setMarkers(this.flags.map(f => ({ id: 'inspect-' + f.id, pos: f.pos.clone().add(new THREE.Vector3(0, 4, 0)), label: f.id, text: f.name, cls: 'flag' })));
  }
  scoreboardHTML() {
    return super.scoreboardHTML().replace('你与九名友军', '地图检查 · 仅玩家').replace('二十名敌军', '无人');
  }
}
