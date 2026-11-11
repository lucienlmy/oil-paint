// Applies a list of exact text replacements to source files and fails loudly if any target is missing.
//   node tools/edit.mjs <edits.json>      [{ "file": "src/x.js", "find": "...", "put": "..." }, ...]
import { readFileSync, writeFileSync } from 'node:fs';

const edits = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const files = new Map();
for (const { file, find, put } of edits) {
  if (!files.has(file)) files.set(file, readFileSync(file, 'utf8'));
  const s = files.get(file);
  if (!s.includes(find)) { console.error(`${file}: not found: ${find.slice(0, 90)}`); process.exit(1); }
  files.set(file, s.split(find).join(put));
}
for (const [file, s] of files) writeFileSync(file, s);
console.log(`${edits.length} edits in ${files.size} files`);
