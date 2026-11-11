// The cabin under the horn: where the walk ends. Outside it is a low log house under a load of snow, with a stone
// chimney and lit windows; from the knoll, two hundred metres off, its window is one warm spark at the foot of the
// rock. Inside is everything the night is not: a fire, a red rug, a quilt, bread on the table.
//
// It is built in its own measure, metres from the middle of its floor: +x east, +z south (the side he comes to,
// where the door is), y up from the floor. Outer walls stand at x = +-3.2, z = +-2.6; inner at +-3.0, +-2.4.
//
// Inside there is no room for an eye that follows behind him, so from the doorstep on the picture is seen through
// his own eyes (src/night/main.js): the whole room stands round him, roof and all.
import * as THREE from 'three';
import { dabMaterial, dabGeometry, dabMesh } from '../oilpaint/dabs.js';
import { NIGHT } from './paint.js';
import { createKit } from './kit.js';
import { paintDetails } from './details.js';
import { paintRoof } from './roof.js';
import { CABIN } from './land.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function createCabin(shared) {
  const origin = [CABIN.x, CABIN.y, CABIN.z];
  const world = (x, y, z) => V(CABIN.x + x, CABIN.y + y, CABIN.z + z);
  // the lights: the fire, the candle on the table, and the three openings that let their light out onto the snow
  const FIRE = world(-2.4, 0.6, 0), CANDLE = world(0.6, 1.03, 0.5);
  shared.uFire = { value: new THREE.Vector4(FIRE.x, FIRE.y, FIRE.z, 1) };
  shared.uCandle = { value: new THREE.Vector4(CANDLE.x, CANDLE.y, CANDLE.z, 0.5) };
  shared.uPane = { value: world(-0.3, 1.45, -2.4) }; // the north window, where the night comes in
  shared.uWarm.value[0].set(...world(-1.15, 1.3, 2.75).toArray(), 0.75);
  shared.uWarm.value[1].set(...world(1.75, 1.1, 2.75).toArray(), 1.1);
  shared.uWarm.value[2].set(...world(-0.3, 1.3, -2.75).toArray(), -0.7);
  shared.uRoom.value.set(CABIN.x, CABIN.z, 3.15, 2.55);

  // ================= outside =================
  const out = createKit(shared, {
    origin, seed: 811, haze: true, order: 3, head: NIGHT,
    palettes: {
      log: { l: [0.2, 0.19, 0.2], m: [0.085, 0.075, 0.09], s: [0.028, 0.026, 0.045], own: [0.55, 0.36, 0.2] },
      snow: { l: [0.42, 0.6, 0.74], own: [0.95, 0.95, 0.95] },
      stone: { l: [0.22, 0.26, 0.3], m: [0.09, 0.11, 0.14], s: [0.03, 0.04, 0.06], own: [0.5, 0.45, 0.4] },
      frame: { l: [0.13, 0.12, 0.13], m: [0.06, 0.055, 0.065], s: [0.022, 0.02, 0.035], own: [0.4, 0.26, 0.15] },
      door: { l: [0.2, 0.17, 0.17], m: [0.09, 0.075, 0.08], s: [0.03, 0.026, 0.04], own: [0.62, 0.36, 0.18] },
      ice: { l: [0.5, 0.75, 0.85], m: [0.25, 0.45, 0.6], s: [0.1, 0.2, 0.35], own: [1.0, 0.9, 0.7] },
      pane: { l: [1.0, 0.7, 0.28], glow: true },
    },
    light: /* glsl */ `
      vec3 kitPaint(vec3 P, vec3 Nn, int k, float tone, float r) {
        float x = moonOn(P, Nn);
        // snow is never one white: it is packed here and crusted there, and a stroke of it may be laid darker
        vec3 c = k == 1 ? snowPaint(x, r, 0.7 * auroraOn(P.xz, Nn), 0.15 + 0.6 * texture(tNoise, P.xz / 2.7 + P.y * 0.3).r) * mix(1.0, tone, 0.75) : paint3(PAL_L[k], PAL_M[k], PAL_S[k], x, r) * tone;
        c = lampOn(c, PAL_O[k], P, Nn);
        vec3 lit = PAL_L[k] * tone * (0.82 + 0.18 * sin(uTime * 6.0 + P.x * 7.0 + P.y * 5.0));
        return PAL_G[k] > 0.5 ? lit : c;
      }`,
  });
  const logs = { rows: 0.27, stroke: [0.27, 1.1], detail: true };
  // the four walls, in logs, with the window and the door cut out of them
  out.quad([-3.2, 0, 2.6], [6.4, 0, 0], [0, 2.4, 0], 'log', { ...logs, holes: [[0.234, 0.406, 0.417, 0.792], [0.695, 0.852, 0, 0.833]] });
  out.quad([3.2, 0, -2.6], [-6.4, 0, 0], [0, 2.4, 0], 'log', { ...logs, holes: [[0.453, 0.641, 0.417, 0.792]] });
  out.quad([-3.2, 0, -2.6], [0, 0, 5.2], [0, 2.4, 0], 'log', logs);
  out.quad([3.2, 0, 2.6], [0, 0, -5.2], [0, 2.4, 0], 'log', { ...logs, holes: [[0.25, 0.481, 0.417, 0.792]] });
  // the east window, over the fjord
  out.quad([3.16, 1.0, 1.3], [0, 0, -1.2], [0, 0.9, 0], 'pane', { stroke: [0.14, 0.22], density: 1.3 });
  out.box(3.21, 1.45, 0.7, 0.05, 0.9, 0.045, 'frame'); out.box(3.21, 1.45, 0.7, 0.05, 0.045, 1.2, 'frame');
  out.box(3.21, 0.97, 0.7, 0.12, 0.07, 1.34, 'frame'); out.box(3.21, 1.93, 0.7, 0.1, 0.07, 1.34, 'frame');
  out.box(3.21, 1.45, 1.335, 0.1, 0.96, 0.07, 'frame'); out.box(3.21, 1.45, 0.065, 0.1, 0.96, 0.07, 'frame');
  out.box(3.3, 2.0, 0.7, 0.2, 0.09, 1.4, 'snow', { stroke: [0.1, 0.3] });
  out.tri([-3.2, 2.4, -2.6], [-3.2, 2.4, 2.6], [-3.2, 4.1, 0], 'log', { stroke: [0.24, 0.8], grain: [0, 0, 1] });
  out.tri([3.2, 2.4, 2.6], [3.2, 2.4, -2.6], [3.2, 4.1, 0], 'log', { stroke: [0.24, 0.8], grain: [0, 0, 1] });
  // the roof: boards, and the snow lying on them in drifts (roof.js)
  paintRoof(out);
  // the chimney, up the west wall, with its own cap of snow
  out.box(-3.65, 2.45, 0, 0.9, 4.9, 1.0, 'stone', { stroke: [0.17, 0.26] });
  out.box(-3.65, 4.99, 0, 1.02, 0.18, 1.12, 'snow', { stroke: [0.2, 0.4] });
  // windows: the lit glass, and bars across it
  for (const [x0, z, face] of [[-1.7, 2.56, 1], [0.3, -2.56, -1]]) {
    out.quad([x0, 1.0, z], [1.1 * face, 0, 0], [0, 0.9, 0], 'pane', { stroke: [0.14, 0.22], density: 1.3 });
    const mid = x0 + 0.55 * face, zz = z + 0.05 * face;
    out.box(mid, 1.45, zz, 0.045, 0.9, 0.05, 'frame'); out.box(mid, 1.45, zz, 1.1, 0.045, 0.05, 'frame');
    out.box(mid, 0.97, zz, 1.24, 0.07, 0.12, 'frame'); out.box(mid, 1.93, zz, 1.24, 0.07, 0.1, 'frame');
    out.box(x0 - 0.035 * face, 1.45, zz, 0.07, 0.96, 0.1, 'frame'); out.box(x0 + 1.135 * face, 1.45, zz, 0.07, 0.96, 0.1, 'frame');
    out.box(mid, 2.0, z + 0.1 * face, 1.3, 0.09, 0.2, 'snow', { stroke: [0.1, 0.3] }); // snow on the head of the frame
  }
  // the doorway, and the door standing open against the wall
  out.box(1.2, 1.0, 2.62, 0.1, 2.0, 0.14, 'frame'); out.box(2.3, 1.0, 2.62, 0.1, 2.0, 0.14, 'frame'); out.box(1.75, 2.05, 2.62, 1.2, 0.1, 0.14, 'frame');
  out.box(2.42, 1.0, 3.12, 0.07, 1.96, 1.0, 'door', { grain: 'y', stroke: [0.16, 0.7] });
  out.box(1.75, 0.03, 3.0, 1.5, 0.06, 0.7, 'stone', { stroke: [0.16, 0.3] });
  // a stack of split wood against the south wall, snow on it
  out.box(-2.6, 0.45, 2.85, 1.1, 0.9, 0.45, 'door', { stroke: [0.13, 0.16], density: 1.4 });
  out.box(-2.6, 0.95, 2.87, 1.2, 0.14, 0.55, 'snow', { stroke: [0.2, 0.4] });
  // snow lying on the sills
  out.box(-0.3, 1.04, -2.68, 1.24, 0.09, 0.15, 'snow', { stroke: [0.1, 0.3] }); out.box(-1.15, 1.04, 2.68, 1.24, 0.09, 0.15, 'snow', { stroke: [0.1, 0.3] });
  out.box(3.28, 1.04, 0.7, 0.15, 0.09, 1.3, 'snow', { stroke: [0.1, 0.3] });
  const outside = out.build();

  // ================= inside =================
  const interior = (seed) => createKit(shared, {
    origin, seed, order: 3, head: NIGHT,
    palettes: {
      wall: { l: [0.8, 0.46, 0.2], m: [0.42, 0.2, 0.11], s: [0.13, 0.062, 0.065] },
      floor: { l: [0.72, 0.43, 0.2], m: [0.37, 0.2, 0.11], s: [0.11, 0.06, 0.06] },
      stone: { l: [0.74, 0.62, 0.5], m: [0.38, 0.3, 0.27], s: [0.12, 0.1, 0.12] },
      soot: { l: [0.2, 0.1, 0.07], m: [0.08, 0.045, 0.04], s: [0.03, 0.02, 0.03] },
      wood: { l: [0.62, 0.35, 0.16], m: [0.31, 0.16, 0.09], s: [0.09, 0.05, 0.05] },
      iron: { l: [0.32, 0.27, 0.26], m: [0.12, 0.1, 0.12], s: [0.04, 0.035, 0.05] },
      crimson: { l: [0.86, 0.17, 0.12], m: [0.5, 0.07, 0.09], s: [0.18, 0.03, 0.07] },
      ochre: { l: [0.96, 0.7, 0.25], m: [0.6, 0.4, 0.14], s: [0.2, 0.13, 0.08] },
      teal: { l: [0.2, 0.56, 0.55], m: [0.1, 0.3, 0.34], s: [0.04, 0.11, 0.16] },
      blue: { l: [0.28, 0.4, 0.76], m: [0.14, 0.2, 0.45], s: [0.05, 0.07, 0.2] },
      green: { l: [0.32, 0.6, 0.3], m: [0.14, 0.32, 0.17], s: [0.05, 0.12, 0.09] },
      cream: { l: [0.98, 0.9, 0.72], m: [0.66, 0.56, 0.45], s: [0.24, 0.2, 0.22] },
      fur: { l: [0.92, 0.56, 0.24], m: [0.52, 0.28, 0.14], s: [0.17, 0.09, 0.07] },
      ember: { l: [1.0, 0.42, 0.07], glow: true },
      flame: { l: [1.0, 0.86, 0.5], glow: true },
      umbra: { l: [0.26, 0.13, 0.1], m: [0.13, 0.065, 0.065], s: [0.05, 0.028, 0.045] }, // a shadow on the floor
      glint: { l: [1.0, 0.93, 0.7], glow: 2 }, // the fire given back by glass and iron
      frost: { l: [0.5, 0.72, 0.82], glow: 2 },
      moon: { l: [0.36, 0.44, 0.46], glow: 2 }, // moonlight lying on the boards
    },
    light: /* glsl */ `
      uniform vec4 uFire; uniform vec4 uCandle; uniform vec3 uPane;
      // How lit a spot of the room is: by the fire, the candle, and the lantern he brings in.
      float roomLight(vec3 P, vec3 Nn) {
        vec3 to = uFire.xyz - P;
        float d2 = dot(to, to);
        float f = uFire.w * clamp(dot(Nn, to) * inversesqrt(d2 + 1e-4) * 0.75 + 0.38, 0.0, 1.0) / (0.5 + d2 * 0.17);
        to = uCandle.xyz - P; d2 = dot(to, to);
        f += uCandle.w * clamp(dot(Nn, to) * inversesqrt(d2 + 1e-4) * 0.7 + 0.4, 0.0, 1.0) / (0.2 + d2 * 1.2);
        return clamp(0.06 + f + lampAt(P, Nn) * 0.7, 0.0, 1.0);
      }
      vec3 kitPaint(vec3 P, vec3 Nn, int k, float tone, float r) {
        vec3 lit = PAL_L[k] * tone * (PAL_G[k] > 1.5 ? 1.0 : 0.8 + 0.2 * sin(uTime * 9.0 + P.z * 23.0 + P.y * 17.0));
        float x = roomLight(P, Nn);
        vec3 c = paint3(PAL_L[k], PAL_M[k], PAL_S[k], x, r) * tone;
        // the night comes in at the north window, green and cool, where the fire does not reach
        vec3 to = uPane - P;
        float night = clamp(dot(Nn, to) * 0.5 + 0.5, 0.0, 1.0) / (1.0 + dot(to, to) * 0.5);
        c += vec3(0.01, 0.085, 0.07) * night * (1.0 - x) * uGlow.x;
        return PAL_G[k] > 0.5 ? lit : c;
      }`,
  });
  // the room, and (apart, since it is left off with the roof when the room is looked into) its ceiling
  const room = interior(4127), lid = interior(77);
  const boards = { rows: 0.2, stroke: [0.2, 1.2], detail: true }, inlogs = { rows: 0.27, stroke: [0.27, 1.1], detail: true };
  room.quad([-3.0, 0.02, 2.4], [6, 0, 0], [0, 0, -4.8], 'floor', boards);
  room.quad([-3.0, 0, -2.4], [6, 0, 0], [0, 2.4, 0], 'wall', { ...inlogs, holes: [[0.35, 0.55, 0.417, 0.792]] });
  room.quad([3.0, 0, 2.4], [-6, 0, 0], [0, 2.4, 0], 'wall', { ...inlogs, holes: [[0.125, 0.292, 0, 0.833], [0.6, 0.783, 0.417, 0.792]] });
  room.quad([-3.0, 0, 2.4], [0, 0, -4.8], [0, 2.4, 0], 'wall', inlogs);
  room.quad([3.0, 0, -2.4], [0, 0, 4.8], [0, 2.4, 0], 'wall', { ...inlogs, holes: [[0.521, 0.771, 0.417, 0.792]] });
  // the east window from within: frame, sill, a candle, red curtains
  room.box(2.96, 1.45, 0.7, 0.05, 0.9, 0.04, 'wood'); room.box(2.96, 1.45, 0.7, 0.05, 0.04, 1.2, 'wood');
  room.box(2.92, 0.97, 0.7, 0.2, 0.06, 1.36, 'wood', { grain: 'z' }); room.box(2.96, 1.93, 0.7, 0.08, 0.07, 1.32, 'wood');
  room.box(2.96, 1.45, 0.07, 0.08, 0.96, 0.07, 'wood'); room.box(2.96, 1.45, 1.33, 0.08, 0.96, 0.07, 'wood');
  room.box(2.91, 2.04, 0.7, 0.035, 0.035, 1.9, 'iron');
  for (const z0 of [-0.26, 1.3]) room.quad([2.94, 0.86, z0], [0, 0, 0.36], [0, 1.17, 0], 'crimson', { grain: 'v', stroke: [0.06, 0.4] });
  room.round(2.88, 1.07, 0.38, 0.022, 0.14, 'cream', { stroke: [0.03, 0.06] }); room.stroke(V(2.88, 1.19, 0.38), V(-0.9, 0.2, 0.3).normalize(), V(0, 1, 0), 0.045, 0.09, 'flame', 1, 0.01);
  room.tri([-3.0, 2.4, 2.4], [-3.0, 2.4, -2.4], [-3.0, 3.95, 0], 'wall', { stroke: [0.24, 0.8], grain: [0, 0, 1] });
  room.tri([3.0, 2.4, -2.4], [3.0, 2.4, 2.4], [3.0, 3.95, 0], 'wall', { stroke: [0.24, 0.8], grain: [0, 0, 1] });
  lid.quad([3.0, 2.4, 2.4], [-6, 0, 0], [0, 1.55, -2.4], 'wood', { ...boards, tone: 0.7 });
  lid.quad([-3.0, 2.4, -2.4], [6, 0, 0], [0, 1.55, 2.4], 'wood', { ...boards, tone: 0.7 });

  // --- the hearth, on the west wall ---
  const stones = { stroke: [0.15, 0.22] };
  room.box(-2.8, 0.6, -0.78, 0.4, 1.2, 0.34, 'stone', stones); room.box(-2.8, 0.6, 0.78, 0.4, 1.2, 0.34, 'stone', stones);
  room.box(-2.8, 1.36, 0, 0.4, 0.32, 1.9, 'stone', stones);
  room.box(-2.86, 2.0, 0, 0.28, 0.96, 1.5, 'stone', stones);
  room.box(-2.5, 0.04, 0, 1.0, 0.08, 2.0, 'stone', { stroke: [0.2, 0.3] });
  room.quad([-2.97, 0.08, 0.61], [0, 0, -1.22], [0, 1.12, 0], 'soot', { stroke: [0.14, 0.24] });
  const lying = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  room.round(-2.74, 0.17, -0.05, 0.065, 0.62, 'soot', { turn: lying, grain: V(0, 0, 1), stroke: [0.06, 0.2] });
  room.round(-2.66, 0.2, 0.08, 0.055, 0.55, 'ember', { turn: new THREE.Matrix4().makeRotationX(Math.PI / 2).premultiply(new THREE.Matrix4().makeRotationY(0.5)), grain: V(0, 0, 1), stroke: [0.05, 0.12] });
  room.box(-2.7, 0.1, 0.0, 0.34, 0.04, 0.6, 'ember', { stroke: [0.05, 0.08], density: 1.5 });
  room.box(-2.68, 1.55, 0, 0.6, 0.06, 2.06, 'wood', { grain: 'z', stroke: [0.1, 0.5] }); // the mantel, and what stands on it
  room.round(-2.66, 1.67, -0.72, 0.075, 0.18, 'teal', { stroke: [0.05, 0.1] });
  room.round(-2.68, 1.65, -0.48, 0.055, 0.14, 'ochre', { stroke: [0.04, 0.08] });
  room.round(-2.66, 1.7, 0.28, 0.06, 0.24, 'blue', { stroke: [0.04, 0.1], top: 0.03 });
  room.round(-2.66, 1.68, 0.7, 0.024, 0.2, 'cream', { stroke: [0.03, 0.08] });
  room.stroke(V(-2.66, 1.83, 0.7), V(1, 0, 0), V(0, 1, 0), 0.05, 0.1, 'flame', 1, 0.01);
  room.add(new THREE.SphereGeometry(0.15, 9, 7), room.place(-2.22, 0.22, 0.78, 0, [1, 0.85, 1]), 'iron', { smooth: true, stroke: [0.06, 0.1] }); // the kettle
  room.round(-2.22, 0.37, 0.78, 0.05, 0.04, 'iron', { stroke: [0.04, 0.05] });
  // split wood stacked north of it
  for (let i = 0; i < 9; i++) {
    const row = i < 4 ? 0 : i < 7 ? 1 : 2, col = i < 4 ? i : i < 7 ? i - 4 : i - 7;
    room.round(-2.72, 0.09 + row * 0.15, -1.3 - col * 0.17 - row * 0.085, 0.078, 0.5, i % 3 ? 'wood' : 'ochre', { turn: new THREE.Matrix4().makeRotationZ(Math.PI / 2), grain: V(1, 0, 0), stroke: [0.06, 0.2], tone: 0.8 + 0.3 * room.rand() });
  }
  // pans hung on the wall above the wood
  room.round(-2.955, 1.6, -1.35, 0.15, 0.03, 'iron', { turn: new THREE.Matrix4().makeRotationZ(Math.PI / 2), stroke: [0.05, 0.1] });
  room.round(-2.955, 1.42, -1.75, 0.11, 0.03, 'iron', { turn: new THREE.Matrix4().makeRotationZ(Math.PI / 2), stroke: [0.05, 0.1] });

  // --- the rug before the fire: borders inside borders ---
  const flat = (cx, cz, sx, sz, y, pal, opts) => room.quad([cx - sx / 2, y, cz + sz / 2], [sx, 0, 0], [0, 0, -sz], pal, opts);
  const weave = { stroke: [0.06, 0.15] };
  flat(-0.95, 0.1, 2.3, 1.6, 0.03, 'ochre', weave); flat(-0.95, 0.1, 2.1, 1.4, 0.036, 'teal', weave);
  flat(-0.95, 0.1, 1.86, 1.16, 0.042, 'crimson', weave); flat(-0.95, 0.1, 0.8, 0.44, 0.048, 'ochre', weave); flat(-0.95, 0.1, 0.5, 0.2, 0.054, 'blue', weave);
  // and the cat asleep on it
  room.add(new THREE.SphereGeometry(1, 10, 7), room.place(-1.55, 0.16, 0.42, 0.5, [0.3, 0.13, 0.2]), 'fur', { smooth: true, stroke: [0.05, 0.1], grain: V(1, 0, 0.4) });
  room.add(new THREE.SphereGeometry(0.085, 8, 6), room.place(-1.33, 0.17, 0.57), 'fur', { smooth: true, stroke: [0.04, 0.06] });
  for (const dz of [-0.045, 0.045]) room.add(new THREE.ConeGeometry(0.03, 0.06, 5), room.place(-1.32, 0.26, 0.57 + dz), 'fur', { stroke: [0.02, 0.04] });

  // --- a chair turned to the fire, a blanket over its back ---
  room.box(-1.45, 0.42, -1.0, 0.5, 0.06, 0.5, 'wood', { grain: 'x' });
  room.box(-1.2, 0.83, -1.0, 0.06, 0.82, 0.5, 'wood', { grain: 'y' });
  for (const [dx, dz] of [[-0.21, -0.21], [-0.21, 0.21], [0.21, -0.21], [0.21, 0.21]]) room.box(-1.45 + dx, 0.2, -1.0 + dz, 0.05, 0.4, 0.05, 'wood', { grain: 'y' });
  room.box(-1.2, 1.0, -1.0, 0.1, 0.5, 0.54, 'crimson', { stroke: [0.07, 0.16] }); room.box(-1.2, 0.86, -1.0, 0.105, 0.07, 0.545, 'ochre', { stroke: [0.05, 0.12] });

  // --- the table: a candle, bread, a bowl, a mug, a book left open ---
  room.box(0.9, 0.76, 0.6, 1.3, 0.06, 0.8, 'wood', { grain: 'x', stroke: [0.1, 0.5] });
  for (const [dx, dz] of [[-0.57, -0.32], [-0.57, 0.32], [0.57, -0.32], [0.57, 0.32]]) room.box(0.9 + dx, 0.365, 0.6 + dz, 0.07, 0.73, 0.07, 'wood', { grain: 'y' });
  room.round(0.6, 0.89, 0.5, 0.024, 0.2, 'cream', { stroke: [0.03, 0.08] });
  room.stroke(V(0.6, 1.04, 0.5), V(0.6, 0.3, 0.7).normalize(), V(0, 1, 0), 0.05, 0.1, 'flame', 1, 0.01);
  room.round(1.15, 0.825, 0.72, 0.13, 0.07, 'teal', { top: 0.15, stroke: [0.05, 0.09] });
  room.box(0.95, 0.845, 0.38, 0.28, 0.11, 0.15, 'ochre', { stroke: [0.05, 0.09], rotY: 0.4 });
  room.round(1.32, 0.84, 0.42, 0.045, 0.1, 'crimson', { stroke: [0.03, 0.06] });
  flat(0.47, 0.82, 0.17, 0.24, 0.795, 'cream', { stroke: [0.04, 0.08] }); flat(0.66, 0.82, 0.17, 0.24, 0.797, 'cream', { stroke: [0.04, 0.08], tone: 0.9 });
  room.round(0.95, 0.225, 1.38, 0.17, 0.45, 'wood', { stroke: [0.07, 0.2] }); room.round(-0.05, 0.225, 0.95, 0.17, 0.45, 'wood', { stroke: [0.07, 0.2] });

  // --- the bed along the north wall, under a quilt of patches ---
  room.box(1.95, 0.26, -1.86, 2.0, 0.52, 1.0, 'wood', { grain: 'x', stroke: [0.1, 0.5] });
  room.box(2.94, 0.62, -1.86, 0.08, 1.24, 1.0, 'wood', { grain: 'z' });
  room.box(2.6, 0.61, -1.86, 0.5, 0.15, 0.76, 'cream', { stroke: [0.08, 0.16] });
  const patches = ['crimson', 'ochre', 'teal', 'cream', 'blue', 'green', 'crimson', 'blue', 'ochre', 'green', 'cream', 'teal', 'ochre', 'crimson', 'blue'];
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 3; j++) flat(1.09 + i * 0.28, -2.19 + j * 0.333, 0.28, 0.333, 0.535 + 0.002 * ((i + j) % 2), patches[i * 3 + j], { stroke: [0.06, 0.12] });
    room.quad([0.95 + i * 0.28, 0.2, -1.355], [0.28, 0, 0], [0, 0.335, 0], patches[(i * 3 + 7) % 15], { stroke: [0.06, 0.12] }); // where it hangs down the side
  }

  // --- shelves on the north wall: books and jars ---
  for (const y of [1.25, 1.75]) {
    room.box(-1.97, y, -2.28, 1.46, 0.04, 0.22, 'wood', { grain: 'x' });
    const colours = ['crimson', 'blue', 'green', 'ochre', 'cream', 'teal'];
    for (let x = -2.64, i = 0; x < (y > 1.5 ? -1.75 : -1.4); i++) {
      const w = 0.045 + 0.035 * room.rand(), h = 0.2 + 0.09 * room.rand();
      room.box(x + w / 2, y + 0.02 + h / 2, -2.27, w, h, 0.16, colours[Math.floor(room.rand() * 6)], { grain: 'y', stroke: [0.04, 0.12] });
      x += w + 0.004;
    }
  }
  room.round(-1.55, 1.87, -2.27, 0.07, 0.2, 'teal', { stroke: [0.04, 0.09] }); room.round(-1.37, 1.84, -2.27, 0.055, 0.14, 'ochre', { stroke: [0.04, 0.08] });

  // --- the north window: its frame, a sill, red curtains drawn back; the south one beside the door ---
  for (const [mid, z, face] of [[-0.3, -2.36, 1], [-1.15, 2.36, -1]]) {
    room.box(mid, 1.45, z, 0.04, 0.9, 0.05, 'wood'); room.box(mid, 1.45, z, 1.2, 0.04, 0.05, 'wood');
    room.box(mid, 0.97, z + 0.04 * face, 1.36, 0.06, 0.2, 'wood', { grain: 'x' }); room.box(mid, 1.93, z, 1.32, 0.07, 0.08, 'wood');
    room.box(mid - 0.63, 1.45, z, 0.07, 0.96, 0.08, 'wood'); room.box(mid + 0.63, 1.45, z, 0.07, 0.96, 0.08, 'wood');
    room.box(mid, 2.04, z + 0.05 * face, 1.9, 0.035, 0.035, 'iron');
    for (const side of [-1, 1]) {
      // each hangs from the window's edge outward, and faces into the room
      const left = Math.min(mid + side * 0.6, mid + side * 0.96), from = face > 0 ? left : left + 0.36;
      room.quad([from, 0.86, z + 0.06 * face], [0.36 * face, 0, 0], [0, 1.17, 0], 'crimson', { grain: 'v', stroke: [0.06, 0.4] });
    }
  }
  // two candles on the sill, against the night
  for (const x of [-0.72, 0.1]) { room.round(x, 1.07, -2.26, 0.022, 0.14, 'cream', { stroke: [0.03, 0.06] }); room.stroke(V(x, 1.19, -2.26), V(0.3, 0.2, 0.9).normalize(), V(0, 1, 0), 0.045, 0.09, 'flame', 1, 0.01); }

  // --- a dresser in the south-west corner, plates stood along its shelves, jars on top ---
  room.box(-2.74, 0.45, 1.75, 0.5, 0.9, 1.15, 'wood', { grain: 'z', stroke: [0.1, 0.4] });
  room.box(-2.86, 1.4, 1.75, 0.26, 1.0, 1.15, 'wood', { grain: 'y', stroke: [0.1, 0.4], tone: 0.8 });
  for (const y of [1.18, 1.56]) {
    room.box(-2.72, y, 1.75, 0.3, 0.035, 1.12, 'wood', { grain: 'z' });
    for (const z of [1.33, 1.61, 1.89, 2.17]) room.round(-2.69, y + 0.15, z, 0.115, 0.025, room.rand() < 0.3 ? 'teal' : 'cream', { turn: new THREE.Matrix4().makeRotationZ(Math.PI / 2 - 0.2), stroke: [0.05, 0.08] });
  }
  room.round(-2.76, 2.0, 1.4, 0.08, 0.2, 'green', { stroke: [0.04, 0.09] }); room.round(-2.76, 1.97, 1.72, 0.065, 0.14, 'crimson', { stroke: [0.04, 0.08] }); room.round(-2.76, 2.02, 2.05, 0.07, 0.24, 'ochre', { stroke: [0.04, 0.1], top: 0.035 });
  // a clock on the chimney breast
  room.round(-2.71, 2.05, 0, 0.19, 0.03, 'cream', { turn: new THREE.Matrix4().makeRotationZ(Math.PI / 2), stroke: [0.05, 0.08] });
  room.round(-2.715, 2.05, 0, 0.215, 0.022, 'wood', { turn: new THREE.Matrix4().makeRotationZ(Math.PI / 2), stroke: [0.03, 0.08], tone: 0.7 });
  // herbs hung to dry from the mantel's ends
  for (const [z, pal] of [[-0.95, 'green'], [0.93, 'ochre'], [1.02, 'green']]) room.add(new THREE.ConeGeometry(0.07, 0.3, 6), room.place(-2.5, 1.36, z).multiply(new THREE.Matrix4().makeRotationX(Math.PI)), pal, { stroke: [0.03, 0.1], grain: V(0, 1, 0) });

  // --- over the bed: pictures, and a coat and scarf on their pegs ---
  const picture = (x, y, w, h, pal, inner) => { room.box(x, y, -2.375, w, h, 0.03, 'wood', { tone: 0.75 }); room.quad([x - w / 2 + 0.04, y - h / 2 + 0.04, -2.355], [w - 0.08, 0, 0], [0, h - 0.08, 0], pal, { stroke: [0.04, 0.08] }); room.quad([x - w / 4, y - h / 4, -2.35], [w / 2, 0, 0], [0, h / 3, 0], inner, { stroke: [0.04, 0.07] }); };
  picture(1.35, 1.72, 0.5, 0.4, 'blue', 'cream'); picture(1.95, 1.8, 0.34, 0.44, 'ochre', 'crimson');
  room.box(2.55, 1.86, -2.36, 0.5, 0.05, 0.05, 'wood');
  room.quad([2.36, 1.02, -2.33], [0.2, 0, 0], [0, 0.84, 0], 'blue', { grain: 'v', stroke: [0.07, 0.3] });
  room.quad([2.62, 1.2, -2.33], [0.12, 0, 0], [0, 0.66, 0], 'crimson', { grain: 'v', stroke: [0.05, 0.25] });
  // a chest at the foot of the bed, a folded blanket on it; a small rug beside the bed
  room.box(0.62, 0.24, -1.86, 0.5, 0.48, 0.9, 'teal', { grain: 'z', stroke: [0.08, 0.3] });
  room.box(0.62, 0.5, -1.86, 0.54, 0.05, 0.94, 'wood', { grain: 'z' });
  room.box(0.62, 0.57, -1.8, 0.4, 0.1, 0.5, 'ochre', { stroke: [0.06, 0.14] }); room.box(0.62, 0.65, -1.8, 0.36, 0.06, 0.46, 'crimson', { stroke: [0.06, 0.14] });
  flat(1.9, -0.95, 1.5, 0.62, 0.03, 'blue', weave); flat(1.9, -0.95, 1.3, 0.42, 0.036, 'cream', weave); flat(1.9, -0.95, 1.1, 0.24, 0.042, 'blue', weave);
  // a basket of wool by the chair
  room.round(-1.75, 0.13, -1.55, 0.2, 0.26, 'ochre', { top: 0.24, stroke: [0.05, 0.1], tone: 0.8 });
  for (const [dx, dz, pal] of [[-0.07, 0.03, 'crimson'], [0.08, -0.04, 'cream'], [0.0, 0.09, 'teal']]) room.add(new THREE.SphereGeometry(0.085, 7, 5), room.place(-1.75 + dx, 0.3, -1.55 + dz), pal, { smooth: true, stroke: [0.04, 0.06] });
  paintDetails(room, lid);
  const inside = room.build();
  outside.group.add(lid.build().group);

  // ---- the fire itself, and smoke from the chimney: strokes of light and of grey ----
  const flames = dabMesh(dabGeometry(58), dabMaterial(shared, {
    head: /* glsl */ `uniform vec4 uFire;`,
    body: /* glsl */ `
      void makeDab(inout Dab d) {
        float id = float(gl_InstanceID);
        vec4 r = hash4(id * 5.3 + 1.0);
        float life = fract(r.x + uTime * (0.8 + 0.7 * r.y));
        vec3 P = uFire.xyz + vec3(-0.3 + (r.z - 0.5) * 0.12, -0.42 + life * 0.72, (r.w - 0.5) * 0.66 * (1.0 - life * 0.65));
        P.z += sin(uTime * 6.0 + r.y * 30.0) * 0.05 * life;
        d.pos = P;
        d.dir = vec3(0.0, 1.0, 0.35 * sin(uTime * 5.0 + r.z * 20.0));
        d.size = vec2(0.15, 0.36) * (1.0 - life * 0.72);
        d.c1 = mix(vec3(1.0, 0.82, 0.4), vec3(1.0, 0.3, 0.04), life) * (1.0 - life) * 0.55 * uFire.w;
        if (id > 39.5) {
          // sparks: they go up with the draught, and a few come out into the room
          life = fract(r.x + uTime * (0.22 + 0.2 * r.y));
          d.pos = uFire.xyz + vec3(-0.3 + life * 0.5 * r.z + 0.04 * sin(uTime * 3.0 + r.w * 40.0), -0.3 + life * (0.5 + 0.6 * r.w), (r.w - 0.5) * 0.5 + 0.06 * sin(uTime * 2.3 + r.z * 40.0));
          d.size = vec2(0.02, 0.035);
          d.c1 = vec3(1.0, 0.6, 0.2) * (1.0 - life) * 0.9;
        }
        d.c2 = d.c1 * 1.3;
        d.seed = id;
        d.lift = 0.0;
      }`,
    uniforms: { uImpasto: { value: 0.4 } },
    minPx: [3, 5], maxPx: [300, 600], cells: [0, 6], depthWrite: false,
  }), 21);
  flames.material.transparent = true;
  flames.material.blending = THREE.AdditiveBlending;
  flames.material.alphaToCoverage = false;
  const top = world(-3.65, 5.15, 0);
  const smoke = dabMesh(dabGeometry(54), dabMaterial(shared, {
    head: NIGHT,
    body: /* glsl */ `
      void makeDab(inout Dab d) {
        float id = float(gl_InstanceID);
        vec4 r = hash4(id * 3.1 + 9.0);
        float life = fract(r.x + uTime * (0.07 + 0.05 * r.y));
        vec3 P = vec3(${top.x.toFixed(2)}, ${top.y.toFixed(2)}, ${top.z.toFixed(2)});
        P.y += life * (5.0 + 3.0 * r.z);
        P.xz += uWind.xy * life * life * (7.0 + 5.0 * r.w) + vec2(sin(uTime * 0.6 + r.z * 20.0), cos(uTime * 0.5 + r.w * 20.0)) * 0.5 * life;
        d.alive = smoothstep(0.0, 0.12, life) * (1.0 - smoothstep(0.55, 1.0, life));
        d.pos = P;
        d.dir = normalize(vec3(uWind.x * life, 1.0, uWind.y * life));
        d.size = vec2(0.35, 0.7) * (0.6 + 2.6 * life);
        vec3 c = mix(vec3(0.24, 0.3, 0.36), vec3(0.14, 0.2, 0.27), r.y) * (0.7 + 0.5 * woodSunAt(P));
        c = mix(c, nightSky(normalize(P - cameraPosition)), smoothstep(0.3, 1.0, life) * 0.7);
        d.c1 = hazed(c, P);
        d.c2 = d.c1 * 1.2;
        d.seed = id;
        d.lift = 0.0;
      }`,
    minPx: [3, 5], maxPx: [200, 400], cells: [0, 8],
  }), 6);
  // the glow of the lit openings, to be seen from far off
  const beacon = dabMesh(dabGeometry(14), dabMaterial(shared, {
    head: NIGHT,
    body: /* glsl */ `
      void makeDab(inout Dab d) {
        float id = float(gl_InstanceID);
        vec4 r = hash4(id * 7.7 + 4.0);
        vec4 w = uWarm[gl_InstanceID % 3];
        float out_ = sign(w.w);
        if ((cameraPosition.z - w.z) * out_ < 0.5) { d.alive = 0.0; return; } // only from in front of it
        d.pos = w.xyz + vec3((r.x - 0.5) * 0.8, (r.y - 0.5) * 0.7, 0.2 * out_);
        d.dir = normalize(vec3(r.z - 0.5, r.w - 0.5, 0.0) + vec3(0.0, 0.2, 0.0));
        // from far off it is one spark, and is kept bright enough to be found
        float far = clamp(distance(cameraPosition, w.xyz) / 60.0, 0.0, 4.0);
        d.size = vec2(0.5, 1.1) * (0.7 + 1.2 * r.z) * (1.0 + 0.35 * far);
        d.c1 = vec3(1.0, 0.6, 0.22) * 0.07 * (1.0 + 1.2 * far) * abs(w.w) * (0.85 + 0.15 * sin(uTime * 5.0 + r.x * 30.0));
        d.c2 = d.c1 * 1.3;
        d.seed = id;
        d.lift = 0.0;
      }`,
    uniforms: { uImpasto: { value: 0.2 } },
    minPx: [5, 8], maxPx: [300, 600], cells: [0, 6], depthWrite: false,
  }), 22);
  beacon.material.transparent = true;
  beacon.material.blending = THREE.AdditiveBlending;
  beacon.material.alphaToCoverage = false;

  // the light that hangs round every small flame in the room, and the steam off the kettle
  const ofLight = (mesh) => { mesh.material.transparent = true; mesh.material.blending = THREE.AdditiveBlending; mesh.material.alphaToCoverage = false; return mesh; };
  const haloData = [];
  for (const l of [[-2.66, 1.83, 0.7], [0.6, 1.04, 0.5], [-0.72, 1.19, -2.26], [0.1, 1.19, -2.26], [2.88, 1.19, 0.38], [0.9, 1.985, 0.6]]) for (let i = 0; i < 3; i++) haloData.push(...world(...l).toArray(), out.rand() * 1000);
  const halos = ofLight(dabMesh(dabGeometry(haloData.length / 4, { aH: [new Float32Array(haloData), 4] }), dabMaterial(shared, {
    head: /* glsl */ `in vec4 aH;`,
    body: /* glsl */ `
      void makeDab(inout Dab d) {
        vec4 r = hash4(aH.w);
        d.pos = aH.xyz + (r.xyz - 0.5) * 0.05;
        d.dir = normalize(r.yzx - 0.5 + vec3(0.0, 0.3, 0.0));
        d.size = vec2(0.16, 0.26) * (0.7 + 0.8 * r.w);
        d.c1 = vec3(1.0, 0.62, 0.24) * 0.075 * (0.8 + 0.2 * sin(uTime * (5.0 + 6.0 * r.x) + r.y * 40.0));
        d.c2 = d.c1 * 1.3;
        d.seed = aH.w;
        d.lift = 0.0;
      }`,
    uniforms: { uImpasto: { value: 0.2 } },
    minPx: [3, 5], maxPx: [300, 600], cells: [0, 6], depthWrite: false,
  }), 22));
  const kettle = world(-2.22, 0.42, 0.78);
  const steam = ofLight(dabMesh(dabGeometry(9), dabMaterial(shared, {
    body: /* glsl */ `
      void makeDab(inout Dab d) {
        float id = float(gl_InstanceID);
        vec4 r = hash4(id * 4.7 + 6.0);
        float life = fract(r.x + uTime * (0.16 + 0.1 * r.y));
        d.pos = vec3(${kettle.x.toFixed(3)}, ${kettle.y.toFixed(3)}, ${kettle.z.toFixed(3)}) + vec3(0.1 * life * (r.z - 0.3) + 0.03 * sin(uTime * 1.3 + r.w * 20.0), life * 0.7, 0.08 * life * (r.w - 0.5));
        d.dir = vec3(0.3 * sin(uTime + r.z * 9.0), 1.0, 0.0);
        d.size = vec2(0.05, 0.14) * (0.6 + 1.6 * life);
        d.c1 = vec3(0.6, 0.5, 0.42) * 0.09 * sin(life * 3.14159);
        d.c2 = d.c1 * 1.3;
        d.seed = id;
        d.lift = 0.0;
      }`,
    uniforms: { uImpasto: { value: 0.2 } },
    minPx: [3, 5], maxPx: [200, 400], cells: [0, 6], depthWrite: false,
  }), 22));

  const group = new THREE.Group();
  group.add(outside.group, inside.group, flames, smoke, beacon, halos, steam);
  // what the moon sees of it, for its shadow on the snow
  const caster = new THREE.Mesh(new THREE.BoxGeometry(6.6, 3.3, 5.6).translate(CABIN.x, CABIN.y + 1.65, CABIN.z), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  caster.frustumCulled = false;

  // walls and furniture to walk into: [x, y, z, half sizes], in the cabin's measure
  const solid = [
    [0, 1.2, -2.5, 3.2, 1.2, 0.1], [-3.1, 1.2, 0, 0.1, 1.2, 2.6], [3.1, 1.2, 0, 0.1, 1.2, 2.6],
    [-0.975, 1.2, 2.5, 2.225, 1.2, 0.1], [2.725, 1.2, 2.5, 0.475, 1.2, 0.1], // the south wall, either side of the door
    [-2.72, 0.7, 0, 0.3, 0.7, 1.0], [0.9, 0.4, 0.6, 0.62, 0.4, 0.38], [1.95, 0.3, -1.86, 1.0, 0.3, 0.5], [-1.4, 0.4, -1.0, 0.28, 0.4, 0.28],
    [-2.74, 0.8, 1.75, 0.27, 0.8, 0.58], [0.62, 0.25, -1.86, 0.26, 0.25, 0.46],
    [-3.65, 1.2, 0, 0.45, 1.2, 0.5], [-2.6, 0.45, 2.85, 0.55, 0.45, 0.25],
  ].map(([x, y, z, hx, hy, hz]) => ({ x: CABIN.x + x, y: CABIN.y + y, z: CABIN.z + z, hx, hy, hz }));

  const within = (p) => Math.abs(p.x - CABIN.x) < 3.0 && Math.abs(p.z - CABIN.z) < 2.45;
  return {
    group, caster, solid, shell: outside.group, counts: { outside: outside.count, inside: inside.count },
    /** Is he in the room? */
    inside: within,
    /** Is he in the room or on its doorstep? From here on there is no room for an eye behind him. */
    threshold: (p) => within(p) || (Math.abs(p.x - CABIN.x - 1.75) < 0.9 && p.z - CABIN.z >= 2.45 && p.z - CABIN.z < 4.3),
    /** The fire is never the same twice. */
    update(time) { shared.uFire.value.w = 0.92 + 0.1 * Math.sin(time * 9.0) + 0.06 * Math.sin(time * 23.0 + 1.0) + 0.05 * Math.sin(time * 3.7); },
  };
}
