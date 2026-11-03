import * as THREE from 'three';
import { parseMD5Mesh, createMD5Model, parseMD5Animation } from './md5-model.js';

const $ = id => document.getElementById(id), base = './assets/unvanquished-rifle/';
const names = { idle: '待机', fire: '开火', reload: '换弹', raise: '举枪', lower: '收枪' };
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
$('viewport').append(renderer.domElement);
const scene = new THREE.Scene(), backdrop = new THREE.Scene();
backdrop.background = new THREE.Color('#85958d'); backdrop.fog = new THREE.Fog('#85958d', 10, 40);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.005, 20);
const worldCamera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 60);
worldCamera.position.set(0,1.6,4); worldCamera.lookAt(0,1.6,-10);
scene.add(new THREE.HemisphereLight(0xe7f1ff, 0x6b6c55, 2));
const key = new THREE.DirectionalLight(0xfff2dc, 3.0); key.position.set(-1,2,2); scene.add(key);
const fill = new THREE.DirectionalLight(0xc2d9f2, 1.2); fill.position.set(2,0,-1); scene.add(fill);
backdrop.add(new THREE.HemisphereLight(0xeaf2ee,0x4c5c4e,2));
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80,80), new THREE.MeshStandardMaterial({color:'#647369',roughness:1})); ground.rotation.x=-Math.PI/2;backdrop.add(ground);
const grid = new THREE.GridHelper(60,60,0x819387,0x728477); grid.position.y=.002;backdrop.add(grid);
for(const [x,z] of [[-3,-4],[0,-8],[4,-14]]){
  const post=new THREE.Mesh(new THREE.BoxGeometry(.08,1.3,.08),new THREE.MeshStandardMaterial({color:0x52594a}));post.position.set(x,.65,z);backdrop.add(post);
  const target=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,.06,48),new THREE.MeshStandardMaterial({color:0xc4c4a8}));target.rotation.x=Math.PI/2;target.position.set(x,1.45,z);backdrop.add(target);
  const bull=new THREE.Mesh(new THREE.CircleGeometry(.13,32),new THREE.MeshBasicMaterial({color:0x454e43}));bull.position.set(x,1.45,z+.04);backdrop.add(bull);
}
let model, mixer, action, current='reload', paused=false, mode='first', loop=true;
const clips={}, spherical=new THREE.Spherical(.75,1.3,.6), target=new THREE.Vector3(.04,-.13,-.25);
let drag=null;
function setCamera(){
  if(mode==='first'){camera.position.set(0,0,0);camera.quaternion.identity();}
  else{camera.position.setFromSpherical(spherical).add(target);camera.lookAt(target);}
}
function select(name){
  if(!mixer)return;
  current=name;paused=false;mixer.stopAllAction();
  action=mixer.clipAction(clips[name]);action.reset();action.setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);action.clampWhenFinished=true;action.play();mixer.update(0);
  document.querySelectorAll('[data-action]').forEach(b=>b.classList.toggle('active',b.dataset.action===name));$('pause').textContent='暂停';
}
function setView(view){
  mode=view;setCamera();$('crosshair').hidden=mode!=='first';
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  $('viewHint').textContent=mode==='first'?'R 换弹 · F 开火 · 空格暂停 · 拖动进度条逐帧观察':'拖动模型旋转观察 · 滚轮缩放 · 可暂停查看手指和弹匣';
}
function pause(){if(!action)return;paused=!paused;action.paused=paused;$('pause').textContent=paused?'播放':'暂停';}
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.action)));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
$('pause').addEventListener('click',pause);
$('loop').addEventListener('change',()=>{loop=$('loop').checked;select(current);});
$('timeline').addEventListener('input',()=>{if(!action)return;paused=true;action.paused=true;action.time=Number($('timeline').value)*clips[current].duration;mixer.update(0);$('pause').textContent='播放';});
$('fov').addEventListener('input',()=>{camera.fov=Number($('fov').value);camera.updateProjectionMatrix();$('fovValue').textContent=camera.fov+'°';});
window.addEventListener('keydown',e=>{if(/INPUT|SELECT/.test(e.target.tagName)||!model)return;if(e.code==='KeyR'){select('reload');e.preventDefault();}if(e.code==='KeyF')select('fire');if(e.code==='Space'){pause();e.preventDefault();}});
renderer.domElement.addEventListener('pointerdown',e=>{if(mode==='orbit'){drag={x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);}});
renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;spherical.theta-=(e.clientX-drag.x)*.008;spherical.phi=THREE.MathUtils.clamp(spherical.phi+(e.clientY-drag.y)*.008,.1,Math.PI-.1);drag={x:e.clientX,y:e.clientY};setCamera();});
renderer.domElement.addEventListener('pointerup',()=>drag=null);
renderer.domElement.addEventListener('wheel',e=>{if(mode==='orbit'){spherical.radius=THREE.MathUtils.clamp(spherical.radius*Math.exp(e.deltaY*.001),.2,2);setCamera();e.preventDefault();}},{passive:false});
window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);for(const c of [camera,worldCamera]){c.aspect=innerWidth/innerHeight;c.updateProjectionMatrix();}});

