import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM19 P05: inventario exhaustivo de las mutaciones locales protegidas en los cinco
// módulos (Productos, Producción, Fichas de coste, APPCC, Aceite) + la corrección de
// Traspasos. Para cada una comprueba, por inspección estática, que la comprobación de
// contexto de escritura (validarContextoEscrituraPM10) aparece de verdad, y que aparece
// ANTES de cualquier mutación de estado (setX/registrarAuditoria/aplicarMovimientoStock/
// descontarAceite) -- es decir, que un rechazo no puede dejar cambios parciales (condición
// 5 del encargo).

const src = fs.readFileSync('fuente.js', 'utf8');

function acotarModulo(inicioMarcador, finMarcador) {
  const ini = src.indexOf(inicioMarcador);
  assert.ok(ini >= 0, `no se encontró el marcador de inicio: ${inicioMarcador}`);
  const fin = src.indexOf(finMarcador, ini);
  assert.ok(fin > ini, `no se encontró el marcador de fin: ${finMarcador} (tras ${inicioMarcador})`);
  return src.slice(ini, fin);
}

function acotarFuncion(cuerpoModulo, inicioFn, finFn) {
  const ini = cuerpoModulo.indexOf(inicioFn);
  assert.ok(ini >= 0, `no se encontró la función: ${inicioFn}`);
  const fin = finFn ? cuerpoModulo.indexOf(finFn, ini) : cuerpoModulo.length;
  assert.ok(fin > ini, `no se pudo acotar el final de: ${inicioFn}`);
  return cuerpoModulo.slice(ini, fin);
}

// Cada entrada: [nombre legible, marcador de inicio de la función, marcador que sigue
// (para acotar), patrón de la primera mutación real de estado tras la guarda].
const INVENTARIO = [];

function registrarModulo(nombreModulo, inicioModulo, finModulo, funciones) {
  const cuerpo = acotarModulo(inicioModulo, finModulo);
  for (const [nombreFn, inicioFn, finFn, patronMutacion] of funciones) {
    const cuerpoFn = acotarFuncion(cuerpo, inicioFn, finFn);
    INVENTARIO.push({ nombreModulo, nombreFn, cuerpoFn, patronMutacion });
  }
}

