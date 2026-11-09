import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtime = readFileSync('fuente.js', 'utf8');
const recovered = readFileSync('source-recovery/fuente-recuperado.js', 'utf8');
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..');
const pm09Migration = readFileSync(
  path.join(root, 'supabase', 'migrations', '20261001230000_abc_f5_pm09_security_hardening.sql'),
  'utf8'
);

for (const source of [runtime, recovered]) {
  assert.match(source, /function crearLogicaVenta\(\{[\s\S]*registrarAuditoria = null \}\)/, 'la lógica de venta debe recibir el registrador de auditoría');
  assert.match(source, /crearLogicaVenta\(\{[\s\S]*empresaDelLocalActivo, registrarAuditoria \}\)/, 'la aplicación debe inyectar el registrador en las dos instancias de venta');
  assert.match(source, /registrarAuditoria\?\.\("VENTA_TPV"/, 'una venta confirmada debe quedar en la auditoría común');
  assert.match(source, /registrarAuditoria\?\.\("DESCUENTO_CUENTA"/, 'un descuento aplicado debe quedar en la auditoría común');
  assert.match(source, /registrarAuditoria\?\.\("MOVIMIENTO_CAJA"/, 'un movimiento de caja debe quedar en la auditoría común');
  assert.match(source, /"Anular venta"/, 'una anulación de venta debe quedar en la auditoría común');
  assert.match(source, /"Aplicar ajustes de inventario"/, 'un ajuste de stock debe quedar en la auditoría común');
  assert.match(source, /registrar_venta_stock_carrito_pm09/, 'la venta debe pasar por la RPC PM09 server-side');
  assert.match(source, /revertir_venta_stock_carrito_pm09/, 'la reversión debe pasar por la RPC PM09 server-side');
}

assert.match(
  pm09Migration,
  /v_res\s*:=\s*public\.registrar_venta_stock_carrito\(/,
  'el wrapper PM09 de venta debe delegar en la función server-side autoritativa'
);
assert.match(
  pm09Migration,
  /v_res\s*:=\s*public\.revertir_venta_stock_carrito\(/,
  'el wrapper PM09 de reversión debe delegar en la función server-side autoritativa'
);

console.log('A03_A04_BUSINESS_OPERATION_COVERAGE_CONTRACT=PASS');
