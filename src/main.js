import * as THREE from 'three';
import { createWorld } from './world.js';
import { createLevi } from './character.js';
import { readMovementInput, smoothVelocity } from './movement.js';
import { TRAVERSAL, cameraRelativeMovement, createTraversal, jumpInput, advanceTimers, consumeJump, landed, startDash, isDashing } from './platforming.js';
import { createMissionUI } from './missions.js';
import './style.css';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(59, innerWidth / innerHeight, 0.1, 130);
const world = createWorld(scene);
const levi = createLevi(scene);
const clock = new THREE.Clock();
const traversal = createTraversal();
const courseFacing = new THREE.Vector3(0, 0, -1);
const cameraTarget = new THREE.Vector3();
const cameraAim = new THREE.Vector3();
const cameraAimTarget = new THREE.Vector3();
const player = { position: new THREE.Vector3(0, 0.11, 15), velocity: new THREE.Vector3(), speed: 4.8, vy: 0, grounded: true };
const game = { started: false, completed: false, filterSolved: false, sumSolved: false,
  courseDone: false, courseCheckpoint: false, barrierBroken: false,
  cubes: 0, reachedFarSide: false, toastTimeout: null };
const pressed = new Set();
const touch = new Set();
let jumpQueued = false;
let dashQueued = false;
let interactQueued = false;
let cameraYaw = 0;
let cameraPitch = 0.47;
let orbitPointer = null;
let elapsed = 0;
let heldNear = null;
let ready = false;

function toast(message, duration = 3300) {
  const target = $('#toast');
  target.textContent = message;
  target.classList.remove('hidden');
  if (game.toastTimeout) clearTimeout(game.toastTimeout);
  game.toastTimeout = setTimeout(() => target.classList.add('hidden'), duration);
}
function setObjective() {
  if (game.completed) return;
  if (!game.filterSolved) {
    $('#objective').textContent = game.courseDone
      ? 'Circuito concluído! Use o terminal do filtro para liberar a ponte.'
      : 'Experimente dash, salto duplo e o circuito de plataforma antes do filtro.';
    $('#step').textContent = '01 / 03';
    $('#waypoint span').textContent = game.courseDone ? 'TERMINAL DO FILTRO' : 'CIRCUITO DO LEVI →';
  } else if (!game.sumSolved) {
    $('#objective').textContent = 'Atravesse a ponte e restaure a energia do elevador.';
    $('#step').textContent = '02 / 03';
    $('#waypoint span').textContent = 'TERMINAL SOMA';
  } else {
    $('#objective').textContent = 'Energia restaurada! Vá até o elevador principal.';
    $('#step').textContent = '03 / 03';
    $('#waypoint span').textContent = 'ELEVADOR';
  }
}
const missions = createMissionUI({
  onFilterSolved() {
    game.filterSolved = true;
    setObjective();
    levi.play('Comemorar');
    toast('PONTE RESTAURADA! Use a passagem para chegar ao Arquivo Inteligente.', 5200);
  },
  onSumSolved() {
    game.sumSolved = true;
    setObjective();
    levi.play('Comemorar');
    toast('ENERGIA RESTAURADA! O elevador está pronto.', 4500);
  },
  onClosed() {
    pressed.clear();
    touch.clear();
  },
});

