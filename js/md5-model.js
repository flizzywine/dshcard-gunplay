// MD5 v10 asset adapter. Animation keys are read verbatim from the author files.
import * as THREE from 'three';
const clean = text => text.replace(/\/\/[^\r\n]*/g, '');
const numbers = text => text.trim().split(/\s+/).filter(Boolean).map(Number);
function block(text, name) {
  const found = text.match(new RegExp(`\\b${name}\\s*\\{([^}]*)\\}`));
  if (!found) throw Error(`Missing MD5 ${name}`); return found[1];
}
function integer(text, name) {
  const value = text.match(new RegExp(`\\b${name}\\s+(\\d+)`));
  if (!value) throw Error(`Missing MD5 ${name}`); return Number(value[1]);
}
function quaternion(values) {
  const [x, y, z] = values;
  return new THREE.Quaternion(x, y, z, -Math.sqrt(Math.max(0, 1 - x*x - y*y - z*z))).normalize();
}

export function parseMD5Mesh(input) {
  const text = clean(input);
  if (integer(text, 'MD5Version') !== 10) throw Error('Only MD5 v10 is supported');
  const joints = [...block(text, 'joints').matchAll(/"([^"]+)"\s+(-?\d+)\s+\(([^)]+)\)\s+\(([^)]+)\)/g)].map(m => ({
    name: m[1], parent: Number(m[2]), position: new THREE.Vector3(...numbers(m[3])), quaternion: quaternion(numbers(m[4])),
  }));
  if (joints.length !== integer(text, 'numJoints')) throw Error('MD5 joint count mismatch');
  joints.forEach((j, i) => { if (j.parent < -1 || j.parent >= i) throw Error('Invalid MD5 hierarchy'); });
  const meshes = [...text.matchAll(/\bmesh\s*\{([^}]*)\}/g)].map(m => {
    const body = m[1], vertices = [], triangles = [], weights = [];
    for (const v of body.matchAll(/\bvert\s+(\d+)\s+\(([^)]+)\)\s+(\d+)\s+(\d+)/g)) vertices[+v[1]] = { uv: numbers(v[2]), start: +v[3], count: +v[4] };
    for (const t of body.matchAll(/\btri\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/g)) triangles[+t[1]] = [+t[2], +t[3], +t[4]];
    for (const w of body.matchAll(/\bweight\s+(\d+)\s+(\d+)\s+([^\s]+)\s+\(([^)]+)\)/g)) weights[+w[1]] = { joint: +w[2], bias: +w[3], position: new THREE.Vector3(...numbers(w[4])) };
    if (vertices.length !== integer(body, 'numverts') || triangles.length !== integer(body, 'numtris') || weights.length !== integer(body, 'numweights')) throw Error('MD5 geometry count mismatch');
    return { shader: body.match(/shader\s+"([^"]+)"/)[1], vertices, triangles, weights };
  });
  if (meshes.length !== integer(text, 'numMeshes')) throw Error('MD5 mesh count mismatch');
  return { joints, meshes };
}

