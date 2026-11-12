# LEVI Excel — v2 implementation plan for Codex
**Repository:** `celsowm/levi_excel`  
**Target branch:** `main` (project owner preference; avoid long-lived compatibility scaffolding)  
**Primary objective:** replace the v0.1 look and teaching flow with the World 01 vertical slice defined in `GAME_DESIGN_V2.md`, `VERTICAL_SLICE_V2.md` and `EXCEL_CURRICULUM_V2.md`.

> This is a **plan**, not a claim that the redesign is already implemented. Keep the deployed playable build working until each new milestone satisfies its exit gates.

## A. Baseline audit (as of 2026-11-12)
| Existing file | What it does now | v2 refactor direction |
|---|---|---|
| `src/main.js` | Owns renderer, game lifecycle, movement, camera, game state, interactions and DOM | Thin bootstrap + application states + controllers |
| `src/world.js` | 3D environment, materials, architecture, puzzle objects, collectibles, ground query all together | Modular world scenes, asset-loading, interaction triggers, collision and scene transitions |
| `src/character.js` | Loads original GLB, controls animations and model yaw | Keep original model, dedicated actor + animation state machine |
| `src/movement.js` | Pure direction/yaw/smoothing helpers with unit tests | Reuse as tested math; extend with controller collision and camera support |
| `src/missions.js` | Inline static datasets + formula evaluation + DOM popup wiring | Separate mission definitions, workbook data/model, evaluator and UI views |
| `index.html` | Intro, HUD, full-screen dialogs and ending | Accessible UI shell, minimised HUD, terminal view that matches scene |
| `src/style.css` | One large global stylesheet | Tokenised, component-scoped layers; responsive terminal styles |
| `tests/missions.test.js` | Small formula coverage | Learning tasks, workbook operations, lookup edge cases and progression tests |
| `tests/movement.test.js` | W/S/A/D, yaw and smoothing regression tests | Preserve and expand |
| `vite.config.js` | Uses `/levi_excel/` on Pages builds | Preserve exactly |
| `scripts/restore-model.mjs` | Reconstructs original `levi.glb` from compressed parts and validates hash | Preserve exactly, avoid committing a different mascot |
| `.github/workflows/pages.yml` | CI/build and deploy on push to `main` | Preserve; add checks before deploy when feasible |

**Current weaknesses to fix, not just hide:** primitive-heavy unart-directed geometry; more than one source of truth for quest state; world and curriculum hardwired together; formula exercise shown too soon; feedback tied to a modal; no advanced spreadsheet engine; no browser integration tests.

## B. Proposed module boundaries
```text
src/
  app/
    bootstrap.js
    game-state.js              # finite gameplay states; one authoritative source
    save-store.js              # versioned local progress; safe migration
  engine/
    asset-loader.js            # glTF loading, explicit errors and progress
    input-controller.js        # keyboard, pointer, touch, focus discipline
    player-controller.js       # horizontal motion, gravity, collision, triggers
    follow-camera.js           # framing, smoothing, occlusion
    audio.js                   # SFX/music, mute control
  actors/
    levi.js                    # original model, animations, yaw calibration
    helper-drone.js
  world/
    scene-manager.js
    lobby/
      layout.js
      materials.js
      props.js
      interactions.js
      lighting.js
  learning/
    mission-registry.js        # declarative IDs, prerequisites and criteria
    curriculum.js
    progression.js
    workbook.js                # tabular records, cell selection/edit, sort/filter
    expression-engine.js       # consciously limited formula evaluator
    validators.js              # semantic validation, not hardcoded UI answer
    datasets/
      reception.js
      archive.js
  ui/
    hud.js
    terminal.js
    worksheet-grid.js
    notifications.js
    styles/
      tokens.css
      hud.css
      terminal.css
tests/
  learning/
  movement/
  integration/
docs/
  GAME_DESIGN_V2.md
  EXCEL_CURRICULUM_V2.md
  VERTICAL_SLICE_V2.md
  IMPLEMENTATION_PLAN_V2.md
```
This is a target structure, not a mandate to create empty files. Use clear responsibilities and avoid premature abstractions.

## C. Domain contracts and data flow
Keep the workbook **independent of DOM and Three.js** so it is testable and can later export XLSX.

Suggested mission contract:
```js
{
  id: 'reception.sort-queue',
  stage: 2,
  skillIds: ['sort.ascending'],
  prerequisites: ['reception.edit-label'],
  datasetId: 'reception.visits.v1',
  successCriteria: { operation: 'sort', field: 'time', order: 'asc', preserveRecords: true },
  hintLevels: ['Look at the Time column', 'Use ascending sort', 'See an example'],
  worldAction: 'queue.animateOrder',
  transferTaskId: 'reception.sort-queue.transfer'
}
```
All `worldAction` references resolve through a registry of **trusted gameplay callbacks**, never evaluated as code. The worksheet model exposes `selectCell`, `editCell`, `undo`, `sortRows`, `filterRows`, `resetFilter`, `getVisibleRows` and `getCell`. Worksheet UI only dispatches domain operations and displays state.

