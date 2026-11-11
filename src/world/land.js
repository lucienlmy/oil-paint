// The ground of the wood: gentle rises and hollows, a worn way winding north through the trees to a clearing
// where the canopy opens. The same height is used by the picture (a map the shaders read), by the wanderer's feet
// (a height field for the physics) and by everything that is planted on it.
import * as THREE from 'three';
import { COMMON, EXTENT, LAND_RES } from '../oilpaint/common.js';

import { noise, rng } from './noise.js';
export { noise, rng };

// --- the way through ---------------------------------------------------------------------------------------------
const WAY = [[2, 96], [0, 80], [-7, 56], [3, 32], [10, 6], [3, -20], [-5, -44], [4, -68], [10, -90]];
export const START = { x: 0, z: 78 };
export const CLEARING = { x: 11, z: -96, r: 21 };
const waySamples = [];
{
  const at = (i) => WAY[Math.max(0, Math.min(WAY.length - 1, i))];
  for (let i = 0; i < WAY.length - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let k = 0; k < 24; k++) {
      const t = k / 24, t2 = t * t, t3 = t2 * t;
      const c = (a, b, c_, d) => 0.5 * (2 * b + (-a + c_) * t + (2 * a - 5 * b + 4 * c_ - d) * t2 + (-a + 3 * b - 3 * c_ + d) * t3);
      waySamples.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  waySamples.push(WAY[WAY.length - 1]);
}
export const way = waySamples;
/** Metres from (x, z) to the middle of the way. */
export function wayDist(x, z) {
  let best = Infinity;
  for (let i = 0; i < waySamples.length - 1; i++) {
    const [ax, az] = waySamples[i], [bx, bz] = waySamples[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) best = d;
  }
  return best;
}
export const clearingAt = (x, z) => {
  const d = Math.hypot(x - CLEARING.x, z - CLEARING.z) + noise(x * 0.11, z * 0.11) * 3.5;
  return 1 - Math.min(1, Math.max(0, (d - CLEARING.r * 0.72) / (CLEARING.r * 0.5)));
};

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function rawHeight(x, z, wd) {
  let h = 2.8 * noise(x / 74 + 3.1, z / 74 - 1.7) + 1.2 * noise(x / 26, z / 26) + 0.3 * noise(x / 8.3, z / 8.3);
  h += 5.5 * sstep(70, -110, z); // the land climbs gently toward the clearing
  h -= 0.28 * Math.exp(-(wd * wd) / 3.2); // the way is worn a little into it
  return h;
}

// --- maps ------------------------------------------------------------------------------------------------------
const N = LAND_RES;
const heights = new Float32Array(N * N);
const land = new Uint8Array(N * N * 4);
/**
 * Works the maps out, a million points of ground. It takes a second or so, so it stops every few rows and waits
 * for `pause(done 0..1)`, which lets the page breathe. Nothing here can be used before it has finished.
 */
export async function prepareLand(pause) {
 for (let j = 0; j < N; j++) {
  if (pause && j % 24 === 0) await pause(j / N);
  for (let i = 0; i < N; i++) {
    const x = -EXTENT + (i / (N - 1)) * 2 * EXTENT, z = -EXTENT + (j / (N - 1)) * 2 * EXTENT;
    const near = Math.abs(x) < 60 && z > -130 && z < 110;
    const wd = near ? wayDist(x, z) : 99;
    heights[i + j * N] = rawHeight(x, z, wd);
    const k = (i + j * N) * 4;
    const ragged = noise(x * 0.9, z * 0.9) * 0.35 + noise(x * 0.23, z * 0.23) * 0.5;
    land[k] = Math.round(255 * (1 - sstep(0.75, 1.9, wd + ragged)));
    land[k + 1] = Math.round(255 * clearingAt(x, z));
    land[k + 2] = Math.round(255 * Math.min(1, Math.max(0, 0.5 + 0.6 * noise(x / 17 + 9, z / 17) + 0.3 * noise(x / 5, z / 5 + 4))));
    land[k + 3] = 255;
  }
 }
}
/** Height of the ground at (x, z), read from the same map the picture uses. */
export function heightAt(x, z) {
  const fx = Math.min(N - 1.001, Math.max(0, ((x + EXTENT) / (2 * EXTENT)) * (N - 1)));
  const fz = Math.min(N - 1.001, Math.max(0, ((z + EXTENT) / (2 * EXTENT)) * (N - 1)));
  const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
  const a = heights[i + j * N], b = heights[i + 1 + j * N], c = heights[i + (j + 1) * N], d = heights[i + 1 + (j + 1) * N];
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
}

export function createLand(shared) {
  const tHeight = new THREE.DataTexture(heights, N, N, THREE.RedFormat, THREE.FloatType);
  tHeight.minFilter = tHeight.magFilter = THREE.LinearFilter;
  tHeight.needsUpdate = true;
  const tLand = new THREE.DataTexture(land, N, N);
  tLand.minFilter = tLand.magFilter = THREE.LinearFilter;
  tLand.needsUpdate = true;
  shared.tHeight.value = tHeight;
  shared.tLand.value = tLand;

  // the ground itself only carries the underpainting: a dark warm tone that shows between the dabs laid over it
  // it lies a few centimetres under the true ground, so that no facet of it can cover a leaf lying on the ground
  const seg = 512;
  const geometry = new THREE.PlaneGeometry(2 * EXTENT, 2 * EXTENT, seg, seg);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)) - 0.04);
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: shared,
    vertexShader: /* glsl */ `
      ${COMMON}
      out vec3 vWorld;
      void main() { vWorld = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      in vec3 vWorld;
      layout(location = 0) out vec4 outC;
      void main() {
        vec4 m = texture(tLand, landUv(vWorld.xz));
        // laid in broadly first: warm where the sun falls, plum where it doesn't
        // asked square by ragged square, so that what shows between the dabs is itself in touches
        vec2 sq = floor(vWorld.xz / 0.32 + (texture(tNoise, vWorld.xz / 2.3).rg - 0.5) * 1.8) * 0.32;
        float lit = step(0.5, woodSunAt(vec3(sq.x, vWorld.y + 0.2, sq.y)));
        vec3 c = mix(vec3(0.3, 0.16, 0.16), vec3(0.72, 0.44, 0.14), lit);
        c = mix(c, mix(vec3(0.21, 0.17, 0.2), vec3(0.6, 0.47, 0.33), lit), m.r);
        c *= 0.78 + 0.3 * texture(tNoise, vWorld.xz / 9.0).r;
        outC = vec4(hazed(c, vWorld), 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;

  /** Heights for the physics: `cells` squares a side over the middle `half` metres, column by column. */
  function heightField(cells = 384, half = 192) {
    const out = new Float32Array((cells + 1) * (cells + 1));
    for (let col = 0; col <= cells; col++) {
      for (let row = 0; row <= cells; row++) {
        out[row + col * (cells + 1)] = heightAt(-half + (col / cells) * 2 * half, -half + (row / cells) * 2 * half);
      }
    }
    return { heights: out, cells, half };
  }
  return { mesh, heightField };
}
