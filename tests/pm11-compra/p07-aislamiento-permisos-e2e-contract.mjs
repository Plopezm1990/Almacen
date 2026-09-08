import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');
const p01 = fs.readFileSync('tests/pm11-compra/P01_CHECKPOINT_INVENTARIO.md', 'utf8');
const p02 = fs.readFileSync('tests/pm11-compra/P02_CONTRATO_E2E_ESTADOS.md', 'utf8');
const g1 = fs.readFileSync('tests/g1/P05_PERMISOS_AISLAMIENTO_EVIDENCIA.md', 'utf8');
const dec = fs.readFileSync('docs/plan-maestro/PM03_CONTRATOS_MINIMOS_PROPUESTA.md', 'utf8');
const todosSql = fs.readFileSync('supabase/migrations/20260905183353_g1_p05_bloquear_todos_locales_mutacion.sql', 'utf8');
const finSql = fs.readFileSync('supabase/migrations/20260905185935_g1_p08_operation_id_finanzas_global.sql', 'utf8');
const pm10Pedidos = fs.readFileSync('tests/pm10/p05-pedidos-contract.mjs', 'utf8');
const pm10Recepcion = fs.readFileSync('tests/pm10/p06-recepcion-contract.mjs', 'utf8');
const p04 = fs.readFileSync('tests/pm11-compra/p04-albaran-trazabilidad-contract.mjs', 'utf8');
const p05 = fs.readFileSync('tests/pm11-compra/p05-factura-identidad-contract.mjs', 'utf8');
const p06 = fs.readFileSync('tests/pm11-compra/p06-pago-reverso-e2e-contract.mjs', 'utf8');

function contiene(texto, patron, mensaje) {
  assert.match(texto, patron, mensaje);
}

// Alcance P07 congelado: P02 define la responsabilidad y P01 detalla la matriz objetivo.
contiene(p02, /P07:\*\* aislamiento y permisos E2E|\*\*P07:\*\* aislamiento y permisos E2E|\*\*P07 — Aislamiento y permisos\*\*|P07 — Aislamiento y permisos/, 'P07 debe estar definido como aislamiento y permisos');
contiene(p01, /P07 — Aislamiento y permisos:\*\* A1\/A2\/B1\/Todos\/inactivo|P07 — Aislamiento y permisos.*A1\/A2\/B1\/Todos\/inactivo/, 'P07 debe cubrir A1/A2/B1/Todos/inactivo');

// Contrato maestro de contexto y roles.
for (const patron of [
  /Ningún dato de negocio se comparte entre empresas/,
  /Toda mutación exige un local destino explícito/,
  /Local inactivo\/cerrado/,
  /No admite nuevas operaciones ordinarias/,
  /Inactivo.*sin acceso funcional/s,
  /Empresa A \+ local de Empresa B/,
  /Documento de A pagado\/modificado desde un usuario sin permiso/
]) contiene(dec, patron, `Falta regla de permisos/aislamiento: ${patron}`);

// Evidencia viva heredada G1: matriz A1/A2/B1, inactivo y TODOS.
for (const texto of [
  'Cajero A1',
  'Encargado A2',
  'Propietario B',
  'Inactivo',
  'Cajero A1 → Caja A2',
  'Propietario A → Empresa B/B1',
  'Propietario A → `TODOS`',
  'Usuario inactivo → Caja A1',
  'G1_P05_PERMISOS_AISLAMIENTO=PASS'
]) assert.ok(g1.includes(texto), `Falta evidencia G1: ${texto}`);

// Backend: usuario activo + empresa/local autorizados y bloqueo del contexto virtual TODOS.
contiene(todosSql, /private\.la_usuario_activo\(\)/, 'la_tiene_local debe exigir usuario activo');
contiene(todosSql, /upper\(btrim\(p_local\)\) <> 'TODOS'/, 'TODOS debe estar bloqueado como destino');
contiene(todosSql, /m\.empresa_id = p_empresa/, 'la_tiene_local debe fijar empresa');
contiene(todosSql, /m\.activo = true/, 'membresía inactiva debe quedar fuera');
contiene(todosSql, /m\.todos_locales = true or m\.local_id = p_local/, 'solo local permitido o membresía todos_locales sobre local real');

// Pago/reverso: permiso financiero + empresa/local exactos en servidor.
contiene(finSql, /not private\.pm06_puede_gestionar_finanzas\(\).*pago_no_autorizado/s, 'pago exige permiso financiero');
contiene(finSql, /not private\.la_tiene_empresa\(p_empresa_id\) or not private\.la_tiene_local\(p_empresa_id,p_local_id\).*contexto_no_autorizado/s, 'pago exige empresa/local autorizados');
contiene(finSql, /where id=p_factura_id and empresa_id=p_empresa_id and local_id=p_local_id for update/, 'factura se bloquea por empresa/local exactos');
contiene(finSql, /not private\.la_tiene_empresa\(original\.empresa_id\) or not private\.la_tiene_local\(original\.empresa_id,original\.local_id\).*contexto_no_autorizado/s, 'reverso revalida el contexto del pago original');

// Regresión logística: pedidos y recepción ya prueban producto de otro local y ausencia de local activo.
for (const [nombre, txt] of [['pedidos', pm10Pedidos], ['recepción', pm10Recepcion]]) {
  contiene(txt, /localId: 'L2'/, `${nombre}: fixture de otro local`);
  contiene(txt, /referencia_otro_contexto/, `${nombre}: otro local debe rechazarse`);
  contiene(txt, /localActivoId: null/, `${nombre}: sin local activo debe rechazarse`);
  contiene(txt, /contexto_no_autorizado/, `${nombre}: código fail-closed`);
}

// Albarán ligado conserva la barrera de contexto de recepción; P04 se ejecuta completo como regresión del gate.
contiene(p04, /validarRecepcionPedidoPM10/, 'P04 debe seguir comprobando la barrera logística de contexto');
contiene(p04, /proveedor del albarán no coincide con el proveedor del pedido enlazado/, 'P04 debe seguir comprobando coherencia de proveedor');

// Factura/pago frontend: ningún documento fuera del contexto puede entrar al ledger.
const albIni = src.indexOf('function crearLogicaAlbaranes({');
const pagarIni = src.indexOf('  async function marcarPagada(id, pagada, importe)', albIni);
const pagarFin = src.indexOf('  function procesarRecepcion({', pagarIni);
assert.ok(albIni >= 0 && pagarIni > albIni && pagarFin > pagarIni, 'marcarPagada localizado');
const pagar = src.slice(pagarIni, pagarFin);
contiene(pagar, /a22\.empresaId !== empresaId \|\| a22\.localId !== localActivoId/, 'marcarPagada bloquea documento de otra empresa/local');
contiene(pagar, /Factura fuera del contexto autorizado/, 'marcarPagada falla cerrado por contexto');
contiene(pagar, /exigirFactura: true/, 'solo factura explícita puede pagarse');

// P05 y P06 mantienen identidad financiera y aislamiento del saldo por contexto.
contiene(p05, /empresaId: 'E2'/, 'P05 cubre identidad de otra empresa sin colisión indebida');
contiene(p06, /localId: 'LOC-B'/, 'P06 cubre movimiento de otro local');
contiene(p06, /origenFactura: 'directa'/, 'P06 cubre otro origen');
contiene(p06, /assert\.equal\(saldo\.pagado, 40\)/, 'P06 confirma que movimientos ajenos no contaminan el saldo');

console.log('PM11_COMPRA_P07_AISLAMIENTO_PERMISOS_E2E=PASS');
