import fs from 'node:fs';

const src = fs.readFileSync('fuente.js', 'utf8');

function slice(startToken, endToken, max = 180000) {
  const start = src.indexOf(startToken);
  if (start < 0) return { found: false, start: -1, text: '' };
  let end = endToken ? src.indexOf(endToken, start + startToken.length) : -1;
  if (end < 0 || end - start > max) end = Math.min(src.length, start + max);
  return { found: true, start, text: src.slice(start, end) };
}

function excerpts(text, token, base = 0, context = 1400, limit = 20) {
  const out = [];
  let pos = -1;
  while ((pos = text.indexOf(token, pos + 1)) >= 0) {
    out.push({ offset: base + pos, snippet: text.slice(Math.max(0, pos - context), Math.min(text.length, pos + token.length + context)) });
    if (out.length >= limit) break;
  }
  return out;
}

const logic = slice('function crearLogicaTurnos({', 'function crearLogicaAppcc({', 50000);
const ui = slice('function Turnos({', 'function RegistroHorario({', 160000);

const result = {
  generatedFrom: 'fuente.js actual de pm13-p02-turnos',
  sourceLength: src.length,
  logic: {
    found: logic.found,
    offset: logic.start,
    add: excerpts(logic.text, 'function addTurno', logic.start, 2200, 5),
    update: excerpts(logic.text, 'function updateTurno', logic.start, 2200, 5),
    remove: excerpts(logic.text, 'function deleteTurno', logic.start, 2200, 5),
    copy: excerpts(logic.text, 'copiarSemana', logic.start, 3000, 8),
    validations: {
      hasExplicitDateValidation: /validar.*fecha|fecha.*inval|^\d{4}-\d{2}-\d{2}$/im.test(logic.text),
      hasExplicitTimeValidation: /validar.*hora|hora.*inval|^\d{2}:\d{2}$/im.test(logic.text),
      hasOverlapWords: /solap|superpu|conflict|coincid/i.test(logic.text),
      hasInactiveCheck: /activo\s*!==\s*false|activo\s*===\s*false/.test(logic.text),
      hasLocalFilter: /localId/.test(logic.text),
      hasPhysicalDelete: /\.filter\([\s\S]{0,120}id\s*!==/.test(logic.text)
    }
  },
  ui: {
    found: ui.found,
    offset: ui.start,
    activeFilter: /empleados\.filter\(\(e2\) => e2\.activo !== false\)/.test(ui.text),
    saveRefs: excerpts(ui.text, 'addTurno', ui.start, 2600, 12),
    updateRefs: excerpts(ui.text, 'updateTurno', ui.start, 2600, 12),
    deleteRefs: excerpts(ui.text, 'deleteTurno', ui.start, 2200, 12),
    copyRefs: excerpts(ui.text, 'copiarSemana', ui.start, 3000, 12),
    errorRefs: excerpts(ui.text, 'setError', ui.start, 2200, 12)
  }
};

fs.mkdirSync('tests/pm13', { recursive: true });
fs.writeFileSync('tests/pm13/P02_DIAGNOSTICO_TURNOS.json', JSON.stringify(result, null, 2));
fs.writeFileSync('tests/pm13/P02_LOGICA_TURNOS_ACTUAL.txt', logic.text);
fs.writeFileSync('tests/pm13/P02_UI_TURNOS_ACTUAL.txt', ui.text);
console.log(JSON.stringify({
  sourceLength: result.sourceLength,
  logicFound: result.logic.found,
  uiFound: result.ui.found,
  logicLength: logic.text.length,
  uiLength: ui.text.length,
  validations: result.logic.validations,
  activeFilter: result.ui.activeFilter,
  saveCount: result.ui.saveRefs.length,
  updateCount: result.ui.updateRefs.length,
  deleteCount: result.ui.deleteRefs.length,
  copyCount: result.ui.copyRefs.length,
  errorCount: result.ui.errorRefs.length
}, null, 2));
