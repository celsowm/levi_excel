import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateTutorialFormula } from '../src/missions.js';

test('SOMA de intervalo, em português', () => {
  assert.equal(evaluateTutorialFormula('=SOMA(C2:C5)'), 32);
});
test('SUM em inglês também funciona', () => {
  assert.equal(evaluateTutorialFormula('=SUM(C2:C5)'), 32);
});
test('referências explícitas e espaços', () => {
  assert.equal(evaluateTutorialFormula('= C2 + C3 + C4 + C5'), 32);
});
test('não aceita resultado sem fórmula', () => {
  assert.equal(evaluateTutorialFormula('32'), null);
});
test('não duplica células na soma manual', () => {
  assert.equal(evaluateTutorialFormula('=C2+C2+C3+C4+C5'), null);
});
test('intervalos válidos diferentes podem retornar resultado parcial', () => {
  assert.equal(evaluateTutorialFormula('=SOMA(C3:C5)'), 24);
});
test('intervalo invertido é inválido', () => {
  assert.equal(evaluateTutorialFormula('=SOMA(C5:C2)'), null);
});
