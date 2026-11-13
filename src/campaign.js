// World 01 campaign: stage order, goals and the spreadsheet missions.
// Pure data + functions (no DOM). Each mission builds a sheet, publishes live
// `preview` flags that the stage entities react to, and `validate`s the sheet.
import { createSheet, formatValue } from './sheet.js';

const fmt = formatValue;
const ok = (message) => ({ ok: true, tone: 'success', message });
const info = (message) => ({ ok: false, tone: 'info', message });
const warn = (message) => ({ ok: false, tone: 'error', message });

// ------------------------------------------------------------------ M00 · ler registros
const RECEPTION = [['ATD-101', 'Protocolo', 'Térreo'], ['ATD-102', 'Arquivo', '2º andar'],
  ['ATD-103', 'Atendimento', '1º andar'], ['ATD-104', 'Documentação', 'Mezanino'], ['ATD-105', 'Cadastro', '1º andar']];

// ------------------------------------------------------------------ M01 · editar célula
const MEZZANINE = 4.5;
const WALKWAYS = [['P1', 'Jardim → Recepção', 0], ['P2', 'Recepção → Café', 1.2],
  ['P3', 'Sacada → Mezanino', 0.6], ['P4', 'Café → Terraço', 3]];
const WALKWAY_ROW = 4;

// ------------------------------------------------------------------ M02 · classificar
const LIFTS = [['L1', 'Arquivo', 5.4], ['L2', 'Protocolo', 1.8], ['L3', 'Gabinete', 7.2], ['L4', 'Cadastro', 3.6]];

// ------------------------------------------------------------------ M03 · filtrar
const DATA_PLATFORMS = [['J1', 'Judicial', 3], ['A1', 'Administrativo', 12], ['J2', 'Judicial', 8],
  ['A2', 'Administrativo', 2], ['J3', 'Judicial', 4], ['A3', 'Administrativo', 6]];
const GENERATOR_LIMIT = 3;

// ------------------------------------------------------------------ SOMA
const ENERGY = [['Arquivo', 'OK', 8], ['Atendimento', 'OK', 12], ['Documentação', 'OK', 5], ['Tecnologia', 'OK', 7], ['TOTAL', 'ENERGIA', null]];
const ENERGY_TOTAL = 32;

// ------------------------------------------------------------------ M04 · revisão livre
const REVIEW = [['PR-31', 'Administrativo', 9], ['PR-32', 'Judicial', 14], ['PR-33', 'Judicial', 2],
  ['PR-34', 'Administrativo', 1], ['PR-35', 'Judicial', 7], ['PR-36', 'Administrativo', 5]];

const sameRecords = (rows, original) => rows.every((row) => original.some((o) => o.every((v, i) => v === row[i])));

