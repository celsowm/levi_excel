"""Shared toolkit for the LEVI stage builders (Blender 4.2+, tested on 5.2).

Every coordinate is a GAME coordinate (Three.js: x right, y up, z towards the camera
at spawn). `bl()` converts to Blender's Z-up frame; the glTF exporter converts back.

Mesh-name prefixes tell the runtime how to shade a static mesh:
  LM_  baked lightmap (unlit at runtime)      EM_  emissive, unlit
  GL_  glass                                   RT_  lit by realtime lights (foliage, far exterior)
Prefabs (props.glb) are PF_<name> roots made of P_ materials and lit in realtime.

Gameplay data is registered next to the geometry that motivates it (collider(),
floor(), walkable(), entity()) and exported to src/data/stages/<id>.json.
"""
import bpy, bmesh, math, json, os
import numpy as np
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
TEX = os.path.join(HERE, 'textures')
MODELS = os.path.join(HERE, 'models')
PUBLIC = os.path.join(ROOT, 'public', 'stages')
DATA = os.path.join(ROOT, 'src', 'data', 'stages')
LIGHTMAP_SIZE = 2048
BAKE_SAMPLES = int(os.environ.get('LEVI_BAKE_SAMPLES', '256'))
FLOOR_Y = 0.11
W = 'world'

# Standard deck sizes shared by stage layouts (JSON w/d) and props.glb prefabs.
DECKS = {
    'deck_a': (3.6, 2.8), 'deck_b': (2.8, 2.8), 'deck_c': (2.4, 2.4),
    'lift': (2.6, 2.6), 'data': (3.0, 3.0), 'walkway': (11.6, 2.6),
}

# ---------------------------------------------------------------- stage registry
STAGE = {}
CULL = {'top': 1e9, 'bottom': -1e9}

def begin_stage(stage_id, name, bounds, spawn, spawn_yaw=0.0, cull_top=1e9, cull_bottom=-1e9):
    STAGE.clear()
    STAGE.update({'version': 2, 'id': stage_id, 'name': name, 'bounds': bounds,
                  'spawn': spawn, 'spawnYaw': spawn_yaw, 'floors': [], 'colliders': [],
                  'walkables': [], 'entities': [], 'render': {},
                  'assets': {'world': f'stages/{stage_id}/world.glb', 'lightmap': f'stages/{stage_id}/lightmap.webp'}})
    CULL['top'], CULL['bottom'] = cull_top, cull_bottom

def collider(id, x, z, w, d, min_y=0.0, max_y=2.0, camera_only=False, player_only=False):
    entry = {'id': id, 'x': round(x, 3), 'z': round(z, 3), 'width': round(w, 3), 'depth': round(d, 3),
             'minY': round(min_y, 3), 'maxY': round(max_y, 3)}
    if camera_only:
        entry['cameraOnly'] = True
    if player_only:          # glazing: blocks Levi, but the camera may look through it
        entry['playerOnly'] = True
    STAGE['colliders'].append(entry)

def floor(id, x0, x1, z0, z1, y=FLOOR_Y, requires=None):
    entry = {'id': id, 'minX': min(x0, x1), 'maxX': max(x0, x1), 'minZ': min(z0, z1), 'maxZ': max(z0, z1), 'y': y}
    if requires:
        entry['requires'] = requires
    STAGE['floors'].append(entry)

def walkable(x, z, half_x, half_z, height):
    STAGE['walkables'].append({'x': x, 'z': z, 'halfX': half_x, 'halfZ': half_z, 'height': round(height, 3)})

def entity(type, id, **fields):
    entry = {'type': type, 'id': id}
    for key, value in fields.items():
        if value is not None:
            entry[key] = value
    STAGE['entities'].append(entry)
    return entry

