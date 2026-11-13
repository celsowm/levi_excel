"""Stage 1-1 "Jardim e Recepção".

Garden arrival (pond with stepping stones, pergola, hedge maze, fountain launch pad onto
the canopy) -> lobby (reception desk M00, dash room) -> courier route over the platform
course to the right balcony (M01 terminal) -> walkway over the light well -> mezzanine exit.
The back third of the lobby is an open light well: everything there is at y = 4.5.
"""
import math
import numpy as np
from levi_kit import (W, FLOOR_Y, box, cyl, torus, prism, text, ribbon, slab, wall, railing, column,
                      terminal, hanging_sign, planter, bench, tree, skylight_ceiling, glass_facade,
                      exit_frame, build_plants, begin_stage, collider, floor, walkable, entity, deck)

UP = 4.5            # balcony / mezzanine level
X0, X1 = -13.95, 13.95
ZB, ZF = -22.6, 20.6  # lobby back wall / facade
WELL = -6.0          # front edge of the light well
POND = (-20.0, -6.0, 34.0, 50.0)

def garden():
    # Walkable garden floor around the pond (a hole in the floor = water).
    px0, px1, pz0, pz1 = POND
    floor('garden-front', -24, 24, ZF, pz0)
    floor('garden-back', -24, 24, pz1, 58)
    floor('garden-east', px1, 24, pz0, pz1)
    floor('garden-west', -24, px0, pz0, pz1)
    box(W, 'paving', 48, 0.3, pz0 - ZF, 0, FLOOR_Y - 0.15, (ZF + pz0) / 2)
    box(W, 'paving', 48, 0.3, 58 - pz1, 0, FLOOR_Y - 0.15, (pz1 + 58) / 2)
    box(W, 'grass', 24 - px1, 0.3, pz1 - pz0, (px1 + 24) / 2, FLOOR_Y - 0.17, (pz0 + pz1) / 2)
    box(W, 'grass', px0 + 24, 0.3, pz1 - pz0, (px0 - 24) / 2, FLOOR_Y - 0.17, (pz0 + pz1) / 2)
    box(W, 'paving', 6, 0.02, 58 - ZF, 0, FLOOR_Y + 0.005, (ZF + 58) / 2)   # central path
    for z in range(24, 58, 4):
        for s in (-1, 1):
            box(W, 'E_mint', 0.08, 0.02, 1.2, s * 3.1, FLOOR_Y + 0.01, z)
    # Pond: kerb, water, stepping stones (walkable tops, no floor below), pergola island.
    for (w, d, x, z) in [(px1 - px0 + 0.4, 0.4, (px0 + px1) / 2, pz0), (px1 - px0 + 0.4, 0.4, (px0 + px1) / 2, pz1),
                         (0.4, pz1 - pz0, px0, (pz0 + pz1) / 2), (0.4, pz1 - pz0, px1, (pz0 + pz1) / 2)]:
        box(W, 'white', w, 0.3, d, x, FLOOR_Y + 0.02, z, bevel=0.04)
    box(W, 'RT_water', px1 - px0, 0.05, pz1 - pz0, (px0 + px1) / 2, -0.35, (pz0 + pz1) / 2)
    box(W, 'dark', px1 - px0, 0.2, pz1 - pz0, (px0 + px1) / 2, -1.6, (pz0 + pz1) / 2)
    entity('killzone', 'pond', minX=px0 + 0.2, maxX=px1 - 0.2, minZ=pz0 + 0.2, maxZ=pz1 - 0.2, y=-0.25)
    stones = [(-8.2, 36.6, 0.4), (-10.6, 39.4, 0.6), (-13.6, 40.6, 0.85), (-16.8, 42.0, 0.6)]
    for i, (x, z, top) in enumerate(stones):
        cyl(W, 'concrete', 0.95, top + 1.6, x, top - (top + 1.6) / 2, z, segs=20)
        walkable(x, z, 0.8, 0.8, top)
    ix0, ix1, iz0, iz1 = -18.6, -11.4, 43.8, 49.0
    floor('island', ix0, ix1, iz0, iz1)
    box(W, 'paving', ix1 - ix0, 1.8, iz1 - iz0, (ix0 + ix1) / 2, FLOOR_Y - 0.9, (iz0 + iz1) / 2)
    # Pergola: four posts, slatted roof you can stand on.
    roof = 3.7
    for x in (ix0 + 0.6, ix1 - 0.6):
        for z in (iz0 + 0.6, iz1 - 0.6):
            box(W, 'walnut', 0.3, roof, 0.3, x, FLOOR_Y + roof / 2, z)
            collider(f'pergola-post-{x}-{z}', x, z, 0.4, 0.4, 0, roof)
    box(W, 'walnut', ix1 - ix0, 0.24, iz1 - iz0, (ix0 + ix1) / 2, roof - 0.12, (iz0 + iz1) / 2)
    for k in range(10):
        box(W, 'walnut', 0.12, 0.2, iz1 - iz0 + 0.6, ix0 + 0.4 + k * 0.72, roof + 0.1, (iz0 + iz1) / 2)
    walkable((ix0 + ix1) / 2, (iz0 + iz1) / 2, (ix1 - ix0) / 2, (iz1 - iz0) / 2, roof + 0.2)
    entity('jumpPad', 'pad-pergola', x=-15.0, y=FLOOR_Y, z=46.4 - 1.4, radius=1.0, power=13.2)
    # East: hedge maze (jumpable, walkable tops) and the lookout tower.
    hedges = [(8, 34, 10, 0.9), (14, 38.5, 0.9, 7), (9.5, 42, 7, 0.9), (17.5, 44, 0.9, 10), (11, 47, 8, 0.9),
              (6.8, 40, 0.9, 6), (20, 36, 6, 0.9)]
    for i, (x, z, w, d) in enumerate(hedges):
        box(W, 'hedge', w, 1.3, d, x, FLOOR_Y + 0.65, z, bevel=0.2, segments=2)
        collider(f'hedge-{i}', x, z, w, d, 0, 1.3)
        walkable(x, z, w / 2, d / 2, FLOOR_Y + 1.3)
    steps = [(20.6, 41.6, 1.6), (20.6, 44.2, 3.0)]
    for i, (x, z, top) in enumerate(steps):
        box(W, 'white', 2.2, top, 2.2, x, top / 2, z, bevel=0.05)
        collider(f'step-{i}', x, z, 2.2, 2.2, 0, top)
        walkable(x, z, 1.1, 1.1, top)
    tx, tz, top = 20.6, 48.6, 4.6
    box(W, 'concrete', 3.4, top, 3.4, tx, top / 2, tz)
    box(W, 'white', 3.8, 0.2, 3.8, tx, top - 0.1, tz, bevel=0.04)
    collider('lookout', tx, tz, 3.4, 3.4, 0, top)
    walkable(tx, tz, 1.9, 1.9, top)
    box(W, 'E_amber', 3.5, 0.06, 0.06, tx, top - 0.3, tz + 1.72)
    entity('drone', 'gardener', path=[[9, 1.5, 36.5], [16, 1.5, 36.5], [16, 1.5, 45], [9, 1.5, 45]], speed=2.2)
    # Fountain plaza: basin with a launch pad onto the canopy roof.
    fx, fz = 0.0, 30.5
    torus(W, 'white', 3.0, 0.3, fx, FLOOR_Y + 0.3, fz, seg=64, ring=10)
    cyl(W, 'RT_water', 2.8, 0.05, fx, FLOOR_Y + 0.2, fz, segs=48)
    entity('jumpPad', 'pad-canopy', x=fx, y=FLOOR_Y, z=fz, radius=1.0, power=17.6)
    # Perimeter trees and hedges.
    rng = np.random.default_rng(11)
    for i, (x, z) in enumerate([(-22, 24), (-22, 30), (-22, 54), (-14, 56), (-6, 56), (6, 56), (14, 56), (22, 54),
                                (22, 28), (-28, 40), (28, 40), (-30, 22), (30, 22), (-26, 60), (26, 60)]):
        tree(x + rng.uniform(-0.8, 0.8), z + rng.uniform(-0.8, 0.8), rng, mat_index=i)
    box(W, 'RT_lawn', 140, 0.2, 140, 0, FLOOR_Y - 0.6, 20)
    for side in (-1, 1):
        planter(f'garden-{side}', side * 4.6, 24.5, 'plant02', 2.0, 3 + side)

