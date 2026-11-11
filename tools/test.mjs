// Headless test of the block demo's protocol (build first: npm run build), with the block test from Patch's lab
// (toolbox/block/test-block.mjs): hello, ready and state, messages to ignore, visible, stats, no errors.
// Set PATCH_LAB to the lab's folder.
//
// The harness empties <dir>/shots before it writes its own pictures there, so it is given a copy of the build in
// .test/ and never this repo's shots/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (!process.env.PATCH_LAB) throw new Error('set PATCH_LAB to the folder of the lab');
const { testBlock } = await import(pathToFileURL(path.join(process.env.PATCH_LAB, 'toolbox/block/test-block.mjs')).href);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, '.test');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir);
fs.cpSync(path.join(root, 'dist'), path.join(dir, 'dist'), { recursive: true });
fs.copyFileSync(path.join(root, 'recipe.json'), path.join(dir, 'recipe.json'));
const report = await testBlock({ dir, name: 'oil paint', port: 4897, settle: 700, loadTimeout: 60000 });
process.exit(report.failed ? 1 : 0);
