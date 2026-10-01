import fs from 'node:fs';
import assert from 'node:assert/strict';

const sql = fs.readFileSync('supabase/migrations/20261001140000_abc_f5_c04_close_reopen.sql', 'utf8');
const functions = [
  'abc_iniciar_cierre_sesion_caja',
  'abc_confirmar_cierre_provisional',
  'abc_finalizar_cierre_sesion_caja',
  'abc_reabrir_cierre_provisional',
];

function body(name) {
  const start = sql.indexOf(`function public.${name}(`);
  assert.notEqual(start, -1, `falta ${name}`);
  const end = sql.indexOf('\ncreate ', start + 10);
  return sql.slice(start, end === -1 ? sql.length : end);
}

for (const name of functions) {
  const fn = body(name);
  assert.match(fn, /security definer/i, `${name}: falta SECURITY DEFINER explícito`);
  assert.match(fn, /set search_path=''|set search_path = ''/i, `${name}: falta search_path cerrado`);
  assert.match(fn, /auth\.uid\(\)\s+is\s+null/i, `${name}: falta comprobar autenticación`);
  assert.match(fn, /abc_tiene_capacidad\([^)]*'ABC_CAJA_OPERAR'/i, `${name}: falta comprobar capacidad`);
  assert.match(fn, /p_empresa_id/);
  assert.match(fn, /p_local_id/);
}

for (const role of ['public', 'anon', 'authenticated', 'service_role']) {
  for (const name of functions) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\([\\s\\S]*? from [^;]*\\b${role}\\b[^;]*;`, 'i'), `falta revoke ${role} en ${name}`);
  }
}
for (const name of functions) {
  assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\([\\s\\S]*? to authenticated;`, 'i'), `falta grant authenticated en ${name}`);
  assert.doesNotMatch(sql, new RegExp(`grant execute on function public\\.${name}\\([\\s\\S]*? to (anon|service_role);`, 'i'));
}
assert.match(sql, /revoke all on function private\.abc_c04_(bloqueos_cierre|guard_final_session)/i);

console.log('ABC_F5_C04_SECURITY_CONTRACT=PASS_WITH_ADVISORS_PENDING');
