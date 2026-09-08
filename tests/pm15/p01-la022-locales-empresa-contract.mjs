import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM15 P01 (LA-022): "Nombre de local vacío no culpa a una empresa ya elegida."
//
// Bug real encontrado por inspección de código en el componente Locales: el <select> de
// empresa se renderiza con `value={empresaNuevaId || empresaPrincipalId || ""}` -- es decir,
// SIEMPRE muestra visualmente una empresa seleccionada (la primera) en cuanto existe alguna.
// Pero el cálculo del destino real al enviar el formulario era
// `empresaNuevaId || (empresas.length === 1 ? empresaPrincipalId : "")`: con 2+ empresas y
// el desplegable sin tocar, el destino calculado era "" aunque la UI mostrara una empresa
// elegida, y el usuario recibía "Selecciona la empresa..." en vez de "Ponle un nombre al
// local" -- exactamente el síntoma que describe LA-022.
//
// Arreglo: `empresaDestinoParaNuevoLocalPM15` (nueva función pura) alinea el valor realmente
// usado con el que ya se mostraba en el <select>, sin importar cuántas empresas existan.

const src = fs.readFileSync('fuente.js', 'utf8');
const helperIni = src.indexOf('function empresaDestinoParaNuevoLocalPM15(');
assert.ok(helperIni >= 0, 'empresaDestinoParaNuevoLocalPM15 no encontrada');
const helperFin = src.indexOf('function Locales(', helperIni);
assert.ok(helperFin > helperIni, 'no se pudo acotar empresaDestinoParaNuevoLocalPM15');

const logicaIni = src.indexOf('function crearLogicaLocales(');
assert.ok(logicaIni >= 0, 'crearLogicaLocales no encontrada');
const logicaFin = src.indexOf('function crearLogicaMovimientosCaja(', logicaIni);
assert.ok(logicaFin > logicaIni, 'no se pudo acotar crearLogicaLocales');

const ctx = { uid: (() => { let n = 0; return () => `uid-${++n}`; })() };
vm.createContext(ctx);
vm.runInContext(src.slice(helperIni, helperFin) + '\n' + src.slice(logicaIni, logicaFin), ctx);
const empresaDestinoParaNuevoLocalPM15 = ctx.empresaDestinoParaNuevoLocalPM15;
const crearLogicaLocales = ctx.crearLogicaLocales;
assert.equal(typeof empresaDestinoParaNuevoLocalPM15, 'function');
assert.equal(typeof crearLogicaLocales, 'function');

// ---- Positivo: selección explícita del usuario siempre gana. ----
{
  assert.equal(empresaDestinoParaNuevoLocalPM15('e2', 'e1'), 'e2');
  console.log('P01_LA022_SELECCION_EXPLICITA_GANA=PASS');
}

// ---- El bug real: sin tocar el desplegable, con 2+ empresas, debe usar la que ya se
// mostraba (la principal), no quedarse vacío. Antes del fix esto devolvía "". ----
{
  const destino = empresaDestinoParaNuevoLocalPM15('', 'e1');
  assert.equal(destino, 'e1', 'debe coincidir con lo que el <select> ya mostraba, no vaciarse por tener 2+ empresas');
  console.log('P01_LA022_SIN_TOCAR_SELECTOR_USA_LA_MOSTRADA=PASS');
}

// ---- Negativo real: si no hay ninguna empresa, no se puede inventar un destino. ----
{
  assert.equal(empresaDestinoParaNuevoLocalPM15('', null), '');
  assert.equal(empresaDestinoParaNuevoLocalPM15('', ''), '');
  console.log('P01_LA022_SIN_EMPRESAS_SIGUE_VACIO=PASS');
}

// ---- Prueba de extremo a extremo del síntoma exacto de LA-022: con destino ya resuelto
// (como ahora lo calcula el formulario) y nombre vacío, el error debe hablar del NOMBRE,
// nunca de la empresa (que ya está resuelta). ----
{
  const locales = [];
  const setLocales = (fn) => { locales.splice(0, locales.length, ...fn(locales)); };
  const { crearLocal } = crearLogicaLocales({ locales, setLocales, localActivoId: null, setLocalActivoId: () => {}, registrarAuditoria: () => {} });
  const empresaPrincipalId = 'e1';
  const destinoComoLoCalculariaElFormulario = empresaDestinoParaNuevoLocalPM15('', empresaPrincipalId);
  const r = crearLocal({ nombre: '', direccion: '', empresaId: destinoComoLoCalculariaElFormulario });
  assert.equal(r.ok, false);
  assert.match(r.error, /nombre/i, `el error debe hablar del nombre, no de la empresa: ${r.error}`);
  assert.doesNotMatch(r.error, /empresa/i, `no debe culpar a la empresa ya elegida: ${r.error}`);
  console.log('P01_LA022_ERROR_CULPA_AL_NOMBRE_NO_A_LA_EMPRESA=PASS');
}

// ---- Positivo de cierre: con nombre y destino correctos, el local se crea con la empresa
// realmente elegida (no una inventada ni distinta a la mostrada). ----
{
  const locales = [];
  const setLocales = (fn) => { locales.splice(0, locales.length, ...fn(locales)); };
  const { crearLocal } = crearLogicaLocales({ locales, setLocales, localActivoId: null, setLocalActivoId: () => {}, registrarAuditoria: () => {} });
  const destino = empresaDestinoParaNuevoLocalPM15('', 'e1');
  const r = crearLocal({ nombre: 'San Ginés Centro', direccion: '', empresaId: destino });
  assert.equal(r.ok, true);
  assert.equal(r.local.empresaId, 'e1');
  console.log('P01_LA022_ALTA_OK_CON_EMPRESA_MOSTRADA=PASS');
}

console.log('PM15 P01 (LA-022) — Locales: nombre vacío no culpa a una empresa ya elegida: contrato OK');
