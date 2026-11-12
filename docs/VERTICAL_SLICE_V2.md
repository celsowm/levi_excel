# World 01 — Recepção Inteligente | Vertical slice specification
**Goal:** replace the first impression of v0.1 with a visually polished **3D action-platform level**, where the learner explores and solves short spreadsheet problems between genuine platforming sequences.  
**Status:** spec only, not implemented.

## Player path (12–16 min first completion target; no timer)

> The path below is the spreadsheet skeleton, **not** the entire gameplay route. Between every worksheet event, insert substantial movement/action encounters as defined in [ACTION_PLATFORM_V2.md](ACTION_PLATFORM_V2.md): safe jumps → dash barrier / scanner → double-jump mezzanine → drone chase → final jump-pad gauntlet. Preserve a 65–70% platforming target and require at least one 2–3-minute segment with no spreadsheet UI.

```text
[ARRIVAL: daylight + garden]
          |
          v
[RECEPTION + HELPER DRONE]  M00 Locate one record
          |
          v
[REGISTRATION COUNTER]     M01 Select and fix one cell
          |
          v
[QUEUE GALLERY]            M02 Sort four complete records
          |
          v
[INTERACTIVE ATRIUM]       M03 Filter one category
          |
          v
[GLASS WALKWAY UNLOCKS]    M04 optional unassisted replay
          |
          v
[ELEVATOR / NEXT WORLD]    Celebrate + preview: SOMA comes later
```
All stations are physically contiguous with readable paths. No full-screen teleport between each task; the world is a navigable hub with a **single coherent piece of architecture**.

## Zone design
1. **Arrival**: large doorway, bright exterior, reflecting pool **outside** only, shallow planters. Levi is clearly framed on an uncluttered walkway. No countdown and no floating platform gap in first 30 seconds.
2. **Reception**: curved concierge desk with in-world small display and helper drone. Distinct marble/wood/graphite palette, large but restrained institutional sign.
3. **Registration counter**: terminal displays a readable 3-column sheet. The first worksheet appears here; a short camera dolly shows where rows/columns are.
4. **Queue gallery**: gentle semicircular atrium, four NPC robot proxies with visible numbered badges. Sort affects their standing order with animation.
5. **Interactive atrium**: select filter from small sheet; overhead lights route to category-labeled entrances.
6. **Walkway**: a mechanically credible short bridge/gate, animated only after M03; avoid "magic bridge appears from nothing" unless the environment fiction clearly establishes it.
7. **Elevator**: end marker and celebration; player can choose another training task without replaying everything.

## Visual production checklist
- Real spatial proportions: doorways, counters, railing height and clearances respect Levi's approximately 2 m avatar scale.
- Architectural assets must have bevels/silhouette detail. Avoid obvious repetitive `BoxGeometry` for every major element.
- Consistent **three-tier material system**: main architecture, tactile props, tiny emissive indicators.
- Lighting baked or simplified where appropriate; one clear key light and a small fixed budget of dynamic lights.
- Maintain visual landmarks readable even without bloom/SSAO.
- Real-time UI uses same spacing, type scale and palette as the environment.
- Concept boards are references to *quality level*; the actual stage is new original authored geometry.

## 4 microchallenges with exact outcomes
| ID | Task | UI interaction | Environment response | Failure behavior |
|---|---|---|---|---|
| M00 | Find ID ATD-104 | Select matching row | Drone flies to its destination | Hint highlights ID column |
| M01 | Fix missing destination | Focus/edit requested cell | Digital sign updates | Undo is available, no penalty |
| M02 | Sort ascending by time | Drag row order / Data > Sort | Four helper drones rearrange | Highlight broken record if mismatch |
| M03 | Filter by category | Filter dropdown / reset | Correct colored route powers on | Incorrect view stays local, hint advances |
| M04 | Optional transfer test | Fresh 6-row dataset | Bonus gallery unlocks | Can retry; no block to finish story |

## Mission timing design
- Start in control within 10 seconds after initial assets have loaded.
- First meaningful success targeted by 60 seconds.
- Each activity targeted at 60–120 seconds, with free exploration between.
- A player may close a terminal at any moment; return to the previous position with controls restored and focus sensible.
- Clear affordance when a mission becomes available; no "find hidden prompt" frustration.

## Avatar & camera feel
- Preserve original Levi with current animation names; no generated replacement.
- Camera at approx shoulder-to-overhead third person, default follow; update in world-local coordinates.
- World-specific smooth collision and occlusion; no hard cuts on keyboard diagonals.
- Walking and running speed tuned against actual ground travel; idle when velocity is near zero.
- Replay test W/S/A/D and controls at 30, 60, 120 fps to avoid dt-dependent feel.

## What the first downloadable pilot should contain
One fully playable **action-platform** level: **M00–M03**, optional M04, **run/jump/double jump/dash**, moving platform, telegraphed scanner, harmless patrol drones, chase, checkpoints, camera-relative movement with collision-aware orbit, final traversal payoff, functional pause/resume, progress save locally, accessibility options, and final skill summary. Optional safe dataset export. No backend necessary.

## Explicitly reject in this slice
No boss fight, no "SUM" inside the first five minutes, no sprawling warehouse, no dozens of identical platforms, no giant translucent blue exercise modals, no forced tutorial text screens, no hidden answer validation.
