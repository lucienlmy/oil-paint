// A wanderer in an autumn wood, painted in oils. Third person; walk, run, jump; nothing to do yet but be there.
// Shown with ?scene=autumn (src/scenes.js).
//   ?capture       no clock: window.lab.step(dt, n) advances it (for stills and films)
//   ?quality=low   fewer leaves in the air, no sun in the mist
//   ?shafts=0 ?canvas=0 ?impasto=0..2    parts of the finish, for comparing
import * as THREE from 'three';
import { patchBlock } from 'patch-block';
import recipe from '../recipe.json';
import RAPIER from './figure/rapier/rapier.mjs';
import { createShared, WIND } from './oilpaint/common.js';
import { createBrushSheet } from './oilpaint/brush.js';
import { prepareLand, createLand, heightAt, wayDist, noise, way, START } from './world/land.js';
import { createFloor } from './world/floor.js';
import { createForest } from './world/forest.js';
import { createSky } from './world/sky.js';
import { createLeaves } from './world/leaves.js';
import { createKick } from './world/kick.js';
import { createShade } from './oilpaint/shade.js';
import { createFrame } from './oilpaint/finish.js';
import { createFigure } from './figure/figure.js';
import { Animator } from './figure/animator.js';
import { Player } from './figure/player.js';
import { Input } from './figure/input.js';
import { Follow } from './figure/camera.js';

const q = new URLSearchParams(location.search);
const capture = q.has('capture');
// ?quality wins; otherwise Patch's performance mode, where there is one
const lowQuality = () => (q.get('quality') ?? window.patch?.quality ?? 'high') === 'low';

// Patch's page talks to the demo through this. There are no controls yet; it carries loading, ready and hiding.
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

const shared = createShared();
shared.tBrush.value = createBrushSheet();
if (q.has('impasto')) shared.uImpasto.value = +q.get('impasto');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.2, 2000);
// Listened for from the start, not once loaded: the page may go fullscreen while the world is still being made.
// The frame's target joins in once it exists.
let fitFrame = () => {};
function fitView() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  fitFrame();
}
addEventListener('resize', fitView);
lap('start');
// the wanderer's files are the large ones: they start coming down now, while the wood is made
let told = 0;
const say = (value, label) => { told = Math.max(told, value); block.progress(told, label); };
const figureComing = createFigure(shared, (done) => say(0.05 + 0.55 * done, 'Fetching the wanderer'));

const turn = () => new Promise((resolve) => setTimeout(resolve, 0));
await prepareLand((done) => { say(0.03 + 0.07 * done, 'Laying the ground'); return turn(); });
const land = createLand(shared);
lap('land');
say(0.1, 'Growing the wood');
await turn();
const forest = createForest(shared);
lap('forest');
const floor = createFloor(shared);
const sky = createSky(shared);
const leaves = createLeaves(shared, 2400);
const shade = createShade(renderer, shared, forest.shade);
lap('shade');
say(0.25, 'Fetching the wanderer');
await turn();
const kick = createKick(shared);
scene.add(sky.group, land.mesh, forest.group, floor.group, leaves.mesh, kick.mesh);

