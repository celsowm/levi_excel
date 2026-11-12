// Input and locomotion helpers, kept independent from Three.js for deterministic tests.
export function readMovementInput(isDown) {
  const x = Number(isDown('KeyD') || isDown('ArrowRight') || isDown('right'))
          - Number(isDown('KeyA') || isDown('ArrowLeft') || isDown('left'));
  const z = Number(isDown('KeyS') || isDown('ArrowDown') || isDown('down'))
          - Number(isDown('KeyW') || isDown('ArrowUp') || isDown('up'));
  const length = Math.hypot(x, z);
  return length ? { x: x / length, z: z / length } : { x: 0, z: 0 };
}

export function smoothVelocity(current, target, dt, responsiveness = 15) {
  const blend = 1 - Math.exp(-responsiveness * Math.max(0, dt));
  return current + (target - current) * blend;
}

// The original Levi GLB faces local +Z. No extra 180-degree offset is needed.
export function modelFacingYaw(x, z) {
  return Math.hypot(x, z) < 0.05 ? null : Math.atan2(x, z);
}

export function smoothYaw(current, target, dt, responsiveness = 22) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-responsiveness * Math.max(0, dt)));
}
