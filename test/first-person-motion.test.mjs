import test from 'node:test';
import assert from 'node:assert/strict';
import { motionSpring } from '../js/first-person-motion.js';

test('landing motion stays small, settles, and is independent of render rate', () => {
  const samples = [];
  for (const fps of [30, 60, 120]) {
    let value = 0, velocity = 2, peak = 0;
    for (let i = 0; i < fps; i++) {
      const next = motionSpring(value, velocity, 0, 22, 1 / fps);
      value = next.value; velocity = next.velocity; peak = Math.max(peak, value);
      assert.ok(value >= 0 && value < 0.04);
    }
    assert.ok(peak > 0.025 && value < 1e-7);
    samples.push([value, velocity]);
  }
  for (const sample of samples.slice(1)) for (let i = 0; i < 2; i++) assert.ok(Math.abs(sample[i] - samples[0][i]) < 1e-12);
});
