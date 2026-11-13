"""Animated / interactive prefabs shared by every stage -> public/stages/props.glb.

Each prefab is a PF_<name> root at the origin. Conventions the runtime relies on:
  decks (deck_*, lift_*, data, walkway): walkable TOP at local y = 0
  jump_pad, fan, portal, checkpoint:      base at local y = 0
  barrier: bottom at 0, 6.65 m wide (scaled to the entity width)
  scanner: beam centred, 3.4 m long along x (scaled to the entity length)
  air_column: radius 1, height 1 from y = 0 (scaled to radius / power)
"""
import math
from levi_kit import box, cyl, torus, sphere, text, DECKS

def drones():
    g = 'helper_drone'
    sphere(g, 'P_white', 0.34, 0, 0, 0, scale=(1.0, 0.92, 0.95))
    sphere(g, 'P_visor', 0.25, 0, 0.03, 0.17, scale=(1.05, 0.72, 0.5))
    for s in (-1, 1):
        box(g, 'P_cyan', 0.07, 0.1, 0.03, s * 0.09, 0.07, 0.42, bevel=0.015, segments=2)
        cyl(g, 'P_navy', 0.08, 0.12, s * 0.36, 0.02, 0, segs=16, roll=math.pi / 2)
        torus(g, 'P_cyan', 0.09, 0.012, s * 0.42, 0.02, 0, seg=20, ring=5, roll=math.pi / 2)
        box(g, 'P_white', 0.34, 0.015, 0.06, s * 0.36, 0.17, 0, yaw=s * 0.4)
    cyl(g, 'P_navy', 0.012, 0.16, 0, 0.38, 0, segs=6)
    sphere(g, 'P_cyan', 0.05, 0, 0.48, 0, segs=12, rings=8)
    box(g, 'P_yellow', 0.3, 0.2, 0.02, 0, -0.32, 0.12, bevel=0.01, pitch=0.3)   # the ATD-104 card
    g = 'sentinel_drone'
    sphere(g, 'P_steel', 0.42, 0, 0, 0, scale=(1, 0.8, 1))
    sphere(g, 'P_pink', 0.17, 0, 0, 0.36, segs=16, rings=10)
    torus(g, 'P_navy', 0.6, 0.04, 0, 0.05, 0, seg=40, ring=8)
    for a in range(4):
        box(g, 'P_navy', 0.2, 0.04, 0.05, 0.5 * math.cos(a * math.pi / 2), 0.05, 0.5 * math.sin(a * math.pi / 2), yaw=a * math.pi / 2)
    torus(g, 'P_pink', 0.25, 0.015, 0, -0.33, 0, seg=24, ring=5)

def collectibles():
    g = 'data_cube'
    box(g, 'P_glass', 0.56, 0.56, 0.56, 0, 0, 0, bevel=0.04, segments=2)
    for i in range(3):
        for j in range(3):
            for k in range(3):
                bright = (i, j, k) == (1, 1, 1) or (i + j + k) % 4 == 0
                box(g, 'P_green' if bright else 'P_cyan', 0.12, 0.12, 0.12,
                    (i - 1) * 0.16, (j - 1) * 0.16, (k - 1) * 0.16, bevel=0.015)
    torus('data_halo', 'P_cyan', 0.47, 0.018, 0, 0, 0, seg=40, ring=5)
    g = 'secret_star'
    sphere(g, 'P_gold', 0.32, 0, 0, 0, segs=4, rings=2)               # octahedron gem
    for i in range(2):
        torus(g, 'P_gold', 0.62 + i * 0.16, 0.025, 0, 0, 0, seg=40, ring=5, pitch=math.pi / 2, yaw=i * math.pi / 2)

def decks():
    for kind, (w, d) in DECKS.items():
        if kind in ('lift', 'data', 'walkway'):
            continue
        g = kind
        box(g, 'P_steel', w, 0.28, d, 0, -0.16, 0, bevel=0.08, segments=2)
        box(g, 'P_light', w - 0.14, 0.06, d - 0.14, 0, -0.03, 0, bevel=0.02)
        for s in (-1, 1):
            box(g, 'P_yellow', 0.12, 0.12, d - 0.2, s * (w / 2 - 0.02), -0.12, 0, bevel=0.03)
            box(g, 'P_cyan', w - 0.5, 0.03, 0.05, 0, 0.005, s * (d / 2 - 0.2))
        cyl(g, 'P_navy', 0.42, 0.22, 0, -0.4, 0, segs=24, r2=0.3)
        cyl(g, 'P_cyan', 0.27, 0.02, 0, -0.515, 0, segs=24)
    # Queue lifts: hazard-striped deck, number plate, cables to the ceiling.
    w, d = DECKS['lift']
    for n in range(1, 5):
        g = f'lift_L{n}'
        box(g, 'P_steel', w, 0.32, d, 0, -0.18, 0, bevel=0.06, segments=2)
        box(g, 'P_rubber', w - 0.2, 0.04, d - 0.2, 0, -0.01, 0)
        for k in range(8):
            t = -w / 2 + 0.16 + k * (w - 0.32) / 7
            for s in (-1, 1):
                box(g, 'P_yellow' if k % 2 else 'P_navy', 0.3, 0.05, 0.12, t, -0.01, s * (d / 2 - 0.07))
        for sx in (-1, 1):
            for sz in (-1, 1):
                cyl(g, 'P_steel', 0.025, 14, sx * (w / 2 - 0.15), 7.0, sz * (d / 2 - 0.15), segs=6)
        box(g, 'P_navy', 0.9, 0.5, 0.06, 0, -0.55, d / 2 + 0.02, bevel=0.02)
        text(g, 'P_white', f'L{n}', 0.34, 0, -0.55, d / 2 + 0.06, depth=0.02)
        torus(g, 'P_green', w / 2 - 0.05, 0.03, 0, -0.34, 0, seg=4, ring=4, yaw=math.pi / 4)  # status ring
    # Data platform: steel frame with a holographic top that dims when unpowered.
    w, d = DECKS['data']
    g = 'data'
    box(g, 'P_holo', w - 0.2, 0.06, d - 0.2, 0, -0.04, 0)
    for s in (-1, 1):
        box(g, 'P_steel', w, 0.14, 0.12, 0, -0.1, s * (d / 2 - 0.06), bevel=0.03)
        box(g, 'P_steel', 0.12, 0.14, d, s * (w / 2 - 0.06), -0.1, 0, bevel=0.03)
    cyl(g, 'P_navy', 0.3, 0.3, 0, -0.32, 0, segs=16, r2=0.15)
    # Retractable walkway with side rails.
    w, d = DECKS['walkway']
    g = 'walkway'
    box(g, 'P_steel', w, 0.3, d, 0, -0.17, 0, bevel=0.05)
    box(g, 'P_light', w - 0.1, 0.04, d - 0.3, 0, -0.01, 0)
    for s in (-1, 1):
        box(g, 'P_brass', w, 0.06, 0.06, 0, 1.0, s * (d / 2 - 0.05), bevel=0.02)
        box(g, 'P_cyan', w - 0.2, 0.03, 0.04, 0, 0.0, s * (d / 2 - 0.2))
        for k in range(9):
            box(g, 'P_brass', 0.05, 1.0, 0.05, -w / 2 + 0.2 + k * (w - 0.4) / 8, 0.5, s * (d / 2 - 0.05))