Strongly prefer semantic validators:
- Sorting checks keys **and** that whole records stayed together.
- Filtering checks included row IDs and that hidden rows are not deleted.
- Formula evaluation validates computed values and references rather than exact typed strings.
- PROCV checks exact-match behavior, range orientation, missing-key result and selected return column.

Do **not** use `eval`/`Function`, raw `innerHTML` for learner input, or arbitrary formula execution. Use a small parsed, allowlisted function subset initially. If considering a 3rd-party formula engine, audit its licensing, locale support, size and browser footprint first.

### Excel locale correctness
- `=SOMA(C2:C5)` (expect 32).
- `=SE(C2<5;"Urgente";"No prazo")`.
- `=PROCV(E2;A2:C6;3;FALSO)`, default exact match for this exercise.
- `=PROCX(E2;A2:A6;C2:C6;"Não encontrado")` as optional end-game.
- Preserve cell types, blanks, duplicates and missing keys; show `#N/D` where appropriate.
- Explicitly communicate simulator limitations; maintain fixtures tested against intended Excel semantics.

## D. Implementation phases with exit gates

### P0 — Establish safe baseline & benchmark
**Tasks**
- Preserve the current working game on `main`; record screenshots and video of current startup, controls and all two existing missions.
- Add a programmatic build-size report and at least a minimal browser smoke test for initial GLB load and no console errors (Playwright as dev-only dependency is reasonable).
- Capture performance on desktop Safari and at least one mid-tier mobile device; confirm current bottlenecks rather than guessing.
- Record versioned project goals in README and link all v2 design docs.

**Exit:** `npm test`, `npm run build`, Pages deployment and the original 3D model load remain green.

### P1 — Decouple gameplay and spreadsheet systems
**Tasks**
- Extract app state, input, player and camera from `src/main.js` in small atomic changes.
- Extract mission data, evaluator and UI out of `src/missions.js`; retain current missions as legacy content during transition.
- Build `Workbook`, action log and undo/redo; add data-driven `MissionRegistry` with deterministic validators.
- Introduce a single "experience" entry point; development preview may use `?experience=v2` until complete. Avoid permanent dual-mode complexity after rollout.
- Define semantic progress/skill IDs and safe versioned localStorage format (no identity data).

**Exit:** old POC remains playable; tests pass; new learning unit tests cover selection, edit, sorting, filtering, undo and non-mutation of source data.

### P2 — Art-directed lobby and gameplay polish
**Tasks**
- Greybox the World 01 arrival/reception/counter/gallery/atrium/walkway/elevator route.
- Author reusable **beveled modular** meshes and a small shared material palette; use instancing where repetitive.
- Build high-quality lobby architectural details (curved desk, walls, skylight, balcony, vegetation, signage, large navigation landmarks).
- Tune physically believable shading, daylight and tone mapping. Restrict glowing materials to interaction states.
- Replace floating numbers/blocks with believable props and small distinct helper robots.
- Add reliable character collision volumes, grounded movement, jump tuning, interaction triggers, coyote time if necessary and controlled camera occlusion.
- Preserve original `levi.glb` and animation naming; fix perceived feet-sliding by testing travel distance and animation cycles.

**Exit:** stage is clearly more professional than v0.1 before teaching interactions are added; player can traverse without clipping, invisible collisions, accidental pits or motion discomfort.

### P3 — First four learn-by-doing missions
**Tasks**
- M00 find `ATD-104` in an extremely small table, without a formula.
- M01 select/edit one cell, with undo.
- M02 sort 4 records, preserving row integrity; physical queue of drones reorders.
- M03 simple filter on one named category; walkway opens.
- Add optional M04 unseen-table assessment.
- Switch worksheet UI between context mode and realistic grid mode, with clear keyboard/focus paths.
- Progressive hint system with 3 tiers and no arbitrary failure penalties.
- Feedback in-scene (drone movement, signs, lights, gate), not just a success toast.

**Exit:** an absolute beginner can finish the slice using discoverable UI without typing any formula.

### P4 — Progressive Excel worlds, one skill at a time
**Tasks**
- Archive: SUM, cell ranges, copy/fill and relative references.
- Energy Center: average, percentages and counts.
- Decisions: SE and conditional counting.
- Identifiers: PROCV exact-match across two tables; missing-key error behavior.
- Optional PROCX bonus for compatible Office versions.
- Export selected safe practice sheets as .xlsx and include equivalent instructions for actual Excel.

**Exit:** the evaluator passes boundary cases and a learner can reproduce the skill without step-by-step prompts.

### P5 — Pilot quality gate and launch
**Tasks**
- Test desktop Safari/WebKit + Chromium + Firefox; touch controls on representative Android/iOS widths.
- Visual regression screenshots for at least intro, M00, worksheet, M03, victory and post-reset.
- Instrument optional **aggregate, privacy-respecting** pilot events only with explicit consent (never collect personal identifiers or real institutional data).
- Ask actual FIA/educator participants to complete first level; refine friction and explanations.
- Update README screenshots, accessibility guide, lessons and performance notes.

