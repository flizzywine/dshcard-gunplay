import * as THREE from 'three';
import { initPhysics, PhysicsWorld } from './physics.js';

async function start() {
  await initPhysics();
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.prepend(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#24313c'); scene.fog = new THREE.Fog('#24313c', 30, 85);
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 150);
  scene.add(new THREE.HemisphereLight(0xc8e5ff, 0x454239, 2));
  const sun = new THREE.DirectionalLight(0xffecd1, 3); sun.position.set(-15, 25, 10);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 30, bottom: -30, far: 80 }); scene.add(sun);
  const boxes = [], materials = new Map();
  function material(color) {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.75 }));
    return materials.get(color);
  }
  function block(x, y, z, w, h, d, color) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
    mesh.position.set(x, y + h / 2, z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
    boxes.push({ x0: x - w / 2, x1: x + w / 2, y0: y, y1: y + h, z0: z - d / 2, z1: z + d / 2 });
  }
  block(4, -0.3, -2, 70, 0.3, 50, '#46525a');
  const grid = new THREE.GridHelper(70, 70, '#80908d', '#64716f'); grid.position.set(4, 0.004, -2); scene.add(grid);
  for (let i = 0; i < 8; i++) block(0, 0, 1.5 - i * 0.7, 3, (i + 1) * 0.2, 0.7, '#d9b082');
  block(9, 0.8, -1.5, 3.2, 0.35, 4, '#a5b1bf');
  block(7.3, 0, -1.5, 0.25, 1.15, 4, '#697c8e'); block(10.7, 0, -1.5, 0.25, 1.15, 4, '#697c8e');
  block(18, 0, -2, 4, 3, 0.04, '#c38d75');
  const terrain = { vertices: new Float32Array([-11, 0, 2, -7, 0, 2, -11, 2, -6, -7, 2, -6]), indices: new Uint32Array([0, 1, 2, 1, 3, 2]) };
  const rampGeometry = new THREE.BufferGeometry();
  rampGeometry.setAttribute('position', new THREE.BufferAttribute(terrain.vertices, 3)); rampGeometry.setIndex(new THREE.BufferAttribute(terrain.indices, 1)); rampGeometry.computeVertexNormals();
  const ramp = new THREE.Mesh(rampGeometry, material('#819994')); ramp.receiveShadow = true; scene.add(ramp);
  block(-9, 0, -7, 4, 2, 2, '#819994');
  const world = new PhysicsWorld({ boxes, terrain });
  const positions = { ramp: [-9, 3.5], stairs: [0, 3.5], tunnel: [9, 2.8], wall: [18, 3] };
  const hints = { ramp: '沿坡面前进，观察接地与下坡贴地。', stairs: '直接向前走上台阶，无需连续跳跃。', tunnel: '站立不能进入低洞；按 Z 趴下后穿过，洞内起身会被阻止。', wall: '按 Shift 向薄墙突进；按 E 投球，观察碰撞与反弹。' };
  let scenario = 'ramp', position = new THREE.Vector3(-9, 0.02, 3.5), velocity = new THREE.Vector3(), height = 1.8, grounded = false, dash = 0;
  const character = world.createCharacter(position), keys = new Set(), pressed = new Set(), balls = [];
  const avatar = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, 1.14, 8, 16), material('#6de0ce'));
  avatar.castShadow = true; scene.add(avatar);
  const direction = new THREE.Vector3(0, 0, -1), aim = new THREE.Vector3(), nextCamera = new THREE.Vector3();
  let avatarHeight = 1.8;
  const status = document.getElementById('status');
  function select(name) {
    scenario = name; height = 1.8; dash = 0; velocity.set(0, 0, 0);
    position.set(positions[name][0], 0.02, positions[name][1]); character.reset(position);
    document.getElementById('hint').textContent = hints[name];
    document.querySelectorAll('[data-scenario]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scenario === name)));
    camera.position.set(position.x + 1.8, 4.5, position.z + 7);
  }
  function throwBall() {
    const p = position.clone().addScaledVector(direction, 0.7); p.y += height * 0.75;
    const v = direction.clone().multiplyScalar(17); v.y = 4;
    const body = world.createProjectile(p, v), mesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), material('#ffd17d'));
    mesh.castShadow = true; scene.add(mesh); balls.push({ body, mesh, age: 0 });
  }
  document.querySelectorAll('[data-scenario]').forEach(button => button.addEventListener('click', () => select(button.dataset.scenario)));
  addEventListener('keydown', event => {
    if (['Space', 'ShiftLeft', 'ShiftRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'KeyZ', 'KeyE', 'KeyR'].includes(event.code)) event.preventDefault();
    if (!keys.has(event.code)) pressed.add(event.code); keys.add(event.code);
  });
  addEventListener('keyup', event => keys.delete(event.code));
  addEventListener('blur', () => { keys.clear(); pressed.clear(); });
  addEventListener('resize', resize);
  function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
  resize(); select(scenario);
  let previous = performance.now();
  renderer.setAnimationLoop(now => {
    const dt = Math.min(0.05, (now - previous) / 1000); previous = now;
    world.step(dt);
    if (pressed.has('KeyR')) select(scenario);
    let requested = height;
    if (pressed.has('KeyC')) requested = height === 1.25 ? 1.8 : 1.25;
    if (pressed.has('KeyZ')) requested = height === 0.6 ? 1.8 : 0.6;
    if (requested < height || character.canFit(position, requested)) height = requested;
    const x = Number(keys.has('KeyD')) - Number(keys.has('KeyA')), z = Number(keys.has('KeyS')) - Number(keys.has('KeyW'));
    if (x || z) direction.set(x, 0, z).normalize();
    if (pressed.has('ShiftLeft') || pressed.has('ShiftRight')) dash = 0.18;
    if (pressed.has('Space') && grounded) velocity.y = 5.6;
    const speed = dash > 0 ? 40 : height < 1 ? 1.2 : height < 1.5 ? 2.8 : 5.6;
    aim.set(x, 0, z).normalize(); if (dash > 0) aim.copy(direction);
    velocity.x = aim.x * speed; velocity.z = aim.z * speed; velocity.y -= 18 * dt;
    const result = character.move(position, { x: velocity.x * dt, y: velocity.y * dt, z: velocity.z * dt }, height);
    position.copy(result.position); grounded = result.grounded;
    if (grounded || result.normals.some(n => n.y < -0.5)) velocity.y = Math.min(0, velocity.y) * (grounded ? 0 : 1);
    dash = Math.max(0, dash - dt);
    if (position.y < -5) select(scenario);
    if (pressed.has('KeyE')) throwBall();
    if (height !== avatarHeight) {
      avatar.geometry.dispose(); const r = Math.min(0.33, height * 0.45);
      avatar.geometry = new THREE.CapsuleGeometry(r, height - 2 * r, 8, 16); avatarHeight = height;
    }
    avatar.position.copy(position); avatar.position.y += height / 2;
    for (let i = balls.length - 1; i >= 0; i--) {
      const ball = balls[i], motion = ball.body.snapshot(); ball.age += dt;
      ball.mesh.position.copy(motion.position); ball.mesh.quaternion.copy(motion.rotation);
      if (ball.age > 10 || balls.length > 32) { ball.body.dispose(); scene.remove(ball.mesh); ball.mesh.geometry.dispose(); balls.splice(i, 1); }
    }
    nextCamera.set(position.x + 1.8, position.y + 3.8, position.z + 6.5); camera.position.lerp(nextCamera, 1 - Math.exp(-6 * dt));
    camera.lookAt(position.x, position.y + 0.8, position.z - 2);
    status.textContent = `${height === 0.6 ? '趴下' : height === 1.25 ? '蹲伏' : '站立'} · ${grounded ? '已接地' : '空中'} · 投掷物 ${balls.length}`;
    pressed.clear(); renderer.render(scene, camera);
  });
  window.physicsLab = { world, character, position, get height() { return height; }, get balls() { return balls.length; } };
  document.body.dataset.ready = 'true';
}
start().catch(error => { document.getElementById('status').textContent = '初始化失败：' + error.message; console.error(error); });
