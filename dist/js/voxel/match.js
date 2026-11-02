import * as THREE from 'three';
import { MPMatch } from '../mp.js';
import { Player } from '../player.js';
import { Bot } from '../ai.js';

// Reuse the actual gunplay, order, respawn and capture code, not a mock AI.
export class VoxelMatch extends MPMatch {
  constructor(game, cfg) {
    super(game, cfg);
    this.cfg.map = 'voxel-lab';
    this.editMode = false;
    this.allyCrossed = false;
  }

  start() {
    const g = this.game;
    this.sectors = g.world.def.sectors;
    this.activateSector(0, false);
    const sp = this.spawnPoint('A');
    g.player = new Player(g, { team: 'A', pos: sp.pos, yaw: 0, name: '你' });
    g.player.equip(this.buildLoadout()); g.entities.push(g.player);
    const ally = new Bot(g, { team: 'A', name: '先锋', style: 'ally', weaponId: 'm4',
      pos: new THREE.Vector3(2.5, 0, 8.5), difficulty: 1, tag: true });
    ally.squadIndex = 0; g.addBot(ally);
    g.addBot(new Bot(g, { team: 'B', name: '守卫', style: 'enemy', weaponId: 'm4',
      pos: new THREE.Vector3(.5, 0, -9.5), yaw: Math.PI, difficulty: 0, easyEnemy: true, static: true }));
    g.hud.reset(); g.hud.streaks(null, 0);
    g.hud.announce('体素突击 · 破墙演练', '按 4 切火箭 → 炸开红墙 → 与先锋夺下 A 点', 6);
    this.hudScore();
  }

  spawnPoint(team) {
    return { pos: new THREE.Vector3(team === 'A' ? .5 : -2.5, 0, team === 'A' ? 12.5 : -10.5), yaw: team === 'A' ? 0 : Math.PI };
  }

  prepareInput(inp) {
    if (inp.editPressed) {
      this.editMode = !this.editMode;
      this.game.hud.popup(this.editMode ? '建造：左键拆块 · 右键放木块 · 距离 8 米' : '战斗：左键射击 · 右键瞄准', '#86dce3');
    }
    if (!this.editMode) return;
    if (inp.firePressed || inp.adsPressed) {
      const g = this.game;
      const changed = g.world.edit(g.camera.position, g.camera.getWorldDirection(new THREE.Vector3()), !!inp.adsPressed);
      if (!changed) g.hud.popup('无法编辑这里：靠近方块，地基与边界不可修改', '#ffc47a');
    }
    inp.fire = inp.ads = inp.firePressed = inp.adsPressed = false;
  }

  update(dt) {
    if (this.game.bots.some(b => b.team === 'A' && b.alive && b.pos.z < -.6)) this.allyCrossed = true;
    super.update(dt);
  }

  hudScore() {
    const g = this.game, f = this.flags[0];
    g.hud.scorebar(`<div class="sb-team a">你 + 先锋</div><div class="sb-time">破墙演练</div><div class="sb-team b">${this.capturedCount}/1</div>`);
    g.hud.objective('炸开通路，夺下 A 点',
      `${g.world.removedBlocks ? '✓ 已破墙' : '① 按 4 用火箭破墙'} · ${this.allyCrossed ? '✓ 先锋已通过' : '② 先锋等待通路'} · 占领 ${Math.floor((f?.prog || 0) * 100)}%`,
      this.editMode ? '建造模式：左键拆块 / 右键放块 · V 返回战斗' : 'V 建造 / 战斗 · 5 跟随 / 6 进攻 / 7 守点 / 8 集火 · Esc 暂停');
    g.hud.setMarkers(f ? [{ id: 'voxel-goal', pos: f.pos.clone().add(new THREE.Vector3(0, 4, 0)), label: 'A', text: f.contested ? '争夺中' : '夺下训练场', cls: 'flag enemy' }] : []);
  }

  scoreboardHTML() {
    return super.scoreboardHTML().replace('你与九名友军', '你与先锋').replace('二十名敌军', '一名守卫');
  }

  end(winner, reason) {
    if (this.over) return;
    this.over = true;
    const g = this.game;
    g.ending = true; g.paused = true;
    document.getElementById('deathScreen').classList.add('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
    g.menu.showResults({ win: winner === 'A' ? 'win' : 'lose', title: winner === 'A' ? '通路已打通' : '再来一次', sub: reason,
      stats: [['破坏方块', g.world.removedBlocks], ['先锋穿墙', this.allyCrossed ? '已通过' : '未通过'], ['击杀', g.player.stats.kills]],
      board: this.scoreboardHTML(), again: () => g.startGame('mp', this.cfg) });
  }
}
