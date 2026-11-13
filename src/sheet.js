// Didactic spreadsheet model used by every terminal. Pure: no DOM, no Three.js.
// Row 1 is the header (as in Excel); data rows start at 2. Columns are A, B, C...
// This is a deliberately small subset of Excel and the UI says so.

export class FormulaError extends Error {
  constructor(message, code = '#ERRO!') {
    super(message);
    this.code = code;
  }
}

export const colName = (index) => String.fromCharCode(65 + index);
export const colIndex = (letter) => letter.toUpperCase().charCodeAt(0) - 65;
export const cellName = (col, row) => colName(col) + row;

export function parseRef(text) {
  const m = /^([A-Za-z])(\d{1,3})$/.exec(String(text).trim());
  return m ? { col: colIndex(m[1]), row: Number(m[2]) } : null;
}

// Typed input: "=..." stays a formula, "4,5" / "4.5" become numbers, the rest is text.
export function parseInput(text) {
  const raw = String(text ?? '').trim();
  if (raw === '') return null;
  if (raw.startsWith('=')) return raw;
  if (/^-?\d+([.,]\d+)?$/.test(raw)) return Number(raw.replace(',', '.'));
  return raw;
}

export function formatValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000).replace('.', ',');
  }
  return String(value);
}

const FUNCTIONS = {
  SOMA: (values) => values.reduce((a, b) => a + b, 0),
};
const ALIASES = { SUM: 'SOMA' };

function tokenize(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const rest = source.slice(i);
    const space = /^\s+/.exec(rest);
    if (space) { i += space[0].length; continue; }
    const ref = /^[A-Za-z]\d{1,3}(?![\w.])/.exec(rest);
    const number = /^\d+([.,]\d+)?/.exec(rest);
    const name = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.]*/.exec(rest);
    if (ref) tokens.push({ type: 'ref', value: ref[0].toUpperCase() });
    else if (number) tokens.push({ type: 'num', value: Number(number[0].replace(',', '.')) });
    else if (name) tokens.push({ type: 'name', value: name[0].toUpperCase() });
    else if ('+-*/():;,'.includes(rest[0])) tokens.push({ type: rest[0] });
    else throw new FormulaError(`O caractere "${rest[0]}" não é aceito em fórmulas.`);
    i += (ref || number || name || [rest[0]])[0].length;
  }
  return tokens;
}

