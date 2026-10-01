import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/20261001160000_abc_f5_c06_document_types.sql', 'utf8');
const body = sql.slice(sql.indexOf('create function public.abc_clasificar_documento'), sql.indexOf('revoke all on function public.abc_clasificar_documento'));
assert.match(body, /security definer/i);
assert.match(body, /set search_path=''/i);
assert.match(body, /auth\.uid\(\) is null/i);
assert.match(body, /abc_tiene_capacidad/i);
assert.match(sql, /revoke all on table public\.abc_c06_documentos_clasificados from public,anon,authenticated,service_role/i);
assert.match(sql, /alter table public\.abc_c06_documentos_clasificados enable row level security/i);
assert.match(sql, /grant execute on function public\.abc_clasificar_documento[^;]+to authenticated/i);
console.log('ABC_F5_C06_SECURITY_CONTRACT=PASS_WITH_ADVISORS_PENDING');
