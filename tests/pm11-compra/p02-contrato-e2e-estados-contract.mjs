import fs from 'node:fs';
import assert from 'node:assert/strict';

const contrato = fs.readFileSync('tests/pm11-compra/P02_CONTRATO_E2E_ESTADOS.md', 'utf8');
const p01 = fs.readFileSync('tests/pm11-compra/P01_CHECKPOINT_INVENTARIO.md', 'utf8');
const g1 = fs.readFileSync('tests/g1/P08_LA004_GATE_EVIDENCIA.md', 'utf8');
const migracion = fs.readFileSync('supabase/migrations/20260905185935_g1_p08_operation_id_finanzas_global.sql', 'utf8');

function contiene(texto, patron, mensaje) {
  assert.match(texto, patron, mensaje);
}

contiene(p01, /PM11_COMPRA_P01_CHECKPOINT_INVENTARIO=PASS/, 'P02 requiere P01 cerrado');

for (const patron of [
  /Pedido → recepción → albarán → factura → pago\/reverso → conciliación/,
  /Una operación física no puede producir dos efectos/,
  /Fallo cerrado/,
  /pedido\.id.*inmutable/,
  /pedido\.localId.*inmutable/,
  /Usar únicamente `pedidoId` como identidad de todas las recepciones parciales \*\*no es suficiente\*\*/,
  /albaran\.pedidoId/,
  /Confirmar dos veces el mismo albarán no puede duplicar recepción ni stock/,
  /Pendiente → Parcial → Recibido/,
  /`esFactura === false`/,
  /`esFactura === true`/,
  /`numeroFactura` no vacío/,
  /`fechaFactura` válida/,
  /`undefined\/null` legado/,
  /`facturaId = albaran\.id`/,
  /`origenFactura = "albaran"`/,
  /pagado = Σ CONFIRMADO - Σ REVERSO/,
  /pendiente = max\(0, total - pagado\)/,
  /sobrepago rechazado/,
  /mismo `operationId` con contenido distinto produce conflicto/,
  /total factura = pagado \+ pendiente/,
  /nuevo pendiente = pendiente anterior \+ importe reversado/,
  /PM11_COMPRA_P02_CONTRATO_E2E_ESTADOS=PASS/
]) {
  contiene(contrato, patron, `Falta cláusula obligatoria P02: ${patron}`);
}

const prohibidos = [
  'recibir más que lo pendiente',
  'aplicar dos veces el mismo evento logístico',
  'confirmar dos veces un albarán y duplicar stock',
  'crear dos obligaciones financieras para el mismo albarán confirmado',
  'pagar una factura de otro contexto',
  'sobrepagar',
  'avanzar a estado confirmado cuando el servidor no confirmó el efecto'
];
for (const caso of prohibidos) {
  assert.ok(contrato.includes(caso), `Falta caso prohibido: ${caso}`);
}

contiene(g1, /G1_P08_LA004_LIVE=20\/20_PASS/, 'La base financiera G1 debe seguir documentada como 20/20 PASS');
contiene(migracion, /create or replace function public\.registrar_pago_factura/i, 'Debe existir RPC autoritativa de pago');
contiene(migracion, /create or replace function public\.revertir_pago_factura/i, 'Debe existir RPC autoritativa de reverso');
contiene(migracion, /operation_id_conflict/, 'Debe conservarse conflicto de operationId');
contiene(migracion, /pago_supera_saldo/, 'Debe conservarse rechazo de sobrepago');

console.log('PM11_COMPRA_P02_CONTRATO_E2E_ESTADOS=PASS');
