import * as THREE from 'three';

let assets,loading;
const dir='./assets/delta-weapons/';
export function prepareDeltaWeapons(){
  return loading||=(async()=>{
    const get=async name=>{const r=await fetch(dir+name);if(!r.ok)throw Error('武器资源加载失败：'+name);return r;};
    const [meta,buffer]=await Promise.all([get('weapons.json').then(r=>r.json()),get('weapons.bin').then(r=>r.arrayBuffer())]);
    const loader=new THREE.TextureLoader(),materials=new Map();
    const textures=[...new Set(Object.values(meta.weapons).flatMap(w=>w.parts.map(p=>p.texture)).filter(Boolean))];
    await Promise.all(textures.map(async name=>{
      const map=await loader.loadAsync(dir+name);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
      materials.set(name,new THREE.MeshStandardMaterial({map,roughness:.72,metalness:.15}));
    }));
    const glass=new THREE.MeshStandardMaterial({color:0x263e43,roughness:.2,metalness:.4,transparent:true,opacity:.25,depthWrite:false,side:THREE.DoubleSide});
    const metal=new THREE.MeshStandardMaterial({color:0x303738,roughness:.7,metalness:.3});
    const weapons={};
    for(const[id,w]of Object.entries(meta.weapons)){
      weapons[id]={...w,parts:w.parts.map(p=>{
        const geo=new THREE.BufferGeometry();
        for(const[name,size,key]of [['position',3,'position'],['normal',3,'normal'],['uv',2,'uv']])geo.setAttribute(name,new THREE.BufferAttribute(new Float32Array(buffer,p[key].offset,p[key].count),size));
        geo.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer,p.index.offset,p.index.count),1));geo.computeBoundingSphere();
        return {...p,geometry:geo,material:p.glass?glass:materials.get(p.texture)||metal};
      })};
    }
    assets=weapons;
  })().catch(e=>{loading=null;throw e;});
}
export function deltaWeaponReady(id){return !!assets?.[id];}
export function buildDeltaGun(id,opts={}){
  const w=assets?.[id];if(!w)throw Error('武器尚未加载：'+id);
  const group=new THREE.Group();group.name=w.name;
  const info={group,muzzle:new THREE.Object3D(),sight:new THREE.Vector3(...w.sight),leftHand:new THREE.Vector3(...w.leftHand),eject:new THREE.Vector3(.025,.07,-.1),optic:w.optic,mag:null,bolt:null,pump:null,reticle:null,delta:true};
  const parts=new Map();
  for(const part of w.parts){
    let root=parts.get(part.role);if(!root){root=new THREE.Group();root.name=part.role;parts.set(part.role,root);group.add(root);}
    const mesh=new THREE.Mesh(part.geometry,part.material);mesh.name=part.name;mesh.castShadow=!opts.noShadow;root.add(mesh);
  }
  info.mag=parts.get('mag')||null;info.bolt=parts.get('bolt')||null;info.pump=parts.get('pump')||null;
  // Give detached magazines an attachment-local origin for the existing hand
  // and magazine animation. Geometry stays in its original assembled position.
  if(info.mag){const center=new THREE.Box3().setFromObject(info.mag).getCenter(new THREE.Vector3());for(const child of info.mag.children)child.position.sub(center);info.mag.position.copy(center);}
  if(id==='m870'){
    const shell=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.055,10).rotateX(Math.PI/2),new THREE.MeshStandardMaterial({color:0xaa3030,roughness:.65}));
    shell.position.set(-.015,.005,-.1);group.add(shell);info.mag=shell;shell.visible=false;
  }
  info.muzzle.position.fromArray(w.muzzle);group.add(info.muzzle);
  if(id==='m4'||id==='m870')info.adsEyeRelief=.16;
  if(id==='rpg'){
    // Shoulder the long AT4 beside the HUD reticle; pulling the entire rear
    // tube through the camera to align its side sight blocks the target.
    info.hipPosition=new THREE.Vector3(.29,-.29,-.5);
    info.adsPosition=new THREE.Vector3(.25,-.26,-.55);
    info.optic='at4';
    const loaded=new THREE.Group();loaded.name='loaded-at4';
    for(const child of [...group.children])if(child!==info.muzzle)loaded.add(child);
    group.add(loaded);info.loadedTube=loaded;
    info.replacementTube=loaded.clone(true);info.replacementTube.name='fresh-at4';info.replacementTube.visible=false;group.add(info.replacementTube);
    info.resetTube=()=>{loaded.visible=true;loaded.position.set(0,0,0);loaded.rotation.set(0,0,0);info.replacementTube.visible=false;};
  }
  return info;
}