def lobby_shell():
    slab('lobby', X0, X1, WELL, ZF + 0.1, finish='marble')
    floor('portico', -14.3, 14.3, ZF, ZF + 0.6)
    # Light well: lower archive level glowing far below.
    box(W, 'dark', X1 - X0, 0.3, WELL - ZB, 0, -9.0, (ZB + WELL) / 2)
    for i in range(15):
        box(W, 'E_cyan', 0.04, 0.02, WELL - ZB - 0.4, -13 + i * 1.857, -8.84, (ZB + WELL) / 2)
    for x in (-10, -5, 0, 5):
        for z in (-19, -12):
            box(W, 'dark', 1.0, 3.6, 0.8, x, -7.05, z, bevel=0.03)
            for k in range(6):
                box(W, 'E_cyan' if (k + x) % 3 else 'E_amber', 0.6, 0.03, 0.02, x, -8.4 + k * 0.5, z + 0.41)
    box(W, 'steel', X1 - X0, 0.12, 0.14, 0, FLOOR_Y - 0.05, WELL)
    box(W, 'yellow', X1 - X0 - 0.4, 0.012, 0.18, 0, FLOOR_Y + 0.001, WELL + 0.2)
    entity('killzone', 'well', minX=X0, maxX=X1, minZ=ZB, maxZ=WELL, y=-2.5)
    # Glass parapet along the well, open where the course climbs (x > 6).
    railing('well-parapet', X0 + 0.3, WELL + 0.1, 6.0, WELL + 0.1, FLOOR_Y)
    # Side walls: glass curtain with mullions.
    for side in (-1, 1):
        x = side * X1
        box(W, 'concrete', 0.5, 0.55, ZF - WELL, x, FLOOR_Y + 0.27, (WELL + ZF) / 2)
        glass_facade(x, ZB, x, ZF, 0.4, 14.0)
    collider('wall-left', -13.85, -1, 0.28, 43.4, -10, 14)
    collider('wall-right', 13.85, -1, 0.28, 43.4, -10, 14)
    collider('wall-back', 0, -22.9, 28.4, 0.6, -10, 14.2)
    collider('canopy', 0, 23.0, 28.6, 5.0, 7.5, 7.9)
    box(W, 'concrete', 28.4, 24, 0.6, 0, 2.2, -22.9)
    box(W, 'walnut', 21.0, 3.2, 0.08, 0, UP + 2.4, -22.58)
    # Facade: upper glass band, open ground floor, canopy you can land on.
    glass_facade(-14, ZF, 14, ZF, 7.9, 14.0, mullion=2.0)
    box(W, 'plaster', 28.6, 0.7, 1.0, 0, 7.85, ZF, bevel=0.05)
    box(W, 'plaster', 28.6, 0.35, 5.0, 0, 7.7, 23.0)
    walkable(0, 23.0, 14.3, 2.5, 7.88)
    for i in range(6):
        cyl(W, 'E_light', 0.28, 0.03, -10 + i * 4, 7.51, 22.6, segs=20)
    box(W, 'E_light', 26, 0.04, 0.06, 0, 7.5, 20.25)
    text(W, 'navy', 'PGE DIGITAL', 0.7, 0, 8.8, 20.7, depth=0.08)
    skylight_ceiling(-14.2, 14.2, ZB, ZF, 14.15, [(-17.5, -14.5), (-6.0, -3.0), (5.0, 8.0), (15.0, 18.0)])
    for z in (-19, -10.6, 0.6, 9.1, 18):
        if z < WELL:
            continue
        for side in (-1, 1):
            column(side * 12.85, z, 13.6)