def deck(id, kind, x, y, z, **fields):
    """A gameplay platform whose deck TOP is at y (prefab deck_<kind>/lift/data)."""
    w, d = DECKS[kind]
    fields.setdefault('prefab', kind)
    return entity('platform', id, x=x, y=y, z=z, w=w, d=d, **fields)

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
    'paving':   ('LM', (0.66, 0.65, 0.62), 0.8, 0.0, {}),
    'grass':    ('LM', (0.22, 0.42, 0.17), 0.9, 0.0, {}),
    'hedge':    ('LM', (0.13, 0.33, 0.15), 0.9, 0.0, {}),
    'rubber':   ('LM', (0.07, 0.08, 0.09), 0.7, 0.0, {}),
    'teal':     ('LM', (0.05, 0.32, 0.36), 0.4, 0.2, {}),
    'E_cyan':     ('EM', (0.1, 0.85, 1.0), 0, 0, {'strength': 4.0}),
    'E_mint':     ('EM', (0.3, 1.0, 0.72), 0, 0, {'strength': 3.0}),
    'E_green':    ('EM', (0.35, 1.0, 0.3), 0, 0, {'strength': 3.0}),
    'E_light':    ('EM', (1.0, 0.95, 0.86), 0, 0, {'strength': 5.0}),
    'E_elevator': ('EM', (0.95, 0.25, 1.0), 0, 0, {'strength': 3.5}),
    'E_amber':    ('EM', (1.0, 0.62, 0.16), 0, 0, {'strength': 3.0}),
    'E_pink':     ('EM', (1.0, 0.25, 0.55), 0, 0, {'strength': 3.0}),
    'E_screen':   ('EM', (1, 1, 1), 0, 0, {'strength': 1.6, 'tex': 'screen_sheet.png', 'size': 0}),
    'G_glass':    ('GL', (0.75, 0.93, 0.95), 0.05, 0.0, {}),
    'RT_lawn':    ('RT', (0.2, 0.42, 0.16), 0.9, 0.0, {}),
    'RT_paving':  ('RT', (0.62, 0.62, 0.6), 0.8, 0.0, {}),
    'RT_leaf':    ('RT', (0.16, 0.42, 0.22), 0.8, 0.0, {}),
    'RT_leaf2':   ('RT', (0.3, 0.55, 0.25), 0.8, 0.0, {}),
    'RT_bark':    ('RT', (0.3, 0.22, 0.16), 0.9, 0.0, {}),
    'RT_water':   ('RT', (0.15, 0.35, 0.42), 0.05, 0.3, {}),
    # Lettering: glyphs are too small for lightmap texels (they baked to dark blocks).
    'RT_white':   ('RT', (0.93, 0.93, 0.91), 0.3, 0.0, {}),
    'RT_bronze':  ('RT', (0.52, 0.37, 0.22), 0.3, 0.9, {}),
    'RT_navy':    ('RT', (0.035, 0.08, 0.13), 0.4, 0.3, {}),
    'RT_yellow':  ('RT', (1.0, 0.6, 0.08), 0.35, 0.1, {}),
    'RT_plant1':  ('RT', (1, 1, 1), 0.7, 0.0, {'tex': os.path.join(MODELS, 'plant01_leaves.png'), 'alpha': True, 'size': 0}),
    'RT_plant2':  ('RT', (1, 1, 1), 0.7, 0.0, {'tex': os.path.join(MODELS, 'plant02_leaves.png'), 'alpha': True, 'size': 0}),
    'RT_stem':    ('RT', (1, 1, 1), 0.8, 0.0, {'tex': os.path.join(MODELS, 'plant01_stem.png'), 'size': 0}),
    # Prefab-only (always realtime lit in props.glb).
    'P_white':  ('P', (0.92, 0.94, 0.95), 0.25, 0.0, {}),
    'P_navy':   ('P', (0.03, 0.09, 0.18), 0.3, 0.4, {}),
    'P_visor':  ('P', (0.01, 0.015, 0.025), 0.1, 0.2, {}),
    'P_steel':  ('P', (0.32, 0.38, 0.44), 0.35, 0.8, {}),
    'P_light':  ('P', (0.82, 0.85, 0.86), 0.4, 0.2, {}),
    'P_yellow': ('P', (1.0, 0.6, 0.08), 0.35, 0.1, {}),
    'P_brass':  ('P', (0.6, 0.45, 0.28), 0.3, 0.85, {}),
    'P_rubber': ('P', (0.06, 0.07, 0.08), 0.7, 0.0, {}),
    'P_glass':  ('P', (0.55, 0.95, 1.0), 0.05, 0.0, {'alpha_value': 0.32}),
    'P_holo':   ('P', (0.3, 0.9, 1.0), 0.1, 0.0, {'emit': 1.6, 'alpha_value': 0.55}),
    'P_air':    ('P', (0.6, 0.95, 1.0), 0.1, 0.0, {'emit': 0.8, 'alpha_value': 0.16}),
    'P_cyan':   ('P', (0.1, 0.85, 1.0), 0.3, 0, {'emit': 3.0}),
    'P_mint':   ('P', (0.3, 1.0, 0.72), 0.3, 0, {'emit': 3.0}),
    'P_green':  ('P', (0.35, 1.0, 0.3), 0.3, 0, {'emit': 3.0}),
    'P_gold':   ('P', (1.0, 0.7, 0.25), 0.3, 0, {'emit': 2.5}),
    'P_violet': ('P', (0.75, 0.3, 1.0), 0.3, 0, {'emit': 3.0}),
    'P_red':    ('P', (1.0, 0.18, 0.12), 0.3, 0, {'emit': 3.0}),
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
        hidden = [f for f in bm.faces if (f.normal.z > 0.9 and f.calc_center_median().z > CULL['top'])
                  or (f.normal.z < -0.9 and f.calc_center_median().z < CULL['bottom'] and mat != 'dark')]
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

