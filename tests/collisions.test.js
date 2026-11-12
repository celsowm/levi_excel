import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER_RADIUS, boxCollider, collidesWithSolid, moveWithCollisions, shortenCameraArm } from '../src/collisions.js';

const table = boxCollider('desk', 0, 0, 2.8, 1.2, 0, 1.5);
const boxes = [table];

test('a desk is physically solid at Levi height', () => {
  assert.equal(collidesWithSolid(0, 0, 0.11, boxes), true);
  assert.equal(collidesWithSolid(4, 0, 0.11, boxes), false);
});

test('walking stops at the near edge of the desk', () => {
  const moved = moveWithCollisions({ x: 0, z: 2 }, 0, -3, 0.11, boxes);
  assert.ok(moved.z >= table.maxZ + PLAYER_RADIUS - 0.001);
  assert.ok(moved.z < 1.2);
  assert.equal(moved.hitZ, true);
});

test('fast dash never tunnels through furniture', () => {
  const moved = moveWithCollisions({ x: 0, z: 3 }, 0, -8, 0.11, boxes);
  assert.ok(moved.z >= table.maxZ + PLAYER_RADIUS - 0.001);
  assert.equal(moved.hitZ, true);
});

test('diagonal movement slides along the desk edge', () => {
  const moved = moveWithCollisions({ x: 0, z: 1.03 }, 1.2, -0.8, 0.11, boxes);
  assert.ok(moved.x > 0.8, 'Levi can still move sideways');
  assert.ok(moved.z >= table.maxZ + PLAYER_RADIUS - 0.001);
});

test('jumping fully above a low bench clears its volume', () => {
  const bench = boxCollider('bench', 0, 0, 2.8, 1.2, 0, 0.85);
  const moved = moveWithCollisions({ x: 0, z: 2 }, 0, -3, 1.15, [bench]);
  assert.ok(moved.z < -0.9);
});

test('camera shortens before it reaches a desk', () => {
  const from = { x: 0, y: 1, z: 2.4 };
  const ideal = { x: 0, y: 1.1, z: -4 };
  const result = shortenCameraArm(from, ideal, boxes);
  assert.ok(result.z > 0.6 && result.z < from.z);
  assert.deepEqual(shortenCameraArm(from, { x: 0, y: 3.7, z: 2.5 }, boxes),
    { x: 0, y: 3.7, z: 2.5 });
});

test('reception desk collision uses its actual world coordinates', () => {
  const reception = boxCollider('reception', -8.7, 10.7, 6.15, 2.8, 0, 1.64);
  const moved = moveWithCollisions({ x: -4.2, z: 10.7 }, -8, 0, 0.11, [reception]);
  assert.ok(moved.x >= reception.maxX + PLAYER_RADIUS - 0.001);
});
