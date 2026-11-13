import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const modelFile = resolve(root, 'public/levi.glb');
const expectedHash = 'e16e7ab937395eccd72466f49f3ec20cd73e71d3564e5609e87b34fc787ce545';
const hash = data => createHash('sha256').update(data).digest('hex');

if (!existsSync(modelFile) || hash(readFileSync(modelFile)) !== expectedHash) {
  const directory = resolve(root, 'assets/model');
  const parts = readdirSync(directory).filter(name => /^levi\.glb\.br\.part\d+$/.test(name)).sort();
  if (parts.length === 0) throw new Error('Missing compressed Levi model assets.');
  const compressed = Buffer.concat(parts.map(name => readFileSync(resolve(directory, name))));
  const model = brotliDecompressSync(compressed);
  if (hash(model) !== expectedHash) throw new Error('Levi model integrity check failed.');
  mkdirSync(resolve(root, 'public'), { recursive: true });
  writeFileSync(modelFile, model);
  console.log(`Restored Levi model (${model.length} bytes, verified SHA-256).`);
}