export const MISSIONS = {
  m00: {
    id: 'm00', code: 'MISSÃO 00', skill: 'Linhas, colunas e registros',
    title: 'Uma entrega para o Levi',
    story: 'O drone da recepção precisa levar o documento <strong>ATD-104</strong> ao setor certo, mas só você sabe ler a planilha.',
    task: 'Encontre o registro ATD-104 e selecione a linha dele.',
    fact: '<strong>Linhas</strong> (2, 3, 4…) são registros. <strong>Colunas</strong> (A, B, C) guardam um tipo de informação. A linha 1 é o cabeçalho.',
    file: 'atendimentos.xlsx',
    tools: ['select'],
    hints: ['Os códigos ficam na coluna A, chamada ID.', 'Desça pela coluna A até achar ATD-104.', 'ATD-104 está na linha 5. Clique no número 5 à esquerda.'],
    solvedFlags: { courier: true },
    sheet: () => createSheet({ columns: [{ label: 'ID' }, { label: 'Setor' }, { label: 'Andar' }], rows: RECEPTION }),
    preview: () => ({}),
    validate(sheet, { selection }) {
      if (!selection) return info('Clique em uma célula ou no número de uma linha.');
      const id = sheet.raw({ col: 0, row: selection.row });
      if (selection.row === 1) return warn('A linha 1 é o cabeçalho: ela dá nome às colunas. Os registros começam na linha 2.');
      if (id !== 'ATD-104') return warn(`A linha ${selection.row} é o registro ${id}. Compare o código na coluna A.`);
      const destination = sheet.raw({ col: 1, row: selection.row });
      return ok(`Isso! ATD-104 está na linha ${selection.row}: destino ${destination}, ${sheet.raw({ col: 2, row: selection.row })}. O drone vai na frente, siga-o!`);
    },
  },

  m01: {
    id: 'm01', code: 'MISSÃO 01', skill: 'Selecionar e editar uma célula',
    title: 'A passarela do mezanino',
    story: 'A passarela entre a sacada e o mezanino está recolhida. A altura dela vem desta planilha, e o valor está errado.',
    task: `O mezanino fica a <strong>${fmt(MEZZANINE)} m</strong>. Corrija a altura da passarela P3 e veja ela subir.`,
    fact: 'Cada célula tem um endereço: coluna + linha. <strong>C4</strong> é a coluna C, linha 4. Errou? <kbd>Ctrl</kbd>+<kbd>Z</kbd> desfaz.',
    file: 'passarelas.xlsx',
    tools: ['select', 'edit', 'undo'],
    hints: ['A altura fica na coluna C. Qual linha é a da passarela P3?', 'É a célula C4. Selecione e digite o novo valor.', 'Digite 4,5 em C4 e aperte Enter.'],
    solvedFlags: { walkway: MEZZANINE },
    sheet: () => createSheet({ columns: [{ label: 'Passarela' }, { label: 'Liga' }, { label: 'Altura (m)' }], rows: WALKWAYS }),
    preview(sheet) {
      const v = sheet.value({ col: 2, row: WALKWAY_ROW });
      return { walkway: typeof v === 'number' ? Math.max(0, Math.min(8, v)) : 0.6 };
    },
    validate(sheet) {
      const others = WALKWAYS.map((row, i) => i + 2).filter((r) => r !== WALKWAY_ROW)
        .filter((r) => sheet.value({ col: 2, row: r }) !== WALKWAYS[r - 2][2] || sheet.value({ col: 0, row: r }) !== WALKWAYS[r - 2][0]);
      if (others.length) return warn(`Você alterou a linha ${others[0]}, que é de outra passarela. Use Desfazer (Ctrl+Z).`);
      const v = sheet.value({ col: 2, row: WALKWAY_ROW });
      if (typeof v !== 'number') return warn('A altura precisa ser um número, como 4,5.');
      if (v === WALKWAYS[WALKWAY_ROW - 2][2]) return info('Selecione a célula C4 e digite a altura do mezanino.');
      if (v > MEZZANINE) return warn(`${fmt(v)} m passa do mezanino (${fmt(MEZZANINE)} m). Abaixe um pouco.`);
      if (v < MEZZANINE) return warn(`${fmt(v)} m ainda está abaixo do mezanino (${fmt(MEZZANINE)} m).`);
      return ok('Passarela alinhada! Você editou a célula C4. Atravesse até o mezanino.');
    },
  },

  m02: {
    id: 'm02', code: 'MISSÃO 02', skill: 'Classificar linhas inteiras',
    title: 'Fila dos elevadores',
    story: 'Os quatro elevadores param na altura da planilha, na ordem das linhas. Embaralhados, não formam caminho até o andar de cima.',
    task: 'Classifique a tabela pela <strong>altura, do menor para o maior</strong>, para virar uma escada.',
    fact: 'Classificar move a <strong>linha inteira</strong>. Se só uma coluna mudar de lugar, os registros se misturam: L1 ganha a altura de outro elevador.',
    file: 'fila_elevadores.xlsx',
    tools: ['select', 'sort', 'undo'],
    hints: ['Selecione uma célula da coluna C (Altura).', 'Use "Crescente (A→Z)" com "Expandir seleção" marcado.', 'Com a coluna C selecionada: Crescente. As alturas ficam 1,8 · 3,6 · 5,4 · 7,2.'],
    solvedFlags: { lifts: { L2: { slot: 0, y: 1.8 }, L4: { slot: 1, y: 3.6 }, L1: { slot: 2, y: 5.4 }, L3: { slot: 3, y: 7.2 } } },
    sheet: () => createSheet({ columns: [{ label: 'Elevador' }, { label: 'Setor' }, { label: 'Altura (m)' }], rows: LIFTS }),
    preview(sheet) {
      const lifts = {};
      sheet.rows().forEach(([id, sector, height], slot) => {
        const original = LIFTS.find((r) => r[1] === sector);
        const name = original?.[0] ?? id;
        const consistent = original && original[0] === id && original[2] === height;
        // An elevator whose record got mixed up refuses to move: the safety lock is the feedback.
        lifts[name] = consistent ? { slot, y: height } : { slot, y: 0.35, locked: true };
      });
      return { lifts };
    },
    validate(sheet) {
      const rows = sheet.rows();
      if (!sameRecords(rows, LIFTS)) {
        const broken = rows.find((r) => !LIFTS.some((o) => o.every((v, i) => v === r[i])));
        return warn(`Os registros se misturaram: ${broken[0]} aparece com ${fmt(broken[2])} m. Desfaça e classifique com "Expandir seleção".`);
      }
      const heights = rows.map((r) => r[2]);
      const ascending = heights.every((h, i) => i === 0 || h >= heights[i - 1]);
      if (ascending) return ok('Escada pronta: 1,8 → 3,6 → 5,4 → 7,2 m. Suba pelos elevadores!');
      const descending = heights.every((h, i) => i === 0 || h <= heights[i - 1]);
      if (descending) return warn('Ficou do maior para o menor: o primeiro degrau está alto demais. Use a ordem crescente.');
      return info('Os elevadores seguem a ordem das linhas. Classifique pela coluna C (Altura).');
    },
  },

  m03: {
    id: 'm03', code: 'MISSÃO 03', skill: 'Filtrar registros',
    title: 'Plataformas de dados',
    story: `Cada linha liga uma plataforma sobre o vão. O gerador só aguenta <strong>${GENERATOR_LIMIT} plataformas</strong> ao mesmo tempo.`,
    task: 'O caminho seguro é o dos processos <strong>Judiciais</strong>. Filtre a tabela para mostrar só eles.',
    fact: 'O filtro <strong>esconde</strong> linhas, não apaga. As linhas 3, 5 e 7 continuam lá; "Limpar filtro" mostra tudo de novo.',
    file: 'plataformas.xlsx',
    tools: ['select', 'filter', 'undo'],
    hints: ['O tipo de processo está na coluna B (Setor).', 'Filtro: coluna B, condição "igual a", valor Judicial.', 'Coluna B · = · Judicial → Aplicar filtro.'],
    solvedFlags: { dataPlatforms: { J1: { active: true }, J2: { active: true }, J3: { active: true } } },
    sheet: () => createSheet({ columns: [{ label: 'ID' }, { label: 'Setor' }, { label: 'Prazo (dias)' }], rows: DATA_PLATFORMS }),
    preview(sheet) {
      const visible = sheet.filter ? sheet.rows({ visibleOnly: true }).map((r) => r[0]) : [];
      const powered = visible.length <= GENERATOR_LIMIT ? visible : [];
      return { dataPlatforms: Object.fromEntries(DATA_PLATFORMS.map(([id]) => [id, { active: powered.includes(id) }])) };
    },
    validate(sheet) {
      if (!sheet.filter) return info('Nenhum filtro aplicado: o gerador está esperando. Escolha coluna, condição e valor.');
      const visible = sheet.rows({ visibleOnly: true }).map((r) => r[0]);
      if (visible.length === 0) return warn('O filtro escondeu todas as linhas. Confira o valor digitado.');
      if (visible.length > GENERATOR_LIMIT) return warn(`SOBRECARGA: ${visible.length} plataformas visíveis, o limite é ${GENERATOR_LIMIT}. Filtre mais.`);
      if (visible.every((id) => id.startsWith('J')) && visible.length === 3) {
        return ok('Caminho Judicial ligado: J1, J2 e J3. As outras linhas só estão escondidas. Atravesse o vão!');
      }
      return warn(`Plataformas ligadas: ${visible.join(', ')}. Esse caminho não é o Judicial; ajuste o filtro.`);
    },
  },

  m04: {
    id: 'm04', code: 'DESAFIO SECRETO', skill: 'Classificar + filtrar sem ajuda',
    title: 'Revisão do arquivista',
    story: 'Você achou a sala secreta! O arquivista deixou um teste, sem dicas.',
    task: 'Deixe visíveis só os processos <strong>Judiciais</strong>, do <strong>menor para o maior prazo</strong>.',
    fact: 'Ordem e filtro funcionam juntos: classificar não desfaz o filtro.',
    file: 'revisao.xlsx', optional: true,
    tools: ['select', 'sort', 'filter', 'undo'],
    hints: [],
    solvedFlags: { mastery: true },
    sheet: () => createSheet({ columns: [{ label: 'Processo' }, { label: 'Setor' }, { label: 'Prazo (dias)' }], rows: REVIEW }),
    preview: () => ({}),
    validate(sheet) {
      const rows = sheet.rows();
      if (!sameRecords(rows, REVIEW)) return warn('Algum registro se misturou. Desfaça e use "Expandir seleção".');
      const visible = sheet.rows({ visibleOnly: true });
      const judicial = visible.length === 3 && visible.every((r) => r[1] === 'Judicial');
      const sorted = visible.every((r, i) => i === 0 || r[2] >= visible[i - 1][2]);
      if (judicial && sorted) return ok('Perfeito, sem nenhuma dica! Placa de domínio da Recepção desbloqueada.');
      if (judicial) return info('Filtro certo. Agora ordene pelo prazo (coluna C), crescente.');
      if (sorted && sheet.filter) return info('Ordem certa, mas o filtro mostra outras linhas.');
      return info('Duas operações: filtrar (coluna B = Judicial) e classificar (coluna C, crescente).');
    },
  },

  sum: {
    id: 'sum', code: 'MISSÃO 04', skill: 'Fórmula SOMA',
    title: 'Energia dos ventiladores',
    story: 'O elevador final fica no alto. Os ventiladores levam o Levi até lá, se receberem a energia total dos geradores.',
    task: `Em <strong>C6</strong>, escreva uma fórmula que some as cargas de C2 até C5 (total ${ENERGY_TOTAL}).`,
    fact: 'Toda fórmula começa com <strong>=</strong>. <strong>C2:C5</strong> é o intervalo de C2 até C5. No Excel em português, os argumentos são separados por <strong>;</strong>.',
    file: 'energia.xlsx',
    tools: ['select', 'edit', 'undo'],
    hints: ['Selecione C6 e comece com =.', 'A função que soma é SOMA(…). Dentro, o intervalo das cargas.', 'Digite =SOMA(C2:C5) em C6.'],
    solvedFlags: { fanPower: 1 },
    target: { col: 2, row: 6 },
    sheet: () => createSheet({ columns: [{ label: 'Gerador' }, { label: 'Status' }, { label: 'Carga' }], rows: ENERGY }),
    preview(sheet) {
      const raw = sheet.raw({ col: 2, row: 6 });
      if (typeof raw !== 'string' || !raw.startsWith('=')) return { fanPower: 0 };
      const v = sheet.value({ col: 2, row: 6 });
      return { fanPower: typeof v === 'number' ? Math.max(0, v / ENERGY_TOTAL) : 0 };
    },
    validate(sheet) {
      const raw = sheet.raw({ col: 2, row: 6 });
      if (raw === null) return info('Selecione C6 e escreva a fórmula.');
      if (typeof raw === 'number') {
        return raw === ENERGY_TOTAL
          ? warn('O número está certo, mas foi digitado à mão: se uma carga mudar, ele fica errado. Use uma fórmula começando com =.')
          : warn('Isso é um número digitado. A fórmula começa com =, por exemplo =SOMA(…).');
      }
      if (typeof raw === 'string' && !raw.startsWith('=')) return warn('Texto não soma nada. Comece com = para criar uma fórmula.');
      let v;
      try { v = sheet.evaluate(raw); } catch (e) { return warn(e.message); }
      const used = sheet.referencedCells(raw);
      if (v === ENERGY_TOTAL && ['C2', 'C3', 'C4', 'C5'].every((c) => used.has(c))) {
        return ok(`=${raw.slice(1).toUpperCase()} = ${ENERGY_TOTAL}. Energia total! Entre na coluna de ar.`);
      }
      if (v === ENERGY_TOTAL) return warn('Deu 32, mas a fórmula precisa usar as células C2 a C5, não números fixos.');
      if (v > ENERGY_TOTAL) return warn(`A fórmula calculou ${fmt(v)}: passou do total. Alguma célula entrou duas vezes?`);
      return warn(`A fórmula calculou ${fmt(v)}: faltam ${fmt(ENERGY_TOTAL - v)}. Inclua todas as cargas, de C2 até C5.`);
    },
  },
};

