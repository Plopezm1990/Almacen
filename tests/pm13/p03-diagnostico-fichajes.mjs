import fs from 'node:fs';

const src = fs.readFileSync('fuente.js', 'utf8');

function excerpts(token, context = 2200, limit = 20) {
  const out = [];
  let pos = -1;
  while ((pos = src.indexOf(token, pos + 1)) >= 0) {
    out.push({ offset: pos, snippet: src.slice(Math.max(0, pos - context), Math.min(src.length, pos + token.length + context)) });
    if (out.length >= limit) break;
  }
  return out;
}

function enclosingFunction(token, maxBack = 25000, maxForward = 70000) {
  const p = src.indexOf(token);
  if (p < 0) return { found: false, start: -1, end: -1, text: '' };
  const back = src.slice(Math.max(0, p - maxBack), p);
  const rel = back.lastIndexOf('function crearLogica');
  const start = rel >= 0 ? Math.max(0, p - maxBack) + rel : Math.max(0, p - 5000);
  const next = src.indexOf('\nfunction crearLogica', p + token.length);
  const end = next > 0 && next - start <= maxForward ? next : Math.min(src.length, start + maxForward);
  return { found: true, start, end, text: src.slice(start, end) };
}

function sliceUi(startToken, endTokens, max = 180000) {
  const start = src.indexOf(startToken);
  if (start < 0) return { found: false, start: -1, end: -1, text: '' };
  let end = -1;
  for (const token of endTokens) {
    const x = src.indexOf(token, start + startToken.length);
    if (x > start && (end < 0 || x < end)) end = x;
  }
  if (end < 0 || end - start > max) end = Math.min(src.length, start + max);
  return { found: true, start, end, text: src.slice(start, end) };
}

const logic = enclosingFunction('addFichajeManual');
const ui = sliceUi('function RegistroHorario({', ['\nfunction Personal(', '\nfunction Turnos(', '\nfunction Ausencias(', '\nfunction MapaAlmacen(']);

const result = {
  generatedFrom: 'fuente.js actual de pm13-p03-fichajes',
  sourceLength: src.length,
  logic: {
    found: logic.found,
    offset: logic.start,
    header: logic.text.slice(0, 400),
    addManual: logic.text.includes('addFichajeManual'),
    fichar: /fichar|entrada|salida/i.test(logic.text),
    activeCheck: /activo\s*!==\s*false|activo\s*===\s*false/.test(logic.text),
    localCheck: /localId/.test(logic.text),
    dateCheck: /fecha|Date|ISO/.test(logic.text),
    timeCheck: /hora|inicio|fin/.test(logic.text),
    orderingCheck: /orden|secuencia|entrada.*salida|salida.*entrada/i.test(logic.text),
    duplicateCheck: /duplic|replay|idempot|mismo/i.test(logic.text),
    physicalDelete: /\.filter\([\s\S]{0,150}id\s*!==/.test(logic.text),
    text: logic.text
  },
  ui: {
    found: ui.found,
    offset: ui.start,
    employeeActiveFilter: /empleados\.filter\([\s\S]{0,100}activo\s*!==\s*false/.test(ui.text),
    callsManual: (ui.text.match(/addFichajeManual/g) || []).length,
    callsFichar: (ui.text.match(/fichar/g) || []).length,
    callsDelete: (ui.text.match(/deleteFichaje|eliminarFichaje/g) || []).length,
    errorMentions: (ui.text.match(/setError/g) || []).length,
    text: ui.text
  },
  global: {
    addManual: excerpts('addFichajeManual', 2500, 12),
    registroHorario: excerpts('function RegistroHorario({', 2500, 5),
    fichajes: excerpts('fichajes', 900, 30)
  }
};

fs.mkdirSync('tests/pm13', { recursive: true });
fs.writeFileSync('tests/pm13/P03_DIAGNOSTICO_FICHAJES.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({
  sourceLength: result.sourceLength,
  logicFound: result.logic.found,
  logicHeader: result.logic.header,
  addManual: result.logic.addManual,
  activeCheck: result.logic.activeCheck,
  localCheck: result.logic.localCheck,
  orderingCheck: result.logic.orderingCheck,
  duplicateCheck: result.logic.duplicateCheck,
  uiFound: result.ui.found,
  uiEmployeeActiveFilter: result.ui.employeeActiveFilter,
  uiManualCalls: result.ui.callsManual,
  uiFicharCalls: result.ui.callsFichar
}, null, 2));
