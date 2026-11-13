"""Stage 1-3 "Átrio de Dados".

Entry hall -> glass dash corridor (two barriers and a scanner) -> edge of the data void.
The filter terminal (M03) powers at most three floating data decks: the Judicial set is a
path across the void, the Administrative set leads to a sealed side bay and the secret
master room (M04). Across the void, server racks with a patrol drone lead to the energy
terminal (SOMA), whose fan lifts Levi to the central elevator balcony (y 9.6).
"""
import math
from levi_kit import (W, FLOOR_Y, box, cyl, torus, text, slab, wall, railing, column, terminal, hanging_sign,
                      planter, skylight_ceiling, glass_facade, exit_frame, build_plants, begin_stage,
                      collider, floor, walkable, entity, deck)

X, ZB, ZF, CEIL = 16.0, -46.0, 20.0, 18.0
VOID = (-18.0, 0.0)
BLOCK = 4.0          # side blocks next to the dash corridor
BALCONY = 9.6
DATA = [('J1', 0.8, 0.9, -3.6, None), ('J2', -1.2, 1.6, -8.4, {'axis': 'x', 'amp': 1.4, 'period': 5.0}),
        ('J3', 1.2, 1.1, -13.8, None), ('A1', -7.5, 1.0, -4.0, None), ('A2', -11.5, 2.0, -8.6, None),
        ('A3', -13.6, 3.0, -13.0, None)]

def glass_wall(id, x0, z0, x1, z1, y0, y1):
    along_x = abs(x1 - x0) > abs(z1 - z0)
    xc, zc = (x0 + x1) / 2, (z0 + z1) / 2
    length = abs(x1 - x0) if along_x else abs(z1 - z0)
    box(W, 'G_glass', length if along_x else 0.05, y1 - y0, 0.05 if along_x else length, xc, (y0 + y1) / 2, zc)
    box(W, 'alu', length if along_x else 0.14, 0.14, 0.14 if along_x else length, xc, y1, zc)
    box(W, 'alu', length if along_x else 0.14, 0.14, 0.14 if along_x else length, xc, y0 + 0.07, zc)
    collider(id, xc, zc, length if along_x else 0.3, 0.3 if along_x else length, y0 - 0.1, y1 + 0.2)

def shell():
    for side in (-1, 1):
        wall(f'wall-{side}', side * (X + 0.15), ZB, side * (X + 0.15), ZF, CEIL + 0.5, y0=-8.0)
        for z in range(-40, 18, 8):
            box(W, 'walnut', 0.06, 6.0, 3.6, side * (X - 0.02), 10.5, z)
            box(W, 'E_cyan', 0.03, 0.05, 3.4, side * (X - 0.05), 7.4, z)
    wall('wall-back', -X, ZB - 0.15, X, ZB - 0.15, CEIL + 0.5, y0=-8.0)
    glass_facade(-X, ZF, X, ZF, FLOOR_Y, CEIL, mullion=2.6)
    collider('facade', 0, ZF + 0.1, 2 * X, 0.3, 0, CEIL, player_only=True)
    skylight_ceiling(-X - 0.2, X + 0.2, ZB, ZF + 0.2, CEIL + 0.2, [(-40, -35), (-14, -6), (8, 12)])
    for z in (-44, 18):
        for side in (-1, 1):
            column(side * 14.6, z, CEIL, r=0.4)

def entry():
    slab('entry', -X, X, VOID[1], ZF, finish='marble')
    entity('deco', 'info-rings', prefab='info_rings', x=0, y=8.6, z=16.0, spin=0.13)
    planter('a', -13.8, 18.2, 'plant01', 2.2, 4)
    planter('b', 13.8, 18.2, 'plant02', 2.0, 5)
    hanging_sign('ÁTRIO DE DADOS', 0, 6.4, 13.6, width=5.4, cable_top=CEIL)
    # Raised side blocks flanking the corridor: launch pads, cubes, no shortcut forward.
    for side in (-1, 1):
        x0, x1 = sorted((side * 3.0, side * X))
        xc = (x0 + x1) / 2
        box(W, 'concrete', x1 - x0, BLOCK, 8.0, xc, BLOCK / 2, 9.0)
        box(W, 'marble', x1 - x0 - 0.04, 0.04, 7.96, xc, BLOCK - 0.02, 9.0)
        box(W, 'E_cyan', x1 - x0 - 0.1, 0.04, 0.04, xc, BLOCK - 0.2, 13.0)
        collider(f'block-{side}', xc, 9.0, x1 - x0, 8.0, -0.1, BLOCK)
        walkable(xc, 9.0, (x1 - x0) / 2, 4.0, BLOCK)
        glass_wall(f'block-front-{side}', x0, 5.0, x1, 5.0, BLOCK, BLOCK + 4.5)
        entity('jumpPad', f'pad-block-{side}', x=side * 11.0, y=FLOOR_Y, z=15.6, radius=1.0, power=13.2)
        entity('deco', f'pad-block-ring-{side}', prefab='jump_pad_ring', x=side * 11.0, y=FLOOR_Y + 0.27, z=15.6, spin=0.65)
        planter(f'block-{side}', side * 14.6, 6.2, 'plant02' if side > 0 else 'plant01', 1.8, 6 + side, y=BLOCK)

