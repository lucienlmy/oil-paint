// Checks the scene switch inside a page that holds the demo in a frame, as Patch's does (build first: npm run
// build): the demo opens on the aurora, each button on the page loads the other picture, and each time the demo
// comes back ready. Headless and muted.
//   node tools/switch.mjs
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { guard } from './no-pointer-lock.mjs';

guard(chromium);
const root = resolve(fileURLToPath(import.meta.url), '..', '..', 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
const HOST = `<!doctype html><meta charset="utf-8"><body style="margin:0"><iframe id="demo" src="/index.html?nopad" style="border:0;width:1280px;height:720px"></iframe><script>
  const frame = document.getElementById('demo'), log = [];
  window.log = log;
  addEventListener('message', (e) => { if (e.data?.channel === 'patch-block' && e.data.type !== 'stats') log.push({ type: e.data.type }); });
  const hello = () => frame.contentWindow.postMessage({ channel: 'patch-block', type: 'hello' }, '*');
  frame.addEventListener('load', hello);
</script>`;
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/host') return void res.writeHead(200, { 'Content-Type': 'text/html' }).end(HOST);
  let file = normalize(join(root, path));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu'] });
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); if (!ok) failed++; };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/host`);
  const demo = () => page.frames().find((f) => f.url().includes('index.html'));
  // which picture the demo shows once it next says ready
  const shown = async (after) => {
    await page.waitForFunction((n) => window.log.slice(n).some((m) => m.type === 'ready'), after, { timeout: 90000 });
    return demo().evaluate(() => document.documentElement.dataset.scene);
  };
  check('opens on the aurora', (await shown(0)) === 'aurora');
  let mark = await page.evaluate(() => window.log.length);
  await demo().click('#scenes button[data-scene="autumn"]');
  check('the button opens the autumn wood', (await shown(mark)) === 'autumn');
  check('its address names the scene', demo().url().includes('scene=autumn'), demo().url().replace(/^.*\//, ''));
  mark = await page.evaluate(() => window.log.length);
  await demo().click('#scenes button[data-scene="aurora"]');
  check('the other button goes back to the aurora', (await shown(mark)) === 'aurora');
  check('the button for the picture showing is marked', await demo().evaluate(() => document.querySelector('#scenes button.on')?.dataset.scene === 'aurora'));
  check('no errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
