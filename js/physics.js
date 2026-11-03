// Rapier owns character collision resolution, environment rays and thrown bodies. Gameplay still
// supplies desired movement, gravity and fuse times; this module has no renderer.
import RAPIER from '../lib/rapier/rapier.mjs';

let ready;
export function initPhysics() { return ready ||= RAPIER.init(); }
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
const FIXED_DT = 1 / 120;
const STATIC_ONLY = RAPIER.QueryFilterFlags.ONLY_FIXED | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS;
function capsule(height, radius) {
  const r = Math.min(radius, height * 0.45);
  return new RAPIER.Capsule(Math.max(0, height / 2 - r), r);
}
function center(feet, height) { return { x: feet.x, y: feet.y + height / 2, z: feet.z }; }

export class PhysicsWorld {
  constructor({ boxes = [], terrain = null, meshes = [], gravity = -18 } = {}) {
    this.engine = new RAPIER.World({ x: 0, y: gravity, z: 0 });
    this.events = new RAPIER.EventQueue(true);
    this.characters = new Set(); this.characterColliders = new Set();
    this.projectiles = new Map(); this.surfaces = new Map();
    this.accumulator = 0; this.disposed = false;
    for (const b of boxes) {
      const hx = (b.x1 - b.x0) / 2, hy = (b.y1 - b.y0) / 2, hz = (b.z1 - b.z0) / 2;
      if (Math.min(hx, hy, hz) <= 0) continue;
      const collider = this.engine.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setTranslation(b.x0 + hx, b.y0 + hy, b.z0 + hz).setFriction(0.8));
      this.surfaces.set(collider.handle, b);
    }
    for (const mesh of [...meshes, ...(terrain ? [terrain] : [])]) {
      const collider = this.engine.createCollider(RAPIER.ColliderDesc.trimesh(
        mesh.vertices, mesh.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES,
      ).setFriction(0.8).setCollisionGroups(mesh.surface?.ray === false ? 0x0002ffff : 0xffffffff));
      this.surfaces.set(collider.handle, mesh.surface || { mat: 'sand' });
    }
    // Populate the spatial index before the first movement/query.
    this.engine.timestep = FIXED_DT; this.engine.step(this.events);
  }

  createCharacter(feet, radius = 0.35, height = 1.8) {
    const character = new CharacterBody(this, feet, radius, height);
    this.characters.add(character); return character;
  }

  // Unit direction, maximum distance in metres. Movement capsules are excluded:
  // combat owns head/body/leg hit regions and team/shooter filtering.
  raycast(origin, direction, maxDistance) {
    if (this.disposed || maxDistance <= 0) return null;
    const ray = new RAPIER.Ray(origin, direction);
    const hit = this.engine.castRayAndGetNormal(ray, maxDistance, true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, undefined,
      collider => !this.characterColliders.has(collider.handle) && this.surfaces.get(collider.handle)?.ray !== false);
    if (!hit) return null;
    return { t: hit.timeOfImpact, point: ray.pointAt(hit.timeOfImpact), normal: { ...hit.normal }, surface: this.surfaces.get(hit.collider.handle) || { mat: 'concrete' } };
  }

  createProjectile(position, velocity, { radius = 0.055, restitution = 0.35, gravityScale = 16 / 18 } = {}) {
    const body = this.engine.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setLinvel(velocity.x, velocity.y, velocity.z).setAngvel({ x: 3, y: 2, z: 5 })
      .setGravityScale(gravityScale).setCcdEnabled(true).setLinearDamping(0.15).setAngularDamping(0.8));
    const collider = this.engine.createCollider(RAPIER.ColliderDesc.ball(radius)
      .setRestitution(restitution).setFriction(0.75).setDensity(500)
      .setCollisionGroups(0x0004fffd) // Thrown props pass through invisible player clips (membership 2).
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body);
    const projectile = new ProjectileBody(this, body, collider);
    this.surfaces.set(collider.handle, { mat: 'metal' });
    this.projectiles.set(collider.handle, projectile); return projectile;
  }

  step(dt) {
    if (this.disposed) return;
    this.accumulator += Math.min(0.1, Math.max(0, dt));
    while (this.accumulator + 1e-9 >= FIXED_DT) {
      this.engine.timestep = FIXED_DT; this.engine.step(this.events);
      this.events.drainCollisionEvents((a, b, started) => {
        if (!started) return;
        for (const handle of [a, b]) {
          const projectile = this.projectiles.get(handle);
          if (projectile) projectile.contacts++;
        }
      });
      this.accumulator -= FIXED_DT;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.characters.clear(); this.characterColliders.clear(); this.projectiles.clear(); this.surfaces.clear();
    this.events.free(); this.engine.free();
  }
}

