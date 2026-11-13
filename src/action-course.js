import * as THREE from 'three';
import { boxCollider } from './collisions.js';

// The authored action route. Gameplay positions come from the level export
// (art/blender/build_world01.py); visuals are Blender prefabs attached once
// props01.glb has loaded, so the course is already playable while it streams.
export function createActionCourse(scene, course) {
  const group = new THREE.Group();
  group.name = 'ActionCourse';
  scene.add(group);
  const colliders = [];
  const at = (x, y, z) => {
    const holder = new THREE.Group();
    holder.position.set(x, y, z);
    group.add(holder);
    return holder;
  };

  const surfaces = course.platforms.map((p) => {
    const surface = { ...p, top: p.y + 0.06, holder: at(p.x, p.y, p.z) };
    // The deck is a gameplay solid: collide beside/below it, land on its upper face.
    surface.deckCollider = boxCollider('deck-' + p.z, p.x, p.z, p.w, p.d, surface.top - 0.27, surface.top + 0.05);
    colliders.push(surface.deckCollider);
    return surface;
  });
  const finishSurface = surfaces.reduce((best, s) =>
    Math.hypot(s.x - course.finish.x, s.z - course.finish.z) <
    Math.hypot(best.x - course.finish.x, best.z - course.finish.z) ? s : best);
  const pad = at(course.pad.x, 0.16, course.pad.z);
  const padRing = at(course.pad.x, 0.38, course.pad.z);
  const finish = at(course.finish.x, finishSurface.y + 0.16, course.finish.z);
  const barrier = at(course.barrier.x, 1.01, course.barrier.z);
  const scanner = at(course.scanner.x, course.scanner.y, course.scanner.z);
  const drone = at(course.sentinel.x, course.sentinel.y, course.sentinel.z);
  const hazardLight = new THREE.PointLight(0xff89ba, 2.5, 3.5, 2);
  hazardLight.position.copy(scanner.position);
  group.add(hazardLight);
  let barrierBroken = false;
  let beamMaterials = [];

  function attach(prefab) {
    surfaces.forEach((s, i) => s.holder.add(prefab('platform_' + i)));
    pad.add(prefab('jump_pad'));
    padRing.add(prefab('jump_pad_ring'));
    finish.add(prefab('finish_ring'));
    barrier.add(prefab('barrier'));
    drone.add(prefab('sentinel_drone'));
    const beam = prefab('scanner');
    // The scanner pulses on its own; never mutate materials shared with other props.
    beam.traverse((node) => {
      if (node.isMesh && node.material.transparent) {
        node.material = node.material.clone();
        beamMaterials.push(node.material);
      }
    });
    scanner.add(beam);
  }

  function getSurfaceHeight(x, z, footY, floorHeight) {
    let found = floorHeight;
    for (const p of surfaces) {
      if (Math.abs(x - p.x) < p.w / 2 - 0.14 && Math.abs(z - p.z) < p.d / 2 - 0.14 &&
          p.top <= footY + 0.2 && (found === null || p.top > found)) {
        found = p.top;
      }
    }
    return found;
  }
  function collision(previous, next, footY, dashActive) {
    const b = course.barrier;
    if (barrierBroken || footY > b.height) return 'clear';
    const crosses = Math.abs(next.x - b.x) < b.halfWidth && next.z > b.minZ && next.z < b.maxZ;
    if (!crosses) return 'clear';
    if (dashActive) {
      barrierBroken = true;
      barrier.visible = false;
      return 'broken';
    }
    return 'blocked';
  }
  function hazard(position, t, dashActive) {
    if (dashActive) return false;
    const droneHit = position.y > 1.6 &&
      Math.hypot(position.x - drone.position.x, position.z - drone.position.z) < 0.85 &&
      Math.abs(position.y + 0.95 - drone.position.y) < 1.25;
    // Visible scan bar is a real, telegraphed hazard: only collides when the
    // avatar is on the elevated route and overlaps the scanner at torso height.
    const scanHit = position.y > 1.9 &&
      Math.abs(position.x - scanner.position.x) < 1.68 &&
      Math.abs(position.z - scanner.position.z) < 0.35 &&
      position.y + 1.6 > scanner.position.y &&
      position.y < scanner.position.y + 0.2;
    return droneHit || scanHit;
  }
  function jumpPad(x, z) { return Math.hypot(x - course.pad.x, z - course.pad.z) < course.pad.radius; }
  function atFinish(position) {
    return Math.hypot(position.x - course.finish.x, position.z - course.finish.z) < course.finish.radius &&
      position.y >= 2.1;
  }
  function update(t) {
    for (const p of surfaces) {
      p.top = p.y + 0.06 + Math.sin(t * 1.5 + p.phase) * p.motion;
      p.holder.position.y = p.top - 0.06;
      p.deckCollider.minY = p.top - 0.27;
      p.deckCollider.maxY = p.top + 0.05;
    }
    const s = course.sentinel;
    drone.position.set(s.x + Math.sin(t * 1.25) * s.sweep, s.y + Math.sin(t * 2) * 0.14, s.z);
    drone.rotation.y = t * 0.7;
    scanner.position.x = course.scanner.x + Math.sin(t * 2.1) * course.scanner.sweep;
    hazardLight.position.x = scanner.position.x;
    for (const m of beamMaterials) m.opacity = 0.45 + 0.3 * Math.abs(Math.sin(t * 3));
    padRing.rotation.y = t * 0.65;
    finish.rotation.y = -t * 0.7;
  }
  return { update, attach, getSurfaceHeight, collision, hazard, jumpPad, atFinish, colliders };
}
