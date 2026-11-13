"""LEVI World 01 - source of truth for the level art *and* its gameplay layout.

Run inside Blender 4.2+ (tested on 5.2):
  * through MCP for Blender:  exec(open(path).read(), {'__file__': path, '__name__': '__main__'})
  * or headless:              Blender -b --factory-startup -P art/blender/build_world01.py

It rebuilds the scene from scratch, bakes a lightmap with Cycles and writes:
  public/world/world01.glb          static architecture (LM_/EM_/GL_/RT_ meshes)
  public/world/props01.glb          animated or interactive prefabs (PF_* roots)
  public/world/world01-lightmap.webp
  src/data/world01.level.json       colliders, floors, markers and course data

Every coordinate below is a GAME coordinate (Three.js: x right, y up, z towards the
entrance). `bl()` converts to Blender's Z-up frame; the glTF exporter converts back.

Object name prefixes tell the runtime how to shade a mesh:
  LM_  baked lightmap (unlit at runtime)      EM_  emissive, unlit
  GL_  glass                                   RT_  lit by realtime lights (foliage, exterior)
"""
import bpy, bmesh, math, json, os, sys
import numpy as np
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
TEX = os.path.join(HERE, 'textures')
MODELS = os.path.join(HERE, 'models')
OUT = os.path.join(ROOT, 'public', 'world')
LEVEL_JSON = os.path.join(ROOT, 'src', 'data', 'world01.level.json')
LIGHTMAP_SIZE = 2048
BAKE_SAMPLES = int(os.environ.get('LEVI_BAKE_SAMPLES', '256'))
FLOOR_Y = 0.11

# ---------------------------------------------------------------- gameplay layout
# Kept identical to the v0.2 hand-written JS so missions and tests keep working.
PICKUPS = [[-4, 7], [4, 10], [8, 14], [-9, 4], [0, -3.5], [0, -6.5], [-6, -13], [8.5, -17]]
PLATFORMS = [
    dict(x=8.1, z=13.2, w=3.5, d=2.9, y=2.25, motion=0, phase=0),
    dict(x=9.6, z=10.3, w=3.5, d=2.8, y=2.55, motion=0.24, phase=0),
    dict(x=8.2, z=7.3, w=3.7, d=2.7, y=2.95, motion=0.28, phase=math.pi / 2),
    dict(x=7.1, z=4.8, w=3.7, d=2.9, y=2.4, motion=0, phase=0),
]
PILASTER_Z = [-19, -10.6, 0.6, 9.1, 18]
PLANTERS = [(-11.35, 17.25, 1), (-11.35, 2.9, 2), (11.5, -17.5, 3)]
BENCHES = [(-10.6, 4.6, 0.07), (11.2, 1.0, math.pi / 2)]
TERMINALS = {'filter': (0.0, 1.45, 'FILTRO'), 'sum': (3.3, -14.5, 'SOMA')}

LEVEL = {
    'version': 1,
    'bounds': {'minX': -13.35, 'maxX': 13.35, 'minZ': -21.4, 'maxZ': 19.5, 'voidY': -11},
    'floors': [
        {'id': 'lobby', 'minX': -13.7, 'maxX': 13.7, 'minZ': -2, 'maxZ': 20, 'y': FLOOR_Y},
        {'id': 'archive', 'minX': -13.7, 'maxX': 13.7, 'minZ': -22, 'maxZ': -8, 'y': FLOOR_Y},
        {'id': 'bridge', 'minX': -2.1, 'maxX': 2.1, 'minZ': -8, 'maxZ': -2, 'y': FLOOR_Y, 'requires': 'bridge'},
    ],
    'colliders': [], 'walkables': [],
    'spawns': {'start': [0, FLOOR_Y, 15], 'course': [7.65, FLOOR_Y, 16.85],
               'bridge': [0, FLOOR_Y, -0.6], 'archive': [0, FLOOR_Y, -11]},
    'interactables': {'reception': [-8.4, 10], 'filter': [0, 1.45], 'sum': [3.3, -14.5],
                      'elevator': [0, -20.55]},
    'pickups': PICKUPS,
    'course': {
        'platforms': PLATFORMS,
        'pad': {'x': 8, 'z': 16, 'radius': 1.04},
        'finish': {'x': 7.1, 'z': 4.8, 'radius': 1.12},
        'barrier': {'x': 0, 'z': 9.55, 'halfWidth': 3.3, 'minZ': 9.2, 'maxZ': 9.9, 'height': 2.04},
        'scanner': {'x': 9.25, 'y': 3.3, 'z': 8.7, 'sweep': 0.8},
        'sentinel': {'x': 9.2, 'y': 3.5, 'z': 8.8, 'sweep': 0.7},
    },
    'courier': [[-8.4, 2.3, 10.6], [-6.5, 2.6, 8.1], [-2.9, 2.4, 4.6], [0, 2.3, 1.7]],
    'bridge': {'segments': 6, 'firstZ': -2.5, 'step': 1.0},
    'render': {},
}

def collider(id, x, z, w, d, min_y=0, max_y=2, camera_only=False):
    entry = {'id': id, 'x': x, 'z': z, 'width': w, 'depth': d, 'minY': min_y, 'maxY': max_y}
    if camera_only:
        entry['cameraOnly'] = True
    LEVEL['colliders'].append(entry)

def walkable(x, z, half_x, half_z, height):
    LEVEL['walkables'].append({'x': x, 'z': z, 'halfX': half_x, 'halfZ': half_z, 'height': height})