def reception():
    cx, cz = -8.7, 10.7
    arc = [(cx + t * 2.95, cz + 1.25 * (1 - t * t) - 0.25) for t in (-1 + 2 * i / 24 for i in range(25))]
    inner = [(px, pz - 1.0) for px, pz in reversed(arc)]
    prism(W, 'white', arc + inner, 0.25, 1.47)
    top = [(px, pz + 0.07) for px, pz in arc] + [(px, pz - 1.04) for px, pz in reversed(arc)]
    prism(W, 'white', top, 1.47, 1.59, bevel=0.03)
    for i in range(1, 60):
        t = -1 + 2 * i / 60
        px, pz = cx + t * 2.95, cz + 1.25 * (1 - t * t) - 0.25 + 0.035
        box(W, 'walnut', 0.06, 1.2, 0.06, px, 0.86, pz, yaw=math.atan(2 * t * 1.25 / 2.95))
    prism(W, 'dark', [(px, pz - 0.06) for px, pz in arc] + [(px, pz - 0.94) for px, pz in reversed(arc)], FLOOR_Y, 0.25)
    prism(W, 'E_cyan', [(px, pz - 0.02) for px, pz in arc] + [(px, pz - 0.06) for px, pz in reversed(arc)], 0.2, 0.24)
    collider('reception-desk', cx, cz, 6.15, 2.8, 0.08, 1.64)
    walkable(cx, cz, 2.93, 1.2, 1.59)
    box(W, 'concrete', 0.3, 6.2, 8.0, -13.55, 3.2, 10.4)
    collider('feature-wall', -13.4, 10.4, 0.7, 8.0, 0, 6.3)
    box(W, 'walnut', 0.06, 1.0, 8.0, -13.38, 0.62, 10.4)
    box(W, 'E_light', 0.04, 0.04, 7.8, -13.37, 6.0, 10.4)
    ribbon(W, 'E_green', [(-13.36, 3.0 + 0.55 * math.sin(i / 10 * math.pi * 1.1), 13.9 - i * 0.38) for i in range(11)], 0.42, 0.05)
    ribbon(W, 'E_cyan', [(-13.35, 2.55 + 0.45 * math.sin(i / 10 * math.pi * 1.1 + 0.4), 13.7 - i * 0.36) for i in range(11)], 0.38, 0.05)
    text(W, 'white', 'PGE DIGITAL', 0.56, -13.33, 4.35, 11.85, yaw=math.pi / 2, depth=0.06)
    text(W, 'bronze', 'RECEPÇÃO', 0.34, -13.33, 1.65, 11.85, yaw=math.pi / 2, depth=0.04)
    hanging_sign('RECEPÇÃO', -8.6, 3.3, 10.5, width=3.6, cable_top=14.0)
    entity('terminal', 'reception', mission='m00', x=-8.4, y=FLOOR_Y, z=10.0, radius=4.1,
           view={'pos': [-4.2, 4.6, 16.5], 'look': [-8.4, 1.6, 10.0]})
    entity('deco', 'info-rings', prefab='info_rings', x=-8.5, y=7.2, z=9.8, spin=0.13)
    # Left gallery (decorative) with trailing foliage.
    gx0, gx1, gy = -13.7, -10.4, 6.6
    box(W, 'white', gx1 - gx0, 0.42, ZF - WELL, (gx0 + gx1) / 2, gy, (WELL + ZF) / 2, bevel=0.04)
    box(W, 'G_glass', 0.03, 1.05, ZF - WELL, gx1 - 0.08, gy + 0.74, (WELL + ZF) / 2)
    box(W, 'bronze', 0.07, 0.07, ZF - WELL, gx1 - 0.08, gy + 1.3, (WELL + ZF) / 2, bevel=0.02)
    box(W, 'navy', 0.5, 0.4, ZF - WELL, gx1 - 0.4, gy + 0.45, (WELL + ZF) / 2)
    collider('gallery', (gx0 + gx1) / 2, (WELL + ZF) / 2, gx1 - gx0, ZF - WELL, gy - 0.25, gy + 1.4)

