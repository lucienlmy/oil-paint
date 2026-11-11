// His tracks. Each footfall leaves a print in the snow that stays: a hollow in shade, and a lip of snow on its far
// side that the moon catches. They are strokes lying on the ground like the snow's own, laid just above them.
import { dabMaterial, dabGeometry, dabMesh } from '../oilpaint/dabs.js';
import { NIGHT } from './paint.js';

export function createTracks(shared, count = 900) {
  // two strokes a print: the hollow, then the lip
  const pos = new Float32Array(count * 2 * 3), data = new Float32Array(count * 2 * 4);
  const geometry = dabGeometry(count * 2, { aPos: [pos, 3], aData: [data, 4] }, true);
  const mesh = dabMesh(geometry, dabMaterial(shared, {
    head: NIGHT + /* glsl */ `in vec3 aPos; in vec4 aData;`,
    body: /* glsl */ `
      void makeDab(inout Dab d) {
        if (aData.y < 0.5) { d.alive = 0.0; return; }
        vec4 r = hash4(aData.z);
        vec3 Nn = normalAt(aPos.xz);
        if (texture(tLand, landUv(aPos.xz)).r > 0.5) { d.alive = 0.0; return; } // rock keeps no prints
        vec3 P = vec3(aPos.x, heightAt(aPos.xz), aPos.z);
        float x = moonOn(P, Nn);
        vec3 ahead = vec3(sin(aData.x), 0.0, cos(aData.x));
        vec3 c;
        if (aData.w < 0.5) {
          c = mix(vec3(0.05, 0.1, 0.27), vec3(0.13, 0.26, 0.47), x * 0.7 + (r.x - 0.5) * 0.2);
          d.dir = ahead;
          d.size = vec2(0.17, 0.37) * (0.9 + 0.2 * r.y);
          d.height = 0.2;
        } else {
          vec3 away = normalize(vec3(-uSunDir.x, 0.0, -uSunDir.z));
          P += away * 0.1;
          c = snowPaint(x + 0.25, r.x, auroraOn(P.xz, Nn), 0.2) * 1.08;
          d.dir = cross(vec3(0.0, 1.0, 0.0), away) + ahead * 0.4;
          d.size = vec2(0.06, 0.3);
          d.height = 0.23;
        }
        c = lampOn(c, aData.w < 0.5 ? vec3(0.5, 0.42, 0.5) : vec3(0.95), P, Nn);
        d.pos = P;
        d.c1 = hazed(c, P);
        d.c2 = hazed(c * 1.15, P);
        d.seed = aData.z;
        d.lie = 1.0;
        d.nrm = Nn;
        d.glaze = 1.0;
        d.cell = aData.w < 0.5 ? 4.0 + step(0.5, r.z) : floor(r.z * 2.99);
      }`,
    minPx: [1.5, 3], maxPx: [4000, 4000], cells: [0, 8],
  }), 4);

  let next = 0, since = 0, left = false, lastX = null, lastZ = 0;
  function put(x, z, yaw) {
    for (const lip of [0, 1]) {
      const i = next * 2 + lip;
      pos.set([x, 0, z], i * 3);
      data.set([yaw, 1, (next * 7.31 + lip * 3.7) % 1000, lip], i * 4);
    }
    next = (next + 1) % count;
    geometry.attributes.aPos.needsUpdate = true;
    geometry.attributes.aData.needsUpdate = true;
  }
  return {
    mesh,
    /** A print each stride while he is on the ground: feet {x, z}, the way he faces, his speed. */
    update(feet, yaw, speed, grounded) {
      if (lastX == null) { lastX = feet.x; lastZ = feet.z; return; }
      const moved = Math.hypot(feet.x - lastX, feet.z - lastZ);
      lastX = feet.x; lastZ = feet.z;
      if (!grounded || moved > 3) return; // in the air, or put somewhere else
      since += moved;
      const stride = 0.62 + 0.09 * Math.min(speed, 6);
      if (since < stride) return;
      since = 0;
      left = !left;
      const side = left ? 0.1 : -0.1;
      put(feet.x + Math.cos(yaw) * side, feet.z - Math.sin(yaw) * side, yaw);
    },
    /** Tracks already there when the picture opens: along `line(z) -> x` from z0 to z1. */
    lay(line, z0, z1) {
      const dir = Math.sign(z1 - z0);
      for (let z = z0; (z1 - z) * dir > 0; z += dir * 0.72) {
        const x = line(z), yaw = Math.atan2(line(z + dir) - x, dir);
        left = !left;
        const side = (left ? 0.1 : -0.1) + (Math.sin(z * 12.9898) * 0.03);
        put(x + Math.cos(yaw) * side, z - Math.sin(yaw) * side, yaw);
      }
    },
  };
}
