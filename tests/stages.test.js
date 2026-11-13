import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLevel } from '../src/level.js';
import { createEntities } from '../src/entities.js';
import { collidesWithSolid } from '../src/collisions.js';
import { TRAVERSAL } from '../src/platforming.js';
import { MISSIONS, STAGES, STAGE_MISSIONS } from '../src/campaign.js';
import { createRun } from '../src/progress.js';
import { createPlayer } from '../src/player.js';

// Exported by art/blender/build.py; the game loads the same files.
const load = (id) => JSON.parse(readFileSync(new URL(`../src/data/stages/${id}.json`, import.meta.url), 'utf8'));

// ------------------------------------------------------------------ jump graph
// Surfaces (floors, furniture tops, decks, pads) are nodes; an edge exists when Levi
// can jump from one to the other: rise within the double jump and a gap he can clear,
// without a collider too tall to hop over in the way.
const DOUBLE_RISE = (TRAVERSAL.firstJump ** 2 + TRAVERSAL.doubleJump ** 2) / (2 * TRAVERSAL.gravity) - 0.05;
const reach = (rise) => (rise <= 0 ? 9 : rise <= 1.9 ? 7 : 4.5);

function settle(data, flags) {
  const entities = createEntities(data.entities);
  for (let i = 0; i < 900; i++) entities.update(0, 1 / 60, flags, null);   // t = 0: authored motion at rest
  return entities;
}

function graph(data, flags) {
  const level = createLevel(data);
  const entities = settle(data, flags);
  const nodes = [];
  const rect = (id, x0, x1, z0, z1, y, extra = {}) => nodes.push({ id, minX: x0, maxX: x1, minZ: z0, maxZ: z1, y, rise: DOUBLE_RISE, ...extra });
  for (const f of data.floors) rect(f.id, f.minX, f.maxX, f.minZ, f.maxZ, f.y);
  for (const [i, w] of data.walkables.entries()) rect('top-' + i, w.x - w.halfX, w.x + w.halfX, w.z - w.halfZ, w.z + w.halfZ, w.height);
  for (const p of entities.ofType('platform')) {
    if (p.active) rect(p.id, p.x - p.w / 2, p.x + p.w / 2, p.z - p.d / 2, p.z + p.d / 2, p.y);
  }
  const launch = (v) => (v * v) / (2 * TRAVERSAL.gravity) + TRAVERSAL.doubleJump ** 2 / (2 * TRAVERSAL.gravity);
  for (const pad of entities.ofType('jumpPad')) {
    rect(pad.id, pad.x - 0.6, pad.x + 0.6, pad.z - 0.6, pad.z + 0.6, pad.y, { rise: launch(pad.power), pad: true });
  }
  for (const fan of entities.ofType('fan')) {
    const power = Math.min(1.25, Number(flags.fanPower) || 0);
    if (power > 0.05) rect(fan.id, fan.x - 1, fan.x + 1, fan.z - 1, fan.z + 1, fan.y, { rise: fan.height * power + 1.4, pad: true });
  }
  const tall = level.colliders;
  const blocked = (a, b) => {
    const ax = Math.max(a.minX, Math.min((b.minX + b.maxX) / 2, a.maxX));
    const az = Math.max(a.minZ, Math.min((b.minZ + b.maxZ) / 2, a.maxZ));
    const bx = Math.max(b.minX, Math.min(ax, b.maxX));
    const bz = Math.max(b.minZ, Math.min(az, b.maxZ));
    const cx = (b.minX + b.maxX) / 2 - (a.minX + a.maxX) / 2, cz = (b.minZ + b.maxZ) / 2 - (a.minZ + a.maxZ) / 2;
    const len = Math.hypot(cx, cz) || 1;
    const [x0, z0, x1, z1] = [ax - (cx / len) * 0.45, az - (cz / len) * 0.45, bx + (cx / len) * 0.45, bz + (cz / len) * 0.45];
    const top = Math.max(a.y, b.y);
    return tall.some((c) => c.maxY > Math.min(a.y, b.y) + 0.1 && c.maxY > top + DOUBLE_RISE - 0.3 && c.minY < top + 1.7 &&
      segmentHitsBox(x0, z0, x1, z1, c));
  };
  const edge = (a, b) => {
    const dx = Math.max(0, a.minX - b.maxX, b.minX - a.maxX);
    const dz = Math.max(0, a.minZ - b.maxZ, b.minZ - a.maxZ);
    const rise = b.y - a.y;
    const overlap = dx === 0 && dz === 0;
    if (overlap && a.pad && rise <= a.rise) return true;               // launched straight up
    if (overlap && b.pad && Math.abs(rise) < 0.4) return true;          // step onto the pad
    if (rise > a.rise) return false;
    if (Math.hypot(dx, dz) > (a.pad ? 7 : reach(rise))) return false;
    return !blocked(a, b);
  };
  return { nodes, edge, entities, level };
}

