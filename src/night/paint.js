// The night's palette, shared by everything painted in it: snow and rock under a low moon, the green of the aurora
// falling on whatever faces the sky, and the sky itself. Needs COMMON before it and `uGlow` among the uniforms.
export const NIGHT = /* glsl */ `
uniform vec3 uGlow; // x: how strongly the aurora burns just now (about 0.6..1.3)
uniform vec4 uWarm[3]; // the cabin's lit openings: where each is, and how strong (+ it looks south, - north)
uniform vec4 uRoom; // the cabin's floor: its middle (x, z) and half its width and depth

// Indoors: no snow lies there and none blows through.
bool inRoom(vec2 xz) { return abs(xz.x - uRoom.x) < uRoom.z && abs(xz.y - uRoom.y) < uRoom.w; }
// The light of the cabin's windows and door on what is outside them: a wedge that widens away from each opening.
float warmAt(vec3 P, vec3 Nn) {
  float sum = 0.0;
  for (int i = 0; i < 3; i++) {
    vec3 to = uWarm[i].xyz - P;
    float front = sign(uWarm[i].w) * (P.z - uWarm[i].z);
    float d2 = dot(to, to);
    float wedge = smoothstep(0.0, 0.8, front) * smoothstep(0.35, 1.3, front / (abs(to.x) + 0.4));
    sum += abs(uWarm[i].w) * wedge * clamp(dot(Nn, to) * inversesqrt(d2 + 1e-4) * 0.6 + 0.5, 0.0, 1.0) / (1.0 + d2 * 0.3);
  }
  return sum;
}

// How lit a spot is by the moon, for paint3: flat snow is in the light, ground turned from the moon in half-tone,
// and whatever the horns' shadow covers in shade.
float moonOn(vec3 P, vec3 Nn) {
  return woodSunAt(P + Nn * 0.6 + vec3(0.0, 0.3, 0.0)) * clamp(dot(Nn, uSunDir) * 1.4 + 0.06, 0.0, 1.0);
}
// The aurora's light comes down in slow patches that wander over the land; only what faces the sky takes it.
float auroraOn(vec2 xz, vec3 Nn) {
  float patch_ = texture(tNoise, xz / 900.0 + vec2(uTime * 0.009, -uTime * 0.0055)).r;
  return clamp(uGlow.x * smoothstep(0.2, 0.75, patch_) * max(Nn.y, 0.0), 0.0, 0.85);
}
// Snow: a blue white under the moon, mint where the aurora is on it. kind drifts slowly over the ground:
// packed snow, wind crust (greyer), and now and then blue ice.
vec3 snowPaint(float x, float r, float a, float kind) {
  vec3 L = mix(vec3(0.42, 0.6, 0.74), vec3(0.3, 0.68, 0.64), a);
  vec3 M = mix(vec3(0.16, 0.29, 0.46), vec3(0.1, 0.36, 0.42), a);
  vec3 S = mix(vec3(0.05, 0.1, 0.25), vec3(0.035, 0.13, 0.23), a);
  float crust = smoothstep(0.52, 0.66, kind), ice = smoothstep(0.8, 0.9, kind);
  L = mix(L, L * vec3(0.84, 0.9, 0.9), crust); M = mix(M, M * vec3(0.9, 0.96, 0.92), crust);
  L = mix(L, vec3(0.26, 0.58, 0.72), ice); M = mix(M, vec3(0.07, 0.28, 0.44), ice);
  return paint3(L, M, S, x, r);
}
// Rock: nearly black, blue in the shade, a grey green where the moon finds it; kind moves it between a cold
// slate and a warmer, browner stone.
vec3 rockPaint(float x, float r, float kind) {
  vec3 L = mix(vec3(0.12, 0.2, 0.28), vec3(0.16, 0.17, 0.27), smoothstep(0.45, 0.7, kind));
  vec3 M = mix(vec3(0.04, 0.07, 0.12), vec3(0.06, 0.06, 0.115), smoothstep(0.45, 0.7, kind));
  vec3 S = vec3(0.012, 0.024, 0.055);
  return paint3(L, M, S, x, r);
}

// Paint in the lantern's light is a warm colour of its own, not the night's colour with orange added (that only
// greys it): the nearer the lamp, the more wholly a thing is its own colour in that light.
vec3 lampOn(vec3 c, vec3 own, vec3 P, vec3 Nn) {
  float k = clamp((lampAt(P, Nn) + warmAt(P, Nn)) * 1.55, 0.0, 1.0);
  float whole = pow(k, 1.1);
  vec3 warm = own * vec3(1.0, 0.72, 0.38);
  // (the second part keeps the edge of the pool a warm light on the snow, where a plain mix of blue shade and
  // orange would go to mud)
  return mix(c, warm, whole) + warm * 0.4 * k * (1.0 - whole);
}

// The sky with nothing in it: deep above, a green teal low down where the aurora's light hangs in the air, and a
// pale ring round the moon.
vec3 nightSky(vec3 v) {
  if (v.y < 0.0) return airColour(v);
  float up = pow(clamp(v.y, 0.0, 1.0), 0.5);
  vec3 c = mix(vec3(0.04, 0.15, 0.2), vec3(0.01, 0.036, 0.09), up);
  float north = max(-v.z, 0.0) / max(length(v.xz), 1e-4);
  c += vec3(0.015, 0.11, 0.08) * north * north * exp(-pow((v.y - 0.24) / 0.3, 2.0)) * uGlow.x;
  float moon = max(dot(v, uSunDir), 0.0);
  c += vec3(0.1, 0.14, 0.18) * pow(moon, 30.0) + vec3(0.25, 0.3, 0.32) * pow(moon, 600.0);
  return mix(airColour(v), c, smoothstep(0.0, 0.06, v.y));
}
// Where the aurora is, roughly, for things that only catch its glow (water).
vec3 auroraSoft(vec3 v) {
  float az = atan(v.x, -v.z);
  float band = exp(-pow((v.y - 0.3 - 0.05 * sin(az * 3.0 + uTime * 0.02)) / 0.13, 2.0));
  float low = 0.55 * exp(-pow((v.y - 0.17) / 0.06, 2.0));
  return vec3(0.08, 0.6, 0.38) * (band + low) * smoothstep(1.7, 0.4, abs(az)) * uGlow.x;
}
`;
