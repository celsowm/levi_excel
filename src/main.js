import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createLevi } from './character.js';
import { readMovementInput } from './movement.js';
import { setupScene, loadStage } from './stage.js';
import { createPlayer } from './player.js';
import { createSheetPanel } from './sheet-ui.js';
import { MISSIONS, STAGES, stageById } from './campaign.js';
import { createRun, createSave, medal, formatTime } from './progress.js';
import './style.css';
import './sheet-ui.css';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
// Architecture lighting is baked in Blender; Levi grounds himself with a blob shadow.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 160);
setupScene(scene, renderer);
const levi = createLevi(scene);
// Multisampled HDR target keeps edges clean while light strips feed the bloom.
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight,
  { type: THREE.HalfFloatType, samples: 4 }));
composer.setPixelRatio(renderer.getPixelRatio());
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.38, 0.45, 1.6));
composer.addPass(new OutputPass());
const blobShadow = createBlobShadow();
scene.add(blobShadow);
const clock = new THREE.Clock();
const save = createSave();

// mode: menu | loading | playing | paused | sheet | results
const game = { mode: 'menu', stage: null, run: null, player: null, toastTimeout: null, near: null, told: new Set() };
const pressed = new Set();
const touch = new Set();
const queued = { jump: false, dash: false, interact: false };
const cameraTarget = new THREE.Vector3();
const cameraAim = new THREE.Vector3();
const cameraAimTarget = new THREE.Vector3();
const projected = new THREE.Vector3();
let cameraYaw = 0;
let cameraPitch = 0.36;
let orbitPointer = null;
let elapsed = 0;

const panel = createSheetPanel($('#sheet-panel'), {
  onSolve(missionId) {
    const goal = game.run.solveMission(missionId);
    levi.play('Comemorar');
    const mission = MISSIONS[missionId];
    toast(goal ? `${mission.code} CONCLUÍDA · ${mission.skill.toUpperCase()}` : `DESAFIO DO MESTRE CONCLUÍDO! ${mission.skill}`, 4200);
    updateObjective();
  },
  onClose() {
    pressed.clear();
    touch.clear();
    if (game.mode === 'sheet') game.mode = 'playing';
  },
});

function toast(message, duration = 3300) {
  const target = $('#toast');
  target.textContent = message;
  target.classList.remove('hidden');
  if (game.toastTimeout) clearTimeout(game.toastTimeout);
  game.toastTimeout = setTimeout(() => target.classList.add('hidden'), duration);
}
const once = (key, message, duration) => {
  if (game.told.has(key)) return;
  game.told.add(key);
  toast(message, duration);
};

// ------------------------------------------------------------------ stage flow
function renderStageSelect() {
  const list = $('#stage-select');
  list.innerHTML = STAGES.map((s, i) => {
    const unlocked = save.isUnlocked(s.id);
    const best = save.data.best[s.id];
    const played = best !== undefined;
    const cubes = save.data.cubes[s.id]?.length ?? 0;
    const secrets = save.data.secrets[s.id]?.length ?? 0;
    return `<article class="stage-card${unlocked ? '' : ' locked'}">
      <span class="stage-num">${s.id}</span>
      <div class="stage-info"><strong>${s.name}</strong><small>${unlocked ? s.intro : 'Conclua a fase anterior para liberar.'}</small>
        ${played ? `<span class="stage-stats">◆ ${cubes} · ★ ${secrets}${best ? ` · ◷ ${formatTime(best)} (${medal(best, s.par)})` : ''}</span>` : ''}</div>
      <div class="stage-buttons">
        <button type="button" class="primary-btn small" data-play="${s.id}" ${unlocked ? '' : 'disabled'}>${i === 0 && !played ? 'INICIAR' : 'JOGAR'}</button>
        ${played ? `<button type="button" class="ghost-btn" data-trial="${s.id}" title="Missões já resolvidas: só a corrida">◷</button>` : ''}
      </div></article>`;
  }).join('');
}