function segmentHitsBox(x0, z0, x1, z1, box) {
  let near = 0, far = 1;
  for (const [s, d, min, max] of [[x0, x1 - x0, box.minX, box.maxX], [z0, z1 - z0, box.minZ, box.maxZ]]) {
    if (Math.abs(d) < 1e-9) { if (s < min || s > max) return false; continue; }
    const a = (min - s) / d, b = (max - s) / d;
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
    if (near > far) return false;
  }
  return true;
}

function reachable(data, flags) {
  const { nodes, edge, entities, level } = graph(data, flags);
  const [sx, sy, sz] = data.spawn;
  const start = nodes.find((n) => sx >= n.minX && sx <= n.maxX && sz >= n.minZ && sz <= n.maxZ && Math.abs(n.y - sy) < 0.2);
  assert.ok(start, `${data.id}: spawn must stand on a floor`);
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const a = queue.shift();
    for (const b of nodes) if (!seen.has(b) && edge(a, b)) { seen.add(b); queue.push(b); }
  }
  // Can Levi touch a point (x, y, z)? Needs a reached surface below within one jump.
  const touches = (x, y, z, slack = 0.4) => [...seen].some((n) => x >= n.minX - slack && x <= n.maxX + slack &&
    z >= n.minZ - slack && z <= n.maxZ + slack && n.y <= y + 0.3 && y - n.y <= DOUBLE_RISE + 1.0);
  return { seen, touches, entities, level };
}

const solvedFlags = (id) => {
  const run = createRun(id);
  for (const m of STAGE_MISSIONS[id]) Object.assign(run.flags, MISSIONS[m].solvedFlags);
  return run.flags;
};
const initialFlags = (id) => createRun(id).flags;
const adminFlags = () => {
  const run = createRun('1-3');
  run.sheetFor('m03').applyFilter(1, '=', 'Administrativo');
  run.preview('m03');
  return run.flags;
};

// ------------------------------------------------------------------ tests
for (const { id } of STAGES) {
  const data = load(id);

  test(`${id}: data is consistent and the spawn is clear`, () => {
    const level = createLevel(data);
    const [x, y, z] = data.spawn;
    assert.equal(level.groundHeight(x, z, {}, y + 0.1), y);
    assert.ok(!collidesWithSolid(x, z, y, level.colliders), 'spawn inside a collider');
    assert.equal(data.assets.world, `stages/${id}/world.glb`);
    assert.ok(data.render.lightMapScale > 0, 'baked lightmap exposure');
    const ids = data.entities.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, 'entity ids are unique');
    assert.equal(data.entities.filter((e) => e.type === 'exit').length, 1);
    const terminals = data.entities.filter((e) => e.type === 'terminal').map((e) => e.mission).sort();
    assert.deepEqual(terminals, [...STAGE_MISSIONS[id]].sort(), 'one terminal per stage mission');
    for (const e of data.entities.filter((e) => e.type === 'checkpoint' || e.type === 'terminal')) {
      assert.ok(!collidesWithSolid(e.x, e.z, e.y, level.colliders) || e.type === 'terminal', `${e.id} placed inside a collider`);
    }
  });

  test(`${id}: exit, cubes and secrets are reachable once the missions are solved`, () => {
    const solved = reachable(data, solvedFlags(id));
    const alt = id === '1-3' ? reachable(data, adminFlags()) : solved;
    const exit = data.entities.find((e) => e.type === 'exit');
    assert.ok(solved.touches(exit.x, exit.y + 0.5, exit.z), 'exit unreachable');
    for (const e of data.entities.filter((e) => e.type === 'pickup' || e.type === 'secret')) {
      assert.ok(solved.touches(e.x, e.y, e.z) || alt.touches(e.x, e.y, e.z), `${e.id} at ${e.x},${e.y},${e.z} unreachable`);
    }
    for (const e of data.entities.filter((e) => e.type === 'terminal')) {
      assert.ok(solved.touches(e.x, e.y + 0.5, e.z, e.radius) || alt.touches(e.x, e.y + 0.5, e.z, e.radius), `terminal ${e.id} unreachable`);
    }
  });
}

