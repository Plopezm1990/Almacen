import fs from 'node:fs';

function check(name, ok) {
  console.log(`PM11_P01_${name}=${ok ? 1 : 0}`);
  if (!ok) process.exitCode = 1;
}

const fixtures = JSON.parse(fs.readFileSync('tests/pm04/fixtures.json','utf8'));
const g1 = fs.readFileSync('tests/g1/P08_CIERRE_PUERTA_G1.md','utf8');
const evidence = fs.readFileSync('tests/pm11/P01_CHECKPOINT_APERTURA_EVIDENCIA.md','utf8');
const personalContract = fs.readFileSync('tests/pm10/p07-personal-contract.mjs','utf8');
const pkg = JSON.parse(fs.readFileSync('source-recovery/package.json','utf8'));

check('QA_PROJECT', fixtures.environment?.supabaseProjectRef === 'qjqorixtkilwsndqayyx');
check('NO_PRODUCTION_COPY', fixtures.environment?.productionDataCopied === false);
check('FIXTURE_TWO_COMPANIES', fixtures.companies?.length === 2);
check('FIXTURE_FOUR_LOCATIONS', fixtures.locations?.length === 4);
check('FIXTURE_FIVE_USERS', fixtures.users?.length === 5);
check('FIXTURE_CLOSED_LOCATION', fixtures.locations?.some(x => x.id === 'QA-A-CERRADO' && x.active === false));
check('FIXTURE_STOCK_A1_23', fixtures.stock?.some(x => x.locationId === 'QA-A1' && x.total === 23));
check('FIXTURE_STOCK_A2_10', fixtures.stock?.some(x => x.locationId === 'QA-A2' && x.total === 10));
check('FIXTURE_STOCK_B1_7', fixtures.stock?.some(x => x.locationId === 'QA-B1' && x.total === 7));

check('G1_GATE_SUPERADO', g1.includes('**G1_GATE_SUPERADO=SI**'));
check('G1_NEXT_PM11_PERSONAL', g1.includes('**SIGUIENTE=PM11_PERSONAL_EMPLEADOS**'));
check('EVIDENCE_BASE_SHA', evidence.includes('1e21458b48a11302c59911ef966ded0aca3eb639'));
check('EVIDENCE_MAIN_SHA', evidence.includes('7f792925d6a3d27334ee0e7335ba635b4ed79b6b'));
check('EVIDENCE_QA_ZERO_RESIDUE', /pagos = 0;[\s\S]*caja = 0;[\s\S]*stock_operaciones = 0\./.test(evidence));
check('EVIDENCE_SCOPE_PM12', evidence.includes('PM12: fichajes / control horario'));
check('EVIDENCE_SCOPE_PM13', evidence.includes('PM13: turnos y horarios'));
check('EVIDENCE_SCOPE_PM14', evidence.includes('PM14: nóminas'));

check('LA017_VALIDATOR_PRESENT', personalContract.includes('validarEmpleadoPM10'));
check('LA017_LOCAL_CONTEXT', personalContract.includes("'contexto_no_autorizado'"));
check('LA017_CROSS_LOCAL', personalContract.includes("'referencia_otro_contexto'"));
check('LA017_LEGACY_GUARD', personalContract.includes('no la normaliza silenciosamente'));
check('BUILD_CURRENT_SCRIPT', pkg.scripts?.['build:current'] === 'node rebuild-current.mjs');

if (process.exitCode) throw new Error('PM11_P01_CHECKPOINT_CONTRACT_FAIL');
console.log('PM11_P01_CHECKPOINT_CONTRACT_OK=1');
