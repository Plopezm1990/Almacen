import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const patch = fs.readFileSync('supabase/migrations/20260914071000_pm27_c19_transfer_operation_id_hardening.sql', 'utf8');
const pm07Base = fs.readFileSync('supabase/migrations/20260904135838_pm07_stock_ubicacion_y_reversos.sql', 'utf8');
const pm07Interlocal = fs.readFileSync('supabase/migrations/20260904142656_pm07_carrito_y_traslado_interlocal_atomicos.sql', 'utf8');
const pm07Roles = fs.readFileSync('supabase/migrations/20260904135838_pm07_stock_ubicacion_y_reversos.sql', 'utf8');
const pm09Global = fs.readFileSync('supabase/migrations/20260905120500_pm09_operation_id_global_hardening.sql', 'utf8');
const frontend = fs.readFileSync('source-recovery/fuente-recuperado.js', 'utf8');

function check(name, ok) {
  console.log(`PM27_C19_${name}=${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) process.exitCode = 1;
}

function sqlFunction(sql, name) {
  const start = sql.search(new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`, 'i'));
  if (start < 0) throw new Error(`PM27_C19_FUNCION_AUSENTE=${name}`);
  const bodyStart = sql.indexOf('as $$', start);
  const end = sql.indexOf('$$;', bodyStart + 5);
  if (bodyStart < 0 || end < 0) throw new Error(`PM27_C19_FUNCION_INCOMPLETA=${name}`);
  return sql.slice(start, end + 3);
}

const interno = sqlFunction(patch, 'trasladar_stock_interno');
const interlocal = sqlFunction(patch, 'trasladar_stock_entre_locales');
const historicoInterno = sqlFunction(pm07Base, 'trasladar_stock_interno');
const historicoInterlocal = sqlFunction(pm07Interlocal, 'trasladar_stock_entre_locales');

function guardGlobalValido(block, tipo) {
  return block.includes('v_operation_id := private.pm09_bloquear_operation_id_stock(p_operation_id)')
    && block.includes('where operation_id=v_operation_id')
    && block.includes(`values(v_operation_id,'${tipo}'`);
}

// 1) Hallazgo reproducible: ambos traspasos históricos compartían
// stock_operaciones pero no el lock/namespace global con Caja/arqueos.
check('DEFECTO_INTERNO_GLOBAL_REPRODUCIDO', !historicoInterno.includes('pm09_bloquear_operation_id_stock'));
check('DEFECTO_INTERLOCAL_GLOBAL_REPRODUCIDO', !historicoInterlocal.includes('pm09_bloquear_operation_id_stock'));
check('HELPER_GLOBAL_EXISTENTE', pm09Global.includes('create or replace function private.pm09_bloquear_operation_id_stock'));

// El traslado interno histórico comprobaba el estado mutable de stock antes
// de reconocer un replay ya comprometido. El interlocal ya hacía replay antes.
check('DEFECTO_REPLAY_INTERNO_REPRODUCIDO', historicoInterno.indexOf('select * into s from public.stock_ubicacion') < historicoInterno.indexOf('select * into op from public.stock_operaciones'));
check('INTERLOCAL_HISTORICO_REPLAY_TEMPRANO', historicoInterlocal.indexOf('select * into op from public.stock_operaciones') < historicoInterlocal.indexOf('select * into so from public.stock_ubicacion'));

// 2) Guard global e idempotencia segura.
check('INTERNO_GUARD_GLOBAL', guardGlobalValido(interno, 'TRASLADO_INTERNO'));
check('INTERLOCAL_GUARD_GLOBAL', guardGlobalValido(interlocal, 'TRASLADO_ENTRE_LOCALES'));
check('AUTH_ANTES_GUARD', [interno, interlocal].every((b) => b.indexOf('auth.uid() is null') < b.indexOf('pm09_bloquear_operation_id_stock')));
check('CONTEXTO_ANTES_GUARD', interno.indexOf('private.la_tiene_local(p_empresa_id,p_local_id)') < interno.indexOf('pm09_bloquear_operation_id_stock')
  && interlocal.indexOf('private.la_tiene_local(p_empresa_id,p_origen_local_id)') < interlocal.indexOf('pm09_bloquear_operation_id_stock'));