async function startStage(id, { timeTrial = false } = {}) {
  game.mode = 'loading';
  panel.close();
  for (const id of ['#intro', '#results', '#pause', '#hud', '#marker', '#prompt']) $(id).classList.add('hidden');
  $('#loading').classList.remove('hidden');
  $('#loading-detail').textContent = `Fase ${id} · ${stageById(id).name}`;
  game.stage?.dispose();
  game.stage = null;
  const stage = await loadStage(id, scene, renderer);
  const run = createRun(id, { timeTrial });
  run.flags.goalsDone = run.done;
  game.stage = stage;
  game.run = run;
  game.player = createPlayer(stage);
  game.player.placeAt(stage.spawn);
  game.told = new Set();
  cameraYaw = stage.spawn.yaw;
  cameraPitch = 0.36;
  levi.root.position.set(stage.spawn.x, stage.spawn.y, stage.spawn.z);
  levi.root.rotation.y = cameraYaw + Math.PI;
  camera.position.set(stage.spawn.x + Math.sin(cameraYaw) * 7, stage.spawn.y + 4, stage.spawn.z + Math.cos(cameraYaw) * 7);
  cameraAim.set(stage.spawn.x, stage.spawn.y + 1.5, stage.spawn.z);
  stage.update(0, 0, run.flags, game.player.state);

  $('#hud-stage').textContent = id;
  $('#hud-stage-name').textContent = stage.data.name.toUpperCase();
  $('#cubes').textContent = '0';
  $('#cubes-total').textContent = `/ ${stage.totals.cubes}`;
  $('#secrets').textContent = '0';
  $('#secrets-total').textContent = `/ ${stage.totals.secrets}`;
  $('#hud').classList.toggle('trial', timeTrial);
  $('#loading').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  if (matchMedia('(pointer: coarse)').matches) $('#touch-controls').classList.remove('hidden');
  else {
    $('#controls-help').classList.remove('hidden', 'collapsed');
    setTimeout(() => $('#controls-help').classList.add('collapsed'), 9000);
  }
  updateObjective();
  toast(timeTrial ? `CONTRA O RELÓGIO · ouro em ${formatTime(run.stage.par)}. Vai!` : `${id} · ${run.stage.intro}`, 5200);
  game.mode = 'playing';
}

function updateObjective() {
  const goal = game.run.currentGoal();
  $('#objective').textContent = goal ? goal.objective : 'Fase concluída!';
  $('#hud-goal-tag').textContent = goal ? goal.label : 'CONCLUÍDO';
}

// Where the current goal lives in the world (for the marker and the prompt).
function goalTarget() {
  const goal = game.run?.currentGoal();
  if (!goal) return null;
  const { entities } = game.stage;
  const e = goal.kind === 'mission'
    ? entities.list.find((x) => x.type === 'terminal' && x.mission === goal.mission)
    : entities.byId.get(goal.entity);
  return e ? { x: e.x, y: (e.y ?? 0) + (goal.kind === 'mission' ? 3.2 : 2.2), z: e.z, label: goal.label } : null;
}

function finishStage() {
  const { run, stage } = game;
  run.finished = true;
  game.mode = 'results';
  levi.play('Comemorar');
  const result = save.recordRun(run, stage.totals);
  $('#results-title').textContent = `${run.stage.id} · ${run.stage.name}`;
  $('#results-eyebrow').textContent = run.stage.next ? '✦ FASE CONCLUÍDA ✦' : '✦ WORLD 01 CONCLUÍDO ✦';
  $('#results-time').textContent = formatTime(run.time);
  const m = medal(run.time, run.stage.par);
  $('#results-medal').textContent = run.timeTrial ? `${m.toUpperCase()}${result.record ? ' · RECORDE!' : ''}` : `ouro em ${formatTime(run.stage.par)} no contra o relógio`;
  $('#results-medal').className = `medal ${run.timeTrial ? m : ''}`;
  $('#results-cubes').textContent = `${run.cubes.size} / ${stage.totals.cubes}`;
  $('#results-secrets').textContent = `${run.secrets.size} / ${stage.totals.secrets}`;
  $('#results-skills').innerHTML = run.stage.goals.filter((g) => g.mission)
    .map((g) => `<span>✓ ${MISSIONS[g.mission].skill.toUpperCase()}</span>`).join('') +
    (run.flags.mastery ? '<span>★ MESTRE DOS DADOS</span>' : '');
  $('#results-next').classList.toggle('hidden', !run.stage.next);
  for (const id of ['#hud', '#marker', '#prompt', '#touch-controls', '#controls-help']) $(id).classList.add('hidden');
  $('#results').classList.remove('hidden');
}

function showMenu() {
  game.mode = 'menu';
  panel.close();
  renderStageSelect();
  for (const id of ['#results', '#pause', '#hud', '#marker', '#prompt', '#touch-controls', '#controls-help']) $(id).classList.add('hidden');
  $('#intro').classList.remove('hidden');
}

