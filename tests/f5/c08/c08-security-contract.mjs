import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/20261001180000_abc_f5_c08_document_retention.sql', 'utf8');
for (const fn of ['abc_conservar_documento_emitido', 'abc_registrar_correccion_documental']) {
  const body = sql.slice(sql.indexOf(`create function public.${fn}`), sql.indexOf(`revoke all on function public.${fn}`));
  assert.match(body, /security definer/i);
  assert.match(body, /set search_path=''/i);
  assert.match(body, /auth\.uid\(\) is null/i);
  assert.match(body, /abc_tiene_capacidad/i);
  assert.match(body, /private\.abc_operacion_iniciar/i);
}
assert.match(sql, /revoke all on table public\.abc_c08_documento_versiones,public\.abc_c08_correcciones_documentales from public,anon,authenticated,service_role/i);
assert.match(sql, /grant execute on function public\.abc_conservar_documento_emitido[^;]+to authenticated/i);
assert.match(sql, /grant execute on function public\.abc_registrar_correccion_documental[^;]+to authenticated/i);
assert.match(sql, /before update on public\.abc_c08_documento_versiones/i);
assert.match(sql, /before update on public\.abc_c08_correcciones_documentales/i);
console.log('ABC_F5_C08_SECURITY_CONTRACT=PASS');
