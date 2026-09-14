import fs from 'node:fs';

const evidencePath = 'tests/pm27/pm27-c25-live-readiness-evidence.json';
const docPath = 'tests/pm27/PM27_C25_DEPLOY_OPERACION_READINESS.md';
const workflowPath = '.github/workflows/pm27-c25-deploy-operacion-readiness.yml';
const c24DocPath = 'tests/pm27/PM27_C24_MIGRACIONES_PREFLIGHT_ROLLBACK.md';
const c24ManifestPath = 'tests/pm27/pm27-c24-migration-manifest.json';

const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
const doc = fs.readFileSync(docPath, 'utf8');
const workflow = fs.readFileSync(workflowPath, 'utf8');
const c24Doc = fs.readFileSync(c24DocPath, 'utf8');
const c24Manifest = JSON.parse(fs.readFileSync(c24ManifestPath, 'utf8'));

function check(name, ok) {
  console.log(`PM27_C25_${name}=${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) process.exitCode = 1;
}

const c24Final = 'e78853ecdb58729055a734a651f99a520fe110f0';
const mainSha = '93a570badba1c5375febfbddc1dffdbcef003dcd';
const releaseSha = 'a97740987be57aa9646f6a06e69b2230f140ec5f';
const pr38Head = 'f297be08708d0bbe566c21347123885cb3095a7c';

check('CHECKPOINT', evidence.checkpoint === 'PM27-C25');
check('BASE_C24_EXACTA', evidence.baseCertifiedC24Commit === c24Final);
check('C24_MANIFEST_INTACTO', c24Manifest.checkpoint === 'PM27-C24' && Array.isArray(c24Manifest.migrations) && c24Manifest.migrations.length === 8);
check('C24_PRODUCCION_NO_DIRECTA', c24Doc.includes('PRODUCCIÓN NO ES DESTINO DIRECTO DEL MANIFEST C24 ACTUAL'));

check('GITHUB_MAIN_PROTEGIDA', evidence.github.mainSha === mainSha);
check('GITHUB_RELEASE_PROTEGIDA', evidence.github.releaseSha === releaseSha);
check('GITHUB_PR38_OPEN_DRAFT', evidence.github.pr38.state === 'open' && evidence.github.pr38.draft === true && evidence.github.pr38.merged === false && evidence.github.pr38.headSha === pr38Head);
check('GITHUB_RAMA_C25', evidence.github.c25Branch === 'claude/pm27-c25-deploy-operacion-readiness');

check('NETLIFY_PRODUCTIVO_READY', evidence.netlify.productionDeploy.state === 'ready' && evidence.netlify.productionDeploy.context === 'production');
check('NETLIFY_PRODUCTIVO_RELEASE', evidence.netlify.productionDeploy.branch === 'release' && evidence.netlify.productionDeploy.commitRef === releaseSha);
check('NETLIFY_NO_ES_CANDIDATO_PM27', evidence.netlify.productionDeploy.commitRef !== c24Final);
check('NETLIFY_ENV_VARS_CERO', evidence.netlify.environmentVariableCount === 0);
check('NETLIFY_NO_PROD_SSO', evidence.netlify.nonProductionRequiresSsoTeamLogin === true);

const prod = evidence.supabase.production;
const qa = evidence.supabase.qa;
const allFalse = (obj) => Object.values(obj).every((v) => v === false);
const allTrue = (obj) => Object.values(obj).every((v) => v === true);

check('SUPABASE_PROD_HEALTHY_PG17', prod.status === 'ACTIVE_HEALTHY' && prod.postgresEngine === '17');
check('SUPABASE_QA_HEALTHY_PG17', qa.status === 'ACTIVE_HEALTHY' && qa.postgresEngine === '17');
check('SUPABASE_PROD_PM14_AUSENTE', allFalse(prod.pm14Tables));
check('SUPABASE_PROD_RPC_BASE_AUSENTE', allFalse(prod.baseRpcs));
check('SUPABASE_PROD_LEGACY_EXEC_AUTH', allTrue(prod.legacyAuthenticatedExecute));
check('SUPABASE_PROD_MANIFEST_NO_REGISTRADO', Array.isArray(prod.c24ManifestVersionsRecorded) && prod.c24ManifestVersionsRecorded.length === 0);
check('SUPABASE_PROD_PREFLIGHT_FAIL_CLOSED', evidence.supabase.productionC24Preflight === 'BLOCKED_MISSING_PM14_BASELINE');
check('SUPABASE_PROD_SOLO_MAIN', prod.branchCount === 1 && prod.onlyDefaultMainBranch === true);
check('SUPABASE_PASSWORD_BREACH_BLOCKED', prod.passwordBreachProtection === 'disabled');

check('SUPABASE_QA_PM14_PRESENTE', allTrue(qa.pm14Tables));
check('SUPABASE_QA_RPC_BASE_PRESENTE', allTrue(qa.baseRpcs));
check('SUPABASE_QA_LEGACY_MUTACION_AUSENTE', allTrue(qa.legacyMutationRpcsAbsent));
check('SUPABASE_QA_CONTEXTO_AUTH', qa.obtenerContextoAuthenticatedExecute === true);
check('SUPABASE_QA_MANIFEST_NO_REGISTRADO', Array.isArray(qa.c24ManifestVersionsRecorded) && qa.c24ManifestVersionsRecorded.length === 0);
check('SUPABASE_DRIFT_HISTORIAL', evidence.supabase.migrationHistoryDrift === 'PRESENT_IN_PRODUCTION_AND_QA');

const residualById = new Map(evidence.residuals.map((r) => [r.id, r]));
for (const id of ['PRODUCTION_RECONCILIATION_AND_ROLLOUT', 'SUPABASE_THIRD_REAL_ENVIRONMENT', 'SUPABASE_PASSWORD_BREACH_PROTECTION']) {
  const r = residualById.get(id);
  check(`BLOCKED_EXTERNAL_${id}`, Boolean(r) && r.classification === 'BLOCKED_EXTERNAL' && r.isCodeFailure === false && typeof r.unlockCondition === 'string' && r.unlockCondition.length > 20);
}
check('ACTIONS_HISTORICOS_NO_BLOQUEAN', residualById.get('GITHUB_ACTIONS_MUTABLE_TAGS_HISTORICAL')?.classification === 'RESIDUAL_NON_BLOCKING');
check('XLSX_HISTORICO_NO_BLOQUEA', residualById.get('XLSX_0_18_5_HISTORICAL_ADVISORY')?.classification === 'RESIDUAL_NON_BLOCKING');

check('DECISION_C25_CONDICIONADA_GATE', evidence.decision.c25CheckpointCandidate === 'PASS_IF_EXACT_SHA_GATE_SUCCEEDS');
check('DECISION_ROLLOUT_NO_GO', evidence.decision.pm27RolloutReadiness === 'NO-GO');
check('DECISION_CERO_FAIL_CODIGO', Array.isArray(evidence.decision.codeFailures) && evidence.decision.codeFailures.length === 0);
check('DECISION_PROD_BLOCKED_EXTERNAL', evidence.decision.productionRollout === 'BLOCKED_EXTERNAL');
check('DECISION_RAZONES_COMPLETAS', [
  'PRODUCTION_BASELINE_BEHIND_CERTIFIED_CANDIDATE',
  'C24_PREFLIGHT_FAILS_ON_MISSING_PM14_BASELINE',
  'C24_MANIFEST_NOT_RECORDED_IN_PRODUCTION',
  'NETLIFY_PRODUCTION_STILL_ON_RELEASE_SHA',
  'PRODUCTION_WRITE_DEPLOY_NOT_AUTHORIZED',
].every((x) => evidence.decision.reasonCodes.includes(x)));

check('DOC_SEPARA_PASS_Y_NO_GO', doc.includes('C25 CHECKPOINT = PASS') && doc.includes('PM27 ROLLOUT = NO-GO'));
check('DOC_NO_FALSEA_DEPLOY', doc.includes('C25 no despliega por sí mismo') && doc.includes('El cierre de C25 **no autoriza** el rollout productivo'));
check('DOC_DRIFT_FAIL_CLOSED', doc.includes('Queda prohibido resolver el drift insertando o editando manualmente filas en `supabase_migrations.schema_migrations`'));
check('DOC_NUEVA_AUTORIZACION', doc.includes('autorización explícita nueva'));
check('DOC_UNLOCK_CONDITIONS', doc.includes('Condición de desbloqueo'));

const checkoutSha = '11d5960a326750d5838078e36cf38b85af677262';
const setupNodeSha = '49933ea5288caeca8642d1e84afbd3f7d6820020';
check('WORKFLOW_ACTIONS_PINNED', workflow.includes(`actions/checkout@${checkoutSha}`) && workflow.includes(`actions/setup-node@${setupNodeSha}`));
check('WORKFLOW_SIN_TAGS_MUTABLES', !workflow.includes('actions/checkout@v4') && !workflow.includes('actions/setup-node@v4'));
check('WORKFLOW_NO_DEPLOY_REMOTO', !/netlify\s+deploy|supabase\s+(?:db\s+push|migration\s+up)/i.test(workflow));
check('WORKFLOW_REGR_C24_PG17', workflow.includes('bash tests/pm27/c24-pg17-gate.sh'));
check('WORKFLOW_GUARD_PR38', workflow.includes('PR38=PASS') && workflow.includes(pr38Head));
check('WORKFLOW_SCOPE_C25', workflow.includes("test \"$(wc -l < /tmp/actual.txt | tr -d ' ')\" = '4'"));

const serialized = JSON.stringify(evidence);
check('EVIDENCIA_SIN_SECRETOS', !/service_role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY/i.test(serialized));

if (process.exitCode) {
  throw new Error('PM27_C25_READINESS_CONTRACT_FAIL');
}

console.log('PM27_C25_GITHUB=PASS');
console.log('PM27_C25_NETLIFY=PASS');
console.log('PM27_C25_SUPABASE_READINESS=PASS');
console.log('PM27_C25_BLOCKED_EXTERNAL=PASS');
console.log('PM27_C25_PM27_ROLLOUT=NO-GO');
console.log('PM27_C25_RESULTADO=PASS');
