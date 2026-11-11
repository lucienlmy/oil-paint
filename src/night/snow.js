// The ridge as it is painted. Near the eye the snow is laid in long strokes that lie flat on it, the same steady
// ground as the wood's leaf carpet: every stroke belongs to one small square for good, and distance only chooses
// which are drawn. Rock, and snow too far off for that, are strokes scattered over the whole ridge once and left
// where they are: on the horns they run down the rock like the cuts of a knife.
import * as THREE from 'three';
import { groundRings } from '../oilpaint/ground.js';
import { dabMaterial, dabGeometry, dabMesh } from '../oilpaint/dabs.js';
import { rng } from '../world/noise.js';
import { NIGHT } from './paint.js';
import { EXTENT, heightAt, landAt, normalAt } from './land.js';

const near = /* glsl */ `
void makeDab(inout Dab d) {
  vec2 cell; float sub;
  if (!ringCell(0.0, true, cell, sub)) { d.alive = 0.0; return; }
  vec4 r = hash4(cell, sub * 3.0 + 1.0);
  vec4 q = hash4(cell + 31.7, sub + 11.0);
  vec2 xz = (cell + r.xy) * uCell0;
  float lod;
  float dist = distance(xz, cameraPosition.xz);
  d.alive = ringGrow(dist, lod);
  if (d.alive <= 0.0) return;
  float h = heightAt(xz);
  if (h < 0.5 || max(abs(xz.x), abs(xz.y)) > uExtent || inRoom(xz)) { d.alive = 0.0; return; }
  vec3 P = vec3(xz.x, h, xz.y);
  vec3 Nn = normalAt(xz);
  vec4 m = texture(tLand, landUv(xz));
  float x = moonOn(P, Nn);
  vec3 contour = normalize(cross(Nn, vec3(0.0, 1.0, 0.0)) + vec3(1e-4, 0.0, 0.0));
  vec3 c1, c2, own;
  if (m.r + (q.x - 0.5) * 0.35 > 0.5) {
    // rock underfoot; further off the scattered strokes have it
    d.alive *= 1.0 - smoothstep(70.0, 130.0, dist);
    float kind = texture(tNoise, xz / 41.0).g;
    c1 = rockPaint(x, q.y, kind);
    c2 = rockPaint(x + 0.1, q.w, kind + 0.2) * 1.3;
    d.dir = normalize(mix(cross(contour, Nn), contour, step(0.7, r.z)) + (q.xyz - 0.5) * 0.5);
    d.size = uCell0 * vec2(1.0 + 0.6 * r.z, 1.9 + 1.2 * r.w) * lod;
    own = vec3(0.45, 0.42, 0.42);
  } else {
    float a = auroraOn(xz, Nn);
    float kind = texture(tNoise, xz / 23.0).r + (q.z - 0.5) * 0.25;
    c1 = snowPaint(x, q.y, a, kind);
    c2 = snowPaint(x + 0.14, q.w, a, kind + 0.12);
    // here and there the crust throws the moon straight back
    if (q.w > 0.955 && x > 0.6) c2 = vec3(0.72, 0.9, 0.9);
    // the wind has cut the snow into long low waves; where the ground turns, the strokes follow its form
    float wa = (texture(tNoise, xz / 31.0).a - 0.5) * 1.7 + (q.y - 0.5) * 0.5;
    vec3 along = vec3(uWind.x * cos(wa) - uWind.y * sin(wa), 0.0, uWind.x * sin(wa) + uWind.y * cos(wa));
    d.dir = normalize(mix(along, contour, smoothstep(0.97, 0.8, Nn.y)));
    d.size = uCell0 * vec2(0.9 + 0.5 * r.z, 2.4 + 1.6 * r.w) * lod;
    own = vec3(0.95);
  }
  d.pos = P;
  d.c1 = hazed(lampOn(jitter(c1, r.wzy, 0.3), own, P, Nn), P);
  d.c2 = hazed(lampOn(jitter(c2, q.wzy, 0.3), own * 1.12, P, Nn), P);
  d.seed = dot(cell, vec2(1.0, 57.0)) + sub * 0.37;
  d.turnabout = 1.0;
  d.lie = 1.0;
  d.nrm = Nn;
  d.height = (0.03 + 0.07 * q.z) * pow(lod, 0.35);
  d.glaze = 1.0;
}
`;