class CharacterBody {
  constructor(world, feet, radius, height) {
    this.world = world; this.radius = radius; this.height = height;
    const p = center(feet, height);
    this.body = world.engine.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y, p.z));
    this.collider = world.engine.createCollider(new RAPIER.ColliderDesc(capsule(height, radius)), this.body);
    world.characterColliders.add(this.collider.handle);
    this.controller = world.engine.createCharacterController(0.015);
    this.controller.enableAutostep(0.45, 0.15, false);
    this.controller.enableSnapToGround(0.45);
    this.controller.setMaxSlopeClimbAngle(50 * Math.PI / 180);
    this.controller.setMinSlopeSlideAngle(55 * Math.PI / 180);
  }

  canFit(feet, height) {
    if (this.disposed || this.world.disposed) return false;
    let blocked = false;
    this.world.engine.intersectionsWithShape(center(feet, height), IDENTITY,
      capsule(height - 0.01, Math.max(0.01, this.radius - 0.005)),
      () => { blocked = true; return false; }, STATIC_ONLY, undefined, this.collider, this.body);
    return !blocked;
  }

  reset(feet, height = 1.8) {
    if (this.disposed || this.world.disposed) throw new Error('Character physics has been disposed');
    this.height = height; this.collider.setShape(capsule(height, this.radius));
    this.body.setTranslation(center(feet, height), true); this.collider.setEnabled(true);
    this.world.engine.propagateModifiedBodyPositionsToColliders();
  }
  disable() { if (!this.disposed && !this.world.disposed) this.collider.setEnabled(false); }

  move(feet, desired, height = this.height) {
    if (this.disposed || this.world.disposed) throw new Error('Character physics has been disposed');
    if (Math.abs(height - this.height) > 0.0001 && (height < this.height || this.canFit(feet, height))) {
      this.height = height; this.collider.setShape(capsule(height, this.radius));
    }
    this.body.setTranslation(center(feet, this.height), true);
    this.world.engine.propagateModifiedBodyPositionsToColliders();
    this.controller.computeColliderMovement(this.collider, desired, STATIC_ONLY);
    const movement = this.controller.computedMovement();
    const position = { x: feet.x + movement.x, y: feet.y + movement.y, z: feet.z + movement.z };
    this.body.setTranslation(center(position, this.height), true);
    this.world.engine.propagateModifiedBodyPositionsToColliders();
    const normals = [];
    for (let i = 0; i < this.controller.numComputedCollisions(); i++) {
      const hit = this.controller.computedCollision(i);
      if (hit) normals.push({ ...hit.normal1 });
    }
    return { position, movement: { ...movement }, grounded: this.controller.computedGrounded(), normals, height: this.height };
  }

  dispose() {
    if (this.disposed || this.world.disposed) return;
    this.disposed = true;
    this.world.characterColliders.delete(this.collider.handle);
    this.world.engine.removeCharacterController(this.controller);
    this.world.engine.removeRigidBody(this.body);
    this.world.characters.delete(this);
  }
}

class ProjectileBody {
  constructor(world, body, collider) {
    this.world = world; this.body = body; this.collider = collider; this.contacts = 0;
  }
  snapshot() {
    if (this.disposed || this.world.disposed) throw new Error('Projectile physics has been disposed');
    const contacts = this.contacts; this.contacts = 0;
    return { position: { ...this.body.translation() }, velocity: { ...this.body.linvel() }, rotation: { ...this.body.rotation() }, contacts };
  }
  stop() {
    if (this.disposed || this.world.disposed) return;
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
  }
  dispose() {
    if (this.disposed || this.world.disposed) return;
    this.disposed = true; this.world.projectiles.delete(this.collider.handle); this.world.surfaces.delete(this.collider.handle);
    this.world.engine.removeRigidBody(this.body);
  }
}
