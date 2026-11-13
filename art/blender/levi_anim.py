"""Rebuild Levi's locomotion clips (Andar, Correr) on the existing rig.

    Blender -b --factory-startup -P art/blender/levi_anim.py -- [in.glb] [out.glb] [--preview DIR]

The original levi.glb walk was a stiff 1 s pendulum (legs +-20 deg, 1 cm bounce).
These cycles are procedural but keyed per frame: contact/passing poses, knee bend
on the swing leg, pelvis bounce/roll/twist, torso counter-twist and lean, arm swing
with follow-through and a head that stabilises. Levi faces Blender -Y (glTF +Z).
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Quaternion, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FPS = 24
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
TAU = math.tau
LEG = 0.27  # hip -> boot sole, rest pose

# Gait settings. Angles in degrees; "pitch" > 0 swings a hanging limb backwards.
GAITS = {
    'Andar': dict(frames=16, swing=30, knee=58, plant=8, bounce=0.012, sway=0.012,
                  roll=5, twist=9, lean=7, arm=34, elbow=22, elbow_swing=14, head=0.55, flight=0.0),
    'Correr': dict(frames=12, swing=46, knee=88, plant=14, bounce=0.035, sway=0.008,
                   roll=4, twist=13, lean=15, arm=52, elbow=62, elbow_swing=18, head=0.7, flight=0.25),
}


def args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    preview = None
    if '--preview' in argv:
        i = argv.index('--preview')
        preview = argv[i + 1]
        del argv[i:i + 2]
    src = argv[0] if len(argv) > 0 else os.path.join(ROOT, 'public', 'levi.glb')
    dst = argv[1] if len(argv) > 1 else src
    return src, dst, preview


def bone_rot(pb, *turns):
    """Quaternion for a pose bone from (armature-space axis, degrees) turns."""
    rest = pb.bone.matrix_local.to_3x3()
    inv = rest.inverted()
    q = Quaternion()
    for axis, deg in turns:
        local = (inv @ axis).normalized()
        q = Quaternion(local, math.radians(deg)) @ q
    return q


def bone_loc(pb, world):
    return pb.bone.matrix_local.to_3x3().inverted() @ world


def ease_lift(t):
    """0 -> 1 -> 0 over t in [0, 1], soft at both ends."""
    return math.sin(math.pi * max(0.0, min(1.0, t))) ** 2


def leg(phase, g):
    """Hip pitch and knee bend for one leg; phase 0 = heel contact in front."""
    p = phase % 1.0
    stance = 0.5 - g['flight'] * 0.5
    if p < stance:
        # Planted: the foot travels from front to back at a steady rate.
        s = p / stance
        hip = -g['swing'] + 2 * g['swing'] * s
        knee = g['plant'] * math.sin(math.pi * min(1.0, s * 2.2))  # absorb after contact
    else:
        # Swing: whip forward with the knee folded, extend just before contact.
        s = (p - stance) / (1 - stance)
        hip = g['swing'] - 2 * g['swing'] * (0.5 - 0.5 * math.cos(math.pi * s))
        knee = g['knee'] * ease_lift(min(1.0, s * 1.15))
    return hip, knee


def pose(arm, phase, g):
    pb = arm.pose.bones
    w = TAU * phase
    # Pelvis: two bounces per cycle, lowest just after each contact, highest on passing.
    # At contact the legs are splayed, so the hips drop by what the angled leg loses
    # in height; that keeps the planted boot on the floor instead of sinking or floating.
    down = math.cos(2 * w - 0.5)
    drop = LEG * (1 - math.cos(math.radians(g['swing'])))
    up = -drop * (0.5 + 0.5 * down) + g['bounce'] * (0.5 - 0.5 * down)
    side = g['sway'] * math.sin(w)  # weight over the planted leg (left first)
    pb['raiz'].location = bone_loc(pb['raiz'], Vector((side, 0, up)))
    pb['raiz'].rotation_quaternion = Quaternion()
    # Hips twist toward the forward leg and drop on the swing side.
    pb['bacia'].rotation_quaternion = bone_rot(
        pb['bacia'], (Z, g['twist'] * math.cos(w)), (Y, g['roll'] * math.sin(w)))
    # Torso leans into the move and counter-rotates against the hips.
    lean = g['lean'] + 1.5 * down
    pb['tronco'].rotation_quaternion = bone_rot(
        pb['tronco'], (X, lean), (Z, -1.6 * g['twist'] * math.cos(w - 0.35)),
        (Y, -0.6 * g['roll'] * math.sin(w - 0.3)))
    # Head stabilises: cancel most of the torso motion, slight nod on contact.
    pb['cabeca'].rotation_quaternion = bone_rot(
        pb['cabeca'], (X, -lean * g['head'] + 2.0 * down),
        (Z, 1.6 * g['twist'] * g['head'] * math.cos(w - 0.6)))
    # Legs: left (E) contacts at phase 0, right (D) at 0.5.
    for side_name, offset in (('E', 0.0), ('D', 0.5)):
        hip, knee = leg(phase + offset, g)
        pb['perna.' + side_name].rotation_quaternion = bone_rot(pb['perna.' + side_name], (X, hip))
        pb['bota.' + side_name].rotation_quaternion = bone_rot(pb['bota.' + side_name], (X, knee))
    # Arms swing opposite their leg, with a little lag; elbows bend more going forward.
    for side_name, sign in (('D', 1.0), ('E', -1.0)):
        swing = math.cos(w - 0.35) * sign  # +1 = this arm forward
        out = 1.0 if side_name == 'E' else -1.0
        pb['braco.' + side_name].rotation_quaternion = bone_rot(
            pb['braco.' + side_name], (X, -g['arm'] * swing), (Y, out * 6))
        bend = g['elbow'] + g['elbow_swing'] * max(0.0, swing)
        pb['antebraco.' + side_name].rotation_quaternion = bone_rot(pb['antebraco.' + side_name], (X, -bend))
        pb['mao.' + side_name].rotation_quaternion = bone_rot(
            pb['mao.' + side_name], (X, -6 * math.cos(w - 1.0) * sign))


def build_clip(arm, name, g):
    old = bpy.data.actions.get(name)
    if old:
        bpy.data.actions.remove(old)
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data.action = act
    n = g['frames']
    for f in range(n + 1):
        pose(arm, f / n, g)
        for pb in arm.pose.bones:
            pb.rotation_mode = 'QUATERNION'
            pb.keyframe_insert('rotation_quaternion', frame=f + 1)
            pb.keyframe_insert('location', frame=f + 1)
    act.frame_range = (1, n + 1)
    return act


def render_preview(arm, out_dir):
    """Side and front contact sheets of each clip (Workbench), for review."""
    os.makedirs(out_dir, exist_ok=True)
    scene = bpy.context.scene
    try:
        scene.render.engine = 'BLENDER_WORKBENCH'
    except TypeError:
        pass
    scene.render.resolution_x, scene.render.resolution_y = 360, 420
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'TEXTURE'
    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 2.6
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    views = {'side': ((4, 0, 0), (math.radians(90), 0, math.radians(90))),
             'front': ((0, -4, 0), (math.radians(90), 0, 0))}
    for name, g in GAITS.items():
        arm.animation_data.action = bpy.data.actions[name]
        for view, (loc, rot) in views.items():
            cam.location, cam.rotation_euler = loc, rot
            for f in range(0, g['frames'], max(1, g['frames'] // 8)):
                scene.frame_set(f + 1)
                scene.render.filepath = os.path.join(out_dir, f'{name}_{view}_{f:02d}.png')
                bpy.ops.render.render(write_still=True)


def main():
    src, dst, preview = args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    arm.animation_data_create()
    # The importer parks each clip on an NLA track; clear them so only actions export.
    for track in list(arm.animation_data.nla_tracks):
        arm.animation_data.nla_tracks.remove(track)
    for name, g in GAITS.items():
        build_clip(arm, name, g)
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = Quaternion()
    if preview:
        render_preview(arm, preview)
        arm.animation_data.action = None
    bpy.context.scene.render.fps = FPS
    bpy.ops.export_scene.gltf(
        filepath=dst, export_format='GLB', export_animation_mode='ACTIONS',
        export_force_sampling=True, export_optimize_animation_size=True,
        export_image_format='AUTO', export_yup=True)
    print('LEVI_ANIM wrote', dst, sorted(a.name for a in bpy.data.actions))


main()
