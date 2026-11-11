// Measures the built page as it really runs: its own frame loop, no frame cap, the wanderer running up the way.
//   node tools/fps.mjs [--size 1920x1080] [--query "quality=low"] [--seconds 8]
// Prints frames a second and the slowest frames. Headless and muted. For a number that means anything the GPU
// has to be quiet: take the lab's lock (C:/Users/drini/src/patch-lab/tools/gpu-lock.sh <name> -- node tools/fps.mjs).
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { guard } from 'file:///C:/Users/drini/Patch/seeds/no-pointer-lock.mjs';

guard(chromium);
const here = resolve(fileURLToPath(import.meta.url), '..', '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const [width, height] = flag('size', '1920x1080').split('x').map(Number);
const seconds = Number(flag('seconds', 8));
const root = resolve(here, 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  let file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const exe = 'C:/Users/drini/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${server.address().port}/?nopad&clean&${flag('query', '')}`);
await page.waitForFunction(() => window.lab?.ready, null, { timeout: 120000 });
console.log(`ready in ${Date.now() - t0} ms`);
const result = await page.evaluate(async (seconds) => {
  const L = window.lab;
  L.setInput((dt) => ({ move: { x: 0, y: 1 }, walk: false, sprint: false, strafe: false, jump: false, look: { x: 0.25 * dt, y: 0 }, zoom: 0, device: 'keyboard' }));
  await new Promise((r) => setTimeout(r, 1500));
  const times = [];
  let last = performance.now();
  await new Promise((done) => {
    const end = last + seconds * 1000;
    const tick = () => { const now = performance.now(); times.push(now - last); last = now; if (now < end) requestAnimationFrame(tick); else done(); };
    requestAnimationFrame(tick);
  });
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  return { frames: times.length, fps: Math.round(1000 / mean), median: +times[times.length >> 1].toFixed(2), p99: +times[Math.floor(times.length * 0.99)].toFixed(2), worst: +times[times.length - 1].toFixed(2) };
}, seconds);
console.log(JSON.stringify(result), problems.length ? 'problems: ' + problems.join(' | ') : '');
await browser.close();
server.close();
