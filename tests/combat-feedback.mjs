import assert from 'node:assert/strict';
import * as THREE from 'three';
import { HUD } from '../dist/js/hud.js';
import { Audio } from '../dist/js/audio.js';
import { Bot } from '../dist/js/ai.js';
import { animateSoldier } from '../dist/js/soldier.js';
const noop = () => {};
const elements = new Map();
globalThis.document = { getElementById(id) {
  if (!elements.has(id)) {
    const classes = new Set();
    elements.set(id, { style: {}, textContent: '', innerHTML: '',
      classList: { toggle(k, on) { on ? classes.add(k) : classes.delete(k); }, contains: k => classes.has(k) } });
  }
  return elements.get(id);
} };
const hud = Object.assign(Object.create(HUD.prototype), { hitT: 0 });
const marker = document.getElementById('hitmarker'), label = document.getElementById('hitConfirm');
hud.hitmarker(false, true); assert(marker.classList.contains('head')); assert.equal(label.textContent, '爆头');
hud.updateHitmarker(.04); const pulse = marker.style.transform;
hud.updateHitmarker(.08); assert.notEqual(marker.style.transform, pulse, 'hit pulse settles using game time');
hud.hitmarker(true, true); assert(marker.classList.contains('kill')); assert.equal(label.textContent, '爆头击杀');
hud.hitmarker(false, false); assert.equal(label.textContent, '爆头击杀', 'following body shot cannot overwrite kill');
const paused = hud.hitT; hud.updateHitmarker(0); assert.equal(hud.hitT, paused);
hud.updateHitmarker(1); assert.equal(marker.style.opacity, 0);
hud.hitmarker(false, false); assert(!marker.classList.contains('head')); assert(!marker.classList.contains('kill')); assert.equal(label.textContent, '');
hud.reset(); assert.equal(hud.hitT, 0); assert.equal(marker.style.opacity, 0);

const audio = new Audio(); audio.hit(true, true); // No AudioContext is safe.
const patterns = [];
audio.click = (...args) => patterns.push(['click', ...args]);
audio.tone = (...args) => patterns.push(['tone', ...args]);
audio.hit(); const body = JSON.stringify(patterns); patterns.length = 0;
audio.hit(false, true); const head = JSON.stringify(patterns); patterns.length = 0;
audio.hit(true, true); assert.notEqual(body, head); assert(patterns.some(p => p[1] === 1320 && p.at(-1) === .065));
let start;
const param = { setValueAtTime: noop, exponentialRampToValueAtTime: noop };
audio.ctx = { currentTime: 5, createGain: () => ({ gain: param, connect: noop }),
  createOscillator: () => ({ frequency: param, connect: noop, start: t => { start = t; }, stop: noop }) };
audio.out = () => ({});
Audio.prototype.tone.call(audio, 1320, .14, .2, 'triangle', null, 0, .065);
assert.equal(start, 5.065, 'kill confirmation uses the audio scheduler');

const game = { scene: new THREE.Scene(), time: 0, onKill: noop };
const bot = new Bot(game, { team: 'B', pos: new THREE.Vector3(), weaponId: 'm4' });
bot.anim.recoil = .8;
bot.takeDamage(1, { dir: new THREE.Vector3(1, 0, 0), head: false });
assert.equal(bot.anim.recoil, .8, 'incoming damage does not overwrite outgoing firing recoil');
animateSoldier(bot.model, bot.anim, 0);
assert(bot.model.torso.rotation.z > .1, 'side hit produces visible torso reaction');
assert.equal(bot.model.neck.rotation.x, 0, 'body hit does not snap the head');
bot.takeDamage(1, { dir: new THREE.Vector3(-1, 0, 0), head: true });
animateSoldier(bot.model, bot.anim, 0);
assert(bot.model.torso.rotation.z < -.1); assert(bot.model.neck.rotation.x < -.2);
bot.takeDamage(1000, { dir: new THREE.Vector3(0, 0, -1) });
animateSoldier(bot.model, bot.anim, 0);
assert.equal(bot.model.torso.rotation.z, 0); assert.equal(bot.model.neck.rotation.z, 0, 'death clears flinch pose');
bot.respawn(new THREE.Vector3(), 0); animateSoldier(bot.model, bot.anim, 0);
assert.equal(bot.anim.hitReact, 0); assert.equal(bot.model.torso.rotation.x, 0);
console.log('PASS combat feedback: head/kill priority, game-time pulse/reset, distinct audio scheduling, independent directional flinch, death/respawn cleanup.');