# ---------------------------------------------------------------- materials
MATS = {
    # name: (kind, base colour, roughness, metallic, extra)
    'marble':   ('LM', (1, 1, 1), 0.2, 0.0, {'tex': 'floor_tiles_04_Diffuse.jpg', 'size': 4.0}),
    'walnut':   ('LM', (1, 1, 1), 0.45, 0.0, {'tex': 'black_walnut_veneer_02_Diffuse.jpg', 'size': 1.2}),
    'concrete': ('LM', (1, 1, 1), 0.85, 0.0, {'tex': 'concrete_wall_009_Diffuse.jpg', 'size': 2.4}),
    'plaster':  ('LM', (0.84, 0.85, 0.83), 0.8, 0.0, {}),
    'white':    ('LM', (0.93, 0.93, 0.91), 0.3, 0.0, {}),
    'alu':      ('LM', (0.13, 0.17, 0.21), 0.35, 0.8, {}),
    'steel':    ('LM', (0.5, 0.53, 0.56), 0.3, 0.9, {}),
    'bronze':   ('LM', (0.52, 0.37, 0.22), 0.3, 0.9, {}),
    'navy':     ('LM', (0.035, 0.08, 0.13), 0.4, 0.3, {}),
    'yellow':   ('LM', (1.0, 0.6, 0.08), 0.35, 0.1, {}),
    'dark':     ('LM', (0.025, 0.03, 0.038), 0.5, 0.2, {}),
    'soil':     ('LM', (0.12, 0.09, 0.07), 1.0, 0.0, {}),
    'E_cyan':     ('EM', (0.1, 0.85, 1.0), 0, 0, {'strength': 4.0}),
    'E_mint':     ('EM', (0.3, 1.0, 0.72), 0, 0, {'strength': 3.0}),
    'E_green':    ('EM', (0.35, 1.0, 0.3), 0, 0, {'strength': 3.0}),
    'E_light':    ('EM', (1.0, 0.95, 0.86), 0, 0, {'strength': 5.0}),
    'E_elevator': ('EM', (0.95, 0.25, 1.0), 0, 0, {'strength': 3.5}),
    'E_amber':    ('EM', (1.0, 0.62, 0.16), 0, 0, {'strength': 3.0}),
    'E_screen':   ('EM', (1, 1, 1), 0, 0, {'strength': 1.6, 'tex': 'screen_sheet.png', 'size': 0}),
    'G_glass':    ('GL', (0.75, 0.93, 0.95), 0.05, 0.0, {}),
    'RT_lawn':    ('RT', (0.2, 0.42, 0.16), 0.9, 0.0, {}),
    'RT_paving':  ('RT', (0.62, 0.62, 0.6), 0.8, 0.0, {}),
    'RT_leaf':    ('RT', (0.16, 0.42, 0.22), 0.8, 0.0, {}),
    'RT_leaf2':   ('RT', (0.3, 0.55, 0.25), 0.8, 0.0, {}),
    'RT_bark':    ('RT', (0.3, 0.22, 0.16), 0.9, 0.0, {}),
    'RT_water':   ('RT', (0.15, 0.35, 0.42), 0.05, 0.3, {}),
    'RT_plant1':  ('RT', (1, 1, 1), 0.7, 0.0, {'tex': os.path.join(MODELS, 'plant01_leaves.png'), 'alpha': True, 'size': 0}),
    'RT_plant2':  ('RT', (1, 1, 1), 0.7, 0.0, {'tex': os.path.join(MODELS, 'plant02_leaves.png'), 'alpha': True, 'size': 0}),
    'RT_stem':    ('RT', (1, 1, 1), 0.8, 0.0, {'tex': os.path.join(MODELS, 'plant01_stem.png'), 'size': 0}),
    # Prefab-only (always realtime lit in the props file).
    'P_white':  ('P', (0.92, 0.94, 0.95), 0.25, 0.0, {}),
    'P_navy':   ('P', (0.03, 0.09, 0.18), 0.3, 0.4, {}),
    'P_visor':  ('P', (0.01, 0.015, 0.025), 0.1, 0.2, {}),
    'P_steel':  ('P', (0.32, 0.38, 0.44), 0.35, 0.8, {}),
    'P_light':  ('P', (0.82, 0.85, 0.86), 0.4, 0.2, {}),
    'P_yellow': ('P', (1.0, 0.6, 0.08), 0.35, 0.1, {}),
    'P_brass':  ('P', (0.6, 0.45, 0.28), 0.3, 0.85, {}),
    'P_glass':  ('P', (0.55, 0.95, 1.0), 0.05, 0.0, {'alpha_value': 0.32}),
    'P_cyan':   ('P', (0.1, 0.85, 1.0), 0.3, 0, {'emit': 3.0}),
    'P_mint':   ('P', (0.3, 1.0, 0.72), 0.3, 0, {'emit': 3.0}),
    'P_green':  ('P', (0.35, 1.0, 0.3), 0.3, 0, {'emit': 3.0}),
    'P_gold':   ('P', (1.0, 0.7, 0.25), 0.3, 0, {'emit': 2.5}),
    'P_pink':   ('P', (1.0, 0.25, 0.55), 0.3, 0, {'emit': 3.5, 'alpha_value': 0.8}),
}
BL_MATS = {}

def principled(nodes):
    return next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')

def set_input(node, names, value):
    for name in names:
        if name in node.inputs:
            node.inputs[name].default_value = value
            return

def make_material(name):
    kind, color, rough, metal, extra = MATS[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = principled(nt.nodes)
    set_input(bsdf, ['Base Color'], (*color, 1))
    set_input(bsdf, ['Roughness'], rough)
    set_input(bsdf, ['Metallic'], metal)
    tex = None
    if extra.get('tex'):
        path = extra['tex'] if os.path.isabs(extra['tex']) else os.path.join(TEX, extra['tex'])
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(path, check_existing=True)
        tex.interpolation = 'Linear'
        uv = nt.nodes.new('ShaderNodeUVMap')
        uv.uv_map = 'UVMap'
        nt.links.new(uv.outputs['UV'], tex.inputs['Vector'])
    if kind == 'EM':
        if tex:
            nt.links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
        else:
            set_input(bsdf, ['Emission Color'], (*color, 1))
        set_input(bsdf, ['Emission Strength'], extra['strength'])
        set_input(bsdf, ['Base Color'], (0, 0, 0, 1))
    elif tex:
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        if extra.get('alpha'):
            nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
            if hasattr(mat, 'surface_render_method'):
                mat.surface_render_method = 'DITHERED'
    if kind == 'GL':
        set_input(bsdf, ['Alpha'], 0.18)
    if extra.get('emit'):
        set_input(bsdf, ['Emission Color'], (*color, 1))
        set_input(bsdf, ['Emission Strength'], extra['emit'])
    if extra.get('alpha_value') is not None:
        set_input(bsdf, ['Alpha'], extra['alpha_value'])
        if hasattr(mat, 'surface_render_method'):
            mat.surface_render_method = 'BLENDED'
    mat.diffuse_color = (*color, 1)
    return mat

def material(name):
    if name not in BL_MATS:
        BL_MATS[name] = make_material(name)
    return BL_MATS[name]

# ---------------------------------------------------------------- geometry accumulation
def bl(x, y, z):
    return Vector((x, -z, y))

def xf(x=0.0, y=0.0, z=0.0, yaw=0.0, pitch=0.0, roll=0.0, scale=None):
    """Game-space placement. yaw: about game +Y; pitch: about game +X; roll: about game +Z."""
    m = Matrix.Translation(bl(x, y, z)) @ Matrix.Rotation(yaw, 4, 'Z') @ \
        Matrix.Rotation(pitch, 4, 'X') @ Matrix.Rotation(-roll, 4, 'Y')
    if scale is not None:
        s = scale if isinstance(scale, (tuple, list)) else (scale, scale, scale)
        m = m @ Matrix.Diagonal((s[0], s[2], s[1], 1))
    return m

class Part:
    def __init__(self):
        self.verts, self.faces, self.uvs, self.smooth = [], [], [], []

PARTS = {}

def emit(group, mat, bm, matrix, smooth=False):
    """Bake a bmesh into world/prefab space and append it to the (group, mat) batch."""
    size = MATS[mat][4].get('size', 1.0)
    if size == 0 and not bm.loops.layers.uv.active:
        # Decals/screens: stretch the texture once over the local front (-Y) face bounds.
        layer = bm.loops.layers.uv.new('UVMap')
        xs = [v.co.x for v in bm.verts]; zs = [v.co.z for v in bm.verts]
        x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
        for f in bm.faces:
            for loop in f.loops:
                loop[layer].uv = ((loop.vert.co.x - x0) / max(1e-6, x1 - x0), (loop.vert.co.z - z0) / max(1e-6, z1 - z0))
    bm.transform(matrix)
    bm.normal_update()
    if group == W and MATS[mat][0] == 'LM':
        # Faces nobody can see (roof tops, slab undersides) would waste lightmap texels.
        hidden = [f for f in bm.faces if (f.normal.z > 0.9 and f.calc_center_median().z > 14.1)
                  or (f.normal.z < -0.9 and f.calc_center_median().z < -1.0 and mat != 'dark')]
        if hidden:
            bmesh.ops.delete(bm, geom=hidden, context='FACES_ONLY')
    bm.verts.index_update()
    bm.faces.index_update()
    part = PARTS.setdefault((group, mat), Part())
    base = len(part.verts)
    part.verts += [v.co.copy() for v in bm.verts]
    for f in bm.faces:
        part.faces.append([base + v.index for v in f.verts])
        n = f.normal
        axis = max(range(3), key=lambda i: abs(n[i]))
        for loop in f.loops:
            if size == 0:
                part.uvs.append(tuple(loop[bm.loops.layers.uv.active].uv) if bm.loops.layers.uv.active else (0, 0))
                continue
            c = loop.vert.co
            u, v = ((c.y, c.z), (c.x, c.z), (c.x, c.y))[axis]
            if axis == 0 and n.x < 0: u = -u
            if axis == 1 and n.y > 0: u = -u
            part.uvs.append((u / size, v / size))
        part.smooth.append(smooth if not isinstance(smooth, set) else f.index in smooth)
    bm.free()

def cube_bm(w, h, d, bevel=0.0, segments=1):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts)
    if bevel > 0:
        b = min(bevel, w / 2.05, h / 2.05, d / 2.05)
        bmesh.ops.bevel(bm, geom=list(bm.edges) + list(bm.verts), offset=b, offset_type='OFFSET',
                        segments=segments, profile=0.5, affect='EDGES', clamp_overlap=True)
    return bm

