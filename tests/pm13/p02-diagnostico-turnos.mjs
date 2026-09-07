import fs from 'node:fs';

const src = fs.readFileSync('fuente.js', 'utf8');

function slice(startToken, endToken, max = 120000) {
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

const logic = slice('function crearLogicaTurnos({', 'function crearLogicaProduccion({', 70000);
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
    localChecks: excerpts(logic.text, 'localActivoId', logic.start, 1400, 20),
    employeeRefs: excerpts(logic.text, 'empleadoId', logic.start, 1600, 20),
    validations: {
      hasDateValidation: /fecha|Date|ISO/.test(logic.text),
      hasTimeValidation: /hora|inicio|fin/.test(logic.text),
      hasOverlapWords: /solap|superpu|conflict|coincid/i.test(logic.text),
      hasInactiveCheck: /activo\s*!==\s*false|activo\s*===\s*false/.test(logic.text),
      hasLocalFilter: /localId/.test(logic.text),
      hasPhysicalDelete: /\.filter\([\s\S]{0,120}id\s*!==/.test(logic.text)
    },
    returnExcerpt: (() => {
      const p = logic.text.lastIndexOf('return {');
      return p >= 0 ? logic.text.slice(p, Math.min(logic.text.length, p + 1500)) : '';
    })()
  },
  ui: {
    found: ui.found,
    offset: ui.start,
    employeeFilters: excerpts(ui.text, 'empleados', ui.start, 2200, 20),
    formRefs: excerpts(ui.text, 'form', ui.start, 1700, 20),
    saveRefs: excerpts(ui.text, 'addTurno', ui.start, 2200, 10),
    updateRefs: excerpts(ui.text, 'updateTurno', ui.start, 2200, 10),
    copyRefs: excerpts(ui.text, 'copiarSemana', ui.start, 2600, 10),
    labels: {
      turno: (ui.text.match(/turno/gi) || []).length,
      horario: (ui.text.match(/horario/gi) || []).length,
      copiar: (ui.text.match(/copiar/gi) || []).length,
      conflicto: (ui.text.match(/conflic|solap/gi) || []).length
    }
  },
  global: {
    turnoMentions: (src.match(/turno/gi) || []).length,
    crearLogicaTurnosCalls: excerpts(src, 'crearLogicaTurnos({', 0, 1800, 8),
    turnosStorageRefs: excerpts(src, 'turnos', 0, 700, 30)
  }
};

fs.mkdirSync('tests/pm13', { recursive: true });
fs.writeFileSync('tests/pm13/P02_DIAGNOSTICO_TURNOS.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({
  sourceLength: result.sourceLength,
  logicFound: result.logic.found,
  uiFound: result.ui.found,
  validations: result.logic.validations,
  addCount: result.logic.add.length,
  updateCount: result.logic.update.length,
  deleteCount: result.logic.remove.length,
  copyCount: result.logic.copy.length,
  uiCopyCount: result.ui.copyRefs.length
}, null, 2));
