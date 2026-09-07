import fs from 'node:fs';

const src = fs.readFileSync('fuente.js', 'utf8');

function sliceFunction(startToken, endToken, max = 30000) {
  const ini = src.indexOf(startToken);
  if (ini < 0) return { found: false, start: -1, text: '' };
  let fin = endToken ? src.indexOf(endToken, ini + startToken.length) : -1;
  if (fin < 0 || fin - ini > max) fin = Math.min(src.length, ini + max);
  return { found: true, start: ini, text: src.slice(ini, fin) };
}

function occurrencesIn(text, token, absoluteBase = 0, context = 1000, limit = 20) {
  const out = [];
  let pos = -1;
  while ((pos = text.indexOf(token, pos + 1)) >= 0) {
    out.push({
      offset: absoluteBase + pos,
      snippet: text.slice(Math.max(0, pos - context), Math.min(text.length, pos + token.length + context))
    });
    if (out.length >= limit) break;
  }
  return out;
}

function occurrences(token, context = 1000) {
  return occurrencesIn(src, token, 0, context);
}

const logic = sliceFunction('function crearLogicaPersonal({', 'function crearLogicaTurnos({', 50000);
const ui = sliceFunction('function Personal({', 'function Turnos({', 120000);

const flowTokens = ['function submit', 'submitEmpleado', 'updateEmpleado(', 'addEmpleado(', 'deleteEmpleado(', 'crearCuentaEmpleado('];
const result = {
  generatedFrom: 'fuente.js actual de la rama',
  sourceLength: src.length,
  backendRefs: {
    pm11Alta: src.includes('pm11_alta_empleado'),
    pm11Editar: src.includes('pm11_editar_empleado'),
    pm11Baja: src.includes('pm11_baja_empleado'),
    pm11Reactivar: src.includes('pm11_reactivar_empleado'),
    obtenerContextoOperativo: src.includes('obtener_contexto_operativo')
  },
  logic: {
    found: logic.found,
    offset: logic.start,
    hasPM10Validation: logic.text.includes('validarEmpleadoPM10'),
    hasPhysicalEmployeeDelete: /setEmpleados\(\(s\d*\) => s\d*\.filter\(\(e\d*\) => e\d*\.id !== id\)\)/.test(logic.text),
    hasPayrollDelete: /setNominas[\s\S]{0,160}\.filter\([\s\S]{0,100}empleadoId !== id/.test(logic.text),
    hasSoftInactive: /activo:\s*false/.test(logic.text),
    isAddAsync: /async function addEmpleado\(/.test(logic.text),
    isUpdateAsync: /async function updateEmpleado\(/.test(logic.text),
    isDeleteAsync: /async function deleteEmpleado\(/.test(logic.text),
    flowExcerpts: Object.fromEntries(flowTokens.map((token) => [token, occurrencesIn(logic.text, token, logic.start, 1800, 5)])),
    returnExcerpt: (() => {
      const i = logic.text.lastIndexOf('return {');
      return i >= 0 ? logic.text.slice(i, Math.min(logic.text.length, i + 1200)) : '';
    })()
  },
  ui: {
    found: ui.found,
    offset: ui.start,
    deleteEmpleadoMentions: (ui.text.match(/deleteEmpleado/g) || []).length,
    activoMentions: (ui.text.match(/activo/g) || []).length,
    bajaMentions: (ui.text.match(/baja/gi) || []).length,
    eliminarMentions: (ui.text.match(/eliminar/gi) || []).length,
    submitExcerpts: occurrencesIn(ui.text, 'function submit', ui.start, 2600, 10),
    updateCallExcerpts: occurrencesIn(ui.text, 'updateEmpleado(', ui.start, 1800, 10),
    addCallExcerpts: occurrencesIn(ui.text, 'addEmpleado(', ui.start, 1800, 10),
    deleteCallExcerpts: occurrencesIn(ui.text, 'deleteEmpleado(', ui.start, 1800, 10),
    confirmDeleteExcerpts: occurrencesIn(ui.text, 'confirmDeleteId', ui.start, 1800, 8),
    activoExcerpts: occurrencesIn(ui.text, 'activo:', ui.start, 1500, 12),
    activoLiteralExcerpts: occurrencesIn(ui.text, 'Activo', ui.start, 1500, 12),
    checkboxExcerpts: occurrencesIn(ui.text, 'type: "checkbox"', ui.start, 1200, 16),
    fechaAltaExcerpts: occurrencesIn(ui.text, 'fechaAlta', ui.start, 1200, 8),
    setFormExcerpts: occurrencesIn(ui.text, 'setForm', ui.start, 1200, 12)
  },
  calls: occurrences('deleteEmpleado', 1400),
  labels: {
    baja: occurrences('baja', 700),
    eliminarEmpleado: occurrences('Eliminar empleado', 700)
  }
};

fs.mkdirSync('tests/pm13', { recursive: true });
fs.writeFileSync('tests/pm13/P01_DIAGNOSTICO_PERSONAL.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({
  sourceLength: result.sourceLength,
  backendRefs: result.backendRefs,
  logic: {
    found: result.logic.found,
    isAddAsync: result.logic.isAddAsync,
    isUpdateAsync: result.logic.isUpdateAsync,
    isDeleteAsync: result.logic.isDeleteAsync,
    hasPhysicalEmployeeDelete: result.logic.hasPhysicalEmployeeDelete,
    hasPayrollDelete: result.logic.hasPayrollDelete
  },
  uiSummary: {
    found: result.ui.found,
    submitCount: result.ui.submitExcerpts.length,
    addCalls: result.ui.addCallExcerpts.length,
    updateCalls: result.ui.updateCallExcerpts.length,
    deleteCalls: result.ui.deleteCallExcerpts.length
  }
}, null, 2));
