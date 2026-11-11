// The same wanderer on a ridge of snow at night, under the aurora, with a lantern. Painted with the same painter
// as the wood (src/oilpaint); only the world is new. It is the picture a bare address shows (src/scenes.js).
//   ?capture       no clock: window.lab.step(dt, n) advances it (for stills and films)
//   ?quality=low   for slower machines: fewer pixels, no veil behind the aurora, less snow in the air
//   ?canvas=0 ?impasto=0..2    parts of the finish, for comparing
import * as THREE from 'three';
import { patchBlock } from 'patch-block';
import recipe from '../../recipe.json';
import RAPIER from '../figure/rapier/rapier.mjs';
import { createShared, WIND } from '../oilpaint/common.js';
import { createBrushSheet } from '../oilpaint/brush.js';
import { createShade } from '../oilpaint/shade.js';
import { createFrame } from '../oilpaint/finish.js';
import { noise } from '../world/noise.js';
import { createFigure } from '../figure/figure.js';
import { Animator } from '../figure/animator.js';
import { Player } from '../figure/player.js';
import { Input } from '../figure/input.js';
import { Follow } from '../figure/camera.js';
import { prepareLand, createLand, heightAt, crestX, START, MOON, EXTENT } from './land.js';
import { createSnow } from './snow.js';
import { createSky } from './sky.js';
import { createFar } from './far.js';
import { createTracks } from './tracks.js';
import { createLantern } from './lantern.js';
import { createDrift } from './drift.js';
import { createPines } from './pines.js';
import { createCabin } from './cabin.js';

const q = new URLSearchParams(location.search);
const capture = q.has('capture');

let shown = true;
let loaded = false;
const block = patchBlock({
  ...recipe.block,
  onSet() {},
  onTrigger() {},
  onVisible(visible) { shown = visible; if (loaded) run(); },
});
block.progress(0.03, 'Laying the ground');
const timings = {};
let mark = performance.now();
const lap = (name) => { const now = performance.now(); timings[name] = Math.round(now - mark); mark = now; };

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(capture ? 1 : Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.autoClear = false;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
document.getElementById('view').appendChild(renderer.domElement);

// the night: a low moon for the sun, thin clear air, and the lantern's colour
const shared = createShared();
shared.tBrush.value = createBrushSheet();
shared.uSunDir.value.copy(MOON);
shared.uHaze.value.setRGB(0.035, 0.12, 0.17);
shared.uHazeSun.value.setRGB(0.06, 0.16, 0.2);
shared.uHazeGlow.value.setRGB(0.03, 0.045, 0.05);
shared.uHazeDensity.value = 0.00046;
shared.uShadeBias.value = 0.0004;
shared.uBounce.value.setRGB(0.015, 0.06, 0.07);
shared.uLampCol.value.setRGB(1.0, 0.6, 0.24);
shared.uGlazeMul.value.setRGB(0.3, 0.38, 0.62); // his shadow on the snow is blue
shared.uGlazeAdd.value.setRGB(0.0, 0.008, 0.03);
shared.uGlow = { value: new THREE.Vector3(1, 0, 0) };
shared.uWarm = { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] };
shared.uRoom = { value: new THREE.Vector4(0, 0, -1, -1) };
if (q.has('impasto')) shared.uImpasto.value = +q.get('impasto');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.3, 16000);
lap('start');

