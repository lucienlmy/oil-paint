// Spruces under snow. They stand thick on the south end of the ridge, where he starts, thin out toward the knoll,
// and dot the flanks down to the water. Each is a narrow spire: tiers of boughs hanging out and down from the
// trunk, a dark stroke of needles for each bough and, lying on it, a thick stroke of the snow it carries. The
// higher on the tree, the more of it is snow. Inside every tree is a plain dark cone: it is the underpainting, it
// hides the far side, and it is what throws the tree's shadow down the snow.
import * as THREE from 'three';
import { COMMON } from '../oilpaint/common.js';
import { dabMaterial, dabGeometry, dabMesh } from '../oilpaint/dabs.js';
import { noise, rng } from '../world/noise.js';
import { NIGHT } from './paint.js';
import { crestX, heightAt, landAt, normalAt } from './land.js';

const TAU = Math.PI * 2;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createPines(shared) {
  const rand = rng(31337);
  const trees = []; // { x, y, z, h, r, full }
  const n = new THREE.Vector3();
  const room = (x, z, gap) => trees.every((t) => Math.hypot(t.x - x, t.z - z) > gap);
  const stand = (x, z, h, full) => {
    const y = heightAt(x, z);
    trees.push({ x, y: y - 0.25, z, h, r: h * (0.13 + 0.07 * rand()) + 0.25, full });
  };

  // the wood he starts in: densest in the south, in drifts, with an aisle left along the crest for the way
  for (let z = 172; z < 350; z += 3.6) {
    for (let off = -96; off <= 96; off += 3.6) {
      const x = crestX(z) + off + (rand() - 0.5) * 3, zz = z + (rand() - 0.5) * 3, d = Math.abs(x - crestX(zz));
      const drift = 0.5 + 0.5 * noise(x / 23 + 4, zz / 23 - 9);
      const thick = sstep(176, 250, zz) * (0.2 + 0.8 * drift) * (1 - 0.5 * sstep(40, 96, d));
      if (rand() > thick || d < 2.7) continue;
      const y = heightAt(x, zz);
      if (y < 12 || landAt(x, zz)[0] > 0.4 || normalAt(x, zz, n).y < 0.66) continue;
      // tall in the heart of it, small at its upper edge and beside the way
      const h = (3 + 8.5 * Math.pow(rand(), 1.4)) * (0.55 + 0.45 * sstep(180, 240, zz)) * (0.7 + 0.3 * sstep(2.7, 7, d));
      if (room(x, zz, 1.6 + h * 0.16)) stand(x, zz, h, true);
    }
  }
  // a few that have got out onto the knoll and stand alone against the sky
  for (const [off, z, h] of [[-7.5, 143, 5.6], [12.5, 137, 4.1], [-11, 122, 3.3], [8.5, 104, 2.7], [-6, 166, 4.6], [15, 171, 6.2]]) stand(crestX(z) + off, z, h, true);
  // and clumps of them down the flanks, below where the wind lets nothing grow
  for (let i = 0; i < 9000; i++) {
    const x = (rand() * 2 - 1) * 440, z = -330 + rand() * 780, y = heightAt(x, z);
    if (y < 10 || y > 150 + 70 * sstep(100, 250, z) || Math.abs(x - crestX(z)) < 100 && z > 165) continue;
    if (noise(x / 37 + 1, z / 37 + 6) < 0.12 || landAt(x, z)[0] > 0.4 || normalAt(x, z, n).y < 0.7) continue;
    if (room(x, z, 3)) stand(x, z, 3 + 6 * rand(), false);
  }
  // laid from the north end of the ridge to the south, like the rock: looking up the ridge, nearer over farther
  trees.sort((a, b) => a.z - b.z);

  // --- the cones ---
  const SIDES = 7;
  const cone = new Float32Array(trees.length * SIDES * 9);
  trees.forEach((t, i) => {
    for (let s = 0; s < SIDES; s++) {
      const a0 = (s / SIDES) * TAU, a1 = ((s + 1) / SIDES) * TAU, r = t.r * 0.72;
      cone.set([t.x, t.y + t.h * 0.98, t.z, t.x + Math.cos(a1) * r, t.y, t.z + Math.sin(a1) * r, t.x + Math.cos(a0) * r, t.y, t.z + Math.sin(a0) * r], (i * SIDES + s) * 9);
    }
  });
  const coneGeometry = new THREE.BufferGeometry();
  coneGeometry.setAttribute('position', new THREE.BufferAttribute(cone, 3));
  const cones = new THREE.Mesh(coneGeometry, new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: shared,
    // seen from outside only: an eye that has pushed in among the boughs looks out through it
    vertexShader: /* glsl */ `
      out vec3 vWorld;
      void main() { vWorld = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      in vec3 vWorld;
      layout(location = 0) out vec4 outC;
      void main() { outC = vec4(hazed(vec3(0.012, 0.03, 0.045), vWorld), 1.0); }`,
  }));
  cones.frustumCulled = false;
  const caster = new THREE.Mesh(coneGeometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  caster.frustumCulled = false;

  // --- the strokes ---
  const pos = [], dir = [], nrm = [], data = [];
  const put = (p, d, nn, kind, across, along) => { pos.push(...p); dir.push(...d); nrm.push(...nn); data.push(rand() * 1000, kind, across, along); };
  for (const t of trees) {
    const tiers = t.full ? Math.round(5 + t.h * 0.95) : 4;
    const lean = [(rand() - 0.5) * 0.07, (rand() - 0.5) * 0.07], curl = [(rand() - 0.5) * 0.2, (rand() - 0.5) * 0.2];
    for (let i = 0; i < tiers; i++) {
      const up = (i + 0.4) / tiers; // 0 at the foot, 1 at the top
      const y = t.y + t.h * (0.12 + 0.86 * up);
      const rad = t.r * Math.pow(1 - up, 0.8) + 0.1;
      // the trunk leans a little, and the top of a loaded tree bends over
      const cx = t.x + t.h * (lean[0] * up + curl[0] * up * up * up), cz = t.z + t.h * (lean[1] * up + curl[1] * up * up * up);
      const boughs = t.full ? Math.max(3, Math.round(3 + rad * 4.2)) : 3;
      const a0 = rand() * TAU, droop = 0.35 + 0.55 * (1 - up);
      for (let b = 0; b < boughs; b++) {
        const a = a0 + ((b + rand() * 0.5) / boughs) * TAU, ox = Math.cos(a), oz = Math.sin(a);
        // the bough itself: needles, running out and down from the trunk; less of it shows the higher it is
        put([cx + ox * rad * 0.55, y - rad * droop * 0.45, cz + oz * rad * 0.55], [ox, -droop, oz], [ox, -0.25, oz], 0, rad * (0.85 - 0.3 * up), rad * (1.35 - 0.4 * up));
        // and the snow lying along the top of it
        put([cx + ox * rad * 0.6, y - rad * droop * 0.22 + 0.06, cz + oz * rad * 0.6], [ox, -droop * 0.7, oz], [ox * 0.6, 1, oz * 0.6], 1, rad * (0.62 + 0.3 * up), rad * (0.95 + 0.25 * up));
      }
    }
    // the top is a lump of snow
    const tx = t.x + t.h * (lean[0] + curl[0]), tz = t.z + t.h * (lean[1] + curl[1]);
    put([tx, t.y + t.h * 0.99, tz], [curl[0] * 2, 1, curl[1] * 2], [0, 1, 0], 1, 0.2 + t.h * 0.02, 0.45 + t.h * 0.04);
  }
  const count = data.length / 4;
  const strokes = dabMesh(dabGeometry(count, { aPos: [new Float32Array(pos), 3], aDir: [new Float32Array(dir), 3], aNrm: [new Float32Array(nrm), 3], aData: [new Float32Array(data), 4] }), dabMaterial(shared, {
    head: NIGHT + /* glsl */ `in vec3 aPos; in vec3 aDir; in vec3 aNrm; in vec4 aData;`,
    body: /* glsl */ `
      void makeDab(inout Dab d) {
        vec4 r = hash4(aData.x);
        vec3 P = aPos, Nn = normalize(aNrm);
        bool snow = aData.y > 0.5;
        // a breath of wind in the boughs
        P.xz += uWind.xy * gustAt(P.xz) * 0.035 * sin(uTime * (1.3 + r.x) + r.y * 30.0) * smoothstep(0.0, 4.0, P.y - heightAt(P.xz));
        float x = moonOn(P, Nn);
        vec3 c, own;
        if (snow) {
          c = snowPaint(x, r.y, 0.7 * auroraOn(P.xz, Nn), 0.25 + 0.25 * r.z);
          own = vec3(0.95);
        } else {
          c = paint3(vec3(0.085, 0.2, 0.19), vec3(0.035, 0.085, 0.1), vec3(0.012, 0.03, 0.055), x * 0.8, r.y);
          c += vec3(0.0, 0.028, 0.02) * max(Nn.y + 0.4, 0.0) * uGlow.x;
          own = vec3(0.15, 0.2, 0.09);
        }
        c = lampOn(jitter(c, r.wzy, snow ? 0.25 : 0.4), own, P, Nn);
        d.pos = P;
        d.dir = aDir;
        d.size = aData.zw * (0.85 + 0.3 * r.x);
        d.c1 = hazed(c, P);
        d.c2 = hazed(c * (snow ? 1.25 : 1.5) + vec3(0.0, 0.006, 0.01), P);
        d.seed = aData.x;
        d.lift = snow ? 0.55 : 0.25;
        d.turnabout = snow ? 1.0 : 0.0;
      }`,
    minPx: [3, 6], maxPx: [100, 210], cells: [0, 8],
  }), 3);

  const group = new THREE.Group();
  group.add(cones, strokes);
  // trunks to walk into, for those near the way
  const colliders = trees.filter((t) => t.full && Math.abs(t.x - crestX(t.z)) < 40).map((t) => ({ x: t.x, y: t.y, z: t.z, r: t.r * 0.45 }));
  /**
   * How far along a line of sight (from o, along unit d, up to max) the first tree stands in the way: its boughs,
   * not only its trunk. Null if none does. For the eye, so that it never ends up inside one.
   */
  const near = trees.filter((t) => t.full);
  function block(o, d, max) {
    let best = null;
    const a = d.x * d.x + d.z * d.z;
    if (a < 1e-6) return null;
    for (const t of near) {
      const ox = o.x - t.x, oz = o.z - t.z;
      if (Math.abs(ox) > max + 3 || Math.abs(oz) > max + 3) continue;
      const rc = t.r * 0.8, b = 2 * (ox * d.x + oz * d.z), c = ox * ox + oz * oz - rc * rc;
      const disc = b * b - 4 * a * c;
      if (disc <= 0 || c < 0) continue; // (he is in among its boughs himself: nothing to be done from here)
      const s = Math.max(0, (-b - Math.sqrt(disc)) / (2 * a));
      if (s >= max || (-b + Math.sqrt(disc)) / (2 * a) < 0) continue;
      const up = (o.y + d.y * s - t.y) / t.h; // the tree narrows upward: higher on it there is less in the way
      if (up < 0 || up > 0.8) continue;
      if (best == null || s < best) best = s;
    }
    return best;
  }
  return { group, caster, colliders, block, counts: { trees: trees.length, strokes: count } };
}
