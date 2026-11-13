"""Stage 1-2 "Galeria da Fila".

Ground floor: two conveyor lanes with a patrol drone between them, a scanner beam to
jump over and a glass partition with a dash barrier. Behind it the queue terminal (M02)
drives four lifts: sorted by height they become a staircase to the top gallery (y 9),
where sweeping scanners guard the exit. Side balconies (y 4.5) hide cubes and a secret.
"""
import math
from levi_kit import (W, FLOOR_Y, box, cyl, text, slab, wall, railing, column, terminal, hanging_sign,
                      planter, bench, skylight_ceiling, glass_facade, exit_frame, build_plants, begin_stage,
                      collider, floor, walkable, entity, deck)

X, ZB, ZF, TOP, SIDE = 12.0, -18.0, 18.0, 9.0, 4.5
SLOTS = [[-6.6, -10.0], [-2.2, -10.0], [2.2, -10.0], [6.6, -10.0]]
LIFT_START = {'L1': (0, 5.4), 'L2': (1, 1.8), 'L3': (2, 7.2), 'L4': (3, 3.6)}

def shell():
    slab('ground', -X, X, ZB, ZF, finish='marble', edge_light=False)
    for side in (-1, 1):
        wall(f'wall-{side}', side * (X + 0.15), ZB, side * (X + 0.15), ZF, 16.5, mat='concrete', y0=-0.4)
        for z in (-14, -6, 2, 10):
            box(W, 'walnut', 0.06, 7.0, 3.2, side * (X - 0.02), 7.5, z)
    wall('wall-back', -X, ZB - 0.15, X, ZB - 0.15, 16.5, y0=-0.4)
    glass_facade(-X, ZF, X, ZF, 0.11, 16.0, mullion=2.4)
    collider('facade', 0, ZF + 0.1, 2 * X, 0.3, 0, 16, player_only=True)
    skylight_ceiling(-X - 0.2, X + 0.2, ZB, ZF + 0.2, 16.2, [(-13, -10), (-2, 1), (9, 12)])
    for z in (-16.5, 16.5):
        for side in (-1, 1):
            column(side * 10.9, z, 16.0, r=0.36)
    # Queue displays: big numbered boards on the walls.
    for side, label in ((-1, 'SENHA 042'), (1, 'GUICHÊ 07')):
        box(W, 'dark', 0.12, 1.6, 5.2, side * (X - 0.08), 12.0, 4.0, bevel=0.03)
        box(W, 'E_amber', 0.02, 0.06, 5.0, side * (X - 0.15), 12.75, 4.0)
        text(W, 'E_amber', label, 0.6, side * (X - 0.16), 11.9, 4.0, yaw=-side * math.pi / 2, depth=0.02)

