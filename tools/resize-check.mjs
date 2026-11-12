// Resize-during-load check, headless and muted: opens a demo small, makes the window big while it is still loading
// (as pressing fullscreen does), and after it is ready reports the canvas's drawing size against the window's.
//
//   node tools/resize-check.mjs <url> [--shot file.png] [--at ms] [--wait ms]
//
// --at: when to resize after the page starts loading (default 800), or 'canvas' for as soon as it has a canvas. --wait: for demos with no ready flag, how long to
// wait after loading before measuring (default: wait for window.__block.ready, up to 60 s).
import { chromium } from 'playwright-core';
import { guard } from './no-pointer-lock.mjs';

guard(chromium);
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const url = args[0];
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 1 });
const t0 = Date.now();
await page.goto(url, { waitUntil: 'commit' });
// --at canvas: resize as soon as the page has a sized canvas, the earliest moment a late listener would miss it
if (flag('at') === 'canvas') await page.waitForFunction(() => [...document.querySelectorAll('canvas')].some((c) => c.width > 0 && c.width !== 300), null, { timeout: 60000, polling: 20 });
else await page.waitForTimeout(Number(flag('at', 800)));
const before = await page.evaluate(() => !!window.__block?.ready).catch(() => false);
await page.setViewportSize({ width: 1920, height: 1080 });
const resizedAt = Date.now() - t0;
if (flag('wait')) await page.waitForTimeout(Number(flag('wait')));
else await page.waitForFunction(() => window.__block?.ready, null, { timeout: 60000, polling: 100 });
const readyAt = Date.now() - t0;
await page.waitForTimeout(1500);
const aspect = await page.evaluate(() => (window.__tg ?? window.__oil ?? window.__night)?.camera?.aspect ?? null).catch(() => null);
const sizes = await page.evaluate(() =>
  [...document.querySelectorAll('canvas')].map((c) => ({ width: c.width, height: c.height, css: `${c.clientWidth}x${c.clientHeight}` })),
);
const win = await page.evaluate(() => `${innerWidth}x${innerHeight} dpr ${devicePixelRatio}`);
console.log(JSON.stringify({ resizedAt, readyBeforeResize: before, readyAt, window: win, cameraAspect: aspect, canvases: sizes }));
if (flag('shot')) await page.screenshot({ path: flag('shot') });
await browser.close();
