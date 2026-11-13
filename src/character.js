import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { modelFacingYaw, smoothYaw } from './movement.js';

const CLIPS = ['Parado', 'Andar', 'Correr', 'Pular', 'Salto', 'Aterrissar', 'Acenar', 'Dancar', 'Comemorar'];
const ONE_SHOT = new Set(['Pular', 'Salto', 'Aterrissar', 'Comemorar']);
const AIR = new Set(['Pular', 'Salto']);
// Ground speed (m/s) each in-place cycle was authored for (art/blender/levi_anim.py).
const GAIT_SPEED = { Andar: 3.4, Correr: 6.4 };
const SPRINT_FROM = 5.4;

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
  let landingRemaining = 0;
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
        if (ONE_SHOT.has(clip.name)) {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }
        actions.set(clip.name, action);
      }
      play('Parado', 0);
      resolve({ model, animations: [...actions.keys()] });
    }, undefined, (error) => reject(error));
  });

  function play(name, fade = 0.18, { restart = false, at = 0 } = {}) {
    if (name === 'Comemorar') celebrationRemaining = 1.7;
    const next = actions.get(name);
    if (!next || (current === name && !restart)) return;
    const old = current === name ? null : actions.get(current);
    next.reset();
    next.time = at;
    // Walk <-> run keep the same step phase so the feet don't skip on the switch.
    if (old && GAIT_SPEED[name] && GAIT_SPEED[current]) {
      next.time = (old.time / old.getClip().duration) * next.getClip().duration;
    }
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
    if (landingRemaining > 0) landingRemaining = Math.max(0, landingRemaining - dt);
    if (jumping && !AIR.has(current) && celebrationRemaining <= 0 && !victory) {
      // Walked off a ledge (no jump event): skip the push-off, go straight to the tuck.
      play('Pular', 0.15, { at: 0.2 });
      return;
    }
    const gait = movementSpeed > SPRINT_FROM && actions.has('Correr') ? 'Correr'
      : movementSpeed > 0.12 ? 'Andar' : 'Parado';
    const desired = (victory || celebrationRemaining > 0) ? 'Comemorar'
      : jumping ? current
      : landingRemaining > 0 ? 'Aterrissar' : gait;
    if (desired !== current) play(desired, GAIT_SPEED[desired] && GAIT_SPEED[current] ? 0.12 : 0.18);
    // The gait clips are in-place: match their playback rate to ground speed.
    if (GAIT_SPEED[current]) {
      actions.get(current)?.setEffectiveTimeScale(
        THREE.MathUtils.clamp(movementSpeed / GAIT_SPEED[current], 0.55, 1.6));
    }
  }

  function face(direction, dt) {
    const target = modelFacingYaw(direction.x, direction.z);
    if (target === null) return;
    root.rotation.y = smoothYaw(root.rotation.y, target, dt);
  }

  // Jump events start the air clips on the exact takeoff frame (crouch -> stretch -> tuck).
  function jump(double = false) {
    if (celebrationRemaining > 0) return;
    landingRemaining = 0;
    play(double ? 'Salto' : 'Pular', 0.06, { restart: true });
  }

  // Knees absorb the landing; when running in, it is quicker so the stride isn't lost.
  function land(speed = 0) {
    const action = actions.get('Aterrissar');
    if (!action || celebrationRemaining > 0) return;
    const rate = speed > 1 ? 1.9 : 1;
    landingRemaining = action.getClip().duration / rate * (speed > 1 ? 0.55 : 0.85);
    play('Aterrissar', 0.05, { restart: true });
    action.setEffectiveTimeScale(rate);
  }

  return { root, visual, ready, play, update, face, jump, land };
}