def dash_room():
    # Glass "sala de dados": open front with a dash barrier, two cubes inside.
    x0, x1, z0, z1 = -3.3, 3.3, -1.0, 9.2
    for x in (x0, x1):
        box(W, 'G_glass', 0.05, 3.0, z1 - z0, x, FLOOR_Y + 1.5, (z0 + z1) / 2)
        box(W, 'alu', 0.12, 0.12, z1 - z0, x, FLOOR_Y + 3.0, (z0 + z1) / 2)
        collider(f'dashroom-{x}', x, (z0 + z1) / 2, 0.2, z1 - z0, 0, 3.1)
    box(W, 'G_glass', x1 - x0, 3.0, 0.05, 0, FLOOR_Y + 1.5, z0)
    collider('dashroom-back', 0, z0, x1 - x0, 0.2, 0, 3.1)
    box(W, 'alu', x1 - x0, 0.12, 0.12, 0, FLOOR_Y + 3.0, z0)
    box(W, 'navy', x1 - x0 - 0.4, 0.04, z1 - z0 - 0.4, 0, FLOOR_Y + 0.01, (z0 + z1) / 2)
    hanging_sign('SALA DE DADOS · DASH', 0, 4.4, z1 + 0.2, cable_top=14.0)
    entity('barrier', 'dashroom', x=0, y=FLOOR_Y, z=z1 + 0.05, width=6.6, yaw=0)