test('1-1: the mezzanine exit needs the walkway at 4,5 m', () => {
  const data = load('1-1');
  const exit = data.entities.find((e) => e.type === 'exit');
  assert.ok(!reachable(data, initialFlags('1-1')).touches(exit.x, exit.y + 0.5, exit.z), 'reachable with the walkway retracted');
  const low = { ...solvedFlags('1-1'), walkway: 1 };
  assert.ok(!reachable(data, low).touches(exit.x, exit.y + 0.5, exit.z), 'reachable with the walkway too low');
});

test('1-2: mixed-up records lock the lifts and the top gallery is out of reach', () => {
  const data = load('1-2');
  const run = createRun('1-2');
  run.sheetFor('m02').sort(2, 'asc', false);
  run.preview('m02');
  const exit = data.entities.find((e) => e.type === 'exit');
  assert.ok(!reachable(data, run.flags).touches(exit.x, exit.y + 0.5, exit.z));
  // Sorted, the lifts climb 1,8 m per step and the last one sits under the gallery opening.
  const lifts = settle(data, solvedFlags('1-2')).ofType('platform').filter((p) => p.prefab.startsWith('lift_'))
    .sort((a, b) => a.x - b.x).map((p) => p.y);
  assert.deepEqual(lifts, [1.8, 3.6, 5.4, 7.2]);
});

test('1-3: the void needs the Judicial filter and the balcony needs the SOMA fan', () => {
  const data = load('1-3');
  const far = data.entities.find((e) => e.id === 'far');
  assert.ok(!reachable(data, initialFlags('1-3')).touches(far.x, far.y + 0.5, far.z), 'void crossable unpowered');
  const admin = reachable(data, adminFlags());
  assert.ok(!admin.touches(far.x, far.y + 0.5, far.z), 'administrative decks must not lead across');
  const master = data.entities.find((e) => e.mission === 'm04');
  assert.ok(admin.touches(master.x, master.y + 0.5, master.z, 2), 'secret room reachable over the administrative decks');
  const exit = data.entities.find((e) => e.type === 'exit');
  const noFan = { ...solvedFlags('1-3'), fanPower: 0 };
  assert.ok(!reachable(data, noFan).touches(exit.x, exit.y + 0.5, exit.z), 'balcony reachable without the fan');
});

test('player: a lift carries Levi and a dash breaks the barrier', () => {
  const data = { ...load('1-2') };
  const stage = { level: createLevel(data), entities: createEntities(data.entities), voidY: data.bounds.voidY };
  const player = createPlayer(stage);
  const flags = solvedFlags('1-2');
  player.placeAt({ x: 0, y: data.spawn[1], z: 1.8 });
  const step = (input) => {
    stage.entities.update(0, 1 / 60, flags, player.state);
    return player.step(1 / 60, { yaw: 0, ...input }, flags);
  };
  for (let i = 0; i < 20; i++) step({ z: -1 });
  const events = [];
  for (let i = 0; i < 30; i++) events.push(...step({ z: -1, dash: i === 0 }).events);
  assert.ok(events.some((e) => e.type === 'barrier'), 'dash breaks the door barrier');
  assert.ok(player.state.z < -0.5, 'Levi passes through the broken door');

  // Stand on L2 (slot 0 when sorted) and lower it: Levi rides along.
  const lift = stage.entities.byId.get('L2');
  for (let i = 0; i < 900; i++) stage.entities.update(0, 1 / 60, flags, null);
  player.placeAt({ x: lift.x, y: lift.y, z: lift.z });
  const lowered = { ...flags, lifts: { ...flags.lifts, L2: { slot: 0, y: 0.8 } } };
  for (let i = 0; i < 120; i++) {
    stage.entities.update(0, 1 / 60, lowered, player.state);
    player.step(1 / 60, { yaw: 0 }, lowered);
  }
  assert.ok(Math.abs(player.state.y - 0.8) < 0.05 && player.state.grounded, `rode the lift down (y=${player.state.y})`);
});
