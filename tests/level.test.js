import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLevel } from '../src/level.js';
import { collidesWithSolid } from '../src/collisions.js';

// Exported by art/blender/build_world01.py; the game loads the same file.
const data = JSON.parse(readFileSync(new URL('../src/data/world01.level.json', import.meta.url), 'utf8'));
const level = createLevel(data);
const FLOOR = data.floors[0].y;

function find(id) {
  const box = level.colliders.find((c) => c.id === id);
  assert.ok(box, 'missing collider ' + id);
  return box;
}

// Flood fill on a 25 cm grid: every cell must be on a floor and clear of solids.
function reachable(from, flags) {
  const step = 0.25;
  const { minX, maxX, minZ, maxZ } = data.bounds;
  const key = (i, j) => i + ',' + j;
  const toWorld = (i, j) => [minX + i * step, minZ + j * step];
  const open = (i, j) => {
    const [x, z] = toWorld(i, j);
    return x <= maxX && z <= maxZ && level.floorHeight(x, z, flags) !== null &&
      !collidesWithSolid(x, z, FLOOR, level.colliders);
  };
  const start = [Math.round((from[0] - minX) / step), Math.round((from[2] - minZ) / step)];
  assert.ok(open(...start), 'spawn cell must be open');
  const seen = new Set([key(...start)]);
  const queue = [start];
  while (queue.length) {
    const [i, j] = queue.pop();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = [i + di, j + dj];
      if (n[0] < 0 || n[1] < 0 || seen.has(key(...n)) || !open(...n)) continue;
      seen.add(key(...n));
      queue.push(n);
    }
  }
  return (target, radius) => [...seen].some((k) => {
    const [x, z] = toWorld(...k.split(',').map(Number));
    return Math.hypot(x - target[0], z - target[1]) < radius;
  });
}

test('level export keeps the gameplay-critical solids of v0.2', () => {
  const desk = find('reception-desk');
  assert.deepEqual([desk.minX, desk.maxX, desk.minZ, desk.maxZ].map((v) => +v.toFixed(3)),
    [-11.775, -5.625, 9.3, 12.1]);
  assert.equal(find('terminal-FILTRO').maxY, 2.9);
  assert.equal(find('elevator-door').minZ, -21.44);
  assert.equal(+find('wall-left').maxX.toFixed(2), -13.71);
  assert.equal(level.colliders.filter((c) => c.id.startsWith('pilaster')).length, 10);
});

test('every spawn point stands on a floor and outside furniture', () => {
  for (const [name, [x, y, z]] of Object.entries(data.spawns)) {
    assert.equal(level.floorHeight(x, z, { bridge: true }), y, name);
    assert.equal(collidesWithSolid(x, z, y, level.colliders), false, name);
  }
});

test('the bridge slab only exists once the filter mission unlocks it', () => {
  assert.equal(level.floorHeight(0, -5), null);
  assert.equal(level.floorHeight(0, -5, { bridge: true }), FLOOR);
  assert.equal(level.floorHeight(5, -5, { bridge: true }), null);
});

test('reception desk is solid at floor level but walkable from above', () => {
  assert.equal(collidesWithSolid(-8.7, 10.7, FLOOR, level.colliders), true);
  assert.equal(level.groundHeight(-8.7, 10.7, {}, 0.11), FLOOR);
  assert.equal(level.groundHeight(-8.7, 10.7, {}, 1.7), 1.59);
});

test('mission route is walkable end to end and the archive is gated by the bridge', () => {
  const { reception, filter, sum, elevator } = data.interactables;
  const before = reachable(data.spawns.start, {});
  assert.ok(before(reception, 4.1), 'reception terminal reachable');
  assert.ok(before(filter, 3.1), 'filter terminal reachable');
  assert.ok(!before(sum, 3.1), 'archive must wait for the bridge');
  const after = reachable(data.spawns.start, { bridge: true });
  assert.ok(after(sum, 3.1), 'sum terminal reachable after the bridge');
  assert.ok(after(elevator, 3.7), 'elevator reachable after the bridge');
});

test('movement is clamped to the authored bounds', () => {
  const moved = level.resolveMove({ x: 0, z: 19 }, 0, 5, FLOOR);
  assert.equal(moved.z, data.bounds.maxZ);
});

test('hanging signs stop the camera but not Levi standing on the desk', () => {
  assert.equal(level.colliders.some((c) => c.id === 'sign-reception'), false);
  assert.equal(level.cameraColliders.some((c) => c.id === 'sign-reception'), true);
  assert.equal(collidesWithSolid(-8.6, 10.5, 1.59, level.colliders), false);
});