def box(group, mat, w, h, d, x, y, z, bevel=0.0, yaw=0.0, pitch=0.0, roll=0.0, segments=1):
    emit(group, mat, cube_bm(w, h, d, bevel, segments), xf(x, y, z, yaw, pitch, roll))

def cyl_bm(r, h, segs=24, r2=None, caps=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=segs,
                          radius1=r, radius2=r if r2 is None else r2, depth=h)
    bm.normal_update()
    caps_faces = [f for f in bm.faces if abs(f.normal.z) > 0.999 and len(f.verts) > 4]
    rim = [e for f in caps_faces for e in f.edges]
    if rim:
        bmesh.ops.split_edges(bm, edges=list(set(rim)))
    return bm

def cyl(group, mat, r, h, x, y, z, segs=24, r2=None, pitch=0.0, yaw=0.0, roll=0.0, caps=True):
    bm = cyl_bm(r, h, segs, r2, caps)
    bm.normal_update()
    bm.faces.index_update()
    smooth = {f.index for f in bm.faces if abs(f.normal.z) < 0.999}
    emit(group, mat, bm, xf(x, y, z, yaw, pitch, roll), smooth)

def torus_bm(R, r, seg=48, ring=10, arc=2 * math.pi):
    bm = bmesh.new()
    closed = abs(arc - 2 * math.pi) < 1e-6
    count = seg if closed else seg + 1
    rows = []
    for i in range(count):
        a = arc * i / seg
        ca, sa = math.cos(a), math.sin(a)
        row = []
        for j in range(ring):
            b = 2 * math.pi * j / ring
            rr = R + r * math.cos(b)
            row.append(bm.verts.new((rr * ca, rr * sa, r * math.sin(b))))
        rows.append(row)
    for i in range(seg):
        a, b2 = rows[i], rows[(i + 1) % count]
        for j in range(ring):
            bm.faces.new((a[j], b2[j], b2[(j + 1) % ring], a[(j + 1) % ring]))
    return bm

def torus(group, mat, R, r, x, y, z, seg=48, ring=10, pitch=0.0, yaw=0.0, roll=0.0, arc=2 * math.pi):
    """Torus lying flat (horizontal) by default."""
    emit(group, mat, torus_bm(R, r, seg, ring, arc), xf(x, y, z, yaw, pitch, roll), True)

def sphere(group, mat, r, x, y, z, scale=(1, 1, 1), segs=24, rings=14, yaw=0.0, pitch=0.0):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=r)
    emit(group, mat, bm, xf(x, y, z, yaw, pitch, scale=scale), True)

