import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import levelData from './data/world01.level.json';
import { createLevel } from './level.js';
import { createActionCourse } from './action-course.js';
import { loadWorldAssets, captureReflections } from './world-assets.js';

// World 01 "Recepção Inteligente". Architecture, props and the gameplay layout are
// authored in Blender (art/blender/build_world01.py); this module wires the exported
// level data to gameplay and animates the interactive prefabs.
function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  const gradient = g.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#5f9fd6');
  gradient.addColorStop(0.45, '#b9d8ee');
  gradient.addColorStop(0.52, '#e3eef0');
  gradient.addColorStop(1, '#8aa38f');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 16, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createWorld(scene, renderer) {
  const level = createLevel(levelData);
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xd5e6ea, 55, 125);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();
  // Realtime lights only shade Levi, props and foliage; the architecture is baked.
  scene.add(new THREE.HemisphereLight(0xf3f8ff, 0x6e6656, 1.15));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.5);
  sun.position.set(-8, 16, 11);
  scene.add(sun);

  const course = createActionCourse(scene, levelData.course);
  const solids = level.colliders.concat(course.colliders);
  const cameraSolids = level.cameraColliders.concat(course.colliders);
  const dynamic = new THREE.Group();
  dynamic.name = 'WorldProps';
  scene.add(dynamic);
  const holder = (x, y, z) => {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    dynamic.add(group);
    return group;
  };

  // Deployable walkway: absent until the filter mission, then unfolds segment by segment.
  const { segments, firstZ, step } = levelData.bridge;
  const boards = Array.from({ length: segments }, (_, i) => {
    const board = holder(0, -2, firstZ - i * step);
    board.visible = false;
    return board;
  });
  const collectibles = levelData.pickups.map(([x, z], i) => ({
    x, z, mesh: holder(x, 1.23, z), halo: holder(x, 1.23, z),
    baseY: 1.23, collected: false, phase: i * 1.35,
  }));
  // Floating data cubes above the archive: pure set dressing.
  const drifting = Array.from({ length: 6 }, (_, i) => {
    const node = holder(8 + Math.sin(i * 8) * 2.6, 3 + (i % 7) * 0.85, -18 + Math.cos(i * 4) * 2);
    node.scale.setScalar(0.7 + (i % 3) * 0.25);
    return { node, y: node.position.y, phase: i };
  });
  const rings = holder(-8.5, 7.2, 9.8);
  const courier = holder(...levelData.courier[0]);
  const courierPath = new THREE.CatmullRomCurve3(levelData.courier.map(([x, y, z]) => new THREE.Vector3(x, y, z)));

  let materials = new Map();
  const ready = loadWorldAssets(levelData.render).then((assets) => {
    scene.add(assets.world);
    course.attach(assets.prefab);
    boards.forEach((board) => board.add(assets.prefab('bridge_segment')));
    for (const c of collectibles) {
      c.mesh.add(assets.prefab('data_cube'));
      c.halo.add(assets.prefab('data_halo'));
    }
    for (const d of drifting) d.node.add(assets.prefab('data_cube'));
    rings.add(assets.prefab('info_rings'));
    courier.add(assets.prefab('helper_drone'));
    materials = assets.materials;
    captureReflections(renderer, scene, assets.reflective, new THREE.Vector3(0, 1.6, 6));
    return assets;
  });

  let bridgeProgress = 0;
  let receptionSolved = false;
  let courierProgress = 0;
  function update(t, dt, bridgeUnlocked, elevatorUnlocked) {
    course.update(t);
    if (bridgeUnlocked && bridgeProgress < 1) {
      bridgeProgress = Math.min(1, bridgeProgress + dt * 2.0);
      boards.forEach((board, i) => {
        const p = THREE.MathUtils.clamp((bridgeProgress * 6.8 - i) * 1.7, 0, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        board.visible = p > 0.001;
        board.position.y = levelData.floors[0].y - 0.015 - (1 - eased) * 1.6;
        board.scale.x = 0.55 + 0.45 * eased;
      });
    }
    const elevator = materials.get('E_elevator');
    if (elevator && elevatorUnlocked) elevator.color.setRGB(0.35, 1, 0.3).multiplyScalar(2.6 + Math.sin(t * 3) * 0.8);
    const mint = materials.get('E_mint');
    if (mint) mint.color.setRGB(0.3, 1, 0.72).multiplyScalar(2.2 + Math.sin(t * 2) * 0.9);
    for (const c of collectibles) {
      if (c.collected) continue;
      c.mesh.rotation.y += dt * 1.7;
      c.mesh.rotation.z += dt * 0.85;
      c.mesh.position.y = c.baseY + Math.sin(t * 2.4 + c.phase) * 0.19;
      c.halo.position.y = c.mesh.position.y;
      c.halo.rotation.x = Math.sin(t * 1.3 + c.phase) * 0.4;
    }
    for (const d of drifting) {
      d.node.position.y = d.y + Math.sin(t * 1.7 + d.phase) * 0.22;
      d.node.rotation.y += dt * 0.33;
    }
    if (receptionSolved) courierProgress = Math.min(1, courierProgress + dt * 0.2);
    const pos = courierPath.getPoint(courierProgress);
    courier.position.set(pos.x, pos.y + Math.sin(t * 2) * 0.08, pos.z);
    courier.rotation.y = -courierProgress * 0.8;
    courier.rotation.z = Math.sin(t * 1.6) * 0.06;
    rings.rotation.y = Math.sin(t * 0.13) * 0.08;
    rings.rotation.z = Math.sin(t * 0.22) * 0.035;
  }
  function getGroundHeight(x, z, bridgeUnlocked, footY = Infinity) {
    const furniture = level.groundHeight(x, z, { bridge: bridgeUnlocked }, footY);
    return course.getSurfaceHeight(x, z, footY, furniture);
  }
  const [rx, rz] = levelData.interactables.reception;
  const [fx, fz] = levelData.interactables.filter;
  const [sx, sz] = levelData.interactables.sum;
  const [ex, ez] = levelData.interactables.elevator;
  return {
    ready,
    resolvePlayerMove: (position, dx, dz, footY) => level.resolveMove(position, dx, dz, footY, solids),
    resolveCamera: (from, to) => level.resolveCamera(from, to, cameraSolids),
    receptionTerminal: { x: rx, z: rz },
    setReceptionSolved(value) { receptionSolved = Boolean(value); },
    filterTerminal: { x: fx, z: fz }, sumTerminal: { x: sx, z: sz }, elevator: { x: ex, z: ez },
    spawns: levelData.spawns, voidY: levelData.bounds.voidY,
    collectibles, update, getGroundHeight,
    courseCollision: course.collision,
    courseHazard: course.hazard,
    courseJumpPad: course.jumpPad,
    courseFinish: course.atFinish,
  };
}
