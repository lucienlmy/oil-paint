// Patch's block demo helper: talks to the block's page on Patch (the "patch-block" messages) so a
// demo only says what changes. Put this file in the release beside index.html, then:
//
//   import { patchBlock } from "./patch-block.js";
//   const block = patchBlock({
//     ...recipe.block,            // optional: your recipe's controls, presets and triggers
//     onSet(id, value) {},        // a control changed (a value that fits it)
//     onTrigger(id) {},           // a trigger was pressed
//     onVisible(visible) {},      // pause, and draw nothing new, while false
//   });
//   // Warm up: compile shaders, load all the controls can reach, play first-use effects once.
//   block.progress(0.4, "Building shaders");  // how far along, 0 to 1, as the warm-up goes
//   block.ready();
//   block.state({ wind: 4 });     // the demo changed a control itself
//
// With controls, values that don't fit are dropped and the demo starts at the defaults; with
// presets, a preset is applied through onSet (or onPreset(id, values) does it). Stats (fps, and
// the slowest frame of each second in ms) are measured and sent while the demo can be seen.
// patch-block.classic.js is the same as a plain <script>, defining window.patchBlock.
export function patchBlock(options = {}) {
  const CHANNEL = "patch-block";
  const ID = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
  const COLOR = /^#[0-9a-f]{6}$/i;
  const { controls, presets, triggers, onSet, onPreset, onTrigger, onVisible } = options;
  const known = controls && new Map(controls.map((control) => [control.id, control]));
  const presetValues = presets && new Map(presets.map((preset) => [preset.id, preset.values]));
  const triggerIds = triggers && new Set(triggers.map((trigger) => trigger.id));
  const page = window.parent;
  const embedded = page && page !== window;
  /** The page's origin, from its hello; until then, "*" (the demo only sends its own state). */
  let origin = "*";
  let ready = false;
  let visible = true;
  /** While a preset is applied: the demo's own changes go out in the one state after it. */
  let applying = false;
  /** The latest progress until the next hello, in case the page wasn't listening for it yet. */
  let unheard = null;
  const values = {};
  for (const control of controls ?? []) {
    const fallback = { number: control.min, choice: control.options?.[0]?.value, toggle: false };
    values[control.id] = control.default ?? fallback[control.type] ?? "#ffffff";
  }

  /** A value as it fits the control, or undefined. Without controls, any plain value does. */
  const fitting = (id, value) => {
    const control = known?.get(id);
    if (!control) {
      if (known || typeof id !== "string" || !ID.test(id)) return undefined;
      const plain = typeof value === "string" || typeof value === "boolean";
      return plain || Number.isFinite(value) ? value : undefined;
    }
    switch (control.type) {
      case "number":
        return Number.isFinite(value) && !(value < control.min) && !(value > control.max)
          ? value
          : undefined;
      case "choice":
        return control.options?.some((option) => option.value === value) ? value : undefined;
      case "toggle":
        return typeof value === "boolean" ? value : undefined;
      case "color":
        return typeof value === "string" && COLOR.test(value) ? value.toLowerCase() : undefined;
    }
  };
  const record = (changes) => {
    const fitted = {};
    for (const [id, value] of Object.entries(changes ?? {})) {
      const fits = fitting(id, value);
      if (fits === undefined) continue;
      values[id] = fits;
      fitted[id] = fits;
    }
    return fitted;
  };
  // A handler that throws is reported and doesn't stop the messages after it.
  const call = (handler, ...args) => {
    try {
      handler?.(...args);
    } catch (error) {
      console.error(error);
    }
  };
  const send = (type, fields) => {
    if (embedded) page.postMessage({ channel: CHANNEL, type, ...fields }, origin);
  };
  const sendState = () => send("state", { values: { ...values } });

  // Stats: frames a second and the slowest frame, about once a second, while it can be seen.
  let frame = 0;
  let last = -1;
  let since = 0;
  let frames = 0;
  let slowest = 0;
  const round = (n) => Math.round(n * 10) / 10;
  const tick = (now) => {
    frame = window.requestAnimationFrame(tick);
    if (last < 0) since = now;
    else {
      frames += 1;
      slowest = Math.max(slowest, now - last);
    }
    last = now;
    if (now - since < 1000) return;
    send("stats", { fps: round((frames * 1000) / (now - since)), ms: round(slowest) });
    since = now;
    frames = 0;
    slowest = 0;
  };
  const measure = () => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    if (!embedded || !ready || !visible) return;
    // A paused stretch isn't a slow frame: start counting afresh.
    last = -1;
    frames = 0;
    slowest = 0;
    frame = window.requestAnimationFrame(tick);
  };

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!embedded || event.source !== page || message?.channel !== CHANNEL) return;
    if (origin !== "*" && event.origin !== origin) return;
    const { type, id } = message;
    if (type === "hello") {
      if (event.origin !== "null") origin = event.origin;
      if (ready) {
        send("ready");
        sendState();
      } else if (unheard) {
        send("progress", unheard);
        unheard = null;
      }
    } else if (type === "visible") {
      if (typeof message.visible !== "boolean" || message.visible === visible) return;
      visible = message.visible;
      call(onVisible, visible);
      measure();
    } else if (!ready) {
      return; // Controls wait for ready, as the page's do.
    } else if (type === "set") {
      const value = fitting(id, message.value);
      if (value === undefined) return;
      values[id] = value;
      call(onSet, id, value);
    } else if (type === "preset") {
      if (typeof id !== "string" || !ID.test(id)) return;
      if (presetValues ? !presetValues.has(id) : !onPreset) return;
      applying = true;
      try {
        const fitted = record(presetValues?.get(id));
        if (onPreset) call(onPreset, id, fitted);
        else for (const [control, value] of Object.entries(fitted)) call(onSet, control, value);
      } finally {
        applying = false;
      }
      sendState();
    } else if (type === "trigger") {
      if (typeof id === "string" && (triggerIds ? triggerIds.has(id) : ID.test(id))) {
        call(onTrigger, id);
      }
    }
  });

  return {
    /** Says how far the warm-up is, from 0 to 1, with a few words for it if you like. */
    progress(value, label) {
      if (ready || !Number.isFinite(value) || value < 0 || value > 1) return;
      unheard = typeof label === "string" ? { value, label } : { value };
      send("progress", unheard);
    },
    /** Says the demo is ready, with its state: call it once it's warmed up. */
    ready() {
      ready = true;
      send("ready");
      sendState();
      if (!frame) measure();
    },
    /** Records controls the demo changed itself and sends every value to the page. */
    state(changes) {
      record(changes);
      if (ready && !applying) sendState();
    },
    /** Every control's current value, by id. */
    get values() {
      return { ...values };
    },
    /** Whether the demo can be seen; while false, pause and draw nothing new. */
    get visible() {
      return visible;
    },
  };
}
