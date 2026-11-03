// Local movement correction, separate from strategic path/goal selection.
export function separateBots(actor, neighbours, desired) {
  if (actor.static || !actor.alive) return desired;
  let pushX = 0, pushZ = 0;
  const height = actor.physicsBody?.height ?? 1.955;
  for (const other of neighbours) {
    if (other === actor || !other.alive) continue;
    const otherHeight = other.physicsBody?.height ?? 1.955;
    if (actor.pos.y + height <= other.pos.y + 0.05 || other.pos.y + otherHeight <= actor.pos.y + 0.05) continue;
    let dx = actor.pos.x - other.pos.x, dz = actor.pos.z - other.pos.z;
    const distance = Math.hypot(dx, dz), clearance = (actor.radius ?? 0.5) + (other.radius ?? 0.5) + 0.12;
    if (distance >= clearance) continue;
    if (distance < 1e-6) {
      // Symmetric pair hash gives coincident agents opposite, stable directions.
      const lo = Math.min(actor.id, other.id), hi = Math.max(actor.id, other.id);
      const angle = (((lo * 73856093) ^ (hi * 19349663)) >>> 0) / 4294967296 * Math.PI * 2;
      const sign = actor.id < other.id ? 1 : -1;
      dx = Math.cos(angle) * sign; dz = Math.sin(angle) * sign;
    } else { dx /= distance; dz /= distance; }
    const strength = Math.min(1.8, (clearance - distance) * 4);
    pushX += dx * strength; pushZ += dz * strength;
  }
  const scale = Math.min(1, 1.8 / Math.max(1e-6, Math.hypot(pushX, pushZ)));
  desired.x += pushX * scale; desired.z += pushZ * scale;
  return desired;
}
