import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/20261001170000_abc_f5_c07_fiscal_gate.sql', 'utf8');
for (const fn of ['abc_configurar_modalidad_fiscal', 'abc_evaluar_documento_fiscal']) {
  const body = sql.slice(sql.indexOf(`create function public.${fn}`), sql.indexOf(`revoke all on function public.${fn}`));
  assert.match(body, /security definer/i);
  assert.match(body, /set search_path=''/i);
  assert.match(body, /auth\.uid\(\) is null/i);
  assert.match(body, /abc_tiene_capacidad/i);
}
assert.match(sql, /alter table public\.abc_c07_modalidades_fiscales enable row level security/i);
assert.match(sql, /alter table public\.abc_c07_evaluaciones_fiscales enable row level security/i);
assert.match(sql, /grant execute on function public\.abc_configurar_modalidad_fiscal[^;]+to authenticated/i);
assert.match(sql, /grant execute on function public\.abc_evaluar_documento_fiscal[^;]+to authenticated/i);
console.log('ABC_F5_C07_SECURITY_CONTRACT=PASS_WITH_ADVISORS_PENDING');
