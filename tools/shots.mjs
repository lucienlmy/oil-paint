// Stills of the built page, headless and muted, with the clock stepped by hand.
//   node tools/shots.mjs [names...] [--out shots/work] [--query "shafts=0"] [--size 1920x1080]
// With no names, every view below. Each view places the wanderer, lets the world settle, and saves a PNG.
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
const names = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] ?? '').startsWith('--'));
const out = resolve(here, flag('out', 'shots/work'));
const [width, height] = flag('size', '1920x1080').split('x').map(Number);
mkdirSync(out, { recursive: true });

// name: [x, z, look-at x, look-at z, { run: seconds of running first, pitch, dist, yaw: turn of the eye, view: [eye, target] }]
export const VIEWS = {
  start: [0, 78, -2, 50, { run: 0 }],
  running: [-6, 58, 3, 32, { run: 2.2 }],
  stripes: [4, 30, 10, 6, { run: 1.2, pitch: 0.2 }],
  birches: [8, 4, 3, -20, { run: 1.5 }],
  side: [2, -22, -5, -44, { run: 1.6, yaw: 1.2, dist: 7.5 }],
  low: [-4, -46, 4, -68, { run: 1.4, pitch: -0.12, dist: 5 }],
  clearing: [5, -72, 12, -94, { run: 1.2 }],
  oak: [10, -84, 14, -98, { run: 0, pitch: -0.22, dist: 8 }],
  close: [1, 60, -4, 40, { run: 1.8, dist: 3.4, pitch: 0.1 }],
  back: [8, -80, 4, -60, { run: 1.5 }],
  high: [0, 70, -2, 50, { run: 0, view: [[3, 15, 78], [-2, 0, 38]] }],
  ground: [0, 70, -2, 50, { run: 0, view: [[4, 2.2, 74], [-6, 0, 40]] }],
};

// --view "x,z,fx,fz,run,dist,pitch,yaw" --name n: a view given on the command line
if (flag('view')) { const [x, z, fx, fz, run, dist, pitch, yaw] = flag('view').split(',').map(Number); VIEWS[flag('name', 'custom')] = [x, z, fx, fz, { run, dist, pitch, yaw }]; names.push(flag('name', 'custom')); }
const root = resolve(here, 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  let file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/?capture&nopad&${flag('query', '')}`;

const exe = process.env.CHROME; // a Chromium of your own; without it, Playwright's
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
const problems = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text().slice(0, 1500)}`); });
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}\n${(e.stack ?? '').slice(0, 600)}`));
const t0 = Date.now();
await page.goto(url);
try {
  await page.waitForFunction(() => window.lab?.ready, null, { timeout: 120000 });
} catch {
  console.log('never ready\n' + problems.join('\n'));
  await browser.close(); server.close(); process.exit(1);
}
console.log(`ready in ${Date.now() - t0} ms`, JSON.stringify(await page.evaluate(() => ({ timings: window.lab.timings, counts: window.lab.counts }))));

if (args.includes('--time')) {
  const ms = await page.evaluate(() => { const L = window.lab, gl = L.renderer.getContext(); L.setInput(() => ({ move: { x: 0, y: 1 }, walk: false, sprint: false, strafe: false, jump: false, look: { x: 0.004, y: 0 }, zoom: 0, device: 'keyboard' })); const px = new Uint8Array(4); L.step(1 / 60, 30); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const t = performance.now(); for (let i = 0; i < 240; i++) { L.step(1 / 60, 1); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } return (performance.now() - t) / 240; });
  console.log('ms a frame, running:', ms.toFixed(2), '=', Math.round(1000 / ms), 'fps');
}
for (const name of names.length ? names : Object.keys(VIEWS)) {
  const v = VIEWS[name];
  if (!v) { console.log(`no view ${name}`); continue; }
  const info = await page.evaluate(([x, z, fx, fz, o]) => {
    const L = window.lab;
    L.view(null);
    L.teleport(x, z, fx, fz);
    if (o.pitch != null) L.follow.pitch = o.pitch;
    L.follow.want = L.follow.distance = o.dist ?? 6.4;
    const run = o.run ?? 0;
    L.setInput(() => ({ move: { x: 0, y: run > 0 ? 1 : 0 }, walk: false, sprint: false, strafe: false, jump: false, look: { x: 0, y: 0 }, zoom: 0, device: 'keyboard' }));
    L.step(1 / 60, Math.round(Math.max(run, 0.5) * 60));
    if (o.yaw) { L.follow.yaw += o.yaw; L.step(1 / 60, 20); }
    if (o.view) { L.view(o.view[0], o.view[1]); L.step(1 / 60, 2); }
    const p = L.player.feet;
    return { at: [p.x.toFixed(1), p.y.toFixed(2), p.z.toFixed(1)], mode: L.player.mode, speed: L.player.speed.toFixed(2) };
  }, v);
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log(`shot ${name}`, JSON.stringify(info));
}
if (problems.length) console.log('problems:\n' + [...new Set(problems)].slice(0, 12).join('\n'));
await browser.close();
server.close();