def prism(group, mat, outline, y0, y1, bevel=0.0):
    """Extrude a closed game-space XZ outline between heights y0 and y1."""
    bm = bmesh.new()
    verts = [bm.verts.new(bl(px, y0, pz)) for px, pz in outline]
    face = bm.faces.new(verts)
    bm.normal_update()
    if face.normal.z > 0:
        face.normal_flip()
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    top = [g for g in ext['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, y1 - y0), verts=top)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, offset_type='OFFSET', segments=1,
                        profile=0.5, affect='EDGES', clamp_overlap=True)
    emit(group, mat, bm, Matrix.Identity(4))

FONT = None
def text(group, mat, body, size, x, y, z, yaw=0.0, pitch=0.0, depth=0.03, align='CENTER'):
    global FONT
    if FONT is None:
        for path in ['/System/Library/Fonts/Supplemental/Arial Bold.ttf',
                     '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']:
            if os.path.exists(path):
                FONT = bpy.data.fonts.load(path, check_existing=True)
                break
    cu = bpy.data.curves.new('txt', 'FONT')
    cu.body = body
    cu.size = size
    cu.extrude = depth / 2
    cu.resolution_u = 3
    cu.align_x = align
    cu.align_y = 'CENTER'
    if FONT:
        cu.font = FONT
    ob = bpy.data.objects.new('txt', cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    bm = bmesh.new()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    bmesh.ops.dissolve_limit(bm, angle_limit=0.01, verts=bm.verts, edges=bm.edges)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
    emit(group, mat, bm, xf(x, y, z, yaw, pitch))

def ribbon(group, mat, points, width, thickness):
    """Flat swoosh band through game-space (x, y) points on a wall facing +x."""
    bm = bmesh.new()
    prev = None
    for i, (px, py, pz) in enumerate(points):
        a = bm.verts.new(bl(px, py - width / 2 * (1 - abs(i / (len(points) - 1) - 0.5)), pz))
        b = bm.verts.new(bl(px, py + width / 2 * (1 - abs(i / (len(points) - 1) - 0.5)), pz))
        if prev:
            bm.faces.new((prev[0], a, b, prev[1]))
        prev = (a, b)
    ext = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
    moved = [g for g in ext['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(thickness, 0, 0), verts=moved)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    emit(group, mat, bm, Matrix.Identity(4))

# ---------------------------------------------------------------- world: architecture
W = 'world'

def build_floors():
    # Two structural islands with a real chasm between them (z -8..-2).
    for z0, z1 in [(-2, 20.6), (-22.6, -8)]:
        zc, d = (z0 + z1) / 2, z1 - z0
        box(W, 'concrete', 28.2, 1.3, d, 0, FLOOR_Y - 0.67, zc)          # slab body
        box(W, 'marble', 27.8, 0.04, d - 0.08, 0, FLOOR_Y - 0.02, zc)    # tiled finish
    # Polished nosing + light strips on both edges of the chasm.
    for z, sgn in [(-2, 1), (-8, -1)]:
        box(W, 'steel', 28.2, 0.12, 0.14, 0, FLOOR_Y - 0.05, z - 0.07 * sgn * -1)
        box(W, 'E_cyan', 27.6, 0.05, 0.04, 0, FLOOR_Y - 0.28, z + 0.01 * sgn)
        box(W, 'yellow', 27.6, 0.012, 0.18, 0, FLOOR_Y + 0.001, z + 0.2 * sgn)
    # Wayfinding light lines in the floor: arrival axis and archive axis.
    for x in (-2.6, 2.6):
        box(W, 'E_cyan', 0.06, 0.012, 21.4, x, FLOOR_Y + 0.002, 9.1)
        box(W, 'E_cyan', 0.06, 0.012, 13.4, x, FLOOR_Y + 0.002, -15.2)
    # Chevrons from the entrance towards the launch pad (pulse at runtime).
    for i in range(5):
        cx, cz = 1.3 + i * 1.24, 17.2 - i * 0.46
        for side in (-1, 1):
            box(W, 'E_mint', 0.42, 0.012, 0.08, cx - 0.1, FLOOR_Y + 0.003, cz + side * 0.12,
                yaw=-math.pi / 2 + 0.36 + side * 0.6)
    # Lower archive level seen through the chasm.
    box(W, 'dark', 28, 0.3, 6.2, 0, -9.0, -5)
    for i in range(15):
        box(W, 'E_cyan', 0.04, 0.02, 6.0, -13 + i * 1.857, -8.84, -5)
    for i in range(4):
        box(W, 'E_cyan', 27.8, 0.02, 0.04, 0, -8.84, -7.4 + i * 1.6)
    for x in (-11.5, -8.0, 8.0, 11.5):
        for z in (-6.6, -3.4):
            box(W, 'dark', 1.0, 3.6, 0.8, x, -7.05, z, bevel=0.03)
            for k in range(6):
                box(W, 'E_cyan' if (k + int(x)) % 3 else 'E_amber', 0.6, 0.03, 0.02, x, -8.4 + k * 0.5, z + 0.41 * (1 if z > -5 else -1))

def build_walls():
    z0, z1 = -22.6, 20.6
    for side in (-1, 1):
        x = side * 13.95
        box(W, 'concrete', 0.5, 0.55, z1 - z0, x, FLOOR_Y + 0.27, (z0 + z1) / 2)  # plinth
        box(W, 'G_glass', 0.04, 13.4, z1 - z0, x, 7.2, (z0 + z1) / 2)
        z = z0
        while z <= z1 + 0.01:
            box(W, 'alu', 0.16, 13.9, 0.14, x, 7.0, z, bevel=0.015)
            z += 2.2
        for y in (4.7, 9.4, 13.9):
            box(W, 'alu', 0.2, 0.16, z1 - z0, x, y, (z0 + z1) / 2, bevel=0.015)
    collider('wall-left', -13.85, -1, 0.28, 43, 0, 13.8)
    collider('wall-right', 13.85, -1, 0.28, 43, 0, 13.8)
    collider('wall-back', 0, -22.9, 28.4, 0.6, 0, 14.2)
    collider('canopy', 0, 23.0, 28.6, 5.0, 7.5, 7.9)
    # Back wall with the elevator bank.
    box(W, 'concrete', 28.4, 14.2, 0.6, 0, 7.1, -22.9)
    box(W, 'walnut', 21.0, 5.6, 0.08, 0, 4.9, -22.58)  # timber feature band around elevators
    for x in (-5.6, 0.0, 5.6):
        main = x == 0.0
        box(W, 'steel', 3.9 if main else 3.3, 5.9 if main else 5.1, 0.5, x, (5.9 if main else 5.1) / 2 + FLOOR_Y, -22.3, bevel=0.04)
        dw = 1.62 if main else 1.32
        for s in (-1, 1):
            box(W, 'alu', dw, (5.3 if main else 4.6), 0.06, x + s * (dw / 2 + 0.01), (5.3 if main else 4.6) / 2 + FLOOR_Y, -22.02)
        box(W, 'E_elevator' if main else 'E_cyan', 3.0 if main else 2.4, 0.1, 0.08, x, (5.62 if main else 4.85) + FLOOR_Y, -22.0)
        cyl(W, 'E_green' if main else 'E_cyan', 0.07, 0.04, x + (2.2 if main else 1.9), 1.35, -22.02, segs=16, pitch=math.pi / 2)
    text(W, 'white', 'ELEVADOR', 0.7, 0, 7.25, -22.5)
    # Front portico: upper glass band, open ground floor, cantilevered canopy.
    box(W, 'G_glass', 28, 6.0, 0.04, 0, 10.9, 20.55)
    for i in range(14):
        box(W, 'alu', 0.14, 6.4, 0.16, -13.0 + i * 2.0, 10.9, 20.55)
    box(W, 'plaster', 28.6, 0.7, 1.0, 0, 7.85, 20.6, bevel=0.05)
    box(W, 'plaster', 28.6, 0.35, 5.0, 0, 7.7, 23.0)
    for i in range(6):
        cyl(W, 'E_light', 0.28, 0.03, -10 + i * 4, 7.51, 22.6, segs=20)
    box(W, 'E_light', 26, 0.04, 0.06, 0, 7.5, 20.25)

def build_ceiling():
    y = 14.15
    # Ceiling with four long skylights (real openings, glazed).
    sky = [(-13.9, -11.4), (-4.0, -1.5), (6.2, 8.7), (15.1, 17.6)]
    edges = [-22.6] + [v for s in sky for v in s] + [20.6]
    for i in range(0, len(edges), 2):
        za, zb = edges[i], edges[i + 1]
        box(W, 'plaster', 28.4, 0.5, zb - za, 0, y + 0.25, (za + zb) / 2)
    for za, zb in sky:
        zc = (za + zb) / 2
        box(W, 'plaster', 9.0, 0.5, zb - za, -11.2, y + 0.25, zc)
        box(W, 'plaster', 9.0, 0.5, zb - za, 11.2, y + 0.25, zc)
        box(W, 'G_glass', 13.4, 0.04, zb - za, 0, y + 0.6, zc)
        for x in (-4.4, -2.2, 0, 2.2, 4.4):
            box(W, 'alu', 0.1, 0.18, zb - za, x, y + 0.5, zc)
        box(W, 'E_light', 13.0, 0.04, 0.06, 0, y - 0.02, za + 0.05)
        box(W, 'E_light', 13.0, 0.04, 0.06, 0, y - 0.02, zb - 0.05)
    # Timber ceiling baffles between skylights add rhythm and scale.
    for za, zb in [(-11.4, -4.0), (-1.5, 6.2), (8.7, 15.1)]:
        n = int((zb - za) / 0.55)
        for k in range(n):
            box(W, 'walnut', 18.0, 0.42, 0.09, 0, y - 0.2, za + 0.35 + k * 0.55)

def build_columns():
    for z in PILASTER_Z:
        for side in (-1, 1):
            x = side * 12.85
            cyl(W, 'white', 0.42, 13.6, x, 7.0, z, segs=32)
            cyl(W, 'bronze', 0.5, 0.22, x, FLOOR_Y + 0.11, z, segs=32)
            cyl(W, 'bronze', 0.5, 0.18, x, 13.88, z, segs=32)
            torus(W, 'E_cyan', 0.43, 0.025, x, 3.2, z, seg=32, ring=6)
            collider(f'pilaster-{side}-{z}', x, z, 0.9, 0.9, 0, 12)

def build_mezzanine():
    # Left-side gallery at +6.6 m: far above any reachable jump arc.
    x0, x1, y = -13.7, -10.4, 6.6
    box(W, 'white', x1 - x0, 0.42, 41.0, (x0 + x1) / 2, y, -1.0, bevel=0.04)
    box(W, 'walnut', 0.06, 0.32, 41.0, x1 + 0.02, y, -1.0)
    box(W, 'E_light', 0.04, 0.03, 40.6, x1 - 0.12, y - 0.23, -1.0)
    box(W, 'G_glass', 0.03, 1.05, 41.0, x1 - 0.08, y + 0.74, -1.0)
    box(W, 'bronze', 0.07, 0.07, 41.0, x1 - 0.08, y + 1.3, -1.0, bevel=0.02)
    for k in range(21):
        box(W, 'bronze', 0.04, 1.05, 0.04, x1 - 0.08, y + 0.74, -21.0 + k * 2.0)
    # Hanging planter trough on the gallery edge (vines are realtime foliage).
    box(W, 'navy', 0.5, 0.4, 41.0, x1 - 0.4, y + 0.45, -1.0)

def build_reception():
    # Curved concierge desk (walkable top at 1.59 m), walnut slats and LED plinth.
    cx, cz = -8.7, 10.7
    arc = []
    # The curved face bulges towards the entrance (+z), so arriving players see the
    # walnut slats; the service side faces the feature wall and the drone.
    for i in range(25):
        t = -1 + 2 * i / 24
        arc.append((cx + t * 2.95, cz + 1.25 * (1 - t * t) - 0.25))
    inner = [(px, pz - 1.0) for px, pz in reversed(arc)]
    prism(W, 'white', arc + inner, 0.25, 1.47)
    top = [(px, pz + 0.07) for px, pz in arc] + [(px, pz - 1.04) for px, pz in reversed(arc)]
    prism(W, 'white', top, 1.47, 1.59, bevel=0.03)
    for i in range(1, 60):
        t = -1 + 2 * i / 60
        px, pz = cx + t * 2.95, cz + 1.25 * (1 - t * t) - 0.25 + 0.035
        slope = 2 * t * 1.25 / 2.95
        box(W, 'walnut', 0.06, 1.2, 0.06, px, 0.86, pz, yaw=math.atan(slope))
    plinth = [(px, pz - 0.06) for px, pz in arc] + [(px, pz - 0.94) for px, pz in reversed(arc)]
    prism(W, 'dark', plinth, FLOOR_Y, 0.25)
    prism(W, 'E_cyan', [(px, pz - 0.02) for px, pz in arc] + [(px, pz - 0.06) for px, pz in reversed(arc)], 0.2, 0.24)
    collider('reception-desk', -8.7, 10.7, 6.15, 2.8, 0.08, 1.64)
    walkable(-8.7, 10.7, 2.93, 1.2, 1.59)
    # Feature wall with the institutional mark, under the gallery.
    box(W, 'concrete', 0.3, 6.2, 8.0, -13.55, 3.2, 10.4)
    collider('feature-wall', -13.5, 10.4, 0.4, 8.0, 0, 6.3)
    box(W, 'walnut', 0.06, 1.0, 8.0, -13.38, 0.62, 10.4)
    box(W, 'E_light', 0.04, 0.04, 7.8, -13.37, 6.0, 10.4)
    pts1 = [(-13.36, 3.0 + 0.55 * math.sin(i / 10 * math.pi * 1.1), 13.9 - i * 0.38) for i in range(11)]
    pts2 = [(-13.35, 2.55 + 0.45 * math.sin(i / 10 * math.pi * 1.1 + 0.4), 13.7 - i * 0.36) for i in range(11)]
    ribbon(W, 'E_green', pts1, 0.42, 0.05)
    ribbon(W, 'E_cyan', pts2, 0.38, 0.05)
    text(W, 'white', 'PGE DIGITAL', 0.56, -13.33, 4.35, 11.85, yaw=math.pi / 2, depth=0.06)
    text(W, 'bronze', 'RECEPÇÃO', 0.34, -13.33, 1.65, 11.85, yaw=math.pi / 2, depth=0.04)
    # Hanging reception sign facing the entrance.
    box(W, 'navy', 3.6, 0.9, 0.12, -8.6, 3.3, 10.5, bevel=0.03)
    collider('sign-reception', -8.6, 10.5, 3.7, 0.3, 2.8, 3.85, camera_only=True)
    box(W, 'yellow', 3.6, 0.05, 0.13, -8.6, 3.77, 10.5)
    text(W, 'white', 'RECEPÇÃO', 0.42, -8.6, 3.28, 10.58, depth=0.02)
    text(W, 'white', 'RECEPÇÃO', 0.42, -8.6, 3.28, 10.42, yaw=math.pi, depth=0.02)
    for s in (-1, 1):
        cyl(W, 'steel', 0.012, 2.9, -8.6 + s * 1.5, 5.2, 10.5, segs=6)

def build_terminals():
    for key, (x, z, label) in TERMINALS.items():
        # Kiosk inspired by concept-02: pedestal, tilted screen, accent strips.
        box(W, 'white', 1.6, 0.16, 1.2, x, FLOOR_Y + 0.08, z, bevel=0.05)
        box(W, 'navy', 0.9, 1.1, 0.6, x, 0.72, z + 0.05, bevel=0.06)
        for s in (-1, 1):
            box(W, 'E_cyan', 0.04, 0.8, 0.04, x + s * 0.47, 0.75, z + 0.36)
        box(W, 'white', 2.3, 1.45, 0.16, x, 1.9, z - 0.05, bevel=0.07, pitch=-0.3)
        box(W, 'E_screen', 2.0, 1.18, 0.02, x, 1.9 + 0.02, z + 0.04, pitch=-0.3)
        box(W, 'yellow', 0.1, 0.9, 0.17, x + 1.18, 1.9, z - 0.05, pitch=-0.3)
        box(W, 'yellow', 0.1, 0.9, 0.17, x - 1.18, 1.9, z - 0.05, pitch=-0.3)
        text(W, 'white', label, 0.26, x, 2.85, z - 0.25, pitch=-0.3, depth=0.03)
        torus(W, 'E_cyan', 1.65, 0.03, x, FLOOR_Y + 0.01, z, seg=72, ring=6)
        torus(W, 'E_cyan', 1.45, 0.012, x, FLOOR_Y + 0.01, z, seg=72, ring=4)
        collider('terminal-' + label, x, z, 2.65, 1.85, 0.05, 2.9)

def build_elevator_door():
    collider('elevator-door', 0, -21.28, 4.55, 0.32, 0, 5.8)

def build_planters():
    for x, z, seed in PLANTERS:
        cyl(W, 'white', 0.62, 0.7, x, FLOOR_Y + 0.35, z, segs=40, r2=0.5)
        cyl(W, 'bronze', 0.63, 0.04, x, FLOOR_Y + 0.71, z, segs=40)
        cyl(W, 'soil', 0.57, 0.04, x, FLOOR_Y + 0.68, z, segs=32)
        collider(f'planter-{seed}', x, z, 1.16, 1.16, 0, 3.4)
        PLANTS.append(('plant01' if seed != 2 else 'plant02', x, FLOOR_Y + 0.68, z, 2.3 if seed != 2 else 2.0, seed))

def build_benches():
    for x, z, yaw in BENCHES:
        sideways = abs(math.sin(yaw)) > 0.7
        collider(f'bench-{x}-{z}', x, z, 1.0 if sideways else 2.25, 2.25 if sideways else 1.0, 0.0, 1.22)
        c, s = math.cos(yaw), math.sin(yaw)
        def at(lx, lz):
            return x + lx * c + lz * s, z - lx * s + lz * c
        px, pz = at(0, 0)
        box(W, 'walnut', 2.1, 0.09, 0.6, px, 0.52, pz, bevel=0.02, yaw=yaw)
        px, pz = at(0, 0.29)
        box(W, 'walnut', 2.1, 0.5, 0.07, px, 0.88, pz, bevel=0.02, yaw=yaw, pitch=0.12)
        for lx in (-0.85, 0.85):
            px, pz = at(lx, 0.0)
            box(W, 'steel', 0.06, 0.45, 0.56, px, FLOOR_Y + 0.25, pz, bevel=0.01, yaw=yaw)

def build_course_static():
    for p in PLATFORMS:
        h = max(0.4, p['y'] - 0.35)
        cyl(W, 'steel', 0.16, h, p['x'], FLOOR_Y + h / 2, p['z'], segs=20)
        cyl(W, 'bronze', 0.32, 0.08, p['x'], FLOOR_Y + 0.04, p['z'], segs=24)
        torus(W, 'E_cyan', 0.17, 0.02, p['x'], h * 0.66, p['z'], seg=20, ring=6)
        collider('support-' + str(p['z']), p['x'], p['z'], 0.53, 0.53, 0, p['y'] - 0.15)
    # Hanging wayfinding signs.
    for label, x, z in [('CIRCUITO DO LEVI', 8.2, 19.0), ('CORREDOR / DASH', 0.0, 7.5)]:
        box(W, 'navy', 4.8, 1.0, 0.1, x, 4.4, z, bevel=0.03)
        collider('sign-' + label.split()[0].lower(), x, z, 4.9, 0.3, 3.85, 4.95, camera_only=True)
        box(W, 'yellow', 4.8, 0.06, 0.11, x, 4.93, z)
        text(W, 'white', label, 0.36, x, 4.38, z + 0.06, depth=0.02)
        text(W, 'white', label, 0.36, x, 4.38, z - 0.06, yaw=math.pi, depth=0.02)
        for s in (-1, 1):
            cyl(W, 'steel', 0.012, 8.8, x + s * 2.1, 9.35, z, segs=6)
    # Sign above the archive side.
    box(W, 'navy', 7.0, 1.0, 0.1, 0, 8.8, -8.6, bevel=0.03)
    box(W, 'yellow', 7.0, 0.06, 0.11, 0, 9.33, -8.6)
    text(W, 'white', 'ARQUIVO INTELIGENTE', 0.42, 0, 8.78, -8.53, depth=0.02)
    for s in (-1, 1):
        cyl(W, 'steel', 0.012, 4.8, s * 3.2, 11.7, -8.6, segs=6)

def build_exterior():
    box(W, 'RT_paving', 60, 0.2, 22, 0, FLOOR_Y - 0.12, 31.5)
    box(W, 'RT_lawn', 34, 0.2, 80, -31.0, FLOOR_Y - 0.5, 0)
    box(W, 'RT_lawn', 34, 0.2, 80, 31.0, FLOOR_Y - 0.5, 0)
    box(W, 'RT_lawn', 96, 0.2, 30, 0, FLOOR_Y - 0.5, -38)
    for side in (-1, 1):
        box(W, 'RT_water', 9, 0.05, 6, side * 11, FLOOR_Y - 0.05, 27)
        box(W, 'white', 9.4, 0.3, 0.2, side * 11, FLOOR_Y + 0.05, 23.9)
        box(W, 'white', 9.4, 0.3, 0.2, side * 11, FLOOR_Y + 0.05, 30.1)
        box(W, 'white', 0.2, 0.3, 6.4, side * 6.4, FLOOR_Y + 0.05, 27)
        box(W, 'white', 0.2, 0.3, 6.4, side * 15.6, FLOOR_Y + 0.05, 27)
    rng = np.random.default_rng(7)
    spots = [(x, z) for x in (-24, -19, 19, 24) for z in range(-20, 22, 7)] + \
            [(x, -27 + rng.uniform(-2, 2)) for x in range(-24, 25, 6)] + [(-20, 30), (20, 31), (-28, 26), (28, 25)]
    for i, (x, z) in enumerate(spots):
        x += rng.uniform(-1.5, 1.5); z += rng.uniform(-1.5, 1.5)
        h = rng.uniform(3.2, 5.2)
        cyl(W, 'RT_bark', 0.18, h, x, h / 2, z, segs=8, r2=0.12)
        for k in range(3):
            sphere(W, 'RT_leaf' if (i + k) % 2 else 'RT_leaf2', rng.uniform(1.4, 2.0),
                   x + rng.uniform(-0.8, 0.8), h + rng.uniform(-0.2, 1.4), z + rng.uniform(-0.8, 0.8),
                   scale=(1.0, 0.85, 1.0), segs=10, rings=7)
    for side in (-1, 1):
        for k in range(10):
            box(W, 'RT_leaf', 1.6, 0.9, 1.0, side * 15.8, FLOOR_Y + 0.4, -20 + k * 4.4, bevel=0.3, segments=2)

PLANTS = []
def build_plants():
    # Poly Haven CC0 foliage (potted_plant_01/02), stored as meshes in plants.blend.
    with bpy.data.libraries.load(os.path.join(MODELS, 'plants.blend')) as (src, dst):
        dst.meshes = [m for m in src.meshes]
    meshes = {m.name: decimated(m, 0.45) for m in dst.meshes}
    extra = [('plant02', -12.3, FLOOR_Y + 0.68, -6.0, 1.7, 4), ('plant02', 12.3, FLOOR_Y + 0.68, 12.5, 1.7, 5),
             ('plant01', 5.6, FLOOR_Y + 0.68, -20.3, 2.0, 6), ('plant01', -5.6, FLOOR_Y + 0.68, -20.3, 2.0, 7)]
    for kind, x, y, z, s, seed in extra:
        cyl(W, 'white', 0.5, 0.7, x, FLOOR_Y + 0.35, z, segs=40, r2=0.4)
        cyl(W, 'soil', 0.46, 0.04, x, FLOOR_Y + 0.68, z, segs=32)
        collider(f'planter-{seed}', x, z, 1.0, 1.0, 0, 3.0)
    for kind, x, y, z, s, seed in PLANTS + extra:
        parts = [('plant01_leaves', 'RT_plant1'), ('plant01_stem', 'RT_stem')] if kind == 'plant01' \
            else [('plant02_leaves', 'RT_plant2')]
        for mesh_name, mat in parts:
            bm = bmesh.new()
            bm.from_mesh(meshes[mesh_name])
            emit(W, mat, bm, Matrix.Translation(bl(x, y, z)) @ Matrix.Rotation(seed * 1.3, 4, 'Z') @ Matrix.Scale(s, 4), True)
    # Foliage spilling over the gallery trough, upside down so leaves trail downwards.
    for k in range(9):
        z = -19.0 + k * 4.6
        bm = bmesh.new()
        bm.from_mesh(meshes['plant02_leaves'])
        emit(W, 'RT_plant2', bm, Matrix.Translation(bl(-10.75, 7.25, z)) @ Matrix.Rotation(k * 2.1, 4, 'Z')
             @ Matrix.Rotation(2.4, 4, 'X') @ Matrix.Scale(1.6, 4), True)

def decimated(mesh, ratio):
    ob = bpy.data.objects.new('tmp_' + mesh.name, mesh)
    bpy.context.scene.collection.objects.link(ob)
    mod = ob.modifiers.new('dec', 'DECIMATE')
    mod.ratio = ratio
    dg = bpy.context.evaluated_depsgraph_get()
    result = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    result.name = mesh.name + '_lod'
    bpy.data.objects.remove(ob)
    return result

# ---------------------------------------------------------------- prefabs (props01.glb)
def build_prefabs():
    # Helper drone (reception courier): white shell, dark visor, cyan eyes, side rotors.
    g = 'helper_drone'
    sphere(g, 'P_white', 0.34, 0, 0, 0, scale=(1.0, 0.92, 0.95))
    sphere(g, 'P_visor', 0.25, 0, 0.03, -0.17, scale=(1.05, 0.72, 0.5))
    for s in (-1, 1):
        box(g, 'P_cyan', 0.07, 0.1, 0.03, s * 0.09, 0.07, -0.42, bevel=0.015, segments=2)
        cyl(g, 'P_navy', 0.08, 0.12, s * 0.36, 0.02, 0, segs=16, roll=math.pi / 2)
        torus(g, 'P_cyan', 0.09, 0.012, s * 0.42, 0.02, 0, seg=20, ring=5, roll=math.pi / 2)
        box(g, 'P_white', 0.34, 0.015, 0.06, s * 0.36, 0.17, 0, yaw=s * 0.4)
    cyl(g, 'P_navy', 0.012, 0.16, 0, 0.38, 0, segs=6)
    sphere(g, 'P_cyan', 0.05, 0, 0.48, 0, segs=12, rings=8)
    # Sentinel drone (course hazard): dark steel, pink eye, rotor ring.
    g = 'sentinel_drone'
    sphere(g, 'P_steel', 0.42, 0, 0, 0, scale=(1, 0.8, 1))
    sphere(g, 'P_pink', 0.17, 0, 0, -0.36, segs=16, rings=10)
    torus(g, 'P_navy', 0.6, 0.04, 0, 0.05, 0, seg=40, ring=8)
    for a in range(4):
        box(g, 'P_navy', 0.2, 0.04, 0.05, 0.5 * math.cos(a * math.pi / 2), 0.05, 0.5 * math.sin(a * math.pi / 2), yaw=a * math.pi / 2)
    torus(g, 'P_pink', 0.25, 0.015, 0, -0.33, 0, seg=24, ring=5)
    # Data cube collectible: glass shell with a lit spreadsheet cell grid.
    g = 'data_cube'
    box(g, 'P_glass', 0.56, 0.56, 0.56, 0, 0, 0, bevel=0.04, segments=2)
    for i in range(3):
        for j in range(3):
            for k in range(3):
                bright = (i, j, k) == (1, 1, 1) or (i + j + k) % 4 == 0
                box(g, 'P_green' if bright else 'P_cyan', 0.12, 0.12, 0.12,
                    (i - 1) * 0.16, (j - 1) * 0.16, (k - 1) * 0.16, bevel=0.015)
    torus('data_halo', 'P_cyan', 0.47, 0.018, 0, 0, 0, seg=40, ring=5)
    # Moving platforms: deck top surface at local y = +0.06.
    for idx, p in enumerate(PLATFORMS):
        g = f'platform_{idx}'
        w, d = p['w'], p['d']
        box(g, 'P_steel', w, 0.28, d, 0, -0.1, 0, bevel=0.08, segments=2)
        box(g, 'P_light', w - 0.14, 0.06, d - 0.14, 0, 0.03, 0, bevel=0.02)
        for s in (-1, 1):
            box(g, 'P_yellow', 0.12, 0.12, d - 0.2, s * (w / 2 - 0.02), -0.06, 0, bevel=0.03)
            box(g, 'P_cyan', w - 0.5, 0.03, 0.05, 0, 0.065, s * (d / 2 - 0.2))
        cyl(g, 'P_navy', 0.42, 0.22, 0, -0.34, 0, segs=24, r2=0.3)
        cyl(g, 'P_cyan', 0.27, 0.02, 0, -0.455, 0, segs=24)
    # Jump pad base and its spinning ring.
    g = 'jump_pad'
    cyl(g, 'P_steel', 1.05, 0.28, 0, 0, 0, segs=40)
    cyl(g, 'P_yellow', 1.08, 0.08, 0, 0.1, 0, segs=40)
    cyl(g, 'P_mint', 0.75, 0.04, 0, 0.16, 0, segs=40)
    for a in range(3):
        box(g, 'P_navy', 0.12, 0.05, 0.7, 0.4 * math.cos(a * 2.094), 0.17, 0.4 * math.sin(a * 2.094), yaw=-a * 2.094)
    torus('jump_pad_ring', 'P_mint', 0.87, 0.05, 0, 0, 0, seg=48, ring=8)
    torus('finish_ring', 'P_gold', 1.05, 0.06, 0, 0, 0, seg=56, ring=8)
    torus('finish_ring', 'P_gold', 0.85, 0.02, 0, 0, 0, seg=48, ring=5)
    # Dash barrier: brass frame with energy grille, centred at its middle.
    g = 'barrier'
    for y in (1.01, -1.0):
        box(g, 'P_brass', 6.65, 0.16, 0.38, 0, y, 0, bevel=0.04)
    for s in (-1, 1):
        box(g, 'P_light', 0.24, 2.2, 0.42, s * 3.25, 0, 0, bevel=0.05)
        box(g, 'P_pink', 0.04, 1.7, 0.06, s * 3.1, 0, 0.2)
    for i in range(-5, 6):
        box(g, 'P_pink', 0.035, 1.85, 0.075, i * 0.52, 0, 0)
    # Scanner: beam with the two emitters, origin at the beam centre.
    g = 'scanner'
    box(g, 'P_pink', 3.4, 0.1, 0.11, 0, 0, 0)
    for s in (-1, 1):
        box(g, 'P_brass', 0.2, 0.62, 0.32, s * 1.75, -0.05, 0, bevel=0.04)
        cyl(g, 'P_pink', 0.07, 0.04, s * 1.64, 0, 0, segs=12, roll=math.pi / 2)
    # Bridge segment (deploys after the filter mission).
    g = 'bridge_segment'
    box(g, 'P_steel', 4.2, 0.24, 0.96, 0, -0.12, 0, bevel=0.03)
    box(g, 'P_light', 4.0, 0.03, 0.9, 0, 0.0, 0)
    for s in (-1, 1):
        box(g, 'P_yellow', 0.1, 0.1, 0.93, s * 2.04, 0.04, 0)
        box(g, 'P_cyan', 0.04, 0.02, 0.9, s * 1.85, 0.02, 0)
        box(g, 'P_brass', 0.05, 0.9, 0.05, s * 2.04, 0.5, 0)
        box(g, 'P_brass', 0.06, 0.06, 0.96, s * 2.04, 0.95, 0)
    # Kinetic information mobile above the reception.
    for i in range(3):
        torus('info_rings', 'P_mint' if i == 1 else 'P_brass', 1.3 + i * 0.36, 0.043, 0, 0, 0,
              seg=64, ring=8, pitch=0.14 + i * 0.12, yaw=0.1 + i * 0.4, roll=i * 0.4)
    cyl('info_rings', 'P_light', 0.18, 0.34, 0, 0, 0, segs=16)

# ---------------------------------------------------------------- screen texture
def make_screen_texture():
    """Procedural spreadsheet screen (deterministic) used by the terminal displays."""
    w, h = 512, 320
    img = np.zeros((h, w, 4), np.float32)
    img[...] = (0.02, 0.09, 0.12, 1)
    img[h - 34:h, :] = (0.05, 0.3, 0.36, 1)                     # header bar (top rows)
    for c in range(1, 5):
        img[:h - 34, c * 102 - 1:c * 102 + 1] = (0.1, 0.7, 0.8, 1)
    for r in range(1, 8):
        y = h - 34 - r * 36
        img[y - 1:y + 1, :] = (0.1, 0.55, 0.65, 1)
    img[h - 34 - 3 * 36 + 2:h - 34 - 2 * 36 - 1, 103:203] = (0.2, 0.9, 0.35, 1)  # selected cell
    img[h - 34 - 3 * 36 + 2:h - 34 - 2 * 36 - 1, 205:305] = (0.12, 0.5, 0.25, 1)
    for i in range(0, 4):
        img[h - 22:h - 12, 20 + i * 102:70 + i * 102] = (0.75, 0.95, 1, 1)
    image = bpy.data.images.new('screen_sheet', w, h)
    image.pixels.foreach_set(img.ravel())
    image.filepath_raw = os.path.join(TEX, 'screen_sheet.png')
    image.file_format = 'PNG'
    image.save()
    bpy.data.images.remove(image)

# ---------------------------------------------------------------- scene assembly
def reset_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob)
    for coll in list(bpy.data.collections):
        bpy.data.collections.remove(coll)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.lights, bpy.data.curves):
        for item in list(block):
            block.remove(item)
    PARTS.clear()
    PLANTS.clear()
    BL_MATS.clear()
    LEVEL['colliders'].clear()
    LEVEL['walkables'].clear()

def collection(name):
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    return coll

def realise():
    worlds = collection('WORLD01')
    props = collection('PROPS01')
    roots = {}
    for (group, mat), part in PARTS.items():
        kind = MATS[mat][0]
        name = f'{kind}_{mat}' if group == W else f'{group}__{mat}'
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(v) for v in part.verts], [], part.faces)
        uv = me.uv_layers.new(name='UVMap')
        uv.data.foreach_set('uv', [c for t in part.uvs for c in t])
        me.polygons.foreach_set('use_smooth', part.smooth)
        me.materials.append(material(mat))
        me.update()
        ob = bpy.data.objects.new(name, me)
        if group == W:
            worlds.objects.link(ob)
        else:
            if group not in roots:
                root = bpy.data.objects.new('PF_' + group, None)
                props.objects.link(root)
                roots[group] = root
            ob.parent = roots[group]
            props.objects.link(ob)
    # Lay prefabs out in a row below the archive for inspection (export resets to origin).
    for i, root in enumerate(roots.values()):
        root.location = (-16 + i * 2.6, 40, -14)
    return worlds, props