// what he wears by night: light, half-tone, shade under the moon, then the cloth's own colour for the lantern
const NIGHT_CLOTHES = {
  CLOAK: [[0.2, 0.42, 0.6], [0.07, 0.17, 0.32], [0.025, 0.06, 0.15], [0.16, 0.3, 0.5]],
  HAT: [[0.4, 0.46, 0.44], [0.17, 0.2, 0.22], [0.06, 0.075, 0.1], [0.85, 0.72, 0.42]],
  SHIRT: [[0.38, 0.45, 0.5], [0.15, 0.2, 0.27], [0.055, 0.08, 0.13], [0.8, 0.72, 0.56]],
  TROUSERS: [[0.26, 0.28, 0.3], [0.12, 0.13, 0.17], [0.05, 0.055, 0.09], [0.45, 0.32, 0.2]],
  SKIN: [[0.6, 0.53, 0.5], [0.3, 0.25, 0.27], [0.12, 0.1, 0.14], [0.85, 0.62, 0.46]],
  BOOTS: [[0.2, 0.18, 0.17], [0.09, 0.08, 0.09], [0.04, 0.035, 0.05], [0.35, 0.22, 0.14]],
  HAIR: [[0.18, 0.15, 0.14], [0.09, 0.07, 0.08], [0.04, 0.035, 0.05], [0.3, 0.2, 0.13]],
  EYES: [[0.1, 0.09, 0.09], [0.06, 0.05, 0.06], [0.03, 0.03, 0.04], [0.15, 0.1, 0.08]],
};
let told = 0;
const say = (value, label) => { told = Math.max(told, value); block.progress(told, label); };
const figureComing = createFigure(shared, (done) => say(0.05 + 0.55 * done, 'Fetching the wanderer'), NIGHT_CLOTHES);

const turn = () => new Promise((resolve) => setTimeout(resolve, 0));
await prepareLand((done) => { say(0.03 + 0.09 * done, 'Laying the ground'); return turn(); });
const land = createLand(shared);
lap('land');
say(0.12, 'Laying the snow');
await turn();
const snow = createSnow(shared);
const pines = createPines(shared);
land.shade.add(pines.caster); // the moon lays their shadows down the snow with the horns'
const cabin = createCabin(shared);
land.shade.add(cabin.caster);
lap('snow');
const sky = createSky(shared);
const far = createFar(shared);
const tracks = createTracks(shared);
const drift = createDrift(shared);
const lantern = createLantern(shared);
// the moon sees the whole ridge: its picture of the shade is what lays the horns' shadow down the snow
const shade = createShade(renderer, shared, land.shade, { sun: MOON, size: [4096, 3072], box: [740, 560], centre: [0, 150, 0], back: 1600, near: 700, far: 2500 });
lap('shade');
say(0.25, 'Fetching the wanderer');
await turn();
scene.add(sky.group, far.group, land.mesh, snow.group, pines.group, cabin.group, tracks.mesh, lantern.object, lantern.glow, drift);

await RAPIER.init();
const physics = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
{
  const f = land.heightField();
  physics.createCollider(RAPIER.ColliderDesc.heightfield(f.cells, f.cells, f.heights, { x: 2 * f.half, y: 1, z: 2 * f.half }));
  for (const t of pines.colliders) physics.createCollider(RAPIER.ColliderDesc.cylinder(4, t.r).setTranslation(t.x, t.y + 4, t.z));
  for (const s of cabin.solid) physics.createCollider(RAPIER.ColliderDesc.cuboid(s.hx, s.hy, s.hz).setTranslation(s.x, s.y, s.z));
}
lap('physics');

const figure = await figureComing;
const { man } = figure;
scene.add(man.object, figure.cloakMesh, figure.dabs);
const animator = new Animator(man);
const spawn = new THREE.Vector3(START.x, heightAt(START.x, START.z), START.z);
const player = new Player({ RAPIER, world: physics, man, animator, spawn, yaw: Math.PI });
const follow = new Follow(camera);
follow.yaw = Math.PI;
// the eye sits low and looks up past him: the picture is mostly sky
follow.pitch = -0.07;
follow.lift = 1.5;
follow.sink = 0.7;
const input = new Input(renderer.domElement, { pads: !capture && !q.has('nopad') });
physics.step();
// he has come up from the south: his tracks are already there behind him
tracks.lay(crestX, START.z + 16, START.z + 0.4);
lap('figure');

const frame = createFrame(renderer, shared);
frame.uniforms.uCanvas.value = q.has('canvas') ? +q.get('canvas') : 1;
frame.uniforms.uShafts.value = 0; // no sun stands in this air
// ?quality wins; otherwise Patch's performance mode, where there is one. Low draws at the screen's own pixels,
// without the veil behind the aurora and with less snow in the air.
function applyQuality() {
  const low = (q.get('quality') ?? window.patch?.quality ?? 'high') === 'low';
  renderer.setPixelRatio(capture ? 1 : Math.min(devicePixelRatio, low ? 1 : 1.5));
  renderer.setSize(innerWidth, innerHeight);
  frame.resize();
  const veil = sky.group.getObjectByName('veil');
  if (veil) veil.visible = !low;
  drift.geometry.instanceCount = low ? 900 : 2400;
}
applyQuality();
window.patch?.addEventListener?.('qualitychange', applyQuality);

