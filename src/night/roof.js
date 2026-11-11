// The cabin's roof. Boards first, a solid thing: their underside, a board along each eave and up each gable, so
// that nothing can be seen between roof and wall. Then the snow on them, which is not a slab: it lies in drifts,
// deeper here than there, heaped along the ridge, rounded over at the gables and hanging over the eaves in a lip
// that the icicles come down from. In the cabin's own measure (see cabin.js).
import * as THREE from 'three';
import { noise } from '../world/noise.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SLOPE = 0.654; // the pitch: what the roof rises for each metre in from the eave
const deck = (z) => 4.25 - SLOPE * Math.abs(z); // the top of the boards; their underside is 15 cm below
const drift = (x, z) => 0.22 + 0.12 * noise(x * 0.8 + 3, z * 0.9) + 0.05 * noise(x * 2.3, z * 2.1 + 5) + 0.07 * Math.exp(-((z / 0.5) ** 2));

export function paintRoof(out) {
  const { rand } = out;
  // --- the boards ---
  const board = { grain: 'v', stroke: [0.14, 0.6] };
  out.quad([-3.55, 2.138, 3.0], [0, 1.962, -3.0], [7.1, 0, 0], 'frame', board); // the underside, south and north
  out.quad([3.55, 2.138, -3.0], [0, 1.962, 3.0], [-7.1, 0, 0], 'frame', board);
  out.quad([-3.55, 2.138, 3.0], [7.1, 0, 0], [0, 0.15, 0], 'frame', { stroke: [0.12, 0.6] }); // along the eaves
  out.quad([3.55, 2.138, -3.0], [-7.1, 0, 0], [0, 0.15, 0], 'frame', { stroke: [0.12, 0.6] });
  const barge = { stroke: [0.12, 0.6] };
  out.quad([-3.55, 2.138, 3.0], [0, 0.15, 0], [0, 1.962, -3.0], 'frame', { ...barge, grain: 'v' }); // up the gables
  out.quad([-3.55, 2.138, -3.0], [0, 1.962, 3.0], [0, 0.15, 0], 'frame', barge);
  out.quad([3.55, 2.138, 3.0], [0, 1.962, -3.0], [0, 0.15, 0], 'frame', barge);
  out.quad([3.55, 2.138, -3.0], [0, 0.15, 0], [0, 1.962, 3.0], 'frame', { ...barge, grain: 'v' });

  // --- the snow ---
  // across the roof: at each gable it comes down over the edge (how much of its depth is left: `full`)
  const xs = [-3.58, -3.68, -3.48], full = [0.04, 0.6, 1];
  for (let x = -3.2; x < 3.21; x += 0.4) { xs.push(x); full.push(1); }
  xs.push(3.48, 3.68, 3.58); full.push(1, 0.6, 0.04);
  // up the roof: three rows of lip at the eave, then the slope to the ridge
  const zs = [2.86, 2.5, 2.14, 1.78, 1.42, 1.06, 0.7, 0.35, 0];
  const NX = xs.length, NZ = 3 + zs.length;
  for (const side of [1, -1]) {
    const pos = new Float32Array(NX * NZ * 3);
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const x = xs[i], f = full[i], wave = 0.05 * noise(x * 1.1, 7.3 + side);
        let z, y;
        if (j === 0) { z = 3.03; y = 2.25; } // tucked under, against the eave board
        else if (j === 1) { z = 3.13 + wave; y = 2.25 + 0.1 * f; }
        else if (j === 2) { z = 3.09 + wave; y = 2.25 + 0.25 * f; }
        else { z = zs[j - 3]; y = deck(z) + drift(x, z * side) * f; }
        pos.set([x, y, z * side], (i + j * NX) * 3);
      }
    }
    const lip = [], field = [];
    for (let j = 0; j < NZ - 1; j++) {
      for (let i = 0; i < NX - 1; i++) {
        const a = i + j * NX, b = a + 1, c = b + NX, d = a + NX;
        (j < 2 ? lip : field).push(...(side > 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c]));
      }
    }
    const whole = new THREE.BufferGeometry();
    whole.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    whole.setIndex([...lip, ...field]);
    whole.computeVertexNormals(); // rounded, so that the moon models the drifts
    const part = (index) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', whole.attributes.position); g.setAttribute('normal', whole.attributes.normal); g.setIndex(index); return g; };
    const still = new THREE.Matrix4();
    // on the slope the strokes are long and run down it, laid thick over one another; on the lip they are short
    // and run along the eave
    out.add(part(field), still, 'snow', { smooth: true, free: true, lift: 0.02, grain: V(0, -0.55, side * 0.84), stroke: [0.3, 0.62], density: 2.1 });
    out.add(part(lip), still, 'snow', { smooth: true, grain: V(1, 0, 0), stroke: [0.15, 0.32], density: 1.7 });
    // what the brush adds last: pale touches along the backs of the drifts, deep blue ones in their hollows
    const nrm = V(0, 0.84, side * 0.55);
    for (let i = 0; i < 260; i++) {
      const x = -3.3 + 6.6 * rand(), z = (0.15 + 2.6 * rand()) * side, d = drift(x, z) - 0.22;
      const at = V(x, deck(z) + drift(x, z) + 0.05, z), run = V(1, (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.5);
      if (d > 0.05) out.stroke(at, nrm, run, 0.07, 0.24 + 0.2 * rand(), 'ice', 1, 0.01);
      else if (d < -0.06 && i % 2) out.stroke(at, nrm, V(0.3, -0.55, side * 0.84), 0.2, 0.45 + 0.3 * rand(), 'snow', 0.72, 0.01);
    }
    // icicles from under the lip
    for (let i = 0; i < 26; i++) {
      const x = -3.4 + 6.8 * rand(), len = 0.14 + 0.45 * rand() * rand();
      out.stroke(V(x, 2.26 - len / 2, side * 3.07), V(0, 0, side), V(0, 1, 0), 0.045, len, 'ice', 1, 0.01);
    }
  }
}