FONT = [None]
def text(group, mat, body, size, x, y, z, yaw=0.0, pitch=0.0, depth=0.03, align='CENTER'):
    # Glyph islands get a texel or two in the lightmap and bake black at the edges,
    # so lettering is realtime lit instead (RT_ twin of the requested material).
    if MATS[mat][0] == 'LM':
        mat = 'RT_' + mat
    if FONT[0] is None:
        for path in ['/System/Library/Fonts/Supplemental/Arial Bold.ttf',
                     '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']:
            if os.path.exists(path):
                FONT[0] = bpy.data.fonts.load(path, check_existing=True)
                break
    cu = bpy.data.curves.new('txt', 'FONT')
    cu.body = body
    cu.size = size
    cu.extrude = depth / 2
    cu.resolution_u = 3
    cu.align_x = align
    cu.align_y = 'CENTER'
    if FONT[0]:
        cu.font = FONT[0]
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

# ---------------------------------------------------------------- reusable architecture
def slab(id, x0, x1, z0, z1, y=FLOOR_Y, finish='marble', thickness=0.6, edge_light=True, register=True):
    """Floor slab with its walkable top at y; registers the gameplay floor."""
    xc, zc, w, d = (x0 + x1) / 2, (z0 + z1) / 2, abs(x1 - x0), abs(z1 - z0)
    box(W, 'concrete', w, thickness, d, xc, y - 0.04 - thickness / 2, zc)
    box(W, finish, w - 0.04, 0.04, d - 0.04, xc, y - 0.02, zc)
    if edge_light:
        box(W, 'E_cyan', w - 0.1, 0.04, 0.04, xc, y - 0.2, max(z0, z1))
    if register:
        floor(id, x0, x1, z0, z1, y)

def wall(id, x0, z0, x1, z1, h, mat='concrete', thick=0.3, y0=0.0, solid=True):
    """Straight wall between two XZ points (axis aligned), collider included."""
    xc, zc = (x0 + x1) / 2, (z0 + z1) / 2
    w = abs(x1 - x0) or thick
    d = abs(z1 - z0) or thick
    box(W, mat, w, h, d, xc, y0 + h / 2, zc)
    if solid:
        collider(id, xc, zc, w, d, y0, y0 + h)

