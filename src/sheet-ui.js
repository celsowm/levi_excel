// Docked spreadsheet panel used by every terminal. The learner edits a real sheet
// (src/sheet.js); every change is previewed live in the world through run.preview().
import { MISSIONS } from './campaign.js';
import { cellName, colName, formatValue } from './sheet.js';

const OPERATORS = [['=', 'igual a (=)'], ['<>', 'diferente de (≠)'], ['<', 'menor que (<)'],
  ['<=', 'menor ou igual (≤)'], ['>', 'maior que (>)'], ['>=', 'maior ou igual (≥)']];
const TONE_ICON = { success: '✓', error: '!', info: 'i' };
const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function createSheetPanel(root, { onPreview, onSolve, onClose }) {
  let run = null, mission = null, sheet = null, unsubscribe = null;
  let selection = null;            // { col, row, wholeRow }
  let hintsShown = 0;
  let verdict = null;
  let editing = false;

  root.innerHTML = `
    <div class="sp-head">
      <div><span class="sp-code"></span><h2 class="sp-title"></h2></div>
      <button type="button" class="sp-close" aria-label="Fechar terminal (Esc)">×</button>
    </div>
    <details class="sp-brief" open><summary>Missão</summary><p class="sp-story"></p><p class="sp-task"></p></details>
    <div class="sp-tools"></div>
    <div class="sp-file"><span class="sp-pill">XLSX</span><span class="sp-filename"></span><span class="sp-status"></span></div>
    <div class="sp-formula"><span class="sp-namebox">A1</span><span class="sp-fx">fx</span>
      <input class="sp-input" type="text" autocomplete="off" spellcheck="false" aria-label="Conteúdo da célula" /></div>
    <div class="sp-grid-wrap"><table class="sp-grid" role="grid"></table></div>
    <p class="sp-feedback" role="status" aria-live="polite"></p>
    <p class="sp-fact"></p>
    <div class="sp-hints"></div>
    <div class="sp-actions">
      <button type="button" class="sp-hint-btn">DICA</button>
      <button type="button" class="sp-confirm primary-btn small" disabled>CONCLUIR ✓</button>
    </div>`;
  const $ = (s) => root.querySelector(s);
  const grid = $('.sp-grid'), input = $('.sp-input'), tools = $('.sp-tools');

  function renderTools() {
    const has = (tool) => mission.tools.includes(tool);
    const colOptions = sheet.columns.map((c, i) => `<option value="${i}">${colName(i)} · ${escape(c.label)}</option>`).join('');
    tools.innerHTML = [
      has('sort') ? `<div class="sp-group"><span class="sp-label">Classificar</span>
        <button type="button" data-act="asc">↑ Crescente</button><button type="button" data-act="desc">↓ Decrescente</button>
        <label class="sp-check"><input type="checkbox" class="sp-expand" checked /> Expandir seleção</label></div>` : '',
      has('filter') ? `<div class="sp-group"><span class="sp-label">Filtro</span>
        <select class="sp-fcol" aria-label="Coluna do filtro">${colOptions}</select>
        <select class="sp-fop" aria-label="Condição">${OPERATORS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
        <input class="sp-fval" type="text" placeholder="valor" aria-label="Valor do filtro" />
        <button type="button" data-act="filter">Aplicar</button><button type="button" data-act="clear">Limpar</button></div>` : '',
      has('undo') ? `<div class="sp-group"><button type="button" data-act="undo" title="Ctrl+Z">↶ Desfazer</button></div>` : '',
    ].join('');
  }

  function render() {
    const width = sheet.width;
    let html = `<thead><tr><th class="sp-corner"></th>${sheet.columns.map((_, c) =>
      `<th class="sp-col${selection?.col === c && !selection.wholeRow ? ' sel' : ''}${sheet.filter?.col === c ? ' filtered' : ''}" data-col="${c}">${colName(c)}${sheet.filter?.col === c ? ' ⏷' : ''}</th>`).join('')}</tr></thead><tbody>`;
    for (let row = 1; row <= sheet.lastRow; row++) {
      if (row > 1 && sheet.isHidden(row)) continue;
      const rowSel = selection?.row === row;
      html += `<tr class="${row === 1 ? 'sp-header-row' : ''}${rowSel && selection.wholeRow ? ' row-sel' : ''}">
        <th class="sp-rown${rowSel ? ' sel' : ''}${sheet.filter && row > 1 ? ' filtered' : ''}" data-row="${row}">${row}</th>`;
      for (let col = 0; col < width; col++) {
        const raw = sheet.raw({ col, row });
        const shown = row === 1 ? raw : sheet.display({ col, row });
        const formula = typeof raw === 'string' && raw.startsWith('=');
        const error = typeof shown === 'string' && shown.startsWith('#');
        const sel = rowSel && (selection.wholeRow || selection.col === col);
        html += `<td data-row="${row}" data-col="${col}" class="${sel ? 'sel' : ''}${formula ? ' formula' : ''}${error ? ' error' : ''}${typeof sheet.value({ col, row }) === 'number' && row > 1 ? ' num' : ''}">${escape(formatValue(shown))}</td>`;
      }
      html += '</tr>';
    }
    grid.innerHTML = html + '</tbody>';
    const visible = sheet.rows({ visibleOnly: true }).length;
    $('.sp-status').textContent = sheet.filter ? `${visible} de ${sheet.rowCount} linhas visíveis` : `${sheet.rowCount} linhas`;
    $('.sp-namebox').textContent = selection ? (selection.wholeRow ? `${selection.row}:${selection.row}` : cellName(selection.col, selection.row)) : '';
    if (!editing) {
      const raw = selection && !selection.wholeRow ? sheet.raw(selection) : '';
      input.value = typeof raw === 'number' ? formatValue(raw) : raw ?? '';
    }
    input.readOnly = !mission.tools.includes('edit') || !selection || selection.wholeRow || selection.row === 1;
    for (const button of tools.querySelectorAll('[data-act="undo"]')) button.disabled = !sheet.canUndo;
  }

  function evaluate() {
    verdict = run.preview(mission.id, { selection });
    onPreview?.(mission.id, verdict);
    const feedback = $('.sp-feedback');
    feedback.className = `sp-feedback ${verdict.tone}`;
    feedback.innerHTML = `<b>${TONE_ICON[verdict.tone] ?? 'i'}</b> ${escape(verdict.message)}`;
    $('.sp-confirm').disabled = !verdict.ok;
    $('.sp-confirm').classList.toggle('ready', verdict.ok);
  }

  function select(col, row, wholeRow = false) {
    editing = false;
    const rows = [1, ...Array.from({ length: sheet.rowCount }, (_, i) => i + 2).filter((r) => !sheet.isHidden(r))];
    if (!rows.includes(row)) row = rows.reduce((best, r) => (Math.abs(r - row) < Math.abs(best - row) ? r : best), rows[0]);
    selection = { col: Math.max(0, Math.min(sheet.width - 1, col)), row, wholeRow };
    render();
    evaluate();
  }

  function moveSelection(dc, dr) {
    if (!selection) return select(0, 2);
    const rows = [1, ...Array.from({ length: sheet.rowCount }, (_, i) => i + 2).filter((r) => !sheet.isHidden(r))];
    const index = rows.indexOf(selection.row);
    const row = rows[Math.max(0, Math.min(rows.length - 1, index + dr))];
    select(selection.col + dc, row);
  }

  function commit(advance = true) {
    if (!selection || input.readOnly) return;
    editing = false;
    sheet.set(selection, input.value);
    if (advance) moveSelection(0, 1);
    else render();
    grid.focus();
  }

  function startEditing(initial) {
    if (!selection || selection.wholeRow || !mission.tools.includes('edit') || selection.row === 1) return;
    editing = true;
    if (initial !== undefined) input.value = initial;
    input.focus();
  }

  function act(action) {
    const col = selection?.col ?? 0;
    if (action === 'asc' || action === 'desc') {
      if (!selection) return showLocal('Selecione uma célula da coluna que vai ordenar.');
      sheet.sort(col, action, root.querySelector('.sp-expand')?.checked ?? true);
    } else if (action === 'filter') {
      const ok = sheet.applyFilter(Number($('.sp-fcol').value), $('.sp-fop').value, $('.sp-fval').value);
      if (!ok) return showLocal('Escreva um valor para o filtro. Para menor/maior, use um número.');
    } else if (action === 'clear') sheet.clearFilter();
    else if (action === 'undo') sheet.undo();
  }

  function showLocal(message) {
    const feedback = $('.sp-feedback');
    feedback.className = 'sp-feedback info';
    feedback.innerHTML = `<b>i</b> ${escape(message)}`;
  }

  // ---------------------------------------------------------------- events
  grid.tabIndex = 0;
  grid.addEventListener('pointerdown', (event) => {
    const cell = event.target.closest('td, th');
    if (!cell) return;
    if (cell.dataset.col !== undefined && cell.tagName === 'TH') select(Number(cell.dataset.col), selection?.row ?? 2);
    else if (cell.classList.contains('sp-rown')) select(0, Number(cell.dataset.row), true);
    else if (cell.dataset.row) select(Number(cell.dataset.col), Number(cell.dataset.row));
    grid.focus({ preventScroll: true });
  });
  grid.addEventListener('dblclick', (event) => {
    if (event.target.closest('td')) startEditing();
  });
  grid.addEventListener('keydown', (event) => {
    const key = event.key;
    if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 'z') { event.preventDefault(); if (mission.tools.includes('undo')) sheet.undo(); return; }
    const arrows = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], Tab: [event.shiftKey ? -1 : 1, 0] };
    if (arrows[key]) { event.preventDefault(); moveSelection(...arrows[key]); return; }
    if (key === 'Enter' || key === 'F2') { event.preventDefault(); if (verdict?.ok && key === 'Enter' && !mission.tools.includes('edit')) confirm(); else startEditing(); return; }
    if ((key === 'Delete' || key === 'Backspace') && selection && !input.readOnly) { event.preventDefault(); input.value = ''; commit(false); return; }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !input.readOnly) { event.preventDefault(); startEditing(key); }
  });
  input.addEventListener('focus', () => { if (!input.readOnly) editing = true; });
  input.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Enter') { event.preventDefault(); commit(true); }
    else if (event.key === 'Tab') { event.preventDefault(); commit(false); moveSelection(event.shiftKey ? -1 : 1, 0); }
    else if (event.key === 'Escape') { event.preventDefault(); editing = false; render(); grid.focus(); }
  });
  tools.addEventListener('click', (event) => {
    const button = event.target.closest('[data-act]');
    if (button) act(button.dataset.act);
  });
  tools.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Enter' && event.target.classList.contains('sp-fval')) act('filter');
    if (event.key === 'Escape') close();
  });
  $('.sp-hint-btn').addEventListener('click', () => {
    if (hintsShown >= mission.hints.length) return;
    hintsShown++;
    renderHints();
  });
  $('.sp-close').addEventListener('click', () => close());
  $('.sp-confirm').addEventListener('click', () => confirm());
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    event.stopPropagation();
  });

  function renderHints() {
    const total = mission.hints.length;
    $('.sp-hints').innerHTML = mission.hints.slice(0, hintsShown).map((h, i) => `<p><b>DICA ${i + 1}</b> ${escape(h)}</p>`).join('');
    const button = $('.sp-hint-btn');
    button.hidden = total === 0;
    button.disabled = hintsShown >= total;
    button.textContent = hintsShown >= total ? 'SEM MAIS DICAS' : `DICA ${hintsShown + 1}/${total}`;
  }

  function confirm() {
    if (!verdict?.ok) return;
    const id = mission.id;
    close(true);
    onSolve?.(id);
  }

  function open(currentRun, missionId) {
    run = currentRun;
    mission = MISSIONS[missionId];
    sheet = run.sheetFor(missionId);
    selection = null;
    hintsShown = 0;
    editing = false;
    $('.sp-code').textContent = `${mission.code} · ${mission.skill.toUpperCase()}`;
    $('.sp-title').textContent = mission.title;
    $('.sp-story').innerHTML = mission.story;
    $('.sp-task').innerHTML = mission.task;
    $('.sp-fact').innerHTML = mission.fact;
    $('.sp-filename').textContent = mission.file;
    $('.sp-formula').hidden = !mission.tools.includes('edit');
    renderTools();
    renderHints();
    unsubscribe?.();
    unsubscribe = sheet.onChange(() => { render(); evaluate(); });
    root.classList.remove('hidden');
    document.body.classList.add('sheet-open');
    render();
    evaluate();
    if (!verdict.ok && verdict.tone !== 'error') showLocal(mission.tools.includes('edit') ? 'Clique numa célula para começar.' : 'Clique numa célula ou no número de uma linha.');
    requestAnimationFrame(() => grid.focus({ preventScroll: true }));
  }

  function close(solved = false) {
    if (!mission) return;
    unsubscribe?.();
    unsubscribe = null;
    root.classList.add('hidden');
    document.body.classList.remove('sheet-open');
    const id = mission.id;
    mission = null;
    onClose?.(id, solved);
  }

  return { open, close, isOpen: () => Boolean(mission), get missionId() { return mission?.id; } };
}
