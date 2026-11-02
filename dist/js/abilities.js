// Four bounded class skills and a player-piloted mech. No autonomous turret or invulnerability.
import * as THREE from 'three';
import { fireHitscan, assistedDirection } from './combat.js';
import { rayAABB, clamp, spreadDir, DEG } from './util.js';

export const SKILLS = Object.freeze([
  {id:'dash', key:'Z', name:'突击 · 冲刺', cooldown:9},
  {id:'incendiary', key:'X', name:'工程 · 燃烧弹', cooldown:20},
  {id:'support', key:'F', name:'支援 · 补给', cooldown:28},
  {id:'recon', key:'Q', name:'侦察 · 扫描', cooldown:24},
]);
const V = (x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const GUN = {name:'机甲重机炮',dmgNear:48,dmgFar:30,rangeNear:40,rangeFar:100,headMul:1.2};

export class Abilities {
  constructor(game) {
    this.game=game; this.cooldowns=Object.fromEntries(SKILLS.map(s=>[s.id,0]));
    this.summonCooldown=0; this.mech=null; this.mounted=false; this.rings=[]; this.projectiles=[];
    game.hazards=[];
  }
  notify(message){this.game.hud.popup(message,'#aee9d1');}
  ready(id){return this.cooldowns[id]<=0 && this.game.player?.alive && !this.mounted;}
  use(id,input={}){
    if(!this.ready(id))return false;
    const fn=this[id]; if(typeof fn!=='function'||fn.call(this,input)===false)return false;
    this.cooldowns[id]=SKILLS.find(s=>s.id===id).cooldown;return true;
  }
  // Every dash step runs real collision; no blink through a thin wall.
  dash(input={}){
    const g=this.game,p=g.player;
    let x=(input.right?1:0)-(input.left?1:0),z=(input.fwd?1:0)-(input.back?1:0);
    if(!x&&!z)z=1;
    const d=V(x*Math.cos(p.yaw)-z*Math.sin(p.yaw),0,-x*Math.sin(p.yaw)-z*Math.cos(p.yaw)).normalize();
    let moved=0;
    for(let i=0;i<24;i++){
      const before=p.pos.clone(),next=p.pos.clone().addScaledVector(d,.22);
      const dir=V(d.x,0,d.z),probe=before.clone().add(V(0,.9,0));
      if(g.world.raycast(probe,dir,.22+p.radius))break;
      const vel=d.clone();g.world.collide(next,vel,p.radius,1.8);
      if(next.distanceTo(before)<.04)break;
      const height=g.world.groundHeight(next.x,next.z,p.pos.y,p.radius);
      if(height>p.pos.y+.45||height<p.pos.y-1.2)break;
      p.pos.copy(next); p.pos.y=height;moved+=next.distanceTo(before);
    }
    if(moved<.15){this.notify('前方受阻，冲刺未消耗');return false;}
    p.vel.x=d.x*4;p.vel.z=d.z*4;g.audio.click(700,.15,.3);this.notify('突击位移');return true;
  }
  incendiary(){
    const g=this.game,p=g.player,from=p.eyePos(V()),dir=p.forward(V());
    const velocity=dir.multiplyScalar(16);velocity.y+=5;
    const grenade=new Incendiary(this,from,velocity,p);this.projectiles.push(grenade);
    this.notify('燃烧弹投出 · 封锁通道 7 秒');g.audio.click(1000,.1,.3);return true;
  }
  ignite(position,owner){
    const g=this.game,center=position.clone();center.y=g.world.groundHeight(center.x,center.z,center.y+.2,.1)+.06;
    const hazard={pos:center.clone(),radius:3,expiresAt:g.time+7,team:owner.team};g.hazards.push(hazard);
    g.effects.addFireSource(center,3,7,(dt,f)=>{
      for(const e of g.entities){
        if(!e.alive||e.targetable===false||e.team===owner.team&&e!==owner)continue;
        if(Math.hypot(e.pos.x-center.x,e.pos.z-center.z)>3||Math.abs(e.pos.y-center.y)>2)continue;
        const chest=e.chestPos(V());if(g.world.lineBlocked(center.clone().add(V(0,.25,0)),chest))continue;
        e.takeDamage(42*dt,{attacker:owner,weapon:'工程燃烧弹',burn:true,dir:V(0,1,0),point:center});
      }
    });
    g.audio.explosion(center,.35);g.effects.flashLight(center.clone().add(V(0,1,0)),0xff7020,15,2,12);
  }
  support(){
    const g=this.game,p=g.player;p.hp=Math.min(p.maxHp,p.hp+85);p.ws.fullAmmo();
    let n=0;for(const b of g.bots){if(b.alive&&b.team===p.team&&b.pos.distanceTo(p.pos)<10&&!g.world.lineBlocked(p.eyePos(V()),b.chestPos(V()))){b.hp=Math.min(b.maxHp,b.hp+65);b.mag=b.stats.mag;n++;}}
    this.pulse(p.pos,10,0x78ffb5);g.audio.click(1400,.2,.4);this.notify(`补给完成 · 回复 85 生命 / 弹药 · 支援 ${n} 名队友`);return true;
  }
  recon(){
    const g=this.game,p=g.player;let n=0;
    for(const b of g.bots){if(b.alive&&b.team!==p.team&&b.pos.distanceTo(p.pos)<=45){b.revealT=Math.max(b.revealT,6);n++;}}
    this.pulse(p.pos,45,0x6bcfff);this.notify(`扫描到 ${n} 名敌人 · 小地图显示 6 秒`);g.audio.click(1800,.15,.35);return true;
  }
  pulse(pos,r,color){
    const mesh=new THREE.Mesh(new THREE.RingGeometry(.8,1,40),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false}));
    mesh.rotation.x=-Math.PI/2;mesh.position.copy(pos).add(V(0,.12,0));this.game.scene.add(mesh);this.rings.push({mesh,t:0,r});
  }
  fits(pos,radius,height){
    const w=this.game.world;if(Math.abs(pos.x)>w.half-radius||Math.abs(pos.z)>w.half-radius)return false;
    if(w.ceilingHeight(pos.x,pos.z,pos.y,radius)<pos.y+height)return false;
    const boxes=w.queryBoxes?w.queryBoxes(pos.x-radius,pos.z-radius,pos.x+radius,pos.z+radius):w.boxes||[];
    return !boxes.some(b=>b.y1>pos.y+.45&&b.y0<pos.y+height&&b.x0<pos.x+radius&&b.x1>pos.x-radius&&b.z0<pos.z+radius&&b.z1>pos.z-radius);
  }
  safePosition(center,radius=.35,height=1.8,minimum=0){
    const w=this.game.world;
    for(const d of [minimum,minimum+1,minimum+2,minimum+3])for(let i=0;i<12;i++){
      const a=i*Math.PI/6,p=center.clone().add(V(Math.cos(a)*d,0,Math.sin(a)*d));
      p.y=w.groundHeight(p.x,p.z,center.y+.3,radius);
      if(Math.abs(p.y-center.y)>1||!this.fits(p,radius,height))continue;
      // Do not exit through a wall even when another free cell is nearby.
      if(d&&w.lineBlocked(center.clone().add(V(0,1.1,0)),p.clone().add(V(0,1.1,0))))continue;
      return p;
    }
    return null;
  }
  summon(){
    const g=this.game,p=g.player;if(!p?.alive||this.mounted)return false;
    if(this.mech?.alive){this.notify('机甲已在场 · 靠近后按 E 驾驶');return false;}
    if(this.summonCooldown>0){this.notify(`机甲整备中 ${Math.ceil(this.summonCooldown)} 秒`);return false;}
    const desired=p.pos.clone().addScaledVector(p.forward(V()).setY(0).normalize(),4);
    // Require visibility so the summon cannot appear across a wall.
    let spawn=this.safePosition(desired,.8,3.1);
    if(!spawn||g.world.lineBlocked(p.eyePos(V()),spawn.clone().add(V(0,1.5,0))))spawn=this.safePosition(p.pos,.8,3.1,3);
    if(!spawn){this.notify('空间不足 · 到开阔处召唤机甲');return false;}
    this.mech=new Mech(this,spawn);g.entities.push(this.mech);g.scene.add(this.mech.mesh);this.summonCooldown=90;
    this.notify('机甲就绪 · 靠近并按 E 驾驶');g.audio.explosion(spawn,.25);return true;
  }
  toggleMount(){
    const g=this.game,p=g.player,m=this.mech;if(!p?.alive)return false;
    if(this.mounted)return this.exit(false);
    if(!m?.alive||m.pos.distanceTo(p.pos)>4){this.notify('靠近机甲后按 E · B 召唤');return false;}
    if(g.world.lineBlocked(p.eyePos(V()),m.chestPos(V()))){this.notify('入口被遮挡');return false;}
    this.lastSafe=p.pos.clone();this.mounted=true;m.piloted=true;m.mesh.visible=false;p.resetAim?.();
    p.mountedMech=m;p.targetable=false;p.pos.copy(m.pos);p.vel.set(0,0,0);p.crouching=false;p.crouchT=0;p.sliding=false;
    p.protectedUntil=g.time; p.ws.adsT=0;g.scopeState=null;
    this.notify('机甲驾驶 · 左键重机炮 / 右键聚焦 · E 离舱');return true;
  }
  exit(destroyed=false,force=false){
    if(!this.mounted)return false;
    const g=this.game,p=g.player,m=this.mech;
    let safe=this.safePosition(m.pos,.35,1.8,1.6);
    if(!safe&&(destroyed||force)&&this.lastSafe&&this.fits(this.lastSafe,.35,1.8))safe=this.lastSafe.clone();
    if(!safe){
      if(!destroyed&&!force){this.notify('舱门受阻 · 移动至开阔处后离舱');return false;}
      const sp=g.mode?.spawnPoint?.(p.team);safe=sp?.pos?.clone()||m.pos.clone();
    }
    this.mounted=false;m.piloted=false;m.mesh.visible=m.alive;p.mountedMech=null;p.targetable=true;
    p.pos.copy(safe);p.vel.set(0,0,0);p.eyeSmooth=safe.y+1.62;p.onGround=true;p.protectedUntil=g.time;p.ws.state='switch';p.ws.stateT=0;p.ws.stateDur=.25;
    if(destroyed&&p.alive){p.takeDamage(75,{attacker:m.lastAttacker,weapon:'机甲被击毁',point:m.pos,dir:V(0,1,0)});this.notify('机甲被击毁 · 紧急弹出 / 受到 75 伤害');}
    else if(!destroyed)this.notify('已离舱 · 机甲留在原地');return true;
  }
  update(dt,input={}){
    for(const k of Object.keys(this.cooldowns))this.cooldowns[k]=Math.max(0,this.cooldowns[k]-dt);
    this.summonCooldown=Math.max(0,this.summonCooldown-dt);
    const g=this.game,p=g.player;if(this.mounted&&!p?.alive)this.exit(false,true);
    if(input.summonPressed)this.summon();if(input.enterPressed)this.toggleMount();
    if(input.dashPressed)this.use('dash',input);if(input.incendiaryPressed)this.use('incendiary');if(input.supportPressed)this.use('support');if(input.reconPressed)this.use('recon');
    for(const pr of this.projectiles)pr.update(dt);this.projectiles=this.projectiles.filter(pr=>pr.alive);
    g.hazards=g.hazards.filter(h=>h.expiresAt>g.time);
    for(const r of this.rings){r.t+=dt;r.mesh.scale.setScalar(Math.max(.1,r.r*r.t));r.mesh.material.opacity=Math.max(0,.6*(1-r.t));}
    this.rings=this.rings.filter(r=>{if(r.t<1)return true;g.scene.remove(r.mesh);r.mesh.geometry.dispose();r.mesh.material.dispose();return false;});
    const m=this.mech;if(m?.alive){m.cool=Math.max(0,m.cool-dt);if(!this.mounted||!input.fire||m.overheated)m.heat=Math.max(0,m.heat-dt*.32);if(m.overheated&&m.heat<.15)m.overheated=false;}
  }
  updatePlayer(dt,input={}){
    if(!this.mounted||!this.mech?.alive||!this.game.player?.alive)return false;
    const g=this.game,p=g.player,m=this.mech,w=g.world;
    const sensitivity=g.settings.sens*.0016*(input.ads?.6:1);p.yaw-=(input.mdx||0)*sensitivity;p.pitch=clamp(p.pitch-(input.mdy||0)*sensitivity*(g.settings.invertY?-1:1),-1.15,1.15);
    const x=(input.right?1:0)-(input.left?1:0),z=(input.fwd?1:0)-(input.back?1:0),move=V(x*Math.cos(p.yaw)-z*Math.sin(p.yaw),0,-x*Math.sin(p.yaw)-z*Math.cos(p.yaw));
    if(move.lengthSq())move.normalize().multiplyScalar(input.ads?2:3.2);
    m.vel.copy(move);m.pos.addScaledVector(move,dt);w.collide(m.pos,m.vel,.8,3.1);
    m.pos.y=w.groundHeight(m.pos.x,m.pos.z,m.pos.y,.8);p.pos.copy(m.pos);p.vel.copy(m.vel);m.mesh.position.copy(m.pos);m.mesh.rotation.y=p.yaw;
    const cam=g.camera;cam.position.copy(m.pos).add(V(0,2.45,0));cam.rotation.order='YXZ';cam.rotation.set(p.pitch,p.yaw,0,'YXZ');cam.fov=input.ads?60:g.settings.fov;cam.updateProjectionMatrix();g.audio.setListener(cam.position,p.yaw);
    if(input.fire&&m.cool<=0&&!m.overheated){
      m.cool=.105;m.heat=Math.min(1,m.heat+.043);if(m.heat>=1){m.overheated=true;this.notify('机炮过热 · 停火散热');}
      const f=cam.getWorldDirection(V()),d=assistedDirection(g,p,cam.position,f,1.8);
      const ray=spreadDir(d,.45*DEG,V()),hit=fireHitscan(g,p,cam.position,ray,GUN,GUN.name);p.stats.shots++;
      if(hit.ent){p.stats.hits++;g.hud.hitmarker(hit.killed,hit.part==='head');g.audio.hit(hit.killed);}
      g.effects.tracer(cam.position.clone().add(V(.25,-.2,0)),hit.point,[2.5,1.6,.4]);g.audio.shot('lmg',m.pos,false);g.makeNoise(m.pos,85,p.team);m.revealT=2;
    }
    return true;
  }
  status(){return {skills:SKILLS.map(s=>({...s,remaining:Math.ceil(this.cooldowns[s.id]),disabled:this.mounted})),mounted:this.mounted,mech:this.mech?.alive?{hp:Math.ceil(this.mech.hp),maxHp:this.mech.maxHp,heat:Math.round(this.mech.heat*100),overheated:this.mech.overheated,distance:this.game.player?Math.round(this.game.player.pos.distanceTo(this.mech.pos)):0}:null,summonCooldown:Math.ceil(this.summonCooldown)};}
  hudHTML(){const s=this.status();return `<div class="ability-slots">${s.skills.map(a=>`<span class="${a.remaining||a.disabled?'cooldown':'ready'}"><b>[${a.key}]</b> ${a.name}<small>${a.disabled?'驾驶中不可用':a.remaining?a.remaining+'s':'就绪'}</small></span>`).join('')}</div><div class="mech-status">${s.mounted?`机甲 ${s.mech.hp}/${s.mech.maxHp} · 热量 ${s.mech.heat}% ${s.mech.overheated?'过热冷却':''} · [E] 离舱`:s.mech?`机甲 ${s.mech.hp}HP · ${s.mech.distance}m · [E] 驾驶`:`[B] 召唤机甲 ${s.summonCooldown?s.summonCooldown+'s':'就绪'}`}</div>`;}
  dispose(){
    if(this.mounted)this.exit(false,true);
    const g=this.game;if(this.mech){g.scene.remove(this.mech.mesh);g.entities=g.entities.filter(e=>e!==this.mech);this.mech.dispose();}
    for(const p of this.projectiles)p.remove();for(const r of this.rings){g.scene.remove(r.mesh);r.mesh.geometry.dispose();r.mesh.material.dispose();}
    this.projectiles=[];this.rings=[];g.hazards=[];this.mech=null;this.mounted=false;
  }
}