def railing(id, x0, z0, x1, z1, y, height=1.05, solid=True):
    """Glass balustrade with a bronze handrail along an axis-aligned edge."""
    xc, zc = (x0 + x1) / 2, (z0 + z1) / 2
    along_x = abs(x1 - x0) > abs(z1 - z0)
    length = abs(x1 - x0) if along_x else abs(z1 - z0)
    w, d = (length, 0.04) if along_x else (0.04, length)
    box(W, 'G_glass', w, height, d, xc, y + height / 2, zc)
    box(W, 'bronze', w + (0.03 if along_x else 0.05), 0.07, d + (0.05 if along_x else 0.03), xc, y + height, zc, bevel=0.02)
    n = max(2, int(length / 1.6) + 1)
    for k in range(n):
        t = k / (n - 1)
        px, pz = (x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)
        box(W, 'bronze', 0.05, height, 0.05, px, y + height / 2, pz)
    if solid:
        collider(id, xc, zc, max(w, 0.2), max(d, 0.2), y - 0.1, y + height)

def column(x, z, h, y0=0.0, r=0.42, ring_y=3.2):
    cyl(W, 'white', r, h, x, y0 + h / 2, z, segs=32)
    cyl(W, 'bronze', r + 0.08, 0.22, x, y0 + FLOOR_Y + 0.11, z, segs=32)
    torus(W, 'E_cyan', r + 0.01, 0.025, x, y0 + ring_y, z, seg=32, ring=6)
    collider(f'column-{x}-{z}', x, z, r * 2 + 0.06, r * 2 + 0.06, y0, y0 + h)

def terminal(id, x, z, label, y=FLOOR_Y, yaw=0.0):
    """Kiosk with a tilted spreadsheet screen. yaw=0 faces +z (towards the player)."""
    c, s = math.cos(yaw), math.sin(yaw)
    def at(lx, lz):
        return x + lx * c + lz * s, z - lx * s + lz * c
    box(W, 'white', 1.6, 0.16, 1.2, x, y + 0.08, z, bevel=0.05, yaw=yaw)
    px, pz = at(0, 0.05)
    box(W, 'navy', 0.9, 1.1, 0.6, px, y + 0.61, pz, bevel=0.06, yaw=yaw)
    for side in (-1, 1):
        px, pz = at(side * 0.47, 0.36)
        box(W, 'E_cyan', 0.04, 0.8, 0.04, px, y + 0.64, pz, yaw=yaw)
    px, pz = at(0, -0.05)
    box(W, 'white', 2.3, 1.45, 0.16, px, y + 1.79, pz, bevel=0.07, yaw=yaw, pitch=-0.3)
    px, pz = at(0, 0.04)
    box(W, 'E_screen', 2.0, 1.18, 0.02, px, y + 1.81, pz, yaw=yaw, pitch=-0.3)
    for side in (-1, 1):
        px, pz = at(side * 1.18, -0.05)
        box(W, 'yellow', 0.1, 0.9, 0.17, px, y + 1.79, pz, yaw=yaw, pitch=-0.3)
    px, pz = at(0, -0.25)
    text(W, 'white', label, 0.26, px, y + 2.74, pz, yaw=yaw, pitch=-0.3, depth=0.03)
    torus(W, 'E_cyan', 1.65, 0.03, x, y + 0.01, z, seg=72, ring=6)
    torus(W, 'E_cyan', 1.45, 0.012, x, y + 0.01, z, seg=72, ring=4)
    sideways = abs(s) > 0.7
    collider('terminal-' + id, x, z, 1.85 if sideways else 2.65, 2.65 if sideways else 1.85, y - 0.06, y + 2.8)

