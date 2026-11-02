// 地图定义
import * as THREE from 'three';
import { mulberry32, pick } from './util.js';

const V = (x, z) => new THREE.Vector3(x, 0, z);

export const MAPS = {
  // Approximate greybox from the official 2024 Jinqu overview and district views.
  // Not a surveyed or current-version replica: attack west -> rocky A -> split B -> city C.
  jinqu: {
    id:'jinqu', name:'烬区 · 推进灰盒', size:220, seed:82, surface:'sand', styles:['ally','enemy'],
    env:{sky:'day',sunDir:[-.4,.8,.2],sunColor:0xffeed2,sun:2.7,hemi:.95,sky2:0xd5e2ed,ground:0x9a8b69,fog:0xc9bd9d,fogDensity:.0025,turbidity:8,rayleigh:1,mie:.005,exposure:1,envIntensity:.7,mountains:'rock',ambient:'wind'},
    sectors:[
      {name:'A 岩下村',objectives:[{id:'A',name:'岩下村',pos:V(-66,30),radius:8}],attackSpawns:[V(-96,22),V(-94,30),V(-93,39),V(-88,19)],defendSpawns:[V(-40,15),V(-42,25),V(-40,38),V(-46,7)]},
      {name:'B 双点推进',objectives:[{id:'B1',name:'临时营地',pos:V(-10,-24),radius:8},{id:'B2',name:'贫民窟',pos:V(8,25),radius:8}],attackSpawns:[V(-36,-8),V(-35,4),V(-30,12),V(-32,-18)],defendSpawns:[V(35,-8),V(34,5),V(35,17),V(32,-35)]},
      {name:'C 城区突破',objectives:[{id:'C1',name:'军需仓库',pos:V(65,-25),radius:8},{id:'C2',name:'办公区',pos:V(75,26),radius:8}],attackSpawns:[V(42,-8),V(42,7),V(42,17),V(43,-37)],defendSpawns:[V(99,-27),V(99,-6),V(99,20),V(98,43)]},
    ],
    build(w){
      w.ground('sand');w.bounds();
      // Playable envelope: wide lateral flanks, not a giant empty square.
      w.collider(-110,-1,-67,110,30,-65); w.collider(-110,-1,65,110,30,67);
      const road=(x,z,ww,dd)=>w.box(x,.005,z,ww,.025,dd,'asphalt',{collide:false});
      road(20,0,173,10);road(36,0,8,116);road(94,0,8,116);road(-29,5,7,100);
      for(let x=-52;x<100;x+=12)w.box(x,.04,0,4,.02,.15,'whitePaint',{collide:false});
      const house=(x,z,ww,dd,h=3.5,c='plaster')=>w.building(x,z,ww,dd,h,{mat:c,doors:{n:[0],s:[0]},windows:{e:[0],w:[0]},roofMat:'concreteDark'});
      const cover=(x,z,ww=3,dd=1)=>w.destructible(x,0,z,ww,1.25,dd,'sandbag',100);
      const breach=(x,z,ww,dd,h=2.6)=>w.destructible(x,0,z,ww,h,dd,'plasterRed',150);
      // A: low village threaded between substantial rock ridges, including a south high route.
      for(const [x,z,scale] of [[-91,48,6],[-86,5,5],[-79,12,5],[-77,48,5],[-54,51,6],[-48,46,4],[-54,7,6],[-62,0,5],[-99,10,4],[-89,56,4],[-43,56,4]])w.rock(x,z,scale,'rock');
      w.box(-67,0,60,30,3,10,'rock');w.stairs(-68,49,4,12,3,'s','rock');
      house(-76,29,7,8,3.4,'plasterWhite');house(-57,36,8,7,4,'plaster');house(-65,15,9,6,3.2,'plasterBlue');
      w.box(-66,.03,30,10,.03,10,'dirt',{collide:false});
      cover(-69,37,4,1);cover(-61,24,1,3);breach(-72,19,5,.45);w.crateStack(-59,19);
      // A northern bypass has discontinuous cover rather than an unbroken corridor.
      for(const [x,z] of [[-97,-5],[-81,-13],[-65,-15],[-48,-12]]){w.rock(x,z,3);cover(x+5,z+3,2,1);}
      // B1: a flat-roof camp with two recognizable watchtowers, exposed eastern road.
      house(-15,-31,12,8,3.3,'plaster');w.watchtower(-24,-18,4);w.watchtower(1,-37,4);
      w.stairs(-15,-41,3,12,3.6,'s'); // optional camp roof approach
      for(const [x,z,ww,dd] of [[-22,-26,1,8],[-10,-16,8,1],[-1,-25,1,6]])cover(x,z,ww,dd);
      w.container(-3,-46,0,'containerGreen');w.crateStack(-19,-18);breach(-7,-36,6,.45);
      // B2: three alleys feed an open courtyard; differing roof heights joined by a bridge.
      house(-5,21,10,13,3.5,'plasterWhite');house(8,12,10,7,6.5,'plaster');
      house(21,25,10,14,4.5,'plasterRed');house(6,39,13,8,3.5,'plasterBlue');
      w.box(8,.02,25,12,.03,12,'concrete',{collide:false});
      w.stairs(-5,8.5,3,12,3.8,'s');
      w.box(6,3.5,18,12,.3,2.6,'wood');
      for(let i=0;i<4;i++)w.box(12.5+i,3.5,18,1,.25*(i+1),2.6,'wood'); // roof bridge over the alley, ground route remains open
      w.stairs(23,40,3,10,4.8,'n');
      cover(5,28,3,1);cover(14,21,1,3);breach(15,35,5,.4);
      // Peripheral urban block gives the southern outer flank a distinct street silhouette.
      for(const [x,z,h] of [[-13,52,6],[13,53,8],[30,49,5]])w.block(x,z,10,h,8,'plaster',{windows:true});
      // C1: elongated enterable warehouse, broad front yard, gates and breachable side wall.
      const wx=68,wz=-39,ww=29,dd=18;
      w.wall(wx-ww/2,wz-dd/2,wx+ww/2,wz-dd/2,7,.5,'concrete',[{c:ww/2,w:5,y1:4.4}]);
      w.wall(wx-ww/2,wz+dd/2,wx+ww/2,wz+dd/2,7,.5,'concrete',[{c:ww/2,w:7,y1:4.4}]);
      w.wall(wx-ww/2,wz-dd/2,wx-ww/2,wz+dd/2,7,.5,'concrete',[{c:9,w:4,y1:3.5}]);
      w.wall(wx+ww/2,wz-dd/2,wx+ww/2,wz+dd/2,7,.5,'concrete',[{c:9,w:4,y1:3.5}]);
      breach(wx+ww/2,wz,.5,4,3.5); // rocket opens a real extra flank into warehouse
      w.box(wx,7,wz,ww+1,.45,dd+1,'metalRoof');
      w.box(wx,.01,wz,ww,.03,dd,'concrete',{collide:false});
      w.box(65,.01,-24,34,.03,15,'concrete',{collide:false});
      w.wall(48,-16,83,-16,2,.45,'concrete',[{c:17,w:7,y1:2}]);
      w.wall(48,-32,48,-16,2,.45,'concrete',[{c:8,w:5,y1:2}]);
      breach(48,-24,.45,5,2);cover(57,-26,3,1);cover(76,-23,3,1);
      w.crateStack(59,-41);w.crateStack(75,-36);w.truck(56,-8,Math.PI/2);
      // C2: office courtyard with west/north/south approaches and a scaffold route.
      w.block(76,12,25,11,9,'plasterWhite',{windows:true});
      w.block(87,28,9,10,20,'plaster',{windows:true});
      w.block(69,42,19,7,10,'plasterBlue',{windows:true});
      w.box(74,.02,27,20,.03,18,'concrete',{collide:false});
      w.wall(57,19,57,36,2,.4,'concrete',[{c:8,w:5,y1:2}]);
      cover(70,25,3,1);cover(78,33,1,3);breach(81,39,5,.4);
      // Scaffold stairs lead to a combat balcony, with two escape directions via the yard.
      w.stairs(57,45,3,14,4.2,'n');w.box(61,4.2,34,11,.25,4,'wood');w.box(57,4.2,37,3,.25,2,'wood');
      for(const x of [56,61,66]){w.box(x,0,32, .18,4.3,.18,'steel');w.box(x,0,36,.18,4.3,.18,'steel');}
      w.box(61,4.45,32,11,.8,.12,'steel',{collide:false});
      // Sparse desert edge and rear city skyline are geometry, not copied game assets.
      for(const [x,z] of [[-43,-45],[-20,-53],[40,-54],[47,52],[101,50]])w.tree(x,z,.8,'palm');
      for(const x of [54,73,98])w.block(x,-59,12,7+(x%3)*2,6,'plaster',{windows:true});
      w.spawns.A=this.sectors[0].attackSpawns.map(p=>p.clone());w.spawns.B=this.sectors[0].defendSpawns.map(p=>p.clone());
      w.flagPos=this.sectors.flatMap(s=>s.objectives.map(o=>o.pos.clone()));
      w.points.routeChecks=[V(-74,57),V(-65,-22),V(-27,-47),V(7,-51),V(4,25),V(31,28),V(51,-24),V(68,-39),V(59,27),V(77,36)];
    },
  },

  // ================= 沙丘镇 =================
  dune: {
    id: 'dune', name: '沙丘镇', size: 110, seed: 11, surface: 'sand', styles: ['ally', 'insurgent'],
    env: { sky: 'day', sunDir: [0.55, 0.62, 0.35], sunColor: 0xfff0d8, sun: 3.4, hemi: 0.75, sky2: 0xcfe2ff, ground: 0xb08a5a, fog: 0xd8c6a6, fogDensity: 0.0065, turbidity: 9, rayleigh: 1.3, mie: 0.006, exposure: 0.85, mountains: 'sand', envIntensity: 0.75, weather: 'dust', ambient: 'wind' },
    build(w) {
      w.ground('sand');
      w.bounds();
      // 主街道
      w.box(0, 0, 0, 104, 0.02, 9, 'dirt', { collide: false });
      // 北排建筑
      const N = [[-38, -15, 10, 10, 4.5, 'plaster'], [-24, -14, 9, 8, 4, 'plasterWhite'], [-8, -14, 12, 10, 4, 'plaster'], [8, -14, 9, 8, 5, 'plasterRed'], [22, -15, 10, 10, 4.2, 'plasterWhite'], [37, -14, 10, 8, 4.5, 'plaster']];
      N.forEach(([x, z, bw, bd, h, m], i) => {
        w.building(x, z, bw, bd, h, { mat: m, doors: { s: [i % 2 ? -1.5 : 1.5], n: [0] }, windows: { s: [i % 2 ? 2.5 : -2.5], e: [0], w: [0] }, parapet: i !== 2, roofMat: 'concreteDark', floor: 'tiles' });
      });
      // 可上的屋顶楼梯
      w.stairs(-5, -19.85, 1.4, 6, 4, 'e', 'concrete');
      // 南排
      const S = [[-37, 15, 10, 9, 4, 'plasterWhite'], [-23, 14, 9, 8, 4.6, 'plaster'], [-9, 15, 10, 9, 4, 'plasterRed'], [9, 15, 12, 9, 4.2, 'plaster'], [24, 14, 9, 8, 4, 'plasterBlue'], [38, 15, 10, 10, 4.8, 'plaster']];
      S.forEach(([x, z, bw, bd, h, m], i) => {
        w.building(x, z, bw, bd, h, { mat: m, doors: { n: [i % 2 ? 1.5 : -1.5], s: [0] }, windows: { n: [i % 2 ? -2.5 : 2.5], e: [0], w: [0] }, parapet: true, floor: 'tiles' });
      });
      // 集市摊位
      const cloths = ['clothRed', 'clothBlue', 'clothYellow', 'clothGreen'];
      [[-5, -3], [0, -3], [5, -3], [-5, 3], [0, 3], [5, 3]].forEach(([x, z], i) => {
        w.box(x, 0, z, 2.6, 0.9, 1.2, 'wood');
        w.awning(x, z + (z < 0 ? -0.2 : 0.2), 3, 1.8, 2.3, cloths[i % 4], z < 0 ? 0 : Math.PI);
        w.crate(x + 1.6, z, 0.7);
      });
      // 街道掩体
      w.car(-20, 1.5, 0.2, 0x7a6a50, true);
      w.car(16, -2, Math.PI + 0.1, 0x3a4a5a, true);
      w.jersey(-30, -2); w.jersey(30, 2);
      w.sandbags(-44, -3, 3, Math.PI / 2); w.sandbags(44, 3, 3, Math.PI / 2);
      w.crateStack(-14, 3); w.crateStack(12, -3.5);
      w.barrel(-11, -3, 'containerBlue'); w.barrel(26, 3, 'containerOrange'); w.barrel(26.7, 3.3, 'containerBlue');
      // 北部区域
      w.building(0, -38, 14, 12, 6, { mat: 'plasterWhite', doors: { s: [0], e: [2], w: [-2] }, windows: { s: [-4, 4], n: [-3, 3] }, parapet: true, floor: 'tiles' });
      const dome = w.mesh(new THREE.SphereGeometry(4.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), 'plasterBlue', 0, 6.3, -38);
      w.box(8.5, 0, -42, 2, 11, 2, 'plasterWhite');
      w.mesh(new THREE.ConeGeometry(1.3, 2.5, 8), 'plasterBlue', 8.5, 12.2, -42);
      w.wall(-30, -28, -12, -28, 2.4, 0.4, 'plaster', [{ c: 9, w: 2.5, y0: 0, y1: 2.4 }]);
      w.wall(12, -28, 30, -28, 2.4, 0.4, 'plaster', [{ c: 6, w: 2.5, y0: 0, y1: 2.4 }]);
      w.building(-32, -40, 10, 9, 4, { mat: 'plaster', doors: { e: [0], s: [2] }, windows: { n: [0] }, parapet: true });
      w.building(32, -40, 10, 9, 4, { mat: 'plasterRed', doors: { w: [0], s: [-2] }, windows: { n: [0] }, parapet: true });
      w.car(-18, -34, Math.PI / 2, 0x9a2020, false);
      w.tree(-20, -45, 1, 'palm'); w.tree(18, -46, 1.1, 'palm'); w.tree(-45, -30, 0.9, 'palm'); w.tree(46, -28, 1, 'palm');
      w.crateStack(20, -33); w.sandbags(-8, -30, 4, 0);
      // 南部区域
      w.wall(-48, 28, -14, 28, 2.2, 0.4, 'plasterWhite', [{ c: 12, w: 3, y0: 0, y1: 2.2 }, { c: 26, w: 2.4, y0: 0, y1: 2.2 }]);
      w.wall(14, 28, 48, 28, 2.2, 0.4, 'plaster', [{ c: 8, w: 3, y0: 0, y1: 2.2 }, { c: 24, w: 2.4, y0: 0, y1: 2.2 }]);
      w.building(-28, 40, 12, 10, 4.5, { mat: 'plaster', doors: { n: [0], e: [0] }, windows: { w: [0], s: [0] }, parapet: true });
      w.building(28, 40, 12, 10, 4.2, { mat: 'plasterWhite', doors: { n: [0], w: [0] }, windows: { e: [0], s: [0] }, parapet: true });
      w.car(0, 38, 0.5, 0x6a6a6a, true); w.car(-8, 33, -1.2, 0x2a3a5a, true);
      w.box(8, 0, 40, 4, 3, 4, 'concreteDark');
      w.sandbags(0, 30, 5, 0); w.barrier(-6, 44); w.barrier(6, 45, Math.PI / 2);
      w.tree(-45, 45, 1, 'palm'); w.tree(45, 45, 1, 'palm'); w.tree(14, 48, 0.9, 'palm');
      w.rock(-50, 20, 1.5, 'rock'); w.rock(50, -20, 1.8, 'rock'); w.rock(40, 25, 1.2, 'rock');
      // 出生点
      w.spawns.A = [V(-50, -3), V(-50, 3), V(-48, 8), V(-48, -8), V(-45, 22), V(-45, -22), V(-50, 0), V(-47, 36)];
      w.spawns.B = [V(50, -3), V(50, 3), V(48, 8), V(48, -8), V(45, 22), V(45, -22), V(50, 0), V(47, -36)];
      w.flagPos = [V(-36, 0), V(0, 0), V(36, 0)];
    },
  },

  // ================= 寒霜炼厂 =================
  frost: {
    id: 'frost', name: '寒霜炼厂', size: 120, seed: 21, surface: 'snow', styles: ['snowA', 'snowB'],
    env: { sky: 'day', sunDir: [-0.3, 0.35, -0.6], sunColor: 0xdde6f5, sun: 1.3, hemi: 0.8, sky2: 0xdfe8f5, ground: 0x9aa3ad, fog: 0xc4ccd6, fogDensity: 0.016, turbidity: 18, rayleigh: 0.6, mie: 0.05, exposure: 0.82, mountains: 'rockSnow', envIntensity: 0.7, weather: 'snow', ambient: 'wind' },
    build(w) {
      w.ground('snow');
      w.bounds();
      w.box(0, 0, 0, 116, 0.02, 8, 'asphalt', { collide: false });
      w.box(0, 0, 0, 8, 0.02, 116, 'asphalt', { collide: false });
      // 仓库1
      w.building(-28, -26, 26, 16, 8, { mat: 'metal', roofMat: 'metalRoof', doors: { s: [-6, 6], e: [0], w: [0], n: [0] }, windows: { n: [-8, 8] }, floor: 'concrete', light: 0xcfe0ff });
      w.box(-34, 0, -26, 6, 2.6, 2.4, 'containerBlue'); w.crateStack(-22, -28); w.crate(-26, -22, 1.2); w.box(-30, 0, -31, 8, 1.2, 1.2, 'wood');
      w.box(-20, 0, -20, 1.2, 3, 4, 'metal');
      // 仓库2
      w.building(28, 26, 22, 18, 7, { mat: 'containerGray', roofMat: 'metalRoof', doors: { n: [-5, 5], w: [0], e: [-3], s: [3] }, windows: { s: [-6] }, floor: 'concrete', light: 0xcfe0ff });
      w.box(24, 0, 28, 6, 2.6, 2.4, 'containerRed'); w.crateStack(32, 22); w.box(30, 0, 31, 1.2, 1.5, 6, 'wood');
      // 储油罐
      w.tank(20, -32, 5, 9, 'metal'); w.tank(36, -32, 4.5, 8, 'metal'); w.tank(28, -46, 4, 7, 'metal');
      w.pipe(10, -24, 44, -24, 3.2, 0.35); w.pipe(12, -38, 12, -50, 1.2, 0.5);
      // 行政楼
      w.building(-30, 26, 16, 10, 4, { mat: 'brick', doors: { n: [0], e: [0] }, windows: { n: [-5, 5], s: [-4, 0, 4], w: [0] }, parapet: true, floor: 'tiles', light: 0xffd9a0 });
      w.building(-30, 42, 10, 8, 3.6, { mat: 'brickDark', doors: { n: [2], w: [0] }, windows: { e: [0] }, parapet: true });
      // 集装箱区
      const cols = ['containerRed', 'containerBlue', 'containerGreen', 'containerOrange', 'containerGray', 'containerYellow'];
      const r = mulberry32(5);
      [[-10, -10, 0], [-10, -16, 0], [12, 10, Math.PI / 2], [16, 12, Math.PI / 2], [-14, 12, 0], [8, -12, Math.PI / 2], [-45, 0, Math.PI / 2], [46, 0, Math.PI / 2], [0, 44, 0], [4, -46, 0]].forEach(([x, z, rot]) => w.container(x, z, rot, cols[Math.floor(r() * cols.length)]));
      w.container(-10, -10, 0, 'containerYellow', 2.6);
      w.container(16, 12, Math.PI / 2, 'containerGreen', 2.6);
      w.jersey(-6, 5); w.jersey(6, -5); w.jersey(20, 3, Math.PI / 2); w.jersey(-20, -3, Math.PI / 2);
      w.sandbags(0, 14, 4); w.sandbags(0, -14, 4);
      w.truck(-6, 30, Math.PI / 2, 0x8a8f94); w.truckCollider(-6, 30, Math.PI / 2);
      w.car(40, 8, 0.1, 0x223344); w.car(-40, -8, Math.PI, 0x552222);
      w.pipe(-50, 12, -16, 12, 2.8, 0.3);
      for (let i = 0; i < 22; i++) {
        const a = r() * Math.PI * 2, d = 50 + r() * 7;
        w.tree(Math.cos(a) * d, Math.sin(a) * d, 0.9 + r() * 0.5, 'pineSnow');
      }
      w.tree(-8, 50, 1.2, 'pineSnow'); w.tree(40, 46, 1.1, 'pineSnow'); w.tree(-50, -44, 1.3, 'pineSnow');
      w.rock(-20, 45, 1.6, 'rockSnow'); w.rock(46, -12, 1.4, 'rockSnow'); w.rock(-48, 30, 1.2, 'rockSnow');
      w.lampPost(-4, 20, 0xcfe0ff, Math.PI / 2, 12); w.lampPost(4, -22, 0xcfe0ff, -Math.PI / 2, 12);
      w.spawns.A = [V(-54, -4), V(-54, 4), V(-52, 14), V(-52, -14), V(-50, 34), V(-50, -38), V(-54, 22)];
      w.spawns.B = [V(54, -4), V(54, 4), V(52, 14), V(52, -14), V(50, 38), V(50, -38), V(54, -22)];
      w.flagPos = [V(-30, 8), V(0, 0), V(30, -8)];
    },
  },

  // ================= 霓虹街区 =================
  neon: {
    id: 'neon', name: '霓虹街区', size: 100, seed: 31, surface: 'wet', night: false, styles: ['ally', 'urbanB'],
    env: { sky: 'night', sunDir: [-0.35, 0.65, -0.45], sunColor: 0x8ea8ff, sun: 0.45, hemi: 1.1, sky2: 0x505a90, ground: 0x2a2020, fog: 0x1a1630, fogDensity: 0.022, exposure: 1.45, envIntensity: 1.0, weather: 'rain', skyTop: 0x05060d, skyHorizon: 0x1e1830, cityGlow: 0x4a2050, ambient: 'rain' },
    build(w) {
      w.ground('asphaltWet');
      w.bounds();
      // 人行道
      const sw = (x, z, sx, sz) => w.box(x, 0, z, sx, 0.15, sz, 'sidewalk');
      sw(-28, -8, 44, 3); sw(28, -8, 44, 3); sw(-28, 8, 44, 3); sw(28, 8, 44, 3);
      sw(-8, -28, 3, 38); sw(8, -28, 3, 38); sw(-8, 28, 3, 38); sw(8, 28, 3, 38);
      // 车道线
      for (let i = -48; i < 48; i += 6) { w.box(i, 0.005, 0, 3, 0.01, 0.15, 'yellowPaint', { collide: false }); w.box(0, 0.005, i, 0.15, 0.01, 3, 'yellowPaint', { collide: false }); }
      for (let i = -4; i <= 4; i += 1.2) { w.box(i, 0.005, -11.5, 0.6, 0.01, 3, 'whitePaint', { collide: false }); }
      const lit = () => Math.random() < 0.35 ? 'windowLit' : 'windowDark';
      // 西北
      w.building(-15, -15, 10, 8, 4.5, { mat: 'concrete', doors: { s: [0], e: [0] }, windows: { s: [-3.2, 3.2], n: [0] }, floor: 'tiles', light: 0xffc890 });
      w.block(-15, -33, 12, 22, 20, 'brickDark', { windows: true, windowMat: lit });
      w.block(-38, -18, 14, 16, 16, 'concrete', { windows: true, windowMat: lit });
      w.block(-40, -40, 16, 24, 16, 'brick', { windows: true, windowMat: lit });
      w.box(-27, 0, -20, 1.5, 1.4, 3, 'containerGreen'); w.crate(-26, -28, 1); w.box(-27.5, 0, -34, 2, 1.2, 1.2, 'darkMetal');
      // 东北
      w.block(18, -18, 16, 18, 16, 'concrete', { windows: true, windowMat: lit });
      w.building(38, -15, 12, 10, 4.2, { mat: 'brick', doors: { s: [0], w: [0] }, windows: { s: [-3.5, 3.5] }, floor: 'tiles', light: 0x9ad0ff });
      w.block(36, -38, 18, 26, 18, 'brickDark', { windows: true, windowMat: lit });
      w.block(16, -42, 12, 12, 12, 'concrete', { windows: true, windowMat: lit });
      w.box(27, 0, -30, 2, 1.4, 1.5, 'containerBlue'); w.crateStack(26, -25);
      // 西南
      w.block(-18, 18, 16, 20, 16, 'brick', { windows: true, windowMat: lit });
      w.building(-38, 15, 12, 10, 4.2, { mat: 'concreteDark', doors: { n: [0], e: [0] }, windows: { n: [-3.5, 3.5] }, floor: 'tiles', light: 0xff9ad0 });
      w.block(-38, 38, 18, 14, 16, 'concrete', { windows: true, windowMat: lit });
      w.car(-20, 36, 0.05, 0x1a1a1a); w.car(-14, 40, 0.1, 0x6a1010); w.car(-18, 44, Math.PI / 2, 0xd0d0d0);
      // 东南 广场
      w.box(28, 0, 28, 3, 0.6, 3, 'concrete'); // 喷泉底座
      w.mesh(new THREE.CylinderGeometry(3, 3.2, 0.6, 24), 'concrete', 22, 0.3, 22);
      w.collider(19.5, 0, 19.5, 24.5, 0.6, 24.5);
      w.mesh(new THREE.CylinderGeometry(0.4, 0.5, 2, 12), 'concrete', 22, 1.3, 22);
      [[14, 16], [30, 16], [14, 32], [36, 26], [26, 38]].forEach(([x, z]) => w.tree(x, z, 1, 'broad'));
      w.box(20, 0, 32, 4, 0.5, 0.6, 'wood'); w.box(32, 0, 20, 0.6, 0.5, 4, 'wood');
      w.building(40, 40, 10, 10, 4, { mat: 'concrete', doors: { n: [0], w: [0] }, windows: { n: [3] }, floor: 'tiles', light: 0xa0ffd0 });
      w.box(30, 0, 44, 6, 1.1, 0.5, 'concrete'); w.box(44, 0, 28, 0.5, 1.1, 6, 'concrete');
      // 街道车辆与掩体
      w.car(-30, -4, Math.PI / 2 + 0.1, 0x202a40); w.car(-2.5, -24, 0.05, 0xb8b020); w.car(3, 22, Math.PI - 0.1, 0x303030);
      w.car(26, 4, -Math.PI / 2, 0x8a1010); w.car(-44, 4, Math.PI / 2, 0x506070);
      // 公交车
      w.box(3.5, 0, -38, 2.6, 3, 11, 'containerOrange'); w.box(3.5, 1.4, -38, 2.65, 1, 10.5, 'windowLit', { collide: false });
      w.jersey(-18, 0, Math.PI / 2); w.jersey(18, 0, Math.PI / 2); w.jersey(0, 16); w.jersey(0, -16);
      w.barrier(-8.5, -3); w.barrier(8.5, 3);
      // 霓虹
      w.neon(-10.4, 5.5, -15, 4, 1.4, 0xff2aa0, Math.PI / 2);
      w.neon(-15, 5.6, -10.9, 5, 1.2, 0x20e0ff, 0);
      w.neon(32.7, 5, -15, 4, 1.2, 0xffe020, -Math.PI / 2);
      w.neon(-38, 5.5, 9.9, 5, 1.3, 0xa040ff, Math.PI);
      w.neon(-9.9, 8, 18, 5, 2, 0xff3040, Math.PI / 2);
      w.neon(9.9, 9, -18, 5, 2, 0x30ff90, -Math.PI / 2);
      w.neon(40, 4.8, 34.9, 4, 1, 0x20e0ff, Math.PI);
      // 灯光
      w.lampPost(-10.5, -30, 0xffd0a0, Math.PI / 2, 16); w.lampPost(10.5, 30, 0xffd0a0, -Math.PI / 2, 16);
      w.lampPost(-30, 10.5, 0xffd0a0, Math.PI, 16); w.lampPost(30, -10.5, 0xffd0a0, 0, 16);
      w.pointLight(-10.5, 5, -14, 0xff2aa0, 8, 14); w.pointLight(10.5, 8, -18, 0x30ff90, 8, 14);
      w.pointLight(-10.5, 7, 18, 0xff3040, 8, 14); w.pointLight(-38, 5, 9, 0xa040ff, 8, 12);
      w.spawns.A = [V(-46, -3), V(-46, 3), V(-44, -12), V(-44, 12), V(-30, 46), V(-46, 26), V(-30, -46)];
      w.spawns.B = [V(46, -3), V(46, 3), V(44, -12), V(44, 12), V(30, 46), V(46, 20), V(46, -26)];
      w.flagPos = [V(-28, 0), V(0, 0), V(26, 26)];
    },
  },

  // ================= 货柜场 =================
  yard: {
    id: 'yard', name: '货柜场', size: 56, seed: 41, surface: 'concrete', styles: ['ally', 'enemy'],
    env: { sky: 'day', sunDir: [-0.8, 0.14, 0.35], sunColor: 0xffa060, sun: 2.8, hemi: 0.55, sky2: 0x9a90c0, ground: 0x6a4a3a, fog: 0xc89070, fogDensity: 0.01, turbidity: 10, rayleigh: 3, mie: 0.02, exposure: 0.8, mountains: 'rock', envIntensity: 0.7, ambient: 'wind' },
    build(w) {
      w.ground('concrete');
      w.bounds();
      const cols = ['containerRed', 'containerBlue', 'containerGreen', 'containerOrange', 'containerGray', 'containerYellow'];
      const r = mulberry32(9);
      const grid = [];
      for (let gx = -2; gx <= 2; gx++) for (let gz = -2; gz <= 2; gz++) {
        if (gx === 0 && gz === 0) continue;
        if (Math.abs(gx) === 2 && gz === 0) continue;
        grid.push([gx * 9 + (r() - 0.5) * 2, gz * 9 + (r() - 0.5) * 2, r() < 0.5 ? 0 : Math.PI / 2]);
      }
      grid.forEach(([x, z, rot], i) => {
        w.container(x, z, rot, cols[i % cols.length]);
        if (r() < 0.3) w.container(x, z, rot, cols[(i + 3) % cols.length], 2.6);
      });
      for (let i = 0; i < 10; i++) w.crate((r() - 0.5) * 44, (r() - 0.5) * 44, 1.1 + r() * 0.3, 0, r());
      w.crateStack(-3, 3); w.crateStack(2, -4);
      // 龙门吊
      for (const x of [-26, 26]) {
        w.box(x, 0, -24, 1, 14, 1, 'yellowPaint'); w.box(x, 0, 24, 1, 14, 1, 'yellowPaint');
        w.box(x, 14, 0, 1.2, 1.2, 50, 'yellowPaint');
      }
      w.box(0, 14, -24, 53, 1.2, 1.2, 'yellowPaint', { collide: false }); w.box(0, 14, 24, 53, 1.2, 1.2, 'yellowPaint', { collide: false });
      w.lampPost(0, -26, 0xffd8a0, 0, 10, true);
      w.spawns.A = [V(-25, -8), V(-25, 0), V(-25, 8), V(-22, -20), V(-22, 20)];
      w.spawns.B = [V(25, -8), V(25, 0), V(25, 8), V(22, -20), V(22, 20)];
      w.flagPos = [V(-18, 0), V(0, 0), V(18, 0)];
    },
  },

  // ================= 战役：卡尔达什 =================
  kaldash: {
    id: 'kaldash', name: '卡尔达什村', size: 200, seed: 51, surface: 'dirt', night: true, styles: ['ally', 'insurgent'],
    env: { sky: 'night', sunDir: [0.35, 0.55, -0.6], sunColor: 0xa8b8ff, sun: 0.55, hemi: 0.22, sky2: 0x3a4a70, ground: 0x1a1510, fog: 0x0b1020, fogDensity: 0.016, exposure: 1.15, envIntensity: 0.3, skyTop: 0x02040a, skyHorizon: 0x0f1828, cityGlow: 0x0a0a14, mountains: 'rock', ambient: 'wind' },
    build(w) {
      w.ground('dirt');
      w.bounds();
      const r = mulberry32(77);
      // 土路
      w.box(0, 0, 0, 196, 0.02, 7, 'sand', { collide: false, texScale: 6 });
      // 草地斑块
      for (let i = 0; i < 14; i++) w.box(-95 + r() * 190, 0.005, -90 + r() * 180, 8 + r() * 14, 0.01, 8 + r() * 14, 'grass', { collide: false });
      // ---- 着陆区 ----
      for (let i = 0; i < 14; i++) { const x = -95 + r() * 45, z = (r() < 0.5 ? -1 : 1) * (8 + r() * 30); w.rock(x, z, 0.8 + r() * 1.5, 'rock'); }
      for (let i = 0; i < 26; i++) { const x = -95 + r() * 190, z = (r() < 0.5 ? -1 : 1) * (26 + r() * 60); if (Math.abs(x - 65) < 30 && Math.abs(z) < 32) continue; w.tree(x, z, 0.9 + r() * 0.5, r() < 0.5 ? 'pine' : 'broad'); }
      w.wall(-70, -6, -60, -6, 1.1, 0.5, 'rock'); w.wall(-68, 6, -58, 6, 1.0, 0.5, 'rock');
      w.car(-64, 10, 0.8, 0x333333, true);
      // ---- 前哨站 ----
      w.sandbags(-50, -7, 6, 0); w.sandbags(-50, 7, 6, 0); w.sandbags(-54, 0, 5, Math.PI / 2);
      w.sandbags(-40, -9, 5, 0);
      w.watchtower(-43, -12, 4);
      w.tent(-48, 12, 4, 5, 0); w.tent(-40, 12, 4, 5, 0);
      w.barrel(-45, 3.5, 'burnt', true);
      w.box(-37, 0, -4, 1.5, 1.2, 1, 'darkMetal'); // 发电机
      w.lampPost(-36, -6, 0xffd0a0, Math.PI, 10);
      w.crateStack(-46, -4); w.truck(-34, 6, 0.2, 0xb8b0a0); w.truckCollider(-34, 6, 0);
      // ---- 村庄 ----
      const houses = [[-12, -14, 8, 7, 3.2, 'plaster'], [-8, 14, 9, 8, 3.2, 'plasterWhite'], [6, -16, 10, 8, 3.5, 'plaster'], [10, 15, 8, 8, 3.2, 'plasterRed'], [22, -12, 7, 7, 3, 'plasterWhite'], [25, 14, 8, 7, 3.2, 'plaster']];
      houses.forEach(([x, z, bw, bd, h, m], i) => w.building(x, z, bw, bd, h, { mat: m, doors: { [z < 0 ? 's' : 'n']: [i % 2 ? 1 : -1], [i % 2 ? 'e' : 'w']: [0] }, windows: { [z < 0 ? 's' : 'n']: [i % 2 ? -2 : 2] }, parapet: true, floor: 'dirt' }));
      w.wall(-20, -24, 32, -24, 1.6, 0.4, 'plaster', [{ c: 18, w: 3, y0: 0, y1: 1.6 }, { c: 36, w: 3, y0: 0, y1: 1.6 }]);
      w.wall(-20, 24, 32, 24, 1.6, 0.4, 'plaster', [{ c: 14, w: 3, y0: 0, y1: 1.6 }, { c: 34, w: 3, y0: 0, y1: 1.6 }]);
      w.box(2, 0, 4, 2.5, 1.0, 1.4, 'wood'); w.crate(-2, -5, 1); w.crate(16, 5, 1.1); w.barrel(14, -5, 'containerBlue');
      w.mesh(new THREE.CylinderGeometry(1, 1, 0.9, 16), 'rock', 5, 0.45, -4); w.collider(4, 0, -5, 6, 0.9, -3);
      w.car(30, -4, 0.3, 0x5a4a30, true);
      w.box(-8, 1.1, 10.3, 1.2, 1.0, 0.05, 'windowLit', { collide: false });
      w.pointLight(-8, 2.2, 14, 0xffb070, 3, 9, true);
      w.box(25, 1.1, 10.3, 1.2, 1.0, 0.05, 'windowLit', { collide: false });
      // ---- 大院 ----
      const T = 0.4, H = 3.2;
      w.wall(45, -22, 88, -22, H, T, 'plaster', [{ c: 5, w: 3, y0: 0, y1: H }]);
      w.wall(45, 22, 88, 22, H, T, 'plaster', [{ c: 5, w: 3, y0: 0, y1: H }]);
      w.wall(45, -22, 45, 22, H, T, 'plaster', [{ c: 22, w: 6, y0: 0, y1: H }]);
      w.wall(88, -22, 88, 22, H, T, 'plaster', [{ c: 22, w: 5, y0: 0, y1: H }]);
      // 主楼
      const hx0 = 57, hx1 = 79, hz0 = -8, hz1 = 8, hh = 3.6;
      w.building(68, 0, 22, 16, hh, { mat: 'plasterWhite', doors: { w: [0], e: [0] }, windows: { n: [-6, 2, 7], s: [-6, 4] }, parapet: true, floor: 'tiles' });
      w.wall(hx0 + 0.15, -2.5, hx1 - 0.15, -2.5, hh, 0.2, 'plaster', [{ c: 5, w: 1.3 }, { c: 16, w: 1.3 }]);
      w.wall(hx0 + 0.15, 2.5, hx1 - 0.15, 2.5, hh, 0.2, 'plaster', [{ c: 8, w: 1.3 }, { c: 18, w: 1.3 }]);
      w.wall(68, hz0 + 0.15, 68, -2.6, hh, 0.2, 'plaster');
      w.wall(70, 2.6, 70, hz1 - 0.15, hh, 0.2, 'plaster');
      // 情报室
      w.box(75, 0, -6.2, 2.2, 0.8, 1.0, 'wood');
      w.laptopPos = V(75, -6.2); w.laptopPos.y = 0.85;
      w.box(75, 0.8, -6.3, 0.4, 0.02, 0.3, 'darkMetal', { collide: false });
      w.box(75, 0.8, -6.45, 0.4, 0.28, 0.02, 'lampCold', { collide: false });
      w.box(71, 0, -7.4, 1.8, 2, 0.6, 'wood'); w.crate(77.5, -3.8, 0.9);
      w.box(60, 0, -6, 2, 0.5, 3, 'clothRed'); w.box(62, 0, 6.5, 2.5, 0.8, 1, 'wood'); w.box(76, 0, 6, 1, 1.8, 2, 'wood');
      w.pointLight(62, 3, 0, 0xffc080, 3, 10, true);
      w.pointLight(74, 3, -5, 0xffc080, 2.5, 8, true);
      // 庭院
      w.truck(51, -12, Math.PI / 2 + 0.2, 0xd9d4c4); w.truckCollider(51, -12, Math.PI / 2);
      w.crateStack(49, 12); w.sandbags(53, 4, 4, Math.PI / 2); w.sandbags(53, -4, 3, Math.PI / 2);
      w.barrel(55, 16, 'burnt', true);
      w.box(83, 0, -15, 3, 1.5, 3, 'crate', { texScale: 1.5 }); w.box(82, 0, 14, 2, 2.5, 4, 'wood');
      w.ammoCrate = V(55, -18);
      w.box(55, 0, -18.5, 1.2, 0.6, 0.7, 'gunGreen');
      w.lampPost(47, 18, 0xffc080, -Math.PI / 2, 10);
      // 撤离区
      w.lzPos = V(94, 0);
      w.rock(96, -12, 1.8); w.rock(97, 14, 1.4);
      w.points = {
        start: V(-88, 0), outpost: V(-45, 0), village: V(10, 0), gate: V(44, 0), house: V(58, 0),
      };
      w.spawns.A = [V(-88, 0)]; w.spawns.B = [V(40, 0)];
      w.flagPos = [];
    },
  },
};
