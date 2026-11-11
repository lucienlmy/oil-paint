// Leaves coming down. Each is one small dab that falls, drifts with the wind and turns over as it goes, in a box of
// air that travels with the eye. A gust shakes more of them loose. Where one crosses a shaft of sun it lights.
import { dabMaterial, dabGeometry, dabMesh } from '../oilpaint/dabs.js';

export function createLeaves(shared, count = 2400) {
  const mesh = dabMesh(dabGeometry(count), dabMaterial(shared, {
    body: /* glsl */ `
      const vec3 BOX = vec3(64.0, 26.0, 64.0);
      void makeDab(inout Dab d) {
        float id = float(gl_InstanceID);
        vec4 r = hash4(id * 1.13 + 3.0);
        vec4 q = hash4(id * 2.71 + 19.0);
        float fall = 0.9 + 1.3 * r.w;
        vec3 p = r.xyz * BOX;
        p.y -= uTime * fall;
        p.xz += uWind.xy * uTime * (0.6 + 1.6 * q.x) + vec2(sin(uTime * (0.7 + q.y) + q.z * 20.0), cos(uTime * (0.9 + q.w) + q.x * 20.0)) * 0.6;
        vec3 origin = vec3(cameraPosition.x, uFocus.y + 11.0, cameraPosition.z);
        p = mod(p - origin + BOX * 0.5, BOX) - BOX * 0.5 + origin;
        float ground = heightAt(p.xz);
        float gust = gustAt(p.xz);
        // most hang on until a gust; all vanish into the carpet
        d.alive = smoothstep(q.z * 0.75 - 0.08, q.z * 0.75 + 0.05, gust + 0.2) * smoothstep(ground, ground + 0.5, p.y) * (1.0 - smoothstep(BOX.x * 0.38, BOX.x * 0.5, distance(p.xz, cameraPosition.xz)));
        if (d.alive <= 0.0) return;
        float sun = sunAt(p);
        float turnOver = sin(uTime * (2.0 + 3.0 * q.y) + q.w * 30.0);
        vec3 c = q.x < 0.5 ? vec3(1.0, 0.76, 0.2) : q.x < 0.8 ? vec3(0.98, 0.5, 0.12) : vec3(0.86, 0.22, 0.1);
        c = mix(c * vec3(0.36, 0.3, 0.36), c, sun * (0.72 + 0.28 * turnOver));
        d.pos = p;
        d.dir = normalize(vec3(sin(uTime * 1.3 + q.z * 9.0), turnOver, cos(uTime * 1.7 + q.x * 9.0)));
        d.size = vec2(0.085, 0.13) * (0.7 + 0.7 * r.x) * (0.55 + 0.45 * abs(turnOver));
        d.c1 = hazed(jitter(c, r.zxy, 0.4), p);
        d.c2 = d.c1 * 1.12;
        d.seed = id;
        d.lift = 0.0;
      }`,
    minPx: [2.5, 3.5], maxPx: [24, 36], cells: [4, 2],
  }), 6);
  return { mesh };
}
