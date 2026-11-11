// How much of the picture changes from one frame to the next while he stands still and nobody touches anything.
// Paint that swaps places shows as whole strokes changing colour between two frames a sixtieth of a second apart.
//   node tools/jitter.mjs [--dist dist] [--query "scene=aurora"] [--at "x,z,fx,fz"] [--out shots/work/jitter] [--pairs 8]
// Prints, for a 16 by 9 grid over the picture, the share of pixels (in thousandths) that changed by more than a
// tenth of full scale, averaged over the pairs; then the worst cells, and how far the eye itself moved.
// Saves the frame it looked at (frame.png). Headless and muted.
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { guard } from './no-pointer-lock.mjs';

guard(chromium);
const here = resolve(fileURLToPath(import.meta.url), '..', '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const out = resolve(here, flag('out', 'shots/work/jitter'));
const at = flag('at', '4,30,10,6').split(',').map(Number);
const pairs = Number(flag('pairs', 8));
const nudge = Number(flag('nudge', 0)); // --nudge mm: the eye is fixed where it stood and slid this far sideways each frame
const gap = Number(flag('gap', 1)); // --gap n: frames between the two that are compared
const over = Number(flag('over', 26)); // --over n: a pixel counts as changed past this many of 255
mkdirSync(out, { recursive: true });
const root = resolve(here, flag('dist', 'dist'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  let file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/?capture&nopad&${/scene=/.test(flag('query', '')) ? '' : 'scene=autumn&'}${flag('query', '')}`);
await page.waitForFunction(() => window.lab?.ready, null, { timeout: 120000 });
await page.evaluate(([x, z, fx, fz]) => {
  const L = window.lab;
  L.teleport(x, z, fx, fz);
  L.setInput(() => ({ move: { x: 0, y: 0 }, walk: false, sprint: false, strafe: false, jump: false, look: { x: 0, y: 0 }, zoom: 0, device: 'keyboard' }));
  L.step(1 / 60, 150);
}, at);
await page.screenshot({ path: join(out, 'frame.png') });
const result = await page.evaluate(([pairs, over, gap, nudge]) => {
  if (nudge) { const c = window.lab.camera, t = c.getWorldDirection(new window.lab.THREE.Vector3()).multiplyScalar(50).add(c.position); window.lab.view(c.position.toArray(), t.toArray()); }
  const L = window.lab, gl = L.renderer.getContext();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, GX = 16, GY = 9;
  const grab = () => { if (nudge) { L.follow.free.position.x += nudge / 1000; L.follow.free.target.x += nudge / 1000; } L.step(1 / 60, gap); const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
  const cells = new Float64Array(GX * GY);
  let eye = 0, before = grab(), last = L.camera.position.clone();
  for (let p = 0; p < pairs; p++) {
    const now = grab();
    eye = Math.max(eye, L.camera.position.distanceTo(last)); last = L.camera.position.clone();
    for (let y = 0; y < H; y++) {
      const gy = GY - 1 - Math.floor((y / H) * GY); // readPixels starts at the bottom
      for (let x = 0; x < W; x++) {
        const i = (x + y * W) * 4;
        const d = Math.max(Math.abs(now[i] - before[i]), Math.abs(now[i + 1] - before[i + 1]), Math.abs(now[i + 2] - before[i + 2]));
        if (d > over) cells[Math.floor((x / W) * GX) + gy * GX]++;
      }
    }
    before = now;
  }
  const per = (W / GX) * (H / GY) * pairs;
  return { grid: Array.from(cells, (c) => Math.round((c / per) * 1000)), eye, GX, GY };
}, [pairs, over, gap, nudge]);
const rows = [];
for (let y = 0; y < result.GY; y++) rows.push(result.grid.slice(y * result.GX, (y + 1) * result.GX).map((v) => String(v).padStart(4)).join(''));
console.log(rows.join('\n'));
const total = result.grid.reduce((a, b) => a + b, 0) / result.grid.length;
console.log(`whole picture: ${total.toFixed(2)} thousandths changed a frame; the eye moved at most ${(result.eye * 1000).toFixed(2)} mm a frame`);
await browser.close();
server.close();
