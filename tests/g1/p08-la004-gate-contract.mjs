import fs from 'node:fs';

const catalog = JSON.parse(fs.readFileSync('tests/pm04/regression-catalog.json','utf8'));
const migration = fs.readFileSync('supabase/migrations/20260905185935_g1_p08_operation_id_finanzas_global.sql','utf8');
const evidence = fs.readFileSync('tests/g1/P08_LA004_GATE_EVIDENCIA.md','utf8');
const patchManifest = JSON.parse(fs.readFileSync('source-recovery/post-pm08-patches/PATCH_SERIES.json','utf8'));
const rebuildCurrent = fs.readFileSync('source-recovery/rebuild-current.mjs','utf8');
const sourcePackage = JSON.parse(fs.readFileSync('source-recovery/package.json','utf8'));

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

check('PATCH_FORMAT_V1', patchManifest.format === 'la-suite-post-pm08-patch-series-v1');
check('PATCH_BASE_PM08', patchManifest.baseCommit === '7b2aa0f1500ecfc5dce551196f5434655411a314');
check('PATCH_BASE_SHA', patchManifest.baseArtifactSha256 === '372813f2230054306b0d37eb3825938832b68f62ea88a484dde0b1dfcdb075ed');
check('PATCH_TARGET_COMMIT_PM10', patchManifest.targetFuenteCommit === 'a4a1866f4e81c4651162105e33d37515cb53a7f2');
check('PATCH_TARGET_SHA', patchManifest.targetArtifactSha256 === '8dbd5f9be4c172eaa5b28ce84a668414edcd2ec8c9941a2d748c466aa4bbd48c');
check('PATCH_COUNT_17', patchManifest.patchCount === 17 && patchManifest.commits?.length === 17);
check('PATCH_FILES_17', fs.readdirSync('source-recovery/post-pm08-patches').filter(x => x.endsWith('.patch')).length === 17);
check('PATCH_LAST_PM10_P13', patchManifest.commits?.at(-1)?.commit === 'a4a1866f4e81c4651162105e33d37515cb53a7f2');
const readsRootFuente = /readFileSync\s*\([^\n;]*\.\.\/fuente\.js/.test(rebuildCurrent) || /readFileSync\s*\([^\n;]*['"]fuente\.js['"]/.test(rebuildCurrent);
check('REBUILD_DOES_NOT_READ_ROOT_TARGET', !readsRootFuente);
check('REBUILD_VERIFIES_BASE_SHA', rebuildCurrent.includes('manifest.baseArtifactSha256'));
check('REBUILD_VERIFIES_TARGET_SHA', rebuildCurrent.includes('manifest.targetArtifactSha256'));
check('REBUILD_APPLIES_ZERO_FUZZ', rebuildCurrent.includes("'--fuzz=0'"));
check('PACKAGE_BUILD_CURRENT', sourcePackage.scripts?.['build:current'] === 'node rebuild-current.mjs');

for (const p of ['P02_MAPA_CRITERIOS_EVIDENCIA.md','P03_LA019_EVIDENCIA.md','P04_LA023_EVIDENCIA.md','P05_PERMISOS_AISLAMIENTO_EVIDENCIA.md','P06_CIFRAS_CONCILIACIONES_EVIDENCIA.md','P07_CONCURRENCIA_REPLAY_EVIDENCIA.md']) {
  check(`G1_PRIOR_${p.slice(0,3)}`, fs.existsSync(`tests/g1/${p}`));
}

if (process.exitCode) throw new Error('G1_P08_LA004_GATE_CONTRACT_FAIL');
console.log('G1_P08_LA004_GATE_CONTRACT_OK=1');
