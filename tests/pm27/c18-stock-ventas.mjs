import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const patch = fs.readFileSync('supabase/migrations/20260914064500_pm27_c18_stock_sale_operation_id_hardening.sql', 'utf8');
const pm07Base = fs.readFileSync('supabase/migrations/20260904135838_pm07_stock_ubicacion_y_reversos.sql', 'utf8');
const pm07Cart = fs.readFileSync('supabase/migrations/20260904142728_pm07_carrito_aceptar_producto_id_frontend.sql', 'utf8');
const pm07Roles = fs.readFileSync('supabase/migrations/20260904140200_pm07_ajustar_roles_venta.sql', 'utf8');
const pm07Qty = fs.readFileSync('supabase/migrations/20260904141530_pm07_validacion_cantidad_semantica.sql', 'utf8');
const pm08 = fs.readFileSync('supabase/migrations/20260904204500_pm08_caja_devolucion_indivisible.sql', 'utf8');
const pm09Global = fs.readFileSync('supabase/migrations/20260905120500_pm09_operation_id_global_hardening.sql', 'utf8');
const frontend = fs.readFileSync('fuente.js', 'utf8');

function check(name, ok) {
  console.log(`PM27_C18_${name}=${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) process.exitCode = 1;
}

function sqlFunction(sql, name) {
  const start = sql.search(new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`, 'i'));
  if (start < 0) throw new Error(`PM27_C18_FUNCION_AUSENTE=${name}`);
  const bodyStart = sql.indexOf('as $$', start);
  const end = sql.indexOf('$$;', bodyStart + 5);
  if (bodyStart < 0 || end < 0) throw new Error(`PM27_C18_FUNCION_INCOMPLETA=${name}`);
  return sql.slice(start, end + 3);
}

const venta = sqlFunction(patch, 'registrar_venta_stock');
const carrito = sqlFunction(patch, 'registrar_venta_stock_carrito');
const baseVentaHistorica = sqlFunction(pm07Base, 'registrar_venta_stock');
const baseCarritoHistorica = sqlFunction(pm07Cart, 'registrar_venta_stock_carrito');

function guardGlobalValido(block) {
  return block.includes('v_operation_id := private.pm09_bloquear_operation_id_stock(p_operation_id)')
    && block.includes('where operation_id=v_operation_id')
    && block.includes("values(v_operation_id,'VENTA'");
}

// 1) Reproducir el hueco exacto que C18 corrige: las dos RPC BASE históricas
// eran invocables directamente y no participaban del guard global PM09.
check('DEFECTO_BASE_UNITARIA_REPRODUCIDO', !baseVentaHistorica.includes('pm09_bloquear_operation_id_stock'));
check('DEFECTO_BASE_CARRITO_REPRODUCIDO', !baseCarritoHistorica.includes('pm09_bloquear_operation_id_stock'));
check('WRAPPERS_PM09_YA_PROTEGIDOS', (pm09Global.match(/private\.pm09_bloquear_operation_id_stock\(p_operation_id\)/g) || []).length === 4);

