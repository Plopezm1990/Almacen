import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/20261001150000_abc_f5_c05_document_series.sql', 'utf8');
for (const fn of ['abc_reservar_numero_documental', 'abc_resolver_emision_documental']) {
  const body = sql.slice(sql.indexOf(`create function public.${fn}`), sql.indexOf(`revoke all on function public.${fn}`));
  assert.match(body, /security definer/i, `${fn}: security definer`);
  assert.match(body, /set search_path=''/i, `${fn}: search_path cerrado`);
  assert.match(body, /auth\.uid\(\) is null/i, `${fn}: auth.uid`);
  assert.match(body, /abc_tiene_capacidad/i, `${fn}: capacidad`);
}
assert.match(sql, /revoke all on table public\.abc_c05_series_documentales,public\.abc_c05_documentos_emitidos from public,anon,authenticated,service_role/i);
assert.match(sql, /alter table public\.abc_c05_series_documentales enable row level security/i);
assert.match(sql, /grant execute on function public\.abc_reservar_numero_documental[^;]+to authenticated/i);
assert.match(sql, /grant execute on function public\.abc_resolver_emision_documental[^;]+to authenticated/i);
console.log('ABC_F5_C05_SECURITY_CONTRACT=PASS_WITH_ADVISORS_PENDING');