const wind = { x: WIND.x, z: WIND.y };
let time = 0;
function air(x, y, z, out) {
  const along = x * wind.x + z * wind.z, across = -x * wind.z + z * wind.x;
  const gust = THREE.MathUtils.clamp(0.5 + 0.8 * noise((along - time * 4) / 40, across / 90) + 0.3 * noise((along - time * 6.5) / 11, across / 17), 0, 1);
  const speed = 0.6 + 3.6 * gust * gust;
  return out.set(wind.x * speed, 0.25 * Math.sin(time * 2.3 + x) * gust, wind.z * speed);
}

function place(x, z, yaw) {
  const y = heightAt(x, z), half = player.halfHeight();
  player.body.setTranslation({ x, y: y + player.t.radius + half + 0.05, z }, true);
  physics.propagateModifiedBodyPositionsToColliders();
  player.feet.set(x, y, z); player.prevFeet.copy(player.feet); player.visualY = y;
  player.vel.set(0, 0, 0); player.speed = 0; player.mode = 'move'; player.grounded = true;
  player.yaw = player.lastYaw = yaw;
  animator.lock = null; animator.lockOff = null;
  animator.enter(animator.locoState({ strafe: false }), 0.05);
}

// He holds the lantern out at his side: the right arm is set to that after the clips have had it, upper arm out
// and a little forward, forearm forward and level. Directions are in his own frame (+x his left, +z ahead).
const HOLD = [['upperarm_r', 'lowerarm_r', new THREE.Vector3(-0.72, -0.52, 0.42).normalize()], ['lowerarm_r', 'hand_r', new THREE.Vector3(-0.42, 0.16, 0.86).normalize()]];
const from = new THREE.Vector3(), to = new THREE.Vector3(), swing = new THREE.Quaternion(), pq = new THREE.Quaternion(), wq = new THREE.Quaternion();
const grip = new THREE.Vector3(), forearm = new THREE.Vector3(), back = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), want = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const at = (name, out) => out.setFromMatrixPosition(man.bones[name].matrixWorld);
const HAND_TURN = q.has('hand') ? +q.get('hand') : 0; // a turn of the wrist added to that, for trying
function holdLantern() {
  for (const [bone, child, dir] of HOLD) {
    const b = man.bones[bone];
    from.setFromMatrixPosition(man.bones[child].matrixWorld).sub(to.setFromMatrixPosition(b.matrixWorld)).normalize();
    to.copy(dir).applyQuaternion(man.object.quaternion);
    swing.setFromUnitVectors(from, to);
    b.parent.getWorldQuaternion(pq); b.getWorldQuaternion(wq);
    b.quaternion.copy(pq.invert().multiply(swing.multiply(wq)));
    b.updateMatrixWorld(true);
  }
  // The hand is turned about the forearm until its back is uppermost, and closed into a fist: the lantern's
  // handle hangs from inside it. (The back of the hand is found from the knuckles: along the hand, across it.)
  const hand = man.bones.hand_r;
  forearm.copy(at('hand_r', v1)).sub(at('lowerarm_r', v2)).normalize();
  at('middle_01_r', v1).sub(at('hand_r', want));
  at('index_01_r', v2).sub(at('pinky_01_r', want));
  back.crossVectors(v1, v2);
  back.addScaledVector(forearm, -back.dot(forearm)).normalize();
  want.copy(UP).addScaledVector(forearm, -UP.dot(forearm)).normalize();
  animator.rotateWorld(hand, forearm, Math.atan2(forearm.dot(v1.crossVectors(back, want)), back.dot(want)) + HAND_TURN);
  for (const f of animator.fingerPoses ?? []) if (f.bone.name.endsWith('_r')) f.bone.quaternion.slerpQuaternions(f.flat, f.fist, f.thumb ? 0.75 : 1);
  hand.updateMatrixWorld(true);
  grip.set(0, 0, 0);
  for (const name of ['index_01_r', 'ring_01_r', 'index_02_r', 'ring_02_r']) grip.add(at(name, v1));
  grip.multiplyScalar(0.25);
}

