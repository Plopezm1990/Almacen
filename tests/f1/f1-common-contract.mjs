import fs from 'node:fs';
import assert from 'node:assert/strict';

const contract = fs.readFileSync('docs/plan-abc/F1_1_CONTRATOS_COMUNES_2026-10-01.md', 'utf8');

for (const term of [
  'Moneda', 'Redondeo', 'Impuestos', 'Precio histórico', 'Descuento', 'Reparto',
  'Pedido', 'Pago', 'Documento', 'Caja', 'Stock', 'auth.uid()', 'empresa', 'local',
  'resultado desconocido', 'PENDIENTE_ASESORIA', 'Criterios de aceptación F1.1',
]) {
  assert.match(contract, new RegExp(term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i'), `F1 falta ${term}`);
}

assert.match(contract, /PENDIENTE_APROBACION_DE_NEGOCIO/);
assert.match(contract, /no genera doble cargo/i);
assert.match(contract, /No requiere\s+secrets, migración remota, merge ni deploy/i);
assert.match(contract, /B07, B08 y B12 siguen detrás de adaptadores/i);

console.log('ABC_F1_COMMON_CONTRACT=PASS');
