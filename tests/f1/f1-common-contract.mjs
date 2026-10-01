import fs from 'node:fs';
import assert from 'node:assert/strict';

const contract = fs.readFileSync('docs/plan-abc/F1_1_CONTRATOS_COMUNES_2026-10-01.md', 'utf8');
const transitions = fs.readFileSync('docs/plan-abc/F1_2_MATRIZ_ESTADOS_TRANSICIONES_2026-10-01.md', 'utf8');
const permissions = fs.readFileSync('docs/plan-abc/F1_3_MATRIZ_PERMISOS_2026-10-01.md', 'utf8');

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

for (const term of ['Sesión de caja', 'Día operativo', 'Pedido y cuenta', 'Pago y resultado externo', 'Documento y stock', 'Criterios de aceptación F1.2']) {
  assert.match(transitions, new RegExp(term, 'i'), `F1.2 falta ${term}`);
}
assert.match(transitions, /PENDIENTE_APROBACION_DE_NEGOCIO/);
assert.match(transitions, /no duplica el efecto económico ni externo/i);
assert.match(transitions, /No decide aún el proveedor/i);
assert.match(transitions, /no\s+requiere secrets, migración remota, merge ni deploy/i);

for (const term of ['Operaciones protegidas', 'Propietario', 'Encargado', 'Cajero', 'Camarero', 'Denegaciones obligatorias', 'Evidencia por rol', 'Criterios de aceptación F1.3']) {
  assert.match(permissions, new RegExp(term, 'i'), `F1.3 falta ${term}`);
}
assert.match(permissions, /PENDIENTE_VALIDACION_DE_ROLES/);
assert.match(permissions, /autorización se decide en servidor/i);
assert.match(permissions, /No modifica ACL\/RLS/i);
assert.match(permissions, /no requiere secretos, merge ni deploy/i);

console.log('ABC_F1_COMMON_CONTRACT=PASS');