def debug_colliders():
    coll = collection('COLLISION')
    coll.hide_render = True
    for c in LEVEL['colliders']:
        ob = bpy.data.objects.new('COL_' + c['id'], None)
        ob.empty_display_type = 'CUBE'
        h = c['maxY'] - c['minY']
        ob.location = bl(c['x'], c['minY'] + h / 2, c['z'])
        ob.scale = (c['width'] / 2, c['depth'] / 2, h / 2)
        coll.objects.link(ob)

def setup_lighting():
    scene = bpy.context.scene
    world = bpy.data.worlds.get('LeviSky') or bpy.data.worlds.new('LeviSky')
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (0.62, 0.78, 1.0, 1)
    bg.inputs['Strength'].default_value = 1.2
    scene.world = world
    sun_data = bpy.data.lights.new('Sun', 'SUN')
    sun_data.energy = 4.2
    sun_data.angle = math.radians(2.5)
    sun_data.color = (1.0, 0.95, 0.86)
    sun = bpy.data.objects.new('Sun', sun_data)
    direction = bl(8, -16, -11).normalized()   # same as the realtime DirectionalLight at (-8,16,11)
    sun.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(sun)
    # Soft interior fill under each skylight (not visible to camera).
    for z in (-12.65, -2.75, 7.45, 16.35, -18.0, 2.0, 12.0):
        data = bpy.data.lights.new(f'Fill{z}', 'AREA')
        data.shape = 'RECTANGLE'
        data.size, data.size_y = 12.0, 2.5
        data.energy = 900
        data.color = (1.0, 0.94, 0.85)
        ob = bpy.data.objects.new(f'Fill{z}', data)
        ob.location = bl(0, 13.4, z)
        scene.collection.objects.link(ob)

