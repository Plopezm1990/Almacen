import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM19 P03 (corregido en P05): confirma, por inspección estática, que traspasarStock
// comprueba de verdad el estado del local antes de mover stock.
//
// Corrección respecto al cierre original de P03: aquel commit introdujo
// localActivoEstaActivoPM19, una función propia para esta comprobación. Al generalizar el
// mismo criterio a Productos/Producción/Fichas de coste/APPCC/Aceite en P05 se descubrió
// que ya existía una función establecida y reutilizada en 7 puntos del proyecto
// (validarContextoEscrituraPM10, con más cobertura: local inexistente y
// empresa/local incompatibles, además de inactivo/"Todos"). Mantener las dos habría sido
// exactamente la "segunda lógica paralela" que se pedía evitar, así que traspasarStock se
// corrigió aquí para usar la única función establecida -- ver
// tests/pm19/p05-validar-contexto-escritura-contract.mjs para la prueba de que esa
// función cubre los casos exigidos, y tests/pm19/P05_CIERRE_CONTEXTO_ESCRITURA_UNICO.md
// para el detalle completo de la corrección.

const src = fs.readFileSync('fuente.js', 'utf8');
const ini = src.indexOf('function crearLogicaTraspasos(');
assert.ok(ini >= 0, 'crearLogicaTraspasos no encontrada');
const fin = src.indexOf('function crearLogicaSeguridad(', ini);
const cuerpo = src.slice(ini, fin);

// ---- traspasarStock: la comprobación de contexto de escritura es lo primero que hace. ----
{
  const iniFn = cuerpo.indexOf('async function traspasarStock(');
  const finFn = cuerpo.indexOf('async function traspasarEntreLocales(', iniFn);
  const fnTraspasarStock = cuerpo.slice(iniFn, finFn);
  assert.match(fnTraspasarStock, /const contextoTraspaso = validarContextoEscrituraPM10\(\{ localActivoId, locales \}\);/, 'traspasarStock debe comprobar el contexto de escritura antes de mover stock');
  assert.match(fnTraspasarStock, /if \(!contextoTraspaso\.ok\) return contextoTraspaso;/, 'un contexto no autorizado debe rechazar antes de cualquier efecto');
  console.log('P03_PM19_TRASPASAR_STOCK_USA_CONTEXTO_ESCRITURA=PASS');
}

// ---- No debe quedar ningún rastro de la función propia retirada. ----
{
  assert.doesNotMatch(src, /localActivoEstaActivoPM19/, 'localActivoEstaActivoPM19 debe estar completamente retirada, sin consumidores');
  console.log('P03_PM19_SIN_LOGICA_PARALELA_RETIRADA=PASS');
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

// ---- El resto de traspasarStock (validaciones de piso/almacén, atomicidad remota,
// idempotencia, trazabilidad) sigue intacto tras la corrección. ----
{
  const iniFn = cuerpo.indexOf('async function traspasarStock(');
  const finFn = cuerpo.indexOf('async function traspasarEntreLocales(', iniFn);
  const fnTraspasarStock = cuerpo.slice(iniFn, finFn);
  assert.match(fnTraspasarStock, /Solo hay \$\{fmt\(enAlmacen\)\} \$\{prod\.unidad\} en el almac\\xE9n/, 'la validación de stock disponible en almacén sigue intacta');
  assert.match(fnTraspasarStock, /Solo hay \$\{fmt\(enPiso\)\} \$\{prod\.unidad\} en el piso de venta/, 'la validación de stock disponible en piso sigue intacta');
  assert.match(fnTraspasarStock, /trasladar_stock_interno/, 'la ruta atómica remota (RPC) sigue intacta');
  assert.match(fnTraspasarStock, /setTraspasos\(\(s22\) => \[/, 'el registro trazable del traspaso sigue intacto');
  console.log('P03_PM19_RESTO_DE_TRASPASAR_STOCK_INTACTO=PASS');
}

console.log('PM19 P03 (corregido) — traspasarStock usa la única autoridad de contexto: contrato OK');
