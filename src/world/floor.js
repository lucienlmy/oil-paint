// The forest floor: a carpet of fallen leaves laid in dabs that lie flat on the ground, and over it the upward
// flicks of bracken, fern and grass.
//
// Every dab belongs to one small square of ground for good: its place, the way it lies and its colour come from
// that square's number and never change. What changes with distance is only which of them are drawn. Far off, one
// dab in four stands for its neighbours and is drawn larger to cover for them; one in sixteen further still. As
// the eye comes nearer that dab shrinks toward its true size where it lies, and the ones it stood for grow in
// round it. Nothing moves, nothing is swapped for something else, and nothing is stored.
import * as THREE from 'three';
import { groundRings } from '../oilpaint/ground.js';

// leaf litter: gold, orange, russet, brown, moss; and the bare earth of the way
export const LITTER = /* glsl */ `
const vec3 LIT_L[6] = vec3[6](vec3(0.97, 0.71, 0.2), vec3(0.94, 0.5, 0.13), vec3(0.8, 0.25, 0.11), vec3(0.64, 0.45, 0.28), vec3(0.56, 0.62, 0.2), vec3(0.74, 0.58, 0.42));
const vec3 LIT_M[6] = vec3[6](vec3(0.74, 0.47, 0.15), vec3(0.7, 0.33, 0.11), vec3(0.58, 0.18, 0.11), vec3(0.45, 0.3, 0.21), vec3(0.34, 0.42, 0.15), vec3(0.5, 0.38, 0.3));
const vec3 LIT_S[6] = vec3[6](vec3(0.43, 0.25, 0.2), vec3(0.4, 0.19, 0.18), vec3(0.33, 0.12, 0.17), vec3(0.25, 0.18, 0.22), vec3(0.16, 0.25, 0.2), vec3(0.27, 0.22, 0.27));
// r is this dab's own chance; v drifts slowly over the ground, so leaves of a kind lie together
int litterKind(float r, float v, float moss, float way) {
  if (r < way * 0.62) return 5;
  if (fract(r * 7.31) < moss * 0.1) return 4;
  return v < 0.42 ? 0 : v < 0.7 ? 1 : v < 0.84 ? 2 : 3;
}
vec3 litter(int k, float lit, float r) { return paint3(LIT_L[k], LIT_M[k], LIT_S[k], lit, r); }
`;

const carpet = /* glsl */ `
void makeDab(inout Dab d) {
  vec2 cell; float sub;
  if (!ringCell(0.0, true, cell, sub)) { d.alive = 0.0; return; }
  vec4 r = hash4(cell, sub * 3.0 + 1.0);
  vec4 q = hash4(cell + 31.7, sub + 11.0);
  vec2 xz = (cell + r.xy) * uCell0;
  float lod;
  d.alive = ringGrow(distance(xz, cameraPosition.xz), lod);
  if (d.alive <= 0.0) return;
  vec3 P = vec3(xz.x, heightAt(xz), xz.y);
  vec3 Nn = normalAt(xz);
  vec4 m = texture(tLand, landUv(xz));
  float lit = woodSunAt(P + vec3(0.0, 0.2, 0.0)) * clamp(dot(Nn, uSunDir) * 2.4, 0.0, 1.0);
  float patch_ = texture(tNoise, xz / 13.0).r * 1.9 + texture(tNoise, xz / 3.7).g * 0.5;
  int kind = litterKind(q.x, fract(patch_ + (q.z - 0.5) * 0.3), m.b, m.r);
  vec3 c1 = litter(kind, lit, q.y);
  int other = litterKind(q.z, fract(patch_ + 0.2 + (q.w - 0.5) * 0.5), m.b, m.r * 0.5);
  vec3 c2 = litter(other, lit, q.w);
  // the open ground of the clearing is grass gone to gold
  vec3 gl = paint3(vec3(0.95, 0.8, 0.36), vec3(0.62, 0.52, 0.2), vec3(0.2, 0.2, 0.2), lit, q.y);
  float grassy = step(r.z, m.g * 0.8);
  c1 = mix(c1, gl, grassy);
  // here and there a wet leaf in the shade gives back the sky
  if (lit < 0.2 && q.w > 0.93) c1 = mix(vec3(0.34, 0.36, 0.52), vec3(0.2, 0.17, 0.26), q.z);
  c1 = jitter(c1, r.wzy, 0.5);
  c2 = jitter(c2, q.wzy, 0.5);
  // leaves lie any way round, though those that fell together lie much alike
  float a = (texture(tNoise, xz / 6.3).a * 1.2 + q.y * 0.8) * TAU;
  d.dir = vec3(cos(a), 0.0, sin(a));
  d.pos = P;
  d.size = uCell0 * vec2(1.05 + 0.5 * r.z, 1.7 + 0.9 * r.w) * lod;
  d.c1 = hazed(c1, P);
  d.c2 = hazed(c2, P);
  d.seed = dot(cell, vec2(1.0, 57.0)) + sub * 0.37;
  d.turnabout = 1.0;
  d.lie = 1.0;
  d.nrm = Nn;
  d.height = (0.03 + 0.07 * q.z) * pow(lod, 0.35);
  d.glaze = 1.0;
}
`;

