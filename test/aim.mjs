import assert from 'node:assert/strict';
import { Player, aimSensitivity } from '../js/player.js';
import { tunePlayerWeapon } from '../js/weapons.js';
import { computeStats } from '../js/data.js';
const p = Object.create(Player.prototype);
p.game = { settings: { aimMode: 'toggle' } }; p.aimLatched = false;
assert(p.resolveAim({ adsPressed: true, ads: true }));
assert(p.resolveAim({ ads: false, fire: true }), 'RMB release/LMB fire must keep toggle aim');
assert(!p.resolveAim({ adsPressed: true }), 'second click exits');
p.resolveAim({ adsPressed: true });
assert(!p.resolveAim({ sprint: true, sprintPressed: true, fwd: true }), 'sprint clears aim');
p.resolveAim({ adsPressed: true }); p.resetAim();
assert(!p.resolveAim({}), 'pause/respawn reset clears latch');
assert(p.resolveAim({ adsPressed: true, sprint: true, fwd: true }), 'RMB takes priority over held sprint');
assert(p.resolveAim({ sprint: true, fwd: true }), 'held Shift cannot cancel aim on the next frame');
p.game.settings.aimMode = 'hold';
assert(p.resolveAim({ ads: true })); assert(!p.resolveAim({ ads: false }));
const original = computeStats('m4'), tuned = tunePlayerWeapon(computeStats('m4'));
for (const key of ['dmgNear', 'dmgFar', 'mag', 'reserve', 'rpm', 'reload']) assert.equal(tuned[key], original[key], key);
console.log('PASS toggle/hold aim, reset and unchanged original weapon economy.');

assert(tuned.ads >= .07 && tuned.ads < original.ads * .5, 'ADS transition is substantially faster');

const settings = { sens: 5.5, adsSens: .9 };
const hip = aimSensitivity(settings, 1.4, 0);
assert(Math.abs(hip / (5.5 * .0022) - 1.25) < 1e-12);
assert(Math.abs(aimSensitivity(settings, 1.4, 1) / hip - .9) < 1e-12);
assert(Math.abs(aimSensitivity(settings, 1.4, .501) - aimSensitivity(settings, 1.4, .499)) < hip * .001, 'no halfway ADS sensitivity jump');
assert(aimSensitivity(settings, 7, 1) < aimSensitivity(settings, 1.4, 1), 'high-power optic retains fine control');
