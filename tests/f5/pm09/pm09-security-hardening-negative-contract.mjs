import fs from 'node:fs';

const migration = fs.readFileSync(
  'supabase/migrations/20261001230000_abc_f5_pm09_security_hardening.sql',
  'utf8',
);

function check(name, ok) {
  console.log(`PM09_SECURITY_NEGATIVE_${name}=${ok ? 1 : 0}`);
  if (!ok) process.exitCode = 1;
}

// These are negative-access assertions: the candidate must remove the
// implicit/public, anon and service_role paths instead of granting them back.
check('PUBLIC_NOT_GRANTED', !/grant execute[\s\S]*from public/i.test(migration));
check('ANON_NOT_GRANTED', !/grant execute[\s\S]*to anon/i.test(migration));
check('SERVICE_ROLE_NOT_GRANTED', !/grant execute[\s\S]*to service_role/i.test(migration));
check('SERVICE_ROLE_EXPLICITLY_REVOKED', (migration.match(/from public, anon, service_role/g) || []).length === 5);
check('INVALID_DATE_ERRORS_PRESENT', (migration.match(/fecha_requerida/g) || []).length >= 5);
check('REPLAY_CONFLICT_ERROR_PRESENT', migration.includes("raise exception 'operation_id_conflict'"));
check('PRIVATE_GUARD_NOT_PUBLICLY_EXECUTABLE', migration.includes('private.pm09_bloquear_operation_id_stock(text) from public, anon, authenticated, service_role'));

if (process.exitCode) throw new Error('PM09_SECURITY_HARDENING_NEGATIVE_CONTRACT_FAIL');
console.log('PM09_SECURITY_HARDENING_NEGATIVE_CONTRACT_OK=1');
