import * as THREE from 'three';

// One centre pellet and an even ring: repeatable close-range coverage, with
// physical pellet separation even when optional aim randomness is disabled.
export function pelletDirection(direction, halfAngle, index, count, out = new THREE.Vector3()) {
  out.copy(direction);
  if (index === 0 || count <= 1 || halfAngle <= 0) return out;
  const reference = Math.abs(direction.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(direction, reference).normalize();
  const up = new THREE.Vector3().crossVectors(right, direction).normalize();
  const angle = (index - 1) * Math.PI * 2 / (count - 1), radius = Math.tan(halfAngle) * 0.85;
  return out.addScaledVector(right, Math.cos(angle) * radius).addScaledVector(up, Math.sin(angle) * radius).normalize();
}
