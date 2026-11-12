import * as THREE from 'three';
import { boxCollider } from './collisions.js';

// World 01 visual direction: warm civic-modern architecture with restrained
// technology accents. Built as a separate, reusable scene-art layer: it does
// not own collisions, learning state or the original Levi character.
export function createLobbyArt(scene) {
  const art = new THREE.Group();
  art.name = 'LobbyArchitectureV2';
  scene.add(art);
  // Physics and presentation share authored coordinates; do not infer collision
  // from arbitrary visible meshes at runtime.
  const colliders = [];
  const walkable = [];
  const solid = (id, x, z, width, depth, minY = 0, maxY = 2) =>
    colliders.push(boxCollider(id, x, z, width, depth, minY, maxY));

  const stone = new THREE.MeshStandardMaterial({ color: 0xe2e8df, roughness: 0.88, metalness: 0.02 });
  const pale = new THREE.MeshStandardMaterial({ color: 0xf6f2e8, roughness: 0.72, metalness: 0.05 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0x9a7752, metalness: 0.72, roughness: 0.27 });
  const navy = new THREE.MeshStandardMaterial({ color: 0x17354a, roughness: 0.45, metalness: 0.43 });
  const walnut = new THREE.MeshStandardMaterial({ color: 0x8a6651, roughness: 0.62, metalness: 0.03 });
  const mint = new THREE.MeshStandardMaterial({ color: 0x4cd5be, emissive: 0x168d7e, emissiveIntensity: 0.25, metalness: 0.12 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xc9f0e9, roughness: 0.14, metalness: 0.0,
    transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide
  });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x478975, roughness: 0.91 });
  const leafLight = new THREE.MeshStandardMaterial({ color: 0x71a486, roughness: 0.88 });
  const soil = new THREE.MeshStandardMaterial({ color: 0x4e423b, roughness: 1 });

  const shadow = (mesh, receive = true) => {
    mesh.castShadow = true;
    mesh.receiveShadow = receive;
    return mesh;
  };
  const cube = (width, height, depth, x, y, z, mat, parent = art) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return shadow(mesh);
  };
  const cyl = (r1, r2, h, x, y, z, mat, sides = 20, parent = art) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, sides), mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return shadow(mesh);
  };
  const tube = (points, radius, mat, segments = 28) => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 7, false), mat);
    art.add(mesh);
    return shadow(mesh, false);
  };

  // Variation belongs in one tiled texture, rather than thousands of floor
  // meshes. A fixed seeded pseudo-random sequence keeps previews repeatable.
  function tileTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e5e9e3';
    ctx.fillRect(0, 0, 512, 512);
    let seed = 0x1e71;
    const rand = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 3100; i++) {
      const lightness = Math.floor(58 + rand() * 24);
      ctx.fillStyle = 'hsla(165, 10%, ' + lightness + '%, ' + (0.025 + rand() * 0.08) + ')';
      const x = rand() * 512, y = rand() * 512;
      const size = 1.2 + rand() * 2.5;
      ctx.fillRect(x, y, size, size);
    }
    ctx.strokeStyle = 'rgba(71, 90, 91, .10)';
    ctx.lineWidth = 2;
    for (let n = 0; n <= 512; n += 128) {
      ctx.beginPath(); ctx.moveTo(n, 0); ctx.lineTo(n, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, n); ctx.lineTo(512, n); ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(5, 5);
    texture.anisotropy = 4;
    return texture;
  }
  const terrazzo = new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.79, metalness: 0.04 });
  // The old collision floors remain exactly where they are. These are flat
  // visual skins only, 25 mm above the original ground.
  cube(27.65, 0.025, 21.65, 0, 0.136, 9, terrazzo).castShadow = false;
  cube(27.65, 0.025, 13.65, 0, 0.136, -15, terrazzo).castShadow = false;

  // Narrow inlaid bands establish architectural rhythm; unobtrusive for jumps.
  for (const z of [-19.5, -13.5, -10, 1.1, 4.7, 8.7, 13.2, 17.8]) {
    for (const x of [-12.25, 12.25]) {
      cube(1.8, 0.012, 0.055, x, 0.157, z, bronze).castShadow = false;
    }
  }
  for (const x of [-12.6, 12.6]) {
    cube(0.045, 0.013, 39, x, 0.156, -1, bronze).castShadow = false;
  }

  // Tall pilasters and curved bronze mezzanine ribs. Nothing intersects the
  // main route at center, or the optional platform course along x=7..11.
  for (const z of [-19, -10.6, 0.6, 9.1, 18]) {
    for (const side of [-1, 1]) {
      const x = side * 12.85;
      cyl(0.41, 0.43, 11.8, x, 5.95, z, pale, 24);
      solid('pilaster-' + side + '-' + z, x, z, 0.9, 0.9, 0, 12);
      cyl(0.52, 0.52, 0.18, x, 11.84, z, bronze, 24);
      cyl(0.48, 0.48, 0.12, x, 0.21, z, bronze, 24);
    }
    tube([[-12.8, 11.8, z], [-8.5, 13.25, z], [0, 13.6, z],
          [8.5, 13.25, z], [12.8, 11.8, z]], 0.14, bronze, 38);
  }
  for (const z of [-14.7, -4.8, 5.6, 14.5]) {
    cube(24.8, 0.07, 0.27, 0, 13.42, z, pale);
  }
  // Soft skylights and layered roof lighting; much less saturated than v0.1.
  for (const z of [-13.9, -4, 6.2, 15.1]) {
    cube(13.2, 0.05, 3.15, 0, 13.55, z, glass).castShadow = false;
    for (const x of [-6.5, -3.2, 0, 3.2, 6.5]) {
      cube(0.032, 0.09, 3.3, x, 13.52, z, bronze).castShadow = false;
    }
  }

  // Sculpted information centerpiece, visible over the reception desk. The
  // rings are an architectural mobile, not a noisy "sci-fi portal".
  const rings = new THREE.Group();
  rings.position.set(-8.5, 7.2, 9.8);
  art.add(rings);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3 + i * 0.36, 0.043, 8, 54), i === 1 ? mint : bronze);
    ring.rotation.set(0.14 + i * 0.12, 0.1 + i * 0.4, i * 0.4);
    rings.add(ring);
  }
  cyl(0.18, 0.18, 0.34, -8.5, 7.2, 9.8, pale, 16);

  // A gently curved, believable visitor counter (beveled extruded footprint).
  // Positioned over the original reception without obstructing the route.
  const deskPath = new THREE.Shape();
  deskPath.moveTo(-11.7, -10.7);
  deskPath.quadraticCurveTo(-8.6, -9.3, -5.7, -10.7);
  deskPath.lineTo(-6.0, -12.1);
  deskPath.quadraticCurveTo(-8.6, -10.9, -11.4, -12.1);
  deskPath.closePath();
  const deskGeom = new THREE.ExtrudeGeometry(deskPath, {
    depth: 1.25, bevelEnabled: true, bevelSegments: 3, steps: 1,
    bevelSize: 0.075, bevelThickness: 0.06, curveSegments: 24
  });
  deskGeom.rotateX(-Math.PI / 2);
  const desk = new THREE.Mesh(deskGeom, walnut);
  desk.position.y = 0.23;
  art.add(shadow(desk));
  // Warm tactile desk top and a subtle floating service plaque.
  const deskTop = new THREE.Mesh(new THREE.ExtrudeGeometry(deskPath, {
    depth: 0.095, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.10, bevelThickness: 0.025, steps: 1
  }), pale);
  deskTop.geometry.rotateX(-Math.PI / 2);
  deskTop.position.y = 1.48;
  art.add(shadow(deskTop));
  solid('reception-desk', -8.7, 10.7, 6.15, 2.8, 0.08, 1.64);
  walkable.push({ x: -8.7, z: 10.7, halfX: 2.93, halfZ: 1.2, height: 1.59 });

  function plaque(lines, x, y, z, width = 5, height = 1.35, bright = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bright ? '#e6f3eb' : '#142c3c';
    ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = '#bf9573'; ctx.fillRect(50, 31, 7, 193);
    ctx.textAlign = 'left';
    ctx.fillStyle = bright ? '#17374a' : '#f5f3ea';
    ctx.font = '700 72px system-ui,Arial,sans-serif';
    ctx.fillText(lines[0], 91, 122, 865);
    ctx.fillStyle = bright ? '#607879' : '#a9d4cd';
    ctx.font = '400 39px system-ui,Arial,sans-serif';
    ctx.fillText(lines[1], 92, 185, 850);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    mesh.position.set(x, y, z);
    art.add(mesh);
    return mesh;
  }
  // One small architectural identifier instead of three gigantic floating
  // signboards, previously overlapping the old POC labels.
  cube(3.55, 0.95, 0.13, -8.5, 3.25, 9.12, pale);
  plaque(['PGE DIGITAL', 'RECEPÇÃO'], -8.5, 3.25, 9.22, 3.36, 0.85, true);

  // Indoor planters with authored silhouettes, not repeated identical spheres.
  function tree(x, z, height = 2.45, seed = 0) {
    const holder = new THREE.Group();
    holder.position.set(x, 0, z);
    art.add(holder);
    cyl(0.58, 0.52, 0.65, x, 0.46, z, navy, 14);
    solid('planter-' + seed, x, z, 1.16, 1.16, 0, 3.4);
    cyl(0.52, 0.52, 0.07, x, 0.815, z, soil, 14);
    cyl(0.095, 0.16, height, x, 0.85 + height / 2, z, walnut, 10);
    for (let i = 0; i < 7; i++) {
      const angle = (i + seed * 0.17) * Math.PI * 2 / 7;
      const y = height * (0.62 + (i % 3) * 0.09) + 0.9;
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.48 + (i % 3) * 0.065, 1), i % 2 ? leaf : leafLight);
      mesh.scale.set(0.9, 1.2, 0.72);
      mesh.position.set(x + Math.cos(angle) * 0.53, y, z + Math.sin(angle) * 0.52);
      art.add(shadow(mesh));
    }
  }
  tree(-11.35, 17.25, 2.55, 1);
  tree(-11.35, 2.9, 2.1, 2);
  tree(11.5, -17.5, 2.25, 3);

  // Small furniture groups sit outside gameplay routes.
  function bench(x, z, yaw = 0) {
    const sideways = Math.abs(Math.sin(yaw)) > 0.7;
    solid('bench-' + x + '-' + z, x, z, sideways ? 1 : 2.25, sideways ? 2.25 : 1, 0.0, 1.22);
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = yaw;
    art.add(group);
    const local = (w, h, d, px, py, pz, m) => cube(w, h, d, px, py, pz, m, group);
    local(2.1, 0.14, 0.62, 0, 0.55, 0, walnut);
    local(2.1, 0.6, 0.10, 0, 0.84, 0.31, walnut);
    for (const dx of [-0.86, 0.86]) local(0.09, 0.46, 0.52, dx, 0.28, 0, bronze);
  }
  bench(-10.6, 4.6, 0.07);
  bench(11.2, 1.0, Math.PI / 2);

  // Overhead wayfinding line: the right path leads to the launch station.
  // Arrow tips are decals, not new collision meshes.
  const arrows = [];
  for (let i = 0; i < 5; i++) {
    const x = 1.3 + i * 1.24;
    const z = 17.2 - i * 0.46;
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.58, 3), mint);
    arrow.rotation.x = Math.PI / 2;
    arrow.rotation.z = -Math.PI / 2;
    arrow.scale.setScalar(0.54);
    arrow.position.set(x, 0.178, z);
    art.add(arrow);
    arrows.push(arrow);
  }

  // Elevator architectural frame is intentionally separate from the existing
  // mission mechanism and colour-change state.
  for (const x of [-3.3, 3.3]) {
    cube(0.38, 7.1, 0.45, x, 3.55, -20.83, pale);
    cube(0.13, 6.9, 0.15, x + Math.sign(x) * 0.28, 3.55, -20.58, bronze);
  }
  cube(7.1, 0.37, 0.63, 0, 7.12, -20.81, pale);

  // A helper courier physically guides the player after the first literacy task.
  const courier = new THREE.Group();
  const courierBody = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 12), pale);
  const courierVisor = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), navy);
  courierVisor.scale.set(1.3, 0.8, 0.3);
  courierVisor.position.z = -0.28;
  const courierLamp = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), mint);
  courierLamp.position.y = 0.28;
  courier.add(courierBody, courierVisor, courierLamp);
  art.add(courier);
  const courierPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-8.4, 2.3, 10.6),
    new THREE.Vector3(-6.5, 2.6, 8.1),
    new THREE.Vector3(-2.9, 2.4, 4.6),
    new THREE.Vector3(0, 2.3, 1.7)
  ]);
  let receptionSolved = false, courierProgress = 0, lastTime = 0;
  function setReceptionSolved(value) { receptionSolved = Boolean(value); }

  // Floating architecture accents only: no flickering, no excessive bloom.
  function update(t) {
    const dt = Math.min(0.05, Math.max(0, t - lastTime));
    lastTime = t;
    if (receptionSolved) courierProgress = Math.min(1, courierProgress + dt * 0.20);
    const pos = courierPath.getPoint(courierProgress);
    courier.position.set(pos.x, pos.y + Math.sin(t * 2) * 0.08, pos.z);
    courier.rotation.y = -courierProgress * 0.8;
    rings.rotation.y = Math.sin(t * 0.13) * 0.08;
    rings.rotation.z = Math.sin(t * 0.22) * 0.035;
    const pulse = 0.18 + 0.08 * Math.sin(t * 2);
    mint.emissiveIntensity = pulse;
  }
  function getWalkableHeight(x, z, footY, lowerFloor) {
    let highest = lowerFloor;
    for (const top of walkable) {
      if (Math.abs(x - top.x) <= top.halfX && Math.abs(z - top.z) <= top.halfZ &&
          top.height <= footY + 0.2 && (highest === null || top.height > highest)) {
        highest = top.height;
      }
    }
    return highest;
  }
  return { update, setReceptionSolved, colliders, getWalkableHeight };
}