def course():
    entity('jumpPad', 'pad-course', x=8.0, y=FLOOR_Y, z=16.0, radius=1.04, power=12.6)
    entity('deco', 'pad-course-ring', prefab='jump_pad_ring', x=8.0, y=FLOOR_Y + 0.27, z=16.0, spin=0.65)
    decks = [('c1', 'deck_a', 8.1, 2.3, 13.2, None), ('c2', 'deck_a', 9.6, 2.6, 10.3, {'axis': 'y', 'amp': 0.24, 'period': 4.2}),
             ('c3', 'deck_a', 8.2, 3.0, 7.3, {'axis': 'y', 'amp': 0.28, 'period': 4.2, 'phase': 1.57}),
             ('c4', 'deck_a', 7.1, 2.45, 4.8, None), ('c5', 'deck_b', 9.8, 3.25, 1.2, {'axis': 'x', 'amp': 1.0, 'period': 5.0}),
             ('c6', 'deck_b', 11.0, 3.9, -2.6, None)]
    for id, kind, x, y, z, motion in decks:
        deck(id, kind, x, y, z, motion=motion)
        h = y - 0.6
        if z > WELL:
            cyl(W, 'steel', 0.16, h, x, FLOOR_Y + h / 2, z, segs=20)
            cyl(W, 'bronze', 0.32, 0.08, x, FLOOR_Y + 0.04, z, segs=24)
            torus(W, 'E_cyan', 0.17, 0.02, x, h * 0.66, z, seg=20, ring=6)
            collider('support-' + id, x, z, 0.53, 0.53, 0, y - 0.7)
    entity('scanner', 'course-scan', x=9.25, y=3.4, z=8.7, length=3.4, yaw=0,
           sweep={'axis': 'x', 'amp': 0.8, 'period': 3.0})
    hanging_sign('CIRCUITO DO LEVI', 8.2, 5.4, 19.0, cable_top=14.0)

def balconies():
    # Right balcony (M01) and back-left mezzanine (exit), joined by the walkway.
    bx0 = 9.2
    slab('balcony', bx0, X1, ZB + 0.3, WELL, y=UP, finish='marble')
    slab('mezzanine', X0, -2.0, ZB + 0.3, -13.0, y=UP, finish='marble')
    for (x, z) in [(bx0 + 0.5, -8), (bx0 + 0.5, -15), (bx0 + 0.5, -21), (-2.5, -14), (-8, -14)]:
        cyl(W, 'white', 0.32, UP + 9.0, x, UP - 0.35 - (UP + 9.0) / 2, z, segs=24)
    railing('balcony-a', bx0, WELL, bx0, -13.6, UP)
    railing('balcony-b', bx0, -16.4, bx0, ZB + 0.3, UP)
    railing('mezz-front', X0 + 0.3, -13.0, -2.0, -13.0, UP)
    railing('mezz-side', -2.0, -13.0, -2.0, -13.6, UP)
    railing('mezz-side-b', -2.0, -16.4, -2.0, ZB + 0.3, UP)
    deck('walkway', 'walkway', 3.6, 0.6, -15.0, bind={'flag': 'walkway'}, speed=2.2)
    terminal('m01', 12.4, -11.0, 'PASSARELA', y=UP, yaw=-math.pi / 2)
    entity('terminal', 'walkway-terminal', mission='m01', x=12.4, y=UP, z=-11.0, radius=3.0,
           view={'pos': [9.6, UP + 4.8, -5.0], 'look': [3.6, UP - 0.6, -15.0]})
    box(W, 'navy', 3.0, 0.9, 0.1, -4.0, UP + 3.2, -13.2, bevel=0.03)
    text(W, 'white', 'MEZANINO · 4,5 m', 0.3, -4.0, UP + 3.2, -13.13, depth=0.02)
    box(W, 'yellow', 3.0, 0.05, 0.11, -4.0, UP + 3.67, -13.2)
    exit_frame(-8.0, UP, -22.0, 'GALERIA DA FILA')
    entity('exit', 'exit', x=-8.0, y=UP, z=-21.7, yaw=0, radius=1.7, to='1-2')
    build_plants_extra = [(-2.6, UP + 0.4, z) for z in (-15.0, -19.5)]
    return build_plants_extra

