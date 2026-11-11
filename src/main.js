import * as THREE from 'three';
import { createWorld } from './world.js';
import { createLevi } from './character.js';
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
const tempDir = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const cameraAim = new THREE.Vector3();
const player = { position: new THREE.Vector3(0, 0.11, 15), speed: 6, vy: 0, grounded: true };
const game = { started: false, completed: false, filterSolved: false, sumSolved: false, cubes: 0, reachedFarSide: false, toastTimeout: null };
const pressed = new Set();
const touch = new Set();
let jumpQueued = false;
let interactQueued = false;
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
    $('#objective').textContent = 'Encontre o terminal do filtro e libere a ponte.';
    $('#step').textContent = '01 / 03';
    $('#waypoint span').textContent = 'TERMINAL DO FILTRO';
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
  player.position.set(0, 0.11, game.reachedFarSide ? -11 : game.filterSolved ? 1 : 15);
  player.vy = 0;
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
  const movement = new THREE.Vector3();
  const down = (key) => pressed.has(key) || touch.has(key);
  if (down('KeyW') || down('ArrowUp') || down('up')) movement.z -= 1;
  if (down('KeyS') || down('ArrowDown') || down('down')) movement.z += 1;
  if (down('KeyA') || down('ArrowLeft') || down('left')) movement.x -= 1;
  if (down('KeyD') || down('ArrowRight') || down('right')) movement.x += 1;
  const moving = movement.lengthSq() > 0;
  movement.normalize();
  const boosted = down('ShiftLeft') || down('ShiftRight');
  const speed = boosted ? player.speed * 1.48 : player.speed;
  levi.face(movement, dt);
  const nextX = THREE.MathUtils.clamp(player.position.x + movement.x * speed * dt, -13.4, 13.4);
  const nextZ = THREE.MathUtils.clamp(player.position.z + movement.z * speed * dt, -21.4, 19.5);
  player.position.x = nextX;
  player.position.z = nextZ;
  if (jumpQueued && player.grounded) {
    player.vy = 9.4;
    player.grounded = false;
  }
  jumpQueued = false;
  const groundY = world.getGroundHeight(player.position.x, player.position.z, game.filterSolved);
  if (!player.grounded || groundY == null) {
    player.vy -= 23 * dt;
    player.position.y += player.vy * dt;
    player.grounded = false;
  }
  if (groundY !== null && player.position.y <= groundY && player.vy <= 0) {
    player.position.y = groundY;
    player.vy = 0;
    player.grounded = true;
  }
  if (game.filterSolved && player.position.z < -8.5 && groundY !== null) game.reachedFarSide = true;
  if (player.position.y < -11) respawn();
  levi.root.position.copy(player.position);
  levi.update(dt, moving, !player.grounded, boosted, game.completed);
  collectCubes();
}
function updateCamera(dt) {
  const p = player.position;
  const fovDistance = innerWidth < 700 ? 10.0 : 9.0;
  cameraTarget.set(p.x, p.y + (innerWidth < 700 ? 5.9 : 5.6), p.z + fovDistance);
  camera.position.lerp(cameraTarget, 1 - Math.exp(-dt * 4.1));
  cameraAim.set(p.x, p.y + 1.7, p.z - 2.3);
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
    levi.update(dt, false, false, false, game.completed);
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
  if (event.code === 'KeyE' && !event.repeat) interactQueued = true;
  if (event.code === 'KeyR' && !event.repeat) respawn();
});
window.addEventListener('keyup', (event) => pressed.delete(event.code));
window.addEventListener('blur', () => pressed.clear());
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
  toast('Bem-vindo, operador! Encontre o terminal luminoso próximo ao vão.', 5000);
});

camera.position.set(0, 6.5, 24.5);
camera.lookAt(0, 2, 10);
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
