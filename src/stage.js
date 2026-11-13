import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createLevel } from './level.js';
import { createEntities } from './entities.js';
import { loadStageWorld, loadPrefabs, captureReflections } from './world-assets.js';

// One playable stage: static Blender world + gameplay level + live entities, with
// Three.js mirrors of every entity (lifts, data decks, fans, drones, portal...).
const STAGE_DATA = import.meta.glob('./data/stages/*.json', { eager: true, import: 'default' });
export const stageData = (id) => STAGE_DATA[`./data/stages/${id}.json`];

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

// Sky, fog, environment and the realtime lights that shade Levi and the props.
export function setupScene(scene, renderer) {
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xd5e6ea, 60, 140);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xf3f8ff, 0x6e6656, 1.15));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.5);
  sun.position.set(-8, 16, 11);
  scene.add(sun);
}

const tint = (node, name, color) => node.traverse((n) => {
  if (n.isMesh && n.material.name === name) n.material.color.set(color);
});
const materialsOf = (node) => {
  const list = [];
  node.traverse((n) => { if (n.isMesh) list.push(n.material); });
  return list;
};

export async function loadStage(id, scene, renderer) {
  const data = stageData(id);
  if (!data) throw new Error('Stage data missing: ' + id);
  const [assets, prefab] = await Promise.all([loadStageWorld(data), loadPrefabs()]);
  const level = createLevel(data);
  const entities = createEntities(data.entities);
  const root = new THREE.Group();
  root.name = 'Stage ' + id;
  root.add(assets.world);
  const views = [];
  const place = (node, e, y = e.y) => {
    node.position.set(e.x, y, e.z);
    node.rotation.y = e.yaw ?? 0;
    root.add(node);
    return node;
  };

  for (const e of entities.list) {
    switch (e.type) {
      case 'platform': {
        const node = place(prefab(e.prefab, { unique: e.prefab === 'data' || e.prefab.startsWith('lift_') }), e);
        const mats = materialsOf(node);
        views.push(() => {
          node.position.set(e.x, e.y, e.z);
          if (e.prefab === 'data') {
            for (const m of mats) {
              m.transparent = true;
              m.opacity = e.active ? 1 : 0.18;
              m.depthWrite = e.active;
            }
          }
          if (e.prefab.startsWith('lift_')) tint(node, 'P_green', e.locked ? 0xff3355 : e.moving ? 0xffc23d : 0x45ff8a);
        });
        break;
      }
      case 'jumpPad':
        place(prefab('jump_pad'), e);
        break;
      case 'fan': {
        place(prefab('fan'), e);
        const blades = place(prefab('fan_blades'), e, e.y + 0.42);
        const air = place(prefab('air_column', { unique: true }), e);
        for (const m of materialsOf(air)) Object.assign(m, { transparent: true, opacity: 0.16, depthWrite: false });
        views.push(() => {
          blades.rotation.y = e.spin;
          air.visible = e.power > 0.02;
          air.scale.set(e.radius, Math.max(0.01, e.top - e.y), e.radius);
        });
        break;
      }
      case 'barrier': {
        const node = place(prefab('barrier'), e);
        node.scale.x = e.width / 6.65;
        let fade = 1;
        views.push((dt) => {
          if (!e.broken || fade <= 0) return;
          fade = Math.max(0, fade - dt * 3.5);
          node.scale.y = fade;
          node.visible = fade > 0;
        });
        break;
      }
      case 'scanner': {
        const node = place(prefab('scanner'), e);
        node.scale.x = e.length / 3.4;
        views.push(() => node.position.set(e.x, e.y, e.z));
        break;
      }
      case 'drone':
      case 'courier': {
        const node = place(prefab(e.type === 'drone' ? 'sentinel_drone' : 'helper_drone'), e);
        views.push(() => {
          node.position.set(e.x, e.y + (e.bob ?? 0), e.z);
          node.rotation.y = e.heading;
        });
        break;
      }
      case 'pickup': {
        const cube = place(prefab('data_cube'), e);
        const halo = place(prefab('data_halo'), e);
        views.push((dt, t) => {
          cube.visible = halo.visible = !e.collected;
          cube.position.y = halo.position.y = e.bobY;
          cube.rotation.set(0, e.spin, e.spin * 0.5);
          halo.rotation.x = Math.sin(t * 1.3 + (e.phase ?? 0)) * 0.4;
        });
        break;
      }
      case 'secret': {
        const star = place(prefab('secret_star'), e);
        views.push((dt, t) => {
          star.visible = !e.found;
          star.rotation.y = t * 1.4;
          star.position.y = e.y + Math.sin(t * 2) * 0.15;
        });
        break;
      }
      case 'checkpoint': {
        const node = place(prefab('checkpoint', { unique: true }), e);
        views.push(() => tint(node, 'P_cyan', e.reached ? 0x4dff88 : 0x37d8ff));
        break;
      }
      case 'exit': {
        const node = place(prefab('portal', { unique: true }), e);
        const membrane = materialsOf(node).find((m) => m.name === 'P_holo');
        views.push((dt, t) => {
          if (!membrane) return;
          membrane.transparent = true;
          membrane.opacity = e.open ? 0.55 + Math.sin(t * 4) * 0.2 : 0.08;
          tint(node, 'P_violet', e.open ? 0x9d6bff : 0x4b4660);
        });
        break;
      }
      case 'deco': {
        const node = place(prefab(e.prefab), e);
        views.push((dt, t) => { node.rotation.y = t * (e.spin ?? 0); });
        break;
      }
      default:
        break;
    }
  }
  scene.add(root);
  const [sx, sy, sz] = data.spawn;
  captureReflections(renderer, scene, assets.reflective, new THREE.Vector3(sx, sy + 1.6, sz));

  // Pulsing light strips: mint idles, the elevator strip greens up when the exit opens.
  const mint = assets.materials.get('E_mint');
  const elevator = assets.materials.get('E_elevator');
  let exitOpen = false;
  return {
    id, data, level, entities, root,
    spawn: { x: sx, y: sy, z: sz, yaw: data.spawnYaw ?? 0 },
    voidY: data.bounds.voidY,
    totals: { cubes: entities.ofType('pickup').length, secrets: entities.ofType('secret').length },
    setExitOpen(open) {
      exitOpen = open;
      for (const e of entities.ofType('exit')) e.open = open;
    },
    update(t, dt, flags, player) {
      entities.update(t, dt, flags, player);
      for (const view of views) view(dt, t);
      if (mint) mint.color.setRGB(0.3, 1, 0.72).multiplyScalar(2.2 + Math.sin(t * 2) * 0.9);
      if (elevator && exitOpen) elevator.color.setRGB(0.35, 1, 0.3).multiplyScalar(2.6 + Math.sin(t * 3) * 0.8);
    },
    dispose() {
      scene.remove(root);
      assets.dispose();
    },
  };
}