class Incendiary {
  constructor(abilities,pos,vel,owner){this.abilities=abilities;this.pos=pos.clone();this.vel=vel.clone();this.owner=owner;this.alive=true;this.t=0;
    this.mesh=new THREE.Mesh(new THREE.BoxGeometry(.12,.25,.12),new THREE.MeshBasicMaterial({color:0xffae4f}));this.mesh.position.copy(pos);abilities.game.scene.add(this.mesh);}
  update(dt){if(!this.alive)return;const g=this.abilities.game;this.t+=dt;this.vel.y-=16*dt;
    for(let i=0;i<4;i++){const length=this.vel.length()*dt/4,dir=this.vel.clone().normalize(),hit=g.world.raycast(this.pos,dir,length+.08);if(hit){this.pos.copy(hit.point).addScaledVector(hit.normal,.12);this.detonate();return;}this.pos.addScaledVector(this.vel,dt/4);const floor=g.world.groundHeight(this.pos.x,this.pos.z,this.pos.y+.3,.1);if(this.pos.y<=floor+.1){this.pos.y=floor+.1;this.detonate();return;}}
    this.mesh.position.copy(this.pos);this.mesh.rotation.z+=dt*9;if(this.t>3)this.detonate();}
  detonate(){if(!this.alive)return;this.abilities.ignite(this.pos,this.owner);this.remove();}
  remove(){this.alive=false;this.abilities.game.scene.remove(this.mesh);this.mesh.geometry.dispose();this.mesh.material.dispose();}
}