function isBlocked() { return !game.started || game.completed || missions.isOpen(); }
function complete() {
  if (game.completed) return;
  game.completed = true;
  levi.play('Comemorar');
  $('#victory-cubes').textContent = `◆ ${game.cubes}/8 CUBOS`;
  $('#completion').classList.remove('hidden');
  $('#prompt').classList.add('hidden');
  $('#touch-controls').classList.add('hidden');
  $('#waypoint').classList.add('hidden');
}
function interact() {
  if (isBlocked()) return;
  if (heldNear === 'filter' && !game.filterSolved) missions.open('filter');
  else if (heldNear === 'sum' && game.filterSolved && !game.sumSolved) missions.open('sum');
  else if (heldNear === 'elevator' && game.sumSolved) complete();
}
function updateInteraction() {
  heldNear = null;
  const p = player.position;
  const distance = (obj) => Math.hypot(p.x - obj.x, p.z - obj.z);
  if (!game.filterSolved && distance(world.filterTerminal) < 3.1) heldNear = 'filter';
  else if (game.filterSolved && !game.sumSolved && distance(world.sumTerminal) < 3.1) heldNear = 'sum';
  else if (game.sumSolved && distance(world.elevator) < 3.7) heldNear = 'elevator';
  const prompt = $('#prompt');
  if (heldNear && !isBlocked()) {
    const labels = { filter: 'ABRIR TERMINAL DE FILTRO', sum: 'ABRIR TERMINAL SOMA', elevator: 'ENTRAR NO ELEVADOR' };
    $('#prompt-text').textContent = labels[heldNear];
    prompt.classList.remove('hidden');
    $('#touch-interact').classList.add('available');
  } else {
    prompt.classList.add('hidden');
    $('#touch-interact').classList.remove('available');
  }
}
function respawn() {
  if (game.reachedFarSide) player.position.set(0, 0.11, -11);
  else if (game.filterSolved) player.position.set(0, 0.11, 1);
  else if (game.courseCheckpoint) player.position.set(6.2, 0.11, 7.1);
  else player.position.set(0, 0.11, 15);
  player.vy = 0;
  player.velocity.set(0, 0, 0);
  Object.assign(traversal, createTraversal());
  player.grounded = true;
  toast('Oops! Levi voltou ao último ponto seguro.', 2400);
}
function collectCubes() {
  for (const cube of world.collectibles) {
    if (cube.collected) continue;
    if (Math.hypot(player.position.x - cube.x, player.position.z - cube.z) < 0.92 &&
        Math.abs(player.position.y + 1 - cube.mesh.position.y) < 1.8) {
      cube.collected = true;
      cube.mesh.visible = false;
      cube.halo.visible = false;
      game.cubes++;
      $('#cubes').textContent = String(game.cubes);
      if (game.cubes === 8) toast('EXPLORADOR MÁXIMO! Você coletou todos os cubos de dados.');
    }
  }
}
function movePlayer(dt) {
  const down = (key) => pressed.has(key) || touch.has(key);
  const keys = readMovementInput(down);
  const move = cameraRelativeMovement(keys.x, keys.z, cameraYaw);
  const hasInput = Math.hypot(move.x, move.z) > 0.01;
  if (hasInput) courseFacing.set(move.x, 0, move.z);
  const boosted = down('ShiftLeft') || down('ShiftRight');

  advanceTimers(traversal, dt, player.grounded);
  if (jumpQueued) jumpInput(traversal);
  jumpQueued = false;
  if (dashQueued) {
    const target = hasInput ? move : { x: courseFacing.x, z: courseFacing.z };
    if (startDash(traversal, target.x, target.z)) toast('DASH! Atravesse a barreira rosa ou alcance uma plataforma.', 1700);
  }
  dashQueued = false;
  const jumpingNow = consumeJump(traversal, player.grounded);
  if (jumpingNow > 0) {
    player.vy = jumpingNow;
    player.grounded = false;
  }

  const dashing = isDashing(traversal);
  const speed = player.speed * (boosted ? 1.45 : 1);
  player.velocity.x = dashing ? traversal.dashX * TRAVERSAL.dashSpeed
    : smoothVelocity(player.velocity.x, move.x * speed, dt, hasInput ? 15 : 22);
  player.velocity.z = dashing ? traversal.dashZ * TRAVERSAL.dashSpeed
    : smoothVelocity(player.velocity.z, move.z * speed, dt, hasInput ? 15 : 22);

  if (!dashing && !hasInput && Math.hypot(player.velocity.x, player.velocity.z) < 0.04) {
    player.velocity.set(0, 0, 0);
  }
  const previous = player.position.clone();
  const nextX = THREE.MathUtils.clamp(previous.x + player.velocity.x * dt, -13.4, 13.4);
  const nextZ = THREE.MathUtils.clamp(previous.z + player.velocity.z * dt, -21.4, 19.5);
  const collision = world.courseCollision(previous, { x: nextX, z: nextZ }, previous.y, dashing);
  if (collision === 'blocked') {
    player.velocity.set(0, 0, 0);
  } else {
    player.position.x = nextX;
    player.position.z = nextZ;
    if (collision === 'broken' && !game.barrierBroken) {
      game.barrierBroken = true;
      toast('BARREIRA ROMPIDA! O caminho está livre.', 3000);
    }
  }
  levi.face(player.velocity, dt);

  // Land on elevated platforms only if Levi's feet are high enough to reach
  // the surface. Ground detection uses the last foot height to avoid teleporting
  // from the floor onto platforms directly above the character.
  const surface = world.getGroundHeight(player.position.x, player.position.z, game.filterSolved, previous.y);
  if (player.grounded && surface !== null && Math.abs(surface - player.position.y) < 0.3) {
    player.position.y = surface;
    player.vy = 0;
  } else {
    player.grounded = false;
    player.vy -= TRAVERSAL.gravity * dt;
    player.position.y += player.vy * dt;
    if (surface !== null && player.vy <= 0 && player.position.y <= surface && previous.y >= surface - 0.2) {
      player.position.y = surface;
      player.vy = 0;
      player.grounded = true;
      landed(traversal);
    }
  }
  if (player.grounded && world.courseJumpPad(player.position.x, player.position.z) && traversal.padCooldown === 0) {
    player.vy = 12.6;
    player.grounded = false;
    traversal.jumps = 1;
    traversal.coyote = 0;
    traversal.padCooldown = 1.0;
    if (!game.courseCheckpoint) toast('IMPULSO! Salte novamente no ar para alcançar as plataformas.', 3100);
  }
  if (!game.courseCheckpoint && player.position.x > 6.1 && player.position.z < 13.4) {
    game.courseCheckpoint = true;
    toast('CHECKPOINT! Use salto duplo e dash para avançar.', 2600);
  }
  if (!game.courseDone && world.courseFinish(player.position)) {
    game.courseDone = true;
    levi.play('Comemorar');
    setObjective();
    toast('CIRCUITO CONCLUÍDO! Agora pratique Excel no terminal do filtro.', 4700);
  }
  if (world.courseHazard(player.position, elapsed, dashing)) {
    respawn();
    return;
  }
  if (game.filterSolved && player.position.z < -8.5 && surface !== null) game.reachedFarSide = true;
  if (player.position.y < -11) respawn();
  levi.root.position.copy(player.position);
  levi.update(dt, Math.hypot(player.velocity.x, player.velocity.z), !player.grounded, boosted, game.completed, dashing);
  collectCubes();
  const readiness = $('#dash-ready');
  if (readiness) {
    readiness.textContent = traversal.cooldown > 0 ? `DASH ${traversal.cooldown.toFixed(1)}s` : 'DASH PRONTO';
    readiness.classList.toggle('cooling', traversal.cooldown > 0);
  }
}
function updateCamera(dt) {
  const p = player.position;
  const dist = innerWidth < 700 ? 10.6 : 9.7;
  const horizontal = Math.cos(cameraPitch) * dist;
  const vertical = Math.sin(cameraPitch) * dist;
  cameraTarget.set(
    p.x + Math.sin(cameraYaw) * horizontal,
    p.y + 1.45 + vertical,
    p.z + Math.cos(cameraYaw) * horizontal
  );
  camera.position.lerp(cameraTarget, 1 - Math.exp(-dt * 7.5));
  cameraAimTarget.set(p.x, p.y + 1.5, p.z);
  cameraAim.lerp(cameraAimTarget, 1 - Math.exp(-dt * 9));
  camera.lookAt(cameraAim);
}
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 1 / 30);
  elapsed += dt;
  world.update(elapsed, dt, game.filterSolved, game.sumSolved);
  if (game.started && !isBlocked()) {
    movePlayer(dt);
    if (interactQueued) interact();
    updateInteraction();
  } else if (game.started) {
    levi.update(dt, 0, false, false, game.completed, false);
  }
  interactQueued = false;
  if (game.started) updateCamera(dt);
  renderer.render(scene, camera);
}

