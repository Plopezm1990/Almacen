import fs from 'node:fs';

const path = 'supabase/migrations/20260904234000_pm08_replay_scope_hardening.sql';
const sql = fs.readFileSync(path, 'utf8');

function sqlFunction(name) {
  const start = sql.search(new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`, 'i'));
  if (start < 0) throw new Error(`PM08_REPLAY_FUNCION_AUSENTE=${name}`);
  const bodyStart = sql.indexOf('as $$', start);
  const end = sql.indexOf('\n$$;', bodyStart);
  if (bodyStart < 0 || end < 0) throw new Error(`PM08_REPLAY_FUNCION_INCOMPLETA=${name}`);
  return sql.slice(start, end + 4);
}

const reverso = sqlFunction('revertir_movimiento_caja');
const anulacion = sqlFunction('anular_arqueo_caja');
const guard = "if not private.la_tiene_local(v_existente.empresa_id,v_existente.local_id) then";

const checks = {
  migracion_identificada_qa: sql.includes('Destino autorizado: Supabase QA'),
  dos_rpc_endurecidas: (sql.match(/create or replace function public\./gi) || []).length === 2,
  reverso_replay_verifica_scope: reverso.includes(guard)
    && reverso.indexOf(guard) < reverso.indexOf("v_existente.tipo in ('REVERSO_ENTRADA','REVERSO_RETIRADA')"),
  anulacion_replay_verifica_scope: anulacion.includes(guard)
    && anulacion.indexOf(guard) < anulacion.indexOf('v_existente.payload=v_payload'),
  reverso_nuevo_verifica_scope: reverso.includes('private.la_tiene_local(v_original.empresa_id,v_original.local_id)'),
  anulacion_nueva_verifica_scope: anulacion.includes('private.la_tiene_local(v_original.empresa_id,v_original.local_id)'),
  ambas_auth_uid: [reverso, anulacion].every((block) => block.includes('auth.uid()')),
  ambas_security_definer: [reverso, anulacion].every((block) => /security definer/i.test(block)),
  ambas_search_path: [reverso, anulacion].every((block) => /set search_path\s*=/.test(block)),
  ambas_idempotencia_bloqueada: [reverso, anulacion].every((block) => block.includes('pm08_bloquear_operation_id')),
  anon_revocado: (sql.match(/revoke all on function public\./gi) || []).length === 2
    && (sql.match(/from public, anon/gi) || []).length === 2,
  authenticated_autorizado: (sql.match(/grant execute on function public\./gi) || []).length === 2,
};

for (const [name, passed] of Object.entries(checks)) {
  console.log(`PM08_REPLAY_${name.toUpperCase()}=${passed ? 1 : 0}`);
  if (!passed) process.exitCode = 1;
}

if (process.exitCode) throw new Error('PM08_REPLAY_SCOPE_CONTRACT_FAIL');
console.log(`PM08_REPLAY_CHECKS=${Object.keys(checks).length}`);
console.log('PM08_REPLAY_SCOPE_CONTRACT_OK=1');