def ground_floor():
    # Conveyor lanes (flush with the floor) with chevrons showing the push direction.
    for id, z0, z1, vx in (('belt-a', 10.5, 13.5, 3.2), ('belt-b', 4.0, 7.0, -3.6)):
        zc = (z0 + z1) / 2
        box(W, 'rubber', 2 * X, 0.04, z1 - z0, 0, FLOOR_Y + 0.0, zc)
        for side in (-1, 1):
            box(W, 'yellow', 2 * X, 0.05, 0.12, 0, FLOOR_Y + 0.01, zc + side * (z1 - z0) / 2)
        for k in range(-10, 11, 2):
            for s in (-1, 1):
                box(W, 'E_mint', 0.5, 0.02, 0.08, k + 0.1 * (1 if vx > 0 else -1), FLOOR_Y + 0.03,
                    zc + s * 0.18, yaw=(0.6 if vx > 0 else -0.6) * -s + (math.pi if vx < 0 else 0))
        entity('conveyor', id, minX=-X, maxX=X, minZ=z0, maxZ=z1, y=FLOOR_Y, vx=vx, vz=0)
    entity('drone', 'lane-drone', path=[[-9.5, 1.1, 8.75], [9.5, 1.1, 8.75]], speed=3.4)
    entity('scanner', 'floor-scan', x=0, y=FLOOR_Y + 0.85, z=2.1, length=2 * X - 0.4, yaw=0,
           sweep={'axis': 'z', 'amp': 0.9, 'period': 3.4})
    for side in (-1, 1):
        box(W, 'steel', 0.3, 1.2, 0.5, side * (X - 0.3), FLOOR_Y + 0.85, 2.1, bevel=0.04)
    # Glass partition with the dash door.
    for x0, x1 in ((-X, -3.3), (3.3, X)):
        box(W, 'G_glass', x1 - x0, 3.2, 0.05, (x0 + x1) / 2, FLOOR_Y + 1.6, 0.0)
        box(W, 'alu', x1 - x0, 0.14, 0.14, (x0 + x1) / 2, FLOOR_Y + 3.2, 0.0)
        collider(f'partition-{x0}', (x0 + x1) / 2, 0.0, x1 - x0, 0.3, 0, 3.3)
    for x in (-3.3, 3.3):
        box(W, 'steel', 0.3, 3.4, 0.4, x, FLOOR_Y + 1.7, 0.0, bevel=0.04)
    entity('barrier', 'door', x=0, y=FLOOR_Y, z=0.0, width=6.6, yaw=0)
    hanging_sign('FILA DOS ELEVADORES', 0, 8.2, 0.3, width=5.6, cable_top=16.0)
    # Queue terminal (M02) facing the partition, lifts behind it.
    terminal('m02', 0.0, -2.8, 'FILA', yaw=0.0)
    entity('terminal', 'queue', mission='m02', x=0.0, y=FLOOR_Y, z=-2.8, radius=3.1,
           view={'pos': [0.0, 5.0, 3.6], 'look': [0.0, 4.0, -10.0]})
    # Lift pits: marked floor under each slot.
    for i, (x, z) in enumerate(SLOTS):
        box(W, 'dark', 2.9, 0.03, 2.9, x, FLOOR_Y + 0.01, z)
        box(W, 'yellow', 3.0, 0.02, 0.1, x, FLOOR_Y + 0.025, z + 1.45)
        text(W, 'yellow', str(i + 1), 0.5, x, FLOOR_Y + 0.03, z + 1.9, pitch=-math.pi / 2, depth=0.01)
    for lift, (slot, y) in LIFT_START.items():
        x, z = SLOTS[slot]
        deck(lift, 'lift', x, y, z, prefab='lift_' + lift, bind={'flag': 'lifts', 'key': lift}, slots=SLOTS, speed=2.6)
    planter('a', -10.6, 16.0, 'plant01', 2.2, 1)
    planter('b', 10.6, 16.0, 'plant02', 2.0, 2)
    bench('a', -9.5, -6.0, math.pi / 2)
    entity('jumpPad', 'pad-right', x=7.0, y=FLOOR_Y, z=15.0, radius=1.0, power=15.2)

def balconies():
    # Left balcony: reached from a bobbing deck; secret alcove behind a dash barrier.
    slab('balcony-left', -X, -8.6, -4.0, 16.0, y=SIDE)
    railing('bl-a', -8.6, 0.5, -8.6, 7.6, SIDE)
    railing('bl-b', -8.6, 10.4, -8.6, 16.0, SIDE)
    deck('lift-left', 'deck_c', -6.6, 2.4, 9.0, motion={'axis': 'y', 'amp': 1.1, 'period': 4.0})
    cyl(W, 'steel', 0.12, 1.2, -6.6, FLOOR_Y + 0.6, 9.0, segs=16)
    wall('alcove-back', -X, -4.0, -8.6, -4.0, 6.0, y0=SIDE)
    box(W, 'G_glass', 0.05, 3.0, 4.0, -8.6, SIDE + 1.5, -2.0)
    collider('alcove-glass', -8.6, -2.0, 0.2, 4.0, SIDE - 0.1, SIDE + 3.1)
    entity('barrier', 'alcove-barrier', x=-10.3, y=SIDE, z=0.5, width=3.4, yaw=0)
    entity('secret', 'alcove', x=-10.3, y=SIDE + 1.2, z=-2.8, radius=1.3, label='Nicho atrás da barreira')
    # Right balcony: launch pad from the entrance.
    slab('balcony-right', 8.6, X, 0.0, 16.0, y=SIDE)
    railing('br-a', 8.6, 0.0, 8.6, 13.5, SIDE)
    for side, z0 in ((-1, -4.0), (1, 0.0)):
        for z in (z0 + 1, 15):
            cyl(W, 'white', 0.25, SIDE - 0.3, side * 9.2, (SIDE - 0.3) / 2, z, segs=20)
            collider(f'balcony-post-{side}-{z}', side * 9.2, z, 0.55, 0.55, 0, SIDE - 0.3)

