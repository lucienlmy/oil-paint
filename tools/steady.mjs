// Checks that the paint on the ground stays put. Headless and muted.
//   node tools/steady.mjs [--out shots/work/steady] [--query ""] [--at "x,z,fx,fz"]
// Saves two frames a third of a second apart with the wanderer standing (still-a, still-b), and five frames of
// him walking forward (walk-0..4, a quarter second apart), and prints how alike the two standing frames are in
// the patch of ground round his feet (PSNR: higher is steadier, "inf" is identical).
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
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
const out = resolve(here, flag('out', 'shots/work/steady'));
const at = flag('at', '4,30,10,6').split(',').map(Number);
mkdirSync(out, { recursive: true });
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
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) console.log('error', m.text().slice(0, 900)); });
await page.goto(`http://127.0.0.1:${server.address().port}/?capture&nopad&${flag('query', '')}`);
await page.waitForFunction(() => window.lab?.ready, null, { timeout: 120000 });
const input = (y) => page.evaluate((y) => window.lab.setInput(() => ({ move: { x: 0, y }, walk: true, sprint: false, strafe: false, jump: false, look: { x: 0, y: 0 }, zoom: 0, device: 'keyboard' })), y);
const step = (n) => page.evaluate((n) => window.lab.step(1 / 60, n), n);
const shot = (name) => page.screenshot({ path: join(out, `${name}.png`) });

await page.evaluate(([x, z, fx, fz]) => { window.lab.teleport(x, z, fx, fz); window.lab.follow.pitch = 0.2; }, at);
await input(0);
await step(90);
await shot('still-a');
await step(20);
await shot('still-b');
// the ground round his feet, away from the falling leaves higher in the frame; ffmpeg reports on stderr
const crop = 'crop=900:420:400:620';
const report = spawnSync('ffmpeg', ['-hide_banner', '-i', join(out, 'still-a.png'), '-i', join(out, 'still-b.png'), '-lavfi', `[0]${crop}[x];[1]${crop}[y];[x][y]psnr`, '-f', 'null', '-'], { encoding: 'utf8' });
console.log('standing still:', (report.stderr.match(/PSNR.*/) ?? ['no reading'])[0]);
spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(out, 'still-a.png'), '-i', join(out, 'still-b.png'), '-lavfi', `[0]${crop}[x];[1]${crop}[y];[x][y]blend=all_mode=difference,eq=brightness=0.0:contrast=3`, join(out, 'still-diff.png')]);
await input(1);
for (let i = 0; i < 5; i++) { await step(15); await shot(`walk-${i}`); }
await browser.close();
server.close();
console.log(`saved to ${out}`);
