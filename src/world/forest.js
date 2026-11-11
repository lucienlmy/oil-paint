// The wood: tall beeches with a scatter of birch, maple and old oak, thinned along the way and opened at the
// clearing. Trunks and limbs are real shapes that carry the underpainting; bark, twigs and every leaf mass are
// dabs. Trees close to the way are painted in full, those behind them with fewer, larger touches, and the furthest
// are little more than a pole and a few blots, which is all the mist lets through.
import * as THREE from 'three';
import { COMMON } from '../oilpaint/common.js';
import { dabMaterial, dabGeometry, dabMesh } from '../oilpaint/dabs.js';
import { heightAt, wayDist, clearingAt, noise, rng, CLEARING, START } from './land.js';

const BEECH = 0, BIRCH = 1, OAK = 2, MAPLE = 3;

export const BARK = /* glsl */ `
const vec3 BARK_L[4] = vec3[4](vec3(0.88, 0.6, 0.33), vec3(1.0, 0.94, 0.74), vec3(0.84, 0.6, 0.34), vec3(0.86, 0.62, 0.4));
const vec3 BARK_M[4] = vec3[4](vec3(0.37, 0.3, 0.31), vec3(0.76, 0.71, 0.68), vec3(0.3, 0.22, 0.2), vec3(0.33, 0.25, 0.25));
const vec3 BARK_S[4] = vec3[4](vec3(0.15, 0.12, 0.19), vec3(0.4, 0.4, 0.53), vec3(0.12, 0.09, 0.14), vec3(0.14, 0.1, 0.16));
vec3 bark(int k, vec3 P, vec3 Nn, float r, float foot) {
  // a trunk is lit as a round thing by a low sun, and from below by the bright leaves on the ground
  float lit = sunAt(P + Nn * 0.35) * clamp(dot(Nn, uSunDir) * 1.2 + 0.25, 0.0, 1.0);
  vec3 c = paint3(BARK_L[k], BARK_M[k], BARK_S[k], lit, r);
  c += vec3(0.1, 0.045, 0.0) * (1.0 - lit) * exp(-foot * 0.45);
  return c;
}
`;

const LEAF = /* glsl */ `
const vec3 LEAF_L[5] = vec3[5](vec3(1.0, 0.8, 0.2), vec3(1.0, 0.57, 0.12), vec3(0.94, 0.26, 0.09), vec3(0.86, 0.82, 0.24), vec3(1.0, 0.9, 0.36));
const vec3 LEAF_M[5] = vec3[5](vec3(0.76, 0.49, 0.11), vec3(0.72, 0.33, 0.09), vec3(0.61, 0.15, 0.08), vec3(0.52, 0.52, 0.14), vec3(0.82, 0.62, 0.17));
const vec3 LEAF_S[5] = vec3[5](vec3(0.46, 0.25, 0.1), vec3(0.42, 0.17, 0.09), vec3(0.34, 0.09, 0.11), vec3(0.24, 0.29, 0.13), vec3(0.5, 0.33, 0.13));
`;

function tube(out, pts, radii, sides, kind, seed) {
  // a tapered pipe through pts; the frame is carried along it, which keeps it from twisting
  const base = out.position.length / 3;
  const t = new THREE.Vector3(), n = new THREE.Vector3(), b = new THREE.Vector3(), p = new THREE.Vector3();
  let ref = new THREE.Vector3(1, 0, 0.3).normalize();
  for (let i = 0; i < pts.length; i++) {
    t.copy(pts[Math.min(i + 1, pts.length - 1)]).sub(pts[Math.max(i - 1, 0)]).normalize();
    n.copy(ref).addScaledVector(t, -ref.dot(t)).normalize();
    ref = n.clone();
    b.crossVectors(t, n);
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const dx = Math.cos(a), dy = Math.sin(a);
      p.copy(pts[i]).addScaledVector(n, dx * radii[i]).addScaledVector(b, dy * radii[i]);
      out.position.push(p.x, p.y, p.z);
      out.normal.push(n.x * dx + b.x * dy, n.y * dx + b.y * dy, n.z * dx + b.z * dy);
      out.data.push(kind, seed, pts[i].y - pts[0].y);
    }
  }
  for (let i = 0; i < pts.length - 1; i++) {
    for (let s = 0; s < sides; s++) {
      const a = base + i * sides + s, c = base + i * sides + ((s + 1) % sides);
      out.index.push(a, c, a + sides, c, c + sides, a + sides);
    }
  }
}

