import test from 'node:test';
import assert from 'node:assert/strict';
import { createSheet, parseInput, parseRef, FormulaError } from '../src/sheet.js';

const energy = () => createSheet({
  columns: [{ label: 'Unidade' }, { label: 'Status' }, { label: 'Carga' }],
  rows: [['Arquivo', 'OK', 8], ['Atendimento', 'OK', 12], ['Documentação', 'OK', 5], ['Tecnologia', 'OK', 7], ['TOTAL', '', null]],
});
const errorOf = (fn) => {
  try { fn(); } catch (e) { assert.ok(e instanceof FormulaError, e.message); return e; }
  assert.fail('expected a FormulaError');
};

test('references and typed input follow the pt-BR spreadsheet conventions', () => {
  assert.deepEqual(parseRef('c5'), { col: 2, row: 5 });
  assert.equal(parseRef('C'), null);
  assert.equal(parseInput('4,5'), 4.5);
  assert.equal(parseInput(' 12 '), 12);
  assert.equal(parseInput('Judicial'), 'Judicial');
  assert.equal(parseInput(''), null);
  assert.equal(parseInput('=SOMA(C2:C5)'), '=SOMA(C2:C5)');
});

test('row 1 is the header and data starts at row 2', () => {
  const s = energy();
  assert.equal(s.raw('A1'), 'Unidade');
  assert.equal(s.raw('A2'), 'Arquivo');
  assert.equal(s.lastRow, 6);
  assert.equal(s.set('A1', 'x'), false, 'headers are read-only');
});

for (const [formula, expected] of [
  ['=SOMA(C2:C5)', 32], ['=soma(c2:c5)', 32], ['=SUM(C2:C5)', 32], ['= SOMA( C2 : C5 )', 32],
  ['=C2+C3+C4+C5', 32], ['=SOMA(C2;C3;C4;C5)', 32], ['=SOMA(C2:C3;C4:C5)', 32],
  ['=SOMA(C2:C4)', 25], ['=(C2+C3)*2', 40], ['=C3/C2', 1.5], ['=-C2+10', 2], ['=2,5*2', 5], ['=SOMA()', 0],
  ['=SOMA(A2:C5)', 32],
]) {
  test(`evaluates ${formula}`, () => assert.equal(energy().evaluate(formula), expected));
}

test('formula errors explain what is wrong in Portuguese', () => {
  const s = energy();
  assert.match(errorOf(() => s.evaluate('SOMA(C2:C5)')).message, /sinal de igual/);
  assert.match(errorOf(() => s.evaluate('=SOMA(C2:C5')).message, /parêntese/);
  assert.match(errorOf(() => s.evaluate('=SOMA(C2:C5))')).message, /sobrando/);
  assert.match(errorOf(() => s.evaluate('=SOMA(C2:C9)')).message, /fora da tabela|sai da tabela/);
  assert.match(errorOf(() => s.evaluate('=C5:C2')).message, /dentro de uma função/);
  assert.match(errorOf(() => s.evaluate('=SOMA(C5:C2)')).message, /início para o fim/);
  assert.equal(errorOf(() => s.evaluate('=PROCV(C2)')).code, '#NOME?');
  assert.equal(errorOf(() => s.evaluate('=A2+1')).code, '#VALOR!');
  assert.equal(errorOf(() => s.evaluate('=C2/0')).code, '#DIV/0!');
  assert.match(errorOf(() => s.evaluate('=C2 C3')).message, /operador/);
  assert.match(errorOf(() => s.evaluate('=C1+1')).message, /cabeçalho/);
  assert.match(errorOf(() => s.evaluate('=')).message, /Depois do =/);
  assert.match(errorOf(() => s.evaluate('=C2 & C3')).message, /não é aceito/);
});

