// Safe no-browser tests of the actual menu module; no third-party test scripts.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
const source=fs.readFileSync(path.join(__dirname,'../dist/js/menu.js'),'utf8').replace("import * as THREE from 'three';",'const THREE={};');
const {Menu,QUICK_MATCH}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
assert.deepEqual(QUICK_MATCH,{mode:'assault',map:'jinqu',diff:0,allies:9,enemies:20,timeLimit:10});
const m=Object.create(Menu.prototype);let html='',events={},startCount=0,lastCfg,resolveStart,exitCount=0,pauseValue;
const nodes={};
const getNode=selector=>nodes[selector]??=( {value:'',classList:{add(){},remove(){}},addEventListener:(kind,fn)=>events[selector+':'+kind]=fn} );
m.render=(s,screen='main')=>{html=s;m.screen=screen;events={};return {querySelector:getNode};};
m.game={state:'menu',canvas:{},hud:{showScoreboard(){}},settings:{sens:1,volume:.8},audio:{setVolume(){}},saveSettings(){},pause(v){pauseValue=v;},exitToMenu(){exitCount++;},startGame(kind,cfg){assert.equal(kind,'mp');startCount++;lastCfg=cfg;return new Promise(resolve=>resolveStart=resolve);}};
globalThis.document={getElementById:getNode,pointerLockElement:null};
m.showMain();assert.match(html,/开始爽一局/);assert.match(html,/电脑键盘/);assert.match(html,/Z X F Q/);assert.match(html,/B \/ E/);assert.match(html,/5 6 7 8/);assert.match(html,/1—4 \/ 滚轮/);assert(!html.includes("近战"));assert(!html.includes("pixel-rush-source.zip"));assert(!html.includes('枪匠'));
events['[data-action="start"]:click']();assert.equal(startCount,1);assert.deepEqual(lastCfg,QUICK_MATCH);m.start();assert.equal(startCount,1,'double start guarded');resolveStart();await new Promise(r=>setImmediate(r));assert.equal(m.starting,false);
m.showPause();assert.match(html,/战场已暂停/);events['[data-action="resume"]:click']();assert.equal(pauseValue,false);assert.equal(m.overlayOpen,false);
m.showPause();events['[data-action="settings"]:click']();assert.equal(m.screen,'settings');events['#sensitivity:input']({target:{value:'1.5'}});assert.equal(m.game.settings.sens,1.5);events['#volume:input']({target:{value:'0.5'}});assert.equal(m.game.settings.volume,.5);events['[data-action="back"]:click']();assert.equal(m.screen,'pause');events['[data-action="quit"]:click']();assert.equal(exitCount,1);
m.showResults({win:'win',sub:'40 : 12',stats:[['击杀',24],['经验值','+100']]});assert.match(html,/漂亮，拿下/);assert.match(html,/40 : 12/);assert(!html.includes('经验值'));events['[data-action="again"]:click']();assert.equal(startCount,2);resolveStart();await new Promise(r=>setImmediate(r));
m.showResults({win:'lose',sub:'12 : 40',stats:[]});assert.match(html,/进攻受挫，再来一次/);events['[data-action="menu"]:click']();assert.equal(exitCount,2);
m.showMain();events['[data-action="settings"]:click']();events['[data-action="back"]:click']();assert.equal(m.screen,'main');
m.game.voxelLab=true;m.game.voxelJinqu=true;m.showMain();
assert.match(html,/进入烬区/);assert.match(html,/三阶段五据点/);assert.match(html,/map=lab/);assert(!html.includes('5 6 7 8'),'map mode hides command controls');
m.game.voxelJinqu=false;m.showMain();assert.match(html,/进入演练/);
console.log('PASS menu: fixed configuration, start/double-start, pause/resume, settings, victory/defeat, replay and return-menu.');
})().catch(e=>{console.error(e);process.exitCode=1;});