// --- the ground and the trunks, for his feet ---
await RAPIER.init();
const physics = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
{
  const f = land.heightField();
  physics.createCollider(RAPIER.ColliderDesc.heightfield(f.cells, f.cells, f.heights, { x: 2 * f.half, y: 1, z: 2 * f.half }));
  for (const t of forest.colliders) physics.createCollider(RAPIER.ColliderDesc.cylinder(5, t.r).setTranslation(t.x, t.y + 4.5, t.z));
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
const input = new Input(renderer.domElement, { pads: !capture && !q.has('nopad') });
physics.step();
lap('figure');

const frame = createFrame(renderer, shared);
fitFrame = () => frame.resize();
frame.uniforms.uCanvas.value = q.has('canvas') ? +q.get('canvas') : 1;
/** Low quality drops the sun in the mist and most of the falling leaves. */
function applyQuality() {
  const low = lowQuality();
  frame.uniforms.uShafts.value = q.has('shafts') ? +q.get('shafts') : low ? 0 : 1;
  leaves.mesh.geometry.instanceCount = low ? 900 : 2400;
}
applyQuality();
window.patch?.addEventListener?.('qualitychange', applyQuality);

// the wind as the cloak feels it: the same bands the leaves move in
const wind = { x: WIND.x, z: WIND.y };
let time = 0;
function air(x, y, z, out) {
  const along = x * wind.x + z * wind.z, across = -x * wind.z + z * wind.x;
  const gust = THREE.MathUtils.clamp(0.5 + 0.8 * noise((along - time * 4) / 40, across / 90) + 0.3 * noise((along - time * 6.5) / 11, across / 17), 0, 1);
  const speed = 0.4 + 3.2 * gust * gust;
  return out.set(wind.x * speed, 0.25 * Math.sin(time * 2.3 + x) * gust, wind.z * speed);
}

function respawn() {
  const half = player.halfHeight();
  player.body.setTranslation({ x: spawn.x, y: spawn.y + player.t.radius + half + 0.05, z: spawn.z }, true);
  physics.propagateModifiedBodyPositionsToColliders();
  player.vel.set(0, 0, 0); player.speed = 0; player.mode = 'move';
  player.feet.copy(spawn); player.prevFeet.copy(spawn); player.visualY = spawn.y; player.grounded = true;
  animator.lock = null; animator.lockOff = null;
  animator.enter(animator.locoState({ strafe: false }), 0.1);
}

const size = new THREE.Vector2();
function tick(dt) {
  dt = Math.min(dt, 1 / 20);
  time += dt;
  const inp = input.read(dt);
  player.update(dt, inp, follow.yaw);
  // the wood has no wall: far from the way he is turned gently back, and under the world he starts again
  if (player.feet.y < heightAt(player.feet.x, player.feet.z) - 6 || wayDist(player.feet.x, player.feet.z) > 78) respawn();
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
  figure.updateCloak(dt, air, heightAt);
  kick.update(dt, root, { x: Math.sin(player.yaw), z: Math.cos(player.yaw) }, player.speed, onGround, heightAt);

  follow.update(dt, root, inp.look, inp.zoom, (o, d, max) => player.castRay(o, d, max), heightAt);
  camera.updateMatrixWorld(true);
  renderer.getDrawingBufferSize(size);
  shared.uTime.value = time;
  shared.uPixel.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / size.y;
  shared.uFocus.value.copy(root);
  floor.follow(camera.position.x, camera.position.z);
  shade.update(scene, root);
  frame.render(scene, camera);
}

window.lab = {
  THREE, player, follow, camera, input, animator, figure, shared, frame, renderer, timings, counts: forest.counts, heightAt, respawn, way,
  step(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) tick(dt); },
  setInput(fn) { input.override = fn; },
  /** Puts him at (x, z) on the ground, facing (fx, fz), with the eye behind him. */
  teleport(x, z, fx, fz) {
    const y = heightAt(x, z), half = player.halfHeight();
    player.body.setTranslation({ x, y: y + player.t.radius + half + 0.05, z }, true);
    physics.propagateModifiedBodyPositionsToColliders();
    player.feet.set(x, y, z); player.prevFeet.copy(player.feet); player.visualY = y;
    player.vel.set(0, 0, 0); player.speed = 0; player.mode = 'move'; player.grounded = true;
    player.yaw = player.lastYaw = Math.atan2(fx - x, fz - z);
    follow.yaw = player.yaw; follow.pivot.set(0, 0, 0);
    animator.lock = null; animator.lockOff = null;
    animator.enter(animator.locoState({ strafe: false }), 0.05);
    tick(1 / 60);
  },
  /** A fixed view for stills: eye and what it looks at. Call with nothing to go back to following him. */
  view(eye, target) { follow.free = eye ? { position: new THREE.Vector3(...eye), target: new THREE.Vector3(...target) } : null; },
};

// --- warming up: every shader is built and drawn once, and the GPU has caught up, before anyone is let in ---
say(0.68, 'Mixing paint');
/** Resolves when the GPU has done everything it has been sent: JavaScript finishing isn't the GPU finishing. */
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

// Draws while the page says the demo can be seen, and not at all while it can't.
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
  addEventListener('keydown', (e) => { if (e.code === 'KeyH') hint.classList.toggle('off'); });
  setTimeout(() => hint.classList.add('faded'), 9000);
}
fitView();
loaded = true;
run();
document.getElementById('loading')?.remove();
if (q.has('clean') || capture) document.getElementById('hint')?.remove();
block.ready();
window.lab.ready = true;
// for the measuring tools
window.__block = { ready: true, block, timings, set() {} };
