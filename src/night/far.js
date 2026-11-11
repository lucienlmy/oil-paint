// What lies round the ridge: the fjord, and the ranges across it. The water is strokes lying flat on it, long
// across the line of sight and thin along it, each the one colour of the piece of sky it gives back; a swell
// crosses the fjord and every stroke rides it. The ranges are three rings of mountains, each a wall of
// underpainting with strokes scattered over it; a few lamps burn on the nearest shore.
//
// None of this is sorted by depth. Far things are too far apart for a depth to tell two overlapping strokes from
// each other, and they would change places whenever the eye moved a hair. They are laid in a fixed order instead,
// far to near: water beyond the last range, that range, the water in front of it, and so on in to the ridge, which
// is painted over them all.
import * as THREE from 'three';
import { COMMON } from '../oilpaint/common.js';
import { dabMaterial, dabGeometry, dabMesh } from '../oilpaint/dabs.js';
import { noise, rng } from '../world/noise.js';
import { NIGHT } from './paint.js';

const WATER = /* glsl */ `
// The fjord gives back the sky it faces, darker, and nearly black where the eye looks down into it.
vec3 waterPaint(vec3 P, vec3 wobble) {
  vec3 v = normalize(P - cameraPosition);
  vec3 up = normalize(vec3(v.x, -v.y, v.z) + wobble);
  up.y = abs(up.y);
  vec3 sky = nightSky(up) * 1.5 + auroraSoft(up) * 0.75;
  // moving water draws a light out into a long column: it gives back the aurora from far above where a mirror would
  sky += auroraSoft(normalize(vec3(up.x, up.y * 2.6 + 0.13, up.z))) * 0.5;
  float graze = pow(1.0 - clamp(-v.y, 0.0, 1.0), 3.0);
  return mix(vec3(0.012, 0.06, 0.09), sky, 0.35 + 0.65 * graze);
}
`;