export function createSheet({ columns, rows }) {
  // columns: [{ label, type? }]; rows: arrays of raw values (data rows, from row 2).
  const width = columns.length;
  let data = rows.map((r) => Array.from({ length: width }, (_, c) => r[c] ?? null));
  let hidden = new Set();
  let filter = null;
  const history = [];
  const listeners = new Set();

  const lastRow = () => data.length + 1;
  const inside = ({ col, row }) => col >= 0 && col < width && row >= 1 && row <= lastRow();
  const snapshot = () => ({ data: data.map((r) => [...r]), hidden: new Set(hidden), filter });
  const changed = (kind) => listeners.forEach((fn) => fn(kind));

  function raw(ref) {
    const r = typeof ref === 'string' ? parseRef(ref) : ref;
    if (!r || !inside(r)) return null;
    return r.row === 1 ? columns[r.col].label : data[r.row - 2][r.col];
  }

  function value(ref, stack = new Set()) {
    const r = typeof ref === 'string' ? parseRef(ref) : ref;
    const content = raw(r);
    if (typeof content === 'string' && content.startsWith('=')) {
      const key = cellName(r.col, r.row);
      if (stack.has(key)) throw new FormulaError(`Referência circular em ${key}.`, '#REF!');
      stack.add(key);
      try { return evaluate(content, stack); } finally { stack.delete(key); }
    }
    return content;
  }

  // Recursive-descent evaluator: + - * /, parentheses, references, ranges inside functions.
  function evaluate(formula, stack = new Set()) {
    const text = String(formula).trim();
    if (!text.startsWith('=')) throw new FormulaError('Toda fórmula começa com o sinal de igual (=).');
    if (text.length === 1) throw new FormulaError('Depois do = escreva o cálculo, por exemplo =SOMA(C2:C5).');
    const tokens = tokenize(text.slice(1));
    let pos = 0;
    const peek = () => tokens[pos];
    const take = (type) => (peek()?.type === type ? tokens[pos++] : null);

    const refValue = (name) => {
      const r = parseRef(name);
      if (!inside(r)) throw new FormulaError(`A célula ${name} está fora da tabela.`, '#REF!');
      if (r.row === 1) throw new FormulaError(`${name} é o cabeçalho; use as linhas de dados (a partir da 2).`);
      return value(r, stack);
    };
    const asNumber = (v, name) => {
      if (v === null) return 0;
      if (typeof v !== 'number') throw new FormulaError(`${name} contém texto, não um número.`, '#VALOR!');
      return v;
    };
    function rangeValues(from, to) {
      const a = parseRef(from), b = parseRef(to);
      if (!inside(a) || !inside(b)) throw new FormulaError(`O intervalo ${from}:${to} sai da tabela.`, '#REF!');
      if (a.col > b.col || a.row > b.row) throw new FormulaError(`Escreva o intervalo do início para o fim: ${to}:${from} em vez de ${from}:${to}.`);
      const out = [];
      for (let row = a.row; row <= b.row; row++) {
        for (let col = a.col; col <= b.col; col++) {
          if (row === 1) continue;
          const v = value({ col, row }, stack);
          if (typeof v === 'number') out.push(v);
        }
      }
      return out;
    }
    function args() {
      const list = [];
      if (take(')')) return list;
      do {
        const t = peek();
        if (t?.type === 'ref' && tokens[pos + 1]?.type === ':') {
          pos += 2;
          const end = take('ref');
          if (!end) throw new FormulaError('Um intervalo precisa de duas células, como C2:C5.');
          list.push(...rangeValues(t.value, end.value));
        } else {
          list.push(expression());
        }
      } while (take(';') || take(','));
      if (!take(')')) throw new FormulaError('Falta fechar o parêntese ")".');
      return list;
    }
    function factor() {
      const t = peek();
      if (!t) throw new FormulaError('A fórmula terminou antes da hora.');
      if (take('-')) return -factor();
      if (take('+')) return factor();
      if (take('num')) return t.value;
      if (take('(')) {
        const v = expression();
        if (!take(')')) throw new FormulaError('Falta fechar o parêntese ")".');
        return v;
      }
      if (t.type === 'ref') {
        pos++;
        if (peek()?.type === ':') throw new FormulaError('Um intervalo como C2:C5 só funciona dentro de uma função, por exemplo =SOMA(C2:C5).');
        return asNumber(refValue(t.value), t.value);
      }
      if (t.type === 'name') {
        pos++;
        const name = ALIASES[t.value] ?? t.value.normalize('NFD').replace(/[̀-ͯ]/g, '');
        const fn = FUNCTIONS[name];
        if (!fn) throw new FormulaError(`A função ${t.value} não existe neste simulador. Tente SOMA.`, '#NOME?');
        if (!take('(')) throw new FormulaError(`Depois de ${t.value} abra parênteses: ${t.value}(...).`);
        return fn(args());
      }
      throw new FormulaError(`Não esperava "${t.type}" aqui.`);
    }
    function term() {
      let v = factor();
      for (;;) {
        if (take('*')) v *= factor();
        else if (take('/')) {
          const d = factor();
          if (d === 0) throw new FormulaError('Divisão por zero.', '#DIV/0!');
          v /= d;
        } else return v;
      }
    }
    function expression() {
      let v = term();
      for (;;) {
        if (take('+')) v += term();
        else if (take('-')) v -= term();
        else return v;
      }
    }
    const result = expression();
    if (pos < tokens.length) {
      const t = tokens[pos];
      if (t.type === ')') throw new FormulaError('Há um ")" sobrando.');
      throw new FormulaError('Faltou um operador (+, -, *, /) entre dois valores.');
    }
    return result;
  }

  // Formulas referenced by a formula text (for validators: "did they use a formula?").
  function referencedCells(formula) {
    const out = new Set();
    for (const m of String(formula).toUpperCase().matchAll(/([A-Z]\d{1,3})(?::([A-Z]\d{1,3}))?/g)) {
      if (!m[2]) { out.add(m[1]); continue; }
      const a = parseRef(m[1]), b = parseRef(m[2]);
      for (let row = Math.min(a.row, b.row); row <= Math.max(a.row, b.row); row++) {
        for (let col = Math.min(a.col, b.col); col <= Math.max(a.col, b.col); col++) out.add(cellName(col, row));
      }
    }
    return out;
  }

  function set(ref, input) {
    const r = typeof ref === 'string' ? parseRef(ref) : ref;
    if (!r || !inside(r) || r.row === 1) return false;
    const next = parseInput(input);
    if (data[r.row - 2][r.col] === next) return false;
    history.push(snapshot());
    data[r.row - 2][r.col] = next;
    changed('edit');
    return true;
  }

  // Sort data rows by one column. expand=false reproduces the classic mistake of
  // sorting a single column and breaking the records apart.
  function sort(col, direction = 'asc', expand = true) {
    history.push(snapshot());
    const sign = direction === 'desc' ? -1 : 1;
    const compare = (a, b) => {
      if (a === b) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      if (typeof a === 'number' && typeof b === 'number') return (a - b) * sign;
      return String(a).localeCompare(String(b), 'pt-BR', { numeric: true }) * sign;
    };
    const keyed = data.map((row, i) => ({ row, i, hidden: hidden.has(i) }));
    if (expand) {
      keyed.sort((a, b) => compare(a.row[col], b.row[col]) || a.i - b.i);
      data = keyed.map((k) => k.row);
      hidden = new Set(keyed.flatMap((k, i) => (k.hidden ? [i] : [])));
    } else {
      const column = data.map((r) => r[col]).sort(compare);
      data = data.map((r, i) => { const copy = [...r]; copy[col] = column[i]; return copy; });
    }
    changed('sort');
  }

  const OPERATORS = {
    '=': (a, b) => (typeof b === 'number' ? a === b : String(a ?? '').toLocaleLowerCase('pt-BR') === String(b).toLocaleLowerCase('pt-BR')),
    '<>': (a, b) => !OPERATORS['='](a, b),
    '<': (a, b) => typeof a === 'number' && a < b,
    '<=': (a, b) => typeof a === 'number' && a <= b,
    '>': (a, b) => typeof a === 'number' && a > b,
    '>=': (a, b) => typeof a === 'number' && a >= b,
  };
  function applyFilter(col, operator, input) {
    const target = parseInput(input);
    if (!OPERATORS[operator] || target === null || col < 0 || col >= width) return false;
    if (operator !== '=' && operator !== '<>' && typeof target !== 'number') return false;
    history.push(snapshot());
    filter = { col, operator, value: target };
    hidden = new Set(data.flatMap((row, i) => (OPERATORS[operator](value({ col, row: i + 2 }), target) ? [] : [i])));
    changed('filter');
    return true;
  }
  function clearFilter() {
    if (!filter) return false;
    history.push(snapshot());
    filter = null;
    hidden = new Set();
    changed('filter');
    return true;
  }
  function undo() {
    const previous = history.pop();
    if (!previous) return false;
    ({ data, hidden, filter } = previous);
    changed('undo');
    return true;
  }

  return {
    columns, width,
    get rowCount() { return data.length; },
    get lastRow() { return lastRow(); },
    get filter() { return filter; },
    get canUndo() { return history.length > 0; },
    raw, value, set, evaluate, referencedCells, sort, applyFilter, clearFilter, undo,
    isHidden: (row) => hidden.has(row - 2),
    // Data rows as plain arrays of current values (formulas evaluated, errors as codes).
    rows({ visibleOnly = false } = {}) {
      return data.flatMap((_, i) => {
        if (visibleOnly && hidden.has(i)) return [];
        return [Array.from({ length: width }, (_, col) => {
          try { return value({ col, row: i + 2 }); } catch (e) { return e.code ?? '#ERRO!'; }
        })];
      });
    },
    display(ref) {
      try { return formatValue(value(ref)); } catch (e) { return e.code ?? '#ERRO!'; }
    },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
