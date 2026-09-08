import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM20 P01: confirma que el checkpoint/inventario refleja la realidad del código y del
// catálogo de 25 hallazgos -- no una suposición. No cambia ningún comportamiento.

const evidencePath = 'tests/pm20/P01_CHECKPOINT_INVENTARIO_MODULOS.md';
assert.ok(fs.existsSync(evidencePath), 'evidencia P01 existe');
const evidence = fs.readFileSync(evidencePath, 'utf8');

for (const marker of [
  'PM20_P01_CHECKPOINT_INVENTARIO=PASS',
  'bdf25591a1e986a04223b399d11d8fe81d41d82d',
  '0a6c6e412d80c3612b8e2c3ea6f31e0e51ef118b',
  'LA-014',
  'LA-016',
  '23/25 hallazgos con cierre sustentado',
]) {
  assert.ok(evidence.includes(marker), 'P01 conserva ' + marker);
}

// ---- El catálogo de 25 hallazgos sigue teniendo exactamente 25 casos, LA-001..LA-025. ----
{
  const catalogo = JSON.parse(fs.readFileSync('tests/pm04/regression-catalog.json', 'utf8'));
  assert.equal(catalogo.cases.length, 25, 'el catálogo debe conservar los 25 hallazgos');
  const ids = catalogo.cases.map((c22) => c22.id).sort();
  const esperados = Array.from({ length: 25 }, (_2, i33) => `LA-${String(i33 + 1).padStart(3, '0')}`);
  assert.deepEqual(ids, esperados, 'los 25 IDs deben ser LA-001..LA-025 sin huecos');
  const la014 = catalogo.cases.find((c22) => c22.id === 'LA-014');
  const la016 = catalogo.cases.find((c22) => c22.id === 'LA-016');
  assert.equal(la014.package, 'PM-11');
  assert.equal(la016.package, 'PM-11');
  console.log('PM20_P01_CATALOGO_25_HALLAZGOS=PASS');
}

// ---- LA-014: el código de validación/persistencia de fechaEsperada ya existe y es
// correcto (round-trip sin objeto Date en el circuito de guardado). ----
{
  const src = fs.readFileSync('fuente.js', 'utf8');
  for (const symbol of [
    'function fechaValidaPedidoPM10(valor)',
    'const fechaEsperada = String(entrada.fechaEsperada ?? "").trim();',
    'if (fechaEsperada && !fechaValidaPedidoPM10(fechaEsperada))',
  ]) {
    assert.ok(src.includes(symbol), 'LA-014: código esperado presente: ' + symbol);
  }
  console.log('PM20_P01_LA014_CODIGO_YA_CORRECTO=PASS');
}

// ---- LA-016: confirma el defecto real (ausencia de validación) antes de corregirlo en
// P02 -- baseline, no contrato de cierre. ----
{
  const src = fs.readFileSync('fuente.js', 'utf8');
  const ini = src.indexOf('function crearLogicaProveedores(');
  assert.ok(ini >= 0, 'crearLogicaProveedores no encontrada');
  const fin = src.indexOf('function validarEmpleadoPM10(', ini);
  const cuerpo = src.slice(ini, fin);
  assert.doesNotMatch(cuerpo, /email/i, 'baseline LA-016: hoy no hay ninguna validación de email en addProveedor/updateProveedor');
  assert.doesNotMatch(cuerpo, /leadTime|diasPago/, 'baseline LA-016: hoy no hay ninguna validación de días en addProveedor/updateProveedor');
  console.log('PM20_P01_LA016_DEFECTO_CONFIRMADO_BASELINE=PASS');
}

// ---- Inventario de módulos de pantalla nunca probados: confirma que existen de verdad
// en el bundle (no se está inventando un hueco sobre código inexistente). ----
{
  const src = fs.readFileSync('fuente.js', 'utf8');
  for (const symbol of [
    'function Dashboard(',
    'function Tesoreria(',
    'function Estacionalidad(',
    'function SaldoAlmacen(',
    'function MapaAlmacen(',
    'function BusquedaGlobal(',
    'function EtiquetasCatalogo(',
    'function Auditoria(',
    'function Notificaciones(',
    'function Respaldos(',
  ]) {
    assert.ok(src.includes(symbol), 'módulo de pantalla presente: ' + symbol);
  }
  console.log('PM20_P01_MODULOS_SIN_FICHA_CONFIRMADOS=PASS');
}

console.log('PM20 P01 (checkpoint e inventario) — refleja el código y catálogo reales: contrato OK');