def select_only(objs):
    for ob in bpy.context.scene.objects:
        ob.select_set(False)
    for ob in objs:
        ob.select_set(True)
    if objs:
        bpy.context.view_layer.objects.active = objs[0]

def lightmap_uvs(objs):
    for ob in objs:
        layer = ob.data.uv_layers.get('Lightmap') or ob.data.uv_layers.new(name='Lightmap')
        ob.data.uv_layers['UVMap'].active_render = True
        ob.data.uv_layers.active = layer
    select_only(objs)
    with bpy.context.temp_override(**view3d_context()):
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0, area_weight=0.0,
                                 correct_aspect=True, scale_to_bounds=False)
        bpy.ops.uv.select_all(action='SELECT')
        bpy.ops.uv.average_islands_scale()
        bpy.ops.object.mode_set(mode='OBJECT')
    # Spend texels where the player looks: floors and the reception get more,
    # the far ceiling less. pack_islands keeps these relative scales.
    density = {'LM_marble': 1.8, 'LM_walnut': 1.2, 'LM_white': 1.4, 'LM_plaster': 0.7, 'LM_concrete': 0.9}
    for ob in objs:
        k = density.get(ob.name, 1.0)
        if k != 1.0:
            data = ob.data.uv_layers['Lightmap'].data
            uv = np.empty(len(data) * 2, np.float32)
            data.foreach_get('uv', uv)
            data.foreach_set('uv', uv * k)
    with bpy.context.temp_override(**view3d_context()):
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.uv.select_all(action='SELECT')
        bpy.ops.uv.pack_islands(rotate=True, margin=0.0025)
        bpy.ops.object.mode_set(mode='OBJECT')

