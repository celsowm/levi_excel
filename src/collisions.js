// Compact, deterministic collision primitives shared by gameplay and tests.
// All dimensions are in world metres. Colliders are axis-aligned and describe
// gameplay solids; decorative geometry does not have to become a collider.
export const PLAYER_RADIUS = 0.42;
export const PLAYER_HEIGHT = 1.78;

export function boxCollider(id, x, z, width, depth, minY = 0, maxY = 2) {
  if (!(width > 0 && depth > 0 && maxY > minY)) throw new Error('Invalid collider: ' + id);
  return { id, minX: x - width / 2, maxX: x + width / 2,
    minZ: z - depth / 2, maxZ: z + depth / 2, minY, maxY };
}
export function circleBoxDistanceSq(x, z, box) {
  const dx = x - Math.max(box.minX, Math.min(x, box.maxX));
  const dz = z - Math.max(box.minZ, Math.min(z, box.maxZ));
  return dx * dx + dz * dz;
}
function verticalOverlap(footY, height, box) {
  return footY + height > box.minY + 0.02 && footY + 0.06 < box.maxY - 0.02;
}
export function collidesWithSolid(x, z, footY, boxes, radius = PLAYER_RADIUS, height = PLAYER_HEIGHT) {
  return boxes.some((box) => verticalOverlap(footY, height, box) &&
    circleBoxDistanceSq(x, z, box) < radius * radius - 1e-7);
}

function axisClear(candidateX, candidateZ, beforeX, beforeZ, footY, boxes, radius, height) {
  // If a legacy save or moving hazard starts inside geometry, permit escaping
  // but never permit movement deeper into that geometry.
  for (const box of boxes) {
    if (!verticalOverlap(footY, height, box)) continue;
    const end = circleBoxDistanceSq(candidateX, candidateZ, box);
    if (end >= radius * radius - 1e-7) continue;
    const start = circleBoxDistanceSq(beforeX, beforeZ, box);
    if (end <= start + 1e-9) return false;
  }
  return true;
}

// Move by short swept increments, resolve X then Z to slide around furniture.
// This avoids tunnelling when dashing, unlike an end-position-only overlap test.
// Typical 60 fps uses 1-2 substeps; the cap is only for exceptional frames.
export function moveWithCollisions(position, dx, dz, footY, boxes,
  radius = PLAYER_RADIUS, height = PLAYER_HEIGHT) {
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) throw new Error('Nonfinite movement');
  const length = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(length / (radius * 0.35)));
  const sx = dx / steps, sz = dz / steps;
  let x = position.x, z = position.z, hitX = false, hitZ = false;
  for (let i = 0; i < steps; i++) {
    const attemptX = x + sx;
    if (axisClear(attemptX, z, x, z, footY, boxes, radius, height)) x = attemptX;
    else hitX = true;
    const attemptZ = z + sz;
    if (axisClear(x, attemptZ, x, z, footY, boxes, radius, height)) z = attemptZ;
    else hitZ = true;
  }
  return { x, z, hitX, hitZ };
}

function segmentBoxIntersection(origin, vector, collider, padding) {
  const ranges = [
    [collider.minX - padding, collider.maxX + padding, origin.x, vector.x],
    [collider.minY - padding, collider.maxY + padding, origin.y, vector.y],
    [collider.minZ - padding, collider.maxZ + padding, origin.z, vector.z],
  ];
  let near = 0, far = 1;
  for (const [min, max, start, delta] of ranges) {
    if (Math.abs(delta) < 1e-9) {
      if (start < min || start > max) return null;
      continue;
    }
    const a = (min - start) / delta, b = (max - start) / delta;
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
    if (near > far) return null;
  }
  return near;
}

// Keeps the follow camera on the player's side of registered scene props.
export function shortenCameraArm(origin, desired, boxes, padding = 0.2) {
  const vector = {
    x: desired.x - origin.x,
    y: desired.y - origin.y,
    z: desired.z - origin.z,
  };
  let fraction = 1;
  for (const box of boxes) {
    const t = segmentBoxIntersection(origin, vector, box, padding);
    if (t !== null) fraction = Math.min(fraction, Math.max(0, t - 0.045));
  }
  return {
    x: origin.x + vector.x * fraction,
    y: origin.y + vector.y * fraction,
    z: origin.z + vector.z * fraction,
  };
}
