import fs from 'node:fs';

const dec = fs.readFileSync('docs/plan-maestro/PM03_CONTRATOS_MINIMOS_PROPUESTA.md','utf8');
const p17 = fs.readFileSync('supabase/migrations/20260905120500_pm09_operation_id_global_hardening.sql','utf8');
const p08 = fs.readFileSync('supabase/migrations/20260904204500_pm08_caja_devolucion_indivisible.sql','utf8');
const p07 = fs.readFileSync('supabase/migrations/20260904135838_pm07_stock_ubicacion_y_reversos.sql','utf8');
const evidence = fs.readFileSync('tests/g1/P07_CONCURRENCIA_REPLAY_EVIDENCIA.md','utf8');

function check(name, ok) {
  console.log(`G1_P07_${name}=${ok ? 1 : 0}`);
  if (!ok) process.exitCode = 1;
}

check('DEC03_STABLE_OPERATION_ID', dec.includes('Toda operación crítica utiliza un `operationId` estable e idempotente.') && dec.includes('mismo `operationId`'));
check('DEC03_NO_INDEPENDENT_FALLBACK', /sin.*fallback|no.*fallback|fallback independiente/i.test(dec));
check('ADVISORY_XACT_LOCK', p08.includes("pg_advisory_xact_lock(hashtextextended('la-suite-pm08:' || p_operation_id, 0))"));
check('PM09_GLOBAL_HELPER', p17.includes('private.pm09_bloquear_operation_id_stock'));
check('PM09_HELPER_SERIALIZES', p17.includes('private.pm08_bloquear_operation_id(v_operation_id)'));
check('PM09_CROSS_LEDGER_CAJA', p17.includes('public.caja_operaciones where operation_id=v_operation_id'));
check('PM09_CROSS_LEDGER_ARQUEO', p17.includes('public.arqueos_caja where operation_id=v_operation_id'));
check('FOUR_PM09_WRAPPERS_LOCKED', (p17.match(/private\.pm09_bloquear_operation_id_stock\(p_operation_id\)/g) || []).length === 4);
check('BASE_SALE_REPLAY', p07.includes("'replayed',true"));
check('BASE_SALE_CONFLICT', p07.includes("raise exception 'operation_id_conflict'"));
check('RETURN_REPLAY', p08.includes("v_operacion_existente.tipo='DEVOLUCION_CLIENTE'") && p08.includes("'replayed',true"));
check('CASH_CROSS_LEDGER_CONFLICT', p08.includes('exists(select 1 from public.stock_operaciones where operation_id=v_operation_id)'));
check('LIVE_24_OF_24', evidence.includes('24/24 PASS'));
check('LIVE_CLEANUP_ZERO', evidence.includes('0 filas `G1-P07-`'));
check('LIVE_STOCK_23', evidence.includes('stock final: **23**'));
check('GATE_STILL_PENDING', evidence.includes('G1_ESTADO=PENDIENTE'));

if (process.exitCode) throw new Error('G1_P07_CONCURRENCIA_REPLAY_CONTRACT_FAIL');
console.log('G1_P07_CONCURRENCIA_REPLAY_CONTRACT_OK=1');