def corridor():
    for side in (-1, 1):
        glass_wall(f'corridor-{side}', side * 3.0, 13.0, side * 3.0, 5.0, FLOOR_Y, BLOCK + 4.5)
    box(W, 'rubber', 5.9, 0.03, 8.0, 0, FLOOR_Y + 0.0, 9.0)
    for z in (12.6, 5.4):
        box(W, 'yellow', 5.9, 0.04, 0.14, 0, FLOOR_Y + 0.01, z)
    entity('barrier', 'corridor-a', x=0, y=FLOOR_Y, z=11.6, width=6.0, yaw=0)
    entity('barrier', 'corridor-b', x=0, y=FLOOR_Y, z=6.6, width=6.0, yaw=0)
    entity('scanner', 'corridor-scan', x=0, y=FLOOR_Y + 0.9, z=9.1, length=5.8, yaw=0,
           sweep={'axis': 'z', 'amp': 0.85, 'period': 2.6})
    hanging_sign('CORREDOR DO DASH', 0, 4.9, 13.2, width=4.6, cable_top=CEIL)

def void_edge():
    # Railing along the edge of the void, open in the middle where the Judicial path starts.
    railing('edge-l', -X, 0.0, -2.0, 0.0, FLOOR_Y)
    railing('edge-r', 2.0, 0.0, X, 0.0, FLOOR_Y)
    for x in (-2.0, 2.0):
        cyl(W, 'yellow', 0.12, 1.2, x, FLOOR_Y + 0.6, 0.1, segs=16)
    entity('killzone', 'void', minX=-X, maxX=X, minZ=VOID[0], maxZ=VOID[1], y=-2.0)
    # Deep data well: dark floor with flowing light lines far below.
    box(W, 'dark', 2 * X, 0.3, VOID[1] - VOID[0], 0, -7.0, (VOID[0] + VOID[1]) / 2)
    for k in range(-14, 15, 2):
        box(W, 'E_cyan' if k % 4 else 'E_mint', 0.06, 0.04, VOID[1] - VOID[0] - 1, k, -6.82, (VOID[0] + VOID[1]) / 2)
    for side in (-1, 1):
        box(W, 'concrete', 0.3, 7.0, VOID[1] - VOID[0], side * (X - 0.15), -3.5, (VOID[0] + VOID[1]) / 2)
    for z in VOID:
        box(W, 'concrete', 2 * X, 7.0, 0.3, 0, -3.6, z)
    # Filter terminal (M03) at the edge, looking over the void.
    terminal('m03', -6.5, 3.0, 'FILTRO', yaw=0.0)
    entity('terminal', 'filter', mission='m03', x=-6.5, y=FLOOR_Y, z=3.0, radius=3.2,
           view={'pos': [-9.0, 7.0, 6.0], 'look': [-4.0, 1.0, -10.0]})
    for id, x, y, z, motion in DATA:
        deck(id, 'data', x, y, z, motion=motion, bind={'flag': 'dataPlatforms', 'key': id}, speed=3.0)
        text(W, 'E_mint' if id[0] == 'J' else 'E_amber', id, 0.5, x, -6.6, z, pitch=-math.pi / 2, depth=0.02)

