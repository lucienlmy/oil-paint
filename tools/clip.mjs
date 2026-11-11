// A short film of the built page: the wanderer runs up the way and the eye follows. Headless and muted; the clock
// is stepped by hand, so the film is smooth however long a frame takes to save.
//   node tools/clip.mjs [--out shots/run.mp4] [--seconds 14] [--size 1280x720] [--from 0] [--query ""]
// --from is how far along the way to begin, 0..1.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
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
const out = resolve(here, flag('out', 'shots/run.mp4'));
const seconds = Number(flag('seconds', 14));
const from = Number(flag('from', 0));
const [width, height] = flag('size', '1280x720').split('x').map(Number);
const frames = resolve(here, 'shots/work/clip');
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });

const root = resolve(here, flag('dist', 'dist'));
// --at "x,z,fx,fz": he stands there (with --walk 1, walks on from there) instead of running the wood's way
// --cam "ex,eh,ez,tx,th,tz": a fixed eye eh metres above its ground, looking th metres above that same ground
const at = flag('at') ? flag('at').split(',').map(Number) : null;
const cam = flag('cam') ? flag('cam').split(',').map(Number) : null;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  let file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const exe = process.env.CHROME; // a Chromium of your own; without it, Playwright's
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/?capture&nopad&${/scene=/.test(flag('query', '')) ? '' : 'scene=autumn&'}${flag('query', '')}`);
await page.waitForFunction(() => window.lab?.ready, null, { timeout: 120000 });

if (at) await page.evaluate(([at, cam, walk, straight, stop, spin]) => {
  const L = window.lab;
  let clock = 0;
  L.teleport(...at);
  if (cam) { const g = L.heightAt(cam[0], cam[2]); L.view([cam[0], g + cam[1], cam[2]], [cam[3], g + cam[4], cam[5]]); }
  // --walk 1 walks, 2 runs; where the scene has a crest to follow (the night's), he keeps to it
  L.setInput((dt) => {
    let turn = 0;
    clock += dt;
    const go = walk && (!stop || clock < stop); // --stop s: he stands still after that long; --straight 1: no steering
    if (go && L.crestX && !straight) {
      const p = L.player.feet, want = Math.atan2(L.crestX(p.z - 10) - p.x, -10);
      turn = Math.atan2(Math.sin(want - L.follow.yaw), Math.cos(want - L.follow.yaw));
    }
    // --spin r: once he has stopped he looks round, r radians a second
    return { move: { x: 0, y: go ? 1 : 0 }, walk: walk === 1, sprint: false, strafe: false, jump: false, look: { x: -turn * Math.min(1, dt * 1.6) + (go ? 0 : spin * dt), y: 0 }, zoom: 0, device: 'keyboard' };
  });
  L.step(1 / 60, 30);
}, [at, cam, Number(flag('walk', 0)), Number(flag('straight', 0)), Number(flag('stop', 0)), Number(flag('spin', 0))]);
else await page.evaluate((from) => {
  const L = window.lab, way = L.way;
  const i0 = Math.floor(from * (way.length - 12));
  L.teleport(way[i0][0], way[i0][1], way[i0 + 6][0], way[i0 + 6][1]);
  L.follow.pitch = 0.07;
  let t = 0;
  // he runs toward a point a few metres further along the way; the eye swings round behind him, slowly
  L.setInput((dt) => {
    t += dt;
    const p = L.player.feet;
    let best = 0, bd = Infinity;
    for (let i = 0; i < way.length; i++) { const d = Math.hypot(way[i][0] - p.x, way[i][1] - p.z); if (d < bd) { bd = d; best = i; } }
    const aim = way[Math.min(way.length - 1, best + 9)];
    const want = Math.atan2(aim[0] - p.x, aim[1] - p.z);
    const turn = Math.atan2(Math.sin(want - L.follow.yaw), Math.cos(want - L.follow.yaw));
    const done = best > way.length - 14;
    return { move: { x: 0, y: t < 1.2 || done ? 0 : 1 }, walk: false, sprint: false, strafe: false, jump: false, look: { x: -turn * Math.min(1, dt * 1.6), y: 0 }, zoom: 0, device: 'keyboard' };
  });
  L.step(1 / 60, 30);
}, from);

const total = Math.round(seconds * 30);
for (let f = 0; f < total; f++) {
  await page.evaluate(() => window.lab.step(1 / 60, 2));
  await page.screenshot({ path: join(frames, `f${String(f).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 93 });
  if (f % 60 === 0) console.log(`frame ${f} of ${total}`);
}
await browser.close();
server.close();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(frames, 'f%04d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', out]);
console.log(`wrote ${out}`);
