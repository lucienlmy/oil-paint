// Rewrites a .glb of animation clips with only the data its clips use: node tools/compact-glb.mjs <in.glb> <out.glb>
// The starter man's clip file came with 26,131 accessors of which his 33 clips use 3,558; the rest was 17.5 MB
// that nothing reads. Values are copied byte for byte, so the clips play exactly as before.
import { readFileSync, writeFileSync } from 'node:fs';

const [from, to] = process.argv.slice(2);
const glb = readFileSync(from);
if (glb.readUInt32LE(0) !== 0x46546c67) throw new Error('not a .glb');
const jsonLength = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8'));
const bin = glb.subarray(20 + jsonLength + 8, 20 + jsonLength + 8 + glb.readUInt32LE(20 + jsonLength));
if (json.meshes?.length || json.skins?.length || json.images?.length) throw new Error('this only knows files of clips: no meshes, skins or images');
if (json.buffers.length !== 1) throw new Error('one buffer expected');

const parts = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const bytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const remap = new Map();
const accessors = [];
const chunks = [];
let length = 0;
const keep = (index) => {
  if (remap.has(index)) return remap.get(index);
  const a = json.accessors[index];
  const view = json.bufferViews[a.bufferView];
  if (view.byteStride || a.sparse) throw new Error('interleaved or sparse data: not handled');
  const size = a.count * parts[a.type] * bytes[a.componentType];
  const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  chunks.push(bin.subarray(start, start + size));
  const pad = (4 - (size % 4)) % 4;
  if (pad) chunks.push(Buffer.alloc(pad));
  accessors.push({ ...a, bufferView: 0, byteOffset: length });
  length += size + pad;
  remap.set(index, accessors.length - 1);
  return accessors.length - 1;
};
for (const animation of json.animations) {
  for (const sampler of animation.samplers) {
    sampler.input = keep(sampler.input);
    sampler.output = keep(sampler.output);
  }
}
const before = json.accessors.length;
json.accessors = accessors;
json.bufferViews = [{ buffer: 0, byteOffset: 0, byteLength: length }];
json.buffers = [{ byteLength: length }];

let text = Buffer.from(JSON.stringify(json), 'utf8');
if (text.length % 4) text = Buffer.concat([text, Buffer.alloc(4 - (text.length % 4), 0x20)]);
const body = Buffer.concat(chunks);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + text.length + 8 + body.length, 8);
const head = (size, type) => {
  const b = Buffer.alloc(8);
  b.writeUInt32LE(size, 0);
  b.writeUInt32LE(type, 4);
  return b;
};
writeFileSync(to, Buffer.concat([header, head(text.length, 0x4e4f534a), text, head(body.length, 0x004e4942), body]));
console.log(`${json.animations.length} clips, ${before} accessors to ${accessors.length}, ${(glb.length / 1e6).toFixed(1)} MB to ${((28 + text.length + body.length) / 1e6).toFixed(1)} MB`);