function plant() {
  const rand = rng(4471);
  const trees = [];
  const add = (x, z, type, tier, scale = 1) => {
    const r = (type === BIRCH ? 0.13 + rand() * 0.08 : type === OAK ? 0.75 + rand() * 0.3 : 0.26 + rand() * rand() * 0.42) * scale;
    const h = type === BIRCH ? 15 + rand() * 6 : type === OAK ? 19 + rand() * 4 : 21 + rand() * 8 + r * 5;
    const family = type === BIRCH ? 4 : type === MAPLE ? (rand() < 0.75 ? 2 : 1) : type === OAK ? (rand() < 0.5 ? 3 : 0) : [0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 3, 3][Math.floor(rand() * 12)];
    trees.push({ x, z, y: heightAt(x, z), type, tier, r, h, family, seed: rand() * 1000, lean: [(rand() - 0.5) * 0.09, (rand() - 0.5) * 0.09] });
  };
  const G = 7.2;
  for (let gz = -40; gz <= 40; gz++) {
    for (let gx = -40; gx <= 40; gx++) {
      const x = (gx + 0.15 + rand() * 0.7) * G, z = (gz + 0.15 + rand() * 0.7) * G - 8;
      const corridor = Math.hypot(Math.max(0, Math.abs(x) - 10), Math.max(0, Math.abs(z + 8) - 100));
      if (corridor > 185 || rand() > 0.84) continue;
      const wd = corridor < 60 ? wayDist(x, z) : 99;
      if (wd < 2.7 || clearingAt(x, z) > 0.25) continue;
      // stands of one kind: birch and maple come in groups
      const stand = noise(x / 46 + 5, z / 46 - 3), other = noise(x / 31 - 7, z / 31 + 2);
      const type = stand > 0.42 ? BIRCH : other > 0.5 ? MAPLE : rand() < 0.04 ? OAK : BEECH;
      add(x, z, type, corridor < 40 ? 0 : corridor < 92 ? 1 : 2);
    }
  }
  // the old oak that stands in the clearing, and two great beeches that make a gate where the way begins
  const hero = { x: CLEARING.x + 3, z: CLEARING.z - 2 };
  trees.push({ ...hero, y: heightAt(hero.x, hero.z), type: OAK, tier: 0, r: 1.25, h: 23, family: 0, seed: 77, lean: [0.03, -0.02], hero: true });
  for (const [x, z, s] of [[START.x - 5.5, START.z - 13, 1.9], [START.x + 6.2, START.z - 19, 1.6]]) add(x, z, BEECH, 0, s);
  return trees;
}

