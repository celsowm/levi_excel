import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { modelFacingYaw, smoothYaw } from './movement.js';

const CLIPS = ['Parado', 'Andar', 'Pular', 'Acenar', 'Dancar', 'Comemorar'];

export function createLevi(scene) {
  const root = new THREE.Group();
  const visual = new THREE.Group();
  root.add(visual);
  scene.add(root);
  const dashPulse = new THREE.Mesh(
    new THREE.TorusGeometry(0.75, 0.055, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0x81ffee, transparent: true, opacity: 0.65, depthWrite: false })
  );
  dashPulse.rotation.x = Math.PI / 2;
  dashPulse.position.y = 0.45;
  dashPulse.visible = false;
  root.add(dashPulse);

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

  function update(dt, movementSpeed, jumping, boosted, victory, dashing = false) {
    if (mixer) mixer.update(dt);
    visual.rotation.x = THREE.MathUtils.damp(visual.rotation.x, dashing ? -0.23 : 0, 11, dt);
    dashPulse.visible = dashing;
    if (dashing) {
      dashPulse.rotation.z += dt * 12;
      dashPulse.scale.setScalar(0.9 + 0.16 * Math.sin(performance.now() * 0.04));
    }
    if (celebrationRemaining > 0) celebrationRemaining = Math.max(0, celebrationRemaining - dt);
    const desired = (victory || celebrationRemaining > 0) ? 'Comemorar'
      : jumping ? 'Pular' : movementSpeed > 0.12 ? 'Andar' : 'Parado';
    if (desired !== current) play(desired);
    // The walk clip is in-place: match its playback rate to ground speed.
    if (current === 'Andar') {
      actions.get('Andar')?.setEffectiveTimeScale(THREE.MathUtils.clamp(movementSpeed / 2.65, 0.8, 2.45));
    }
  }

  function face(direction, dt) {
    const target = modelFacingYaw(direction.x, direction.z);
    if (target === null) return;
    root.rotation.y = smoothYaw(root.rotation.y, target, dt);
  }

  return { root, visual, ready, play, update, face };
}
