import * as THREE from 'three';
import { parseMD5Mesh, createMD5Model, parseMD5Animation } from './md5-model.js';

export const UNVANQUISHED_SLOTS = { m4:'rifle', m870:'shotgun', l115:'mdriver', rpg:'lcannon' };
export const UNVANQUISHED_NAMES = { rifle:'步枪', shotgun:'霰弹枪', mdriver:'Mass Driver · 精确步枪', lcannon:'Lucifer Cannon · 重炮' };
const cache=new Map(); let loading;
const directory=id=>id==='rifle'?'./assets/unvanquished-rifle/':`./assets/unvanquished-weapons/${id}/`;
async function text(url){const r=await fetch(url);if(!r.ok)throw Error(`武器资源加载失败：${url}`);return r.text();}
export function prepareUnvanquishedWeapons(){
  return loading ||= (async()=>{
    const loader=new THREE.TextureLoader();
    async function texture(url,color=false){
      const t=await loader.loadAsync(url);
      // Original files stay intact; cap GPU texture resolution for this small
      // first-person model instead of keeping 4K/8K maps resident in every match.
      const image=t.image,limit=2048;
      if(Math.max(image.width,image.height)>limit){const scale=limit/Math.max(image.width,image.height),canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);t.image=canvas;t.needsUpdate=true;}
      if(color)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
    }
    async function material(base,extension='png'){
      const [map,normalMap,specularMap]=await Promise.all([texture(`${base}.${extension}`,true),texture(`${base}_n.${extension}`),texture(`${base}_s.${extension}`)]);
      return new THREE.MeshPhongMaterial({map,normalMap,specularMap,specular:0x666666,shininess:35,side:THREE.DoubleSide});
    }
    const hand=await material('./assets/unvanquished-rifle/hand');
    const legacy=new THREE.MeshPhongMaterial({map:await texture('./assets/unvanquished-weapons/legacy_hand.png',true),shininess:15,side:THREE.DoubleSide});
    for(const id of Object.values(UNVANQUISHED_SLOTS)){
      const dir=directory(id),actions=['idle','fire','reload','raise','lower'];
      const [mesh,animations]=await Promise.all([text(`${dir}${id}_view.md5mesh`),Promise.all(actions.map(a=>text(`${dir}${id}_view_${a}.md5anim`)))]);
      const parsed=parseMD5Mesh(mesh),materials={'models/weapons/hand':hand,'models/weapons/legacy_hand':legacy};
      const skin=id==='mdriver'?'zmdriver':id;
      materials[`models/weapons/${id}/${skin}`]=await material(dir+skin,id==='lcannon'?'webp':'png');
      if(id==='mdriver'){
        materials['models/weapons/mdriver/core']=await material(dir+'core');
        materials['models/weapons/mdriver/lens']=new THREE.MeshPhongMaterial({map:await texture(dir+'lens.jpg',true),shininess:90,side:THREE.DoubleSide});
      }
      cache.set(id,{parsed,materials,clips:Object.fromEntries(actions.map((a,i)=>[a,parseMD5Animation(animations[i],a,parsed.joints)]))});
    }
  })().catch(error=>{loading=null;throw error;});
}

export function createUnvanquishedViewmodel(id){
  const asset=cache.get(id);if(!asset)throw Error('武器模型尚未载入：'+id);
  const model=createMD5Model(asset.parsed,shader=>{const m=asset.materials[shader];if(!m)throw Error('未知武器材质：'+shader);return m;});
  const root=model.root;root.quaternion.setFromRotationMatrix(new THREE.Matrix4().set(0,-1,0,0,0,0,1,0,-1,0,0,0,0,0,0,1));root.scale.setScalar(.0254);
  const mixer=new THREE.AnimationMixer(root);let current=null,action=null,clock=0,fireAge=Infinity,fireDuration=1;
  function sample(name,time){
    if(current!==name){mixer.stopAllAction();action=mixer.clipAction(asset.clips[name]);action.reset();action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();action.paused=true;current=name;}
    action.time=THREE.MathUtils.clamp(time,0,asset.clips[name].duration);mixer.update(0);root.updateMatrixWorld(true);model.skeleton.update();
  }
  sample('idle',0);
  const flashBone=model.bones.find(b=>b.name==='tag_flash');
  const muzzle=new THREE.Object3D();(flashBone||root).add(muzzle);
  const muzzlePoint=muzzle.getWorldPosition(new THREE.Vector3());
  // This cannon has no iron sights. Keep it shouldered beside the reticle;
  // centering its muzzle puts the bulky receiver in front of the camera.
  const aimOffset=id==='lcannon'
    ? new THREE.Vector3(.025,.015,-.04)
    : new THREE.Vector3(-muzzlePoint.x,-muzzlePoint.y-.025,0);
  return {
    id,root,model,clips:asset.clips,aimOffset,
    info:{group:root,muzzle,optic:'iron',sight:new THREE.Vector3(),mag:null},
    get current(){return current;},
    reset(){clock=0;fireAge=Infinity;sample('idle',0);},
    fire(duration){fireAge=0;fireDuration=Math.min(asset.clips.fire.duration||duration,duration);},
    update(dt,state,stateT,stateDur){
      clock+=dt;fireAge+=dt;
      if(state==='reload')sample('reload',stateT/Math.max(.001,stateDur)*asset.clips.reload.duration);
      else if(state==='switch')sample('raise',stateT/Math.max(.001,stateDur)*asset.clips.raise.duration);
      else if(fireAge<fireDuration)sample('fire',fireAge/fireDuration*asset.clips.fire.duration);
      else sample('idle',asset.clips.idle.duration?clock%asset.clips.idle.duration:0);
    },
    dispose(){mixer.stopAllAction();mixer.uncacheRoot(root);for(const mesh of model.meshes)mesh.geometry.dispose();model.skeleton.dispose();},
  };
}
