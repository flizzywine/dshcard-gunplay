export const HERO_WEAPONS = ['m4', 'm870', 'l115', 'rpg'];
export const WEAPON_ROLES = { m4: '突击步枪 · 中距离', m870: '霰弹枪 · 近距离', l115: '狙击步枪 · 远距离', rpg: '火箭筒 · 爆炸打击' };
// Stable save identifiers; displayed names and assembled models come from Delta.
export function heroLoadout() {
  return { weapons: HERO_WEAPONS.map(id => ({ id, att: {} })), perks: [] };
}
