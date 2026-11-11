// Leaves kicked up by running feet: a handful of dabs thrown up and back from each footfall, which tumble, catch
// the light and settle. Kept on the CPU, since there are only a couple of hundred and each has its own short life.
import * as THREE from 'three';
import { dabMaterial, dabGeometry, dabMesh } from '../oilpaint/dabs.js';

export function createKick(shared, count = 260) {
  const pos = new Float32Array(count * 3), data = new Float32Array(count * 4), vel = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) data[i * 4] = Math.random() * 1000;
  const geometry = dabGeometry(count, { aPos: [pos, 3], aData: [data, 4] }, true);
  const mesh = dabMesh(geometry, dabMaterial(shared, {
    head: /* glsl */ `in vec3 aPos; in vec4 aData;`,
    body: /* glsl */ `
      void makeDab(inout Dab d) {
        d.alive = smoothstep(0.0, 0.25, aData.y);
        if (d.alive <= 0.0) return;
        vec4 r = hash4(aData.x);
        float sun = sunAt(aPos + vec3(0.0, 0.1, 0.0));
        float turnOver = sin(uTime * (5.0 + 6.0 * r.y) + r.w * 30.0) * aData.z;
        vec3 c = r.x < 0.5 ? vec3(1.0, 0.76, 0.2) : r.x < 0.8 ? vec3(0.98, 0.5, 0.12) : vec3(0.86, 0.22, 0.1);
        c = mix(c * vec3(0.42, 0.3, 0.34), c, sun * (0.75 + 0.25 * turnOver));
        d.pos = aPos;
        d.dir = normalize(vec3(sin(uTime * 4.0 * aData.z + r.z * 9.0), 0.4 + turnOver, cos(uTime * 3.0 * aData.z + r.x * 9.0)));
        d.size = vec2(0.09, 0.14) * (0.7 + 0.6 * r.z) * (0.6 + 0.4 * abs(turnOver));
        d.c1 = hazed(jitter(c, r.zxy, 0.4), aPos);
        d.c2 = d.c1 * 1.12;
        d.seed = aData.x;
        d.lift = 0.0;
      }`,
    minPx: [2.5, 3.5], maxPx: [30, 44], cells: [4, 2],
  }), 6);
  let next = 0, owed = 0;
  return {
    mesh,
    /** feet: where he is; forward: unit (x, z) of his travel; speed m/s. */
    update(dt, feet, forward, speed, grounded, ground) {
      owed += grounded && speed > 2.4 ? dt * speed * 5.5 : 0;
      while (owed >= 1) {
        owed -= 1;
        const i = next; next = (next + 1) % count;
        const side = (Math.random() - 0.5) * 2;
        pos[i * 3] = feet.x - forward.x * 0.25 - forward.z * side * 0.28;
        pos[i * 3 + 1] = feet.y + 0.05;
        pos[i * 3 + 2] = feet.z - forward.z * 0.25 + forward.x * side * 0.28;
        const up = 1.0 + Math.random() * 2.4, back = -0.4 + Math.random() * 1.6;
        vel[i * 3] = forward.x * (speed * 0.45 - back) - forward.z * side * 1.7;
        vel[i * 3 + 1] = up;
        vel[i * 3 + 2] = forward.z * (speed * 0.45 - back) + forward.x * side * 1.7;
        data[i * 4 + 1] = 1;
        data[i * 4 + 2] = 1;
      }
      for (let i = 0; i < count; i++) {
        if (data[i * 4 + 1] <= 0) continue;
        const k = i * 3;
        const drag = Math.exp(-2.2 * dt);
        vel[k] *= drag; vel[k + 2] *= drag;
        vel[k + 1] = Math.max(vel[k + 1] - 6.5 * dt, -1.3); // a leaf falls slowly
        vel[k] += Math.sin(data[i * 4] + pos[k + 1] * 9) * dt * 2.0;
        pos[k] += vel[k] * dt; pos[k + 1] += vel[k + 1] * dt; pos[k + 2] += vel[k + 2] * dt;
        const g = ground(pos[k], pos[k + 2]) + 0.04;
        if (pos[k + 1] <= g) { pos[k + 1] = g; vel[k] = vel[k + 2] = 0; data[i * 4 + 2] = 0; data[i * 4 + 1] -= dt * 1.6; } else data[i * 4 + 1] -= dt * 0.35;
      }
      geometry.attributes.aPos.needsUpdate = true;
      geometry.attributes.aData.needsUpdate = true;
    },
  };
}
