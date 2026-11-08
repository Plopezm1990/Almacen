import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../../', import.meta.url);
const migration = await readFile(new URL('supabase/migrations/20261001220000_abc_f5_c12_close_rehearsal.sql', root), 'utf8');

assert.match(migration, /language plpgsql[\s\S]*security definer[\s\S]*set search_path=''/);
assert.match(migration, /auth\.uid\(\) is null or not private\.abc_tiene_capacidad\(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR'\)/);
assert.match(migration, /revoke all on table public\.abc_c12_ensayos_cierre from public,anon,authenticated,service_role/);
assert.match(migration, /alter table public\.abc_c12_ensayos_cierre enable row level security/);
assert.match(migration, /revoke all on function public\.abc_ensayar_cierre_sesion_caja\(text,text,text,uuid,uuid,date\) from public,anon,authenticated,service_role/);
assert.match(migration, /grant execute on function public\.abc_ensayar_cierre_sesion_caja\(text,text,text,uuid,uuid,date\) to authenticated/);
assert.match(migration, /create function private\.abc_c12_guard_rehearsal/);
assert.match(migration, /raise exception 'ensayo_cierre_inmutable'/);
assert.doesNotMatch(migration, /update public\.caja_sesiones/);
assert.doesNotMatch(migration, /insert into public\.caja_cierres/);
assert.doesNotMatch(migration, /insert into public\.caja_conteos/);
assert.doesNotMatch(migration, /update public\.pagos/);
assert.doesNotMatch(migration, /update public\.efectos_pendientes/);

console.log('ABC_F5_C12_SECURITY_CONTRACT=PASS');