def machines():
    g = 'jump_pad'
    cyl(g, 'P_steel', 1.05, 0.28, 0, 0.14, 0, segs=40)
    cyl(g, 'P_yellow', 1.08, 0.08, 0, 0.24, 0, segs=40)
    cyl(g, 'P_mint', 0.75, 0.04, 0, 0.3, 0, segs=40)
    for a in range(3):
        box(g, 'P_navy', 0.12, 0.05, 0.7, 0.4 * math.cos(a * 2.094), 0.31, 0.4 * math.sin(a * 2.094), yaw=-a * 2.094)
    torus('jump_pad_ring', 'P_mint', 0.87, 0.05, 0, 0, 0, seg=48, ring=8)
    g = 'barrier'
    for y in (0.08, 2.09):
        box(g, 'P_brass', 6.65, 0.16, 0.38, 0, y, 0, bevel=0.04)
    for s in (-1, 1):
        box(g, 'P_light', 0.24, 2.2, 0.42, s * 3.25, 1.08, 0, bevel=0.05)
    for i in range(-5, 6):
        box(g, 'P_pink', 0.035, 1.85, 0.075, i * 0.52, 1.08, 0)
    g = 'scanner'
    box(g, 'P_pink', 3.4, 0.1, 0.11, 0, 0, 0)
    for s in (-1, 1):
        box(g, 'P_brass', 0.2, 0.62, 0.32, s * 1.75, -0.05, 0, bevel=0.04)
    # Fan: grated drum (static) + blades (spun at runtime) + air column (scaled).
    g = 'fan'
    cyl(g, 'P_steel', 2.1, 0.5, 0, 0.25, 0, segs=48)
    torus(g, 'P_cyan', 2.0, 0.04, 0, 0.5, 0, seg=64, ring=6)
    for k in range(6):
        box(g, 'P_navy', 4.0, 0.06, 0.08, 0, 0.52, 0, yaw=k * math.pi / 6)
    g = 'fan_blades'
    cyl(g, 'P_light', 0.35, 0.2, 0, 0.0, 0, segs=24)
    for k in range(5):
        box(g, 'P_light', 1.7, 0.04, 0.5, 0.95 * math.cos(k * 1.2566), 0, 0.95 * math.sin(k * 1.2566),
            yaw=-k * 1.2566, roll=0.35)
    cyl('air_column', 'P_air', 1.0, 1.0, 0, 0.5, 0, segs=32, caps=False)
    # Exit portal: vertical ring with a glowing membrane, base at y = 0.
    g = 'portal'
    torus(g, 'P_violet', 1.35, 0.11, 0, 1.6, 0, seg=64, ring=10, pitch=math.pi / 2)
    torus(g, 'P_brass', 1.55, 0.05, 0, 1.6, 0, seg=64, ring=8, pitch=math.pi / 2)
    cyl(g, 'P_holo', 1.3, 0.03, 0, 1.6, 0, segs=48, pitch=math.pi / 2)
    cyl(g, 'P_steel', 1.0, 0.16, 0, 0.08, 0, segs=40)
    # Checkpoint beacon: lamp turns from cyan to green at runtime.
    g = 'checkpoint'
    cyl(g, 'P_steel', 0.45, 0.08, 0, 0.04, 0, segs=24)
    cyl(g, 'P_navy', 0.06, 1.6, 0, 0.8, 0, segs=12)
    sphere(g, 'P_cyan', 0.16, 0, 1.7, 0, segs=16, rings=10)
    torus(g, 'P_brass', 0.22, 0.02, 0, 1.7, 0, seg=24, ring=5)
    for i in range(3):
        torus('info_rings', 'P_mint' if i == 1 else 'P_brass', 1.3 + i * 0.36, 0.043, 0, 0, 0,
              seg=64, ring=8, pitch=0.14 + i * 0.12, yaw=0.1 + i * 0.4, roll=i * 0.4)
    cyl('info_rings', 'P_light', 0.18, 0.34, 0, 0, 0, segs=16)

def build_props():
    drones(); collectibles(); decks(); machines()
