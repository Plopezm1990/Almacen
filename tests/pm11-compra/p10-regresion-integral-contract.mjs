import fs from 'node:fs';
import assert from 'node:assert/strict';

const evidencias = [
  ['P01_CHECKPOINT_INVENTARIO.md', 'PM11_COMPRA_P01'],
  ['P02_CONTRATO_E2E_ESTADOS.md', 'PM11_COMPRA_P02'],
  ['P03_RECEPCIONES_MULTIPLES_REPLAY.md', 'PM11_COMPRA_P03'],
  ['P04_ALBARAN_TRAZABILIDAD.md', 'PM11_COMPRA_P04'],
  ['P05_FACTURA_IDENTIDAD.md', 'PM11_COMPRA_P05'],
  ['P06_PAGO_REVERSO_E2E.md', 'PM11_COMPRA_P06'],
  ['P07_AISLAMIENTO_PERMISOS_E2E.md', 'PM11_COMPRA_P07'],
  ['P08_FALLOS_REPLAY_CONCURRENCIA.md', 'PM11_COMPRA_P08'],
  ['P09_CONCILIACION_E2E.md', 'PM11_COMPRA_P09']
];

for (const [nombre, prefijo] of evidencias) {
  const ruta = `tests/pm11-compra/${nombre}`;
  assert.ok(fs.existsSync(ruta), `${ruta} existe`);
  const texto = fs.readFileSync(ruta, 'utf8');
  assert.match(texto, new RegExp(`${prefijo}[^\\n]*=PASS`), `${nombre} conserva cierre PASS`);
}

const p01 = fs.readFileSync('tests/pm11-compra/P01_CHECKPOINT_INVENTARIO.md', 'utf8');
assert.match(p01, /P10 — Regresión integral \+ Deploy Preview \+ smoke real \+ cierre formal\./);
assert.match(p01, /Producción: \*\*NO TOCAR\*\*/);
assert.match(p01, /main` congelado: `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`/);

const p09 = fs.readFileSync('tests/pm11-compra/P09_CONCILIACION_E2E.md', 'utf8');
assert.match(p09, /P09 no necesitó modificar `fuente\.js`, ni migraciones de Supabase, ni datos QA/);
assert.match(p09, /total = \*\*77,00\*\*/);
assert.match(p09, /pago parcial de 30: pagado 30, pendiente 47/);
assert.match(p09, /reverso del pago final de 47: pagado 30, pendiente 47/);

const src = fs.readFileSync('fuente.js', 'utf8');
for (const simbolo of [
  'operationIdEfectoRecepcionPedidoPM11',
  'validarIdentidadFacturaAlbaranPM11',
  'calcularSaldoFacturaPM06',
  'crearLogicaPedidos',
  'crearLogicaAlbaranes'
]) {
  assert.ok(src.includes(simbolo), `${simbolo} sigue presente en el bundle`);
}

const contratos = fs.readdirSync('tests/pm11-compra');
for (let p = 2; p <= 9; p += 1) {
  const prefijo = `p${String(p).padStart(2, '0')}-`;
  assert.ok(contratos.some(nombre => nombre.startsWith(prefijo) && nombre.endsWith('-contract.mjs')), `contrato P${String(p).padStart(2, '0')} presente`);
}
assert.ok(!contratos.some(nombre => /^P11_|^p11-/i.test(nombre)), 'PM11 Compra no inventa P11');

const workflows = fs.readdirSync('.github/workflows');
for (let p = 2; p <= 9; p += 1) {
  const prefijo = `pm11-compra-p${String(p).padStart(2, '0')}-`;
  assert.ok(workflows.some(nombre => nombre.startsWith(prefijo) && nombre.endsWith('.yml')), `workflow P${String(p).padStart(2, '0')} presente`);
}
assert.ok(!workflows.some(nombre => /^pm11-compra-p11-/i.test(nombre)), 'no existe workflow P11 inventado');

console.log('PM11_COMPRA_P10_REGRESION_INTEGRAL=PASS');