// undergrowth: clumps of bracken, fern and grass. Each frond or blade is one flick of the brush, and the flicks of
// a clump fan out from its foot. A clump keeps its place and its height; far off there are fewer, a little broader.
const growth = /* glsl */ `
void makeDab(inout Dab d) {
  vec2 cell; float sub;
  if (!ringCell(40.0, false, cell, sub)) { d.alive = 0.0; return; }
  vec4 r = hash4(cell, 40.0);
  vec4 q = hash4(cell + 17.3, 51.0);
  vec4 f = hash4(cell + sub * 7.7 + 3.1, sub * 13.0 + 3.0);
  vec2 foot = (cell + r.xy) * uCell0;
  float lod;
  d.alive = ringGrow(distance(foot, cameraPosition.xz), lod);
  if (d.alive <= 0.0) return;
  vec4 m = texture(tLand, landUv(foot));
  // it grows in drifts, keeps off the way, and fills the clearing
  float drift = smoothstep(0.46, 0.7, texture(tNoise, foot / 37.0).a);
  float chance = max(0.05 + 0.8 * drift, m.g) * (1.0 - m.r);
  if (q.x > chance) { d.alive = 0.0; return; }
  float grass = step(q.z, max(m.g * 1.1, 0.22));           // a tuft of grass rather than a fern
  float kind = fract(q.y * 3.7 + floor(texture(tNoise, foot / 14.0).r * 3.0) * 0.33);
  float big = min(pow(lod, 0.6), 2.2);
  float a = (sub + f.x) / 6.0 * TAU + r.z * TAU;
  vec2 fan = vec2(cos(a), sin(a));
  vec2 xz = foot + fan * mix(0.1, 0.03, grass) * big;
  vec3 P = vec3(xz.x, heightAt(xz), xz.y);
  float gust = gustAt(xz);
  float lit = sunAt(P + vec3(0.0, 0.3, 0.0));
  vec3 c;
  if (grass > 0.5) c = paint3(vec3(1.0, 0.88, 0.46), vec3(0.76, 0.6, 0.24), vec3(0.3, 0.27, 0.2), lit, f.w);
  else if (kind < 0.45) c = paint3(vec3(0.98, 0.58, 0.16), vec3(0.68, 0.36, 0.13), vec3(0.34, 0.18, 0.16), lit, f.w);   // bracken turned rust
  else if (kind < 0.75) c = paint3(vec3(1.0, 0.82, 0.26), vec3(0.72, 0.54, 0.15), vec3(0.34, 0.26, 0.16), lit, f.w);    // fern gone yellow
  else c = paint3(vec3(0.66, 0.74, 0.25), vec3(0.34, 0.45, 0.16), vec3(0.13, 0.23, 0.17), lit, f.w);                     // still green
  c = jitter(c, f.zwx, 0.55);
  float sway = sin(uTime * (1.6 + f.z) + f.w * 40.0) * (0.04 + 0.1 * gust);
  vec2 lean = fan * mix(0.9 + 1.3 * f.y, 0.12 + 0.4 * f.y, grass) + uWind.xy * (0.08 + 0.6 * gust + sway);
  d.dir = normalize(vec3(lean.x, 1.0, lean.y));
  d.pos = P - vec3(0.0, 0.02, 0.0);
  float tall = mix(0.45, 0.85, f.z) * mix(1.0, 1.3, m.g) * mix(0.72, 1.0, grass);
  // a frond is a broad curved stroke that arches over; a blade of grass a thin straight one
  d.size = vec2(mix(0.17, 0.04, grass) * big * (0.8 + 0.5 * f.x), tall);
  d.cell = grass > 0.5 ? floor(f.y * 2.99) : (f.x > 0.5 ? 3.0 : 7.0);
  d.c1 = hazed(c, P);
  d.c2 = hazed(jitter(c * 1.2, f.xzy, 0.8), P);
  d.seed = dot(cell, vec2(1.0, 57.0)) + sub * 0.37 + 0.5;
  d.base = 1.0;
  d.lift = 0.25;
}
`;

export function createFloor(shared) {
  const carpetRings = groundRings(shared, { head: LITTER, body: carpet, per: 3, n: 192, cell0: 0.14, levels: 6, minPx: [5, 9], maxPx: [4000, 4000], cells: [0, 8] });
  const growthRings = groundRings(shared, { head: LITTER, body: growth, per: 6, n: 96, cell0: 0.42, levels: 4, minPx: [2.5, 12], maxPx: [60, 420], cells: [0, 4] });
  const group = new THREE.Group();
  group.add(carpetRings.group, growthRings.group);
  return { group, follow(x, z) { carpetRings.follow(x, z); growthRings.follow(x, z); } };
}
