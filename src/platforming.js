// Pure action/platforming rules. No DOM, renderer or Three.js dependency.
export const TRAVERSAL = Object.freeze({
  gravity: 23, firstJump: 9.4, doubleJump: 8.1, jumpBuffer: 0.14,
  coyoteTime: 0.11, dashSpeed: 12.4, dashDuration: 0.23, dashCooldown: 0.9,
});

export function cameraRelativeMovement(x, z, yaw) {
  const sine = Math.sin(yaw), cosine = Math.cos(yaw);
  return { x: x * cosine + z * sine, z: z * cosine - x * sine };
}

export function createTraversal() {
  return { jumps: 0, coyote: TRAVERSAL.coyoteTime, buffer: 0,
    dashTime: 0, cooldown: 0, dashX: 0, dashZ: -1, padCooldown: 0 };
}
export function jumpInput(state) { state.buffer = TRAVERSAL.jumpBuffer; }
export function landed(state) { state.jumps = 0; state.coyote = TRAVERSAL.coyoteTime; }

export function advanceTimers(state, dt, grounded) {
  state.buffer = Math.max(0, state.buffer - dt);
  state.cooldown = Math.max(0, state.cooldown - dt);
  state.dashTime = Math.max(0, state.dashTime - dt);
  state.padCooldown = Math.max(0, state.padCooldown - dt);
  if (grounded) state.coyote = TRAVERSAL.coyoteTime;
  else state.coyote = Math.max(0, state.coyote - dt);
}

export function consumeJump(state, grounded) {
  if (state.buffer <= 0 || state.jumps >= 2) return 0;
  const first = state.jumps === 0;
  if (first && !(grounded || state.coyote > 0)) return 0;
  state.buffer = 0;
  state.coyote = 0;
  state.jumps++;
  return first ? TRAVERSAL.firstJump : TRAVERSAL.doubleJump;
}

export function startDash(state, x, z) {
  const magnitude = Math.hypot(x, z);
  if (state.cooldown > 0 || magnitude < 0.01) return false;
  state.dashTime = TRAVERSAL.dashDuration;
  state.cooldown = TRAVERSAL.dashCooldown;
  state.dashX = x / magnitude;
  state.dashZ = z / magnitude;
  return true;
}
export function isDashing(state) { return state.dashTime > 0; }