export function createMD5Model(source, materialFor = () => new THREE.MeshStandardMaterial({ color: 0x879096 })) {
  const root = new THREE.Group(), bones = source.joints.map(j => {
    const b = new THREE.Bone(); b.name = j.name;
    b.position.copy(j.position); b.quaternion.copy(j.quaternion);
    if (j.parent >= 0) {
      const parent = source.joints[j.parent], inverse = parent.quaternion.clone().invert();
      b.position.sub(parent.position).applyQuaternion(inverse);
      b.quaternion.premultiply(inverse);
    }
    return b;
  });
  bones.forEach((b, i) => { const parent = source.joints[i].parent; (parent < 0 ? root : bones[parent]).add(b); });
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones), meshes = [];
  let maxInfluences = 0;
  for (const data of source.meshes) {
    const position = [], uv = [], skinIndex = [], skinWeight = [];
    for (const vertex of data.vertices) {
      const p = new THREE.Vector3(), influences = data.weights.slice(vertex.start, vertex.start + vertex.count);
      maxInfluences = Math.max(maxInfluences, influences.length);
      // Preserve the exact author skinning; fail visibly instead of silently
      // dropping influences if a future asset exceeds Three's four-weight skin.
      if (influences.length > 4) throw Error('MD5 asset needs more than four bone weights');
      for (const w of influences) {
        const joint = source.joints[w.joint]; if (!joint) throw Error('MD5 weight references missing bone');
        p.addScaledVector(w.position.clone().applyQuaternion(joint.quaternion).add(joint.position), w.bias);
      }
      if (!p.toArray().every(Number.isFinite)) throw Error('Non-finite MD5 vertex');
      position.push(...p.toArray()); uv.push(vertex.uv[0], 1 - vertex.uv[1]);
      for (let k = 0; k < 4; k++) { skinIndex.push(influences[k]?.joint || 0); skinWeight.push(influences[k]?.bias || 0); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
    geometry.setIndex(data.triangles.flatMap(([a,b,c]) => [a,c,b]));
    geometry.computeVertexNormals();
    const mesh = new THREE.SkinnedMesh(geometry, materialFor(data.shader));
    mesh.name = data.shader; mesh.frustumCulled = false; root.add(mesh);
    mesh.bind(skeleton); meshes.push(mesh);
  }
  root.userData.maxInfluences = maxInfluences;
  return { root, bones, skeleton, meshes };
}

export function parseMD5Animation(input, name, joints) {
  const text = clean(input), jointCount = integer(text, 'numJoints'), frameCount = integer(text, 'numFrames'), fps = integer(text, 'frameRate');
  if (integer(text, 'MD5Version') !== 10 || jointCount !== joints.length) throw Error('MD5 animation skeleton mismatch');
  const hierarchy = [...block(text, 'hierarchy').matchAll(/"([^"]+)"\s+(-?\d+)\s+(\d+)\s+(\d+)/g)].map(m => ({ name: m[1], parent: +m[2], flags: +m[3], start: +m[4] }));
  const base = [...block(text, 'baseframe').matchAll(/\(([^)]+)\)\s+\(([^)]+)\)/g)].map(m => [...numbers(m[1]), ...numbers(m[2])]);
  if (hierarchy.length !== jointCount || base.length !== jointCount) throw Error('MD5 base frame mismatch');
  hierarchy.forEach((j,i) => { if (j.name !== joints[i].name || j.parent !== joints[i].parent) throw Error('MD5 animation bone order mismatch'); });
  const frames = [];
  for (const m of text.matchAll(/\bframe\s+(\d+)\s*\{([^}]*)\}/g)) {
    const data = numbers(m[2]);
    if (data.length !== integer(text, 'numAnimatedComponents') || !data.every(Number.isFinite)) throw Error('MD5 frame components mismatch');
    frames[+m[1]] = data;
  }
  if (frames.length !== frameCount || frames.some(f => !f)) throw Error('MD5 frame count mismatch');
  const times = frames.map((_, i) => i / fps), tracks = [];
  for (let i = 0; i < jointCount; i++) {
    const positions = [], rotations = [], j = hierarchy[i]; let previous = null;
    for (const frame of frames) {
      const values = base[i].slice(); let offset = j.start;
      for (let k = 0; k < 6; k++) if (j.flags & (1 << k)) values[k] = frame[offset++];
      positions.push(...values.slice(0,3)); const q = quaternion(values.slice(3));
      if (previous && previous.dot(q) < 0) q.set(-q.x,-q.y,-q.z,-q.w);
      rotations.push(...q.toArray()); previous = q;
    }
    tracks.push(new THREE.VectorKeyframeTrack(`${j.name}.position`, times, positions), new THREE.QuaternionKeyframeTrack(`${j.name}.quaternion`, times, rotations));
  }
  const clip = new THREE.AnimationClip(name, (frameCount - 1) / fps, tracks);
  clip.userData = { frameCount, fps }; return clip;
}