export function createForest(shared) {
  const trees = plant();
  const rand = rng(99173);
  const wood = { position: [], normal: [], data: [], index: [] };
  const barkDabs = []; // pos 3, dir 3, nrm 3, data 4 (seed, across, kind, along)
  const leafDabs = []; // pos 3, nrm 3, data 4 (seed, size, family, core)
  const lobes = []; // x y z r, for the shade they cast
  const colliders = [];
  const v = new THREE.Vector3();

  for (const t of trees) {
    const full = t.tier === 0, some = t.tier === 1;
    const top = t.h * (t.type === BIRCH ? 0.95 : 0.8);
    // --- trunk ---
    const rings = full ? 9 : some ? 5 : 3;
    const pts = [], radii = [];
    for (let i = 0; i < rings; i++) {
      const u = i / (rings - 1), y = u * u * 0.4 + u * 0.6;
      const bend = Math.sin(u * 2.4 + t.seed) * 0.25 * (t.type === BIRCH ? 1.6 : 1);
      pts.push(new THREE.Vector3(t.x + t.lean[0] * y * top + bend * t.lean[1] * 8, t.y - 0.3 + y * (top + 0.3), t.z + t.lean[1] * y * top - bend * t.lean[0] * 8));
      radii.push(t.r * (1 - 0.6 * y) * (1 + 0.5 * Math.exp(-(y * top) / (0.35 + t.r * 0.6))));
    }
    tube(wood, pts, radii, full ? 9 : some ? 7 : 5, t.type, t.seed);
    // the trunk's middle and radius at a height above its foot
    const trunkAt = (y, outP) => {
      let i = 0;
      while (i < rings - 2 && pts[i + 1].y - t.y < y) i++;
      const k = THREE.MathUtils.clamp((y - (pts[i].y - t.y)) / (pts[i + 1].y - pts[i].y), 0, 1);
      outP.lerpVectors(pts[i], pts[i + 1], k);
      return radii[i] + (radii[i + 1] - radii[i]) * k;
    };
    if (full && wayDist(t.x, t.z) < 60) colliders.push({ x: t.x, z: t.z, y: t.y, r: t.r * 1.15 });

    // --- crown: limbs, and the lobes of leaves they hold up ---
    const crown = new THREE.Vector3(t.x + t.lean[0] * top, t.y + t.h * (t.hero ? 0.66 : 0.8), t.z + t.lean[1] * top);
    const spread = t.hero ? 11.5 : t.type === OAK ? 7.5 : t.type === BIRCH ? 2.6 + rand() : 4 + rand() * 1.8 + t.r * 2;
    const treeLobes = [];
    if (full) {
      const limbs = t.hero ? 9 : t.type === BIRCH ? 4 : 5 + Math.floor(rand() * 3);
      for (let i = 0; i < limbs; i++) {
        const a = (i / limbs) * Math.PI * 2 + rand() * 1.2;
        const from = top * (t.hero ? 0.2 + 0.5 * (i / limbs) : 0.48 + 0.45 * (i / limbs));
        const p0 = new THREE.Vector3();
        const r0 = trunkAt(from, p0);
        const tilt = t.hero ? 0.9 + rand() * 0.5 : t.type === BIRCH ? 0.35 : 0.45 + rand() * 0.45;
        const len = (spread / Math.sin(tilt)) * (0.7 + rand() * 0.4) * (1 - 0.35 * (i / limbs));
        const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        const p2 = p0.clone().addScaledVector(out, len * Math.sin(tilt)).add(new THREE.Vector3(0, len * Math.cos(tilt), 0));
        const p1 = p0.clone().lerp(p2, 0.45).add(new THREE.Vector3(0, -len * 0.1, 0)).addScaledVector(out, len * 0.12);
        const lp = [], lr = [];
        for (let k = 0; k <= 5; k++) {
          const u = k / 5, w = 1 - u;
          lp.push(new THREE.Vector3().addScaledVector(p0, w * w).addScaledVector(p1, 2 * w * u).addScaledVector(p2, u * u));
          lr.push(Math.max(0.035, r0 * (t.hero ? 0.62 : 0.5) * (1 - 0.82 * u)));
        }
        tube(wood, lp, lr, 6, t.type, t.seed + i);
        // dark strokes for the limb and the branches off it
        for (let k = 0; k < (t.hero ? 12 : 6); k++) {
          const u = 0.15 + rand() * 0.8, seg = Math.min(4, Math.floor(u * 5));
          const dir = lp[seg + 1].clone().sub(lp[seg]).normalize();
          const at = lp[seg].clone().lerp(lp[seg + 1], u * 5 - seg);
          const twig = rand() < 0.55;
          if (twig) { dir.add(v.set(rand() - 0.5, rand() * 0.6, rand() - 0.5).multiplyScalar(1.5)).normalize(); at.addScaledVector(dir, 0.8); }
          barkDabs.push(at.x, at.y, at.z, dir.x, dir.y, dir.z, -dir.z, 0.3, dir.x, rand() * 1000, twig ? 0.09 : lr[seg] * 2.4, t.type, twig ? 1.7 + rand() * 1.5 : 1.6);
        }
        for (const u of t.hero ? [0.5, 0.68, 0.86, 1.02] : [0.7, 1.0]) {
          const w = 1 - u;
          const c = new THREE.Vector3().addScaledVector(p0, w * w).addScaledVector(p1, 2 * w * u).addScaledVector(p2, u * u);
          c.add(v.set(rand() - 0.5, rand() * 0.9, rand() - 0.5).multiplyScalar(1.6));
          treeLobes.push([c.x, c.y, c.z, (t.hero ? 2.3 : 1.25) + rand() * 1.0 + t.r * 0.6]);
        }
      }
      for (let i = 0; i < (t.hero ? 8 : 3); i++) treeLobes.push([crown.x + (rand() - 0.5) * spread * 0.9, t.y + t.h * (t.hero ? 0.92 : 0.96) + (rand() - 0.5) * 3, crown.z + (rand() - 0.5) * spread * 0.9, 1.5 + rand() * (t.hero ? 1.6 : 0.9)]);
    } else {
      const n = some ? 7 : 4;
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * spread;
        treeLobes.push([crown.x + Math.cos(a) * d, crown.y + (rand() - 0.45) * t.h * 0.3, crown.z + Math.sin(a) * d, (some ? 2.3 : 3.4) + rand() * 1.2]);
      }
    }
    const perLobe = full ? (t.hero ? 150 : 54) : some ? 20 : 11;
    const touch = full ? (t.hero ? 0.2 : 0.27) : 0.4;
    for (const [lx, ly, lz, lr] of treeLobes) {
      lobes.push(lx, ly, lz, lr);
      const away = v.set(lx - crown.x, ly - crown.y, lz - crown.z).normalize().clone();
      for (let k = 0; k < perLobe; k++) {
        const d = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().addScaledVector(away, 0.5).add(new THREE.Vector3(0, 0.15, 0)).normalize();
        const reach = lr * (0.72 + rand() * 0.4);
        const px = lx + d.x * reach, py = ly + d.y * reach, pz = lz + d.z * reach;
        const n = d.multiplyScalar(0.6).addScaledVector(v.set(px - crown.x, py - crown.y, pz - crown.z).normalize(), 0.55).normalize();
        // a tree is mostly one colour, with a branch here and there that has turned ahead of the rest
        const family = rand() < 0.14 ? Math.floor(rand() * 4) : t.family;
        leafDabs.push(px, py, pz, n.x, n.y, n.z, rand() * 1000, lr * touch * (1 + rand() * 0.6), family, 0);
      }
      // the dark of the inside of the lobe, laid first
      for (let k = 0; k < 2; k++) leafDabs.push(lx + (rand() - 0.5) * lr * 0.5, ly - lr * 0.15 * k, lz + (rand() - 0.5) * lr * 0.5, 0, -1, 0, rand() * 1000, lr * 1.25, t.family, 1);
    }

    // --- bark ---
    const marks = full ? Math.round(110 + t.r * 150) : some ? 36 : 0;
    const barkTop = Math.min(top, full ? 14 : 18);
    for (let k = 0; k < marks; k++) {
      const y = Math.pow(rand(), 1.3) * barkTop, a = rand() * Math.PI * 2;
      const p = new THREE.Vector3();
      const r = trunkAt(y, p);
      const nx = Math.cos(a), nz = Math.sin(a);
      const across = Math.min(0.5, r * (t.type === BIRCH ? 1.5 : 0.75)) * (some ? 1.5 : 1);
      barkDabs.push(p.x + nx * r, p.y, p.z + nz * r, t.lean[0], 1, t.lean[1], nx, 0, nz, rand() * 1000, across, t.type, (t.type === BIRCH ? Math.min(0.5, r * 2.3) : 1.0 + rand() * 1.5) * (some ? 1.6 : 1));
    }
  }

  // --- the understorey: saplings and bushes that hold their leaves at eye height ---
  for (let i = 0; i < 620; i++) {
    const x = (rand() - 0.5) * 150, z = -125 + rand() * 235;
    const wd = wayDist(x, z);
    if (wd < 2.3 || wd > 62 || clearingAt(x, z) > 0.6) continue;
    const y = heightAt(x, z), tall = 1.1 + rand() * rand() * 3.4;
    const family = rand() < 0.4 ? 3 : rand() < 0.6 ? 0 : rand() < 0.5 ? 1 : 2;
    const n = 3 + Math.floor(rand() * 4);
    for (let k = 0; k < n; k++) {
      const lx = x + (rand() - 0.5) * tall * 0.9, ly = y + tall * (0.45 + rand() * 0.6), lz = z + (rand() - 0.5) * tall * 0.9, lr = 0.38 + rand() * 0.5;
      for (let j = 0; j < 12; j++) {
        const d = new THREE.Vector3(rand() - 0.5, rand() - 0.3, rand() - 0.5).normalize();
        leafDabs.push(lx + d.x * lr, ly + d.y * lr, lz + d.z * lr, d.x, d.y, d.z, rand() * 1000, 0.22 + rand() * 0.2, rand() < 0.2 ? Math.floor(rand() * 4) : family, 0);
      }
      // its stem
      const dir = v.set(lx - x, ly - y, lz - z).normalize();
      barkDabs.push(x + dir.x * tall * 0.3, y + tall * 0.3, z + dir.z * tall * 0.3, dir.x, dir.y, dir.z, dir.z, 0, -dir.x, rand() * 1000, 0.05, MAPLE, tall * 0.75);
    }
  }

  // --- the shapes that carry the underpainting ---
  const woodGeometry = new THREE.BufferGeometry();
  woodGeometry.setAttribute('position', new THREE.Float32BufferAttribute(wood.position, 3));
  woodGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(wood.normal, 3));
  woodGeometry.setAttribute('aData', new THREE.Float32BufferAttribute(wood.data, 3));
  woodGeometry.setIndex(wood.index);
  const woodMaterial = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: shared,
    vertexShader: /* glsl */ `
      ${COMMON}
      in vec3 aData;
      out vec3 vWorld; out vec3 vN; out vec3 vData;
      void main() { vWorld = position; vN = normal; vData = aData; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      ${BARK}
      in vec3 vWorld; in vec3 vN; in vec3 vData;
      layout(location = 0) out vec4 outC;
      void main() {
        vec3 Nn = normalize(vN);
        float grain = texture(tNoise, vec2(atan(Nn.z, Nn.x) * 1.3 + vData.y, vWorld.y * 0.07)).r;
        vec3 c = bark(int(vData.x + 0.5), vWorld, Nn, grain, vData.z) * (0.72 + 0.3 * grain);
        outC = vec4(hazed(c, vWorld), 1.0);
      }`,
  });
  const woodMesh = new THREE.Mesh(woodGeometry, woodMaterial);
  woodMesh.frustumCulled = false;

  // --- bark, limbs and stems as dabs ---
  const nb = barkDabs.length / 13;
  const bp = new Float32Array(nb * 3), bd = new Float32Array(nb * 3), bn = new Float32Array(nb * 3), bx = new Float32Array(nb * 4);
  for (let i = 0; i < nb; i++) {
    for (let k = 0; k < 3; k++) { bp[i * 3 + k] = barkDabs[i * 13 + k]; bd[i * 3 + k] = barkDabs[i * 13 + 3 + k]; bn[i * 3 + k] = barkDabs[i * 13 + 6 + k]; }
    for (let k = 0; k < 4; k++) bx[i * 4 + k] = barkDabs[i * 13 + 9 + k];
  }
  const barkMesh = dabMesh(dabGeometry(nb, { aPos: [bp, 3], aDir: [bd, 3], aNrm: [bn, 3], aData: [bx, 4] }), dabMaterial(shared, {
    head: BARK + /* glsl */ `in vec3 aPos; in vec3 aDir; in vec3 aNrm; in vec4 aData;`,
    body: /* glsl */ `
      void makeDab(inout Dab d) {
        vec4 r = hash4(aData.x);
        int k = int(aData.z + 0.5);
        vec3 Nn = normalize(aNrm);
        float foot = aPos.y - heightAt(aPos.xz);
        vec3 c = bark(k, aPos, Nn, r.x, foot);
        d.dir = aDir;
        // a birch is banded across; here and there one of its black scars
        if (k == 1) { d.dir = cross(aDir, Nn); if (r.y < 0.16) c = vec3(0.13, 0.11, 0.15); }
        // moss on the cold side, low down
        if (k != 1 && foot < 2.2 && r.z < 0.3 * (1.0 - foot / 2.2) + 0.1 * max(-dot(Nn, uSunDir), 0.0)) c = mix(c, vec3(0.34, 0.4, 0.14) * (0.5 + 0.9 * sunAt(aPos + Nn * 0.3)), 0.8);
        // lichen, and the cold light of the sky on the shaded side
        if (r.w < 0.1) c = mix(c, vec3(0.56, 0.58, 0.4) * (0.45 + 0.6 * dot(c, vec3(0.6))), 0.7);
        else if (r.w > 0.9 && dot(Nn, uSunDir) < 0.0) c = mix(c, vec3(0.3, 0.33, 0.48), 0.6);
        c = jitter(c, r.yzw, 0.7);
        d.turnabout = 1.0;
        d.pos = aPos;
        d.size = vec2(aData.y, aData.w);
        d.c1 = hazed(c, aPos);
        d.c2 = hazed(jitter(c * 1.2 + vec3(0.02, 0.02, 0.05), r.wxy, 0.6), aPos);
        d.seed = aData.x;
        d.lift = 0.5;
      }`,
    minPx: [3, 10], maxPx: [120, 500], cells: [0, 4],
  }), 3);

  // --- leaves ---
  const nl = leafDabs.length / 10;
  const lp = new Float32Array(nl * 3), ln = new Float32Array(nl * 3), lx = new Float32Array(nl * 4);
  for (let i = 0; i < nl; i++) {
    for (let k = 0; k < 3; k++) { lp[i * 3 + k] = leafDabs[i * 10 + k]; ln[i * 3 + k] = leafDabs[i * 10 + 3 + k]; }
    for (let k = 0; k < 4; k++) lx[i * 4 + k] = leafDabs[i * 10 + 6 + k];
  }
  const leafMesh = dabMesh(dabGeometry(nl, { aPos: [lp, 3], aNrm: [ln, 3], aData: [lx, 4] }), dabMaterial(shared, {
    head: LEAF + /* glsl */ `in vec3 aPos; in vec3 aNrm; in vec4 aData;`,
    body: /* glsl */ `
      void makeDab(inout Dab d) {
        vec4 r = hash4(aData.x);
        vec4 q = hash4(aData.x + 271.3);
        vec3 toEye = cameraPosition - aPos;
        float dist = length(toEye);
        // far crowns are fewer, larger touches
        float keep = mix(1.0, 0.3, smoothstep(35.0, 130.0, dist));
        // (they leave and come back by growing, never at a stroke)
        d.alive = aData.w > 0.5 ? 1.0 : smoothstep(0.0, 1.0, (keep - q.w) / 0.12);
        if (d.alive <= 0.0) return;
        float gust = gustAt(aPos.xz);
        vec3 P = aPos;
        float high = clamp((P.y - heightAt(P.xz)) / 20.0, 0.1, 1.0);
        P.xz += uWind.xy * (gust * 0.5 + sin(uTime * (1.1 + r.x) + r.y * 30.0) * (0.05 + 0.16 * gust)) * high;
        P.y += sin(uTime * (1.7 + r.z) + r.w * 30.0) * (0.03 + 0.1 * gust) * high;
        vec3 Nn = aNrm;
        vec3 view = -toEye / dist;
        int k = int(aData.z + 0.5);
        vec3 c;
        if (aData.w > 0.5) {
          c = mix(LEAF_S[k] * 0.6, vec3(0.12, 0.1, 0.17), 0.3);
        } else {
          // a crown is never wholly dark: light comes down through all the leaves above it
          float sun = mix(0.5, 1.0, sunAt(P + Nn * 0.9));
          // a leaf with the sun behind it is a lamp: the light comes through it
          float through = pow(max(dot(view, uSunDir), 0.0), 2.0);
          float x = sun * clamp(0.55 + 0.45 * dot(Nn, uSunDir) + 0.6 * through, 0.0, 1.0);
          x *= mix(0.6, 1.0, smoothstep(-0.7, 0.1, Nn.y));
          c = paint3(LEAF_L[k], LEAF_M[k], LEAF_S[k], x, r.x);
          c = mix(c, vec3(0.2, 0.16, 0.25), (1.0 - smoothstep(0.1, 0.4, x)) * 0.14);
          // turned in a gust, the pale back of the leaf
          if (q.x < gust * 0.3) c = mix(c, vec3(1.0, 0.92, 0.6), 0.4 * sun);
        }
        c = jitter(c, r.yzw, aData.w > 0.5 ? 0.3 : 0.55);
        float turn = (q.y - 0.5) * 2.0 + sin(uTime * 3.0 + r.w * 50.0) * 0.5 * gust;
        vec3 round_ = cross(Nn, view);
        d.dir = dot(round_, round_) > 1e-4 ? normalize(round_) : vec3(0.0, 1.0, 0.0);
        d.spin = turn;
        d.pos = P;
        float s = aData.y / sqrt(aData.w > 0.5 ? 1.0 : keep);
        d.size = vec2(s, s * (aData.w > 0.5 ? 1.2 : 1.5 + 0.5 * q.z));
        d.c1 = hazed(c, P);
        d.c2 = hazed(jitter(c * 1.16, q.zxy, 0.7), P);
        d.seed = aData.x;
        d.lift = aData.w > 0.5 ? -0.2 : 0.5;
        d.turnabout = 1.0;
      }`,
    minPx: [5, 8], maxPx: [64, 100], cells: [4, 2],
  }), 4);

  // --- what stands in the sun's way ---
  const shade = new THREE.Scene();
  const black = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  shade.add(new THREE.Mesh(woodGeometry, black));
  const balls = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), black, lobes.length / 4);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < lobes.length / 4; i++) {
    const r = lobes[i * 4 + 3] * 0.36;
    m4.makeScale(r, r * 0.8, r).setPosition(lobes[i * 4], lobes[i * 4 + 1], lobes[i * 4 + 2]);
    balls.setMatrixAt(i, m4);
  }
  balls.frustumCulled = false;
  shade.add(balls);

  const group = new THREE.Group();
  group.add(woodMesh, barkMesh, leafMesh);
  return { group, shade, colliders, trees, counts: { trees: trees.length, bark: nb, leaves: nl } };
}
