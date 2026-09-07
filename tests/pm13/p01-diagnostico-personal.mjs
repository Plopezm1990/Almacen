import fs from 'node:fs';

const src = fs.readFileSync('fuente.js', 'utf8');

function sliceFunction(startToken, endToken, max = 30000) {
  const ini = src.indexOf(startToken);
  if (ini < 0) return { found: false, start: -1, text: '' };
  let fin = endToken ? src.indexOf(endToken, ini + startToken.length) : -1;
  if (fin < 0 || fin - ini > max) fin = Math.min(src.length, ini + max);
  return { found: true, start: ini, text: src.slice(ini, fin) };
}

function occurrences(token, context = 1000) {
  const out = [];
  let pos = -1;
  while ((pos = src.indexOf(token, pos + 1)) >= 0) {
    out.push({
      offset: pos,
      snippet: src.slice(Math.max(0, pos - context), Math.min(src.length, pos + token.length + context))
    });
    if (out.length >= 20) break;
  }
  return out;
}

const logic = sliceFunction('function crearLogicaPersonal({', 'function crearLogicaTurnos({', 40000);
const ui = sliceFunction('function Personal({', 'function Turnos({', 120000);

const result = {
  generatedFrom: 'fuente.js actual de la rama',
  sourceLength: src.length,
  logic: {
    found: logic.found,
    offset: logic.start,
    hasPM10Validation: logic.text.includes('validarEmpleadoPM10'),
    hasPhysicalEmployeeDelete: /setEmpleados\(\(s\d*\) => s\d*\.filter\(\(e\d*\) => e\d*\.id !== id\)\)/.test(logic.text),
    hasPayrollDelete: /setNominas[\s\S]{0,160}\.filter\([\s\S]{0,100}empleadoId !== id/.test(logic.text),
    hasSoftInactive: /activo:\s*false/.test(logic.text),
    deleteExcerpt: (() => {
      const i = logic.text.indexOf('function deleteEmpleado(');
      return i >= 0 ? logic.text.slice(i, Math.min(logic.text.length, i + 1800)) : '';
    })(),
    returnExcerpt: (() => {
      const i = logic.text.lastIndexOf('return {');
      return i >= 0 ? logic.text.slice(i, Math.min(logic.text.length, i + 1000)) : '';
    })()
  },
  ui: {
    found: ui.found,
    offset: ui.start,
    deleteEmpleadoMentions: (ui.text.match(/deleteEmpleado/g) || []).length,
    activoMentions: (ui.text.match(/activo/g) || []).length,
    bajaMentions: (ui.text.match(/baja/gi) || []).length,
    eliminarMentions: (ui.text.match(/eliminar/gi) || []).length
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
  logic: result.logic,
  uiSummary: result.ui,
  deleteCallCount: result.calls.length
}, null, 2));