window.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code) && !missions.isOpen()) event.preventDefault();
  if (!game.started || missions.isOpen() || game.completed) return;
  pressed.add(event.code);
  if (event.code === 'Space' && !event.repeat) jumpQueued = true;
  if ((event.code === 'KeyJ' || event.code === 'KeyX') && !event.repeat) dashQueued = true;
  if (event.code === 'KeyE' && !event.repeat) interactQueued = true;
  if (event.code === 'KeyR' && !event.repeat) respawn();
});
window.addEventListener('keyup', (event) => pressed.delete(event.code));
window.addEventListener('blur', () => { pressed.clear(); orbitPointer = null; });
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
canvas.addEventListener('pointerdown', (event) => {
  if (isBlocked() || (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2)) return;
  orbitPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (!orbitPointer || orbitPointer.id !== event.pointerId || isBlocked()) return;
  const dx = event.clientX - orbitPointer.x;
  const dy = event.clientY - orbitPointer.y;
  cameraYaw -= dx * 0.006;
  cameraPitch = THREE.MathUtils.clamp(cameraPitch + dy * 0.004, 0.16, 1.04);
  orbitPointer.x = event.clientX;
  orbitPointer.y = event.clientY;
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(type, (event) => {
    if (orbitPointer?.id === event.pointerId) orbitPointer = null;
  });
}
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.8));
});