function setPaused(paused) {
  if (paused && game.mode === 'playing') {
    game.mode = 'paused';
    $('#pause-stage').textContent = game.run.stage.id;
    $('#pause').classList.remove('hidden');
    pressed.clear();
  } else if (!paused && game.mode === 'paused') {
    game.mode = 'playing';
    $('#pause').classList.add('hidden');
  }
}

function respawn(message) {
  const spot = game.run.checkpoint ?? game.stage.spawn;
  game.player.placeAt(spot);
  levi.root.position.set(spot.x, spot.y, spot.z);
  if (message) toast(message, 2400);
}

// ------------------------------------------------------------------ gameplay
function handleEvents(events) {
  const { run } = game;
  for (const ev of events) {
    switch (ev.type) {
      case 'cube':
        run.cubes.add(ev.id);
        $('#cubes').textContent = String(run.cubes.size);
        if (run.cubes.size === game.stage.totals.cubes) toast('TODOS OS CUBOS DESTA FASE! ◆', 3000);
        break;
      case 'secret':
        run.secrets.add(ev.id);
        $('#secrets').textContent = String(run.secrets.size);
        levi.play('Comemorar');
        toast(`★ SEGREDO ENCONTRADO: ${ev.label ?? ev.id}`, 3600);
        break;
      case 'checkpoint':
        if (!ev.entity.reached) {
          ev.entity.reached = true;
          if (ev.id !== 'start' && ev.id !== 'portico') toast('CHECKPOINT ✓', 1500);
        }
        run.checkpoint = { x: ev.entity.x, y: ev.entity.y, z: ev.entity.z };
        break;
      case 'barrier': toast('BARREIRA ROMPIDA!', 1600); break;
      case 'pad': once('pad', 'IMPULSO! Aperte Espaço no ar para o salto duplo.', 2600); break;
      case 'fan': once('fan', 'Coluna de ar! Solte-se para cima e vá até a sacada.', 2600); break;
      case 'bump': once('bump', 'Cuidado com os drones-sentinela: eles empurram o Levi.', 2600); break;
      case 'zap': respawn('O scanner detectou o Levi! Pule por cima do feixe.'); return;
      case 'fall': respawn('Levi voltou ao último checkpoint.'); return;
      default: break;
    }
  }
}

function updateInteraction() {
  const { run, stage, player } = game;
  const p = player.state;
  game.near = null;
  for (const e of stage.entities.ofType('terminal')) {
    if (Math.hypot(p.x - e.x, p.z - e.z) < (e.radius ?? 3) && Math.abs(p.y - e.y) < 2.5) game.near = e;
  }
  // The follow goal completes when the courier drone reaches the end with Levi.
  const goal = run.currentGoal();
  if (goal?.kind === 'follow' && stage.entities.byId.get(goal.entity)?.arrived) {
    run.completeGoal(goal.id);
    toast('ENTREGA FEITA! O drone abriu o terminal da passarela.', 3600);
    updateObjective();
  }
  stage.setExitOpen(run.exitOpen());
  const exit = stage.entities.ofType('exit')[0];
  if (exit && run.exitOpen() && exit.near(p, exit.radius ?? 1.7, 2.6)) {
    run.completeGoal('exit');
    finishStage();
    return;
  }
  const prompt = $('#prompt');
  const state = game.near ? run.missionState(game.near.mission) : null;
  if (game.near && state !== 'solved') {
    const mission = MISSIONS[game.near.mission];
    $('#prompt-text').textContent = state === 'open'
      ? `ABRIR TERMINAL · ${mission.title.toUpperCase()}`
      : `BLOQUEADO · ${run.currentGoal()?.label ?? ''} PRIMEIRO`;
    prompt.classList.toggle('locked', state !== 'open');
    prompt.classList.remove('hidden');
    $('#touch-interact').classList.toggle('available', state === 'open');
    if (queued.interact && state === 'open') {
      game.mode = 'sheet';
      pressed.clear();
      touch.clear();
      prompt.classList.add('hidden');
      panel.open(run, game.near.mission);
    }
  } else {
    prompt.classList.add('hidden');
    $('#touch-interact').classList.remove('available');
  }
}

function playerInput() {
  const down = (key) => pressed.has(key) || touch.has(key);
  const keys = readMovementInput(down);
  const input = { x: keys.x, z: keys.z, yaw: cameraYaw, sprint: down('ShiftLeft') || down('ShiftRight'),
    jump: queued.jump, dash: queued.dash };
  queued.jump = queued.dash = false;
  return input;
}

