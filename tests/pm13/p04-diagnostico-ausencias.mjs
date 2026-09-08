import fs from 'node:fs';

const src = fs.readFileSync('fuente.js', 'utf8');

function refs(token, context = 2600, limit = 20) {
  const out = [];
  let p = -1;
  while ((p = src.indexOf(token, p + 1)) >= 0 && out.length < limit) {
    out.push({ offset: p, snippet: src.slice(Math.max(0, p - context), Math.min(src.length, p + token.length + context)) });
  }
  return out;
}

const personalIni = src.indexOf('function crearLogicaPersonal({');
const personalFin = src.indexOf('function crearLogicaTurnos({', personalIni);
const personal = personalIni >= 0 && personalFin > personalIni ? src.slice(personalIni, personalFin) : '';

const result = {
  generatedFrom: 'fuente.js pm13-p04-ausencias',
  sourceLength: src.length,
  personal: {
    found: !!personal,
    registrarAusencia: refs('function registrarAusencia', 3200, 6),
    eliminarAusencia: refs('function eliminarAusencia', 3200, 6),
    ausenciasTokens: refs('ausencias', 1800, 20)
  },
  ui: {
    Ausencias: refs('function Ausencias(', 10000, 3),
    registrarCalls: refs('registrarAusencia(', 2200, 12),
    eliminarCalls: refs('eliminarAusencia(', 2200, 12),
    vacaciones: refs('vacaciones', 1600, 12)
  },
  backendTokens: {
    rpc: refs('pm13_', 1000, 30),
    getSupabaseClient: refs('getSupabaseClient', 1000, 20)
  }
};

fs.mkdirSync('tests/pm13', { recursive: true });
fs.writeFileSync('tests/pm13/P04_DIAGNOSTICO_AUSENCIAS.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({
  sourceLength: result.sourceLength,
  personalFound: result.personal.found,
  registrar: result.personal.registrarAusencia.length,
  eliminar: result.personal.eliminarAusencia.length,
  uiAusencias: result.ui.Ausencias.length,
  registrarCalls: result.ui.registrarCalls.length,
  eliminarCalls: result.ui.eliminarCalls.length
}, null, 2));
