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
const personalMigration = readFileSync(
  path.join(root, 'supabase', 'migrations', '20260917143000_p2_pm11_personal_post_reset.sql'),
  'utf8'
);
const closeMigration = readFileSync(
  path.join(root, 'supabase', 'migrations', '20261001140000_abc_f5_c04_close_reopen.sql'),
  'utf8'
);
const appccMigration = readFileSync(
  path.join(root, 'supabase', 'migrations', '20261109150000_a03_a04_appcc_y_atribucion.sql'),
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
  assert.doesNotMatch(source, /\bdescontar_stock(?:_carrito)?\b/, 'el cliente no debe volver al camino legado de stock sin atribución');
  assert.match(source, /pm11_alta_empleado/, 'Personal debe pasar por la RPC server-side de alta');
  assert.match(source, /pm11_baja_empleado/, 'Personal debe pasar por la RPC server-side de baja');
  assert.match(source, /pm11_reactivar_empleado/, 'Personal debe pasar por la RPC server-side de reactivación');
  assert.match(source, /abc_iniciar_cierre_sesion_caja/, 'el cierre debe pasar por la RPC server-side de apertura');
  assert.match(source, /abc_finalizar_cierre_sesion_caja/, 'el cierre debe pasar por la RPC server-side de finalización');

  const auditRpcCalls = source.match(/supabase\.rpc\("registrar_auditoria"/g) || [];
  assert.equal(auditRpcCalls.length, 1, 'el cliente debe tener una única llamada a la auditoría común');
  const auditRpc = source.match(/supabase\.rpc\("registrar_auditoria",\s*\{([\s\S]*?)\}\)/);
  assert.ok(auditRpc, 'la llamada cliente debe usar la RPC de auditoría común');
  for (const parameter of ['p_id', 'p_usuario', 'p_accion', 'p_detalle', 'p_fecha', 'p_hora', 'p_empresa_id', 'p_local_id']) {
    assert.match(auditRpc[1], new RegExp(`\\b${parameter}\\b`), `la llamada de auditoría debe conservar ${parameter}`);
  }
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
assert.match(personalMigration, /private\.pm11_auditar_empleado/, 'Personal debe conservar el helper de auditoría server-side');
assert.match(personalMigration, /auth\.uid\(\)/, 'Personal debe derivar el actor de la sesión');
assert.match(personalMigration, /actor_user_id/, 'Personal debe persistir el actor de sesión');
assert.match(closeMigration, /auth\.uid\(\)/, 'el cierre debe derivar el actor de la sesión');
assert.match(closeMigration, /actor_user_id/, 'el cierre debe persistir el actor de sesión');

const auditFunction = appccMigration.match(
  /create or replace function public\.registrar_auditoria\([\s\S]*?as \$\$([\s\S]*?)\$\$;/i
);
assert.ok(auditFunction, 'la migración A-04 debe contener la función común de auditoría');
assert.doesNotMatch(
  auditFunction[1],
  /\bp_usuario\b/,
  'el nombre recibido del cliente no puede ser la identidad autoritativa persistida'
);
assert.match(auditFunction[1], /auth\.uid\(\)/, 'la auditoría común debe derivar el actor de la sesión');
assert.match(auditFunction[1], /v_actor_nombre/, 'la auditoría común debe resolver el nombre desde el perfil');

console.log('A03_A04_BUSINESS_OPERATION_COVERAGE_CONTRACT=PASS');