**Exit:** all acceptance criteria below satisfied, with evidence.

## E. Performance guidance (budgets, not claims)
Start with a target of 60 fps desktop and >= 30 fps mid-range mobile. Measure rather than assuming. Track draw calls, triangles, textures, GPU memory and total transferred bytes. Keep high-DPI pixel ratio capped adaptively; avoid full-res post-processing on mobile; use texture atlases, LOD where justified, geometry instancing and selective shadows.

Model preservation: do **not** decimate the original Levi until a measured mobile performance reason; if a mobile LOD is created, it must be derived from the original and visibly faithful. No alternate mascot.

## F. Automated testing matrix
| Test category | Required tests |
|---|---|
| Movement | W/S/A/D, diagonal normalization, right-facing yaw, camera smoothing, respawn and no controls while terminal open |
| Workbook | Row/column identification, select/edit/undo, stable sorts, filters never delete rows, duplicate values, blank cells |
| Curriculum | Prerequisites, guided vs independent completion, persistence, migration/versioning |
| Formulas | SUM range, SE threshold boundary, CONT.SE selection, PROCV exact/missing/duplicate, PROCX optional |
| Browser smoke | Site mounts, original Levi GLB loads, start button works, M00 completes, bridge/gate unlocks, no console errors |
| UI/a11y | Keyboard traversal/focus restoration, readable terminal on mobile, reduced motion, touch target size |
| Build/Pages | `npm test`, `npm run build`, `dist/index.html`, `dist/levi.glb`, correct `/levi_excel/` base |

All CI must remain compatible with GitHub Pages deployment on `main`. Avoid moving to a server-required architecture without an explicit reason.

## G. Prioritized backlog — small deliverable slices
| ID | Priority | Area | Outcome | Dependency |
|---|---|---|---|---|
| V2-01 | P0 | Tech | Baseline screenshots and smoke-test scaffold | — |
| V2-02 | P0 | Architecture | AppState and lifecycle extracted | V2-01 |
| V2-03 | P0 | Learning | Pure workbook model, selection/edit/undo | V2-02 |
| V2-04 | P0 | Learning | Sort/filter semantic validators | V2-03 |
| V2-05 | P0 | Character | Stable actor/controller/camera and regression tests | V2-02 |
| V2-06 | P0 | Art | Greybox World 01 layout with landmarks | V2-05 |
| V2-07 | P0 | Art | Real visual art pass and cohesive lighting | V2-06 |
| V2-08 | P0 | UI | Diegetic worksheet grid, focus + touch | V2-03, V2-07 |
| V2-09 | P0 | Missions | M00 + M01 | V2-08 |
| V2-10 | P0 | Missions | M02 + M03 + world reactions | V2-04, V2-09 |
| V2-11 | P1 | Assessment | M04 optional transfer task and skill summary | V2-10 |
| V2-12 | P1 | QA | Browser regression, perf checks, accessibility | V2-11 |
| V2-13 | P1 | Excel | SUM + ranges + copy references | V2-12 |
| V2-14 | P1 | Excel | Conditional formulas + aggregated counting | V2-13 |
| V2-15 | P1 | Excel | PROCV exact lookup, missing keys, error cases | V2-14 |
| V2-16 | P2 | Excel | PROCX bonus and .xlsx export | V2-15 |

**Priority discipline:** do not start V2-13+ before v2 World 01 is polished and validated. Avoid placeholder "more content" without art/pedagogy improvements.

## H. Release acceptance checklist
- [ ] Original Levi appears with right facing direction and animations, without moonwalking.
- [ ] A brand-new player can finish World 01 without encountering a required formula.
- [ ] Every task has matching world response and an equivalent spreadsheet operation.
- [ ] Sorting does not tear rows apart; filtering never mutates source data.
- [ ] Learners can revisit any completed task; progress survives reload.
- [ ] The interface is readable and controllable on Safari desktop and touch mobile.
- [ ] No third-party assets without documented rights.
- [ ] `npm test` and `npm run build` pass; GitHub Actions Pages deployment succeeds.
- [ ] Screenshots demonstrate art direction improvement over POC v0.1.
- [ ] Performance is measured and documented, not merely asserted.

## I. Codex start instructions (copy/paste)
```text
Work in celsowm/levi_excel on main. Read docs/GAME_DESIGN_V2.md,
docs/VERTICAL_SLICE_V2.md, docs/EXCEL_CURRICULUM_V2.md, and
docs/IMPLEMENTATION_PLAN_V2.md before touching code.

Start only with P0 + P1 and the initial World 01 greybox. Maintain
a playable GitHub Pages build. Preserve the original Levi GLB,
its animation clips, scripts/restore-model.mjs, and the Pages base URL.
Fix architecture, worksheet operations and navigation first; do not add
new formula exercises or excessive primitive neon props.

Use deterministic unit tests and a browser smoke test; verify npm test
and npm run build, commit directly to main with clean commits and report
which acceptance checks were actually executed.
```