const size = new THREE.Vector2();
// Through his own eyes: always in the cabin and on its doorstep, where there is no room for an eye behind him,
// and anywhere else with V. `first` is how far the eye has gone over to it, 0..1.
let first = 0, firstKey = false;
const outlook = new THREE.Vector3(), eyeAt = new THREE.Vector3(), gaze = new THREE.Vector3();
addEventListener('keydown', (e) => { if (e.code === 'KeyV') firstKey = !firstKey; });
function tick(dt) {
  dt = Math.min(dt, 1 / 20);
  time += dt;
  const inp = input.read(dt);
  const isIn = cabin.inside(player.feet);
  first += ((firstKey || cabin.threshold(player.feet) ? 1 : 0) - first) * (1 - Math.exp(-6 * dt));
  const fp = first * first * (3 - 2 * first);
  cabin.update(time);
  player.update(dt, inp, follow.yaw);
  // off the ridge and into the fjord, or off the map: he starts again
  if (player.feet.y < 1.5 || Math.max(Math.abs(player.feet.x), Math.abs(player.feet.z)) > EXTENT - 30) place(spawn.x, spawn.z, Math.PI);
  const root = player.visualRoot(dt);
  man.object.position.copy(root);
  man.object.rotation.set(0, player.yaw, 0);
  man.object.updateMatrixWorld(true);
  const local = player.vel.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -player.yaw);
  animator.update(dt, { speed: player.mode === 'move' ? player.speed : Math.hypot(local.x, local.z), moveAngle: player.moveAngle, grounded: player.grounded });
  animator.relaxHands(player.speed);
  animator.uprightTrunk(dt, player.speed, player.grounded && player.mode !== 'jump' && player.mode !== 'air' ? 1 : 0.3);
  const lookW = player.mode === 'move' || player.mode === 'idleExtra' ? THREE.MathUtils.clamp(1 - (player.speed - 1.5) / 2, 0, 1) : 0;
  animator.lookToward(dt, camera.getWorldDirection(new THREE.Vector3()), lookW);
  animator.armClearance(dt);
  if (player.mode === 'move' && !player.strafe) animator.leanInto(dt, player.turnRate, player.speed, player.accelF);
  else animator.leanInto(dt, 0, 0, 0);
  const onGround = player.grounded && player.mode !== 'jump' && player.mode !== 'air';
  animator.placeFeet(dt, (x, z, from) => player.ground(x, z, from, 1.4), root.y, onGround ? 1 : 0);
  man.object.updateMatrixWorld(true);
  holdLantern();
  figure.updateCloak(dt, air, heightAt);
  lantern.update(dt, grip, player.yaw);
  if (!isIn) tracks.update(root, player.yaw, player.speed, onGround);

  // a trunk between the eye and him brings the eye in; over the ground it rises instead
  follow.update(dt, root, inp.look, inp.zoom, (o, d, max) => {
    let hit = player.castRay(o, d, max);
    if (hit != null && o.y + d.y * hit - heightAt(o.x + d.x * hit, o.z + d.z * hit) < 0.5) hit = null;
    const tree = pines.block(o, d, max);
    return tree != null && (hit == null || tree < hit) ? tree : hit;
  }, (x, z) => heightAt(x, z) + 0.55);
  if (fp > 0.002) {
    // the eye comes forward into his head and looks where the mouse has it look
    const cp = Math.cos(follow.pitch), sp = Math.sin(follow.pitch);
    gaze.set(Math.sin(follow.yaw) * cp, -sp, Math.cos(follow.yaw) * cp);
    eyeAt.set(root.x + Math.sin(follow.yaw) * 0.08, root.y + 1.66, root.z + Math.cos(follow.yaw) * 0.08);
    camera.getWorldDirection(outlook).multiplyScalar(6).add(camera.position);
    camera.position.lerp(eyeAt, fp);
    camera.lookAt(outlook.lerp(eyeAt.addScaledVector(gaze, 6), fp));
  }
  // seen from so close the picture is wider, and nothing of him is in it: the lantern's light is, the lantern isn't
  lantern.object.visible = lantern.glow.visible = fp < 0.5;
  camera.fov = 46 + 18 * fp;
  camera.near = 0.3 - 0.2 * fp;
  camera.updateProjectionMatrix();
  man.object.visible = figure.cloakMesh.visible = figure.dabs.visible = fp < 0.5;
  camera.updateMatrixWorld(true);
  renderer.getDrawingBufferSize(size);
  shared.uTime.value = time;
  shared.uPixel.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / size.y;
  shared.uFocus.value.copy(root);
  // the aurora breathes: brighter and dimmer over a minute or so, and the snow under it with it
  shared.uGlow.value.x = 1.0 + 0.2 * Math.sin(time * 0.11) + 0.1 * Math.sin(time * 0.37 + 1.0) + 0.07 * Math.sin(time * 1.1 + 2.0);
  snow.follow(camera.position.x, camera.position.z);
  shade.update(scene, root);
  frame.render(scene, camera);
}