def hanging_sign(label, x, y, z, width=4.8, yaw=0.0, cable_top=None, double=True):
    box(W, 'navy', width, 1.0, 0.1, x, y, z, bevel=0.03, yaw=yaw)
    sideways = abs(math.sin(yaw)) > 0.7
    collider('sign-' + label.split()[0].lower(), x, z, 0.3 if sideways else width + 0.1, width + 0.1 if sideways else 0.3,
             y - 0.55, y + 0.55, camera_only=True)
    box(W, 'yellow', width, 0.06, 0.11, x, y + 0.53, z, yaw=yaw)
    nx, nz = math.sin(yaw) * 0.06, math.cos(yaw) * 0.06
    text(W, 'white', label, 0.36, x + nx, y - 0.02, z + nz, yaw=yaw, depth=0.02)
    if double:
        text(W, 'white', label, 0.36, x - nx, y - 0.02, z - nz, yaw=yaw + math.pi, depth=0.02)
    if cable_top:
        for side in (-1, 1):
            ox, oz = math.cos(yaw) * side * (width / 2 - 0.4), -math.sin(yaw) * side * (width / 2 - 0.4)
            length = cable_top - (y + 0.5)
            cyl(W, 'steel', 0.012, length, x + ox, y + 0.5 + length / 2, z + oz, segs=6)

def planter(id, x, z, kind='plant01', scale=2.2, seed=1, y=FLOOR_Y, r=0.62):
    cyl(W, 'white', r, 0.7, x, y + 0.24, z, segs=40, r2=r - 0.12)
    cyl(W, 'bronze', r + 0.01, 0.04, x, y + 0.6, z, segs=40)
    cyl(W, 'soil', r - 0.05, 0.04, x, y + 0.57, z, segs=32)
    collider(f'planter-{id}', x, z, r * 2 - 0.08, r * 2 - 0.08, y - 0.1, y + 3.2)
    PLANTS.append((kind, x, y + 0.57, z, scale, seed))

def bench(id, x, z, yaw=0.0, y=FLOOR_Y):
    sideways = abs(math.sin(yaw)) > 0.7
    collider(f'bench-{id}', x, z, 1.0 if sideways else 2.25, 2.25 if sideways else 1.0, y - 0.1, y + 1.1)
    c, s = math.cos(yaw), math.sin(yaw)
    def at(lx, lz):
        return x + lx * c + lz * s, z - lx * s + lz * c
    px, pz = at(0, 0)
    box(W, 'walnut', 2.1, 0.09, 0.6, px, y + 0.41, pz, bevel=0.02, yaw=yaw)
    px, pz = at(0, 0.29)
    box(W, 'walnut', 2.1, 0.5, 0.07, px, y + 0.77, pz, bevel=0.02, yaw=yaw, pitch=0.12)
    for lx in (-0.85, 0.85):
        px, pz = at(lx, 0.0)
        box(W, 'steel', 0.06, 0.45, 0.56, px, y + 0.14, pz, bevel=0.01, yaw=yaw)

def tree(x, z, rng, y=FLOOR_Y, mat_index=0):
    h = rng.uniform(3.2, 5.2)
    cyl(W, 'RT_bark', 0.18, h, x, y + h / 2, z, segs=8, r2=0.12)
    for k in range(3):
        sphere(W, 'RT_leaf' if (mat_index + k) % 2 else 'RT_leaf2', rng.uniform(1.4, 2.0),
               x + rng.uniform(-0.8, 0.8), y + h + rng.uniform(-0.2, 1.4), z + rng.uniform(-0.8, 0.8),
               scale=(1.0, 0.85, 1.0), segs=10, rings=7)

