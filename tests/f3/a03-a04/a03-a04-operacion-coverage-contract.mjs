import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const runtime = readFileSync('fuente.js', 'utf8');
const recovered = readFileSync('source-recovery/fuente-recuperado.js', 'utf8');

for (const source of [runtime, recovered]) {
  assert.match(source, /function crearLogicaVenta\(\{[\s\S]*registrarAuditoria = null \}\)/, 'la lógica de venta debe recibir el registrador de auditoría');
  assert.match(source, /crearLogicaVenta\(\{[\s\S]*empresaDelLocalActivo, registrarAuditoria \}\)/, 'la aplicación debe inyectar el registrador en las dos instancias de venta');
  assert.match(source, /registrarAuditoria\?\.\("VENTA_TPV"/, 'una venta confirmada debe quedar en la auditoría común');
  assert.match(source, /registrarAuditoria\?\.\("DESCUENTO_CUENTA"/, 'un descuento aplicado debe quedar en la auditoría común');
  assert.match(source, /registrarAuditoria\?\.\("MOVIMIENTO_CAJA"/, 'un movimiento de caja debe quedar en la auditoría común');
  assert.match(source, /"Anular venta"/, 'una anulación de venta debe quedar en la auditoría común');
  assert.match(source, /"Aplicar ajustes de inventario"/, 'un ajuste de stock debe quedar en la auditoría común');
}

console.log('A03_A04_BUSINESS_OPERATION_COVERAGE_CONTRACT=PASS');
