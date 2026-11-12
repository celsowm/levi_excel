import { TARGET_RECORD, RECEPTION_ROWS, selectReceptionRecord } from './reception-task.js';

const $ = (selector) => document.querySelector(selector);

export function createReceptionMissionUI({ onSolved, onClosed }) {
  const modal = $('#reception-dialog');
  const body = $('#reception-rows');
  const feedback = $('#reception-feedback');
  const hint = $('#reception-hint-text');
  const nextHint = $('#reception-hint');
  let isActive = false;
  let hintLevel = 0;

  function renderRows() {
    body.replaceChildren();
    for (let i = 0; i < RECEPTION_ROWS.length; i++) {
      const record = RECEPTION_ROWS[i];
      const tr = document.createElement('tr');
      const indexCell = document.createElement('th');
      indexCell.scope = 'row';
      indexCell.className = 'rx-row-index';
      indexCell.textContent = String(i + 2);
      tr.append(indexCell);
      const td = document.createElement('td');
      td.colSpan = 3;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rx-record';
      button.dataset.recordId = record.id;
      button.setAttribute('aria-label', `Selecionar linha ${i + 2}: ${record.id}, ${record.sector}, ${record.floor}`);
      for (const value of [record.id, record.sector, record.floor]) {
        const label = document.createElement('span');
        label.textContent = value;
        button.append(label);
      }
      button.addEventListener('click', () => handleSelection(record.id, tr));
      td.append(button);
      tr.append(td);
      body.append(tr);
    }
  }

  function close() {
    isActive = false;
    modal.classList.add('hidden');
    onClosed?.();
  }
  function open() {
    if (isActive) return;
    isActive = true;
    hintLevel = 0;
    hint.textContent = 'Um registro é uma linha; cada coluna representa uma informação.';
    feedback.textContent = 'Localize ATD-104 na coluna A e selecione a linha correspondente.';
    feedback.className = 'rx-feedback';
    renderRows();
    modal.classList.remove('hidden');
    $('#reception-close').focus();
  }
  function handleSelection(id, tr) {
    if (!isActive) return;
    const result = selectReceptionRecord(id);
    for (const row of body.querySelectorAll('tr')) row.classList.remove('rx-selected');
    tr.classList.add('rx-selected');
    if (!result || !result.success) {
      feedback.textContent = 'Ainda não é esse registro. Compare o código na coluna A.';
      feedback.className = 'rx-feedback rx-error';
      return;
    }
    feedback.textContent = `Boa! ${TARGET_RECORD} está na célula A${result.rowNumber}. O destino é ${result.found.sector}.`;
    feedback.className = 'rx-feedback rx-success';
    close();
    onSolved?.(result);
  }
  nextHint.addEventListener('click', () => {
    hintLevel++;
    if (hintLevel === 1) hint.textContent = 'Procure a coluna A, chamada ID. Não é preciso usar fórmulas.';
    else if (hintLevel === 2) hint.textContent = 'Cada linha é um atendimento. A linha 5 contém o registro procurado.';
    else hint.textContent = 'Você pode clicar na linha inteira que começa com ATD-104.';
  });
  $('#reception-close').addEventListener('click', close);
  $('#reception-backdrop').addEventListener('click', close);
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Escape' && isActive) {
      event.preventDefault();
      close();
    }
  });
  return { open, close, isOpen: () => isActive };
}