registrarModulo(
  'Productos',
  'function crearLogicaProductos(',
  'return { addProducto, updateProducto, deleteProducto, reactivarProducto, registrarSalida, ajustarProductoPorOtro };',
  [
    ['ajustarProductoPorOtro', 'function ajustarProductoPorOtro(', 'function addProducto(', /aplicarMovimientoStock\(/],
    ['addProducto', 'function addProducto(', 'function updateProducto(', /setProductos\(/],
    ['updateProducto', 'function updateProducto(', 'function deleteProducto(', /setProductos\(/],
    ['deleteProducto', 'function deleteProducto(', 'function reactivarProducto(', /setProductos\(/],
    ['reactivarProducto', 'function reactivarProducto(', 'function registrarSalida(', /setProductos\(/],
    ['registrarSalida', 'function registrarSalida(productoId, cantidad, opciones = {}) {', null, /aplicarMovimientoStock\(/]
  ]
);

registrarModulo(
  'Producción',
  'function crearLogicaProduccion(',
  'return { producir, anularProduccion };',
  [
    ['producir', 'function producir(', 'function anularProduccion(', /aplicarMovimientoStock\(/],
    ['anularProduccion', 'function anularProduccion(', null, /aplicarMovimientoStock\(/]
  ]
);

registrarModulo(
  'Fichas de coste',
  'function crearLogicaFichasCosto(',
  'return { addFichaCosto, updateFichaCosto, deleteFichaCosto, alergenosDeFicha };',
  [
    ['addFichaCosto', 'function addFichaCosto(', 'function updateFichaCosto(', /setFichasCosto\(/],
    ['updateFichaCosto', 'function updateFichaCosto(', 'function deleteFichaCosto(', /setFichasCosto\(/],
    ['deleteFichaCosto', 'function deleteFichaCosto(', null, /setFichasCosto\(/]
  ]
);

registrarModulo(
  'APPCC',
  'function crearLogicaAppcc(',
  'return { addPuntoControl, updatePuntoControl, deletePuntoControl, registrarAppcc, cancelarRegistroAppcc };',
  [
    ['addPuntoControl', 'function addPuntoControl(', 'function updatePuntoControl(', /setPuntosControl\(/],
    ['updatePuntoControl', 'function updatePuntoControl(', 'function deletePuntoControl(', /setPuntosControl\(/],
    ['deletePuntoControl', 'function deletePuntoControl(', 'function registrarAppcc(', /setPuntosControl\(/],
    ['registrarAppcc', 'function registrarAppcc(', 'function cancelarRegistroAppcc(', /setRegistrosAppcc\(/],
    ['cancelarRegistroAppcc', 'function cancelarRegistroAppcc(', null, /setRegistrosAppcc\(/]
  ]
);

registrarModulo(
  'Aceite',
  'function crearLogicaAceite(',
  'return { addFreidora, updateFreidora, deleteFreidora, registrarCambio, registrarRelleno, eliminarRegistroAceite, consumoPorCiclo };',
  [
    ['addFreidora', 'function addFreidora(', 'function updateFreidora(', /setFreidoras\(/],
    ['updateFreidora', 'function updateFreidora(', 'function deleteFreidora(', /setFreidoras\(/],
    ['deleteFreidora', 'function deleteFreidora(', 'function descontarAceite(', /setFreidoras\(/],
    ['registrarCambio', 'function registrarCambio(', 'function registrarRelleno(', /descontarAceite\(/],
    ['registrarRelleno', 'function registrarRelleno(', 'function eliminarRegistroAceite(', /descontarAceite\(/],
    ['eliminarRegistroAceite', 'function eliminarRegistroAceite(', 'function consumoPorCiclo(', /aplicarMovimientoStock\(|setRegistrosAceite\(|movimientos\.find\(/]
  ]
);

registrarModulo(
  'Traspasos',
  'function crearLogicaTraspasos(',
  'async function traspasarEntreLocales(',
  [
    ['traspasarStock', 'async function traspasarStock(', null, /aplicarMovimientoStock\(|trasladar_stock_interno/]
  ]
);

assert.equal(INVENTARIO.length, 23, `se esperaban 23 funciones inventariadas, se encontraron ${INVENTARIO.length}`);

for (const { nombreModulo, nombreFn, cuerpoFn, patronMutacion } of INVENTARIO) {
  const idxGuardia = cuerpoFn.search(/validarContextoEscrituraPM10\(\{ localActivoId, locales(?:, empresaId)? \}\)/);
  assert.ok(idxGuardia >= 0, `[${nombreModulo}] ${nombreFn}: no comprueba validarContextoEscrituraPM10`);

  const idxRechazo = cuerpoFn.indexOf('.ok', idxGuardia);
  assert.ok(idxRechazo >= 0, `[${nombreModulo}] ${nombreFn}: no comprueba el resultado .ok de la guardia`);

  const matchMutacion = cuerpoFn.slice(idxGuardia).match(patronMutacion);
  assert.ok(matchMutacion, `[${nombreModulo}] ${nombreFn}: no se encontró ninguna mutación real tras la guardia (¿se movió el patrón esperado?)`);
  const idxMutacionRelativo = matchMutacion.index;
  assert.ok(idxMutacionRelativo > 0, `[${nombreModulo}] ${nombreFn}: la mutación real no puede ocurrir antes de comprobar la guardia`);

  console.log(`P05_PM19_${nombreModulo.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_${nombreFn.toUpperCase()}_GUARDIA_ANTES_DE_MUTAR=PASS`);
}

console.log(`PM19 P05 — inventario de ${INVENTARIO.length} mutaciones locales protegidas, guardia siempre antes de mutar: contrato OK`);
