import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const patch = fs.readFileSync('supabase/migrations/20260914080000_pm27_c20_inventory_count_replay_hardening.sql', 'utf8');
const historico = fs.readFileSync('supabase/migrations/20260907155028_pm12_p08_stock_atomico.sql', 'utf8');

function check(name, ok) {
  console.log(`PM27_C20_${name}=${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) process.exitCode = 1;
}

function sqlPrivateFunction(sql, name) {
  const start = sql.search(new RegExp(`create\\s+or\\s+replace\\s+function\\s+private\\.${name}\\s*\\(`, 'i'));
  if (start < 0) throw new Error(`PM27_C20_FUNCION_AUSENTE=${name}`);
  const bodyStart = sql.indexOf('as $$', start);
  const end = sql.indexOf('$$;', bodyStart + 5);
  if (bodyStart < 0 || end < 0) throw new Error(`PM27_C20_FUNCION_INCOMPLETA=${name}`);
  return sql.slice(start, end + 3);
}

const confirmar = sqlPrivateFunction(patch, 'pm12_confirmar_ajuste_stock');
const cancelar = sqlPrivateFunction(patch, 'pm12_cancelar_conteo_stock');
const confirmarHistorico = sqlPrivateFunction(historico, 'pm12_confirmar_ajuste_stock');
const cancelarHistorico = sqlPrivateFunction(historico, 'pm12_cancelar_conteo_stock');

// 1) Hallazgos reproducibles contra la implementación PM12 que sigue viva.
check('DEFECTO_REPLAY_PLAN_REPRODUCIDO', !confirmarHistorico.includes("op.payload->'plan' is distinct from p_plan"));
check('DEFECTO_REPLAY_BASES_NO_PERSISTIDAS', !confirmarHistorico.includes("'bases',p_bases"));
check('DEFECTO_CANCELACION_MOTIVO_REPRODUCIDO', !cancelarHistorico.includes("motivoCancelacion') is distinct from p_cancelacion->>'motivo'"));
check('DEFECTO_CANCELACION_RESPONSABLE_REPRODUCIDO', !cancelarHistorico.includes("responsableCancelacion') is distinct from p_cancelacion->>'responsable'"));
check('DEFECTO_CORTE_NO_CANONICO_REPRODUCIDO', cancelarHistorico.indexOf("cancel_id := 'pm12-cancelar-conteo:'") < cancelarHistorico.indexOf("select * into original from public.stock_operaciones"));

// 2) Replay de aplicación: misma identidad exige misma intención + plan y,
// para operaciones C20, las mismas bases persistidas.
check('REPLAY_COMPARA_INTENCION', confirmar.includes("op.payload->'intencion' is distinct from intent"));
check('REPLAY_COMPARA_PLAN', confirmar.includes("op.payload->'plan' is distinct from p_plan"));
check('REPLAY_COMPARA_BASES_C20', confirmar.includes("op.payload ? 'bases' and op.payload->'bases' is distinct from p_bases"));
check('BASES_PERSISTIDAS', confirmar.includes("jsonb_build_object('intencion',intent,'plan',p_plan,'bases',p_bases)"));
check('LEGACY_SIN_BASES_COMPATIBLE', confirmar.includes("op.payload ? 'bases' and"));
check('REPLAY_PARCIAL_FAIL_CLOSED', confirmar.includes("raise exception 'replay_parcial_inconsistente'"));
check('CANCELADO_NO_REAPLICA', confirmar.includes("raise exception 'conteo_cancelado'"));

// 3) Cancelación: primero serializa el documento, lee la identidad persistida
// y solo después acepta el operationId de cancelación.
const idxDocLock = cancelar.indexOf("private.pm08_bloquear_operation_id('pm12-conteo:'");
const idxOriginal = cancelar.indexOf('select * into original');
const idxCanonical = cancelar.indexOf("corte := coalesce(nullif(original.payload->'intencion'->>'cerradoEn'");
const idxCancelId = cancelar.indexOf("cancel_id := 'pm12-cancelar-conteo:'");
const idxGlobal = cancelar.indexOf('private.pm09_bloquear_operation_id_stock(cancel_id)');
check('CANCELACION_ORDEN_CANONICO', idxDocLock >= 0 && idxDocLock < idxOriginal && idxOriginal < idxCanonical && idxCanonical < idxCancelId && idxCancelId < idxGlobal);
check('CORTE_SOLICITADO_DEBE_COINCIDIR', cancelar.includes("if corte_solicitado is distinct from corte then raise exception 'operation_id_conflict'"));
check('REPLAY_CANCELACION_MISMO_MOTIVO', cancelar.includes("motivoCancelacion') is distinct from p_cancelacion->>'motivo'"));
check('REPLAY_CANCELACION_MISMO_RESPONSABLE', cancelar.includes("responsableCancelacion') is distinct from p_cancelacion->>'responsable'"));
check('CANCELACION_PERSISTE_SOLICITUD', cancelar.includes("jsonb_build_object('conteoId',p_conteo->>'id','cancelacion',p_cancelacion)"));
check('REPLAY_CON_REVERSOS_EXIGE_GESTOR', cancelar.includes("previous.payload->'resultado'->>'revertidos'") && cancelar.includes("private.pm07_puede_gestionar_stock()"));

// 4) Se conservan las garantías de permisos, aislamiento, atomicidad y stock.
check('AJUSTE_SOLO_GESTOR', confirmar.includes("private.pm07_puede_gestionar_stock()") && confirmar.includes("raise exception 'ajuste_no_autorizado'"));
check('AJUSTE_EMPRESA_LOCAL', confirmar.includes('private.la_tiene_empresa(p_empresa_id)') && confirmar.includes('private.la_tiene_local(p_empresa_id,p_local_id)'));
check('TODOS_NO_MUTA', confirmar.includes("lower(p_local_id)='todos'") && cancelar.includes("lower(p_local_id)='todos'"));
check('LOCK_PRODUCTOS_ORDENADO', confirmar.includes("order by x->>'productoId'"));
check('BASE_OBSOLETA_BLOQUEA', confirmar.includes("raise exception 'stock_base_obsoleto'"));
check('PLAN_CONTEO_DEBE_COINCIDIR', confirmar.includes("raise exception 'plan_no_coincide_con_conteo'"));
check('REVERSO_PRECHECK_ANTES_UPDATE', cancelar.indexOf("raise exception 'reverso_sin_cobertura'") < cancelar.indexOf('update public.stock_ubicacion set almacen=almacen-rec.da'));
check('GLOBAL_STOCK_LOCK_AMBAS', confirmar.includes('private.pm09_bloquear_operation_id_stock(p_operation_id)') && cancelar.includes('private.pm09_bloquear_operation_id_stock(cancel_id)'));
check('TRANSACCION_EXPLICITA', /^--[\s\S]*\nbegin;/.test(patch) && /\ncommit;\s*$/.test(patch));
check('ACL_PRIVATE_NO_ANON', (patch.match(/revoke all on function private\.pm12_/gi) || []).length === 2 && (patch.match(/from public,anon/gi) || []).length === 2);
check('ACL_AUTH_PRESERVADA', (patch.match(/grant execute on function private\.pm12_/gi) || []).length === 2);

// Negativas deliberadas: si se puentea la comparación de plan o de motivo,
// el contrato tiene que detectarlo.
const confirmarPuenteado = confirmar.replace("or op.payload->'plan' is distinct from p_plan", '');
assert.notEqual(confirmarPuenteado, confirmar, 'mutación negativa plan sin efecto');
assert.equal(confirmarPuenteado.includes("op.payload->'plan' is distinct from p_plan"), false, 'contrato no detectó replay con plan distinto');
console.log('PM27_C20_NEGATIVA_REPLAY_PLAN=PASS');

const cancelarPuenteado = cancelar.replace("previous.payload->'resultado'->'conteo'->>'motivoCancelacion') is distinct from p_cancelacion->>'motivo'", "previous.payload->'resultado'->'conteo'->>'motivoCancelacion') is not distinct from p_cancelacion->>'motivo'");
assert.notEqual(cancelarPuenteado, cancelar, 'mutación negativa cancelación sin efecto');
assert.equal(cancelarPuenteado.includes("motivoCancelacion') is distinct from p_cancelacion->>'motivo'"), false, 'contrato no detectó motivo distinto');
console.log('PM27_C20_NEGATIVA_REPLAY_CANCELACION=PASS');

if (process.exitCode) throw new Error('PM27_C20_STATIC_CONTRACT_FAIL');

const regressions = [
  'tests/pm12/p05-ajustes-trazables-contract.mjs',
  'tests/pm12/p06-cancelacion-conservadora-contract.mjs',
  'tests/pm12/p07-permisos-aislamiento-ajustes-contract.mjs',
  'tests/pm12/p08-fallos-replay-concurrencia-contract.mjs',
  'tests/pm27/c19-traspasos.mjs',
];
for (const test of regressions) {
  console.log(`PM27_C20_RUN=${test}`);
  execFileSync(process.execPath, [test], { stdio: 'inherit' });
}

console.log('PM27_C20_INVENTARIOS=PASS');
console.log('PM27_C20_CONTEOS=PASS');
console.log('PM27_C20_REPLAY=PASS');
console.log('PM27_C20_CANCELACION=PASS');
console.log('PM27_C20_AISLAMIENTO=PASS');
console.log('PM27_C20_RESULTADO=PASS');
