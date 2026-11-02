// Focused private single-player menu. Original engine: zty828/OPUS5.5-COD.
import * as THREE from 'three';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const QUICK_MATCH = Object.freeze({mode:'assault',map:'jinqu',diff:0,allies:9,enemies:20,timeLimit:10});
export class Menu {
  constructor(game) {
    this.game=game; this.el=document.getElementById('menu'); this.overlayOpen=false; this.phase=0;
    this.buildScene();
    this.el.addEventListener('pointerdown',()=>game.audio.init());
    window.addEventListener('keydown',e=>{
      if(e.code==='Escape'&&game.paused&&this.screen==='pause'&&performance.now()-this.pauseAt>300)this.resume();
    });
  }
  buildScene(){
    const s=this.scene3d=new THREE.Scene(); s.background=new THREE.Color('#12232b'); s.fog=new THREE.Fog('#12232b',12,42);
    this.camera3d=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,100);
    s.add(new THREE.HemisphereLight(0xd4f8ed,0x233e47,2.4));
    const sun=new THREE.DirectionalLight(0xffcb91,3);sun.position.set(4,10,5);s.add(sun);
    const block=(x,y,z,w,h,d,color)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshLambertMaterial({color}));m.position.set(x,y,z);s.add(m);return m;};
    block(0,-.2,0,45,.4,45,0x253e43);
    // Readable greybox battlefield: cliff village -> split settlement -> industry.
    block(0,.015,1,30,.06,3.2,0x69736a);
    for(let i=0;i<9;i++)block(-12+i*3,.06,1,1.4,.03,.1,0xc9cfaa);
    for(const [x,z,h] of [[-12,-5,5],[-9,-6,7],[-7,-7,5.5],[-12,1,3.4]]){
      const rock=block(x,h/2,z,3.3,h,3.6,0x697978);rock.rotation.y=.22;
      block(x+.35,h+.14,z,.8,.28,1.7,0x83918a);
    }
    const house=(x,z,w,h,d,color)=>{block(x,h/2,z,w,h,d,color);block(x,h+.13,z,w+.25,.26,d+.25,0x53615c);block(x,h*.45,z+d/2+.025,.45,h*.7,.06,0x273e42);};
    for(const [x,z] of [[-6,-1],[-4,-4],[-8,3]])house(x,z,2,2.2,2.1,0x9a9d8b);
    for(const [x,z] of [[-1,-4],[2,-5],[1,3],[3,4]])house(x,z,1.9,1.5,2,0x7e8e84);
    // Camp canvas roofs and sparse barricades contrast the dense slum branch.
    for(const [x,z] of [[0,-1],[3,-2]]){block(x,.7,z,2,1.4,1.6,0x76866c);block(x,1.5,z,2.2,.2,1.8,0xa5ad85);}
    house(8,-4,5.3,3.2,3.5,0x647b7d);house(9,3,3.5,4.3,3,0x91a19b);
    for(let n=0;n<4;n++){block(7.7+n*.75,2.9,4.54,.43,.7,.06,0x294c51);block(7.7+n*.75,1.4,4.54,.43,.7,.06,0x294c51);}
    for(const [x,z] of [[-3,1],[4,1],[6,2],[-1,4]])block(x,.4,z,1.3,.8,.65,0x566b65);
    // Tactical zone pins, intentionally schematic rather than original map assets.
    for(const [x,z,color] of [[-5,0,0xd7f86c],[1,-3,0x69d7d5],[2,3,0x69d7d5],[8,-4,0xffaa6c],[9,3,0xffaa6c]]){
      block(x,3.8,z,.08,1.7,.08,0xd9e6d4);block(x+.3,4.4,z,.65,.5,.08,color);
    }
    this.onResize();this.update(0);
  }
  update(dt){this.phase+=dt;this.camera3d.position.set(14+Math.sin(this.phase*.08)*.7,12,19);this.camera3d.lookAt(0,1,-1);}
  onResize(){this.camera3d.aspect=innerWidth/innerHeight;this.camera3d.updateProjectionMatrix();}
  render(html,screen='main'){this.screen=screen;this.el.innerHTML=`<div class="screen rush-screen ${screen==='main'?'rush-main':'rush-overlay'}">${html}</div>`;return this.el.firstChild;}
  hide(){this.el.innerHTML='';this.screen='';this.overlayOpen=false;}
  on(root,action,fn){root.querySelector(`[data-action="${action}"]`)?.addEventListener('click',fn);}
  controls(){return `<div class="rush-controls"><span><kbd>WASD / Shift / 空格 / C</kbd>移动 / 冲刺 / 跳 / 蹲滑</span><span><kbd>鼠标 / R</kbd>射击瞄准 / 换弹</span><span><kbd>1—4 / 滚轮</kbd>步枪 / 霰弹 / 狙击 / 火箭</span><span><kbd>Z X F Q</kbd>突进 / 燃烧 / 补给 / 侦察</span><span><kbd>B / E</kbd>召唤机甲 / 驾驶退出</span><span><kbd>5 6 7 8</kbd>跟随 / 进攻 / 守点 / 集火</span><span><kbd>T</kbd>小队 / 全体</span><span><kbd>Tab / Esc</kbd>战绩 / 暂停</span></div>`;}

  start(){if(this.starting)return;this.starting=true;document.getElementById('deathScreen').classList.add('hidden');this.game.hud.showScoreboard(false);this.game.startGame('mp',{...QUICK_MATCH}).catch(e=>{this.starting=false;const r=this.render(`<section class="rush-dialog"><h1>部署遇到问题</h1><p>${escape(e.message)}</p><button class="btn" data-action="back">返回菜单</button></section>`,'error');this.on(r,'back',()=>this.showMain());}).finally(()=>{this.starting=false;});}
  showMain(){this.overlayOpen=false;this.starting=false;
    const r=this.render(`<div class="rush-top"><span class="rush-mark">▦ PIXEL RUSH</span><span>推进攻防 · 02</span></div>
    <section class="rush-hero"><div class="rush-eyebrow">你是尖刀，也是指挥官。</div><h1>像素<br><em>突击</em><span>＋</span></h1><p class="rush-description">打穿防线，打开新路。<br>指挥队友、切换火力，亲自驾驶机甲推进。</p><button class="rush-start" data-action="start">开始爽一局 <span>→</span></button><div class="rush-session">烬区灵感灰盒 <i> / </i> 推进攻防 <i> / </i> 10 分钟</div><button class="rush-link" data-action="settings">灵敏度与声音 ↗</button></section>
    <aside class="rush-card"><span class="rush-card-tag">行动简报 / ASSAULT</span><div class="rush-versus"><b>你 + 9<small>友方人机</small></b><span>VS</span><b>20<small>敌方人机</small></b></div><div class="rush-route" aria-label="推进路线：A岩下村，B营地和贫民窟，C仓库和办公区"><div><b>A</b><span>岩下村</span></div><i>→</i><div><b>B1 + B2</b><span>营地 / 贫民窟</span></div><i>→</i><div><b>C1 + C2</b><span>仓库 / 办公区</span></div></div><div class="rush-tip">逐区打开防线，双点全部拿下再前进。<br><strong>160 增援</strong> · 每区补充 40</div></aside>
    <footer class="rush-bottom"><div class="rush-platform">需电脑键盘 + 鼠标 · 点击画面锁定鼠标，Esc 释放</div>${this.controls()}<div class="rush-credit">基于 OPUS5.5-COD 改编 · 地图为资料参考近似重建，非原作资产 · 无联网对战</div></footer>`);
    this.on(r,'start',()=>this.start());this.on(r,'settings',()=>this.showSettings('main'));
  }
  showLoadingOverlay(text){this.overlayOpen=true;this.render(`<section class="rush-dialog"><div class="rush-eyebrow">PIXEL RUSH / ASSAULT</div><h1>部署推进小队</h1><div class="rush-loading"></div><p>${escape(text)}</p></section>`,'loading');}
  showPause(){this.pauseAt=performance.now();this.overlayOpen=true;const r=this.render(`<section class="rush-dialog"><div class="rush-eyebrow">TAKE A BREATHER</div><h1>稍息一下</h1><p>战场已暂停。回去继续打个痛快。</p><div class="rush-actions"><button class="btn" data-action="resume">继续游戏</button><button class="btn ghost" data-action="settings">灵敏度与声音</button><button class="btn ghost" data-action="restart">重新开始这局</button><button class="rush-link" data-action="quit">返回主菜单</button></div>${this.controls()}</section>`,'pause');this.on(r,'resume',()=>this.resume());this.on(r,'settings',()=>this.showSettings('pause'));this.on(r,'restart',()=>this.start());this.on(r,'quit',()=>this.game.exitToMenu());}
  resume(){this.overlayOpen=false;this.game.pause(false);setTimeout(()=>{if(this.game.state==='play'&&!this.game.paused&&document.pointerLockElement!==this.game.canvas)document.getElementById('clickToPlay').classList.remove('hidden');},400);}
  showSettings(from){this.overlayOpen=true;const g=this.game;const r=this.render(`<section class="rush-dialog"><div class="rush-eyebrow">MAKE IT YOURS</div><h1>顺手就好</h1><label class="rush-setting">鼠标灵敏度 <output id="sensitivityValue">${Number(g.settings.sens).toFixed(1)}</output><input aria-label="鼠标灵敏度" type="range" min="0.2" max="2.5" step="0.1" value="${g.settings.sens}" id="sensitivity"></label><label class="rush-setting">音量 <output id="volumeValue">${Math.round(g.settings.volume*100)}%</output><input aria-label="音量" type="range" min="0" max="1" step="0.05" value="${g.settings.volume}" id="volume"></label><p>设置会保存在这个浏览器中。</p><button class="btn" data-action="back">完成</button></section>`,'settings');r.querySelector('#sensitivity').addEventListener('input',e=>{g.settings.sens=+e.target.value;r.querySelector('#sensitivityValue').value=g.settings.sens.toFixed(1);g.saveSettings();});r.querySelector('#volume').addEventListener('input',e=>{g.settings.volume=+e.target.value;r.querySelector('#volumeValue').value=Math.round(g.settings.volume*100)+'%';g.audio.setVolume(g.settings.volume);g.saveSettings();});this.on(r,'back',()=>from==='pause'?this.showPause():this.showMain());}
  // Kept for legacy engine callbacks; loadout changes are intentionally absent.
  showClassSelect(){if(this.game.paused)this.showPause();}
  hideClassSelect(){}
  showResults(res){this.overlayOpen=true;this.game.hud.showScoreboard(false);document.getElementById('deathScreen').classList.add('hidden');const stats=(res.stats||[]).filter(([name])=>name!=='经验值');const r=this.render(`<section class="rush-dialog rush-result"><div class="rush-eyebrow">ROUND COMPLETE</div><h1>${res.win==='win'?'漂亮，拿下！':res.win==='draw'?'势均力敌':'进攻受挫，再来一次'}</h1><div class="rush-result-score">${escape(res.sub)}</div><div class="res-stats">${stats.map(([name,value])=>`<div><b>${escape(value)}</b>${escape(name)}</div>`).join('')}</div><div class="rush-actions"><button class="btn" data-action="again">重新推进 →</button><button class="btn ghost" data-action="menu">返回主菜单</button></div></section>`,'results');this.on(r,'again',()=>this.start());this.on(r,'menu',()=>this.game.exitToMenu());}
}