def skylight_ceiling(x0, x1, z0, z1, y, wells, baffles=True):
    """Ceiling slab with glazed light wells [(za, zb)] spanning the middle third."""
    w = x1 - x0
    xc = (x0 + x1) / 2
    edges = [z0] + [v for s in wells for v in s] + [z1]
    for i in range(0, len(edges), 2):
        za, zb = edges[i], edges[i + 1]
        if zb - za > 0.01:
            box(W, 'plaster', w, 0.5, zb - za, xc, y + 0.25, (za + zb) / 2)
    glass_w = w * 0.5
    side_w = (w - glass_w) / 2
    for za, zb in wells:
        zc = (za + zb) / 2
        for sx in (x0 + side_w / 2, x1 - side_w / 2):
            box(W, 'plaster', side_w, 0.5, zb - za, sx, y + 0.25, zc)
        box(W, 'G_glass', glass_w, 0.04, zb - za, xc, y + 0.6, zc)
        n = 5
        for k in range(n):
            box(W, 'alu', 0.1, 0.18, zb - za, xc - glass_w / 2 + glass_w * (k + 0.5) / n, y + 0.5, zc)
        box(W, 'E_light', glass_w, 0.04, 0.06, xc, y - 0.02, za + 0.05)
        box(W, 'E_light', glass_w, 0.04, 0.06, xc, y - 0.02, zb - 0.05)
    if baffles:
        spans = [(edges[i], edges[i + 1]) for i in range(0, len(edges), 2)]
        for za, zb in spans:
            n = int((zb - za) / 0.55)
            for k in range(n):
                box(W, 'walnut', w * 0.64, 0.42, 0.09, xc, y - 0.2, za + 0.35 + k * 0.55)

def glass_facade(x0, z0, x1, z1, y0, y1, mullion=2.2):
    along_x = abs(x1 - x0) > abs(z1 - z0)
    xc, zc = (x0 + x1) / 2, (z0 + z1) / 2
    length = abs(x1 - x0) if along_x else abs(z1 - z0)
    h = y1 - y0
    box(W, 'G_glass', length if along_x else 0.04, h, 0.04 if along_x else length, xc, y0 + h / 2, zc)
    n = int(length / mullion) + 1
    for k in range(n):
        t = k / max(1, n - 1)
        px, pz = x0 + (x1 - x0) * t, z0 + (z1 - z0) * t
        box(W, 'alu', 0.16 if not along_x else 0.14, h + 0.4, 0.14 if not along_x else 0.16, px, y0 + h / 2, pz, bevel=0.015)
    for y in (y0 + h * 0.34, y0 + h * 0.67, y1):
        box(W, 'alu', (length if along_x else 0.2), 0.16, (0.2 if along_x else length), xc, y, zc, bevel=0.015)

def exit_frame(x, y, z, label, yaw=0.0, color='E_elevator'):
    """Architectural surround for an exit portal (the animated portal is a prefab)."""
    c, s = math.cos(yaw), math.sin(yaw)
    for side in (-1, 1):
        box(W, 'steel', 0.4, 4.0, 0.5, x + side * 1.8 * c, y + 2.0, z - side * 1.8 * s, bevel=0.04, yaw=yaw)
    box(W, 'steel', 4.0, 0.5, 0.5, x, y + 4.2, z, bevel=0.04, yaw=yaw)
    box(W, color, 3.2, 0.08, 0.06, x + 0.27 * s, y + 4.0, z + 0.27 * c, yaw=yaw)
    text(W, 'white', label, 0.34, x + 0.27 * s, y + 4.62, z + 0.27 * c, yaw=yaw, depth=0.03)