def side_bay():
    # Sealed bay reached only over the Administrative decks: ledge, launch pad, master room.
    floor('bay', -X, -10.0, -27.0, -15.5)
    box(W, 'paving', 6.0, 0.6, 11.5, -13.0, FLOOR_Y - 0.3, -21.25)
    glass_wall('bay-x', -10.0, -27.0, -10.0, -12.0, FLOOR_Y, 12.6)
    glass_wall('bay-z', -X, -27.0, -10.0, -27.0, FLOOR_Y, 12.6)
    slab('bay-ledge', -X, -12.5, -21.0, -15.5, y=3.6)
    box(W, 'concrete', 3.5, 3.0, 5.5, -14.25, 1.6, -18.25)
    collider('bay-ledge-body', -14.25, -18.25, 3.5, 5.5, -0.1, 3.6)
    box(W, 'walnut', 1.4, 1.8, 1.4, -11.4, FLOOR_Y + 0.9, -17.2, bevel=0.04)
    collider('bay-crate', -11.4, -17.2, 1.4, 1.4, 0, FLOOR_Y + 1.8)
    walkable(-11.4, -17.2, 0.7, 0.7, FLOOR_Y + 1.8)
    entity('jumpPad', 'pad-master', x=-14.2, y=3.6, z=-19.6, radius=1.0, power=14.0)
    entity('deco', 'pad-master-ring', prefab='jump_pad_ring', x=-14.2, y=3.87, z=-19.6, spin=0.65)
    slab('master-room', -X, -10.0, -27.0, -21.0, y=8.4, finish='walnut')
    railing('master-rail', -X, -21.0, -15.6, -21.0, 8.4)
    railing('master-rail-b', -11.6, -21.0, -10.0, -21.0, 8.4)
    terminal('m04', -13.0, -25.4, 'MESTRE', y=8.4, yaw=0.0)
    entity('terminal', 'master', mission='m04', x=-13.0, y=8.4, z=-25.4, radius=3.0,
           view={'pos': [-12.0, 12.0, -18.5], 'look': [-13.0, 9.6, -26.0]})
    entity('secret', 'master-room', x=-10.9, y=9.5, z=-22.2, radius=1.3, label='Sala do Mestre dos Dados')
    hanging_sign('ARQUIVO MESTRE', -13.0, 12.6, -21.2, width=4.4, cable_top=CEIL)

def far_side():
    floor('far-a', -10.0, X, -27.0, VOID[0])
    floor('far-b', -X, X, ZB, -27.0)
    box(W, 'concrete', 26.0, 0.6, 9.0, 3.0, FLOOR_Y - 0.34, -22.5)
    box(W, 'marble', 25.96, 0.04, 8.96, 3.0, FLOOR_Y - 0.02, -22.5)
    box(W, 'concrete', 2 * X, 0.6, 19.0, 0, FLOOR_Y - 0.34, -36.5)
    box(W, 'marble', 2 * X - 0.04, 0.04, 18.96, 0, FLOOR_Y - 0.02, -36.5)
    box(W, 'E_cyan', 25.9, 0.04, 0.04, 3.0, FLOOR_Y - 0.2, VOID[0])
    # Server racks: walkable tops, cable trays, status LEDs.
    racks = [(7.5, -22.0), (11.5, -22.0), (-6.0, -31.0), (-10.0, -31.0), (10.0, -34.0)]
    for i, (x, z) in enumerate(racks):
        box(W, 'navy', 1.4, 2.2, 3.0, x, FLOOR_Y + 1.1, z, bevel=0.05)
        for k in range(5):
            box(W, 'E_mint' if (i + k) % 3 else 'E_amber', 0.05, 0.04, 2.4, x + 0.71, FLOOR_Y + 0.4 + k * 0.38, z)
        collider(f'rack-{i}', x, z, 1.4, 3.0, -0.1, FLOOR_Y + 2.2)
        walkable(x, z, 0.7, 1.5, FLOOR_Y + 2.2)
    entity('drone', 'rack-drone', path=[[-12.0, 1.2, -27.8], [12.0, 1.2, -27.8]], speed=3.0)
    entity('scanner', 'rack-scan', x=9.5, y=FLOOR_Y + 0.9, z=-25.0, length=12.4, yaw=0,
           sweep={'axis': 'z', 'amp': 1.6, 'period': 3.8})
    for side in (-1, 1):
        box(W, 'steel', 0.3, 1.2, 0.5, side * 3.2 + 9.5, FLOOR_Y + 0.85, -25.0, bevel=0.04)
    # Energy terminal (SOMA) and the fan that lifts Levi to the elevator balcony.
    terminal('sum', 5.5, -30.5, 'ENERGIA', yaw=0.0)
    entity('terminal', 'energy', mission='sum', x=5.5, y=FLOOR_Y, z=-30.5, radius=3.2,
           view={'pos': [8.0, 5.0, -24.0], 'look': [0.0, 5.0, -38.0]})
    entity('fan', 'fan', prefab='fan', x=0.0, y=FLOOR_Y, z=-36.6, radius=2.0, height=10.6, bind={'flag': 'fanPower'})
    collider('fan-drum', 0.0, -36.6, 0.6, 0.6, -0.1, FLOOR_Y + 0.4)
    for side in (-1, 1):
        cyl(W, 'yellow', 0.12, 1.1, side * 2.6, FLOOR_Y + 0.55, -36.6, segs=16)
    # Elevator balcony with the wall below it (only the air column reaches it).
    slab('balcony', -8.0, 8.0, ZB, -39.3, y=BALCONY)
    wall('balcony-wall', -8.0, -39.45, 8.0, -39.45, BALCONY - 0.6, y0=0.0)
    for x in (-6.0, -2.0, 2.0, 6.0):
        box(W, 'walnut', 1.8, 6.4, 0.06, x, 4.6, -39.25)
    railing('balcony-l', -8.0, -39.3, -2.5, -39.3, BALCONY)
    railing('balcony-r', 2.5, -39.3, 8.0, -39.3, BALCONY)
    for side in (-1, 1):
        railing(f'balcony-side-{side}', side * 8.0, ZB, side * 8.0, -39.3, BALCONY)
    exit_frame(0.0, BALCONY, -45.7, 'CENTRAL · WORLD 02')
    entity('exit', 'exit', x=0.0, y=BALCONY, z=-45.4, yaw=0, radius=1.7, to=None)
    hanging_sign('ELEVADOR CENTRAL', 0, BALCONY + 5.4, -41.0, width=5.0, cable_top=CEIL)
    planter('far-a', 14.6, -44.6, 'plant01', 2.2, 8)
    planter('far-b', -14.6, -44.6, 'plant02', 2.0, 9)

