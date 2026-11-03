// Normalized action timing is shared by the hands, magazine and sound cues.
// Smooth each reach independently: the weapon stays supported between actions.
export const RELOAD_CUES = { out: 0.22, in: 0.66, bolt: 0.82 };

function ease(a, b, t) {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

function pulse(a, b, c, t) { return ease(a, b, t) * (1 - ease(b, c, t)); }

// AT4 is exchanged as a complete disposable tube rather than receiving an RPG
// warhead. The fresh tube remains a separate object until the action completes.
export function at4ReloadPose(t){
  const discard=ease(.08,.36,t),lift=ease(.40,.82,t),settle=pulse(.82,.88,.98,t);
  return {usedVisible:t<.40,usedPosition:[.12*discard,-.65*discard,.2*discard],usedRotation:[.35*discard,0,-.55*discard],freshVisible:t>=.42,freshPosition:[-.14*(1-lift),.06*(1-lift)-settle*.012,.02*(1-lift)],freshRotation:[.05*(1-lift),-.12*(1-lift),-.08*(1-lift)],reach:ease(.20,.45,t)*(1-ease(.84,1,t))};
}

export function reloadPose(progress, style = 'magazine', empty = false) {
  const t = Math.max(0, Math.min(1, progress));
  const hold = ease(0, 0.16, t) * (1 - ease(0.80, 1, t));
  const reach = ease(0.07, 0.21, t) * (1 - ease(empty ? 0.87 : 0.74, 0.96, t));
  // Withdraw below the frame, fetch a fresh magazine, align, then seat firmly.
  const withdraw = ease(RELOAD_CUES.out, 0.39, t) * (1 - ease(0.49, RELOAD_CUES.in, t));
  const seat = pulse(0.635, RELOAD_CUES.in, 0.72, t);
  const bolt = empty ? pulse(0.75, RELOAD_CUES.bolt, 0.89, t) : 0;
  const handAction = empty ? ease(0.72, 0.77, t) * (1 - ease(0.86, 0.93, t)) : 0;
  const settle = pulse(0.88, 0.93, 1, t);
  const pose = {
    position: [-0.10 * hold, 0.14 * hold - 0.007 * seat, -0.24 * hold + 0.008 * seat],
    rotation: [0.10 * hold - 0.025 * seat + 0.035 * bolt, 0.32 * hold, -0.38 * hold + 0.025 * seat + 0.018 * settle],
    magPosition: [-0.08 * withdraw, -0.38 * withdraw, 0.10 * withdraw],
    magRotation: [-0.18 * withdraw, 0.10 * withdraw, -0.22 * withdraw],
    magVisible: !(t > 0.40 && t < 0.48),
    reach, handAction, bolt, wrist: -0.25 * reach,
  };
  if (style === 'shell') {
    // Each shell gets a complete reach and push; no looping magazine drop.
    const feed = ease(0.10, 0.64, t);
    const push = pulse(0.60, 0.72, 0.88, t);
    const lift = Math.sin(t * Math.PI);
    pose.position = [-0.025 * lift, 0.045 * lift - 0.012 * push, -0.05 * lift + 0.015 * push];
    pose.rotation = [0.045 * push, 0, -0.18 * lift];
    pose.magPosition = [-0.07 * (1 - feed), -0.16 * (1 - feed), 0.10 * (1 - feed)];
    pose.magRotation = [0, 0, 0];
    pose.magVisible = t > 0.12 && t < 0.76;
    pose.reach = ease(0, 0.25, t) * (1 - ease(0.76, 1, t));
    pose.handAction = 0; pose.bolt = 0;
  } else if (style === 'revolver') {
    const open = ease(0.15, 0.29, t) * (1 - ease(0.72, 0.84, t));
    pose.magPosition = [-0.055 * open, 0, 0];
    pose.magRotation = [0, 0, -0.15 * open];
    pose.magVisible = true;
    pose.handAction = 0; pose.bolt = 0;
  } else if (style === 'launcher') {
    // Keep the long tube and reaching arm below/right of the sight line.
    // A rifle's raised, inward magazine pose fills the view with this rig.
    pose.position = [0.12 * hold, -0.14 * hold - 0.007 * seat, -0.03 * hold];
    pose.magPosition = [-0.03 * withdraw, -0.06 * withdraw, -0.48 * withdraw];
    pose.magRotation = [0, 0, 0];
    pose.rotation = [0.03 * hold, -0.12 * hold, -0.12 * hold];
    pose.handAction = 0; pose.bolt = 0;
  } else if (style === 'pistol') {
    pose.rotation[2] *= 0.7;
    pose.magPosition[1] *= 0.75;
    pose.magPosition[2] *= 0.5;
  }
  return pose;
}