def view3d_context():
    """Edit-mode operators need a 3D view when driven from the MCP timer; none in -b."""
    wm = bpy.context.window_manager
    for window in (wm.windows if wm else []):
        for area in window.screen.areas:
            if area.type == 'VIEW_3D':
                region = next(r for r in area.regions if r.type == 'WINDOW')
                return {'window': window, 'area': area, 'region': region}
    return {}

def bake(objs):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons.get('cycles')
    if prefs:
        cp = prefs.preferences
        for device_type in ('METAL', 'OPTIX', 'CUDA', 'HIP'):
            try:
                cp.compute_device_type = device_type
                cp.get_devices()
                if any(d.type == device_type for d in cp.devices):
                    for d in cp.devices:
                        d.use = True
                    scene.cycles.device = 'GPU'
                    break
            except TypeError:
                continue
    scene.cycles.samples = BAKE_SAMPLES
    scene.cycles.max_bounces = 6
    image = bpy.data.images.new('Lightmap', LIGHTMAP_SIZE, LIGHTMAP_SIZE, float_buffer=True)
    for ob in objs:
        for mat in ob.data.materials:
            nt = mat.node_tree
            node = nt.nodes.get('LightmapTarget') or nt.nodes.new('ShaderNodeTexImage')
            node.name = 'LightmapTarget'
            node.image = image
            nt.nodes.active = node
    glass = [ob for ob in bpy.data.objects if ob.name.startswith('GL_')]
    for ob in glass:
        ob.hide_render = True
    select_only(objs)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=6,
                        use_clear=True, target='IMAGE_TEXTURES')
    for ob in glass:
        ob.hide_render = False
    for ob in objs:
        for mat in ob.data.materials:
            node = mat.node_tree.nodes.get('LightmapTarget')
            if node:
                mat.node_tree.nodes.remove(node)
        ob.data.uv_layers.active = ob.data.uv_layers['UVMap']
    return image

