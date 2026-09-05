import fs from 'node:fs';

const source = fs.readFileSync('fuente.js','utf8');
const p17 = fs.readFileSync('supabase/migrations/20260905120500_pm09_operation_id_global_hardening.sql','utf8');
const p15 = fs.readFileSync('supabase/migrations/20260905115000_pm09_fecha_operacion_economica.sql','utf8');
const p07 = fs.readFileSync('supabase/migrations/20260904135838_pm07_stock_ubicacion_y_reversos.sql','utf8');
const p08 = fs.readFileSync('supabase/migrations/20260904204500_pm08_caja_devolucion_indivisible.sql','utf8');

function check(name, ok) {
  console.log(`PM09_P17_${name}=${ok ? 1 : 0}`);
  if (!ok) process.exitCode = 1;
}

check('GLOBAL_HELPER_VALIDATES_ID', p17.includes('private.pm08_validar_operation_id(p_operation_id)'));
check('GLOBAL_HELPER_SERIALIZES_ID', p17.includes('private.pm08_bloquear_operation_id(v_operation_id)'));
check('GLOBAL_HELPER_CHECKS_CAJA', p17.includes('public.caja_operaciones where operation_id=v_operation_id'));
check('GLOBAL_HELPER_CHECKS_ARQUEOS', p17.includes('public.arqueos_caja where operation_id=v_operation_id'));
check('GLOBAL_HELPER_CHECKS_ANULACIONES', p17.includes('public.arqueos_caja_anulaciones where operation_id=v_operation_id'));
check('GLOBAL_HELPER_CONFLICT', p17.includes("raise exception 'operation_id_conflict'"));
check('FOUR_STOCK_WRAPPERS_LOCKED', (p17.match(/private\.pm09_bloquear_operation_id_stock\(p_operation_id\)/g) || []).length === 4);
check('VENTAS_PRESERVE_ECONOMIC_DATE', (p17.match(/jsonb_build_object\('fechaOperacion',p_fecha\)/g) || []).length >= 8);
check('BASE_SALE_REPLAY', p07.includes("return jsonb_build_object('ok',true,'replayed',true,'movimiento',to_jsonb(mov));"));
check('BASE_SALE_PAYLOAD_CONFLICT', p07.includes("raise exception 'operation_id_conflict'"));
check('RETURN_REPLAY', p08.includes("v_operacion_existente.tipo='DEVOLUCION_CLIENTE'") && p08.includes("'replayed',true"));
check('RETURN_CROSS_LEDGER_CONFLICT', p08.includes('exists(select 1 from public.caja_operaciones where operation_id=v_operation_id)') && p08.includes('exists(select 1 from public.arqueos_caja where operation_id=v_operation_id)'));
check('PM09_REVERSO_DATE_CONFLICT', p15.includes("v_fecha_existente<>p_fecha") && p15.includes("raise exception 'operation_id_conflict'"));
check('FRONTEND_TRANSIENT_ERROR_DETECTED', source.includes('function esErrorTransitorioPM08'));
check('FRONTEND_PENDING_DRAFT', source.includes('pendiente: true'));
check('FRONTEND_PENDING_PAYLOAD_CONFLICT', source.includes('Hay una operación anterior pendiente en este local'));
check('FRONTEND_DOUBLE_CLICK_GUARD', source.includes('if (enviando) return'));

if (process.exitCode) throw new Error('PM09_P17_ROBUSTNESS_CONTRACT_FAIL');
console.log('PM09_P17_ROBUSTNESS_CONTRACT_OK=1');
