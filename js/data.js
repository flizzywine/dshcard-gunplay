// 游戏数据：武器、配件、Perk、连杀奖励、投掷物、地图列表

export const WEAPONS = {
  m4: {
    name: '腾龙突击步枪', cls: '突击步枪', type: 'ar', slot: 'primary',
    dmg: [34, 26], range: [75, 220], rpm: 800, mag: 30, reserve: 150, reload: 2.1, ads: 0.24, zoom: 1.4, bulletRange: 650,
    recoil: [0.9, 0.45], spread: 3.2, mobility: 0.95, fire: 'auto', headMul: 1.6, sprintFire: 0.22,
    sound: 'rifle', model: { recv: 0.28, barrel: 0.28, hand: 0.26, stock: 'm4', mag: 'straight', color: 'black', grip: 'ar' },
    slots: ['muzzle', 'barrel', 'laser', 'optic', 'stock', 'under', 'mag', 'rear'],
  },
  m870: {
    name: 'M870 霰弹枪', cls: '霰弹枪', type: 'shotgun', slot: 'primary',
    dmg: [16, 6], range: [7, 16], rpm: 72, mag: 6, reserve: 30, reload: 0.55, ads: 0.25, pellets: 9,
    recoil: [3.8, 1.2], spread: 5, adsSpread: 4.2, mobility: 1.0, fire: 'pump', headMul: 1.2, sprintFire: 0.2, shellReload: true,
    sound: 'shotgun', model: { recv: 0.26, barrel: 0.32, hand: 0.18, stock: 'fixed', mag: 'tube', color: 'black', grip: 'ak' },
    slots: ['muzzle', 'barrel', 'laser', 'optic', 'stock', 'rear'],
  },
  l115: {
    name: 'AWM 狙击步枪', cls: '狙击步枪', type: 'sniper', slot: 'primary',
    dmg: [115, 105], range: [80, 150], rpm: 44, mag: 5, reserve: 30, reload: 3.2, ads: 0.48, bulletRange: 900,
    recoil: [4.5, 0.8], spread: 9, mobility: 0.88, fire: 'bolt', headMul: 2.0, sprintFire: 0.35, defaultOptic: 'sniper',
    sound: 'sniper', model: { recv: 0.34, barrel: 0.5, hand: 0.26, stock: 'sniper', mag: 'box5', color: 'green', grip: 'sniper' },
    slots: ['muzzle', 'barrel', 'laser', 'optic', 'stock', 'mag', 'rear'],
  },
  rpg: {
    name: 'AT4 火箭筒', cls: '火箭筒', type: 'launcher', slot: 'secondary',
    dmg: [150, 150], range: [0, 0], rpm: 30, mag: 1, reserve: 3, reload: 4.1, ads: 0.4, zoom: 2.4,
    recoil: [5, 1], spread: 4, mobility: 0.9, fire: 'semi', headMul: 1, sprintFire: 0.4, projectile: 'rocket',
    sound: 'rocket', model: { rpg: true, color: 'green' },
    slots: [],
  },
};

export const PRIMARY_ORDER = ['m4', 'm870', 'l115'];
export const SECONDARY_ORDER = ['rpg'];

export const SLOT_NAMES = {
  muzzle: '枪口', barrel: '枪管', laser: '激光', optic: '瞄准镜', stock: '枪托', under: '下挂', mag: '弹匣', rear: '后握把',
};