async function text(name){const r=await fetch(base+name);if(!r.ok)throw Error(`资源加载失败：${name}`);return r.text();}
async function init(){
  const loader=new THREE.TextureLoader();
  const [source,animations,textures]=await Promise.all([
    text('rifle_view.md5mesh'),Promise.all(Object.keys(names).map(n=>text(`rifle_view_${n}.md5anim`))),
    Promise.all(['rifle.png','rifle_n.png','rifle_s.png','hand.png','hand_n.png','hand_s.png'].map(n=>loader.loadAsync(base+n))),
  ]);
  const materials={};
  for(let i=0;i<2;i++){
    const [map,normalMap,specularMap]=textures.slice(i*3,i*3+3);map.colorSpace=THREE.SRGBColorSpace;
    map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    materials[i?'models/weapons/hand':'models/weapons/rifle/rifle']=new THREE.MeshPhongMaterial({map,normalMap,specularMap,specular:0x666666,shininess:i?20:45,side:THREE.DoubleSide});
  }
  const parsed=parseMD5Mesh(source);model=createMD5Model(parsed,shader=>{if(!materials[shader])throw Error('缺少材质：'+shader);return materials[shader];});
  // Doom/MD5 uses +X forward, +Y left, +Z up. Convert the coordinate basis once;
  // keep every original bone key and the authored eye-relative framing intact.
  model.root.quaternion.setFromRotationMatrix(new THREE.Matrix4().set(0,-1,0,0, 0,0,1,0, -1,0,0,0, 0,0,0,1));model.root.scale.setScalar(.0254);scene.add(model.root);
  Object.keys(names).forEach((n,i)=>clips[n]=parseMD5Animation(animations[i],n,parsed.joints));
  mixer=new THREE.AnimationMixer(model.root);select('reload');setCamera();
  $('stats').textContent=`${parsed.joints.length} 骨骼 · ${parsed.meshes.length} 网格 · 原作者 5 段动画 · 换弹 139 帧 / 60 FPS`;
  $('status').hidden=true;document.body.dataset.ready='true';
  window.weaponPreview={model,mixer,clips,select,setView,get current(){return current;},get action(){return action;},get paused(){return paused;},get mode(){return mode;}};
}
const clock=new THREE.Clock();
renderer.setAnimationLoop(()=>{
  const dt=Math.min(clock.getDelta(),.05);
  if(mixer){mixer.update(dt*Number($('speed').value));model.root.updateMatrixWorld(true);model.skeleton.update();const duration=clips[current].duration;
    if(document.activeElement!==$('timeline'))$('timeline').value=action.time/duration;
    $('time').textContent=`${action.time.toFixed(2)} / ${duration.toFixed(2)} 秒 · ${Math.min(clips[current].userData.frameCount-1,Math.round(action.time*clips[current].userData.fps))} 帧`;
  }
  renderer.autoClear=true;renderer.render(backdrop,worldCamera);renderer.autoClear=false;renderer.clearDepth();renderer.render(scene,camera);
});
init().catch(error=>{$('status').textContent=error.message;console.error(error);document.body.dataset.error='true';});