for (const button of document.querySelectorAll('[data-control]')) {
  const key = button.dataset.control;
  button.addEventListener('pointerdown', (e) => { e.preventDefault(); button.setPointerCapture(e.pointerId); touch.add(key); });
  button.addEventListener('pointerup', (e) => { e.preventDefault(); touch.delete(key); });
  button.addEventListener('pointercancel', () => touch.delete(key));
  button.addEventListener('lostpointercapture', () => touch.delete(key));
}
$('#touch-jump').addEventListener('pointerdown', (event) => { event.preventDefault(); jumpQueued = true; });
$('#touch-dash').addEventListener('pointerdown', (event) => { event.preventDefault(); dashQueued = true; });
$('#touch-interact').addEventListener('pointerdown', (event) => { event.preventDefault(); interactQueued = true; });
$('#restart').addEventListener('click', () => window.location.reload());
$('#start').addEventListener('click', () => {
  if (!ready) return;
  game.started = true;
  $('#intro').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  $('#waypoint').classList.remove('hidden');
  if (matchMedia('(pointer: coarse)').matches) $('#touch-controls').classList.remove('hidden');
  else $('#controls-help').classList.remove('hidden');
  setObjective();
  toast('Comece explorando! Espaço: salto duplo · J ou X: dash · arraste para girar a câmera.', 6500);
});

camera.position.set(0, 6.5, 24.5);
camera.lookAt(0, 2, 10);
cameraAim.set(player.position.x, player.position.y + 1.5, player.position.z);
levi.root.position.copy(player.position);
levi.ready.then(() => {
  ready = true;
  $('#loading').classList.add('hidden');
  $('#intro').classList.remove('hidden');
}).catch((error) => {
  console.error('Falha ao carregar o modelo original do Levi:', error);
  $('#loading').innerHTML = '<div class="load-error"><h2>Não foi possível carregar levi.glb</h2><p>Execute o jogo por um servidor local (npm run dev), não abrindo o HTML diretamente.</p></div>';
});
animate();
