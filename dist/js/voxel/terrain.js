// Adapted from vyse12138/minecraft-threejs, ead87efbd95eb2092a1b341b7c3cc6c78187904d:
// src/terrain/index.ts (material-grouped instances/buildBlock) and mesh/block.ts.
// Copyright (c) 2022 Vyse12138. MIT; see ../../lib/LICENSE.minecraft-threejs.txt.
// This finite battlefield uses the same block/instance model, with bounded chunks
// and one occupancy map shared with the shooting game's physics and navigation.
import * as THREE from 'three';

const keyOf = (x, y, z) => `${x}_${y}_${z}`;
const chunkOf = (x, z) => `${Math.floor(x / 8)},${Math.floor(z / 8)}`;
export const BLOCKS = Object.freeze({
  grass: { color: 0x657d48, solid: true },
  stone: { color: 0x627373, solid: true },
  brick: { color: 0xc17c55, solid: true },
  wood: { color: 0x9d995b, solid: true },
});

export class VoxelTerrain {
  constructor(root) {
    this.root = root;
    this.blocks = new Map();
    this.chunks = new Map();
    this.dirty = new Set();
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
    this.materials = new Map(Object.entries(BLOCKS).map(([id, block]) => [id,
      new THREE.MeshLambertMaterial({ color: block.color })]));
  }

  get(x, y, z) { return this.blocks.get(keyOf(x, y, z)); }

  set(x, y, z, type, protectedBlock = false) {
    if (![x, y, z].every(Number.isInteger) || (type && !BLOCKS[type])) return false;
    const old = this.get(x, y, z);
    if (old?.protected || (!old && !type)) return false;
    if (old?.type === type && old.protected === protectedBlock) return false;
    if (type) this.blocks.set(keyOf(x, y, z), { x, y, z, type, protected: protectedBlock });
    else this.blocks.delete(keyOf(x, y, z));
    this.dirty.add(chunkOf(x, z));
    return true;
  }

  flush() {
    const dirty = [...this.dirty];
    if (!dirty.length) return false;
    // Only remesh touched chunks. Physics reads blocks, never instance matrices.
    const groups = new Map(dirty.map(key => [key, new Map()]));
    for (const block of this.blocks.values()) {
      const groupsInChunk = groups.get(chunkOf(block.x, block.z));
      if (!groupsInChunk) continue;
      if (!groupsInChunk.has(block.type)) groupsInChunk.set(block.type, []);
      groupsInChunk.get(block.type).push(block);
    }
    const matrix = new THREE.Matrix4(), color = new THREE.Color();
    for (const [key, types] of groups) {
      for (const mesh of this.chunks.get(key) || []) { this.root.remove(mesh); mesh.dispose(); }
      const meshes = [];
      for (const [type, blocks] of types) {
        const mesh = new THREE.InstancedMesh(this.geometry, this.materials.get(type), blocks.length);
        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i];
          matrix.makeTranslation(b.x + .5, b.y + .5, b.z + .5);
          mesh.setMatrixAt(i, matrix);
          const variation = .86 + (((b.x * 13 + b.y * 7 + b.z * 17) % 11 + 11) % 11) * .025;
          mesh.setColorAt(i, color.setRGB(variation, variation, variation));
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.receiveShadow = true;
        this.root.add(mesh); meshes.push(mesh);
      }
      this.chunks.set(key, meshes);
    }
    this.dirty.clear();
    return true;
  }

  dispose() {
    for (const meshes of this.chunks.values()) for (const mesh of meshes) {
      this.root.remove(mesh); mesh.dispose();
    }
    this.geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.blocks.clear(); this.chunks.clear(); this.dirty.clear();
  }
}
