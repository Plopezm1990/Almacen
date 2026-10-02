import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/20261001200000_abc_f5_c10_document_delivery.sql', 'utf8');
const start = sql.indexOf('create function public.abc_registrar_entrega_documental');
const end = sql.indexOf('revoke all on function public.abc_registrar_entrega_documental');
const body = sql.slice(start, end);
assert.match(body, /security definer/i);
assert.match(body, /set search_path=''/i);
assert.match(body, /auth\.uid\(\) is null/i);
assert.match(body, /abc_tiene_capacidad/i);
assert.match(body, /private\.abc_operacion_iniciar/i);
assert.match(body, /public\.abc_c05_documentos_emitidos/i);
assert.match(body, /public\.abc_c08_documento_versiones/i);
assert.match(body, /public\.abc_c09_impresiones_documentales/i);
assert.match(sql, /revoke all on table public\.abc_c10_entregas_documentales from public,anon,authenticated,service_role/i);
assert.match(sql, /alter table public\.abc_c10_entregas_documentales enable row level security/i);
assert.match(sql, /grant execute on function public\.abc_registrar_entrega_documental[^;]+to authenticated/i);
console.log('ABC_F5_C10_SECURITY_CONTRACT=PASS_WITH_ADVISORS_PENDING');
