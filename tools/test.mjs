// Headless test of the block demo's protocol (build first: npm run build), with patch-lab's
// toolbox/block/test-block.mjs: hello, ready and state, messages to ignore, visible, stats, no errors. It needs
// Patch's lab harness on this PC.
//
// The harness empties <dir>/shots before it writes its own pictures there, so it is given a copy of the build in
// .test/ and never this repo's shots/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { testBlock } from 'file:///C:/Users/drini/src/patch-lab/toolbox/block/test-block.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, '.test');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir);
fs.cpSync(path.join(root, 'dist'), path.join(dir, 'dist'), { recursive: true });
fs.copyFileSync(path.join(root, 'recipe.json'), path.join(dir, 'recipe.json'));
const report = await testBlock({ dir, name: 'oil paint', port: 4897, settle: 700, loadTimeout: 60000 });
process.exit(report.failed ? 1 : 0);
