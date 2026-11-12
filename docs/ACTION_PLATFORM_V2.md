# LEVI Excel v2 — Action & 3D Platforming Design
**Status:** design specification; no gameplay implementation claimed  
**Role:** mandatory companion to `GAME_DESIGN_V2.md`, `VERTICAL_SLICE_V2.md` and `IMPLEMENTATION_PLAN_V2.md`  
**Priority:** the adventure must remain enjoyable when there is no worksheet on screen.

## 0. Product correction — this is an actual platformer
The earlier v2 proposal overemphasized the spreadsheet stations. That would create a walking simulator with occasional quizzes. The corrected fantasy is **a joyful 3D action-platform adventure starring the original Levi**, where data skills let the player manipulate routes, systems and machines.

**Target pacing for World 01:** about **65–70% active third-person traversal, exploration and action**; about **30–35% learning/worksheet interactions**. This is a design target to validate in playtests, not a hard timer. A learner who needs more time must never feel penalized.

The game must be fun in a 2–3-minute section containing **no Excel UI whatsoever**. No "move to next computer, open exercise, repeat" as the central loop.

## 1. Action-platform gameplay pillars

### A. Levi is fun to pilot
Levi is small, expressive, responsive and agile; his silhouette is instantly readable. The original `levi.glb` remains the source model with existing `Parado`, `Andar`, `Pular`, `Acenar`, `Dancar`, `Comemorar` clips. Add procedural motion and lightweight FX where the model lacks clips. Do not suggest a dash animation exists when it does not.

**Movement kit, in teaching order:**
| Mechanic | World 01 timing | Input | Gameplay purpose |
|---|---|---|---|
| Walk / run | available at start | WASD / analog stick; Shift sprint | approachable free movement, exploration |
| Jump | first 30 seconds | Space / touch jump | clear simple obstacles, gentle vertical play |
| **Double jump** | after first safe jump sequence | Space again while airborne | access upper ledges, correct near-misses |
| **Dash** | first action corridor after M00 | dedicated button (e.g. `J`/gamepad south-east button; mobile on-screen) | short burst to cross gaps, avoid drones, destroy fragile digital barriers |
| Jump pad | after dash tutorial | automatic on contact | speed and verticality without more controls |
| Moving platform | midway through level | positioning and timing | precision with generous safe timing |
| Stomp / bounce | later world / optional in World 01 | jump on vulnerable enemy top | active enemy interaction and momentum |

**Do not add** wall-running, grappling, melee combos, shooting or complex platform combat in the first slice. They would compete with learning the core controls. Magnetic rails, wall-running or wall-jump can be evaluated for later worlds.

### B. Micro-action instead of fighting
Use non-threatening **glitch drones** and corrupted data creatures, visually readable and whimsical:
- **Patrol drone:** moves on a fixed spline, telegraphs direction, touching it pushes Levi back slightly; respawn only after a meaningful fall.
- **Scan beam:** predictable timed sweep that Levi can jump over or dash past.
- **Fragile data barrier:** breaks with a dash; teaches the mechanic.
- **Conveyor / moving platform:** carries Levi through a short traversal challenge.
- **Bumper/jump pad:** can be chained with a double jump for a satisfying reward route.

Enemies have one or two behaviors each; no hit points, weapons, combat UI or punishment loop in World 01. Later worlds can introduce a small nonviolent "stun, bypass, bounce" kit.

### C. Actual level design, not abstract floating cubes
Use a coherent architectural space: curved lobby, mezzanine, delivery corridor, overhead service route, garden walkway and elevator atrium. Architectural platforms are believable **balconies, glass paths, loading arms, service lifts, railings, moving walkways and drones**, not dozens of generic suspended cubes.

All interactive items have unambiguous color, movement or silhouette cues. Keep the navigable route at consistent height/scale and readable from the camera. Optional elevated routes hide small energy fragments and short speed-run challenges.

### D. The Excel skill affects the route, not the controller
Worksheet activities occur in **safe stations**, never mid-air or while an enemy attacks. After a small skill is applied, the environment responds:
- Find a record → helper drone lights up the **correct delivery path**.
- Edit a destination cell → a digital sign / transit gate physically redirects the route.
- Sort a queue → moving lifts reorder their stops, opening a fast route.
- Filter by category → powered paths illuminate only the matching corridor; one shortcut opens.
- Later SUM → energy circuits power a mechanical bridge.
- Later PROCV → a code identifies which transit node to connect, revealing the route through a complex data facility.

**Not every platform obstacle requires Excel.** Many encounters exist only for play and discovery. Good players can execute optional skill-based shortcuts; beginners always have an accessible path.

## 2. World 01 minute-to-minute beat sheet

**Suggested target: 12–16 minutes first completion; no forced timer.**

| Beat | Location | Player activity | Spreadsheet exposure | Reward |
|---|---|---|---|---|
| 0 | Garden arrival | Free run, 2 safe jumps, follow helper drone | None | jump mastery / friendly welcome |
| 1 | Lobby reception | Find a specific short ID among 4 records | Recognize row, column, record (M00) | drone reveals route |
| 2 | Curved service hallway | **Dash** through a fragile barrier; avoid first scanning beam | None | first action success |
| 3 | Registration desk | Fix missing cell destination (M01) | Select and edit cell; undo | sign switches, door opens |
| 4 | Mezzanine ascent | Double jump, 1 moving lift, safe fall recovery | None | energy fragments / optional upper route |
| 5 | Queue gallery | Sort four complete records (M02) | Full-row sort | helper drone queue physically rearranges |
| 6 | Overhead logistics lane | Chase a courier drone through platforms and timed barriers | None | satisfying chase, checkpoint |
| 7 | Data atrium | Apply a filter (M03) | Category filter, then clear | glass walkway powered on |
| 8 | Glass walkway → elevator | Short final **action-platform gauntlet**, harmless glitch drones, jump pads | None | celebratory end traversal |
| 9 (optional) | Secret upper balcony | Replay unseen table or pure time trial route | Optional skill transfer (M04) | cosmetic achievement / access to next district |

