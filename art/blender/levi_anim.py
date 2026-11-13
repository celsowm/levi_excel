"""Rebuild Levi's locomotion clips on the existing rig.

    Blender -b --factory-startup -P art/blender/levi_anim.py -- [in.glb] [out.glb] [--preview DIR]

Clips: Andar / Correr (in-place cycles), Pular (push-off then knees tucked in the
air), Salto (double-jump tuck), Aterrissar (knees absorb the landing). The original
walk was a stiff 1 s pendulum and the jump only played once Levi was airborne, so
neither showed any knee bend. Poses are procedural but keyed per frame, and every
grounded frame is foot-locked: the pelvis height is solved from the skinned mesh so
the lowest boot vertex sits exactly on the floor. Levi faces Blender -Y (glTF +Z).
"""
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Quaternion, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FPS = 24
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
TAU = math.tau

# Gait settings. Angles in degrees; a positive pitch swings a hanging limb backwards.
GAITS = {
    'Andar': dict(frames=16, swing=30, knee=58, plant=10, bounce=0.012, sway=0.012,
                  roll=5, twist=9, lean=7, arm=34, elbow=22, elbow_swing=14, head=0.55, flight=0.0),
    'Correr': dict(frames=12, swing=46, knee=88, plant=16, bounce=0.05, sway=0.008,
                   roll=4, twist=13, lean=15, arm=52, elbow=62, elbow_swing=18, head=0.7, flight=0.25),
}

# Key poses for the one-shot clips: (frame, params).
# hip/knee per leg (E = left, D = right): knee == -hip keeps the boot flat, which is
# how a crouch reads on Levi's short thighs; more knee folds the boot back (tuck).
# lean = torso pitch forward, arm = shoulder pitch (negative = forward/up), spread =
# arms out, back = pelvis pushed back over the heels, squash = vertical body scale
# (volume kept), lift = pelvis offset in the air; lock=True frames sit on the floor.
NEUTRAL = dict(hipE=0, hipD=0, kneeE=0, kneeD=0, lean=0, head=0, arm=0, spread=6, elbow=14,
               back=0, squash=1, lift=0)


def crouch(deg, **kw):
    return dict(NEUTRAL, hipE=-deg, hipD=-deg, kneeE=deg, kneeD=deg, back=0.16 * math.sin(math.radians(deg)), **kw)


