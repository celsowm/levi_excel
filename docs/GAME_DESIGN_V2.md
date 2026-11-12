# LEVI — Operação Planilha | Game Design v2
**Status:** approved design direction / implementation proposal  
**Audience:** jovens FIA da PGE-RJ, from first contact with spreadsheets to PROCV  
**Language:** Portuguese (Brazil)  
**Target:** responsive browser game deployed to GitHub Pages  
**Scope:** redesign the experience, not just re-skin the v0.1

## 1. Product thesis
LEVI must be a satisfying third-person 3D adventure first, and a **genuine introduction to spreadsheet literacy** second. The spreadsheet is a practical tool inside the fiction, not a disconnected exam. The player should learn to use a grid, manipulate datasets and progressively type actual Excel formulas.

### Four non-negotiable pillars
1. **Polished play:** a responsive original Levi character, readable camera, short explorable route, delightful feedback and non-punitive failure.
2. **Meaningful spreadsheets:** each real-world data operation has a visible consequence in the 3D world; no trivia quizzes or arbitrary "correct answer" gates.
3. **Gradual progression:** recognize rows and columns **before** sorting, filtering, formulas, references, conditional logic and PROCV.
4. **Transfer to work:** after an in-world tutorial, players repeat the skill in a near-real spreadsheet UI and optionally export a sanitized .xlsx exercise.

### Not in scope
- A complete Microsoft Excel emulator.
- Real PGE case data or integration with institutional systems.
- Complex combat, public leaderboards, competitive grading, procedural open world.
- Heavy visual effects at the expense of playable frame rates.
- Fake "learn Excel" tasks solved merely by selecting an obvious multiple-choice answer.

## 2. Story & player fantasy
A wave of corrupted information has disconnected the PGE's fictional Data Network. Levi is an already beloved helper robot (the original `levi.glb`, not a replacement mascot). The player explores a stylized institutional technology campus, learns how information flows, and restores the system.

The first level starts on a **calm, bright day**. It is not an emergency from the first second. A little helper drone is missing a destination: a friendly problem the player can solve without time pressure. Only after understanding simple records do small data faults appear.

### Emotional arc of the vertical slice (8–12 minutes)
1. Wonder: see the clean, elegant lobby and freely move Levi.
2. Confidence: identify one matching record without having to type anything.
3. Agency: rearrange data and discover cause-and-effect.
4. Mastery: use a simple filter and unlock the next part of the building.
5. Reward: memorable environmental transformation, charming celebration, a new unlocked training district.
6. Retention: the player leaves knowing **what a row, column, header, record, sort and filter are**.

## 3. Art direction: "PGE Digital Tomorrow"
Not a primitive cube playground and not a nightclub full of competing neon. A coherent premium stylized environment:

- **Architecture:** flowing lobby, curved reception desk, layered mezzanine, tall windows, soft natural daylight; gently futuristic, recognizable as a civic institution, not a replica of the actual PGE building.
- **Palette:** ivory/off-white stone, graphite and desaturated navy, warm wood/copper, vegetation. Cyan or mint for **interactive and working** systems; amber for **pending**; restrained magenta only for **corruption**.
- **Materials:** limited believable roughness/metallic range; visible trim, seams, bevels, anti-repetition variations and authored props. Avoid repetitive BoxGeometry corridors.
- **Lighting:** clear daytime key light, soft shadows, controlled emissive accents, warm-cool contrast. Avoid excessive bloom and reflective floor mirror effects.
- **Shapes:** 3–5 distinctive landmarks per zone (reception, data sculpture, archive carousel, glass elevator, central garden). Different silhouette and color value for each.
- **Composition:** every camera shot needs an obvious navigation destination and a foreground–midground–background hierarchy. No clutter obscuring Levi.
- **Identity:** use PGE-RJ-inspired signage sparingly and legibly; avoid suggesting official authorization or replicating sensitive floor plans.
- **Visual effects:** brief pulses, scan trails, controlled data particles and smooth mechanical transitions tied to a solved problem, not constant fireworks.

### Asset production rule
Keep blockout grey until an art pass with consistent authored modular architecture/props. All included third-party asset licenses must be checked and recorded. Optimize glTF files and reuse instanced materials/geometry. The original Levi GLB stays intact.

