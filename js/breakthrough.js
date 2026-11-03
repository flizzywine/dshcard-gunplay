// Pure match rules, shared by the renderer/controller and deterministic tests.
export class Breakthrough {
  constructor(sectors, { tickets = 180, reinforcement = 80, captureSeconds = 18 } = {}) {
    this.sectors = sectors.map(s => ({ ...s, objectives: s.objectives.map(o => ({ ...o, owner: 'B', prog: 0, contested: false })) }));
    this.stage = 0; this.tickets = tickets; this.reinforcement = reinforcement;
    this.captureSeconds = captureSeconds; this.winner = null;
  }
  get current() { return this.sectors[this.stage]; }
  get objectives() { return this.current.objectives; }
  casualty(team) {
    if (this.winner || team !== 'A') return;
    this.tickets = Math.max(0, this.tickets - 1);
  }
  update(dt, entities, timeLeft) {
    if (this.winner) return { captures: [], advanced: false };
    const captures = [];
    let attacking = false;
    for (const f of this.objectives) {
      const counts = { A: 0, B: 0 };
      for (const e of entities) {
        if (!e.alive || !e.pos || e.targetable === false || e.isTurret || !(e.team in counts)) continue;
        const p = f.pos || { x: f.x, y: 0, z: f.z };
        if (Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < f.radius && Math.abs(e.pos.y - p.y) < 5) counts[e.team]++;
      }
      f.contested = counts.A > 0 && counts.B > 0;
      if (counts.A > 0 && (f.owner !== 'A' || f.contested)) attacking = true;
      if (f.contested) continue;
      const rate = dt / this.captureSeconds;
      if (counts.A) {
        f.prog = Math.min(1, f.prog + rate * Math.min(2, 1 + (counts.A - 1) * 0.25));
        if (f.prog >= 1 && f.owner !== 'A') { f.owner = 'A'; captures.push(f); }
      } else if (counts.B) {
        f.prog = Math.max(0, f.prog - rate * Math.min(2, 1 + (counts.B - 1) * 0.25));
        if (f.prog <= 0 && f.owner === 'A') { f.owner = 'B'; captures.push(f); }
      } else if (f.owner !== 'A') f.prog = Math.max(0, f.prog - rate * 0.2);
    }
    if (this.objectives.every(f => f.owner === 'A')) {
      if (this.stage === this.sectors.length - 1) this.winner = 'A';
      else { this.stage++; this.tickets += this.reinforcement; return { captures, advanced: true }; }
    }
    if (!this.winner && (this.tickets <= 0 || (timeLeft <= 0 && !attacking))) this.winner = 'B';
    return { captures, advanced: false, overtime: timeLeft <= 0 && attacking };
  }
}