SHOTS = {
    'Pular': [  # push off from a crouch, stretch, then tuck the knees in the air
        (0, crouch(40, lean=20, head=-10, arm=34, elbow=34, squash=0.84, lock=True)),
        (2, dict(NEUTRAL, hipE=10, hipD=4, lean=-6, head=6, arm=-135, spread=18, elbow=12, squash=1.14, lift=0.02)),
        (7, dict(NEUTRAL, hipE=-56, hipD=-34, kneeE=98, kneeD=72, lean=8, head=-2, arm=-72, spread=40, elbow=42, lift=0.07)),
        (14, dict(NEUTRAL, hipE=-42, hipD=-28, kneeE=80, kneeD=60, lean=6, arm=-52, spread=46, elbow=34, lift=0.06)),
    ],
    'Salto': [  # double jump: kick and stretch, then a tighter tuck with arms thrown out
        (0, dict(NEUTRAL, hipE=-42, hipD=-28, kneeE=80, kneeD=60, lean=6, arm=-52, spread=46, elbow=34, lift=0.06)),
        (2, dict(NEUTRAL, hipE=16, hipD=-8, kneeE=6, kneeD=28, lean=-8, head=6, arm=-150, spread=30, elbow=10, squash=1.12, lift=0.04)),
        (7, dict(NEUTRAL, hipE=-64, hipD=-60, kneeE=108, kneeD=104, lean=16, head=-4, arm=-40, spread=72, elbow=52, squash=0.94, lift=0.12)),
        (14, dict(NEUTRAL, hipE=-46, hipD=-38, kneeE=82, kneeD=72, lean=8, arm=-46, spread=52, elbow=36, lift=0.08)),
    ],
    'Aterrissar': [  # touch down, absorb deep in the knees, small rebound, settle
        (0, crouch(14, lean=6, arm=-50, spread=36, elbow=26, squash=0.97, lock=True)),
        (3, crouch(52, lean=28, head=-14, arm=26, spread=28, elbow=44, squash=0.8, lock=True)),
        (6, crouch(6, lean=2, head=4, arm=-10, spread=10, elbow=18, squash=1.05, lock=True)),
        (9, dict(NEUTRAL, lock=True)),
    ],
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
    inv = pb.bone.matrix_local.to_3x3().inverted()
    q = Quaternion()
    for axis, deg in turns:
        q = Quaternion((inv @ axis).normalized(), math.radians(deg)) @ q
    return q


def bone_loc(pb, world):
    return pb.bone.matrix_local.to_3x3().inverted() @ world


def ease_lift(t):
    """0 -> 1 -> 0 over t in [0, 1], soft at both ends."""
    return math.sin(math.pi * max(0.0, min(1.0, t))) ** 2


class FootLock:
    """Measures the lowest skinned vertex so poses can be put back on the floor."""

    def __init__(self, arm, mesh):
        self.arm, self.mesh = arm, mesh
        self.floor = self.lowest()

    def lowest(self):
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        ev = self.mesh.evaluated_get(dg)
        data = ev.to_mesh()
        co = np.empty(len(data.vertices) * 3, dtype=np.float32)
        data.vertices.foreach_get('co', co)
        ev.to_mesh_clear()
        co = co.reshape(-1, 3)
        mw = np.array(self.mesh.matrix_world)
        z = co @ mw[2, :3] + mw[2, 3]
        return float(z.min())

    def settle(self, lift=0.0, offset=Vector((0, 0, 0))):
        """Place the root at `offset` (x/y) with the lowest vertex `lift` above the floor."""
        root = self.arm.pose.bones['raiz']
        flat = Vector((offset.x, offset.y, 0))
        root.location = bone_loc(root, flat)
        delta = self.floor - self.lowest() + lift
        root.location = bone_loc(root, flat + Vector((0, 0, delta)))


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


def gait_pose(arm, phase, g, lock):
    pb = arm.pose.bones
    w = TAU * phase
    down = math.cos(2 * w - 0.5)  # +1 just after each contact, -1 on passing
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
    for side, offset in (('E', 0.0), ('D', 0.5)):
        hip, knee = leg(phase + offset, g)
        pb['perna.' + side].rotation_quaternion = bone_rot(pb['perna.' + side], (X, hip))
        pb['bota.' + side].rotation_quaternion = bone_rot(pb['bota.' + side], (X, knee))
    # Arms swing opposite their leg, with a little lag; elbows bend more going forward.
    for side, sign in (('D', 1.0), ('E', -1.0)):
        swing = math.cos(w - 0.35) * sign  # +1 = this arm forward
        out = 1.0 if side == 'E' else -1.0
        pb['braco.' + side].rotation_quaternion = bone_rot(
            pb['braco.' + side], (X, -g['arm'] * swing), (Y, out * 6))
        bend = g['elbow'] + g['elbow_swing'] * max(0.0, swing)
        pb['antebraco.' + side].rotation_quaternion = bone_rot(pb['antebraco.' + side], (X, -bend))
        pb['mao.' + side].rotation_quaternion = bone_rot(pb['mao.' + side], (X, -6 * math.cos(w - 1.0) * sign))
    # Feet on the floor, weight over the planted leg; a run adds hang time on passing.
    lock.settle(g['bounce'] * (0.5 - 0.5 * down), Vector((g['sway'] * math.sin(w), 0, 0)))


def shot_params(keys, frame):
    """Cosine-eased interpolation between the key poses of a one-shot clip."""
    for (f0, a), (f1, b) in zip(keys, keys[1:]):
        if f0 <= frame <= f1:
            t = 0.5 - 0.5 * math.cos(math.pi * (frame - f0) / (f1 - f0))
            out = {k: a.get(k, 0) + (b.get(k, 0) - a.get(k, 0)) * t
                   for k in set(a) | set(b) if k != 'lock'}
            out['lock'] = a.get('lock', False) and b.get('lock', False)
            return out
    return dict(keys[-1][1])


def shot_pose(arm, p, lock):
    pb = arm.pose.bones
    pb['bacia'].rotation_quaternion = Quaternion()
    pb['tronco'].rotation_quaternion = bone_rot(pb['tronco'], (X, p.get('lean', 0)))
    pb['cabeca'].rotation_quaternion = bone_rot(pb['cabeca'], (X, p.get('head', 0)))
    for side in ('E', 'D'):
        pb['perna.' + side].rotation_quaternion = bone_rot(pb['perna.' + side], (X, p.get('hip' + side, 0)))
        pb['bota.' + side].rotation_quaternion = bone_rot(pb['bota.' + side], (X, p.get('knee' + side, 0)))
        out = 1.0 if side == 'E' else -1.0
        pb['braco.' + side].rotation_quaternion = bone_rot(
            pb['braco.' + side], (X, p.get('arm', 0)), (Y, out * p.get('spread', 0)))
        pb['antebraco.' + side].rotation_quaternion = bone_rot(pb['antebraco.' + side], (X, -p.get('elbow', 0)))
        pb['mao.' + side].rotation_quaternion = Quaternion()
    # Squash & stretch on the root keeps volume; the root bone's local Y is world up.
    v = p.get('squash', 1)
    h = 1 / math.sqrt(v)
    pb['raiz'].scale = (h, v, h)
    # Crouches push the pelvis back (+Y) so the weight stays over the boots.
    offset = Vector((0, p.get('back', 0), 0))
    if p.get('lock'):
        lock.settle(0.0, offset)
    else:
        pb['raiz'].location = bone_loc(pb['raiz'], offset + Vector((0, 0, p.get('lift', 0))))


def new_action(arm, name):
    old = bpy.data.actions.get(name)
    if old:
        bpy.data.actions.remove(old)
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data.action = act
    return act


def key_all(arm, frame):
    for pb in arm.pose.bones:
        pb.keyframe_insert('rotation_quaternion', frame=frame)
        pb.keyframe_insert('location', frame=frame)
        pb.keyframe_insert('scale', frame=frame)


def reset_pose(arm):
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
        pb.rotation_quaternion = Quaternion()


def build_gait(arm, lock, name, g):
    act = new_action(arm, name)
    n = g['frames']
    for f in range(n + 1):
        reset_pose(arm)
        gait_pose(arm, f / n, g, lock)
        key_all(arm, f + 1)
    act.frame_range = (1, n + 1)


def build_shot(arm, lock, name, keys):
    act = new_action(arm, name)
    n = keys[-1][0]
    for f in range(n + 1):
        reset_pose(arm)
        shot_pose(arm, shot_params(keys, f), lock)
        key_all(arm, f + 1)
    act.frame_range = (1, n + 1)


def render_preview(arm, out_dir):
    """Side-view frames of each rebuilt clip (Workbench), for review."""
    os.makedirs(out_dir, exist_ok=True)
    scene = bpy.context.scene
    try:
        scene.render.engine = 'BLENDER_WORKBENCH'
    except TypeError:
        pass
    scene.render.resolution_x, scene.render.resolution_y = 300, 420
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'TEXTURE'
    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 2.6
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.location, cam.rotation_euler = (4, 0, 0.1), (math.radians(90), 0, math.radians(90))
    # A thin floor line so foot contact is visible.
    bpy.ops.mesh.primitive_plane_add(size=3, location=(0, 0, FootLock.floor_z))
    for act in bpy.data.actions:
        if act.name not in GAITS and act.name not in SHOTS:
            continue
        arm.animation_data.action = act
        start, end = (int(v) for v in act.frame_range)
        step = max(1, (end - start) // 7)
        for f in range(start, end, step):
            scene.frame_set(f)
            scene.render.filepath = os.path.join(out_dir, f'{act.name}_{f - start:02d}.png')
            bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(bpy.data.objects['Plane'])
    bpy.data.objects.remove(cam)


def main():
    src, dst, preview = args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    mesh = next(o for o in bpy.data.objects if o.type == 'MESH')
    arm.animation_data_create()
    # The importer parks each clip on an NLA track; clear them so only actions export.
    for track in list(arm.animation_data.nla_tracks):
        arm.animation_data.nla_tracks.remove(track)
    arm.animation_data.action = None
    reset_pose(arm)
    lock = FootLock(arm, mesh)
    FootLock.floor_z = lock.floor
    for name, g in GAITS.items():
        build_gait(arm, lock, name, g)
    for name, keys in SHOTS.items():
        build_shot(arm, lock, name, keys)
    if preview:
        render_preview(arm, preview)
    arm.animation_data.action = None
    reset_pose(arm)
    bpy.context.scene.render.fps = FPS
    bpy.ops.export_scene.gltf(
        filepath=dst, export_format='GLB', export_animation_mode='ACTIONS',
        export_force_sampling=True, export_optimize_animation_size=True,
        export_image_format='AUTO', export_yup=True)
    print('LEVI_ANIM wrote', dst, sorted(a.name for a in bpy.data.actions))


main()
