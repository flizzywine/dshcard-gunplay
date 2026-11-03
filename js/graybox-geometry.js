// The static GLB produced by our offline graybox exporter uses packed float32
// positions/normals, uint32 indices and matrix-only nodes. No textures or skins.
export function readGraybox(buffer) {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength) throw new Error('Invalid graybox GLB');
  const jsonLength = view.getUint32(12, true), binStart = 28 + jsonLength;
  const gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
  function attribute(id, type, width) {
    const a = gltf.accessors[id], b = gltf.bufferViews[a.bufferView];
    if (a.componentType !== type || b.byteStride || a.sparse || a.count * width * 4 > b.byteLength) throw new Error('Unsupported graybox accessor');
    const start = binStart + (b.byteOffset || 0) + (a.byteOffset || 0);
    return type === 5126 ? new Float32Array(buffer, start, a.count * width) : new Uint32Array(buffer, start, a.count * width);
  }
  const meshes = gltf.meshes.map(m => {
    const p = m.primitives[0];
    if (m.primitives.length !== 1 || (p.mode !== undefined && p.mode !== 4)) throw new Error('Unsupported graybox primitive');
    return { name: m.name, vertices: attribute(p.attributes.POSITION, 5126, 3), normals: attribute(p.attributes.NORMAL, 5126, 3), indices: attribute(p.indices, 5125, 1), color: gltf.materials[p.material].pbrMetallicRoughness.baseColorFactor.slice(0, 3), matrices: [] };
  });
  for (const n of gltf.nodes) if (n.mesh !== undefined) meshes[n.mesh].matrices.push(n.matrix || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  return meshes;
}

export function readGrayboxCollision(buffer) {
  const view = new DataView(buffer), vertexCount = view.getUint32(4, true), indexCount = view.getUint32(8, true);
  if (view.getUint32(0, true) !== 0x444b5243 || 12 + vertexCount * 12 + indexCount * 4 !== buffer.byteLength) throw new Error('Invalid graybox collision');
  return { vertices: new Float32Array(buffer, 12, vertexCount * 3), indices: new Uint32Array(buffer, 12 + vertexCount * 12, indexCount), surface: { mat: 'concrete' } };
}
