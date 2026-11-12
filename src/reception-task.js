// World 01 / M00 — novice-friendly spreadsheet reading.
export const TARGET_RECORD = 'ATD-104';
export const RECEPTION_ROWS = Object.freeze([
  Object.freeze({ id: 'ATD-101', sector: 'Protocolo', floor: 'Térreo' }),
  Object.freeze({ id: 'ATD-102', sector: 'Arquivo', floor: '2º andar' }),
  Object.freeze({ id: 'ATD-103', sector: 'Atendimento', floor: '1º andar' }),
  Object.freeze({ id: TARGET_RECORD, sector: 'Documentação', floor: '3º andar' }),
]);
export function selectReceptionRecord(id) {
  const rowIndex = RECEPTION_ROWS.findIndex((item) => item.id === id);
  if (rowIndex === -1) return null;
  return {
    found: RECEPTION_ROWS[rowIndex],
    rowNumber: rowIndex + 2, // row 1 is the table header, as in Excel
    column: 'A',
    success: id === TARGET_RECORD,
  };
}