check('INTERNO_REPLAY_ANTES_STOCK_MUTABLE', interno.indexOf('select * into op from public.stock_operaciones') < interno.indexOf('select * into s from public.stock_ubicacion'));
check('REPLAY_IDENTICO', [interno, interlocal].every((b) => b.includes("'replayed',true")));
check('PAYLOAD_DISTINTO_CONFLICTO', [interno, interlocal].every((b) => b.includes("raise exception 'operation_id_conflict'")));
check('NO_ID_CRUDO_EN_ESCRITURAS', [interno, interlocal].every((b) => !/values\(p_operation_id,'TRASLADO_/.test(b)));

// 3) Origen/destino y aislamiento.
check('ROL_GESTION_STOCK', pm07Roles.includes("coalesce(private.la_rol(),'') in ('Propietario','Encargado')"));
check('INTERNO_UBICACIONES_VALIDAS', interno.includes("p_origen not in ('almacen','piso')") && interno.includes('p_origen=p_destino'));
check('INTERLOCAL_DISTINTO_LOCAL', interlocal.includes('p_origen_local_id=p_destino_local_id'));
check('INTERLOCAL_AMBOS_LOCALES_AUTORIZADOS', interlocal.includes('private.la_tiene_local(p_empresa_id,p_origen_local_id)')
  && interlocal.includes('private.la_tiene_local(p_empresa_id,p_destino_local_id)'));
check('INTERLOCAL_AMBOS_OPERABLES', interlocal.includes('not so.local_operable or not sd.local_operable'));
check('UNIDAD_COMPATIBLE', interlocal.includes("raise exception 'unidad_incompatible'"));
check('CANTIDAD_VALIDA_AMBOS_EXTREMOS', interlocal.includes('pm07_validar_cantidad(p_cantidad,so.fraccionable,so.precision_cantidad)')
  && interlocal.includes('pm07_validar_cantidad(cant,sd.fraccionable,sd.precision_cantidad)'));

// 4) Atomicidad y conservación.
check('LOCK_DETERMINISTA', interlocal.includes('(p_origen_local_id,p_producto_origen_id) <= (p_destino_local_id,p_producto_destino_id)'));
check('PRECHECK_STOCK_ANTES_WRITE', interlocal.indexOf("raise exception 'stock_insuficiente_ubicacion'") < interlocal.indexOf('insert into public.stock_operaciones'));
check('DOS_MOVIMIENTOS_OPUESTOS', interlocal.includes("-cant,0,-cant,cant") && interlocal.includes("cant,0,cant,cant"));
check('EFECTO_NETO_EMPRESA_CERO', interlocal.includes("'efectoNetoEmpresa',0"));
check('INTERNO_CONSERVA_TOTAL', interno.includes("values(v_operation_id,'TRASLADO_INTERNO'") && interno.includes('da,dp,0,cant'));
check('TRANSACCION_EXPLICITA', /^--[\s\S]*\nbegin;/.test(patch) && /\ncommit;\s*$/.test(patch));

// 5) Superficie de acceso y frontend.
check('ACL_NO_ANON', (patch.match(/revoke all on function public\.trasladar_stock_/gi) || []).length === 2
  && (patch.match(/from public, anon/gi) || []).length === 2);
check('ACL_AUTH_PRESERVADA', (patch.match(/grant execute on function public\.trasladar_stock_/gi) || []).length === 2);
check('FRONTEND_INTERNO', frontend.includes('trasladar_stock_interno'));
check('FRONTEND_INTERLOCAL', frontend.includes('trasladar_stock_entre_locales'));

// Negativa deliberada en memoria: eliminar el guard global del traslado
// interlocal debe romper el contrato C19.
const puenteado = interlocal.replace('v_operation_id := private.pm09_bloquear_operation_id_stock(p_operation_id);', 'v_operation_id := p_operation_id;');
assert.notEqual(puenteado, interlocal, 'mutación negativa C19 sin efecto');
assert.equal(guardGlobalValido(puenteado, 'TRASLADO_ENTRE_LOCALES'), false, 'el contrato C19 no detectó bypass global');
console.log('PM27_C19_NEGATIVA_BYPASS_LEDGER_GLOBAL=PASS');

if (process.exitCode) throw new Error('PM27_C19_STATIC_CONTRACT_FAIL');

// C18 ejecuta la regresión acumulada PM07/PM08/PM09/PM12. Reutilizarlo como
// gate anterior evita duplicar una lista paralela y prueba que C19 no rompe C18.
console.log('PM27_C19_RUN=tests/pm27/c18-stock-ventas.mjs');
execFileSync(process.execPath, ['tests/pm27/c18-stock-ventas.mjs'], { stdio: 'inherit' });

console.log('PM27_C19_ORIGEN_DESTINO=PASS');
console.log('PM27_C19_AISLAMIENTO=PASS');
console.log('PM27_C19_ATOMICIDAD=PASS');
console.log('PM27_C19_IDEMPOTENCIA=PASS');
console.log('PM27_C19_RESULTADO=PASS');