const RINGS = [
  { r: 2300, top: 620, seed: 3.1, open: [0.0, 0.3, 1.0], count: 52000 },
  { r: 4300, top: 1000, seed: 11.7, open: [0.35, 0.12, 0.6], count: 46000 },
  { r: 7600, top: 1500, seed: 23.9, open: [0, 0, 0], count: 40000 },
];
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** How high ring k stands at bearing az (0 north, + east). Each opens somewhere to let the fjord through. */
function crest(k, az, broad = false) {
  const o = RINGS[k], c = Math.cos(az), s = Math.sin(az);
  let n = 0.45 + 0.55 * noise(c * 2.2 + o.seed, s * 2.2) + 0.28 * noise(c * 6.5, s * 6.5 + o.seed);
  if (!broad) n += 0.12 * noise(c * 17 + o.seed, s * 17) + 0.05 * noise(c * 41, s * 41 + o.seed);
  const turn = Math.abs(((az - o.open[0] + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  const gap = o.open[2] > 0 ? 0.1 + 0.9 * sstep(o.open[1], o.open[2], turn) : 1;
  return o.top * gap * Math.min(1.4, Math.max(0.1, n));
}

export function createFar(shared) {
  const group = new THREE.Group();
  const rand = rng(7373);
  /** Laid in its turn (order), over whatever is already there, with no depth asked or left. */
  const lay = (mesh, order) => {
    mesh.material.depthTest = false;
    mesh.material.depthWrite = false;
    mesh.renderOrder = order;
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  };

  // --- the water: four bands of it, between the ranges ---
  const bands = [[60, 2200], [2200, 4200], [4200, 7500], [7500, 15500]]; // each ends a little short of the range behind it
  const wash = () => new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: shared,
    vertexShader: /* glsl */ `
      out vec3 vWorld;
      void main() { vWorld = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      ${NIGHT}
      ${WATER}
      in vec3 vWorld;
      layout(location = 0) out vec4 outC;
      void main() { outC = vec4(hazed(waterPaint(vWorld, vec3(0.0)) * 0.9, vWorld), 1.0); }`,
  });
  const strokes = () => dabMaterial(shared, {
    head: NIGHT + WATER + /* glsl */ `in vec4 aW;`,
    body: /* glsl */ `
      void makeDab(inout Dab d) {
        vec4 r = hash4(aW.z);
        float rad = aW.y;
        vec3 P = vec3(sin(aW.x) * rad, 0.0, -cos(aW.x) * rad);
        if (heightAt(P.xz) > -0.5 && max(abs(P.x), abs(P.z)) < uExtent) { d.alive = 0.0; return; }
        vec2 q = normalize(P.xz - cameraPosition.xz);
        vec3 along = vec3(-q.y, 0.0, q.x);
        vec2 size = rad * vec2(0.035 + 0.04 * r.y, 0.045 + 0.06 * r.w);
        // the swell: it comes up the fjord from the south-west, and each stroke slides along its own length with
        // it and back, lengthening on the crest
        float swell = (dot(P.xz, vec2(0.6, -0.8)) / 240.0 - uTime * 0.21 + r.z * 0.35) * TAU;
        P += along * sin(swell) * size.y * 0.4;
        size.y *= 1.0 + 0.3 * cos(swell);
        // each stroke takes its piece of sky a little wrong, and wrong a different way as the swell passes: that
        // is what breaks the reflection up and keeps it alive
        vec3 c = waterPaint(P, (vec3(r.x - 0.5, (r.y - 0.5) * 0.5, r.z - 0.5) + 0.5 * vec3(sin(swell + r.x * 9.0), 0.0, cos(swell * 0.7 + r.y * 9.0))) * 0.16);
        // a few catch the light whole, on the face of the swell that is turned to it
        if (aW.w > 0.84) {
          float flash = pow(0.5 + 0.5 * sin(swell * 2.0 + r.y * TAU), 3.0);
          c += (auroraSoft(normalize(vec3(P.x - cameraPosition.x, 0.3 * length(P.xz - cameraPosition.xz), P.z - cameraPosition.z))) * 0.45 + vec3(0.01, 0.045, 0.05)) * (0.25 + 1.5 * flash);
        }
        // and no two are loaded alike: some dark, a few bright
        c *= 0.55 + 1.1 * r.x * r.x;
        d.dir = along;
        d.pos = P;
        d.size = size;
        d.c1 = hazed(jitter(c, r.yzw, 0.3), P);
        d.c2 = hazed(c * 1.4 + vec3(0.0, 0.012, 0.01), P);
        d.seed = aW.z;
        d.lie = 1.0;
        d.nrm = vec3(0.0, 1.0, 0.0);
        d.height = 0.5;
      }`,
    minPx: [4, 9], maxPx: [4000, 4000], cells: [0, 3],
  });
  {
    const all = [];
    for (let i = 0; i < 52000; i++) all.push([rand() * Math.PI * 2, 330 * Math.exp(rand() * Math.log(15000 / 330)), rand() * 1000, rand()]);
    bands.forEach(([inner, outer], b) => {
      const order = -6.4 - 0.4 * b; // nearest band last
      lay(new THREE.Mesh(new THREE.RingGeometry(inner, outer, 128, 1).rotateX(-Math.PI / 2), wash()), order);
      // within a band the far strokes are laid first, so that nearer water lies over farther
      const mine = all.filter((w) => w[1] >= inner && w[1] < outer).sort((p, q) => q[1] - p[1]);
      if (mine.length) lay(dabMesh(dabGeometry(mine.length, { aW: [new Float32Array(mine.flat()), 4] }), strokes()), order + 0.1);
    });
  }

  // --- the ranges ---
  const SEG = 720;
  RINGS.forEach((o, k) => {
    const order = -6.6 - 0.4 * k; // behind the water in front of it, before the water behind
    const wall = new THREE.BufferGeometry();
    const p = new Float32Array((SEG + 1) * 2 * 3), index = [];
    for (let i = 0; i <= SEG; i++) {
      const az = (i / SEG) * Math.PI * 2, x = Math.sin(az) * o.r, z = -Math.cos(az) * o.r;
      p.set([x, -20, z, x, crest(k, az), z], i * 6);
      if (i < SEG) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    wall.setAttribute('position', new THREE.BufferAttribute(p, 3));
    wall.setIndex(index);
    lay(new THREE.Mesh(wall, new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: shared,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        out vec3 vWorld;
        void main() { vWorld = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        ${COMMON}
        ${NIGHT}
        in vec3 vWorld;
        layout(location = 0) out vec4 outC;
        void main() { outC = vec4(hazed(mix(vec3(0.03, 0.05, 0.08), vec3(0.1, 0.2, 0.3), smoothstep(40.0, 420.0, vWorld.y)), vWorld), 1.0); }`,
    })), order);

    const pos = new Float32Array(o.count * 3), nrm = new Float32Array(o.count * 3), data = new Float32Array(o.count * 4);
    for (let i = 0; i < o.count; i++) {
      const az = rand() * Math.PI * 2, top = crest(k, az), t = Math.pow(rand(), 0.8);
      // how the skyline slopes above this spot. Near the top its small peaks turn the faces; lower down only the
      // great ones do, and the spurs that divide lit face from dark slant as they come down
      const e = 0.012, azf = az + (1 - t) * 0.04 * noise(az * 9 + k * 5, 0.5);
      const fine = (crest(k, azf + e) - crest(k, azf - e)) / (2 * e * o.r);
      const wide = (crest(k, azf + 3 * e, true) - crest(k, azf - 3 * e, true)) / (6 * e * o.r);
      const fall = wide + (fine - wide) * t;
      const sx = Math.sin(az), cz = -Math.cos(az), tx = Math.cos(az), tz = Math.sin(az);
      // a wall has no form of its own: it is given the lie of a slope running down from its skyline
      const lean = fall * 1.7 + 0.2 * noise(az * 38 + k * 9, t * 3.5) + (rand() - 0.5) * 0.12;
      const rr = o.r - 40 - 60 * rand();
      pos.set([sx * rr, t * top, cz * rr], i * 3);
      const len = Math.hypot(0.75, lean, 0.55);
      nrm.set([(-sx * 0.75 - tx * lean) / len, 0.55 / len, (-cz * 0.75 - tz * lean) / len], i * 3);
      data.set([rand() * 1000, t, top, o.r], i * 4);
    }
    lay(dabMesh(dabGeometry(o.count, { aPos: [pos, 3], aNrm: [nrm, 3], aData: [data, 4] }), dabMaterial(shared, {
      head: NIGHT + /* glsl */ `in vec3 aPos; in vec3 aNrm; in vec4 aData;`,
      body: /* glsl */ `
        void makeDab(inout Dab d) {
          vec4 r = hash4(aData.x);
          vec3 Nn = normalize(aNrm);
          float x = clamp(dot(Nn, uSunDir) * 1.5 + 0.25, 0.0, 1.0);
          // rock shows in bands and along the shore; the rest is snow
          float band = texture(tNoise, vec2(aPos.x + aPos.z, aPos.y * 2.0) / 2600.0).g;
          bool stone = aData.y < 0.07 || band + (r.x - 0.5) * 0.08 > 0.6;
          vec3 c = stone ? rockPaint(x, r.y, r.z) : snowPaint(x, r.y, clamp(uGlow.x * 0.6 * Nn.y, 0.0, 1.0), r.z * 0.6);
          vec3 side = normalize(cross(Nn, vec3(0.0, 1.0, 0.0)));
          d.dir = normalize(cross(side, Nn) * 0.6 + side * (Nn.x * side.z - Nn.z * side.x > 0.0 ? 1.0 : -1.0) + vec3(0.0, (r.w - 0.5) * 0.4, 0.0));
          d.pos = aPos;
          d.size = aData.w * vec2(0.008 + 0.006 * r.z, 0.02 + 0.02 * r.w);
          d.c1 = hazed(jitter(c, r.yzw, 0.18) * 0.82, aPos);
          d.c2 = hazed(c * 0.92, aPos);
          d.seed = aData.x;
          d.turnabout = 1.0;
          d.lift = 0.0;
        }`,
      uniforms: { uImpasto: { value: 0.45 } },
      minPx: [4, 8], maxPx: [200, 500], cells: [0, 8],
    })), order + 0.1);
  });

  // --- lamps on the near shore: a village, and its light lying on the water ---
  {
    const lamps = [];
    for (const [az, n] of [[0.86, 16], [-1.12, 9], [2.3, 7]]) {
      for (let i = 0; i < n; i++) {
        const a = az + (rand() - 0.5) * 0.09, r = RINGS[0].r - 110 - rand() * 50;
        lamps.push(Math.sin(a) * r, 4 + rand() * 16, -Math.cos(a) * r, rand() * 1000);
      }
    }
    const count = lamps.length / 4;
    // each lamp, and three glints of it on the water
    lay(dabMesh(dabGeometry(count * 4, { aL: [new Float32Array([...lamps, ...lamps, ...lamps, ...lamps]), 4] }), dabMaterial(shared, {
      head: /* glsl */ `in vec4 aL;`,
      body: /* glsl */ `
        void makeDab(inout Dab d) {
          vec4 r = hash4(aL.w);
          float glint = floor(float(gl_InstanceID) / ${count}.0); // 0: the lamp itself
          bool onWater = glint > 0.5;
          vec3 run = vec3(0.0, 1.0, 0.0);
          vec3 P = aL.xyz;
          vec3 c = mix(vec3(1.0, 0.7, 0.32), vec3(1.0, 0.86, 0.6), r.x) * (0.75 + 0.25 * sin(uTime * (1.0 + r.y) + r.z * 40.0));
          if (onWater) {
            // its light on the water: short level touches below it, each dimmer and shorter than the last, that the
            // water keeps breaking and mending
            vec4 g = hash4(aL.w + glint * 13.7);
            vec2 toEye = normalize(cameraPosition.xz - P.xz);
            float reach = 130.0 + 75.0 * glint + 40.0 * g.x;
            P = vec3(P.x + toEye.x * reach + toEye.y * (g.y - 0.5) * 14.0, 1.5, P.z + toEye.y * reach - toEye.x * (g.y - 0.5) * 14.0);
            c *= (0.5 - 0.11 * glint) * (0.6 + 0.4 * sin(uTime * (1.1 + g.z) + g.w * 30.0));
            run = vec3(-toEye.y, 0.0, toEye.x);
            d.size = vec2(3.5, (30.0 - 6.0 * glint) * (0.7 + 0.6 * g.z));
          } else d.size = vec2(7.0 + 6.0 * r.y);
          d.pos = P;
          d.dir = run;
          d.c1 = hazed(c, P);
          d.c2 = d.c1 * 1.2;
          d.seed = aL.w;
          d.lift = 0.0;
        }`,
      uniforms: { uImpasto: { value: 0.2 } },
      minPx: [2.4, 2.4], maxPx: [40, 200], cells: [4, 2],
    })), -6.2);
  }
  return { group };
}