def pickups_and_checkpoints():
    cubes = [(-10.6, 0.6 + 1.12, 39.4), (-15.0, FLOOR_Y + 1.12, 47.5), (-14.2, 3.9 + 1.12, 45.5),
             (20.6, 4.6 + 1.12, 48.6), (12.0, 1.4 + 1.12, 47.0), (0.0, 7.88 + 1.12, 22.6),
             (-1.4, FLOOR_Y + 1.12, 3.0), (1.4, FLOOR_Y + 1.12, 3.0), (11.0, 3.9 + 1.12, -2.6), (-11.5, UP + 1.12, -17.5)]
    for i, (x, y, z) in enumerate(cubes):
        entity('pickup', f'cube-{i}', x=x, y=round(y, 3), z=z, phase=i * 1.35)
    entity('secret', 'canopy-roof', x=9.5, y=7.88 + 1.1, z=23.5, radius=1.4, label='Telhado da marquise')
    for id, x, y, z in [('portico', 0, FLOOR_Y, 18.5), ('course', 7.1, 2.45, 4.8), ('balcony', 10.6, UP, -8.0)]:
        entity('checkpoint', id, x=x, y=y, z=z, radius=1.8)
    entity('courier', 'courier', bind={'flag': 'courier'}, speed=4.6, wait=5.5,
           path=[[-8.4, 2.3, 10.6], [-3.5, 2.6, 13.0], [5.6, 2.2, 16.6], [8.6, 4.4, 11.2], [7.4, 4.4, 4.8],
                 [9.8, 5.2, 0.8], [10.8, 5.8, -4.0], [10.8, 6.4, -9.6]])

def build_stage():
    begin_stage('1-1', 'Jardim e Recepção',
                {'minX': -24.0, 'maxX': 24.0, 'minZ': -22.3, 'maxZ': 58.0, 'voidY': -11},
                [0.0, FLOOR_Y, 54.0], 0.0, cull_top=14.75, cull_bottom=-1.0)
    garden(); lobby_shell(); reception(); dash_room(); course()
    trailing = balconies()
    pickups_and_checkpoints()
    planter('lobby-a', -11.35, 17.25, 'plant01', 2.3, 1)
    planter('lobby-b', -11.35, 2.9, 'plant02', 2.0, 2)
    planter('lobby-c', 12.3, 12.5, 'plant02', 1.7, 5)
    planter('mezz-a', -12.6, -20.6, 'plant01', 2.0, 6, y=UP)
    bench('lobby-a', -10.6, 4.6, 0.07)
    build_plants(trailing + [(-10.75, 7.25, z) for z in (-3.0, 3.0, 9.0, 15.0)])
    fills = [(0, 13.4, z, 12, 2.5, 900) for z in (-16, -4.5, 6.5, 16.5)] + \
            [(-8, UP + 3.5, -18, 8, 6, 500), (11.5, UP + 3.5, -14, 4, 14, 500)]
    density = {'LM_marble': 1.6, 'LM_walnut': 1.2, 'LM_white': 1.3, 'LM_plaster': 0.6, 'LM_concrete': 0.8,
               'LM_paving': 0.6, 'LM_grass': 0.4, 'LM_hedge': 0.8}
    return fills, density