def top_gallery():
    slab('top', -X, X, ZB, -11.6, y=TOP)
    railing('top-a', -X, -11.6, 5.2, -11.6, TOP)
    railing('top-b', 8.0, -11.6, X, -11.6, TOP)
    for x in (-9.5, 0.0, 9.5):
        cyl(W, 'white', 0.35, TOP - 0.4, x, (TOP - 0.4) / 2, -12.4, segs=24)
        collider(f'top-post-{x}', x, -12.4, 0.75, 0.75, 0, TOP - 0.4)
    for i, (x, z, h) in enumerate([(0.0, -16.6, 1.2), (-6.4, -16.9, 1.6), (3.4, -17.0, 0.8)]):
        box(W, 'walnut', 1.6, h, 1.4, x, TOP + h / 2, z, bevel=0.04)
        collider(f'crate-{i}', x, z, 1.6, 1.4, TOP, TOP + h)
        walkable(x, z, 0.8, 0.7, TOP + h)
    for id, x, amp, period in (('top-scan-a', 2.0, 2.2, 3.2), ('top-scan-b', -4.0, 2.2, 2.6)):
        entity('scanner', id, x=x, y=TOP + 0.85, z=-14.8, length=6.2, yaw=math.pi / 2,
               sweep={'axis': 'x', 'amp': amp, 'period': period})
    exit_frame(-9.6, TOP, -17.7, 'ÁTRIO DE DADOS')
    entity('exit', 'exit', x=-9.6, y=TOP, z=-17.4, yaw=0, radius=1.7, to='1-3')
    hanging_sign('SAÍDA', -9.6, TOP + 5.2, -15.5, width=2.6, cable_top=16.0)

def pickups_and_checkpoints():
    cubes = [(-6.0, FLOOR_Y + 1.12, 12.0), (6.0, FLOOR_Y + 1.12, 5.5), (-10.3, SIDE + 1.12, 12.0),
             (-11.0, SIDE + 1.12, -1.6), (-9.4, SIDE + 1.12, -3.0), (10.3, SIDE + 1.12, 6.0),
             (10.3, SIDE + 1.12, 2.0), (0.0, TOP + 1.2 + 1.12, -16.6), (-6.4, TOP + 1.6 + 1.12, -16.9)]
    for i, (x, y, z) in enumerate(cubes):
        entity('pickup', f'cube-{i}', x=x, y=round(y, 3), z=z, phase=i * 1.35)
    for id, x, y, z in [('cp-door', -5.0, FLOOR_Y, -1.6), ('cp-top', 6.6, TOP, -14.2)]:
        entity('checkpoint', id, x=x, y=y, z=z, radius=1.8)

def build_stage():
    begin_stage('1-2', 'Galeria da Fila', {'minX': -11.6, 'maxX': 11.6, 'minZ': -17.6, 'maxZ': 17.6, 'voidY': -11},
                [0.0, FLOOR_Y, 16.4], 0.0, cull_top=16.75, cull_bottom=-1.0)
    shell(); ground_floor(); balconies(); top_gallery(); pickups_and_checkpoints()
    build_plants([(-8.9, SIDE + 0.3, z) for z in (2.0, 13.0)] + [(8.9, SIDE + 0.3, z) for z in (4.0, 11.0)])
    fills = [(0, 15.4, z, 12, 2.5, 800) for z in (-11.5, -0.5, 10.5)] + \
            [(0, TOP + 4, -15, 18, 5, 500), (-10.3, SIDE + 3, 6, 3, 18, 300), (10.3, SIDE + 3, 8, 3, 15, 300)]
    density = {'LM_marble': 1.6, 'LM_rubber': 1.2, 'LM_walnut': 1.1, 'LM_plaster': 0.6, 'LM_concrete': 0.7}
    return fills, density