// 2) Remediación mínima: mismas firmas BASE, mismo motor funcional, pero ambas
// ventas entran en el ledger lógico global antes de cualquier escritura.
check('DOS_RPC_BASE_ENDURECIDAS', (patch.match(/create or replace function public\.registrar_venta_stock(?:_carrito)?\s*\(/gi) || []).length === 2);
check('UNITARIA_GUARD_GLOBAL', guardGlobalValido(venta));
check('CARRITO_GUARD_GLOBAL', guardGlobalValido(carrito));
check('AUTH_ANTES_DEL_GUARD', [venta, carrito].every((b) => b.indexOf('auth.uid() is null') < b.indexOf('pm09_bloquear_operation_id_stock')));
check('TENANT_ANTES_DEL_GUARD', [venta, carrito].every((b) => b.indexOf('private.la_tiene_empresa(p_empresa_id)') < b.indexOf('pm09_bloquear_operation_id_stock')));
check('NO_ID_CRUDO_EN_ESCRITURAS', [venta, carrito].every((b) => !/values\(p_operation_id,'VENTA'/.test(b)));
check('ACL_NO_ANON', (patch.match(/revoke all on function public\.registrar_venta_stock/gi) || []).length === 2
  && (patch.match(/from public, anon/gi) || []).length === 2);
check('ACL_AUTH_PRESERVADA', (patch.match(/grant execute on function public\.registrar_venta_stock/gi) || []).length === 2);

// 3) Integridad funcional: autorización, cantidades, preflight del carrito y
// rollback transaccional siguen siendo parte del contrato que no debe degradarse.
check('ROLES_VENTA_REALES', pm07Roles.includes("('Propietario','Encargado','Cajero/a','Camarero/a','Churrero/a')"));
check('CANTIDAD_SEMANTICA', pm07Qty.includes("raise exception 'unidad_indivisible'")
  && pm07Qty.includes("raise exception 'precision_cantidad_excedida'"));
check('UNITARIA_STOCK_INSUFICIENTE_ANTES_WRITE', venta.indexOf("raise exception 'stock_insuficiente'") < venta.indexOf('update public.stock_ubicacion'));
check('CARRITO_PREFLIGHT_ANTES_WRITE', carrito.indexOf("raise exception 'stock_insuficiente:%'") < carrito.indexOf('insert into public.stock_operaciones'));
check('CARRITO_LOCK_ORDEN_DETERMINISTA', carrito.includes("order by x->>'productoId'"));
check('REPLAY_IDENTICO', [venta, carrito].every((b) => b.includes("'replayed',true")));
check('PAYLOAD_DISTINTO_CONFLICTO', [venta, carrito].every((b) => b.includes("raise exception 'operation_id_conflict'")));
check('TRANSACCION_MIGRACION', /^--[\s\S]*\nbegin;/.test(patch) && /\ncommit;\s*$/.test(patch));

// 4) Anulación/restauración: PM08 ya endureció las RPC BASE de reverso con el
// mismo lock global y evita reversar ventas con devoluciones parciales.
check('REVERSO_BASE_GUARD_GLOBAL', (pm08.match(/perform private\.pm08_bloquear_operation_id\(p_operation_id\)/g) || []).length >= 2);
check('REVERSO_CROSS_LEDGER', pm08.includes('public.caja_operaciones where operation_id=p_operation_id')
  && pm08.includes('public.arqueos_caja where operation_id=p_operation_id')
  && pm08.includes('public.arqueos_caja_anulaciones where operation_id=p_operation_id'));
check('REVERSO_NO_PISA_DEVOLUCIONES', pm08.includes("raise exception 'venta_con_devoluciones'"));
check('FRONTEND_USA_PM09_VENTA', frontend.includes('registrar_venta_stock_carrito_pm09'));
check('FRONTEND_USA_PM09_ANULACION', frontend.includes('revertir_venta_stock_carrito_pm09'));

// Prueba negativa deliberada en memoria: quitar el guard de una copia de la
// función debe ser detectado por este contrato.
const puenteada = venta.replace('v_operation_id := private.pm09_bloquear_operation_id_stock(p_operation_id);', 'v_operation_id := p_operation_id;');
assert.notEqual(puenteada, venta, 'mutación negativa C18 sin efecto');
assert.equal(guardGlobalValido(puenteada), false, 'el contrato C18 no detectó el bypass del ledger global');
console.log('PM27_C18_NEGATIVA_BYPASS_LEDGER_GLOBAL=PASS');

if (process.exitCode) throw new Error('PM27_C18_STATIC_CONTRACT_FAIL');

const regressions = [
  'tests/pm07/frontend-contract.mjs',
  'tests/pm08/frontend-contract.mjs',
  'tests/pm08/migration-contract.mjs',
  'tests/pm08/replay-scope-contract.mjs',
  'tests/pm09/p10-caja-contract.mjs',
  'tests/pm09/p16-isolation-context-contract.mjs',
  'tests/pm09/p17-robustness-contract.mjs',
  'tests/pm12/p08-fallos-replay-concurrencia-contract.mjs',
];
for (const test of regressions) {
  console.log(`PM27_C18_RUN=${test}`);
  execFileSync(process.execPath, [test], { stdio: 'inherit' });
}

console.log('PM27_C18_STOCK=PASS');
console.log('PM27_C18_VENTA=PASS');
console.log('PM27_C18_ANULACION=PASS');
console.log('PM27_C18_IDEMPOTENCIA_GLOBAL=PASS');
console.log('PM27_C18_INTEGRIDAD=PASS');
console.log('PM27_C18_AISLAMIENTO=PASS');
console.log('PM27_C18_RESULTADO=PASS');
