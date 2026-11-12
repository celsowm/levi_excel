import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// A small authored action route inside the existing lobby. This is v2's first
// playable traversal slice, not a replacement for the later art-directed scene.
export function createActionCourse(scene) {
  const steel = new THREE.MeshStandardMaterial({ color: 0x34546a, metalness: 0.55, roughness: 0.45 });
  const edge = new THREE.MeshStandardMaterial({ color: 0x99d4c9, emissive: 0x217767, emissiveIntensity: 0.32, roughness: 0.32 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc49d6d, emissive: 0x52370f, emissiveIntensity: 0.2, metalness: 0.65 });
  const aqua = new THREE.MeshStandardMaterial({ color: 0x57d8be, emissive: 0x126e5b, emissiveIntensity: 0.55 });
  const danger = new THREE.MeshStandardMaterial({ color: 0xec6c9b, emissive: 0x9d194a, emissiveIntensity: 0.55, transparent: true, opacity: 0.72 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xe7e9e2, roughness: 0.8 });
  const brass = new THREE.MeshStandardMaterial({ color: 0x9a7956, metalness: 0.7, roughness: 0.3 });
  const group = new THREE.Group();
  scene.add(group);
  function block(w, h, d, x, y, z, material, parent = group) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(0.08, w / 6, h / 6, d / 6)), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function ring(radius, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.055, 8, 48), material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }
  function marker(title, x, z) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#14283b'; ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#ffe1a1'; ctx.fillRect(0, 0, 512, 6);
    ctx.fillStyle = '#f9ffff'; ctx.font = 'bold 34px system-ui,Arial,sans-serif';
    ctx.textAlign = 'center'; ctx.fillText(title, 256, 77);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.2),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
    panel.position.set(x, 4.15, z);
    group.add(panel);
  }

  // The first obstacle is on the route to the existing filter console.
  // It can be vaulted, bypassed, or shattered by a precisely timed dash.
  const barrier = new THREE.Group();
  barrier.position.set(0, 1.01, 9.55);
  group.add(barrier);
  // This barrier is an actual gameplay collision, with a clean architectural
  // frame and contained energy grille. Players can break it with a dash.
  block(6.65, 0.16, 0.38, 0, 1.01, 0, brass, barrier);
  block(6.65, 0.16, 0.38, 0, -1.0, 0, brass, barrier);
  block(0.17, 2.0, 0.38, -3.25, 0, 0, cream, barrier);
  block(0.17, 2.0, 0.38, 3.25, 0, 0, cream, barrier);
  for (let i = -5; i <= 5; i++) {
    block(0.035, 1.85, 0.075, i * 0.52, 0, 0, danger, barrier);
  }
  let barrierBroken = false;
  marker('CORREDOR / DASH', 0, 7.5);

  // Optional upper route: the wide launch pad is forgiving; elevated
  // platforms have broad landing surfaces and all sit above a safe ground floor.
  const pad = new THREE.Group();
  pad.position.set(8, 0.16, 16);
  group.add(pad);
  block(2.1, 0.28, 2.1, 0, 0, 0, steel, pad);
  const padRing = ring(0.87, 8, 0.38, 16, aqua);
  block(1.4, 0.035, 1.4, 0, 0.17, 0, aqua, pad);
  marker('CIRCUITO DO LEVI', 8.2, 19.0);

  const surfaces = [
    { x: 8.1, z: 13.2, w: 3.5, d: 2.9, y: 2.25, motion: 0, phase: 0 },
    { x: 9.6, z: 10.3, w: 3.5, d: 2.8, y: 2.55, motion: 0.24, phase: 0 },
    { x: 8.2, z: 7.3, w: 3.7, d: 2.7, y: 2.95, motion: 0.28, phase: Math.PI / 2 },
    { x: 7.1, z: 4.8, w: 3.7, d: 2.9, y: 2.4, motion: 0, phase: 0 },
  ];
  for (const surface of surfaces) {
    // A convincing mechanical support pole and track, aligned with platform
    // centers. These visuals have no additional gameplay collision.
    block(0.42, Math.max(0.4, surface.y - 0.15), 0.42,
      surface.x, Math.max(0.4, surface.y - 0.15) / 2, surface.z, brass);
    const holder = new THREE.Group();
    holder.position.set(surface.x, surface.y, surface.z);
    group.add(holder);
    block(surface.w, 0.27, surface.d, 0, -0.135, 0, steel, holder);
    block(surface.w - 0.12, 0.055, surface.d - 0.12, 0, 0.025, 0, cream, holder);
    block(surface.w - 0.34, 0.018, surface.d - 0.34, 0, 0.063, 0, steel, holder);
    for (const side of [-1, 1]) {
      block(0.055, 0.11, surface.d - 0.22, side * (surface.w / 2 - 0.08), 0.1, 0, gold, holder);
    }
    for (const dz of [-surface.d / 2 + 0.12, surface.d / 2 - 0.12]) {
      block(surface.w - 0.35, 0.025, 0.055, 0, 0.08, dz, edge, holder);
    }
    surface.holder = holder;
    surface.top = surface.y + 0.06;
  }
  const finish = ring(1.05, 7.1, surfaces[3].y + 0.16, 4.8, gold);
  const drone = new THREE.Group();
  const droneBody = new THREE.Mesh(new THREE.SphereGeometry(0.43, 16, 12), steel);
  const droneEye = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), danger);
  droneEye.position.z = -0.31; drone.add(droneBody, droneEye);
  group.add(drone);
  const beam = block(3.4, 0.10, 0.11, 9.25, 3.3, 8.7, danger);
  const emitterL = block(0.18, 0.58, 0.3, 7.5, 3.25, 8.7, brass);
  const emitterR = block(0.18, 0.58, 0.3, 11, 3.25, 8.7, brass);
  const hazardLight = new THREE.PointLight(0xff89ba, 2.5, 3.5, 2);
  hazardLight.position.set(9.25, 3.35, 8.7);
  group.add(hazardLight);

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
    if (barrierBroken || footY > 2.04) return 'clear';
    const crosses = Math.abs(next.x) < 3.3 && next.z > 9.2 && next.z < 9.9;
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
      Math.abs(position.x - beam.position.x) < 1.68 &&
      Math.abs(position.z - beam.position.z) < 0.35 &&
      position.y + 1.6 > beam.position.y &&
      position.y < beam.position.y + 0.2;
    return droneHit || scanHit;
  }
  function jumpPad(x, z) { return Math.hypot(x - 8, z - 16) < 1.04; }
  function atFinish(position) {
    return Math.hypot(position.x - 7.1, position.z - 4.8) < 1.12 &&
      position.y >= 2.1;
  }
  function update(t) {
    for (const p of surfaces) {
      p.top = p.y + 0.06 + Math.sin(t * 1.5 + p.phase) * p.motion;
      p.holder.position.y = p.top - 0.06;
    }
    drone.position.set(9.2 + Math.sin(t * 1.25) * 0.7, 3.5 + Math.sin(t * 2) * 0.14, 8.8);
    drone.rotation.y = t * 0.7;
    const sweep = Math.sin(t * 2.1) * 0.8;
    beam.position.x = 9.25 + sweep;
    emitterL.position.x = 7.5 + sweep;
    emitterR.position.x = 11 + sweep;
    hazardLight.position.x = 9.25 + sweep;
    beam.material.opacity = 0.45 + 0.3 * Math.abs(Math.sin(t * 3));
    padRing.rotation.z = t * 0.65;
    finish.rotation.z = -t * 0.7;
  }
  return { update, getSurfaceHeight, collision, hazard, jumpPad, atFinish };
}
