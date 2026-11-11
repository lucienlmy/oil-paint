// The lantern he carries: the only warm thing out in the night. It hangs by its handle from his closed right hand
// and swings a little behind his steps, and everything painted near it takes its light (uLamp in the painter). The
// flame and its glow are strokes of light, like the aurora's.
import * as THREE from 'three';
import { dabMaterial, dabGeometry, dabMesh } from '../oilpaint/dabs.js';

const TOP = 0.18; // from the middle of the lantern up to the top of its handle, where the hand has it

export function createLantern(shared) {
  const object = new THREE.Group();
  object.rotation.order = 'YXZ';
  const dark = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.045, 0.05) });
  const glass = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.8, 0.42) });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.15, 6), glass);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.06, 6), dark);
  cap.position.y = 0.105;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.025, 6), dark);
  base.position.y = -0.085;
  // the handle: an arch that stands on two lugs set into the rim of the cap
  const bail = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.008, 5, 12, Math.PI), dark);
  bail.position.y = 0.115;
  object.add(body, cap, base, bail);
  for (const x of [-0.062, 0.062]) {
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.055, 0.018), dark);
    lug.position.set(x, 0.095, 0);
    object.add(lug);
  }
  for (let i = 0; i < 3; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.16, 0.008), dark);
    bar.position.set(Math.cos(i * 2.094) * 0.058, 0, Math.sin(i * 2.094) * 0.058);
    object.add(bar);
  }

  const count = 22;
  const glow = dabMesh(dabGeometry(count), dabMaterial(shared, {
    body: /* glsl */ `
      void makeDab(inout Dab d) {
        float id = float(gl_InstanceID);
        vec4 r = hash4(id * 7.3 + 2.0);
        float a = r.x * TAU + uTime * 0.2 * (r.w - 0.5);
        vec3 out_ = normalize(vec3(cos(a), (r.y - 0.45) * 1.6, sin(a)));
        bool flame = id < 3.5;
        float flicker = 0.85 + 0.15 * sin(uTime * (7.0 + 9.0 * r.z) + r.w * 30.0);
        d.pos = uLamp.xyz + (flame ? vec3(0.0) : out_ * (0.1 + 0.3 * r.z));
        d.dir = flame ? vec3(0.0, 1.0, 0.0) : out_;
        d.size = flame ? vec2(0.11, 0.17) : vec2(0.14, 0.34) * (0.6 + 0.9 * r.w);
        d.c1 = (flame ? vec3(1.0, 0.9, 0.62) * 0.55 : uLampCol * 0.13 / (1.0 + 3.0 * r.z)) * flicker * uLamp.w;
        d.c2 = d.c1 * 1.3;
        d.seed = id;
        d.lift = 0.0;
      }`,
    uniforms: { uImpasto: { value: 0.3 } },
    minPx: [3, 5], maxPx: [300, 600], cells: [0, 6],
  }), 21);
  const m = glow.material;
  m.transparent = true;
  m.blending = THREE.AdditiveBlending;
  m.alphaToCoverage = false;
  m.depthWrite = false;

  let swing = 0, swingV = 0, lastX = null, lastZ = 0;
  return {
    object,
    glow,
    /** Hangs it by the top of its handle from `grip` (where his fist is); it swings a little behind his steps. */
    update(dt, grip, yaw) {
      if (lastX == null) { lastX = grip.x; lastZ = grip.z; }
      const vx = (grip.x - lastX) / Math.max(dt, 1e-3), vz = (grip.z - lastZ) / Math.max(dt, 1e-3);
      lastX = grip.x; lastZ = grip.z;
      // a pendulum driven by the hand's travel along the way he faces
      const along = Math.max(-6, Math.min(6, vx * Math.sin(yaw) + vz * Math.cos(yaw)));
      swingV += (-swing * 30 - swingV * 3.5 - along * 0.9) * dt;
      swing = Math.max(-0.6, Math.min(0.6, swing + swingV * dt));
      object.position.set(grip.x + Math.sin(yaw) * Math.sin(swing) * TOP, grip.y - Math.cos(swing) * TOP, grip.z + Math.cos(yaw) * Math.sin(swing) * TOP);
      object.rotation.set(-swing, yaw, 0);
      shared.uLamp.value.set(object.position.x, object.position.y + 0.02, object.position.z, 1);
    },
  };
}