function updatePlayer(dt) {
  const input = playerInput();
  const result = game.player.step(dt, input, game.run.flags);
  const p = game.player.state;
  handleEvents(result.events);
  levi.root.position.set(p.x, p.y, p.z);
  levi.face({ x: p.vx, z: p.vz }, dt);
  levi.update(dt, result.moving, !p.grounded, input.sprint, false, result.dashing);
  const t = p.traversal;
  const readiness = $('#dash-ready');
  readiness.textContent = t.cooldown > 0 ? `DASH ${t.cooldown.toFixed(1)}s` : 'DASH PRONTO';
  readiness.classList.toggle('cooling', t.cooldown > 0);
}

function updateCamera(dt) {
  const p = game.player.state;
  const view = game.mode === 'sheet' ? game.near?.view : null;
  if (view) {
    // Terminal view: frame what the spreadsheet controls, beside the docked panel.
    cameraTarget.set(...view.pos);
    cameraAimTarget.set(...view.look);
  } else {
    const dist = innerWidth < 700 ? 7.9 : 7.1;
    const horizontal = Math.cos(cameraPitch) * dist;
    cameraAimTarget.set(p.x, p.y + 1.48, p.z);
    cameraTarget.set(p.x + Math.sin(cameraYaw) * horizontal, p.y + 1.45 + Math.sin(cameraPitch) * dist,
      p.z + Math.cos(cameraYaw) * horizontal);
    const corrected = game.stage.level.resolveCamera(cameraAimTarget, cameraTarget);
    cameraTarget.set(corrected.x, corrected.y, corrected.z);
  }
  const k = 1 - Math.exp(-dt * (view ? 4 : 10));
  camera.position.lerp(cameraTarget, k);
  cameraAim.lerp(cameraAimTarget, k);
  camera.lookAt(cameraAim);
}

function updateMarker() {
  const marker = $('#marker');
  const target = game.mode === 'playing' ? goalTarget() : null;
  if (!target) { marker.classList.add('hidden'); return; }
  const p = game.player.state;
  const distance = Math.hypot(target.x - p.x, target.z - p.z);
  projected.set(target.x, target.y, target.z).project(camera);
  const behind = projected.z > 1;
  let x = (projected.x * 0.5 + 0.5) * innerWidth;
  let y = (-projected.y * 0.5 + 0.5) * innerHeight;
  if (behind) { x = innerWidth - x; y = innerHeight - 40; }
  const margin = 46;
  const clamped = behind || x < margin || x > innerWidth - margin || y < 110 || y > innerHeight - margin;
  x = THREE.MathUtils.clamp(x, margin, innerWidth - margin);
  y = THREE.MathUtils.clamp(y, 110, innerHeight - margin);
  marker.classList.remove('hidden');
  marker.classList.toggle('edge', clamped);
  marker.style.transform = `translate(${x}px, ${y}px)`;
  marker.querySelector('.marker-label').textContent = target.label;
  marker.querySelector('.marker-dist').textContent = `${Math.round(distance)} m`;
  marker.classList.toggle('close', distance < 4);
}

function updateBlobShadow() {
  if (!game.player) { blobShadow.visible = false; return; }
  const p = game.player.state;
  const ground = game.player.groundAt(p.x, p.z, p.y + 0.05);
  blobShadow.visible = ground !== null;
  if (!ground) return;
  const fade = THREE.MathUtils.clamp(1 - (p.y - ground.height) / 6, 0.3, 1);
  blobShadow.position.set(p.x, ground.height + 0.012, p.z);
  blobShadow.scale.setScalar(0.55 + fade * 0.45);
  blobShadow.material.opacity = 0.75 * fade;
}

function createBlobShadow() {
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const g = shadowCanvas.getContext('2d');
  const gradient = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(8,18,24,0.85)');
  gradient.addColorStop(0.55, 'rgba(8,18,24,0.42)');
  gradient.addColorStop(1, 'rgba(8,18,24,0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 128, 128);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2,
  }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1;
  return mesh;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 1 / 30);
  elapsed += dt;
  const { stage, run } = game;
  if (stage && run) {
    const active = game.mode === 'playing' || game.mode === 'sheet';
    if (active) stage.update(elapsed, dt, run.flags, game.player.state);
    if (game.mode === 'playing') {
      run.time += dt;
      updatePlayer(dt);
      if (game.mode === 'playing') updateInteraction();
    } else {
      levi.update(dt, 0, false, false, game.mode === 'results', false);
    }
    if (game.mode === 'sheet') run.time += dt;
    $('#timer').textContent = formatTime(run.time);
    updateCamera(dt);
    updateMarker();
  }
  queued.interact = false;
  updateBlobShadow();
  composer.render(dt);
}

