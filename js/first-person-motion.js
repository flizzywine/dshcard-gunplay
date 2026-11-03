// Exact critically damped spring integration; stable at different render rates.
export function motionSpring(value, velocity, target, frequency, dt) {
  const offset = value - target, decay = Math.exp(-frequency * dt);
  const transient = (velocity + frequency * offset) * dt;
  return { value: target + (offset + transient) * decay, velocity: (velocity - frequency * transient) * decay };
}
