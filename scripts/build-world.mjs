// Rebuilds the World 01 stages from art/blender/build.py and optimises the export.
//   npm run world                      full rebuild: every stage + props, Cycles bake, meshopt
//   npm run world -- 1-2 --no-bake     only some targets (props, 1-1, 1-2, 1-3), flags go to Blender
//   npm run world -- --optimize-only   only re-run the meshopt pass on public/stages
// Set BLENDER=/path/to/blender when Blender is not in the default macOS location.
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'public/stages');
const blender = process.env.BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit' });
const args = process.argv.slice(2);

if (!args.includes('--optimize-only')) {
  // One Blender process per target: Cycles can crash when a baked scene is torn
  // down and rebuilt inside the same session.
  const flags = args.filter((a) => a.startsWith('--'));
  const targets = args.filter((a) => !a.startsWith('--'));
  for (const target of targets.length ? targets : ['props', '1-1', '1-2', '1-3']) {
    run(blender, ['-b', '--factory-startup', '-P', resolve(root, 'art/blender/build.py'), '--', target, ...flags]);
  }
}
// Meshopt geometry compression. Lightmap UVs (TEXCOORD_1) keep 16 bits so the
// 2048 px atlas is sampled within a fraction of a texel.
const files = ['props.glb', ...['1-1', '1-2', '1-3'].flatMap((id) => [`${id}/world.glb`, `${id}/lightmap.webp`])];
for (const name of files.filter((f) => f.endsWith('.glb'))) {
  const file = resolve(out, name);
  run('npx', ['gltf-transform', 'meshopt', file, file, '--level', 'medium',
    '--quantize-position', '16', '--quantize-texcoord', '16']);
}
for (const name of files.filter((f) => existsSync(resolve(out, f)))) {
  console.log(`${name}: ${(statSync(resolve(out, name)).size / 1024).toFixed(0)} KB`);
}
