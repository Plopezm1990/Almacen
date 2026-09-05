import fs from 'node:fs';

const catalog = JSON.parse(fs.readFileSync('tests/pm04/regression-catalog.json','utf8'));
const migration = fs.readFileSync('supabase/migrations/20260905185935_g1_p08_operation_id_finanzas_global.sql','utf8');
const evidence = fs.readFileSync('tests/g1/P08_LA004_GATE_EVIDENCIA.md','utf8');

function check(name, ok) {
  console.log(`G1_P08_${name}=${ok ? 1 : 0}`);
  if (!ok) process.exitCode = 1;
}

const la004 = catalog.cases.find(c => c.id === 'LA-004');
check('LA004_CATALOGO_CRITICO', la004?.package === 'PM-06' && la004?.severity === 'CRITICO');
check('LA004_FIXTURE_A2_PROVEEDOR', /Factura A2 \+ proveedor/i.test(la004?.fixture || ''));
check('LA004_EXPECTED_IDENTITY', /conserva empresa\/local al editar, recargar y pagar/i.test(la004?.expected || '') && /operador no autorizado no modifica/i.test(la004?.expected || ''));

check('GLOBAL_REGISTRY_PRIVATE', migration.includes('create table if not exists private.g1_operation_ids_global'));
for (const table of ['pagos_factura','caja_operaciones','stock_operaciones','arqueos_caja','arqueos_caja_anulaciones']) {
  check(`TRIGGER_${table.toUpperCase()}`, migration.includes(`on public.${table}`));
}
check('GLOBAL_CROSS_LEDGER_CONFLICT', migration.includes("raise exception 'operation_id_conflict'"));
check('PAYMENT_ADVISORY_LOCK', migration.includes('perform private.pm08_bloquear_operation_id(p_operation_id);'));
check('PAYMENT_REPLAY_ID', migration.includes('existente.id=p_id'));
check('PAYMENT_REPLAY_DATE', migration.includes('existente.fecha=v_fecha'));
check('PAYMENT_REPLAY_METHOD', migration.includes('existente.medio_pago is not distinct from p_medio_pago'));
check('PAYMENT_REPLAY_DATA', migration.includes('existente.datos=v_datos'));
check('PAYMENT_OVERPAY_BLOCK', migration.includes("raise exception 'pago_supera_saldo'"));
check('REVERSE_REPLAY_ID', (migration.match(/existente\.id=p_id/g) || []).length >= 2);
check('REVERSE_REPLAY_MOTIVE', migration.includes("coalesce(existente.datos->>'motivo','')=v_motivo"));

check('EVIDENCE_PREFX_BUG_14_15', evidence.includes('14/15'));
check('EVIDENCE_CROSS_LEDGER_BUG_0_2', evidence.includes('0/2 PASS'));
check('EVIDENCE_POSTFIX_20_20', evidence.includes('20/20 PASS'));
check('EVIDENCE_LA004_PASS', evidence.includes('**LA-004 = PASS**'));
check('EVIDENCE_CLEANUP_ZERO', evidence.includes('claims `private.g1_operation_ids_global` de prueba: 0'));
check('EVIDENCE_ADVISOR_NOT_CLEAN_CLAIM', evidence.includes('No se declara el asesor globalmente limpio'));

for (const p of ['P02_MAPA_CRITERIOS_EVIDENCIA.md','P03_LA019_EVIDENCIA.md','P04_LA023_EVIDENCIA.md','P05_PERMISOS_AISLAMIENTO_EVIDENCIA.md','P06_CIFRAS_CONCILIACIONES_EVIDENCIA.md','P07_CONCURRENCIA_REPLAY_EVIDENCIA.md']) {
  check(`G1_PRIOR_${p.slice(0,3)}`, fs.existsSync(`tests/g1/${p}`));
}

if (process.exitCode) throw new Error('G1_P08_LA004_GATE_CONTRACT_FAIL');
console.log('G1_P08_LA004_GATE_CONTRACT_OK=1');