def pickups_and_checkpoints():
    cubes = [(-9.5, BLOCK + 1.12, 9.0), (-14.0, BLOCK + 1.12, 11.0), (9.5, BLOCK + 1.12, 9.0),
             (14.0, BLOCK + 1.12, 11.0), (0.0, FLOOR_Y + 1.12, 9.1), (-1.2, 1.6 + 1.6, -8.4),
             (-14.8, 3.6 + 1.12, -17.0), (7.5, FLOOR_Y + 2.2 + 1.12, -22.0), (-10.0, FLOOR_Y + 2.2 + 1.12, -31.0),
             (6.0, BALCONY + 1.12, -42.5)]
    for i, (x, y, z) in enumerate(cubes):
        entity('pickup', f'cube-{i}', x=x, y=round(y, 3), z=z, phase=i * 1.35)
    for id, x, z, after in [('start', 0.0, 17.0, None), ('edge', 0.0, 2.0, None),
                            ('far', 0.8, -20.5, 'm03'), ('cp-fan', 5.0, -33.0, 'm03')]:
        entity('checkpoint', id, x=x, y=FLOOR_Y, z=z, radius=1.8, after=after)

def build_stage():
    begin_stage('1-3', 'Átrio de Dados', {'minX': -15.6, 'maxX': 15.6, 'minZ': -45.6, 'maxZ': 19.6, 'voidY': -11},
                [0.0, FLOOR_Y, 18.4], 0.0, cull_top=CEIL + 0.75, cull_bottom=-8.0)
    shell(); entry(); corridor(); void_edge(); side_bay(); far_side(); pickups_and_checkpoints()
    build_plants([(-14.6, BALCONY + 0.3, -40.5), (14.6, BLOCK + 0.3, 12.5)])
    fills = [(0, CEIL - 0.6, z, 14, 4, 900) for z in (-37.5, -10.0, 10.0)] + \
            [(0, 6.0, -9.0, 20, 14, 350), (-13.0, 12.0, -22.0, 5, 8, 300), (0, BALCONY + 4, -43, 14, 5, 400)]
    density = {'LM_marble': 1.5, 'LM_rubber': 1.2, 'LM_walnut': 1.1, 'LM_plaster': 0.5, 'LM_concrete': 0.7}
    return fills, density
