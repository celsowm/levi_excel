// Rebuilds World 01 from art/blender/build_world01.py and optimises the export.
//   npm run world            full rebuild: Blender scene, Cycles lightmap bake, meshopt
//   npm run world -- --optimize-only   only re-run the meshopt pass on public/world
// Set BLENDER=/path/to/blender when Blender is not in the default macOS location.
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'public/world');
const blender = process.env.BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit' });

if (!process.argv.includes('--optimize-only')) {
  run(blender, ['-b', '--factory-startup', '-P', resolve(root, 'art/blender/build_world01.py')]);
}
// Meshopt geometry compression. Lightmap UVs (TEXCOORD_1) keep 16 bits so the
// 2048 px atlas is sampled within a fraction of a texel.
for (const name of ['world01.glb', 'props01.glb']) {
  const file = resolve(out, name);
  run('npx', ['gltf-transform', 'meshopt', file, file, '--level', 'medium',
    '--quantize-position', '16', '--quantize-texcoord', '16']);
}
for (const name of ['world01.glb', 'props01.glb', 'world01-lightmap.webp']) {
  console.log(`${name}: ${(statSync(resolve(out, name)).size / 1024).toFixed(0)} KB`);
}