export const STAGES = [
  {
    id: '1-1', name: 'Jardim e Recepção', world: 'WORLD 01 · RECEPÇÃO INTELIGENTE', next: '1-2', par: 90,
    intro: 'Explore o jardim, ajude o drone da recepção e chegue ao mezanino.',
    goals: [
      { id: 'm00', kind: 'mission', mission: 'm00', label: 'BALCÃO DE RECEPÇÃO', objective: 'Entre no saguão e ajude o drone da recepção: encontre o registro ATD-104.' },
      { id: 'follow', kind: 'follow', entity: 'courier', label: 'DRONE-ENTREGADOR', objective: 'Siga o drone-entregador pelo circuito até a sacada.' },
      { id: 'm01', kind: 'mission', mission: 'm01', label: 'TERMINAL DA PASSARELA', objective: 'Use o terminal da sacada para ajustar a altura da passarela.' },
      { id: 'exit', kind: 'exit', entity: 'exit', label: 'PORTA DA GALERIA', objective: 'Atravesse a passarela e entre na porta da Galeria.' },
    ],
  },
  {
    id: '1-2', name: 'Galeria da Fila', world: 'WORLD 01 · RECEPÇÃO INTELIGENTE', next: '1-3', par: 50,
    intro: 'Atravesse as esteiras e organize os elevadores para subir.',
    goals: [
      { id: 'm02', kind: 'mission', mission: 'm02', label: 'TERMINAL DA FILA', objective: 'Passe pelas esteiras e pela barreira até o terminal da fila.' },
      { id: 'exit', kind: 'exit', entity: 'exit', label: 'SAÍDA DO TOPO', objective: 'Suba pelos elevadores e cruze a galeria até a saída.' },
    ],
  },
  {
    id: '1-3', name: 'Átrio de Dados', world: 'WORLD 01 · RECEPÇÃO INTELIGENTE', next: null, par: 70,
    intro: 'Cruze o vão de dados e religue o elevador da Central.',
    goals: [
      { id: 'm03', kind: 'mission', mission: 'm03', label: 'TERMINAL DO FILTRO', objective: 'Vença o corredor do dash e ligue as plataformas no terminal do filtro.' },
      { id: 'sum', kind: 'mission', mission: 'sum', label: 'TERMINAL DE ENERGIA', objective: 'Atravesse o vão e alimente os ventiladores no terminal de energia.' },
      { id: 'exit', kind: 'exit', entity: 'exit', label: 'ELEVADOR CENTRAL', objective: 'Suba na coluna de ar e entre no elevador central.' },
    ],
  },
];

export const stageById = (id) => STAGES.find((s) => s.id === id);

// Missions whose terminals live in a stage (goals + optional secrets placed there).
export const STAGE_MISSIONS = { '1-1': ['m00', 'm01'], '1-2': ['m02'], '1-3': ['m03', 'sum', 'm04'] };

export const SKILLS = ['m00', 'm01', 'm02', 'm03', 'sum'].map((id) => MISSIONS[id].skill);
