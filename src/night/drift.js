// Snow in the air: spindrift the wind lifts off the crust and runs along the ground in gusts, and a few slow
// crystals drifting down. Both travel in a box of air that goes with the eye. Near the lantern they light up warm.
import { dabMaterial, dabGeometry, dabMesh } from '../oilpaint/dabs.js';
import { NIGHT } from './paint.js';

export function createDrift(shared, count = 2400) {
  return dabMesh(dabGeometry(count), dabMaterial(shared, {
    head: NIGHT,
    body: /* glsl */ `
      const vec3 BOX = vec3(56.0, 14.0, 56.0);
      void makeDab(inout Dab d) {
        float id = float(gl_InstanceID);
        vec4 r = hash4(id * 1.13 + 3.0);
        vec4 q = hash4(id * 2.71 + 19.0);
        bool flake = q.x > 0.7;
        vec3 p = r.xyz * BOX;
        p.xz += uWind.xy * uTime * (flake ? 1.2 + 1.5 * q.y : 5.0 + 6.0 * q.y);
        if (flake) {
          p.y -= uTime * (0.35 + 0.4 * r.w);
          p.xz += vec2(sin(uTime * (0.7 + q.z) + q.w * 20.0), cos(uTime * (0.9 + q.w) + q.z * 20.0)) * 0.5;
        }
        vec3 origin = vec3(cameraPosition.x, uFocus.y + 5.0, cameraPosition.z);
        p = mod(p - origin + BOX * 0.5, BOX) - BOX * 0.5 + origin;
        float ground = heightAt(p.xz);
        float edge = 1.0 - smoothstep(BOX.x * 0.36, BOX.x * 0.5, distance(p.xz, cameraPosition.xz));
        if (flake) {
          d.alive = smoothstep(ground, ground + 0.4, p.y) * edge;
          d.size = vec2(0.028 + 0.02 * q.z);
          d.cell = 4.0;
        } else {
          float gust = gustAt(p.xz);
          p.y = ground + 0.05 + 0.5 * r.y * r.y + 0.12 * sin(uTime * 3.0 + q.z * 30.0) * gust;
          d.alive = smoothstep(0.35, 0.7, gust + (q.w - 0.5) * 0.4) * edge;
          d.dir = normalize(vec3(uWind.x, 0.12 * sin(uTime * 2.0 + q.w * 9.0), uWind.y));
          d.size = vec2(0.035, 0.5 + 0.7 * q.z);
        }
        if (d.alive <= 0.0 || inRoom(p.xz)) { d.alive = 0.0; return; }
        vec3 c = mix(vec3(0.28, 0.46, 0.56), vec3(0.46, 0.68, 0.72), q.z) * (flake ? 0.8 : 1.0) * (0.45 + 0.55 * woodSunAt(p));
        c = mix(c, vec3(0.95, 0.74, 0.46), clamp(lampAt(p, normalize(uLamp.xyz - p)) * 1.3, 0.0, 0.75));
        d.pos = p;
        d.c1 = hazed(c, p);
        d.c2 = d.c1 * 1.15;
        d.seed = id;
        d.lift = 0.0;
      }`,
    uniforms: { uImpasto: { value: 0.3 } },
    minPx: [1.6, 2.4], maxPx: [6, 160], cells: [0, 3],
  }), 6);
}
