// The small things in the cabin: what makes a room somebody's. Shadows laid on the floor away from the fire, the
// moon's light through the south window, highlights where the fire finds glass and iron, frost in the corners of
// the panes, the table laid, things hung from the rafters, a painting on the wall. All in the cabin's own measure
// (see cabin.js): +x east, +z south, y up from the floor.
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** room: the kit the room is built with; lid: the ceiling's. */
export function paintDetails(room, lid) {
  const rand = room.rand;
  const flat = (cx, cz, sx, sz, y, pal, opts) => room.quad([cx - sx / 2, y, cz + sz / 2], [sx, 0, 0], [0, 0, -sz], pal, opts);
  /** A thin straight thing from a to b. */
  const rod = (kit, a, b, thick, pal, opts = {}) => {
    const A = V(...a), B = V(...b), m = new THREE.Matrix4().lookAt(A, B, V(0.01, 1, 0.02));
    m.setPosition(A.clone().add(B).multiplyScalar(0.5));
    kit.add(new THREE.BoxGeometry(thick, thick, A.distanceTo(B)), m, pal, { grain: B.clone().sub(A).normalize(), stroke: [thick * 1.1, 0.16], ...opts });
  };
  const ball = (x, y, z, r, pal, opts = {}) => room.add(new THREE.SphereGeometry(r, 7, 5), room.place(x, y, z), pal, { smooth: true, stroke: [r * 0.7, r * 1.1], ...opts });
  /** One bright touch where the fire is given back: n is the way the surface faces there. */
  const glint = (x, y, z, n, size = 0.035) => room.stroke(V(x, y, z), V(...n).normalize(), V(0.2, 1, 0.1), size * 0.55, size, 'glint', 1, 0.014);
  /** A single touch on a wall that faces the way n does. */
  const touch = (x, y, z, n, run, across, along, pal, tone = 1) => room.stroke(V(x, y, z), n, run, across, along, pal, tone, 0.006);

  // --- shadows on the floor, thrown away from the fire ---
  const shade = (cx, cz, sx, sz) => flat(cx, cz, sx, sz, 0.027, 'umbra', { stroke: [0.09, 0.24], density: 1.7 });
  shade(1.2, 0.62, 1.55, 0.92); // under the table and beyond it
  shade(1.2, 1.42, 0.5, 0.36); shade(0.2, 0.98, 0.5, 0.36); // the stools
  shade(-1.16, -1.05, 0.72, 0.6); // the chair
  shade(1.95, -1.3, 2.0, 0.2); shade(0.62, -1.33, 0.56, 0.16); // along the bed and the chest
  shade(-2.4, 1.72, 0.2, 1.2); // the dresser's foot
  shade(-1.5, -1.62, 0.4, 0.34); // the basket

  // --- the moon through the south window, lying on the boards in four panes: the one cool thing on the floor ---
  {
    const o = V(0.07, 0.029, 1.72), u = V(1.1, 0, 0), v = V(1.6, 0, -0.62);
    for (const i of [0, 1]) for (const j of [0, 1]) {
      const at = o.clone().addScaledVector(u, i * 0.53).addScaledVector(v, j * 0.53);
      room.quad(at.toArray(), u.clone().multiplyScalar(0.47).toArray(), v.clone().multiplyScalar(0.47).toArray(), 'moon', { grain: 'v', stroke: [0.1, 0.26], density: 2.2 });
    }
  }

  // --- the table, laid ---
  flat(0.9, 0.6, 1.3, 0.24, 0.794, 'crimson', { stroke: [0.05, 0.14] }); // a runner down the middle, edged
  flat(0.9, 0.735, 1.3, 0.03, 0.796, 'ochre', { stroke: [0.025, 0.1] }); flat(0.9, 0.465, 1.3, 0.03, 0.796, 'ochre', { stroke: [0.025, 0.1] });
  ball(1.11, 0.9, 0.7, 0.045, 'crimson'); ball(1.19, 0.9, 0.76, 0.045, 'green'); ball(1.16, 0.905, 0.66, 0.04, 'crimson'); // apples in the bowl
  glint(1.1, 0.94, 0.72, [-0.6, 0.7, -0.2], 0.025); glint(1.18, 0.94, 0.76, [-0.6, 0.7, -0.2], 0.025);
  room.round(0.5, 0.8, 0.33, 0.11, 0.012, 'cream', { stroke: [0.04, 0.07] }); // a plate: cheese, and the knife beside it
  room.box(0.5, 0.835, 0.33, 0.09, 0.05, 0.06, 'ochre', { stroke: [0.03, 0.05], rotY: 0.5 });
  rod(room, [0.34, 0.8, 0.27], [0.56, 0.8, 0.2], 0.012, 'iron');
  room.round(1.4, 0.89, 0.8, 0.06, 0.2, 'cream', { top: 0.042, stroke: [0.04, 0.08] }); // a jug, a band of blue round it
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; room.stroke(V(1.4 + Math.cos(a) * 0.058, 0.88, 0.8 + Math.sin(a) * 0.058), V(Math.cos(a), 0, Math.sin(a)), V(-Math.sin(a), 0, Math.cos(a)), 0.018, 0.045, 'blue', 1, 0.006); }
  glint(1.36, 0.93, 0.76, [-0.7, 0.4, -0.5]); glint(1.29, 0.86, 0.4, [-0.8, 0.4, -0.2], 0.025);

  // --- the hearth ---
  for (let i = 0; i < 16; i++) touch(-2.598, 1.21 + 0.22 * rand(), -0.55 + 1.1 * rand(), V(1, 0, 0), V(0, 1, (rand() - 0.5) * 0.5), 0.07, 0.17, 'soot', 0.8 + 0.5 * rand()); // smoke has stained the stone over it
  room.round(-2.74, 0.62, 0, 0.11, 0.16, 'iron', { top: 0.14, stroke: [0.05, 0.09] }); // a pot hung over the fire
  rod(room, [-2.74, 0.72, 0], [-2.74, 1.19, 0], 0.014, 'iron');
  glint(-2.63, 0.66, 0.04, [1, 0.3, 0.2]);
  rod(room, [-2.06, 0.09, -0.86], [-2.5, 1.02, -0.74], 0.018, 'iron'); rod(room, [-2.0, 0.09, -0.74], [-2.46, 0.95, -0.68], 0.018, 'iron'); // the fire irons
  room.box(-2.03, 0.1, -0.74, 0.12, 0.02, 0.1, 'iron', { stroke: [0.04, 0.06] });
  glint(-2.14, 0.3, 0.74, [0.4, 0.7, -0.6]); glint(-2.59, 1.71, -0.72, [1, 0.4, 0.2]); glint(-2.62, 1.67, -0.48, [1, 0.4, 0.2], 0.025); glint(-2.6, 1.74, 0.28, [1, 0.4, -0.2]);
  glint(-2.93, 1.67, -1.3, [1, 0.1, 0.3], 0.05); glint(-2.93, 1.47, -1.71, [1, 0.1, 0.3], 0.04); // the pans on the wall

  // --- rafters, and what hangs from them ---
  for (const x of [-0.9, 0.9]) lid.box(x, 2.44, 0, 0.16, 0.16, 4.8, 'wood', { grain: 'z', stroke: [0.14, 0.6], tone: 0.72 });
  const down = new THREE.Matrix4().makeRotationX(Math.PI);
  for (const [z, pal] of [[-1.5, 'green'], [-1.12, 'ochre'], [-0.74, 'green'], [1.9, 'ochre']]) { // herbs, drying
    room.add(new THREE.ConeGeometry(0.09, 0.34, 6), room.place(-0.9, 2.14, z).multiply(down), pal, { stroke: [0.03, 0.1], grain: V(0, 1, 0), tone: 0.85 });
    rod(room, [-0.9, 2.3, z], [-0.9, 2.37, z], 0.012, 'wood');
  }
  for (let i = 0; i < 6; i++) ball(0.9 + (i % 2 ? 0.035 : -0.035), 2.3 - i * 0.075, -1.6, 0.045, i % 3 ? 'cream' : 'ochre'); // a braid of onions
  // a lamp hung over the table
  rod(room, [0.9, 2.36, 0.6], [0.9, 2.08, 0.6], 0.012, 'iron');
  room.round(0.9, 2.06, 0.6, 0.085, 0.03, 'iron', { top: 0.03, stroke: [0.04, 0.05] });
  room.round(0.9, 1.985, 0.6, 0.045, 0.11, 'flame', { stroke: [0.03, 0.06] });
  room.round(0.9, 1.92, 0.6, 0.06, 0.025, 'iron', { stroke: [0.04, 0.05] });

  // --- frost in the corners of every pane ---
  const frost = (o, ux, w, h, n) => {
    for (const [px, py] of [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5]]) for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) for (let i = 0; i < (cy ? 2 : 4); i++) {
      const sx = cx ? -1 : 1, sy = cy ? -1 : 1, a = (0.1 + 0.8 * rand()) * Math.PI / 2, len = 0.05 + 0.09 * rand();
      const dx = Math.cos(a) * sx, dy = Math.sin(a) * sy;
      const p = V(...o).addScaledVector(ux, (px + cx * 0.5) * w + sx * 0.035 + dx * len / 2).add(V(0, (py + cy * 0.5) * h + sy * 0.03 + dy * len / 2, 0));
      room.stroke(p, n, V(0, dy, 0).addScaledVector(ux, dx), 0.024, len, 'frost', 0.7 + 0.5 * rand(), 0.002);
    }
  };
  frost([-0.9, 1.0, -2.385], V(1, 0, 0), 1.2, 0.9, V(0, 0, 1));
  frost([-1.7, 1.0, 2.385], V(1, 0, 0), 1.1, 0.9, V(0, 0, -1));
  frost([2.985, 1.0, 0.1], V(0, 0, 1), 1.2, 0.9, V(-1, 0, 0));
  // on the sills: a plant in a pot to the south, two books to the east
  room.round(-1.45, 1.05, 2.3, 0.055, 0.1, 'crimson', { top: 0.07, stroke: [0.04, 0.07] });
  room.add(new THREE.ConeGeometry(0.1, 0.24, 6), room.place(-1.45, 1.22, 2.3), 'green', { stroke: [0.03, 0.09], grain: V(0, 1, 0) });
  room.box(2.9, 1.02, 1.06, 0.14, 0.04, 0.2, 'blue', { stroke: [0.04, 0.1] }); room.box(2.9, 1.06, 1.05, 0.13, 0.035, 0.18, 'crimson', { stroke: [0.04, 0.1], rotY: 0.2 });

  // --- the bed: stitching along every seam of the quilt, a second pillow, a little needlework on the first ---
  for (let i = 1; i < 5; i++) for (let z = -2.33; z < -1.37; z += 0.085) room.stroke(V(0.95 + 0.28 * i, 0.542, z), V(0, 1, 0), V(0, 0, 1), 0.012, 0.05, 'cream', 1, 0.004);
  for (let j = 1; j < 3; j++) for (let x = 0.98; x < 2.34; x += 0.085) room.stroke(V(x, 0.542, -2.36 + 0.333 * j), V(0, 1, 0), V(1, 0, 0), 0.012, 0.05, 'cream', 1, 0.004);
  room.box(2.42, 0.66, -1.62, 0.3, 0.1, 0.32, 'teal', { stroke: [0.06, 0.12], rotY: 0.3 });
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; room.stroke(V(2.6 + Math.cos(a) * 0.12, 0.688, -1.86 + Math.sin(a) * 0.2), V(0, 1, 0), V(-Math.sin(a), 0, Math.cos(a)), 0.02, 0.05, i % 2 ? 'crimson' : 'blue', 1, 0.004); }
  // jam on a shelf over the bed's head
  room.box(2.88, 1.6, -1.75, 0.2, 0.035, 1.0, 'wood', { grain: 'z' });
  ['crimson', 'ochre', 'crimson', 'green', 'ochre'].forEach((pal, i) => {
    const z = -2.15 + i * 0.2;
    room.round(2.88, 1.69, z, 0.055, 0.14, pal, { stroke: [0.035, 0.07] });
    room.round(2.88, 1.77, z, 0.058, 0.025, 'cream', { stroke: [0.03, 0.05] });
    glint(2.83, 1.71, z + 0.02, [-1, 0.3, 0.3], 0.03);
  });

  // --- books: a band of gilt on a spine here and there; mugs on hooks under the shelf ---
  for (const y of [1.25, 1.75]) for (let i = 0; i < 9; i++) touch(-2.6 + rand() * (y > 1.5 ? 0.8 : 1.15), y + 0.1 + 0.1 * rand(), -2.188, V(0, 0, 1), V(1, 0, 0), 0.012, 0.035, 'ochre', 1.3);
  ['teal', 'cream', 'crimson', 'ochre'].forEach((pal, i) => room.round(-2.5 + i * 0.27, 1.13, -2.3, 0.04, 0.08, pal, { stroke: [0.03, 0.05] }));

  // --- the plates on the dresser, each with a rim of blue ---
  {
    const n = V(0.98, -0.2, 0), up = V(0.2, 0.98, 0), across = V(0, 0, 1);
    for (const y of [1.33, 1.71]) for (const z of [1.33, 1.61, 1.89, 2.17]) for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, c = V(-2.69, y, z).addScaledVector(n, 0.016);
      room.stroke(c.addScaledVector(up, Math.sin(a) * 0.085).addScaledVector(across, Math.cos(a) * 0.085), n, up.clone().multiplyScalar(Math.cos(a)).addScaledVector(across, -Math.sin(a)), 0.016, 0.034, 'blue', 1, 0.004);
    }
  }

  // --- the rug: diamonds down its middle, a fringe at its end ---
  for (const x of [-1.6, -0.95, -0.3]) {
    for (const [a, y, pal] of [[0.2, 0.058, 'ochre'], [0.1, 0.062, 'blue']]) room.quad([x, y, 0.1 + a], [a, 0, -a], [-a, 0, -a], pal, { stroke: [0.05, 0.1] });
  }
  for (let z = -0.68; z < 0.9; z += 0.055) room.stroke(V(0.25, 0.031, z), V(0, 1, 0), V(1, 0, (rand() - 0.5) * 0.4), 0.018, 0.1, 'cream', 0.8 + 0.3 * rand(), 0.002);

  // --- by the door: a mat, his other boots and the melt round them, skis in the corner ---
  flat(1.75, 2.05, 0.9, 0.5, 0.03, 'ochre', { stroke: [0.05, 0.14], tone: 0.8 });
  flat(1.75, 2.17, 0.9, 0.05, 0.034, 'crimson', { stroke: [0.03, 0.1] }); flat(1.75, 1.93, 0.9, 0.05, 0.034, 'crimson', { stroke: [0.03, 0.1] });
  flat(2.6, 1.85, 0.6, 0.5, 0.028, 'teal', { stroke: [0.06, 0.14], tone: 0.55, density: 0.7 });
  for (const z of [1.78, 1.94]) { room.box(2.62, 0.14, z, 0.1, 0.26, 0.11, 'soot', { stroke: [0.05, 0.1], tone: 1.6 }); room.box(2.56, 0.05, z, 0.22, 0.08, 0.11, 'soot', { stroke: [0.05, 0.1], tone: 1.6 }); }
  rod(room, [2.8, 0.03, 2.12], [2.9, 1.95, 2.3], 0.07, 'crimson', { stroke: [0.05, 0.3] }); rod(room, [2.68, 0.03, 2.2], [2.8, 1.92, 2.32], 0.07, 'crimson', { stroke: [0.05, 0.3] });
  rod(room, [2.58, 0.03, 2.28], [2.62, 1.5, 2.34], 0.02, 'wood');
  // snowshoes hung between the window and the door
  for (const x of [-0.22, 0.14]) {
    room.add(new THREE.TorusGeometry(0.16, 0.016, 4, 12), room.place(x, 1.5, 2.36, 0, [0.62, 1.5, 1]), 'wood', { stroke: [0.02, 0.08] });
    for (const dy of [-0.08, 0.02, 0.12]) rod(room, [x - 0.09, 1.5 + dy, 2.36], [x + 0.09, 1.5 + dy, 2.36], 0.01, 'cream');
  }

  // --- the chair's cushion ---
  room.box(-1.45, 0.475, -1.0, 0.44, 0.05, 0.44, 'teal', { stroke: [0.06, 0.12] });

  // --- on the east wall: a small painting of an autumn wood, with someone in a blue cloak walking through it ---
  {
    const n = V(-1, 0, 0), up = V(0, 1, 0), x = 2.95;
    room.box(2.975, 1.5, -0.6, 0.03, 0.54, 0.68, 'wood', { tone: 0.65 });
    room.quad([2.957, 1.27, -0.9], [0, 0, 0.6], [0, 0.46, 0], 'ochre', { stroke: [0.05, 0.09], tone: 0.95 });
    for (let i = 0; i < 9; i++) touch(x, 1.29 + 0.05 * rand(), -0.88 + 0.56 * rand(), n, V(0, 0.1, 1), 0.03, 0.09, 'fur', 0.7 + 0.5 * rand()); // the floor of the wood
    for (const z of [-0.84, -0.71, -0.47, -0.38]) touch(x, 1.5, z, n, up, 0.022 + 0.012 * rand(), 0.34, 'soot', 1.4); // trunks
    for (let i = 0; i < 16; i++) touch(x, 1.56 + 0.14 * rand(), -0.88 + 0.56 * rand(), n, V(0, rand() - 0.5, 1), 0.04, 0.07, i % 3 ? 'crimson' : 'fur', 0.9 + 0.3 * rand()); // the leaves
    touch(x - 0.002, 1.5, -0.6, n, V(0, 1, 0.5), 0.018, 0.2, 'glint', 0.75); // a shaft of sun
    touch(x - 0.003, 1.365, -0.6, n, up, 0.026, 0.06, 'blue', 1.2); touch(x - 0.004, 1.402, -0.6, n, V(0, 0, 1), 0.012, 0.036, 'glint', 0.9); // and the wanderer
  }
}
