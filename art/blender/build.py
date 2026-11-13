"""Builds the World 01 stages and the shared prop library.

  Blender -b --factory-startup -P art/blender/build.py -- [props] [1-1 1-2 1-3] [--no-bake] [--no-export]

With no stage ids every stage is built; `props` alone rebuilds only props.glb. Outputs:
  public/stages/<id>/world.glb, public/stages/<id>/lightmap.webp, src/data/stages/<id>.json
  public/stages/props.glb
"""
import importlib, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import levi_kit as kit

STAGES = {'1-1': 'stage_1_1', '1-2': 'stage_1_2', '1-3': 'stage_1_3'}

def main(args):
    flags = {a for a in args if a.startswith('--')}
    targets = [a for a in args if not a.startswith('--')] or ['props', *STAGES]
    do_bake = '--no-bake' not in flags and os.environ.get('LEVI_NO_BAKE') != '1'
    do_export = '--no-export' not in flags
    kit.reset_scene()
    kit.make_screen_texture()
    for target in targets:
        kit.reset_scene()
        if target == 'props':
            importlib.import_module('props').build_props()
            if do_export:
                kit.export_props()
            continue
        fills, density = importlib.import_module(STAGES[target]).build_stage()
        kit.finish_stage(fills, density, do_bake=do_bake, do_export=do_export)

if __name__ == '__main__':
    main(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
