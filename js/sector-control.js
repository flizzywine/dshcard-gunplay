// Capture state has no renderer or AI knowledge. Only living actors actually
// inside the active sector can affect its points.
export class SectorControl {
  constructor(sectors,{tickets=100,timeLimit=900,captureTime=20}={}){
    this.sectors=sectors.map(s=>({...s,points:s.points.map(p=>({...p,progress:0,captured:false,attackers:0,defenders:0,contested:false}))}));
    this.index=0;this.tickets=tickets;this.timeLeft=timeLimit;this.captureTime=captureTime;this.winner=null;this.overtime=false;
  }
  get active(){return this.sectors[this.index];}
  contains(point,e){return e.alive&&e.pos&&Math.hypot(e.pos.x-point.pos.x,e.pos.z-point.pos.z)<=point.radius&&Math.abs(e.pos.y-point.pos.y)<4.5;}
  loseTicket(){this.tickets=Math.max(0,this.tickets-1);}
  update(dt,entities){
    if(this.winner)return [];
    this.timeLeft=Math.max(0,this.timeLeft-dt);const events=[];
    for(const p of this.active.points){
      const occupants=entities.filter(e=>this.contains(p,e));p.attackers=occupants.filter(e=>e.team==='A').length;p.defenders=occupants.filter(e=>e.team==='B').length;p.contested=!!(p.attackers&&p.defenders);
      if(p.captured)continue;
      if(p.attackers&&!p.defenders)p.progress=Math.min(1,p.progress+dt/this.captureTime*Math.min(2,1+(p.attackers-1)*.25));
      else if(p.defenders&&!p.attackers)p.progress=Math.max(0,p.progress-dt/this.captureTime*.5);
      if(p.progress>=1){p.captured=true;events.push({type:'captured',point:p});}
    }
    if(this.active.points.every(p=>p.captured)){
      if(this.index===this.sectors.length-1){this.winner='A';events.push({type:'victory'});return events;}
      this.index++;this.tickets+=40;this.timeLeft+=120;events.push({type:'advance',sector:this.active});
    }
    this.overtime=this.timeLeft===0&&this.active.points.some(p=>!p.captured&&p.attackers>0);
    if((this.timeLeft===0&&!this.overtime)||(this.tickets===0&&!entities.some(e=>e.alive&&e.team==='A')))this.winner='B';
    return events;
  }
}