window.lab = {
  THREE, player, follow, camera, input, animator, figure, shared, frame, renderer, timings, counts: { ...snow.counts, ...pines.counts, ...cabin.counts }, cabin, heightAt, crestX, tracks, sky,
  step(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) tick(dt); },
  setInput(fn) { input.override = fn; },
  /** Puts him at (x, z) on the ground, facing (fx, fz), with the eye behind him. */
  teleport(x, z, fx, fz) {
    place(x, z, Math.atan2(fx - x, fz - z));
    follow.yaw = player.yaw; follow.pivot.set(0, 0, 0);
    tick(1 / 60);
  },
  /** A fixed view for stills: eye and what it looks at. Call with nothing to go back to following him. */
  view(eye, target) { follow.free = eye ? { position: new THREE.Vector3(...eye), target: new THREE.Vector3(...target) } : null; },
  /** Moves the clock on without moving him, to see the sky at another moment. */
  wait(seconds) { time += seconds; },
  /** Through his eyes (true) or from behind him (false), as V does. */
  first(on) { firstKey = on; },
  /** His tracks along the crest from z0 to z1, as if he had walked it. */
  trail(z0, z1) { tracks.lay(crestX, z0, z1); },
};

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  frame.resize();
});
say(0.68, 'Mixing paint');
function gpuDone() {
  const gl = renderer.getContext();
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  return new Promise((resolve) => {
    const poll = () => {
      if (gl.clientWaitSync(sync, 0, 0) === gl.TIMEOUT_EXPIRED) return void setTimeout(poll, 4);
      gl.deleteSync(sync);
      resolve();
    };
    poll();
  });
}
if (!capture) {
  renderer.debug.checkShaderErrors = false;
  await renderer.compileAsync(scene, camera);
  lap('shaders');
  say(0.86, 'Mixing paint');
}
for (let i = 0; i < (capture ? 1 : 5); i++) {
  tick(1 / 60);
  if (capture) break;
  await gpuDone();
  say(0.88 + 0.025 * i, 'First strokes');
  await turn();
}
lap('first frame');

let running = false;
let last = 0;
function run() {
  const want = shown && !capture;
  if (want === running) return;
  running = want;
  last = performance.now();
  renderer.setAnimationLoop(want ? () => { const now = performance.now(); tick((now - last) / 1000); last = now; } : null);
}
if (!capture) {
  const hint = document.getElementById('hint');
  hint.textContent = 'Click to look · WASD move · Shift sprint · Space jump · V first person';
  addEventListener('keydown', (e) => { if (e.code === 'KeyH') hint.classList.toggle('off'); });
  setTimeout(() => hint.classList.add('faded'), 9000);
}
loaded = true;
run();
document.getElementById('loading')?.remove();
if (q.has('clean') || capture) document.getElementById('hint')?.remove();
block.ready();
window.lab.ready = true;
window.__block = { ready: true, block, timings, set() {} };
