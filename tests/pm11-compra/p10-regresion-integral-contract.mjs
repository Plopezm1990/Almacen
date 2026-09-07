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

// P10 smoke móvil: el formulario de pedido no puede ensanchar el viewport al
// añadir cantidad/precio. El parche se carga globalmente; solo el reset y la
// nube QA permanecen detrás del guard de Deploy Preview.
assert.ok(fs.existsSync('pm11-compra-mobile-layout-v1.js'), 'parche móvil PM11 presente');
const mobile = fs.readFileSync('pm11-compra-mobile-layout-v1.js', 'utf8');
new Function(mobile);
assert.match(mobile, /MAX_MOBILE = 767/);
assert.match(mobile, /pm11-compra-mobile-form/);
assert.match(mobile, /pm11-compra-product-row/);
assert.match(mobile, /grid-template-columns: minmax\(0, 1fr\)/);
assert.match(mobile, /overflow-x: hidden !important/);
assert.match(mobile, /findPedidoForm/);
assert.match(mobile, /smallestProductRow/);
assert.match(mobile, /scrollLeft !== 0/);

// Corrección móvil P10 final: valida el parche realmente cargado por index.html.
assert.ok(fs.existsSync('pm11-compra-mobile-p10-v1.js'), 'parche móvil P10 final presente');
const mobileP10 = fs.readFileSync('pm11-compra-mobile-p10-v1.js', 'utf8');
new Function(mobileP10);
assert.match(mobileP10, /max-width: 767px/);
assert.match(mobileP10, /pm11-compra-mobile-form/);
assert.match(mobileP10, /pm11-compra-mobile-line/);
assert.match(mobileP10, /repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(mobileP10, /overflow-x: hidden !important/);
assert.match(mobileP10, /Nuevo pedido/);
assert.match(mobileP10, /productos del pedido/);
assert.match(mobileP10, /MutationObserver/);
assert.match(mobileP10, /pm11-compra-field-label/);
assert.match(mobileP10, /labelInput\(numeric\[0\], 'Cantidad', 'Cantidad del producto'\)/);
assert.match(mobileP10, /labelInput\(numeric\[1\], 'Precio unitario \(€\)', 'Precio unitario en euros'\)/);
assert.match(mobileP10, /Eliminar producto del pedido/);

const indexHtml = fs.readFileSync('index.html', 'utf8');
const mobileP10Tag = '<script defer src="./pm11-compra-mobile-p10-v1.js"></script>';
const mobileP10Pos = indexHtml.indexOf(mobileP10Tag);
const dashboardPos = indexHtml.indexOf('<script defer src="./dashboard-premium-v2.js"></script>');
assert.ok(mobileP10Pos >= 0, 'parche móvil P10 enlazado en index.html');
assert.ok(dashboardPos > mobileP10Pos, 'parche móvil P10 carga antes del dashboard');
assert.equal(indexHtml.split(mobileP10Tag).length - 1, 1, 'parche móvil P10 se carga una sola vez');

const previewLoader = fs.readFileSync('reset-pruebas-preview.js', 'utf8');
const loaderPos = previewLoader.indexOf('./pm11-compra-mobile-layout-v1.js?v=pm11-p10-mobile-v1');
const previewGuardPos = previewLoader.indexOf('if (typeof window === "undefined" || !HOST_PREVIEW.test(window.location.hostname)) return;');
assert.ok(loaderPos >= 0, 'loader móvil PM11 enlazado');
assert.ok(previewGuardPos > loaderPos, 'layout móvil se carga antes del guard QA y no queda limitado al preview');

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
