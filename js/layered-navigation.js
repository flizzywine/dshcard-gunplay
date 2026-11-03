import * as THREE from 'three';
import { BinaryHeap } from './util.js';

// A floor is a 3D node, so a tunnel and the street above it never share edges.
export class LayeredNavigation {
  constructor(data) {
    this.nodes = data.nodes; this.cellSize = data.cellSize; this.tileSize = data.cellSize * 4;
    this.tiles = new Map();
    for (let i = 0; i < this.nodes.length; i++) {
      const p = this.nodes[i], key = Math.floor(p[0] / this.tileSize) + ',' + Math.floor(p[2] / this.tileSize);
      if (!this.tiles.has(key)) this.tiles.set(key, []);
      this.tiles.get(key).push(i);
    }
  }
  point(i) { const n = this.nodes[i]; return new THREE.Vector3(n[0], n[1], n[2]); }
  nearest(p) {
    let best = -1, distance = Infinity;
    const tx = Math.floor(p.x / this.tileSize), tz = Math.floor(p.z / this.tileSize);
    const consider = i => {
      const n = this.nodes[i], d = (n[0] - p.x) ** 2 + (n[1] - p.y) ** 2 * 4 + (n[2] - p.z) ** 2;
      if (d < distance) { best = i; distance = d; }
    };
    // The 3x3 neighbourhood contains every point within one tile width. The
    // vertical-weighted score is never smaller than horizontal distance.
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (const id of this.tiles.get((tx + dx) + ',' + (tz + dz)) || []) consider(id);
    if (distance < this.tileSize ** 2) return best;
    for (let i = 0; i < this.nodes.length; i++) {
      consider(i);
    }
    return best;
  }
  randomPoint(cx, cz, radius) {
    if (this.goals?.length && radius > 1e4) {
      const goal = this.goals[Math.floor(Math.random() * this.goals.length)];
      return this.point(this.nearest({ x: goal.x + (Math.random() - 0.5) * 18, y: goal.y, z: goal.z + (Math.random() - 0.5) * 18 }));
    }
    for (let i = 0; i < 100; i++) {
      const id = Math.floor(Math.random() * this.nodes.length), n = this.nodes[id];
      if (Math.hypot(n[0] - cx, n[2] - cz) <= radius) return this.point(id);
    }
    return this.point(this.nearest({ x: cx, y: 10, z: cz }));
  }
  findPath(from, to) {
    const s = this.nearest(from), end = this.nearest(to), count = this.nodes.length;
    if (s < 0 || end < 0) return null;
    const costs = new Float64Array(count).fill(Infinity), parent = new Int32Array(count).fill(-1), closed = new Uint8Array(count);
    const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const heap = new BinaryHeap(entry => entry.score); costs[s] = 0; heap.push({ id: s, score: 0 });
    while (heap.size) {
      const { id } = heap.pop(); if (closed[id]) continue; closed[id] = 1;
      if (id === end) {
        const path = []; for (let i = end; i !== -1; i = parent[i]) path.push(this.point(i));
        path.reverse();
        // Retain the first node: off-grid spawn positions must first enter the graph.
        return path;
      }
      const n = this.nodes[id];
      for (let k = 3; k < n.length; k++) {
        const other = n[k], cost = costs[id] + distance(n, this.nodes[other]);
        if (closed[other] || cost >= costs[other]) continue;
        costs[other] = cost; parent[other] = id;
        heap.push({ id: other, score: cost + distance(this.nodes[other], this.nodes[end]) });
      }
    }
    return null;
  }
}