# ---------------------------------------------------------------- foliage (Poly Haven CC0)
PLANTS = []
def build_plants(extra_trailing=()):
    if not PLANTS and not extra_trailing:
        return
    with bpy.data.libraries.load(os.path.join(MODELS, 'plants.blend')) as (src, dst):
        dst.meshes = [m for m in src.meshes]
    meshes = {m.name: decimated(m, 0.45) for m in dst.meshes}
    for kind, x, y, z, s, seed in PLANTS:
        parts = [('plant01_leaves', 'RT_plant1'), ('plant01_stem', 'RT_stem')] if kind == 'plant01' \
            else [('plant02_leaves', 'RT_plant2')]
        for mesh_name, mat in parts:
            bm = bmesh.new()
            bm.from_mesh(meshes[mesh_name])
            emit(W, mat, bm, Matrix.Translation(bl(x, y, z)) @ Matrix.Rotation(seed * 1.3, 4, 'Z') @ Matrix.Scale(s, 4), True)
    # Foliage spilling over a balcony edge: upside down so leaves trail downwards.
    for k, (x, y, z) in enumerate(extra_trailing):
        bm = bmesh.new()
        bm.from_mesh(meshes['plant02_leaves'])
        emit(W, 'RT_plant2', bm, Matrix.Translation(bl(x, y, z)) @ Matrix.Rotation(k * 2.1, 4, 'Z')
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

# ---------------------------------------------------------------- screen texture
def make_screen_texture():
    """Procedural spreadsheet screen (deterministic) used by the terminal displays."""
    w, h = 512, 320
    img = np.zeros((h, w, 4), np.float32)
    img[...] = (0.02, 0.09, 0.12, 1)
    img[h - 34:h, :] = (0.05, 0.3, 0.36, 1)
    for c in range(1, 5):
        img[:h - 34, c * 102 - 1:c * 102 + 1] = (0.1, 0.7, 0.8, 1)
    for r in range(1, 8):
        y = h - 34 - r * 36
        img[y - 1:y + 1, :] = (0.1, 0.55, 0.65, 1)
    img[h - 34 - 3 * 36 + 2:h - 34 - 2 * 36 - 1, 103:203] = (0.2, 0.9, 0.35, 1)
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
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
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

def collection(name):
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    return coll

def realise(name):
    """Turn the accumulated parts into one mesh per material (world) or prefab roots."""
    worlds = collection(name)
    props = collection('PROPS')
    roots = {}
    for (group, mat), part in PARTS.items():
        kind = MATS[mat][0]
        mesh_name = f'{kind}_{mat}' if group == W else f'{group}__{mat}'
        me = bpy.data.meshes.new(mesh_name)
        me.from_pydata([tuple(v) for v in part.verts], [], part.faces)
        uv = me.uv_layers.new(name='UVMap')
        uv.data.foreach_set('uv', [c for t in part.uvs for c in t])
        me.polygons.foreach_set('use_smooth', part.smooth)
        me.materials.append(material(mat))
        me.update()
        ob = bpy.data.objects.new(mesh_name, me)
        if group == W:
            worlds.objects.link(ob)
        else:
            if group not in roots:
                root = bpy.data.objects.new('PF_' + group, None)
                props.objects.link(root)
                roots[group] = root
            ob.parent = roots[group]
            props.objects.link(ob)
    for i, root in enumerate(roots.values()):
        root.location = (-30 + (i % 12) * 3.2, 60 + (i // 12) * 4, 0)
    return worlds, props

def debug_colliders():
    coll = collection('COLLISION')
    coll.hide_render = True
    for c in STAGE['colliders']:
        ob = bpy.data.objects.new('COL_' + c['id'], None)
        ob.empty_display_type = 'CUBE'
        h = c['maxY'] - c['minY']
        ob.location = bl(c['x'], c['minY'] + h / 2, c['z'])
        ob.scale = (c['width'] / 2, c['depth'] / 2, h / 2)
        coll.objects.link(ob)

def setup_lighting(fills, sky=(0.62, 0.78, 1.0), sky_strength=1.2, sun_energy=4.2):
    """Sun matches the runtime DirectionalLight at (-8, 16, 11); fills are hidden area lights
    [(x, y, z, size_x, size_z, energy)] that stand in for skylights and LED coves."""
    scene = bpy.context.scene
    world = bpy.data.worlds.get('LeviSky') or bpy.data.worlds.new('LeviSky')
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (*sky, 1)
    bg.inputs['Strength'].default_value = sky_strength
    scene.world = world
    sun_data = bpy.data.lights.new('Sun', 'SUN')
    sun_data.energy = sun_energy
    sun_data.angle = math.radians(2.5)
    sun_data.color = (1.0, 0.95, 0.86)
    sun = bpy.data.objects.new('Sun', sun_data)
    sun.rotation_euler = bl(8, -16, -11).normalized().to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(sun)
    for i, (x, y, z, sx, sz, energy) in enumerate(fills):
        data = bpy.data.lights.new(f'Fill{i}', 'AREA')
        data.shape = 'RECTANGLE'
        data.size, data.size_y = sx, sz
        data.energy = energy
        data.color = (1.0, 0.94, 0.85)
        ob = bpy.data.objects.new(f'Fill{i}', data)
        ob.location = bl(x, y, z)
        scene.collection.objects.link(ob)

def select_only(objs):
    for ob in bpy.context.scene.objects:
        ob.select_set(False)
    for ob in objs:
        ob.select_set(True)
    if objs:
        bpy.context.view_layer.objects.active = objs[0]

def view3d_context():
    """Edit-mode operators need a 3D view when driven from the MCP timer; none in -b."""
    wm = bpy.context.window_manager
    for window in (wm.windows if wm else []):
        for area in window.screen.areas:
            if area.type == 'VIEW_3D':
                region = next(r for r in area.regions if r.type == 'WINDOW')
                return {'window': window, 'area': area, 'region': region}
    return {}

def lightmap_uvs(objs, density):
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
    # Spend texels where the player looks; pack_islands keeps these relative scales.
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

def save_lightmap(image, path):
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
    ldr.filepath_raw = path
    ldr.file_format = 'WEBP'
    bpy.context.scene.render.image_settings.quality = 88
    ldr.save()
    return round(scale, 4)

def gltf_export(path, objs):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    select_only(objs)
    valid = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    opts = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                export_texcoords=True, export_normals=True, export_materials='EXPORT',
                export_image_format='WEBP', export_yup=True, export_extras=False,
                export_cameras=False, export_lights=False, export_animations=False,
                export_tangents=False, export_attributes=False)
    bpy.ops.export_scene.gltf(**{k: v for k, v in opts.items() if k in valid})

def export_stage_json():
    os.makedirs(DATA, exist_ok=True)
    with open(os.path.join(DATA, STAGE['id'] + '.json'), 'w', encoding='utf-8') as fh:
        json.dump(STAGE, fh, indent=1, ensure_ascii=False)
        fh.write('\n')

def finish_stage(fills, density, do_bake=True, do_export=True, sky=(0.62, 0.78, 1.0), sky_strength=1.2):
    """Realise, light, bake and export the stage currently registered in STAGE."""
    worlds, props = realise('STAGE_' + STAGE['id'])
    debug_colliders()
    setup_lighting(fills, sky, sky_strength)
    lm = [ob for ob in worlds.objects if ob.name.startswith('LM_')]
    lightmap_uvs(lm, density)
    out = os.path.join(PUBLIC, STAGE['id'])
    os.makedirs(out, exist_ok=True)
    if do_bake:
        STAGE['render']['lightMapScale'] = save_lightmap(bake(lm), os.path.join(out, 'lightmap.webp'))
    elif os.path.exists(os.path.join(DATA, STAGE['id'] + '.json')):
        # Geometry-only rebuilds keep the previous bake's exposure.
        with open(os.path.join(DATA, STAGE['id'] + '.json'), encoding='utf-8') as fh:
            STAGE['render'] = json.load(fh).get('render', {})
    if do_export:
        gltf_export(os.path.join(out, 'world.glb'), list(worlds.objects))
        export_stage_json()
    tris = sum(sum(len(p.vertices) - 2 for p in ob.data.polygons) for ob in worlds.objects)
    print(f"stage {STAGE['id']}: {len(worlds.objects)} meshes, {tris} triangles, "
          f"{len(STAGE['entities'])} entities, {len(STAGE['colliders'])} colliders")

def export_props():
    _, props = realise('UNUSED')
    roots = [r for r in props.objects if r.parent is None]
    saved = {r: r.location.copy() for r in roots}
    for r in roots:
        r.location = (0, 0, 0)
    gltf_export(os.path.join(PUBLIC, 'props.glb'), list(props.objects))
    for r, loc in saved.items():
        r.location = loc
    print(f'props: {len(roots)} prefabs')