const far = /* glsl */ `
void makeDab(inout Dab d) {
  vec4 r = hash4(aData.x);
  vec4 q = hash4(aData.x * 1.7 + 41.0);
  vec3 P = aPos, Nn = normalize(aNrm);
  float dist = distance(P, cameraPosition);
  float x = moonOn(P, Nn);
  vec3 contour = normalize(cross(Nn, vec3(0.0, 1.0, 0.0)) + vec3(1e-4, 0.0, 0.0));
  vec3 down = cross(contour, Nn);
  vec3 c, own;
  if (aData.y > 0.5) {
    // close to, the strokes lying on the rock have it
    d.alive = smoothstep(10.0, 34.0, dist);
    if (d.alive <= 0.0) return;
    float kind = texture(tNoise, P.xz / 41.0).g + (q.x - 0.5) * 0.2;
    c = rockPaint(x, q.y, kind);
    // most strokes run down the rock; some lie along its beds, and those on a ledge are the snow caught there
    bool bed = r.z > 0.8 && aData.z < 0.97;
    d.dir = normalize((bed ? contour : down) + (q.xyz - 0.5) * 0.45);
    if (bed && Nn.y > 0.42 && q.w > 0.35) c = snowPaint(x + 0.1, q.y, 0.5 * auroraOn(P.xz, Nn), 0.3);
    // the sky's green finds the upper edges of things
    c += vec3(0.0, 0.05, 0.035) * max(Nn.y, 0.0) * uGlow.x;
    d.size = vec2(1.3, 3.8) * (0.65 + 0.9 * r.y) * aData.w;
    own = vec3(0.45, 0.42, 0.42);
  } else {
    d.alive = smoothstep(120.0, 240.0, dist);
    if (d.alive <= 0.0) return;
    float kind = texture(tNoise, P.xz / 23.0).r + (q.z - 0.5) * 0.25;
    c = snowPaint(x, q.y, 0.6 * auroraOn(P.xz, Nn), kind);
    // on open slopes the strokes follow the form round; on the horns snow lies in streaks down the rock
    d.dir = normalize(mix(contour, down, mix(0.25 + 0.5 * q.x, 0.9, aData.z)) + (q.yzw - 0.5) * 0.25);
    d.size = vec2(2.6, 7.5) * (0.7 + 0.8 * r.y) * aData.w;
    own = vec3(0.95);
  }
  // seen edge on, at the skyline, a stroke is kept small: the outline of a mountain is drawn, not feathered
  d.size *= mix(0.45, 1.0, smoothstep(0.05, 0.5, abs(dot(Nn, normalize(cameraPosition - P)))));
  c = lampOn(jitter(c, r.wzy, 0.32), own, P, Nn);
  d.pos = P + Nn * 0.12;
  d.c1 = hazed(c, P);
  d.c2 = hazed(c * 1.3 + vec3(0.0, 0.01, 0.015), P);
  d.seed = aData.x;
  d.turnabout = 1.0;
  d.lift = 0.15;
}
`;

export function createSnow(shared) {
  const rings = groundRings(shared, { head: NIGHT, body: near, per: 2, n: 192, cell0: 0.4, levels: 4, minPx: [5, 9], maxPx: [4000, 4000], cells: [0, 8] });

  // the scattered strokes: tried all over the map, kept thickly on rock and on the horns, thinly on open snow
  const rand = rng(4141);
  const list = [];
  const n = new THREE.Vector3();
  let rock = 0, snow = 0;
  for (let i = 0; i < 2600000 && rock < 260000; i++) {
    const x = (rand() * 2 - 1) * EXTENT, z = (rand() * 2 - 1) * EXTENT;
    const h = heightAt(x, z);
    if (h < 1.5) continue;
    const [isRock, horn] = landAt(x, z);
    const stone = isRock > 0.5;
    if (rand() > (stone ? 0.5 : 0.07 + 0.5 * horn)) continue;
    normalAt(x, z, n);
    // on the horns the strokes are bolder: long cuts of the knife down the rock
    list.push([x, h, z, n.x, n.y, n.z, rand() * 1000, stone ? 1 : 0, horn, stone ? 1.2 + 0.5 * horn : 1 + 0.2 * horn]);
    if (stone) rock++; else snow++;
  }
  // They leave no depth behind them, so which of two that overlap is on top is only the order they are laid in,
  // and that never changes: from the north end of the ridge to the south, so that looking up the ridge the nearer
  // rock is painted over the farther. Given a depth each, strokes this far off change places as the eye moves.
  list.sort((a, b) => a[2] - b[2]);
  const count = list.length;
  const pos = new Float32Array(count * 3), nrm = new Float32Array(count * 3), data = new Float32Array(count * 4);
  list.forEach((s, i) => { pos.set(s.slice(0, 3), i * 3); nrm.set(s.slice(3, 6), i * 3); data.set(s.slice(6), i * 4); });
  const scattered = dabMesh(dabGeometry(count, { aPos: [pos, 3], aNrm: [nrm, 3], aData: [data, 4] }), dabMaterial(shared, {
    head: NIGHT + /* glsl */ `in vec3 aPos; in vec3 aNrm; in vec4 aData;`,
    body: far,
    minPx: [6, 14], maxPx: [150, 380], cells: [0, 8], depthWrite: false,
  }), 3);
  const group = new THREE.Group();
  group.add(rings.group, scattered);
  return { group, follow: rings.follow, counts: { rock, snow } };
}