def save_lightmap(image):
    px = np.array(image.pixels[:], np.float32).reshape(LIGHTMAP_SIZE, LIGHTMAP_SIZE, 4)
    rgb = px[..., :3]
    lum = rgb.max(axis=2)
    covered = lum > 1e-5
    scale = float(np.percentile(lum[covered], 99.5)) if covered.any() else 1.0
    scale = max(scale, 1e-3)
    encoded = np.clip(rgb / scale, 0, 1)
    encoded = np.where(encoded <= 0.0031308, encoded * 12.92, 1.055 * np.power(encoded, 1 / 2.4) - 0.055)
    out = np.ones_like(px)
    out[..., :3] = encoded
    ldr = bpy.data.images.new('LightmapLDR', LIGHTMAP_SIZE, LIGHTMAP_SIZE)
    ldr.colorspace_settings.name = 'Non-Color'
    ldr.pixels.foreach_set(out.ravel())
    path = os.path.join(OUT, 'world01-lightmap.webp')
    ldr.filepath_raw = path
    ldr.file_format = 'WEBP'
    bpy.context.scene.render.image_settings.quality = 88
    ldr.save()
    LEVEL['render']['lightMapScale'] = round(scale, 4)
    return path

def gltf_export(path, objs):
    select_only(objs)
    valid = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    opts = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                export_texcoords=True, export_normals=True, export_materials='EXPORT',
                export_image_format='WEBP', export_yup=True, export_extras=False,
                export_cameras=False, export_lights=False, export_animations=False,
                export_tangents=False, export_attributes=False)
    bpy.ops.export_scene.gltf(**{k: v for k, v in opts.items() if k in valid})

def export_level():
    os.makedirs(os.path.dirname(LEVEL_JSON), exist_ok=True)
    with open(LEVEL_JSON, 'w', encoding='utf-8') as fh:
        json.dump(LEVEL, fh, indent=1, ensure_ascii=False)
        fh.write('\n')

def build(do_bake=True, do_export=True):
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    reset_scene()
    os.makedirs(OUT, exist_ok=True)
    make_screen_texture()
    build_floors(); build_walls(); build_ceiling(); build_columns(); build_mezzanine()
    build_reception(); build_terminals(); build_elevator_door(); build_planters()
    build_benches(); build_course_static(); build_exterior(); build_plants(); build_prefabs()
    worlds, props = realise()
    debug_colliders()
    setup_lighting()
    lm = [ob for ob in worlds.objects if ob.name.startswith('LM_')]
    lightmap_uvs(lm)
    if do_bake:
        save_lightmap(bake(lm))
    if do_export:
        gltf_export(os.path.join(OUT, 'world01.glb'), list(worlds.objects))
        saved = {r: r.location.copy() for r in props.objects if r.parent is None}
        for r in saved:
            r.location = (0, 0, 0)
        gltf_export(os.path.join(OUT, 'props01.glb'), list(props.objects))
        for r, loc in saved.items():
            r.location = loc
        export_level()
    tris = sum(sum(len(p.vertices) - 2 for p in ob.data.polygons) for ob in worlds.objects)
    print(f'world01: {len(worlds.objects)} meshes, {tris} triangles; props: {len(props.objects)} objects')

if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    build(do_bake='--no-bake' not in args and os.environ.get('LEVI_NO_BAKE') != '1',
          do_export='--no-export' not in args)
