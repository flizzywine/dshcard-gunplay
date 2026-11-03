import * as THREE from 'three';
import {MPMatch} from './mp.js';
import {SectorControl} from './sector-control.js';
import {fmtTime} from './util.js';

export class AttackDefenseMatch extends MPMatch {
  constructor(game,cfg){
    super(game,cfg);
    this.control=new SectorControl(game.world.sectors,{timeLimit:(cfg.timeLimit||15)*60});
    this.objectiveMeshes=[];
    for(const sector of this.control.sectors)for(const p of sector.points){
      const material=new THREE.MeshBasicMaterial({color:0xe76c45,transparent:true,opacity:.5,side:THREE.DoubleSide,depthWrite:false});
      const mesh=new THREE.Mesh(new THREE.RingGeometry(p.radius-.35,p.radius,64),material);mesh.rotation.x=-Math.PI/2;mesh.position.copy(p.pos);mesh.position.y+=.08;game.world.root.add(mesh);this.objectiveMeshes.push({point:p,sector,mesh});
    }
  }
  get activeSector(){return this.control.active;}
  start(){super.start();this.updateObjectives(0);this.hudScore();}
  announceStart(){
    this.game.hud.announce('烬区 · 攻防','进攻方 · 先占领 A，再推进 B、C 区',5);
    this.game.audio.say('攻防开始，攻占A点');
  }
  spawnPoint(team){
    const list=this.activeSector.spawns[team],enemies=this.enemiesOf(team),allies=this.game.entities.filter(e=>e.alive&&e.team===team);
    let best=list[0],score=-Infinity;
    for(const p of list){const danger=Math.min(60,...enemies.map(e=>e.pos.distanceTo(p))),space=Math.min(8,...allies.map(e=>e.pos.distanceTo(p)));const s=danger+space*3+Math.random();if(s>score){best=p;score=s;}}
    const pos=best.clone(),target=this.activeSector.points[0].pos;
    return {pos,yaw:Math.atan2(pos.x-target.x,pos.z-target.z)};
  }
  botGoal(bot){
    const available=this.activeSector.points.filter(p=>!p.captured);
    const targets=available.length?available:this.activeSector.points;
    const point=targets[(bot.id||0)%targets.length];
    // Both teams fight over the current points; future sectors stay locked.
    // Rotate a few metres around the centre to avoid crowding on one node.
    const phase=(bot.id||0)*2.39996,r=bot.team==='B'?5:3;
    const raw=point.pos.clone().add(new THREE.Vector3(Math.cos(phase)*r,0,Math.sin(phase)*r));
    const nav=this.game.world.navigation;return nav.point(nav.nearest(raw));
  }
  canRespawn(entity){return entity.team!=='A'||this.control.tickets>0;}
  onKill(killer,victim,weapon,head,info){if(victim.team==='A')this.control.loseTicket();super.onKill(killer,victim,weapon,head,info);}
  updateObjectives(dt){
    const events=this.control.update(dt,this.game.entities);this.timeLeft=this.control.timeLeft;
    for(const event of events){
      if(event.type==='captured'){
        this.game.hud.announce(`${event.point.label} 已占领`,'继续推进',3);
        if(this.control.contains(event.point,this.game.player)){this.game.player.stats.captures++;this.game.player.stats.score+=200;}
      }else if(event.type==='advance'){
        this.game.hud.announce(`推进至 ${this.activeSector.label} 区`,'前线出生点已解锁 · 增援 +40',5);
        for(const b of this.game.bots){
          b.goal=null;b.goalT=0;b.path=null;b.pathGoal=null;
          if(b.team==='B'&&b.alive){const sp=this.spawnPoint('B');b.respawn(sp.pos,sp.yaw);}
        }
      }
    }
    for(const{point,sector,mesh}of this.objectiveMeshes){mesh.visible=sector===this.activeSector;mesh.material.color.setHex(point.captured?0x55bbdf:point.contested?0xffcc55:0xed7956);}
    const points=this.activeSector.points;
    this.game.hud.objective(`攻占 ${this.activeSector.label} 区`,points.map(p=>`${p.label} ${p.captured?'已占领':p.contested?'争夺中':Math.round(p.progress*100)+'%'}`).join('　'),'进入标记范围占领 · 守军在场时暂停');
    this.game.hud.setMarkers(points.map(p=>({id:p.id,pos:p.pos.clone().add(new THREE.Vector3(0,3,0)),label:p.label,text:p.captured?'已占领':p.contested?'争夺中':`攻占 ${Math.round(p.progress*100)}%`,color:p.captured?'#63c9f0':'#ffac70'})));
    if(this.control.winner)this.end(this.control.winner);
  }
  hudScore(){
    const c=this.control,progress=c.sectors.map((s,i)=>`<span style="color:${i<c.index?'#80d8ee':i===c.index?'#ffd17b':'#777'}">${s.label}</span>`).join(' → ');
    this.game.hud.scorebar(`<div class="sb-team a">增援 ${c.tickets}</div><div class="sb-time">${progress}<small style="display:block">${c.overtime?'加时争夺':fmtTime(c.timeLeft)}</small></div><div class="sb-team b">防守方</div>`);
  }
  minimapMarkers(){return this.activeSector.points.map(p=>({x:p.pos.x,z:p.pos.z,label:p.label,color:p.captured?'#63c9f0':'#ffab68'}));}
  dispose(){super.dispose();this.game.hud.objective('','','');this.game.hud.setMarkers([]);for(const{mesh}of this.objectiveMeshes){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();}}
}