### Scene reference boards
See `art/concepts/` for mood only, **not** blueprints. The intended finish is deliberately less saturated and more coherent than the current images and v0.1 scene.

## 4. Core gameplay loop
**Observe → Explore → Identify a data problem → Interact with the sheet → See immediate world response → Apply the skill again → Progress.**

A task should have two parts:
- **Discovery mode:** immersive diegetic visualization, drag/drop, highlighted records, physical consequences.
- **Spreadsheet mode:** a real grid representation (headers, cell coordinates, row indices, selection and formula bar when appropriate); gradually expose authentic Excel syntax.

Do not hide Excel forever behind colorful puzzles; players must recognize and reproduce an actual spreadsheet workflow.

## 5. How the UI should feel
- Exploration HUD: objective in one concise line, discreet interaction hint, clear target icon, progress tucked into a corner. No debug-looking giant dashboard.
- Interactions: a terminal camera dollies in, freezes the player safely and overlays a well-designed spreadsheet panel anchored visually to the console. Close returns to the same world location.
- Grid: accessible keyboard navigation, sensible focus, cell coordinates, editable headers, proper scrolling and responsive touch UI.
- Assistance: gentle optional hints, reveal first the relevant **column**, then the **operation**, then a worked example. Never gate players behind unnecessary penalties.
- Accessibility: full keyboard navigation for worksheet tasks, readable contrast, scalable type, motion reduction option, subtitles, large touch targets; no color-only signal.
- Feedback: no artificial countdown in introductory missions; show why an answer is correct, not only a green tick.

## 6. Worlds (long-term)
| World | Fictional setting | What is actually learned |
|---|---|---|
| 01 — Recepção Inteligente | Bright civic lobby and visitor flow | Rows, columns, selections, organizing, sorting, basic filters |
| 02 — Arquivo Dinâmico | Shelves, drones and card catalogs | Filters, data integrity, SUM, ranges, absolute/relative references |
| 03 — Central de Energia | Machinery and resource distribution | AVERAGE/MÉDIA, percentages, formatting, counts |
| 04 — Torre de Decisões | Sector dashboards and visual pathways | SE, CONT.SE, SOMASE, charts |
| 05 — Rede de Identificadores | Matching codes across two datasets | PROCV with exact match, not-found, PROCX bonus |

## 7. Player controls and camera
Preserve the orientation fix from commit `3842740`: original Levi faces +Z. Build a future-proof `PlayerController` and `FollowCamera`, not more direct state mutations inside `main.js`.

- Movement normalized across diagonals; no moonwalking and no sudden 180° visual reversal.
- Jump responds to button down, coyote time/buffer optional after baseline, no accidental falling through a newly unlocked bridge.
- Camera third-person with stable follow target, clear occlusion policy, adjustable distance, no dramatic swing while working in terminals.
- Animation state machine uses original clips (`Parado`, `Andar`, `Pular`, `Acenar`, `Dancar`, `Comemorar`), cross-fades and foot-motion synchronized to speed.
- Add interaction distance, actual collision volumes and gentle environmental guidance; avoid hardcoded character/world logic in a single frame function.

## 8. Reward & progression
Reward *competence*, not grinding. Individual achievements for using a new spreadsheet skill; optional exploration secrets and cosmetic console themes. No public ranking that shames slower learners. Save local progress with versioned schema; reset and re-play accessible.

Progress from hands-on selection to formula typing:
**row/column → record → select → sort → filter → SUM/SOMA → references → average/percent → conditional formulas → PROCV (then PROCX).**

## 9. Learning and success criteria
Target validation with FIA learners and educators, not just developer opinions.

- 80% of pilot users can finish the introduction without unsolicited adult assistance (target, not current measurement).
- Players can name row/column and correctly sort/filter a small unseen table after the first level.
- Median first meaningful interaction happens in < 60 seconds (target).
- At least one skill is repeated in spreadsheet mode before it is considered learned.
- No major keyboard-focus trap or unexplained failure in Safari, Chrome and mobile browsers.
- Record only aggregate opt-in pilot feedback. No personal names, public performance or real process IDs in demo datasets.

## 10. Decision
Build the **World 01 vertical slice**, art-first and pedagogy-first, before extending worlds. Preserve current POC and GitHub Pages as baseline until v2 passes acceptance gates. Development should not imply an already finished v2 playable game.
