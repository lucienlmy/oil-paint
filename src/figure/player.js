// The starter man as a player: a Rapier capsule moved by a kinematic character controller
// (steps, slopes, ground snap), turning and speeding up like a person, and choosing what the
// animator plays: the locomotion blend, starts and stops, turns in place, jumps.
// Clips with their own travel (starts, stops, turns) move him by that travel, so his feet stay
// put while they play.
import * as THREE from 'three';
import { rootAt } from './man.js';

const damp = (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt);
const angleWrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = THREE.MathUtils.clamp;
const approach = (a, b, step) => (a < b ? Math.min(b, a + step) : Math.max(b, a - step));

export const TUNING = {
  radius: 0.28, height: 1.8,
  accel: { walk: 6, run: 9, sprint: 7 }, decel: 12,
  turn: { walk: 9, run: 7.5, sprint: 5.2 }, // rad/s
  jumpHeight: 0.8, gravity: 19, fallGravity: 25, airControl: 2.5,
  stepHeight: 0.3, maxSlopeDeg: 46,
};

export class Player {
  constructor({ RAPIER, world, man, animator, spawn, yaw = 0, tuning = TUNING }) {
    this.R = RAPIER; this.world = world; this.man = man; this.anim = animator; this.t = tuning;
    this.yaw = yaw;
    this.vel = new THREE.Vector3();
    this.speed = 0; // horizontal speed along where he's going
    this.grounded = true;
    this.airTime = 0;
    this.mode = 'move';
    const half = this.halfHeight();
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y + tuning.radius + half + 0.02, spawn.z));
    this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(half, tuning.radius).setFriction(0), this.body);
    this.kcc = world.createCharacterController(0.02);
    this.kcc.setUp({ x: 0, y: 1, z: 0 });
    this.kcc.enableAutostep(tuning.stepHeight, 0.12, false);
    this.kcc.enableSnapToGround(0.45);
    this.kcc.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(tuning.maxSlopeDeg));
    this.kcc.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(tuning.maxSlopeDeg + 6));
    this.kcc.setSlideEnabled(true);
    this.feet = new THREE.Vector3(spawn.x, spawn.y, spawn.z);
    this.prevFeet = this.feet.clone();
    this.visualY = spawn.y;
    this.ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
    this.acc = 0;
    this.lastYaw = yaw;
    this.turnRate = 0;
    this.prevSpeed = 0;
    this.moveAngle = 0;
    this.strafe = false;
    this.events = [];
  }

  halfHeight() { return this.t.height / 2 - this.t.radius; }

  /** Ground below (x, z) starting at fromY: { y, normal } or null. */
  ground(x, z, fromY, maxDist = 1.6) {
    this.ray.origin = { x, y: fromY, z };
    this.ray.dir = { x: 0, y: -1, z: 0 };
    const hit = this.world.castRayAndGetNormal(this.ray, maxDist, true, undefined, undefined, this.collider);
    if (!hit) return null;
    return { y: fromY - hit.timeOfImpact, normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z) };
  }

  castRay(origin, dir, max) {
    this.ray.origin = { x: origin.x, y: origin.y, z: origin.z };
    this.ray.dir = { x: dir.x, y: dir.y, z: dir.z };
    const hit = this.world.castRay(this.ray, max, true, undefined, undefined, this.collider);
    return hit ? hit.timeOfImpact : null;
  }

  facing(yaw = this.yaw) { return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); }

  // --- what he wants, from the input ---------------------------------------------------------
  intent(input, camYaw) {
    const m = input.move, mag = Math.min(1, Math.hypot(m.x, m.y));
    const f = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw));
    const r = new THREE.Vector3(-Math.cos(camYaw), 0, Math.sin(camYaw));
    const dir = f.multiplyScalar(m.y).addScaledVector(r, m.x);
    if (dir.lengthSq() > 1e-6) dir.normalize();
    const S = this.anim.setup.speeds;
    let speed;
    if (mag < 0.05) speed = 0;
    else if (input.walk) speed = S.walk * Math.min(1, mag * 1.4);
    else if (input.device === 'pad' && mag < 0.6) speed = S.walk * (mag / 0.6);
    else if (input.sprint && !input.strafe) speed = S.sprint;
    else speed = input.device === 'pad' ? THREE.MathUtils.lerp(S.walk, S.run, (mag - 0.6) / 0.4) : S.run;
    return { dir, mag, speed, dirYaw: Math.atan2(dir.x, dir.z) };
  }

  // --- each frame ---------------------------------------------------------------------------
  update(dt, input, camYaw) {
    const A = this.anim, R = this.R;
    const want = this.intent(input, camYaw);
    const wasStrafe = this.strafe;
    this.strafe = !!input.strafe;
    this.lastInputMag = want.mag;
    if (wasStrafe !== this.strafe && this.mode === 'move') A.enter(A.locoState({ strafe: this.strafe }), 0.25);

    const st = A.state;
    const f = this.facing();
    const desired = new THREE.Vector3();
    let rootMotion = null;

    if (this.mode === 'move') {
      // jump
      if (input.jump && this.grounded) return this.jump(dt, want);
      const idle = this.speed < 0.15;
      // turn on the spot: free movement asked for far behind him, or aiming past his shoulder
      if (idle && this.grounded) {
        const ask = this.strafe ? camYaw : want.mag > 0.05 ? want.dirYaw : null;
        if (ask != null) {
          const d = angleWrap(ask - this.yaw);
          if ((!this.strafe && Math.abs(d) > 2.2) || (this.strafe && want.mag < 0.05 && Math.abs(d) > 1.15)) return this.turnInPlace(d);
        }
      }
      // start walking from standing: a real first step
      // (not while pushing into a wall: he'd replay the first step over and over)
      if (idle && !(this.wallTime > 0) && !this.strafe && want.mag > 0.05 && want.speed <= A.setup.speeds.walk + 0.01 && Math.abs(angleWrap(want.dirYaw - this.yaw)) < 0.9 && this.grounded) {
        this.yaw = want.dirYaw;
        this.mode = 'start';
        A.enter(A.oneShot('start', 'AM_Idle_To_Walk', { from: 0.06, to: 0.62, rate: 1.15 }), 0.2);
        return this.step(dt, new THREE.Vector3(), true);
      }
      // the same into a run or sprint: anymove's first steps, from a stand to 5 m/s in about a second
      if (idle && !(this.wallTime > 0) && !this.strafe && want.mag > 0.05 && want.speed > A.setup.speeds.walk + 0.1 && Math.abs(angleWrap(want.dirYaw - this.yaw)) < 0.9 && this.grounded) {
        this.yaw = want.dirYaw;
        this.mode = 'start';
        A.enter(A.oneShot('start', want.speed > A.setup.speeds.run + 0.1 ? 'Idle_To_Sprint' : 'Idle_To_Run', { from: 0.03, to: 0.72 }), 0.15);
        return this.step(dt, new THREE.Vector3(), true);
      }
      // stop: let go while moving
      this.moveTime = this.speed > 0.5 ? (this.moveTime ?? 0) + dt : 0;
      if (!this.strafe && want.mag < 0.05 && this.grounded && this.speed > 0.9 && this.moveTime > 0.6) {
        const clip = this.speed > A.setup.speeds.run + 0.4 ? 'Sprint_To_Idle' : this.speed > 2.4 ? 'Run_To_Idle' : 'AM_Walk_To_Idle';
        const from = A.match(clip, A.currentFeet(), 0, 0.3);
        this.mode = 'stop';
        this.stopSpeed = this.speed;
        A.enter(A.oneShot('stop', clip, { from, to: 0.92 }), 0.22);
        if (this.sprintTime > 1.5) this.tiredFor = 6;
        return this.step(dt, new THREE.Vector3(), true);
      }
      // ordinary movement
      if (this.strafe) {
        // standing still he keeps his feet and turns his head; past his shoulder he steps round
        if (want.mag > 0.05 || this.speed > 0.2) this.yaw = this.turnToward(this.yaw, camYaw, 12, dt);
        const local = want.dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.yaw);
        const ang = Math.atan2(local.x, local.z); // + = his left
        // the fastest he goes this way: run forward, jog sideways, walk backwards
        const fwd = Math.cos(ang), side = Math.abs(Math.sin(ang));
        const S = A.setup.speeds;
        const cap = fwd >= 0 ? THREE.MathUtils.lerp(S.strafeJog, S.run * 0.82, fwd * fwd) * (1 - side * 0) : THREE.MathUtils.lerp(S.strafeJog, S.walk * 1.15, fwd * fwd);
        const target = Math.min(want.speed, cap);
        this.speed = approach(this.speed, target, (target > this.speed ? this.t.accel.run : this.t.decel) * dt);
        if (want.mag > 0.05) this.moveAngle = ang;
        this.moveDir = want.mag > 0.05 ? want.dir.clone() : this.moveDir ?? f.clone();
        desired.copy(this.moveDir).multiplyScalar(this.speed);
      } else {
        const gait = want.speed > A.setup.speeds.run + 0.1 ? 'sprint' : want.speed > A.setup.speeds.walk + 0.1 ? 'run' : 'walk';
        if (want.mag > 0.05) this.yaw = this.turnToward(this.yaw, want.dirYaw, this.t.turn[gait], dt);
        // slow down while the turn is sharp, so feet don't skate sideways
        const off = want.mag > 0.05 ? Math.abs(angleWrap(want.dirYaw - this.yaw)) : 0;
        // he carves ordinary turns at speed; only a near-reversal slows him (running circles used to
        // drop the run to a walk and back several times a second)
        const target = want.speed * (off < 1.0 ? 1 : clamp(1.45 - off / 2.2, 0.4, 1));
        const rate = target > this.speed ? this.t.accel[gait] : this.t.decel;
        this.speed = approach(this.speed, target, rate * dt);
        this.moveAngle = 0;
        desired.copy(this.facing()).multiplyScalar(this.speed);
      }
      this.sprintTime = this.speed > A.setup.speeds.run + 0.3 ? (this.sprintTime ?? 0) + dt : Math.max(0, (this.sprintTime ?? 0) - dt * 0.5);
      // fell off a ledge
      if (!this.grounded && this.airTime > 0.2) { this.mode = 'air'; A.enter(A.oneShot('air', 'Jump_Loop', { loop: true }), 0.3); }
      this.idleExtras(dt);
      return this.step(dt, desired, false);
    }

    if (this.mode === 'turn') {
      // the clip's own root turn, scaled to land exactly on the angle asked for
      const s = st;
      const raw = this.man.raw[s.clip];
      const y0 = yawAt(raw, s.prevU * raw.duration), y1 = yawAt(raw, s.u * raw.duration);
      this.yaw += angleWrap(y1 - y0) * s.scale;
      const asked = want.mag > 0.05 && !this.strafe;
      if (s.done || (asked && s.u > s.to * 0.7)) { this.mode = 'move'; A.enter(A.locoState({ strafe: this.strafe }), 0.28); }
      return this.step(dt, new THREE.Vector3(), true);
    }

    if (this.mode === 'start' || this.mode === 'stop') {
      rootMotion = this.rootMotion(st, dt);
      // the clip hasn't moved on its first frame: keep his pace for it, or he halts for one frame
      if (st.prevU === st.u) rootMotion = this.facing().multiplyScalar(this.speed * dt);
      const v = rootMotion.length() / Math.max(dt, 1e-4);
      const resumed = this.mode === 'stop' && want.mag > 0.05;
      const runStart = st.clip === 'Idle_To_Run' || st.clip === 'Idle_To_Sprint';
      const asked = this.mode === 'start' && (want.mag < 0.05 || (runStart ? want.speed <= A.setup.speeds.walk + 0.1 : want.speed > A.setup.speeds.walk + 0.1) || Math.abs(angleWrap(want.dirYaw - this.yaw)) > 0.6);
      if (this.mode === 'start' && want.mag > 0.05) this.yaw = this.turnToward(this.yaw, want.dirYaw, 3, dt);
      if (st.done || resumed || asked) {
        this.speed = st.done && st.kind === 'stop' ? 0 : v > 0.05 ? v : this.speed;
        this.mode = 'move';
        // carry on in step: the gait phase whose feet match these
        const loco = A.locoState({ strafe: this.strafe });
        A.phase = A.matchPhase(this.speed > 2.4 ? A.setup.run : A.setup.walk, A.currentFeet());
        A.enter(loco, st.done ? 0.35 : 0.22);
      }
      return this.step(dt, rootMotion.divideScalar(Math.max(dt, 1e-4)), true);
    }

    if (this.mode === 'jump' || this.mode === 'air') {
      // keep momentum, a little air control
      if (want.mag > 0.05) {
        const wantV = want.dir.clone().multiplyScalar(Math.max(want.speed, 1.5));
        this.vel.x = approach(this.vel.x, wantV.x, this.t.airControl * dt);
        this.vel.z = approach(this.vel.z, wantV.z, this.t.airControl * dt);
        if (!this.strafe) this.yaw = this.turnToward(this.yaw, want.dirYaw, 2.5, dt);
      }
      if (this.strafe) this.yaw = this.turnToward(this.yaw, camYaw, 8, dt);
      if (st.kind === 'jumpStart' && (st.done || this.vel.y < 1.0)) A.enter(A.oneShot('air', 'Jump_Loop', { loop: true }), 0.25);
      desired.set(this.vel.x, 0, this.vel.z);
      this.step(dt, desired, false, true);
      if (this.grounded && this.airTime === 0) this.land(want);
      return;
    }

    if (this.mode === 'idleExtra') return this.idleShot(dt, input);

    if (this.mode === 'land') {
      const moving = want.mag > 0.05;
      this.speed = approach(this.speed, moving ? want.speed : 0, (moving ? 6 : 10) * dt);
      if (moving && !this.strafe) this.yaw = this.turnToward(this.yaw, want.dirYaw, 6, dt);
      if (input.jump && this.grounded) return this.jump(dt, want);
      const leave = moving ? st.u > st.from + 0.14 : st.done;
      if (leave) {
        this.mode = 'move';
        A.phase = A.matchPhase(this.speed > 2.4 ? A.setup.run : A.setup.walk, A.currentFeet());
        A.enter(A.locoState({ strafe: this.strafe }), moving ? 0.25 : 0.35);
      }
      desired.copy(this.strafe && this.moveDir ? this.moveDir : this.facing()).multiplyScalar(this.speed);
      return this.step(dt, desired, false);
    }
  }

  // one-shots that just play out (idle extras): step() hands them back
  idleShot(dt, input) {
    if (input.jump && this.grounded) { this.mode = 'move'; return this.jump(dt, this.intent(input, 0)); }
    return this.step(dt, new THREE.Vector3(), true);
  }

  turnToward(a, b, rate, dt) { const d = angleWrap(b - a); return a + clamp(d, -rate * dt, rate * dt); }

  rootMotion(st, dt) {
    const raw = this.man.raw[st.clip];
    const p0 = rootAt(raw, st.prevU * raw.duration), p1 = rootAt(raw, st.u * raw.duration);
    return p1.sub(p0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
  }

  turnInPlace(d) {
    const A = this.anim;
    const big = Math.abs(d) > 2.2;
    const clip = big ? (d > 0 ? 'Turn180_L' : 'Turn180_R') : d > 0 ? 'Turn90_L' : 'Turn90_R';
    const raw = this.man.raw[clip];
    const total = angleWrap(yawAt(raw, raw.duration) - yawAt(raw, 0)) || (big ? Math.PI : Math.PI / 2) * Math.sign(d);
    // the turning happens in the middle of the clip: skip its still start and end
    const s = A.oneShot('turn', clip, { from: 0.08, to: big ? 0.8 : 0.78, rate: big ? 1.45 : 1.35 });
    const covered = angleWrap(yawAt(raw, s.to * raw.duration) - yawAt(raw, s.u * raw.duration)) || total;
    s.scale = d / (Math.abs(covered) > 0.3 ? covered : total);
    s.prevU = s.u;
    this.mode = 'turn';
    this.speed = 0;
    A.enter(s, 0.2);
  }

  jump(dt, want) {
    const A = this.anim, t = this.t;
    this.vel.copy(this.strafe && this.moveDir ? this.moveDir : this.facing()).multiplyScalar(this.speed);
    this.vel.y = Math.sqrt(2 * t.gravity * t.jumpHeight);
    this.grounded = false;
    this.mode = 'jump';
    this.jumpedAt = performance.now();
    const info = A.info.Jump_Start;
    A.enter(A.oneShot('jumpStart', 'Jump_Start', { from: info.launch ?? 0.35, to: 1, rate: 1.25 }), 0.08);
    this.step(dt, new THREE.Vector3(this.vel.x, 0, this.vel.z), false, true);
  }

  land(want) {
    const A = this.anim;
    const fall = this.lastFallSpeed ?? 0;
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    this.vel.y = 0;
    this.mode = 'land';
    const from = A.info.Jump_Land.contact ?? 0;
    // a short drop only dips; a long one plays the whole squash
    const st = A.oneShot('land', 'Jump_Land', { from, to: fall > 7 ? 0.9 : 0.7, rate: fall > 7 ? 1.1 : 1.45 });
    st.from = from;
    A.enter(st, 0.08);
  }

  idleExtras(dt) {
    const A = this.anim, st = A.state;
    if (this.tiredFor > 0) this.tiredFor -= dt;
    A.tired = this.tiredFor > 0;
    if (st.kind !== 'loco' || this.strafe) { this.idleTime = 0; return; }
    if (this.speed < 0.05) this.idleTime = (this.idleTime ?? 0) + dt; else this.idleTime = 0;
    if (this.idleTime > 9 && this.speed < 0.05) {
      this.idleTime = -5;
      this.mode = 'idleExtra';
      A.enter(A.oneShot('idleExtra', 'Idle_LookAround', { from: 0, to: 1 }), 0.6);
    }
  }

  /** Moves the capsule by velocity `v` (world, horizontal) for this frame, with gravity. */
  step(dt, v, rootMotion = false, airborne = false) {
    const R = this.R, t = this.t;
    // one-shots that just play out (idle extras) hand back to the blend
    const A = this.anim;
    if (this.mode === 'idleExtra' && A.state.done) {
      this.mode = 'move'; A.enter(A.locoState({ strafe: this.strafe }), 0.4);
    }
    if (this.mode === 'idleExtra' && (this.lastInputMag ?? 0) > 0.05) {
      this.mode = 'move'; A.enter(A.locoState({ strafe: this.strafe }), 0.25);
    }
    if (!airborne) {
      this.vel.x = v.x; this.vel.z = v.z;
      // a light push down: snap-to-ground keeps him on slopes and stairs going down, and a hard
      // push stops Rapier's autostep from lifting him up a step
      if (this.grounded) this.vel.y = -0.1;
    }
    if (!(this.grounded && !airborne)) this.vel.y -= (this.vel.y < 0 ? t.fallGravity : t.gravity) * dt;
    this.vel.y = Math.max(this.vel.y, -40);
    const d = { x: this.vel.x * dt, y: this.vel.y * dt, z: this.vel.z * dt };
    this.kcc.computeColliderMovement(this.collider, d);
    const mv = this.kcc.computedMovement();
    const was = this.grounded;
    this.grounded = this.kcc.computedGrounded();
    if (this.vel.y > 0 && mv.y < d.y * 0.5) this.vel.y = 0; // head hit something
    const p = this.body.translation();
    this.body.setNextKinematicTranslation({ x: p.x + mv.x, y: p.y + mv.y, z: p.z + mv.z });
    this.world.step();
    this.prevFeet.copy(this.feet);
    this.feet.set(p.x + mv.x, p.y + mv.y - this.halfHeight() - t.radius - 0.02, p.z + mv.z);
    if (!this.grounded) { this.airTime += dt; this.lastFallSpeed = -this.vel.y; } else if (!was || this.airTime) { this.airTime = 0; }
    if (this.grounded && airborne && this.vel.y > 0 && performance.now() - (this.jumpedAt ?? 0) < 150) this.grounded = false;
    // actual horizontal speed, for the blend (walls slow him down)
    const hs = Math.hypot(mv.x, mv.z) / Math.max(dt, 1e-4);
    const moved3 = Math.hypot(mv.x, mv.y, mv.z) / Math.max(dt, 1e-4);
    this.blocked = !rootMotion && this.mode === 'move' && this.grounded && moved3 < this.speed * 0.6 - 0.2 ? (this.blocked ?? 0) + 1 : 0;
    // against a wall he slows to what he really moves, so he doesn't run on the spot
    if (this.blocked > 3) { this.speed = Math.max(moved3, this.speed - 20 * dt); this.wallTime = 0.5; }
    else this.wallTime = Math.max(0, (this.wallTime ?? 0) - dt);
    this.turnRate = damp(this.turnRate, angleWrap(this.yaw - this.lastYaw) / Math.max(dt, 1e-4), 10, dt);
    this.accelF = damp(this.accelF ?? 0, (this.speed - this.prevSpeed) / Math.max(dt, 1e-4), 6, dt);
    this.prevSpeed = this.speed;
    this.lastYaw = this.yaw;
  }

  /** The visual root: where the clips' floor goes. Follows steps softly, slopes exactly. */
  visualRoot(dt) {
    const g = this.ground(this.feet.x, this.feet.z, this.feet.y + 0.5, 1.2);
    let y = this.feet.y;
    if (g && this.grounded) y = Math.min(this.feet.y + 0.02, g.y);
    if (!this.grounded) this.visualY = y;
    else this.visualY = y > this.visualY ? damp(this.visualY, y, 14, dt) : damp(this.visualY, y, 20, dt);
    return new THREE.Vector3(this.feet.x, this.visualY, this.feet.z);
  }
}

/** Yaw of a raw clip's root at time t (radians about Y). */
export function yawAt(raw, t) {
  const tr = raw.tracks.find((x) => x.name === 'root.quaternion');
  if (!tr) return 0;
  const n = tr.times.length;
  let i = 0;
  while (i < n - 2 && tr.times[i + 1] < t) i++;
  const k = clamp((t - tr.times[i]) / ((tr.times[i + 1] ?? tr.times[i]) - tr.times[i] || 1), 0, 1);
  const q0 = new THREE.Quaternion().fromArray(tr.values, 0);
  const qa = new THREE.Quaternion().fromArray(tr.values, i * 4), qb = new THREE.Quaternion().fromArray(tr.values, Math.min(n - 1, i + 1) * 4);
  qa.slerp(qb, k);
  const d = qa.multiply(q0.invert());
  return 2 * Math.atan2(d.y, d.w);
}
