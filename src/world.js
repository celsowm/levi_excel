import * as THREE from 'three';
import { createActionCourse } from './action-course.js';
import { createLobbyArt } from './lobby-art.js';

const C = {
  navy: 0x071a2d, deep: 0x102b46, steel: 0x263e59, light: 0xb9d9eb,
  cyan: 0x19e4f2, blue: 0x168cf1, green: 0x70ff95, gold: 0xffc656,
  pink: 0xe73dff, glass: 0x64d4f1, white: 0xf4fbff,
};

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.38, ...options });
}
function addMesh(scene, geometry, mat, x, y, z, shadows = true) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  scene.add(mesh);
  return mesh;
}
function box(scene, w, h, d, x, y, z, mat, shadows = true) {
  return addMesh(scene, new THREE.BoxGeometry(w, h, d), mat, x, y, z, shadows);
}
function cylinder(scene, r1, r2, h, x, y, z, mat, sides = 16) {
  return addMesh(scene, new THREE.CylinderGeometry(r1, r2, h, sides), mat, x, y, z);
}
function glow(color, strength = 1.5) {
  return material(color, { emissive: color, emissiveIntensity: strength, roughness: 0.25, metalness: 0.1 });
}
function labelTexture(title, subtitle = '', accent = '#75faff') {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#071b2a';
  g.fillRect(0, 0, 1024, 256);
  g.fillStyle = accent;
  g.fillRect(0, 0, 1024, 12);
  g.font = 'bold 74px system-ui, Arial, sans-serif';
  g.textAlign = 'center';
  g.fillStyle = '#ecffff';
  g.fillText(title, 512, subtitle ? 130 : 158, 920);
  if (subtitle) {
    g.font = '36px system-ui, Arial, sans-serif';
    g.fillStyle = accent;
    g.fillText(subtitle, 512, 202, 920);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
}
function sign(scene, title, subtitle, x, y, z, width = 5, accent = '#75faff') {
  const label = addMesh(scene, new THREE.PlaneGeometry(width, width / 4), labelTexture(title, subtitle, accent), x, y, z, false);
  label.renderOrder = 2;
  return label;
}
function planter(scene, x, z, height = 1) {
  const dark = material(C.deep, { metalness: 0.5 });
  box(scene, 1.55, 0.7, 1.55, x, 0.35, z, dark);
  box(scene, 1.6, 0.09, 1.6, x, 0.72, z, glow(C.cyan, 0.65));
  cylinder(scene, 0.12, 0.18, height, x, 0.78 + height / 2, z, material(0x406a57));
  const leafMat = material(0x3bdb91, { roughness: 0.74, metalness: 0 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const leaf = addMesh(scene, new THREE.SphereGeometry(0.48, 10, 8), leafMat,
      x + Math.cos(a) * 0.44, 1.65 + height * 0.42 + (i % 2) * 0.14, z + Math.sin(a) * 0.43);
    leaf.scale.set(0.9, 0.74, 1.2);
  }
  addMesh(scene, new THREE.SphereGeometry(0.5, 12, 8), leafMat, x, 1.8 + height * 0.4, z);
}

export function createWorld(scene) {
  scene.background = new THREE.Color(0xc7dce0);
  scene.fog = new THREE.FogExp2(0xb6cdd1, 0.012);
  scene.add(new THREE.HemisphereLight(0xf6faf7, 0x445c68, 2.05));
  const sun = new THREE.DirectionalLight(0xfff6df, 2.35);
  sun.position.set(-8, 16, 11);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -28; sun.shadow.camera.right = 28;
  sun.shadow.camera.top = 32; sun.shadow.camera.bottom = -32;
  sun.shadow.camera.near = 0.1; sun.shadow.camera.far = 85;
  sun.shadow.bias = -0.0002;
  scene.add(sun);
  const accent = new THREE.PointLight(C.cyan, 130, 16, 2);
  accent.position.set(-1, 7, -2);
  scene.add(accent);
  const accent2 = new THREE.PointLight(C.pink, 75, 13, 2);
  accent2.position.set(10, 6, -18);
  scene.add(accent2);

  const floor = material(0x7d9698, { metalness: 0.1, roughness: 0.82 });
  const floorSide = material(0x10263c, { metalness: 0.5 });
  const inlay = glow(0x67cdbb, 0.47);
  const orange = glow(C.gold, 1.1);
  const frames = material(0x1d344e, { metalness: 0.7, roughness: 0.24 });
  const windowMat = material(C.glass, { transparent: true, opacity: 0.15, metalness: 0.15, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });

  // Two solid islands separated by a real playable gap. The bridge appears after the filter mission.
  box(scene, 28, 1.4, 22, 0, -0.74, 9, floor);
  box(scene, 28, 1.4, 14, 0, -0.74, -15, floor);
  for (const z of [9, -15]) {
    box(scene, 27.6, 0.18, z === 9 ? 21.6 : 13.6, 0, 0.01, z, material(0x3c5b70, { metalness: 0.55, roughness: 0.28 }), false);
  }
  for (let x = -12; x <= 12; x += 2) {
    for (const [minZ, maxZ] of [[-1, 19], [-21, -9]]) {
      box(scene, 0.025, 0.014, maxZ - minZ, x, 0.11, (minZ + maxZ) / 2, material(0x6fa7ba, { transparent: true, opacity: 0.17 }), false);
    }
  }
  for (const z of [-20, -17, -14, -11, -1, 2, 5, 8, 11, 14, 17]) {
    box(scene, 26, 0.014, 0.032, 0, 0.12, z, material(0x6fa7ba, { transparent: true, opacity: 0.22 }), false);
  }
  for (const z of [-20, -10, 0, 10, 19]) {
    // Atrium columns, light strips, window framing.
    for (const x of [-13.1, 13.1]) {
      box(scene, 0.7, 15, 0.72, x, 7.5, z, frames);
      box(scene, 0.14, 14, 0.18, x + (x < 0 ? 0.36 : -0.36), 7.5, z, inlay, false);
    }
  }
  for (const z of [-20, -15, -10, -5, 0, 5, 10, 15, 20]) {
    for (const x of [-13.8, 13.8]) {
      box(scene, 0.17, 14.2, 4.6, x, 7.4, z, windowMat, false);
    }
  }
  for (const z of [-20, -10, 0, 10, 20]) {
    box(scene, 27.8, 0.17, 0.36, 0, 14.5, z, frames);
    box(scene, 23, 0.08, 0.12, 0, 14.4, z + 0.18, inlay, false);
  }
  // Exterior holographic sky panels behind glazing add background depth.
  for (let i = 0; i < 15; i++) {
    const side = i % 2 ? -1 : 1;
    const w = 2 + (i % 4) * 0.7;
    const h = 3 + (i % 5) * 1.2;
    const z = -23 + i * 3.0;
    const tower = box(scene, w, h, 1.5, side * (17 + (i % 3) * 2.2), h / 2 - 0.8, z,
      material(i % 3 === 0 ? 0x204665 : 0x17314e, { metalness: 0.3, roughness: 0.7 }));
    tower.castShadow = false;
    box(scene, w * 0.75, 0.05, 1.55, tower.position.x, h * 0.6, z, i % 3 === 0 ? orange : inlay, false);
  }
  // Reception: readable architectural context rather than endless abstract platforms.
  box(scene, 7.1, 1.45, 2.2, -8.4, 0.72, 10, material(0x3e6575, { metalness: 0.35, roughness: 0.4 }));
  box(scene, 7.3, 0.14, 2.35, -8.4, 1.48, 10, material(0xe5f8ff, { metalness: 0.32 }));
  box(scene, 7.2, 0.12, 0.08, -8.4, 0.92, 11.18, inlay, false);
  sign(scene, 'PGE-RJ', 'CENTRAL DE DADOS', -8.4, 4.3, 12.25, 6.3);
  planter(scene, -11, 16, 1.05);
  planter(scene, 10.7, 14, 1.2);
  planter(scene, 10.8, -13, 0.85);
  planter(scene, -10.4, -14, 1.15);

  // Holographic guide walls / visual landmarks.
  sign(scene, 'SETOR DE TREINAMENTO', 'MISSÃO 01 / FILTRAGEM', 7.2, 3.65, 8.5, 6.4, '#8cfdb8');
  sign(scene, 'ARQUIVO INTELIGENTE', 'MISSÃO 02 / FÓRMULAS', -7.4, 4.2, -19.7, 6.8, '#ffd67a');
  const holo = new THREE.Group();
  scene.add(holo);
  const chartMats = [glow(C.green, 0.9), glow(C.cyan, 1.1), glow(C.blue, 0.9), glow(C.gold, 0.9)];
  for (let i = 0; i < 4; i++) {
    const h = 1.1 + i * 0.7;
    box(holo, 0.5, h, 0.38, 8.2 + i * 0.8, 1.2 + h / 2, 8.8, chartMats[i], false);
  }
  box(scene, 5.5, 0.1, 0.06, 9, 1, 8.8, inlay, false);

  // Interactive consoles. Sprite / glowing ring identifies them in the world.
  function terminal(x, z, name, tint) {
    const stand = box(scene, 2.2, 1.2, 1.35, x, 0.7, z, frames);
    stand.rotation.x = -0.05;
    box(scene, 2.3, 0.09, 1.4, x, 1.35, z, glow(tint, 0.95), false);
    const screen = box(scene, 2.45, 1.3, 0.14, x, 2.12, z - 0.18, material(0x083343, { emissive: tint, emissiveIntensity: 0.34, metalness: 0.1 }), false);
    screen.rotation.x = -0.16;
    sign(scene, name, 'PRESSIONE E', x, 2.18, z - 0.05, 2.22, '#9efeff');
    const ring = addMesh(scene, new THREE.TorusGeometry(1.65, 0.045, 8, 64), glow(tint, 1.2), x, 0.14, z, false);
    ring.rotation.x = Math.PI / 2;
    return { x, z, ring };
  }
  const filterTerminal = terminal(0, 1.45, 'FILTRO', C.cyan);
  const sumTerminal = terminal(3.3, -14.5, 'SOMA', C.green);

  // Bridge is physically absent until filtering is solved.
  const bridge = new THREE.Group();
  scene.add(bridge);
  const boards = [];
  for (let i = 0; i < 6; i++) {
    const z = -2.5 - i;
    const top = box(bridge, 4.2, 0.24, 0.96, 0, -0.07, z, material(0x284b62, { metalness: 0.66, roughness: 0.25 }));
    const edgeL = box(bridge, 0.1, 0.08, 0.93, -2.04, 0.1, z, inlay, false);
    const edgeR = box(bridge, 0.1, 0.08, 0.93, 2.04, 0.1, z, inlay, false);
    const stripe = box(bridge, 1.3, 0.045, 0.06, 0, 0.1, z, orange, false);
    boards.push({ z, objects: [top, edgeL, edgeR, stripe] });
  }
  bridge.visible = false;
  const abyss = box(scene, 27, 0.03, 5.8, 0, -8.5, -5, glow(C.pink, 0.25), false);
  abyss.material.transparent = true;
  abyss.material.opacity = 0.15;
  // Elevator goal.
  box(scene, 6.1, 7.6, 0.6, 0, 3.8, -21.7, frames);
  box(scene, 4.45, 5.65, 0.16, 0, 2.82, -21.26, material(0x113049, { metalness: 0.88, roughness: 0.2 }));
  box(scene, 0.08, 5.7, 0.2, 0, 2.81, -21.1, glow(C.pink, 1.1), false);
  box(scene, 4.7, 0.13, 0.2, 0, 5.9, -21.07, glow(C.pink, 1.1), false);
  const elevatorGlow = glow(C.pink, 1.2);
  const elevatorHeader = box(scene, 4.8, 0.23, 0.22, 0, 6.18, -21.06, elevatorGlow, false);
  sign(scene, 'ELEVADOR', 'NÚCLEO DA PGE', 0, 7.48, -21.2, 5, '#9bffe0');
  const glitchBlocks = [];
  for (let i = 0; i < 18; i++) {
    const m = box(scene, 0.3 + (i % 4) * 0.14, 0.33, 0.35,
      8 + Math.sin(i * 8) * 2.6, 3 + (i % 7) * 0.85, -18 + Math.cos(i * 4) * 2,
      glow(i % 3 === 0 ? C.pink : C.blue, 1.1), false);
    glitchBlocks.push({ mesh: m, y: m.position.y, phase: i });
  }
  const collectibles = [];
  const pickups = [[-4, 7], [4, 10], [8, 14], [-9, 4], [0, -3.5], [0, -6.5], [-6, -13], [8.5, -17]];
  for (const [i, pos] of pickups.entries()) {
    const mesh = addMesh(scene, new THREE.OctahedronGeometry(0.35, 0), glow(i % 2 ? C.green : C.gold, 1.65), pos[0], 1.23, pos[1], false);
    const halo = addMesh(scene, new THREE.TorusGeometry(0.47, 0.023, 6, 30), glow(C.cyan, 0.75), pos[0], 1.23, pos[1], false);
    collectibles.push({ x: pos[0], z: pos[1], mesh, halo, baseY: 1.23, collected: false, phase: i * 1.35 });
  }
  // Suspended atmospheric light particles.
  const dust = [];
  for (let i = 0; i < 75; i++) {
    const x = Math.sin(i * 12.9898) * 12;
    const z = Math.cos(i * 19.834) * 19;
    const y = 2 + ((i * 17) % 10);
    const p = box(scene, 0.07, 0.07, 0.07, x, y, z, i % 4 ? inlay : orange, false);
    dust.push({ mesh: p, y, phase: i * 0.89 });
  }

  const lobbyArt = createLobbyArt(scene);
  const actionCourse = createActionCourse(scene);
  let bridgeProgress = 0;
  function update(t, dt, bridgeUnlocked, elevatorUnlocked) {
    lobbyArt.update(t);
    actionCourse.update(t);
    if (bridgeUnlocked) {
      bridge.visible = true;
      bridgeProgress = Math.min(1, bridgeProgress + dt * 2.0);
      boards.forEach(({ objects }, i) => {
        const p = Math.max(0.001, Math.min(1, (bridgeProgress * 6.8 - i) * 1.7));
        for (const o of objects) {
          o.visible = p > 0.001;
          o.scale.y = p;
          o.position.y = -0.15 + p * (o.geometry.parameters.height === 0.24 ? 0.08 : 0.25);
        }
      });
    }
    if (elevatorUnlocked) {
      elevatorGlow.color.setHex(C.green);
      elevatorGlow.emissive.setHex(C.green);
      elevatorHeader.scale.x = 1 + 0.09 * Math.sin(t * 3);
    }
    for (const c of collectibles) {
      if (c.collected) continue;
      c.mesh.rotation.y += dt * 1.7;
      c.mesh.rotation.z += dt * 0.85;
      c.mesh.position.y = c.baseY + Math.sin(t * 2.4 + c.phase) * 0.19;
      c.halo.position.y = c.mesh.position.y;
      c.halo.rotation.y += dt * 1.3;
    }
    for (const d of dust) d.mesh.position.y = d.y + Math.sin(t + d.phase) * 0.25;
    for (const g of glitchBlocks) {
      g.mesh.position.y = g.y + Math.sin(t * 1.7 + g.phase) * 0.22;
      g.mesh.rotation.y += dt * 0.33;
    }
    filterTerminal.ring.rotation.z = Math.sin(t * 0.6) * 0.06;
    sumTerminal.ring.rotation.z = Math.sin(t * 0.6 + 2) * 0.06;
  }
  function getGroundHeight(x, z, bridgeUnlocked, footY = Infinity) {
    if (Math.abs(x) > 13.7) return null;
    let floor = null;
    if (z >= -2 && z <= 20) floor = 0.11;
    if (z >= -22 && z <= -8) floor = 0.11;
    if (bridgeUnlocked && Math.abs(x) <= 2.1 && z >= -8 && z <= -2) floor = 0.11;
    return actionCourse.getSurfaceHeight(x, z, footY, floor);
  }
  return {
    receptionTerminal: { x: -8.4, z: 10 },
    setReceptionSolved: lobbyArt.setReceptionSolved,
    filterTerminal, sumTerminal, elevator: { x: 0, z: -20.55 },
    collectibles, update, getGroundHeight,
    courseCollision: actionCourse.collision,
    courseHazard: actionCourse.hazard,
    courseJumpPad: actionCourse.jumpPad,
    courseFinish: actionCourse.atFinish,
  };
}