test('formula cells are evaluated, displayed and protected against cycles', () => {
  const s = energy();
  s.set('C6', '=SOMA(C2:C5)');
  assert.equal(s.value('C6'), 32);
  assert.equal(s.display('C6'), '32');
  s.set('C2', 10);
  assert.equal(s.value('C6'), 34, 'formulas recalculate');
  s.set('C6', '=C6+1');
  assert.equal(s.display('C6'), '#REF!');
  assert.deepEqual([...s.referencedCells('=SOMA(C2:C4)+B2')].sort(), ['B2', 'C2', 'C3', 'C4']);
});

test('sorting keeps whole records together unless the selection is not expanded', () => {
  const s = createSheet({ columns: [{ label: 'Elevador' }, { label: 'Setor' }, { label: 'Altura' }],
    rows: [['L1', 'Arquivo', 5.4], ['L2', 'Protocolo', 1.8], ['L3', 'Gabinete', 7.2], ['L4', 'Cadastro', 3.6]] });
  s.sort(2, 'asc');
  assert.deepEqual(s.rows(), [['L2', 'Protocolo', 1.8], ['L4', 'Cadastro', 3.6], ['L1', 'Arquivo', 5.4], ['L3', 'Gabinete', 7.2]]);
  s.sort(0, 'desc');
  assert.deepEqual(s.rows().map((r) => r[0]), ['L4', 'L3', 'L2', 'L1']);
  s.undo(); s.undo();
  s.sort(2, 'asc', false);
  assert.deepEqual(s.rows()[0], ['L1', 'Arquivo', 1.8], 'only column C moved: the record is broken');
  assert.equal(s.undo(), true);
  assert.deepEqual(s.rows()[0], ['L1', 'Arquivo', 5.4]);
});

test('text sorting is alphabetical in pt-BR and blanks go last', () => {
  const s = createSheet({ columns: [{ label: 'Nome' }], rows: [['Órgão'], [null], ['Arquivo'], ['Zona'], ['ata']] });
  s.sort(0);
  assert.deepEqual(s.rows().map((r) => r[0]), ['Arquivo', 'ata', 'Órgão', 'Zona', null]);
});

test('filters hide rows without deleting them and can be cleared or undone', () => {
  const s = createSheet({ columns: [{ label: 'ID' }, { label: 'Setor' }, { label: 'Prazo' }],
    rows: [['P1', 'Judicial', 3], ['P2', 'Administrativo', 12], ['P3', 'judicial', 8], ['P4', 'Administrativo', 2]] });
  assert.equal(s.applyFilter(1, '=', 'Judicial'), true);
  assert.deepEqual(s.rows({ visibleOnly: true }).map((r) => r[0]), ['P1', 'P3'], 'text match ignores case');
  assert.equal(s.rows().length, 4, 'hidden rows still exist');
  assert.equal(s.isHidden(3), true);
  s.applyFilter(2, '<', 5);
  assert.deepEqual(s.rows({ visibleOnly: true }).map((r) => r[0]), ['P1', 'P4']);
  assert.equal(s.applyFilter(2, '<', 'abc'), false, 'numeric operators need numbers');
  s.clearFilter();
  assert.equal(s.rows({ visibleOnly: true }).length, 4);
  s.undo();
  assert.deepEqual(s.filter, { col: 2, operator: '<', value: 5 });
  s.sort(0, 'desc');
  assert.deepEqual(s.rows({ visibleOnly: true }).map((r) => r[0]), ['P4', 'P1'], 'sorting keeps the filter');
});

test('edits notify listeners and are undoable', () => {
  const s = energy();
  const events = [];
  s.onChange((kind) => events.push(kind));
  assert.equal(s.set('C3', '4,5'), true);
  assert.equal(s.value('C3'), 4.5);
  assert.equal(s.set('C3', '4.5'), false, 'same value is not a change');
  s.undo();
  assert.equal(s.value('C3'), 12);
  assert.deepEqual(events, ['edit', 'undo']);
  assert.equal(s.undo(), false);
});