export class Mech {
  constructor(abilities,pos){this.abilities=abilities;this.game=abilities.game;this.pos=pos.clone();this.vel=V();this.team=this.game.player.team;this.name='突击机甲';this.isMech=true;this.alive=true;this.targetable=true;this.maxHp=700;this.hp=700;this.radius=.8;this.heat=0;this.cool=0;this.overheated=false;this.piloted=false;this.revealT=0;
    this.mesh=new THREE.Group();const body=new THREE.MeshLambertMaterial({color:0x558e91}),dark=new THREE.MeshLambertMaterial({color:0x233a42}),visor=new THREE.MeshBasicMaterial({color:0x9fffe2});
    const box=(x,y,z,a,b,c,material)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(a,b,c),material);m.position.set(x,y,z);this.mesh.add(m);};
    box(0,2,0,1.35,1.3,.9,body);box(0,2.6,-.48,.85,.36,.08,visor);for(const side of [-1,1]){box(side*.46,.55,0,.44,1.1,.48,dark);box(side*.46,.12,-.22,.55,.25,.9,body);box(side*.95,1.95,0,.45,.7,.65,body);box(side*.95,1.9,-.7,.18,.18,1.1,dark);}this.mesh.position.copy(pos);
  }
  eyePos(out){return out.copy(this.pos).add(V(0,2.5,0));}chestPos(out){return out.copy(this.pos).add(V(0,1.8,0));}
  hitTest(o,d,maxT){if(!this.alive)return null;const b={x0:this.pos.x-.85,x1:this.pos.x+.85,y0:this.pos.y,y1:this.pos.y+2.9,z0:this.pos.z-.7,z1:this.pos.z+.7};const t=rayAABB(o.x,o.y,o.z,d.x,d.y,d.z,b,maxT);return t>=0?{t,part:'body'}:null;}
  takeDamage(amount,info={}){if(!this.alive)return false;this.hp=Math.max(0,this.hp-amount);this.lastAttacker=info.attacker;if(this.piloted){this.game.hud.damageFrom(info.attacker?.pos||this.pos);this.game.audio.hurt();}if(this.hp<=0){this.destroy();return true;}return false;}
  destroy(){if(!this.alive)return;this.alive=false;this.targetable=false;this.game.effects.explosion(this.pos,1.2);this.game.audio.explosion(this.pos,1);if(this.abilities.mounted)this.abilities.exit(true);this.game.scene.remove(this.mesh);this.game.entities=this.game.entities.filter(e=>e!==this);this.dispose();}
  dispose(){if(this.disposed)return;this.disposed=true;this.mesh.traverse(o=>{o.geometry?.dispose();});const materials=new Set();this.mesh.traverse(o=>{if(o.material)materials.add(o.material);});materials.forEach(m=>m.dispose());}
}