// 配件效果：乘数 (>1 表示数值变大)
export const ATTACHMENTS = {
  muzzle: [
    { id: 'suppressor', name: '战术消音器', fx: { suppressed: true, range: 1.1, ads: 1.07 }, desc: '射击不会在敌方雷达上暴露' },
    { id: 'comp', name: '补偿器', fx: { recoilV: 0.85, recoilH: 1.05 } },
    { id: 'brake', name: '枪口制退器', fx: { recoilH: 0.8, recoilV: 0.95, ads: 1.03 } },
    { id: 'flash', name: '消焰器', fx: { flashHide: true, recoilV: 0.95 } },
  ],
  barrel: [
    { id: 'long', name: '加长重型枪管', fx: { range: 1.3, recoilV: 0.92, ads: 1.1, mobility: 0.96 } },
    { id: 'short', name: '短突击枪管', fx: { range: 0.8, ads: 0.88, mobility: 1.04, sprintFire: 0.85 } },
    { id: 'fluted', name: '凹槽轻量枪管', fx: { range: 1.1, ads: 0.95, recoilH: 1.08 } },
  ],
  laser: [
    { id: 'tac', name: '5mW 战术激光', fx: { hip: 0.65, ads: 0.97, laser: true } },
    { id: 'mw1', name: '1mW 瞄准激光', fx: { ads: 0.9, sprintFire: 0.88, laser: true } },
  ],
  optic: [
    { id: 'reddot', name: 'MRS 红点镜', fx: { zoom: 1.35, optic: 'reddot' } },
    { id: 'holo', name: '全息瞄准镜', fx: { zoom: 1.4, optic: 'holo', ads: 1.02 } },
    { id: 'acog', name: '4倍 ACOG', fx: { zoom: 3, optic: 'acog', ads: 1.08 } },
    { id: 'thermal', name: '热成像瞄具', fx: { zoom: 2.5, optic: 'thermal', ads: 1.12 } },
    { id: 'sniper', name: '高倍狙击镜', fx: { zoom: 7, optic: 'sniper', ads: 1.15 }, only: ['sniper', 'marksman'] },
  ],
  stock: [
    { id: 'none', name: '无枪托', fx: { mobility: 1.08, ads: 0.85, recoilV: 1.25, recoilH: 1.2 } },
    { id: 'tac', name: '战术枪托', fx: { recoilV: 0.9, recoilH: 0.9, ads: 1.04 } },
    { id: 'heavy', name: '重型固定枪托', fx: { recoilV: 0.82, recoilH: 0.85, mobility: 0.95, ads: 1.06 } },
  ],
  under: [
    { id: 'vgrip', name: '垂直握把', fx: { recoilV: 0.86, ads: 1.04 } },
    { id: 'agrip', name: '斜角握把', fx: { ads: 0.9, recoilH: 0.92 } },
    { id: 'bipod', name: '战术脚架', fx: { recoilV: 0.8, recoilH: 0.8, mobility: 0.97, ads: 1.05 } },
  ],
  mag: [
    { id: 'ext', name: '扩容弹匣', fx: { mag: 1.5, reload: 1.12, ads: 1.03 } },
    { id: 'drum', name: '大容量弹鼓', fx: { mag: 2, reload: 1.35, ads: 1.1, mobility: 0.95 }, not: ['shotgun', 'sniper', 'marksman', 'pistol'] },
    { id: 'fast', name: '快拔双联弹匣', fx: { reload: 0.72 } },
  ],
  rear: [
    { id: 'rubber', name: '橡胶握把胶带', fx: { recoilV: 0.95, recoilH: 0.95 } },
    { id: 'grain', name: '颗粒握把胶带', fx: { ads: 0.95, sprintFire: 0.95 } },
    { id: 'stip', name: '防滑握把', fx: { hip: 0.9 } },
  ],
};

export const CAMOS = [
  { id: 'none', name: '标准' }, { id: 'desert', name: '沙漠' }, { id: 'woodland', name: '林地' },
  { id: 'digital', name: '都市数码' }, { id: 'tiger', name: '虎纹' }, { id: 'dragon', name: '赤鳞' }, { id: 'gold', name: '黄金' },
];

export function findAttachment(slot, id) { return (ATTACHMENTS[slot] || []).find(a => a.id === id); }

export function attachmentAllowed(weaponId, slot, att) {
  const w = WEAPONS[weaponId];
  if (!w.slots.includes(slot)) return false;
  if (att.only && !att.only.includes(w.type)) return false;
  if (att.not && att.not.includes(w.type)) return false;
  if (w.type === 'pistol' && slot === 'optic' && att.id !== 'reddot') return false;
  if (w.type === 'lmg' && slot === 'mag') return false;
  return true;
}

