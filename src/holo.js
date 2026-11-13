import * as THREE from 'three';

// Runtime holograms from the concept art: a floating spreadsheet over every terminal
// (with loose cells orbiting it) and glowing chevrons on the floor toward the goal.
// Canvas-drawn, additive and over-bright so the bloom pass makes them glow.

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

let sheetTexture = null;
function sheet() {
  sheetTexture ??= canvasTexture(512, 340, (g, w, h) => {
    roundRect(g, 6, 6, w - 12, h - 12, 22);
    g.fillStyle = 'rgba(40, 255, 190, 0.32)';
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(120, 255, 210, 0.95)';
    g.stroke();
    const cols = 6, rows = 6, x0 = 34, y0 = 52, cw = (w - 68) / cols, ch = (h - 86) / rows;
    g.fillStyle = 'rgba(120, 255, 210, 0.55)';
    g.fillRect(x0, y0, w - 68, ch);                      // header row
    for (const [c, r] of [[2, 2], [3, 2], [2, 3], [3, 3], [4, 3]]) {
      g.fillStyle = 'rgba(90, 255, 120, 0.75)';          // the "selected" block
      g.fillRect(x0 + c * cw + 2, y0 + r * ch + 2, cw - 4, ch - 4);
    }
    g.strokeStyle = 'rgba(150, 255, 220, 0.8)';
    g.lineWidth = 2;
    for (let c = 0; c <= cols; c++) { g.beginPath(); g.moveTo(x0 + c * cw, y0); g.lineTo(x0 + c * cw, y0 + rows * ch); g.stroke(); }
    for (let r = 0; r <= rows; r++) { g.beginPath(); g.moveTo(x0, y0 + r * ch); g.lineTo(x0 + cols * cw, y0 + r * ch); g.stroke(); }
    g.fillStyle = 'rgba(200, 255, 235, 0.9)';
    for (let r = 1; r < rows; r++) g.fillRect(x0 + 8, y0 + r * ch + ch / 2 - 2, cw * 0.45, 4);
    // Cursor
    g.beginPath();
    g.moveTo(w - 120, h - 92); g.lineTo(w - 120, h - 52); g.lineTo(w - 109, h - 62); g.lineTo(w - 99, h - 44);
    g.lineTo(w - 92, h - 48); g.lineTo(w - 101, h - 65); g.lineTo(w - 86, h - 66); g.closePath();
    g.fillStyle = 'rgba(255, 255, 255, 0.95)';
    g.fill();
  });
  return sheetTexture;
}

let cellTexture = null;
function cell() {
  cellTexture ??= canvasTexture(128, 128, (g, w, h) => {
    roundRect(g, 6, 6, w - 12, h - 12, 12);
    g.fillStyle = 'rgba(60, 255, 170, 0.28)';
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(140, 255, 210, 0.95)';
    g.stroke();
    g.strokeStyle = 'rgba(140, 255, 210, 0.7)';
    g.lineWidth = 3;
    for (const t of [1 / 3, 2 / 3]) {
      g.beginPath(); g.moveTo(6 + t * (w - 12), 6); g.lineTo(6 + t * (w - 12), h - 6); g.stroke();
      g.beginPath(); g.moveTo(6, 6 + t * (h - 12)); g.lineTo(w - 6, 6 + t * (h - 12)); g.stroke();
    }
  });
  return cellTexture;
}

let chevronTexture = null;
function chevron() {
  chevronTexture ??= canvasTexture(256, 128, (g, w, h) => {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(120, 255, 170, 1)';
    g.lineWidth = 22;
    g.beginPath(); g.moveTo(30, 100); g.lineTo(w / 2, 26); g.lineTo(w - 30, 100); g.stroke();
  });
  return chevronTexture;
}

const glow = (map, strength) => new THREE.MeshBasicMaterial({
  map, color: new THREE.Color(strength, strength, strength), transparent: true,
  blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
});

// Floating sheet + orbiting cells above a terminal at (x, y, z).
export function createTerminalHologram(x, y, z) {
  const group = new THREE.Group();
  group.position.set(x, y + 2.45, z);
  const panelMaterial = glow(sheet(), 2.2);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.4), panelMaterial);
  group.add(panel);
  const cellMaterial = glow(cell(), 1.6);
  const cells = [0, 1, 2].map((i) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), cellMaterial);
    group.add(mesh);
    return { mesh, phase: i * 2.1, radius: 1.45 + i * 0.12, height: 0.25 - i * 0.3 };
  });
  return {
    object: group,
    update(t, camera, state) {
      // Face the camera around Y, bob, and dim once the terminal's mission is done.
      group.rotation.y = Math.atan2(camera.position.x - group.position.x, camera.position.z - group.position.z);
      panel.position.y = Math.sin(t * 1.6) * 0.08;
      panel.rotation.z = Math.sin(t * 0.9) * 0.03;
      const target = state === 'done' ? 0.8 : state === 'current' ? 2.4 + Math.sin(t * 4) * 0.3 : 1.6;
      const level = THREE.MathUtils.lerp(panelMaterial.color.r, target, 0.08);
      panelMaterial.color.setScalar(level);
      cellMaterial.color.setScalar(level * 1.05);
      for (const c of cells) {
        const a = t * 0.7 + c.phase;
        c.mesh.position.set(Math.cos(a) * c.radius, c.height + Math.sin(t * 1.3 + c.phase) * 0.12, Math.sin(a) * 0.5);
        c.mesh.rotation.set(Math.sin(t + c.phase) * 0.4, a * 0.6, 0.2);
      }
    },
    dispose() {
      panel.geometry.dispose();
      panelMaterial.dispose();
      cellMaterial.dispose();
      for (const c of cells) c.mesh.geometry.dispose();
    },
  };
}

// Three chevrons on the floor ahead of Levi, pointing at the current goal.
export function createGoalChevrons(scene) {
  const material = glow(chevron(), 1.6);
  const geometry = new THREE.PlaneGeometry(0.9, 0.45);
  geometry.rotateX(-Math.PI / 2);
  const group = new THREE.Group();
  const marks = [0, 1, 2].map(() => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 3;
    group.add(mesh);
    return mesh;
  });
  scene.add(group);
  let fade = 0;
  return {
    update(t, dt, player, goal) {
      const dx = goal ? goal.x - player.x : 0;
      const dz = goal ? goal.z - player.z : 0;
      const distance = Math.hypot(dx, dz);
      const show = goal && player.grounded && distance > 4.5;
      fade = THREE.MathUtils.clamp(fade + (show ? dt : -dt) * 3, 0, 1);
      group.visible = fade > 0;
      if (!group.visible || !goal) return;
      const ux = dx / distance, uz = dz / distance;
      const yaw = Math.atan2(ux, uz);
      marks.forEach((mesh, i) => {
        // Marching pattern: each chevron pulses in turn, flowing toward the goal.
        const d = 1.5 + i * 0.75;
        mesh.position.set(player.x + ux * d, player.y + 0.025, player.z + uz * d);
        mesh.rotation.y = yaw + Math.PI;
        mesh.scale.setScalar(0.85 + 0.15 * Math.max(0, Math.sin(t * 5 - i * 1.2)));
      });
      material.opacity = fade * (0.75 + 0.25 * Math.sin(t * 5));
    },
  };
}
