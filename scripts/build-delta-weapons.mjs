import fs from 'node:fs';
import path from 'node:path';
import * as T from 'three';

const source=process.argv[2]||'D:/Workspace/deltaforce-map-extract/exports/weapons';
const dest=new URL('../assets/delta-weapons/',import.meta.url);fs.mkdirSync(dest,{recursive:true});
const read=name=>JSON.parse(fs.readFileSync(path.join(source,name+'_1P.json')));
const vec=v=>new T.Vector3(v?.X||0,v?.Y||0,v?.Z||0);
const boneMatrix=(a,i)=>{const b=a.bones[i],t=b.Transform;const m=new T.Matrix4().compose(vec(t.Translation),new T.Quaternion(t.Rotation.X,t.Rotation.Y,t.Rotation.Z,t.Rotation.W),vec(t.Scale3D));return b.ParentIndex<0?m:boneMatrix(a,b.ParentIndex).multiply(m);};
function socket(a,name){
  const s=a.sockets.find(s=>s.Properties.SocketName===name)?.Properties;
  const i=a.bones.findIndex(b=>b.Name===(s?s.BoneName:name));
  if(i<0)throw Error('Missing socket '+name+' in '+a.path);
  const m=boneMatrix(a,i);
  if(s){const r=s.RelativeRotation||{};const e=new T.Euler((r.Roll||0)*Math.PI/180,(r.Pitch||0)*Math.PI/180,(r.Yaw||0)*Math.PI/180,'ZYX');m.multiply(new T.Matrix4().compose(vec(s.RelativeLocation),new T.Quaternion().setFromEuler(e),new T.Vector3(1,1,1)));}
  return m;
}
const specs={
 m4:{name:'腾龙突击步枪',origin:[0,4,4],parts:[
  ['receiver','Rec_AR_QBZ191_057'],['barrel','Bar_M-368_QBZ191std_137','receiver','Bar_point'],
  ['handguard','Han_QBZ191_std_121','receiver','Han_point'],['mag','Mag_5842-30_QBZ191Std_131','receiver','Mag_point'],
  ['grip','PisG_C_QBZ191_78','receiver','PisG_point'],['buffer','Other_QBZ191-buffer_094','receiver','Sto_point'],
  ['stock','Sto_A_QBZ191_105','buffer','StoCase_point'],['rear','ReaS_QBZ191_035','receiver','Rea_point'],
  ['front','FroS_QBZ191_034','handguard','FSig_point'],['brake','Muz_M-F_QBZ191_089','barrel','Muzzle_point']],
  muzzle:['brake','MuzzleFlashSocket01'],sight:['rear','Center'],support:[0,31,5]},
 m870:{name:'M870 霰弹枪',origin:[0,4,0],parts:[['receiver','Rec_SG_M870_036'],['barrel','Bar_SG-550_M870Std_023','receiver','Bar_point'],['pump','Han_M870_Std_034','receiver','Han_point'],['stock','Sto_A_M870_048','receiver','Sto_point'],['rear','ReaS_m870_030','receiver','Rea_point']],support:[0,34,3]},
 l115:{name:'AWM 狙击步枪',origin:[0,5,0],parts:[['receiver','Rec_SR_AW_052'],['barrel','Bar_M-660_awLong_108','receiver','Bar_point'],['chassis','Han_AW_std_087','receiver','Han_point'],['mag','Mag_338-5_awm_107','receiver','Mag_point'],['scope','Sco_6X-13X_sniperscope6-13_053','receiver','Sco_point']],muzzle:['barrel','MuzzleFlashSocket'],sight:['scope','Center'],support:[0,40,1]},
 rpg:{name:'AT4 火箭筒',origin:[5.9,6.7,10],parts:[['receiver','AT4'],['scope','AT4_sight01','receiver','Sco_point']],muzzle:['receiver','MuzzleFlashSocket'],support:[5,28,8]},
};
const chunks=[];let offset=0;const manifest={version:1,source:'Local Delta Force weapon parts; static bind pose, simplified procedural actions',weapons:{}};
function put(a){const b=Buffer.from(a.buffer,a.byteOffset,a.byteLength);const info={offset,count:a.length};chunks.push(b);offset+=b.length;return info;}
for(const [id,spec]of Object.entries(specs)){
 const records=new Map(),parts=[];const base=new T.Matrix4().set(.01,0,0,-spec.origin[0]*.01,0,0,.01,-spec.origin[2]*.01,0,-.01,0,spec.origin[1]*.01,0,0,0,1);
 const convert=p=>new T.Vector3(...p).applyMatrix4(base).toArray();
 for(const [role,name,parent,attach]of spec.parts){
  const a=read(name);let transform=new T.Matrix4();
  if(parent){const p=records.get(parent);transform.copy(p.transform).multiply(socket(p.a,attach));}
  records.set(role,{a,transform});
  const m=base.clone().multiply(transform),normal=new T.Matrix3().getNormalMatrix(m);
  const positions=new Float32Array(a.vertices.length*3),normals=new Float32Array(a.vertices.length*3),uvs=new Float32Array(a.vertices.length*2);
  a.vertices.forEach((v,i)=>{new T.Vector3(...v.p).applyMatrix4(m).toArray(positions,i*3);new T.Vector3(...v.n).applyMatrix3(normal).normalize().toArray(normals,i*3);uvs.set([v.uv[0],1-v.uv[1]],i*2);});
  // Match authored outward normals instead of assuming UE triangle winding.
  let winding=0;for(let i=0;i<a.indices.length;i+=3){const [x,y,z]=a.indices.slice(i,i+3),p=new T.Vector3().fromArray(positions,x*3),q=new T.Vector3().fromArray(positions,y*3),r=new T.Vector3().fromArray(positions,z*3);winding+=q.sub(p).cross(r.sub(p)).dot(new T.Vector3().fromArray(normals,x*3));}
  const groups=new Map();
  for(const section of a.sections){if(section.bDisabled)continue;for(let i=section.FirstIndex;i<section.FirstIndex+section.NumFaces*3;i+=3){
   const tri=a.indices.slice(i,i+3);const moving=role==='receiver'&&id!=='rpg'&&tri.every(n=>a.vertices[n].influences?.some(w=>w.Weight>.5&&/Gun_bolt/.test(a.bones[w.Bone].Name)));
   const key=section.MaterialIndex+':'+(moving?'bolt':role);if(!groups.has(key))groups.set(key,[]);if(winding<0)[tri[1],tri[2]]=[tri[2],tri[1]];groups.get(key).push(...tri);
  }}
  const attributes={position:put(positions),normal:put(normals),uv:put(uvs)};
  for(const [key,indices]of groups){const [mi,partRole]=key.split(':'),material=a.materials[mi];
   if(material.texture)fs.copyFileSync(path.join(source,material.texture),new URL(material.texture,dest));
   parts.push({role:partRole,name,source:a.path,...attributes,index:put(new Uint32Array(indices)),texture:material.texture||null,glass:!material.texture&&/glass|RT_Low/.test(material.SlotName)});
  }
 }
 function point(ref){const p=records.get(ref[0]);return new T.Vector3().setFromMatrixPosition(p.transform.clone().multiply(socket(p.a,ref[1]))).applyMatrix4(base).toArray();}
 const muzzle=spec.muzzle?point(spec.muzzle):convert([0,82,7]);
 const sight=spec.sight?point(spec.sight):convert(id==='rpg'?[12.7,3,23]:[0,8.5,4]);
 // M870 has a bead rather than a rear aperture; aim along the barrel.
 if(id==='m870')sight[1]=.087;
 manifest.weapons[id]={name:spec.name,parts,muzzle,sight,leftHand:convert(spec.support),optic:id==='l115'?'sniper':id==='rpg'?'reticle':'iron'};
 console.log(id,spec.name,parts.length,'parts');
}
fs.writeFileSync(new URL('weapons.bin',dest),Buffer.concat(chunks));
fs.writeFileSync(new URL('weapons.json',dest),JSON.stringify(manifest));
console.log('geometry bytes',offset);
