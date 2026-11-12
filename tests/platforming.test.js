import test from 'node:test';
import assert from 'node:assert/strict';
import { TRAVERSAL, cameraRelativeMovement, createTraversal, jumpInput, advanceTimers, consumeJump, landed, startDash, isDashing } from '../src/platforming.js';

test('camera-relative WASD preserves initial direction and rotates correctly', () => {
  assert.deepEqual(cameraRelativeMovement(0, -1, 0), {x: 0, z: -1});
  const rotated = cameraRelativeMovement(0, -1, Math.PI / 2);
  assert.ok(Math.abs(rotated.x + 1) < 1e-10);
  assert.ok(Math.abs(rotated.z) < 1e-10);
  const direction = cameraRelativeMovement(1, 0, Math.PI / 2);
  assert.ok(Math.abs(direction.z + 1) < 1e-10);
});
test('double jump works once in air, cannot triple jump, reset on landing', () => {
  const t = createTraversal();
  jumpInput(t);
  assert.equal(consumeJump(t, true), TRAVERSAL.firstJump);
  advanceTimers(t, 0.016, false);
  jumpInput(t);
  assert.equal(consumeJump(t, false), TRAVERSAL.doubleJump);
  jumpInput(t);
  assert.equal(consumeJump(t, false), 0);
  landed(t);
  jumpInput(t);
  assert.equal(consumeJump(t, true), TRAVERSAL.firstJump);
});
test('coyote jump and jump buffering are forgiving but bounded', () => {
  const t = createTraversal();
  advanceTimers(t, 0.05, false);
  jumpInput(t);
  assert.equal(consumeJump(t, false), TRAVERSAL.firstJump);
  const other = createTraversal();
  advanceTimers(other, 0.2, false);
  jumpInput(other);
  assert.equal(consumeJump(other, false), 0);
  advanceTimers(other, 0.16, false);
  assert.equal(other.buffer, 0);
});
test('dash uses normalized heading and respects cooldown and expiration', () => {
  const t = createTraversal();
  assert.equal(startDash(t, 3, 4), true);
  assert.ok(isDashing(t));
  assert.ok(Math.abs(Math.hypot(t.dashX, t.dashZ) - 1) < 1e-12);
  assert.equal(startDash(t, 1, 0), false);
  advanceTimers(t, TRAVERSAL.dashDuration + 0.01, false);
  assert.equal(isDashing(t), false);
  assert.equal(startDash(t, 1, 0), false);
  advanceTimers(t, 1.0, false);
  assert.equal(startDash(t, 1, 0), true);
});
