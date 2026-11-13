import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// Loads the Blender-authored stages (see art/blender/build.py) and turns the exported
// PBR materials into runtime materials by mesh-name prefix:
//   LM_  baked lightmap, unlit (exact Cycles lighting, almost free to render)
//   EM_  emissive light strips and screens, unlit and bright enough to bloom
//   GL_  glazing, RT_ foliage/exterior lit by the realtime lights
const BASE = import.meta.env.BASE_URL;
// Cycles bakes physical irradiance; this maps it into the ACES range used at runtime.
const BAKE_EXPOSURE = 0.6;
const REFLECTIVE = { LM_marble: 0.1, LM_steel: 0.32, LM_bronze: 0.28, LM_alu: 0.22, LM_white: 0.05 };
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

export async function loadStageWorld(data) {
  const [world, lightMap] = await Promise.all([
    loader.loadAsync(BASE + data.assets.world),
    new THREE.TextureLoader().loadAsync(BASE + data.assets.lightmap).catch(() => null),
  ]);
  if (lightMap) {
    lightMap.flipY = false;               // glTF UV convention, like the GLB textures
    lightMap.colorSpace = THREE.SRGBColorSpace;
    lightMap.channel = 1;                 // TEXCOORD_1, the packed lightmap UVs
  }
  const lightMapScale = data.render?.lightMapScale ?? 1;

  const materials = new Map();
  const reflective = [];
  const glass = new THREE.MeshStandardMaterial({
    color: 0xd8f4f4, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.13,
    depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.4,
  });
  world.scene.traverse((node) => {
    if (!node.isMesh) return;
    const source = node.material;
    const kind = node.name.slice(0, 3);
    let material = source;
    if (kind === 'LM_') {
      material = new THREE.MeshBasicMaterial({
        name: source.name, color: source.color, map: source.map,
        lightMap, lightMapIntensity: Math.PI * lightMapScale * BAKE_EXPOSURE,
      });
      if (!lightMap) material.color.multiplyScalar(0.8);
      if (REFLECTIVE[node.name]) {
        material.combine = THREE.MixOperation;
        material.reflectivity = REFLECTIVE[node.name];
        reflective.push(material);
      }
    } else if (kind === 'EM_') {
      material = new THREE.MeshBasicMaterial({
        name: source.name, map: source.emissiveMap,
        color: source.emissive.clone().multiplyScalar(source.emissiveIntensity),
      });
    } else if (kind === 'GL_') {
      material = glass;
      node.renderOrder = 2;
    } else if (source.map && source.name.includes('plant')) {
      source.alphaTest = 0.45;
      source.transparent = false;
      source.side = THREE.DoubleSide;
    }
    node.material = material;
    node.matrixAutoUpdate = false;
    node.updateMatrix();
    materials.set(material.name, material);
  });
  world.scene.name = 'Stage ' + data.id;

  function dispose() {
    world.scene.traverse((node) => {
      if (!node.isMesh) return;
      node.geometry.dispose();
      if (node.material !== glass) node.material.dispose();
    });
    glass.dispose();
    lightMap?.dispose();
  }
  return { world: world.scene, materials, reflective, dispose };
}

// Shared prefab library (props.glb): one load for every stage.
let prefabLibrary = null;
export function loadPrefabs() {
  prefabLibrary ??= loader.loadAsync(BASE + 'stages/props.glb').then((props) => {
    const prefabs = new Map();
    for (const root of props.scene.children) {
      if (!root.name.startsWith('PF_')) continue;
      root.position.set(0, 0, 0);
      root.traverse((node) => {
        if (node.isMesh && node.material.transparent) node.material.depthWrite = false;
      });
      prefabs.set(root.name.slice(3), root);
    }
    // `unique` gives the instance its own materials, for per-entity tinting.
    return function prefab(name, { unique = false } = {}) {
      const source = prefabs.get(name);
      if (!source) throw new Error('Missing prefab in props.glb: ' + name);
      const copy = source.clone(true);
      if (unique) copy.traverse((node) => { if (node.isMesh) node.material = node.material.clone(); });
      return copy;
    };
  });
  return prefabLibrary;
}

// One cube snapshot of the finished stage feeds the unlit floor/metal reflections.
export function captureReflections(renderer, scene, reflective, position) {
  const target = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
  const cube = new THREE.CubeCamera(0.5, 120, target);
  cube.position.copy(position);
  for (const material of reflective) material.envMap = null;
  cube.update(renderer, scene);
  for (const material of reflective) {
    material.envMap = target.texture;
    material.needsUpdate = true;
  }
  return target;
}
