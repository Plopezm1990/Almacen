import fs from 'node:fs';
import assert from 'node:assert/strict';

const contract = fs.readFileSync('docs/plan-abc/F1_1_CONTRATOS_COMUNES_2026-10-01.md', 'utf8');
const transitions = fs.readFileSync('docs/plan-abc/F1_2_MATRIZ_ESTADOS_TRANSICIONES_2026-10-01.md', 'utf8');
const permissions = fs.readFileSync('docs/plan-abc/F1_3_MATRIZ_PERMISOS_2026-10-01.md', 'utf8');
const fiscal = fs.readFileSync('docs/plan-abc/F1_4_DECISION_FISCAL_EMISOR_2026-10-01.md', 'utf8');
const monetary = fs.readFileSync('docs/plan-abc/F1_5_VECTORES_MONETARIOS_2026-10-01.md', 'utf8');
const gate = fs.readFileSync('docs/plan-abc/F1_6_PUERTA_SALIDA_DISENO_2026-10-01.md', 'utf8');

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

for (const term of ['Fuentes oficiales', 'Datos que debe confirmar la asesoría', 'Emisor propio', 'Proveedor integrado', 'Criterios de no aceptación provisional', 'C03']) {
  assert.match(fiscal, new RegExp(term, 'i'), `F1.4 falta ${term}`);
}
assert.match(fiscal, /PENDIENTE_ASESORIA/);
assert.match(fiscal, /no se presume resuelta/i);
assert.match(fiscal, /No requiere secretos, migración remota, merge ni deploy/i);

for (const id of ['M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08', 'M09', 'M10', 'M11', 'M12']) {
  assert.match(monetary, new RegExp(`\\| ${id} \\|`), `F1.5 falta ${id}`);
}
assert.match(monetary, /PENDIENTE_APROBACION_DE_PARAMETROS/);
assert.match(monetary, /servidor y UI/i);
assert.match(monetary, /no se fijan\s+tasas fiscales reales/i);
assert.match(monetary, /no requiere secrets, migración remota, merge ni deploy/i);

for (const term of ['Entregables preparados', 'Bloqueos antes de F2', 'Condiciones para abrir F2', 'Fuera de esta puerta', 'PENDIENTE_APROBACION_F1']) {
  assert.match(gate, new RegExp(term, 'i'), `F1.6 falta ${term}`);
}
assert.match(gate, /No incluye `db push`/i);
assert.match(gate, /Tampoco\s+cierra los requisitos A01–C12/i);
assert.match(gate, /migración candidata revisable/i);

console.log('ABC_F1_COMMON_CONTRACT=PASS');
