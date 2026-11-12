import test from 'node:test';
import assert from 'node:assert/strict';
import { readMovementInput, smoothVelocity, modelFacingYaw, smoothYaw } from '../src/movement.js';

test('W walks into the scene (-Z), S toward the camera (+Z)', () => {
  assert.deepEqual(readMovementInput((key) => key === 'KeyW'), { x: 0, z: -1 });
  assert.deepEqual(readMovementInput((key) => key === 'KeyS'), { x: 0, z: 1 });
});

test('keyboard and touch left/right map to the intended direction', () => {
  assert.deepEqual(readMovementInput((key) => key === 'KeyA'), { x: -1, z: 0 });
  assert.deepEqual(readMovementInput((key) => key === 'right'), { x: 1, z: 0 });
});

test('diagonal input does not move faster than straight input', () => {
  const input = readMovementInput((key) => ['KeyW', 'KeyD'].includes(key));
  assert.ok(Math.abs(Math.hypot(input.x, input.z) - 1) < 1e-12);
  assert.ok(input.x > 0 && input.z < 0);
});

test('the original GLB faces +Z; W turns it to -Z, not the reverse', () => {
  assert.equal(modelFacingYaw(0, 1), 0);
  assert.equal(modelFacingYaw(0, -1), Math.PI);
  assert.equal(modelFacingYaw(1, 0), Math.PI / 2);
  assert.equal(modelFacingYaw(-1, 0), -Math.PI / 2);
  assert.equal(modelFacingYaw(0, 0), null);
});

test('turn interpolation uses the shortest route across the +/-PI boundary', () => {
  const before = 3.10;
  const after = smoothYaw(before, -3.10, 1 / 60);
  assert.ok(after > before && after < before + 0.1);
});

test('acceleration and braking approach target without overshoot', () => {
  let current = 0;
  for (let i = 0; i < 12; i++) current = smoothVelocity(current, 4.8, 1 / 60);
  assert.ok(current > 4.5 && current < 4.8);
  for (let i = 0; i < 12; i++) current = smoothVelocity(current, 0, 1 / 60, 22);
  assert.ok(current < 0.1 && current > 0);
});
