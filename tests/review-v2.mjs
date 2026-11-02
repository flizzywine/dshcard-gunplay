// Current main lifecycle methods, without constructing WebGL or starting a browser.
import assert from 'node:assert/strict';
import {Game} from '../dist/js/main.js';
const noop=()=>{};
globalThis.document={pointerLockElement:null,getElementById:()=>({classList:{add:noop}})};
const g=Object.create(Game.prototype);
g.input={keys:{KeyW:true},pressed:{Digit1:true,Digit2:true,Digit3:true,Digit4:true,KeyZ:true,KeyX:true,KeyF:true,KeyQ:true,KeyB:true,KeyE:true,Digit8:true},buttons:5,wheel:-1,mdx:5,mdy:2};
const inp=g.snapshotInput();
for(const field of ['slot1','slot2','slot3','slot4','dashPressed','incendiaryPressed','supportPressed','reconPressed','summonPressed','enterPressed','fire','ads'])assert(inp[field],field);
assert.equal(inp.swapDelta,-1);assert.equal(inp.command,'focus');assert.equal(inp.meleePressed,false);assert.equal(inp.interactPressed,false);assert.equal(inp.streak,-1);
assert.deepEqual(g.input.pressed,{});assert.equal(g.input.wheel,0);assert.equal(g.input.mdx,0);
let updates=0,renders=0,locks=0,pausedMenus=0;
Object.assign(g,{state:'play',paused:false,clock:{getDelta:()=>.05},update(){updates++;},scene:{},camera:{},vmPass:{},renderPass:{},grade:{uniforms:{time:{value:0}}},composer:{render(){renders++;}},menu:{showPause(){pausedMenus++;},hide:noop},lock(){locks++;},player:{alive:true},abilities:{mounted:true}});
g.pause(true);g.frame();assert.equal(updates,0);assert.equal(renders,1);assert.equal(g.vmPass.enabled,false);assert.equal(pausedMenus,1);
g.pause(false);g.frame();assert.equal(updates,1);assert.equal(locks,1);g.abilities.mounted=false;g.frame();assert.equal(g.vmPass.enabled,true);
const order=[];
Object.assign(g,{abilities:{dispose(){order.push('abilities');}},bots:[{dispose(){order.push('bot');}}],projectiles:[],pickups:[],entities:[{}],noises:[{}],hazards:[{}],mode:{dispose(){order.push('mode');}},player:{ws:{dispose(){order.push('weapons');}}},world:{dispose(){order.push('world');}},effects:{clear(){order.push('effects');}},audio:{stopAll(){order.push('audio');}},grade:{uniforms:{nvg:{value:1},thermal:{value:1},wp:{value:1}}}});
g.clearWorld();assert.deepEqual(order,['abilities','bot','mode','weapons','world','effects','audio']);for(const key of ['entities','bots','projectiles','pickups','noises','hazards'])assert.equal(g[key].length,0);for(const key of ['abilities','player','mode','world'])assert.equal(g[key],null);
console.log('PASS current main V2 input mapping/edge consumption; pause freezes updates; mech hides handheld pass; ordered ability/world cleanup. No WebGL/browser validation.');

const THREE=await import('three');
const {WeaponSystem}=await import('../dist/js/weapons.js');
const owner={isPlayer:true};const disposable=new WeaponSystem({vmScene:new THREE.Scene(),scene:new THREE.Scene()},owner);
const sharedMaterial=new THREE.MeshBasicMaterial(), sharedTexture=new THREE.Texture();let materialDisposals=0,textureDisposals=0;
sharedMaterial.addEventListener('dispose',()=>materialDisposals++);sharedTexture.addEventListener('dispose',()=>textureDisposals++);
let geometriesDisposed=0,flashesDisposed=0,lasersDisposed=0;
function slot(){const group=new THREE.Group(),geo=new THREE.BoxGeometry();geo.addEventListener('dispose',()=>geometriesDisposed++);group.add(new THREE.Mesh(geo,sharedMaterial),new THREE.Mesh(geo,sharedMaterial));const flash=new THREE.Sprite(new THREE.SpriteMaterial({map:sharedTexture}));flash.material.addEventListener('dispose',()=>flashesDisposed++);group.add(flash);const laserDot=new THREE.Mesh(new THREE.SphereGeometry(),new THREE.MeshBasicMaterial());laserDot.geometry.addEventListener('dispose',()=>lasersDisposed++);laserDot.material.addEventListener('dispose',()=>lasersDisposed++);return {group,flash,laserDot,stats:{},id:'test'};}
disposable.slots=[slot(),slot(),slot(),slot()];disposable.showCurrent();disposable.dispose();disposable.dispose();
assert.equal(geometriesDisposed,4,'unique per-slot geometry disposed once');assert.equal(flashesDisposed,4);assert.equal(lasersDisposed,8);assert.equal(materialDisposals,0);assert.equal(textureDisposals,0);
disposable.makeSlot=slot;disposable.setLoadout([{},{}]);disposable.replaceSlot(0,{});assert.equal(geometriesDisposed,5);disposable.setLoadout([{}]);assert.equal(geometriesDisposed,7);disposable.dispose();assert.equal(geometriesDisposed,8);assert.equal(materialDisposals,0);assert.equal(textureDisposals,0);
console.log('PASS replay resource regression: dispose/re-equip/replace release owned gun geometries, flash/laser resources exactly once; preserve shared materials/textures.');
