import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS } from '../src/campaign.js';
import { createRun, createSave, medal } from '../src/progress.js';
import { createEntities } from '../src/entities.js';

test('goals advance in order and terminals open only for the current goal', () => {
  const run = createRun('1-1');
  assert.equal(run.currentGoal().id, 'm00');
  assert.equal(run.missionState('m01'), 'locked');
  assert.equal(run.flags.walkway, 0.6, 'untouched sheet publishes the retracted walkway');
  run.solveMission('m00');
  assert.equal(run.flags.courier, true);
  assert.equal(run.completeGoal('exit'), false, 'cannot skip ahead');
  assert.equal(run.completeGoal('follow'), true);
  assert.equal(run.missionState('m01'), 'open');
});

test('M01 previews the walkway height live and accepts only the mezzanine height', () => {
  const run = createRun('1-1');
  const sheet = run.sheetFor('m01');
  sheet.set('C4', '6');
  assert.equal(run.preview('m01').ok, false);
  assert.equal(run.flags.walkway, 6);
  sheet.set('C4', '4,5');
  assert.equal(run.preview('m01').ok, true);
  sheet.set('C2', '9');
  assert.match(run.preview('m01').message, /Desfazer/);
});

test('M02 lifts form a staircase only when whole records are sorted', () => {
  const run = createRun('1-2');
  const sheet = run.sheetFor('m02');
  sheet.sort(2, 'asc', false);
  assert.equal(run.preview('m02').ok, false);
  assert.ok(Object.values(run.flags.lifts).every((l) => l.locked), 'broken records lock the lifts');
  sheet.undo();
  sheet.sort(2, 'asc');
  assert.equal(run.preview('m02').ok, true);
  assert.deepEqual(run.flags.lifts.L3, { slot: 3, y: 7.2 });
});

test('M03 powers at most three platforms and only the Judicial set solves it', () => {
  const run = createRun('1-3');
  const sheet = run.sheetFor('m03');
  sheet.applyFilter(2, '<', 50);
  assert.match(run.preview('m03').message, /SOBRECARGA/);
  assert.ok(Object.values(run.flags.dataPlatforms).every((p) => !p.active));
  sheet.applyFilter(1, '=', 'Judicial');
  assert.equal(run.preview('m03').ok, true);
  assert.equal(run.flags.dataPlatforms.J2.active, true);
  assert.equal(run.flags.dataPlatforms.A2.active, false);
});

test('SOMA powers the fans only through a formula', () => {
  const run = createRun('1-3');
  const sheet = run.sheetFor('sum');
  sheet.set('C6', '32');
  assert.match(run.preview('sum').message, /à mão/);
  assert.equal(run.flags.fanPower, 0);
  sheet.set('C6', '=SOMA(C2:C4)');
  assert.match(run.preview('sum').message, /faltam 7/);
  sheet.set('C6', '=SOMA(C2:C5)');
  assert.equal(run.preview('sum').ok, true);
  assert.equal(run.flags.fanPower, 1);
  assert.equal(MISSIONS.m04.optional, true);
});

test('time trial starts with every mission solved and the save keeps records', () => {
  const run = createRun('1-2', { timeTrial: true });
  assert.equal(run.exitOpen(), true);
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const save = createSave(storage);
  run.time = 70;
  run.cubes.add('c1');
  const result = save.recordRun(run, { cubes: 8, secrets: 1 });
  assert.equal(result.record, true);
  assert.equal(createSave(storage).isUnlocked('1-3'), true);
  assert.equal(medal(70, 60), 'prata');
});

test('entities: bound lifts travel, data decks toggle, barriers break on dash', () => {
  const world = createEntities([
    { type: 'platform', id: 'L1', x: 0, y: 1, z: 0, w: 2.6, d: 2.6, bind: { flag: 'lifts', key: 'L1' }, slots: [[0, 0], [4, 0]] },
    { type: 'barrier', id: 'b', x: 0, y: 0, z: 5, width: 6 },
    { type: 'fan', id: 'f', x: 10, y: 0, z: 0, radius: 2, height: 10, bind: { flag: 'fanPower' } },
  ]);
  const flags = { lifts: { L1: { slot: 1, y: 3 } }, fanPower: 1 };
  for (let i = 0; i < 200; i++) world.update(i / 60, 1 / 60, flags);
  const lift = world.byId.get('L1');
  assert.deepEqual([lift.x, lift.y], [4, 3]);
  assert.equal(world.surface(4, 0, 3).height, 3);
  assert.equal(world.surface(4, 0, 1), null, 'feet too low to stand on the deck');
  const barrier = world.byId.get('b');
  assert.equal(barrier.tryBreak({ x: 0, y: 0, z: 4.2 }, false), false);
  assert.equal(barrier.tryBreak({ x: 0, y: 0, z: 4.2 }, true), true);
  assert.equal(world.solids().length, 1);
  assert.ok(world.byId.get('f').lift({ x: 10, y: 1, z: 0 }) > 0);
});
