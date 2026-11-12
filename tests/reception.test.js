import test from 'node:test';
import assert from 'node:assert/strict';
import { RECEPTION_ROWS, TARGET_RECORD, selectReceptionRecord } from '../src/reception-task.js';

test('first mission teaches row and column before formulas', () => {
  const found = selectReceptionRecord(TARGET_RECORD);
  assert.equal(found.success, true);
  assert.equal(found.rowNumber, 5);
  assert.equal(found.column, 'A');
  assert.equal(found.found.sector, 'Documentação');
});

test('incorrect or missing IDs are not silently accepted', () => {
  assert.equal(selectReceptionRecord('ATD-102').success, false);
  assert.equal(selectReceptionRecord('BAD'), null);
});

test('reading a record never mutates the supplied table', () => {
  const previous = JSON.stringify(RECEPTION_ROWS);
  selectReceptionRecord('ATD-103');
  assert.equal(JSON.stringify(RECEPTION_ROWS), previous);
  assert.ok(Object.isFrozen(RECEPTION_ROWS));
  assert.ok(RECEPTION_ROWS.every(row => Object.isFrozen(row)));
});
