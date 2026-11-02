// Safe deterministic mode tests: execute current class with inert rendering/audio adapters.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../dist/js/mp.js'), 'utf8').replace(/^import .*;\n/gm, '').replace(/export /g, '') + '\nglobalThis.Match = MPMatch;';
class V { constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});} clone(){return new V(this.x,this.y,this.z)} copy(v){Object.assign(this,{x:v.x,y:v.y,z:v.z});return this} add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this} distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z)} }
const element = () => ({classList:{add(){},remove(){}},textContent:''});const elements=new Map();let exited=0;const timers=[];
const math=Object.create(Math);math.random=()=>.5;
const ctx={console,Math:math,Map,THREE:{Vector3:V},Bot:class{constructor(g,o){Object.assign(this,o,{alive:true,id:g.bots.length+1,kills:0,score:0,deaths:0});this.eyePos=()=>this.pos.clone();this.chestPos=()=>this.pos.clone();this.respawn=(p)=>{this.pos=p;this.alive=true}}},pick:a=>a[0],BOT_NAMES:['One','Two'],fmtTime:n=>String(n),setTimeout:fn=>(timers.push(fn),timers.length),clearTimeout(){},document:{pointerLockElement:{},exitPointerLock(){exited++},getElementById:id=>elements.get(id)||(elements.set(id,element()),elements.get(id))}};
vm.runInNewContext(source,ctx);const noop=()=>{};
function fixture(){
 const pl={isPlayer:true,team:'A',name:'you',alive:true,pos:new V(),stats:{kills:0,deaths:0,score:0,streak:0,assists:0,shots:0,hits:0,headshots:0,captures:0},respawn(p){this.pos=p;this.alive=true;this.respawned=true},eyePos(){return this.pos.clone()},chestPos(){return this.pos.clone()}};
 const game={time:0,player:pl,entities:[pl],bots:[],world:{root:{remove:noop},lineBlocked:()=>false},hud:{killfeed:noop,popup:noop,streaks:noop,scorebar:noop,setMarkers:noop,announce:noop,objective:noop,progress:noop},menu:{showResults:r=>game.result=r},audio:{say:noop},pause:()=>{game.paused=true},addBot:b=>{game.bots.push(b);game.entities.push(b)},startGame:(kind,cfg)=>{game.replay={kind,cfg}}};
 const mode=new ctx.Match(game,{});game.mode=mode;mode.flagMesh=()=>null;
 mode.sectors=[{name:'A',objectives:[{id:'A',name:'village',pos:new V(),radius:8}],attackSpawns:[new V(-20)],defendSpawns:[new V(20)]},{name:'B',objectives:[{id:'B1',name:'camp',pos:new V(50),radius:8},{id:'B2',name:'slum',pos:new V(80),radius:8}],attackSpawns:[new V(30)],defendSpawns:[new V(100)]},{name:'C',objectives:[{id:'C1',name:'warehouse',pos:new V(130),radius:8},{id:'C2',name:'office',pos:new V(160),radius:8}],attackSpawns:[new V(110)],defendSpawns:[new V(180)]}];mode.activateSector(0,false);return {mode,game,pl};
}
{
 const {mode,game,pl}=fixture();assert.equal(mode.type,'assault');assert.equal(mode.cfg.map,'jinqu');assert.equal(mode.cfg.allies,9);assert.equal(mode.cfg.enemies,20);assert.equal(mode.timeLeft,600);
 assert.equal(mode.buildLoadout().weapons.map(w=>w.id).join(','),'m4,m870,l115,rpg');assert.equal(mode.buildLoadout().lethal,null);
 mode.updateCaptures(4);assert.equal(mode.flags[0].prog,.4);
 const enemy={alive:true,team:'B',pos:new V()};game.entities.push(enemy);mode.updateCaptures(20);assert.equal(mode.flags[0].prog,.4);assert.equal(mode.flags[0].contested,true);
 enemy.pos=new V(30);pl.pos=new V(30);mode.updateCaptures(10);assert.equal(mode.flags[0].prog,.4,'partial progress retained');
 pl.pos=new V();mode.updateCaptures(6);assert.equal(mode.sectorIndex,1);assert.equal(mode.tickets,200);assert(mode.spawnPoint('A').pos.distanceTo(new V(30))<=2.21,'forward spawn stays near stage anchor');assert.equal(mode.capturedCount,1);
 pl.pos=new V(50);mode.updateCaptures(10);assert.equal(mode.sectorIndex,1,'both B points required');assert.equal(mode.flags[0].captured,true);
 enemy.pos=new V(50);mode.updateCaptures(10);assert.equal(mode.flags[0].captured,true,'captured point cannot backcap');
 pl.pos=new V(80);mode.updateCaptures(10);assert.equal(mode.sectorIndex,2);
 pl.pos=new V(130);mode.updateCaptures(10);pl.pos=new V(160);mode.updateCaptures(10);assert.equal(mode.over,true);assert.equal(game.paused,true);assert.equal(mode.capturedCount,5);timers.at(-1)();assert.equal(game.result.win,'win');game.result.again();assert.equal(game.replay.cfg.mode,'assault');
}
{
 const {mode,game,pl}=fixture();mode.addBot('A','ally','');mode.addBot('B','enemy','');assert.equal(game.bots[0].difficulty,1);assert.equal(game.bots[1].easyEnemy,true);
 pl.alive=false;mode.onKill(game.bots[1],pl,'rifle',false);assert.equal(mode.tickets,159);assert.equal(mode.respawns[0].t,1);const before=exited;mode.update(1.1);assert.equal(pl.respawned,true);assert.equal(exited,before);
 mode.tickets=1;pl.alive=false;mode.onKill(game.bots[1],pl,'rifle',false);assert.equal(mode.over,true);timers.at(-1)();assert.equal(game.result.win,'lose');
 const time=fixture();time.mode.timeLeft=.1;time.mode.update(.2);assert.equal(time.mode.over,true);timers.at(-1)();assert.equal(time.game.result.win,'lose');
}
{
 const {mode,game,pl}=fixture();for(let i=0;i<9;i++){const b=mode.addBot('A','ally'+i,'');b.squadIndex=i;}
 assert.equal(mode.issueCommand('attack',new V(5),null,'squad'),true);assert.equal(game.bots.filter(b=>b.command).length,3);assert.equal(mode.commandGoal(game.bots[0]).x,5);
 mode.issueCommand('defend',new V(7),null,'all');assert.equal(game.bots.filter(b=>b.command?.kind==='defend').length,9);
 mode.issueCommand('follow',null,null,'squad');pl.pos=new V(12);assert.ok(mode.commandGoal(game.bots[0]).x>12);
 const enemy={alive:true,team:'B',pos:new V(15),chestPos(){return this.pos.clone()}};game.world.lineBlocked=()=>true;assert.equal(mode.issueCommand('focus',enemy.pos,enemy),false);
 game.world.lineBlocked=()=>false;assert.equal(mode.issueCommand('focus',enemy.pos,enemy),true);game.world.lineBlocked=()=>true;enemy.pos=new V(99);assert.equal(mode.commandGoal(game.bots[0]).x,15,'no tracking through walls');enemy.alive=false;assert.equal(mode.commandGoal(game.bots[0]),null);
 game.time=99;assert.equal(mode.commandGoal(game.bots[5]),null,'orders expire');mode.issueCommand('attack',new V(),null,'all');mode.activateSector(1);assert.equal(game.bots.filter(b=>b.command).length,0,'phase clears commands');
}
console.log('PASS assault: fixed roster/loadout, capture, contest, retained progress, both-point stages, forward spawn, victory, tickets/time defeat, respawn/replay, squad/all orders, focus LOS/death, expiry/phase clear.');
{
 const {mode,game}=fixture();ctx.MAPS={jinqu:{sectors:mode.sectors,styles:['ally','enemy']}};
 ctx.Player=class {constructor(g,o){Object.assign(this,o,{alive:true,isPlayer:true,stats:{score:0,kills:0,deaths:0,captures:0}})}equip(lo){this.loadout=lo}};
 game.entities=[];game.bots=[];game.hud.reset=noop;mode.start();assert.equal(game.bots.length,29);assert.equal(game.bots.filter(b=>b.team==='A').length,9);assert.equal(game.bots.filter(b=>b.team==='B').length,20);assert.equal(game.entities.length,30);assert.equal(game.player.loadout.weapons.length,4);
 console.log('PASS assault start: actual start() creates 30 entities and four weapon slots.');
}

{
 const {mode,game,pl}=fixture();pl.pos=new V(40);const mech={alive:true,isMech:true,piloted:false,team:'A',pos:new V()};game.entities.push(mech);mode.updateCaptures(5);assert.equal(mode.flags[0].prog,0,'empty mech cannot capture');mech.piloted=true;mode.updateCaptures(5);assert.equal(mode.flags[0].prog,.5,'piloted mech can capture');console.log('PASS mech objective eligibility');
}
