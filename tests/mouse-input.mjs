import assert from 'node:assert/strict';
import { Game } from '../dist/js/main.js';

// Exercise the actual pointer-lock event handler, including the first flick after
// a quiet interval. DPI and event coalescing must not silently lose movement.
const listeners = new Map();
globalThis.window = { addEventListener(type, fn) { listeners.set(type, fn); } };
let now = 1000;
Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
const canvas = {};
globalThis.document = { pointerLockElement: canvas, addEventListener() {}, getElementById: () => ({ addEventListener() {} }) };
const game = Object.create(Game.prototype);
game.canvas = canvas;
game.input = { keys: {}, pressed: {}, buttons: 0, mdx: 0, mdy: 0, wheel: 0 };
game.setupInput();
const move = (x, y = 0) => listeners.get('mousemove')({ movementX: x, movementY: y });
move(8); now += 4; move(300, -40);
assert.equal(game.input.mdx, 308, 'first fast flick must retain all horizontal input');
assert.equal(game.input.mdy, -40, 'first fast flick must retain all vertical input');
now += 400; move(-240, 30);
assert.equal(game.input.mdx, 68, 'flick after a pause must remain responsive');
assert.equal(game.input.mdy, -10);
move(Number.NaN); move(10, Number.POSITIVE_INFINITY);
assert.equal(game.input.mdx, 68, 'invalid browser deltas cannot poison the camera');
document.pointerLockElement = null; move(900);
assert.equal(game.input.mdx, 68, 'unlocked pointer must not move camera');
console.log('PASS mouse input: fast flicks and coalesced movement retain displacement; unlocked movement ignored.');
