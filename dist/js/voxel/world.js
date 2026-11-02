import * as THREE from 'three';
import { World } from '../world.js';
import { VoxelTerrain } from './terrain.js';

export const VOXEL_MAP = {
  name: '破墙演练', size: 40, seed: 2401, surface: 'dirt',
  sectors: [{ name: '穿过防线', objectives: [{ id: 'A', name: '训练场', pos: new THREE.Vector3(.5, 0, -12.5), radius: 4 }],
    attackSpawns: [new THREE.Vector3(.5, 0, 12.5), new THREE.Vector3(2.5, 0, 9.5)],
    defendSpawns: [new THREE.Vector3(.5, 0, -9.5)] }],
};

export class VoxelWorld extends World {
  constructor(game) {
    super(game, VOXEL_MAP);
    this.terrain = new VoxelTerrain(this.root);
    this.env = { exposure: 1 };
    this.removedBlocks = 0;
    this.lastEdit = null;
  }

  build() {
    const set = (x, y, z, type, fixed = false) => this.terrain.set(x, y, z, type, fixed);
    for (let x = -20; x < 20; x++) for (let z = -20; z < 20; z++) {
      set(x, -1, z, 'grass', true);
      if (x === -20 || x === 19 || z === -20 || z === 19)
        for (let y = 0; y < 5; y++) set(x, y, z, 'stone', true);
    }
    // Sealed side-to-side, so the ally cannot pass until a real opening exists.
    for (let x = -19; x < 19; x++) for (let y = 0; y < 4; y++) set(x, y, 0, 'brick');
    for (const [cx, cz] of [[-9, 8], [10, 5], [-10, -8], [9, -12]])
      for (let x = cx; x < cx + 3; x++) for (let z = cz; z < cz + 2; z++)
        for (let y = 0; y < 2; y++) set(x, y, z, 'wood');
    this.commit();
  }

  commit() {
    if (!this.terrain.flush()) return false;
    // Render, raycasts, collision and navigation derive from this same revision.
    this.boxes = [...this.terrain.blocks.values()].map(block => ({
      x0: block.x, x1: block.x + 1, y0: block.y, y1: block.y + 1,
      z0: block.z, z1: block.z + 1, mat: block.type, voxel: block,
    }));
    this.buildSpatialIndex(); this.buildGrid();
    this.navVersion = ++this.navRevision;
    if (typeof document !== 'undefined') this.buildTopDown();
    for (const bot of this.game.bots || []) {
      bot.path = null; bot.pathGoal = null; bot.nextPathT = 0;
    }
    return true;
  }

  damageDestructibles(pos, radius, damage) {
    // Tactical blast edits blocks, while the existing explosion handles soldiers.
    if (damage <= 0) return 0;
    const r = Math.min(radius, 3.1);
    let removed = 0;
    for (const b of [...this.terrain.blocks.values()]) {
      if (b.protected) continue;
      const distance = Math.hypot(
        pos.x - THREE.MathUtils.clamp(pos.x, b.x, b.x + 1),
        pos.y - THREE.MathUtils.clamp(pos.y, b.y, b.y + 1),
        pos.z - THREE.MathUtils.clamp(pos.z, b.z, b.z + 1));
      if (distance <= r && this.terrain.set(b.x, b.y, b.z, null)) removed++;
    }
    if (removed) {
      this.removedBlocks += removed;
      this.commit();
      this.game.hud?.popup?.(`炸开 ${removed} 块 · 队友重新规划路线`, '#ffc47a');
    }
    return removed;
  }

  edit(origin, direction, place = false) {
    const hit = this.raycast(origin, direction, 8), b = hit?.box.voxel;
    if (!b) return false;
    if (place) {
      const x = b.x + hit.normal.x, y = b.y + hit.normal.y, z = b.z + hit.normal.z;
      if (x <= -20 || x >= 19 || z <= -20 || z >= 19 || y < 0 || y > 5 || this.terrain.get(x, y, z)) return false;
      if (this.game.entities.some(e => e.alive && e.pos &&
        e.pos.x + (e.radius || .35) > x && e.pos.x - (e.radius || .35) < x + 1 &&
        e.pos.z + (e.radius || .35) > z && e.pos.z - (e.radius || .35) < z + 1 &&
        e.pos.y < y + 1 && e.pos.y + 1.8 > y)) return false;
      if (!this.terrain.set(x, y, z, 'wood')) return false;
    } else if (!this.terrain.set(b.x, b.y, b.z, null)) return false;
    this.lastEdit = { place, revision: this.navRevision + 1 };
    this.commit();
    return true;
  }

  dispose() { this.terrain.dispose(); super.dispose(); }
}
