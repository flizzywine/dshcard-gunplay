import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { parseMD5Mesh, createMD5Model, parseMD5Animation } from '../js/md5-model.js';
const read=name=>readFileSync(new URL(`../assets/unvanquished-rifle/${name}`,import.meta.url),'utf8');
const source=read('rifle_view.md5mesh'), parsed=parseMD5Mesh(source), animation=read('rifle_view_reload.md5anim');

test('official rifle contains the original gun, both hands and magazine bones',()=>{
  assert.equal(parsed.joints.length,46);assert.equal(parsed.meshes.length,3);
  for(const name of ['L_palm','R_palm','b_magazine','L_finger_index_end'])assert.ok(parsed.joints.some(j=>j.name===name));
  const model=createMD5Model(parsed);assert.equal(model.root.userData.maxInfluences,3);
  for(const mesh of model.meshes){
    const weights=mesh.geometry.attributes.skinWeight;
    for(let i=0;i<weights.count;i++)assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-4);
    mesh.geometry.dispose();mesh.material.dispose();
  }
});
test('original reload matches direct source-weight skinning at sampled frames',()=>{
  const model=createMD5Model(parsed), clip=parseMD5Animation(animation,'reload',parsed.joints), mixer=new THREE.AnimationMixer(model.root);
  assert.equal(clip.tracks.length,92);assert.equal(clip.duration,2.3);
  const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  for(const frame of [0,35,69,105,138]){
    action.time=frame/60;mixer.update(0);model.root.updateMatrixWorld(true);model.skeleton.update();
    // Independent MD5 reference: transform each source weight directly by its
    // current global joint. Compare this with Three's bind-matrix skinning.
    // The exporter bounds are not exact vertex bounds and cannot serve as truth.
    const matrices=parsed.joints.map((j,i)=>new THREE.Matrix4().compose(
      new THREE.Vector3().fromArray(clip.tracks[i*2].values,frame*3),
      new THREE.Quaternion().fromArray(clip.tracks[i*2+1].values,frame*4),new THREE.Vector3(1,1,1)));
    matrices.forEach((matrix,i)=>{if(parsed.joints[i].parent>=0)matrix.premultiply(matrices[parsed.joints[i].parent]);});
    parsed.meshes.forEach((data,k)=>data.vertices.forEach((vertex,i)=>{
      const exact=new THREE.Vector3();
      for(const w of data.weights.slice(vertex.start,vertex.start+vertex.count))exact.addScaledVector(w.position.clone().applyMatrix4(matrices[w.joint]),w.bias);
      const actual=new THREE.Vector3().fromBufferAttribute(model.meshes[k].geometry.attributes.position,i);
      model.meshes[k].applyBoneTransform(i,actual);
      assert.ok(actual.distanceTo(exact)<2e-5,`frame ${frame}, vertex ${i}: skinning diverged`);
    }));
  }
  for(const mesh of model.meshes){mesh.geometry.dispose();mesh.material.dispose();}
});
test('adapter rejects incorrect versions and incompatible animation skeletons',()=>{
  assert.throws(()=>parseMD5Mesh(source.replace('MD5Version 10','MD5Version 9')),/v10/);
  assert.throws(()=>parseMD5Animation(animation.replace('numJoints 46','numJoints 45'),'reload',parsed.joints),/skeleton/);
  assert.throws(()=>parseMD5Animation(animation.replace('"L_palm"','"wrong_bone"'),'reload',parsed.joints),/bone order/);
});