// ------------------------------------------------------------------ input
const typing = () => game.mode !== 'playing' && game.mode !== 'paused';
window.addEventListener('keydown', (event) => {
  if (game.mode === 'sheet' || game.mode === 'menu' || game.mode === 'loading') return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  if (event.code === 'Escape' || event.code === 'KeyP') { setPaused(game.mode === 'playing'); return; }
  if (typing() || game.mode === 'paused') return;
  if (event.code === 'KeyH' && !event.repeat) { $('#controls-help').classList.toggle('collapsed'); return; }
  pressed.add(event.code);
  if (event.repeat) return;
  if (event.code === 'Space') queued.jump = true;
  if (event.code === 'KeyJ' || event.code === 'KeyX') queued.dash = true;
  if (event.code === 'KeyE' || event.code === 'Enter') queued.interact = true;
  if (event.code === 'KeyR') respawn('Levi voltou ao último checkpoint.');
});
window.addEventListener('keyup', (event) => pressed.delete(event.code));
window.addEventListener('blur', () => { pressed.clear(); orbitPointer = null; });
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
canvas.addEventListener('pointerdown', (event) => {
  if (game.mode !== 'playing' || (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2)) return;
  orbitPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (!orbitPointer || orbitPointer.id !== event.pointerId || game.mode !== 'playing') return;
  cameraYaw -= (event.clientX - orbitPointer.x) * 0.006;
  cameraPitch = THREE.MathUtils.clamp(cameraPitch + (event.clientY - orbitPointer.y) * 0.004, 0.08, 1.1);
  orbitPointer.x = event.clientX;
  orbitPointer.y = event.clientY;
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(type, (event) => { if (orbitPointer?.id === event.pointerId) orbitPointer = null; });
}
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.8));
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(innerWidth, innerHeight);
});

for (const button of document.querySelectorAll('[data-control]')) {
  const key = button.dataset.control;
  button.addEventListener('pointerdown', (e) => { e.preventDefault(); button.setPointerCapture(e.pointerId); touch.add(key); });
  button.addEventListener('pointerup', (e) => { e.preventDefault(); touch.delete(key); });
  button.addEventListener('pointercancel', () => touch.delete(key));
  button.addEventListener('lostpointercapture', () => touch.delete(key));
}
$('#touch-jump').addEventListener('pointerdown', (e) => { e.preventDefault(); queued.jump = true; });
$('#touch-dash').addEventListener('pointerdown', (e) => { e.preventDefault(); queued.dash = true; });
$('#touch-interact').addEventListener('pointerdown', (e) => { e.preventDefault(); queued.interact = true; });
$('#touch-pause').addEventListener('pointerdown', (e) => { e.preventDefault(); setPaused(true); });

$('#stage-select').addEventListener('click', (event) => {
  const play = event.target.closest('[data-play]');
  const trial = event.target.closest('[data-trial]');
  if (play) startStage(play.dataset.play).catch(loadFailed);
  else if (trial) startStage(trial.dataset.trial, { timeTrial: true }).catch(loadFailed);
});
$('#resume').addEventListener('click', () => setPaused(false));
$('#to-checkpoint').addEventListener('click', () => { setPaused(false); respawn(); });
$('#restart-stage').addEventListener('click', () => startStage(game.run.stage.id, { timeTrial: game.run.timeTrial }).catch(loadFailed));
$('#to-menu').addEventListener('click', showMenu);
$('#results-menu').addEventListener('click', showMenu);
$('#results-next').addEventListener('click', () => startStage(game.run.stage.next).catch(loadFailed));
$('#results-trial').addEventListener('click', () => startStage(game.run.stage.id, { timeTrial: true }).catch(loadFailed));

function loadFailed(error) {
  console.error('Falha ao carregar a fase:', error);
  $('#loading').classList.remove('hidden');
  $('#loading').innerHTML = '<div class="load-error"><h2>Não foi possível carregar os modelos 3D</h2><p>Execute o jogo por um servidor local (npm run dev), não abrindo o HTML diretamente.</p></div>';
}

// Debug/QA entry: ?stage=1-2 (&trial) skips the menu.
const params = new URLSearchParams(location.search);
levi.ready.then(() => {
  const direct = params.get('stage');
  if (direct && stageById(direct)) return startStage(direct, { timeTrial: params.has('trial') });
  $('#loading').classList.add('hidden');
  showMenu();
}).catch(loadFailed);
window.__levi = { game, startStage, camera };
animate();