// 计算最终武器属性
export function computeStats(weaponId, attachments = {}) {
  const b = WEAPONS[weaponId];
  const s = {
    id: weaponId, name: b.name, type: b.type, cls: b.cls,
    dmgNear: b.dmg[0], dmgFar: b.dmg[1], rangeNear: b.range[0], rangeFar: b.range[1],
    rpm: b.rpm, mag: b.mag, reserve: b.reserve, reload: b.reload, ads: b.ads,
    recoilV: b.recoil[0], recoilH: b.recoil[1], hip: b.spread, adsSpread: b.adsSpread || 0.15,
    mobility: b.mobility, fire: b.fire, headMul: b.headMul, pellets: b.pellets || 1,
    sprintFire: b.sprintFire, suppressed: false, zoom: b.zoom || 1.2, optic: 'iron', laser: false,
    projectile: b.projectile, sound: b.sound, shellReload: !!b.shellReload, flashHide: false, bulletRange: b.bulletRange || 400,
  };
  if (b.defaultOptic && !attachments.optic) { s.optic = b.defaultOptic; s.zoom = 7; }
  for (const slot in attachments) {
    const a = findAttachment(slot, attachments[slot]);
    if (!a) continue;
    const fx = a.fx;
    if (fx.range) { s.rangeNear *= fx.range; s.rangeFar *= fx.range; }
    if (fx.ads) s.ads *= fx.ads;
    if (fx.mobility) s.mobility *= fx.mobility;
    if (fx.recoilV) s.recoilV *= fx.recoilV;
    if (fx.recoilH) s.recoilH *= fx.recoilH;
    if (fx.hip) s.hip *= fx.hip;
    if (fx.mag) { s.mag = Math.round(s.mag * fx.mag); s.reserve = Math.round(s.reserve * Math.min(fx.mag, 1.5)); }
    if (fx.reload) s.reload *= fx.reload;
    if (fx.sprintFire) s.sprintFire *= fx.sprintFire;
    if (fx.suppressed) s.suppressed = true;
    if (fx.flashHide) s.flashHide = true;
    if (fx.laser) s.laser = true;
    if (fx.zoom) { s.zoom = fx.zoom; s.optic = fx.optic; }
  }
  return s;
}

// 0-100 的属性条
export function statBars(s) {
  const c = v => Math.max(3, Math.min(100, v));
  const dps = s.dmgNear * s.pellets * s.rpm / 60;
  return {
    '精准度': c(100 - (s.recoilV * 16 + s.recoilH * 14) - s.hip * 1.5 + 10),
    '伤害': c(s.dmgNear * s.pellets / 1.2),
    '射程': c(s.rangeFar / 1.3),
    '射速': c(s.rpm / 11),
    '机动性': c((s.mobility - 0.75) * 300),
    '操控性': c(100 - s.ads * 140 - s.reload * 6),
    '_dps': dps,
  };
}

export const LETHALS = [
  { id: 'frag', name: '破片手雷', desc: '可烹饪的延时破片手雷', count: 2 },
  { id: 'semtex', name: '粘性炸弹', desc: '粘附于任何表面，2秒后爆炸', count: 2 },
  { id: 'molotov', name: '燃烧瓶', desc: '撞击后爆燃，形成持续燃烧区域', count: 2 },
];
export const TACTICALS = [
  { id: 'flash', name: '闪光弹', desc: '使范围内的敌人致盲和失聪', count: 2 },
  { id: 'smoke', name: '烟雾弹', desc: '释放遮蔽视线的浓烟', count: 1 },
  { id: 'stim', name: '兴奋剂', desc: '立即恢复全部生命值', count: 1 },
];

export const DEFAULT_CLASSES = [{ name: '主角', primary: 'm4', patt: { optic: 'holo', under: 'vgrip', muzzle: 'comp' }, pcamo: 'none', perks: [] }];
export const DEFAULT_STREAKS = [];

export const MP_MAPS = [
  { id: 'cracked', name: '烬区 · 战场灰盒', desc: '保留主要地形、城区街巷和掩体。A 点水塔与房屋、C1 厂房为完整初始状态。', style: '山地与城区 · 原尺度灰盒', grad: 'linear-gradient(135deg,#c1c7c1,#686f69)' },
  { id: 'karkand', name: 'Karkand · 大战场灰盒', desc: 'Insurgency 社区重制版：长街、巷道、地形高差与桥梁。模型掩体为方块近似。', style: '城镇大战场 · 多路步兵交战', grad: 'linear-gradient(135deg,#c0a680,#626967)' },
  { id: 'dust2', name: 'Dust II · 经典灰盒', desc: 'CS: Source 原始几何：A 大道、小道、中门、B 隧道与双包点。模型掩体为简化方块。', style: '经典布局 · 原尺度高差', grad: 'linear-gradient(135deg,#d2bea0,#796049)' },
];

export const MP_MODES = [
  { id: 'breakthrough', name: '攻防推进', desc: '先占领 A，再攻占 B1/B2，最后攻占 C1/C2。前线出生点随区域推进。' },
  { id: 'tdm', name: '团队死斗', desc: '两支队伍对抗，率先达到击杀目标的队伍获胜。' },
];

export const BOT_NAMES = ['猎鹰', '蝮蛇', '雷霆', '北极狐', '老炮', '独狼', '夜莺', '铁拳', '野马', '黑曼巴', '响尾蛇', '秃鹫', '猎户', '灰熊', '刺刀', '暴风', '渡鸦', '钢锯', '寒鸦', '猛犸', '火蜥', '毒刺', '沙暴', '白鲨'];
