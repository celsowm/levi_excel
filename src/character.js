import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CLIPS = ['Parado', 'Andar', 'Pular', 'Acenar', 'Dancar', 'Comemorar'];

export function createLevi(scene) {
  const root = new THREE.Group();
  const visual = new THREE.Group();
  root.add(visual);
  scene.add(root);

  let mixer = null;
  let current = null;
  let celebrationRemaining = 0;
  const actions = new Map();

  const ready = new Promise((resolve, reject) => {
    new GLTFLoader().load(`${import.meta.env.BASE_URL}levi.glb`, (gltf) => {
      const model = gltf.scene;
      model.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          node.frustumCulled = false; // Skinned animation moves beyond the bind-pose box.
        }
      });
      visual.add(model);
      // Normalize the original GLB to an approximately 2 m tall playable character.
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const scale = 2 / Math.max(0.01, size.y);
      model.scale.setScalar(scale);
      const centered = new THREE.Box3().setFromObject(model);
      model.position.y -= centered.min.y;
      mixer = new THREE.AnimationMixer(model);
      for (const clip of gltf.animations) {
        if (!CLIPS.includes(clip.name)) continue;
        const action = mixer.clipAction(clip);
        if (clip.name === 'Pular' || clip.name === 'Comemorar') {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }
        actions.set(clip.name, action);
      }
      play('Parado', 0);
      resolve({ model, animations: [...actions.keys()] });
    }, undefined, (error) => reject(error));
  });

  function play(name, fade = 0.18) {
    if (name === 'Comemorar') celebrationRemaining = 1.7;
    const next = actions.get(name);
    if (!next || current === name) return;
    const old = actions.get(current);
    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.setEffectiveTimeScale(1);
    next.fadeIn(fade).play();
    if (old) old.fadeOut(fade);
    current = name;
  }

  function update(dt, moving, jumping, boosted, victory) {
    if (mixer) mixer.update(dt);
    if (celebrationRemaining > 0) celebrationRemaining = Math.max(0, celebrationRemaining - dt);
    const desired = (victory || celebrationRemaining > 0) ? 'Comemorar' : jumping ? 'Pular' : moving ? 'Andar' : 'Parado';
    if (desired !== current) play(desired);
    if (current === 'Andar') actions.get('Andar')?.setEffectiveTimeScale(boosted ? 1.55 : 1.1);
  }

  function face(direction, dt) {
    if (direction.lengthSq() < 1e-4) return;
    // The glTF model's local forward axis may vary; adjust FORWARD_OFFSET if needed.
    const FORWARD_OFFSET = Math.PI;
    const target = Math.atan2(direction.x, direction.z) + FORWARD_OFFSET;
    const delta = Math.atan2(Math.sin(target - root.rotation.y), Math.cos(target - root.rotation.y));
    root.rotation.y += delta * Math.min(1, dt * 12);
  }

  return { root, visual, ready, play, update, face };
}
