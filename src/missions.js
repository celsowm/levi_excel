const DATA = [
  { id: 'PROC-101', type: 'Administrativo', days: 12 },
  { id: 'PROC-102', type: 'Judicial', days: 3 },
  { id: 'PROC-103', type: 'Judicial', days: 8 },
  { id: 'PROC-104', type: 'Administrativo', days: 2 },
  { id: 'PROC-105', type: 'Judicial', days: 4 },
  { id: 'PROC-106', type: 'Judicial', days: 15 },
];
const ENERGY = { C2: 8, C3: 12, C4: 5, C5: 7 };
const $ = (selector) => document.querySelector(selector);

function ids(rows) { return rows.map((r) => r.id).sort().join('|'); }

// Intentionally small and explicit: this is a tutorial, NOT an Excel-compatible formula engine.
export function evaluateTutorialFormula(input) {
  const raw = input.toUpperCase().replace(/\s/g, '').replace(/;/g, ',');
  if (!raw.startsWith('=')) return null;
  const sum = /^=(SOMA|SUM)\(C([2-5]):C([2-5])\)$/.exec(raw);
  if (sum) {
    const first = Number(sum[2]);
    const last = Number(sum[3]);
    if (first > last) return null;
    return Array.from({ length: last - first + 1 }, (_, i) => ENERGY[`C${first + i}`]).reduce((a, b) => a + b, 0);
  }
  const expr = raw.substring(1);
  if (/^C[2-5](\+C[2-5])+$/.test(expr)) {
    const refs = expr.split('+');
    if (new Set(refs).size !== refs.length) return null;
    return refs.reduce((sum, ref) => sum + ENERGY[ref], 0);
  }
  return null;
}

export function createMissionUI({ onFilterSolved, onSumSolved, onClosed }) {
  const modal = $('#mission-dialog');
  const filterSection = $('#filter-mission');
  const sumSection = $('#sum-mission');
  const feedbackFilter = $('#filter-feedback');
  const feedbackSum = $('#sum-feedback');
  const table = $('#filter-rows');
  let active = null;
  let filtered = [...DATA];
  let applied = false;

  function fillTable(rows) {
    table.replaceChildren();
    for (const [index, item] of rows.entries()) {
      const tr = document.createElement('tr');
      const values = [DATA.indexOf(item) + 2, item.id, item.type, item.days];
      for (const value of values) {
        const td = document.createElement('td');
        td.textContent = String(value);
        tr.append(td);
      }
      if (applied && item.days < 5) tr.classList.add('matched');
      table.append(tr);
    }
    $('#filter-count').textContent = `${rows.length} ${rows.length === 1 ? 'linha' : 'linhas'}`;
  }

  function open(name) {
    active = name;
    modal.classList.remove('hidden');
    filterSection.classList.toggle('hidden', name !== 'filter');
    sumSection.classList.toggle('hidden', name !== 'sum');
    $('#mission-title').textContent = name === 'filter' ? 'Reconstrução da ponte' : 'Energia do elevador';
    if (name === 'filter') {
      applied = false;
      filtered = [...DATA];
      $('#filter-column').value = 'C';
      $('#filter-operator').value = '<';
      $('#filter-value').value = '5';
      feedbackFilter.textContent = 'Dica: aplique o filtro à coluna que contém a quantidade de dias.';
      feedbackFilter.className = 'feedback';
      fillTable(filtered);
    } else {
      feedbackSum.textContent = 'Use =SOMA(intervalo) ou a soma das referências das células.';
      feedbackSum.className = 'feedback';
      $('#formula-input').value = '';
      $('#sum-display').textContent = '?';
      setTimeout(() => $('#formula-input').focus(), 60);
    }
  }
  function close() {
    active = null;
    modal.classList.add('hidden');
    onClosed?.();
  }
  function isOpen() { return active !== null; }

  function applyFilter() {
    const column = $('#filter-column').value;
    const operator = $('#filter-operator').value;
    const raw = $('#filter-value').value;
    const value = Number(raw);
    if (column !== 'C' || raw === '' || !Number.isFinite(value)) {
      feedbackFilter.textContent = 'Use a coluna C (prazo em dias) e informe um valor numérico.';
      feedbackFilter.className = 'feedback error';
      return;
    }
    const operations = {
      '<': (n) => n < value, '<=': (n) => n <= value,
      '>': (n) => n > value, '>=': (n) => n >= value,
      '=': (n) => n === value,
    };
    filtered = DATA.filter((row) => operations[operator](row.days));
    applied = true;
    fillTable(filtered);
    feedbackFilter.textContent = `Filtro aplicado: ${filtered.length} de ${DATA.length} registros visíveis.`;
    feedbackFilter.className = 'feedback info';
  }
  function validateFilter() {
    const expected = DATA.filter((row) => row.days < 5);
    if (!applied) {
      feedbackFilter.textContent = 'Primeiro aplique um filtro aos dados.';
      feedbackFilter.className = 'feedback error';
    } else if (ids(filtered) === ids(expected)) {
      feedbackFilter.textContent = 'Excelente! Você identificou os três prazos urgentes.';
      feedbackFilter.className = 'feedback success';
      close();
      onFilterSolved?.();
    } else {
      feedbackFilter.textContent = 'Ainda há registros fora da condição. Confira quais prazos são menores que 5.';
      feedbackFilter.className = 'feedback error';
    }
  }
  function validateSum() {
    const formula = $('#formula-input').value;
    const result = evaluateTutorialFormula(formula);
    $('#sum-display').textContent = result === null ? '?' : String(result);
    const expected = Object.values(ENERGY).reduce((a, b) => a + b, 0);
    if (result === null) {
      feedbackSum.textContent = 'Digite uma fórmula válida. Ex.: =SOMA(C2:C5).';
      feedbackSum.className = 'feedback error';
    } else if (result !== expected) {
      feedbackSum.textContent = `A fórmula calculou ${result}, mas ainda não soma todas as quatro células.`;
      feedbackSum.className = 'feedback error';
    } else {
      feedbackSum.textContent = `Correto! ${result} unidades de energia recuperadas.`;
      feedbackSum.className = 'feedback success';
      close();
      onSumSolved?.();
    }
  }

  $('#close-dialog').addEventListener('click', close);
  $('.modal-backdrop').addEventListener('click', close);
  $('#apply-filter').addEventListener('click', applyFilter);
  $('#validate-filter').addEventListener('click', validateFilter);
  $('#validate-sum').addEventListener('click', validateSum);
  $('#hint-formula').addEventListener('click', () => {
    feedbackSum.textContent = 'SOMA é a função que adiciona números: =SOMA(C2:C5). Os dois pontos indicam todo o intervalo.';
    feedbackSum.className = 'feedback info';
  });
  $('#formula-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') validateSum();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) close();
  });
  return { open, close, isOpen };
}
