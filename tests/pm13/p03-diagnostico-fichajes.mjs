import fs from 'node:fs';

const src = fs.readFileSync('fuente.js', 'utf8');

function slice(startToken, endToken, max = 120000) {
  const start = src.indexOf(startToken);
  if (start < 0) return { found: false, start: -1, end: -1, text: '' };
  let end = src.indexOf(endToken, start + startToken.length);
  if (end < 0 || end - start > max) end = Math.min(src.length, start + max);
  return { found: true, start, end, text: src.slice(start, end) };
}

function excerpts(text, token, base = 0, context = 1800, limit = 12) {
  const out = [];
  let pos = -1;
  while ((pos = text.indexOf(token, pos + 1)) >= 0) {
    out.push({ offset: base + pos, snippet: text.slice(Math.max(0, pos - context), Math.min(text.length, pos + token.length + context)) });
    if (out.length >= limit) break;
  }
  return out;
}

const logic = slice('function crearLogicaFichaje({ fichajes, setFichajes, empleados, localActivoId }) {', '\nfunction redondearDineroPM06(', 60000);
const uiStart = src.indexOf('function RegistroHorario({ empleados, fichajes, fichar, addFichajeManual, updateFichaje, eliminarFichaje, fichajesAbiertos }) {');
let uiEnd = -1;
if (uiStart >= 0) {
  const m = /^function\s+([A-Za-z0-9_$]+)/gm;
  m.lastIndex = uiStart + 20;
  const next = m.exec(src);
  uiEnd = next ? next.index : Math.min(src.length, uiStart + 160000);
}
const ui = uiStart >= 0 ? { found: true, start: uiStart, end: uiEnd, text: src.slice(uiStart, uiEnd) } : { found: false, start: -1, end: -1, text: '' };

const result = {
  generatedFrom: 'fuente.js actual de pm13-p03-fichajes',
  sourceLength: src.length,
  logic: {
    found: logic.found,
    offset: logic.start,
    text: logic.text,
    fichar: excerpts(logic.text, 'function fichar', logic.start, 2200, 4),
    addManual: excerpts(logic.text, 'function addFichajeManual', logic.start, 2200, 4),
    update: excerpts(logic.text, 'function updateFichaje', logic.start, 2200, 4),
    remove: excerpts(logic.text, 'function eliminarFichaje', logic.start, 2200, 4),
    validations: {
      activeEmployee: /empleados\.find\([\s\S]{0,180}activo\s*!==\s*false/.test(logic.text),
      localScope: /localId/.test(logic.text),
      validType: /entrada|salida/.test(logic.text),
      validDate: /\^.*\\d\{4\}.*\\d\{2\}/.test(logic.text) || /Date\.UTC|isNaN|fecha.*valid/i.test(logic.text),
      validTime: /\^.*[01].*2\[0-3\]/.test(logic.text) || /hora.*valid/i.test(logic.text),
      sequence: /ultimo|abierto|entrada.*salida|salida.*entrada/i.test(logic.text),
      duplicateReplay: /duplic|replay|idempot|equivalente|mismo fichaje/i.test(logic.text),
      updateEmployeeValidation: /updateFichaje[\s\S]{0,1800}empleadoFichajeLocal/.test(logic.text)
    }
  },
  ui: {
    found: ui.found,
    offset: ui.start,
    text: ui.text,
    activeFilter: /empleados\.filter\([\s\S]{0,100}activo\s*!==\s*false/.test(ui.text),
    manualSubmit: excerpts(ui.text, 'addFichajeManual({', ui.start, 2600, 4),
    ficharCalls: excerpts(ui.text, 'fichar(', ui.start, 1800, 10),
    updateCalls: excerpts(ui.text, 'updateFichaje(', ui.start, 1800, 8),
    removeCalls: excerpts(ui.text, 'eliminarFichaje(', ui.start, 1800, 8),
    errorManual: excerpts(ui.text, 'setManualError', ui.start, 1800, 10),
    openLogic: excerpts(ui.text, 'fichajesAbiertos', ui.start, 1800, 10)
  },
  global: {
    fichajesAbiertosRefs: excerpts(src, 'fichajesAbiertos', 0, 2600, 20),
    crearLogicaFichajeRefs: excerpts(src, 'crearLogicaFichaje({', 0, 2200, 10)
  }
};

fs.mkdirSync('tests/pm13', { recursive: true });
fs.writeFileSync('tests/pm13/P03_DIAGNOSTICO_FICHAJES.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({
  sourceLength: result.sourceLength,
  logicFound: result.logic.found,
  uiFound: result.ui.found,
  validations: result.logic.validations,
  manualCalls: result.ui.manualSubmit.length,
  ficharCalls: result.ui.ficharCalls.length,
  updateCalls: result.ui.updateCalls.length,
  removeCalls: result.ui.removeCalls.length,
  globalOpenRefs: result.global.fichajesAbiertosRefs.length,
  logicRefs: result.global.crearLogicaFichajeRefs.length
}, null, 2));
