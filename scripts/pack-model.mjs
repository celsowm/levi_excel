// Packs public/levi.glb into the versioned Brotli chunks in assets/model/ and updates
// the SHA-256 that restore-model.mjs checks. Run after art/blender/levi_anim.py.
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const directory = resolve(root, 'assets/model');
const restoreScript = resolve(root, 'scripts/restore-model.mjs');
const PART_SIZE = 256 * 1024;

const model = readFileSync(resolve(root, 'public/levi.glb'));
const compressed = brotliCompressSync(model, {
  params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: model.length },
});
for (const name of readdirSync(directory)) {
  if (/^levi\.glb\.br\.part\d+$/.test(name)) unlinkSync(resolve(directory, name));
}
let parts = 0;
for (let i = 0; i < compressed.length; i += PART_SIZE) {
  writeFileSync(resolve(directory, `levi.glb.br.part${String(parts++).padStart(2, '0')}`), compressed.subarray(i, i + PART_SIZE));
}
const hash = createHash('sha256').update(model).digest('hex');
writeFileSync(restoreScript, readFileSync(restoreScript, 'utf8').replace(/expectedHash = '[0-9a-f]+'/, `expectedHash = '${hash}'`));
console.log(`Packed levi.glb (${model.length} bytes) into ${parts} parts, sha256 ${hash}.`);
