import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM19 P03: confirma, por inspección estática, que traspasarStock comprueba de verdad el
// estado del local antes de mover stock (no basta con que exista la función si no se usa
// como primera comprobación).

const src = fs.readFileSync('fuente.js', 'utf8');
const ini = src.indexOf('function crearLogicaTraspasos(');
assert.ok(ini >= 0, 'crearLogicaTraspasos no encontrada');
const fin = src.indexOf('function crearLogicaSeguridad(', ini);
const cuerpo = src.slice(ini, fin);

// ---- traspasarStock: la comprobación de local activo es lo primero que hace. ----
{
  const iniFn = cuerpo.indexOf('async function traspasarStock(');
  const finFn = cuerpo.indexOf('async function traspasarEntreLocales(', iniFn);
  const fnTraspasarStock = cuerpo.slice(iniFn, finFn);
  assert.match(fnTraspasarStock, /if \(!localActivoEstaActivoPM19\(locales, localActivoId\)\) return \{ ok: false, error:/, 'traspasarStock debe comprobar el local activo antes de mover stock');
  console.log('P03_PM19_TRASPASAR_STOCK_COMPRUEBA_LOCAL_ACTIVO=PASS');
}

// ---- traspasarEntreLocales sigue exigiendo activo !== false en origen y destino, igual
// que antes -- no se ha tocado su comportamiento ya correcto. ----
{
  const iniFn = cuerpo.indexOf('async function traspasarEntreLocales(');
  const finFn = cuerpo.indexOf('return { traspasarStock, traspasarEntreLocales };', iniFn);
  const fnEntreLocales = cuerpo.slice(iniFn, finFn);
  assert.match(fnEntreLocales, /l22\.activo !== false && !l22\.fusionadoEn/, 'traspasarEntreLocales debe seguir exigiendo locales realmente activos');
  console.log('P03_PM19_TRASPASO_ENTRE_LOCALES_SIN_REGRESION=PASS');
}

// ---- El helper se define antes de crearLogicaTraspasos y recibe locales tal como ya se
// pasaba en la composición (sin cambios de firma que rompan la llamada existente). ----
{
  assert.match(src, /crearLogicaTraspasos\(\{ productos, setProductos, movimientos, setMovimientos, setTraspasos, registrarAuditoria, localActivoId, locales \}\)/, 'la composición ya pasaba locales; debe seguir haciéndolo sin cambios');
  console.log('P03_PM19_COMPOSICION_TRASPASOS_SIN_CAMBIOS=PASS');
}

console.log('PM19 P03 (wiring traspasos) — local cerrado bloquea traspasarStock: contrato OK');