**Pacing constraints:** between mandatory worksheet encounters there must be ~45–120 seconds of meaningful active play; no more than two instructional interactions back-to-back; first action segment before the first complex worksheet.

## 3. Control, physics, and animation contract

### Input abstraction
Implement action mapping separate from DOM: `move`, `look`, `jump`, `dash`, `sprint`, `interact`, `pause`. Keyboard/mouse, touch and gamepad should be driven through the same controller contract; no browser key codes scattered across gameplay.

For an orbiting third-person camera, map 2D stick/WASD to **camera-relative horizontal movement**, not permanent world-axis directions. Keep player facing in the direction of actual velocity. On desktop, orbit camera with mouse/right drag; on touch, use left movement stick and right-area camera swipe. Allow a reduced-control mode with gentle auto-camera.

### Controller implementation
A capsule or kinematic character controller with robust ground, wall, ceiling, moving-platform and step detection; choose a deliberately small collision abstraction. **Rapier** is a reasonable WebAssembly option if browser performance and Pages static hosting are verified; otherwise implement a bounded simple controller that does not rely on `world.getGroundHeight(x,z)` only.

Starting **tunable** values (not final feel):
- Run speed ≈ 4.8 m/s, sprint ≈ 7.0 m/s.
- Jump height ≈ 1.6–1.9 m under gravity ≈ 23 m/s².
- Double jump height ≈ 1.2–1.5 m; cannot be triggered more than once before landing.
- Air control 65–80% of ground acceleration.
- Coyote time ~100 ms, jump input buffer ~120 ms.
- Dash 0.18–0.25 s, nominal speed ~11 m/s, cooldown ~0.8–1.2 s; avoid invulnerability assumptions.
- Camera smoothing framerate-independent, collision-aware arm, player silhouette always readable.
- Generous automatic checkpoints at every short action section; recover without losing learning progress.

These parameters must be profiled/adjusted on real devices and judged by feel, not accepted as fixed constants.

### Animation state machine
```text
IDLE <-> RUN
          |
        TAKEOFF -> AIR -> DOUBLE_JUMP -> LAND -> RUN/IDLE
          |
         DASH -> AIR or RUN
Any grounded state -> CELEBRATE (short interrupt) -> restore movement
```
Existing GLB animations cover idle, walk, jump and celebrate. For dash, use a temporary procedural body lean, a motion streak and a short trail; avoid "playing walk faster" as the only visual. Preserve character facing and avoid accidental 180-degree yaw reversals.

### Safety/comfort
Never place a required worksheet inside a chase. Disable movement safely while terminal UI holds focus and restore the player input and keyboard focus on close. Provide reduced camera shake, effects and flash, plus optional low-motion mode. Falling gives a fast friendly checkpoint return; don't rewind completed exercises.

## 4. Level metrics and playtest tasks
Level layout is authored, not random. Each encounter uses a **safe route** and an optional **skill route**:
- First jumps: broad platforms; safe fall and immediate return.
- Moving platforms: stationary staging pad and visible motion cycle.
- Dash gap: obvious runway and clear visual landing target.
- Chase: speed tuned for beginners, no "sudden death", 2–3 restart anchors.
- Final gauntlet: combine already taught actions, not introduce new mechanics.

At checkpoints, record only internal local gameplay metrics for debugging; ask before collecting telemetry. Track route attempts, falls per section, skill completion, controller errors and perf on representative devices.

### Acceptance tests
1. Without opening an Excel task, player can enjoy 2–3 minutes of real run/jump/double-jump/dash platforming.
2. Run, jump, double jump, dash, land and camera orbit work on keyboard and touch, and via gamepad if supported.
3. No moonwalking for camera-relative W/A/S/D; avatar orientation follows velocity.
4. Corner clipping, moving-platform carrying and respawn do not corrupt position, animation or camera.
5. Dashing cannot pass through closed doors, locked exercise areas or hard walls.
6. First-time players can clear the normal platform route without time pressure; skill route is optional.
7. Each spreadsheet task changes the 3D route in a visible and mechanically meaningful way.
8. Excel UI never appears without a safe interaction or an explicit pause.
9. Coyote time, buffered jump and dash cooldown have deterministic unit/integration tests.
10. Browser smoke/regression tests cover gameplay navigation and mission state; test 30, 60 and 120 FPS conditions.
11. Validate basic accessibility and touch ergonomics on desktop Safari and mobile Safari.
12. Review playtest footage: platforming is the majority of play time, not "walking between spreadsheets".

## 5. Art + action integration
Author a small set of **high-quality interactive kits** that belong in the architecture: rotating service platforms, glass lift, conveyor, hidden balcony, safety railing, programmable route strips and drones. Animation and audio cues are consistent. Keep motion readable against calm background textures; don't cover active platforms in neon and particles.

A well-polished **single action corridor** is worth more than ten empty low-poly rooms. Reuse assets with authored variations, not copy-pasted primitives.

## 6. Scope and shipping
**World 01 vertical slice must ship the platforming kit and M00–M03 together.** A visually improved lobby with four stationary Excel terminals **does not satisfy** v2. Full PROCV and later world platforming features come after the first 3D action loop proves fun.

This document does not change the currently published POC or claim that any new mechanic is already implemented.
