import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../../', import.meta.url);
const migration = await readFile(new URL('supabase/migrations/20261001220000_abc_f5_c12_close_rehearsal.sql', root), 'utf8');
const revisionFix = await readFile(new URL('supabase/migrations/20261009111255_abc_f7_c12_reconciliation_revision.sql', root), 'utf8');

for (const marker of [
  'create table public.abc_c12_ensayos_cierre',
  'create function public.abc_ensayar_cierre_sesion_caja',
  "'ABC_ENSAYAR_CIERRE_SESION_CAJA'",
  "'APTO_CIERRE'",
  "'CONTEO_FALTANTE'",
  "'PAGOS_PENDIENTES'",
  "'EFECTOS_PENDIENTES'",
  "'CONCILIACIONES_DOCUMENTALES_PENDIENTES'",
  "'CIERRE_ENSAYADO'",
  "'sin_cambios',true",
  'private.abc_c04_bloqueos_cierre',
  'private.abc_request_hash',
  'private.abc_operacion_completar',
]) assert.ok(migration.includes(marker), `falta marcador C12: ${marker}`);

assert.match(migration, /resultado text not null[\s\S]*check \(resultado in \('APTO_CIERRE','PENDIENTE','BLOQUEADO'\)\)/);
assert.match(migration, /before update or delete on public\.abc_c12_ensayos_cierre/);
assert.match(migration, /if \(v_cmd->>'replayed'\)::boolean then/);
assert.match(migration, /v_blockers:=v_blockers\|\|v_c04_blockers/);
assert.match(migration, /where co\.empresa_id=p_empresa_id[\s\S]*co\.session_id=p_session_id/);
assert.match(migration, /distinct on \(r\.documento_id\)/);
assert.match(migration, /mutaciones',jsonb_build_object\('caja_sesiones',false,'caja_cierres',false,'caja_conteos',false,'pagos',false,'efectos_pendientes',false,'documentos',false\)/);
assert.match(revisionFix, /add column revision bigint generated always as identity/);
assert.match(revisionFix, /order by r\.documento_id,r\.revision desc/);
assert.match(revisionFix, /abc_c11_conciliacion_documento_revision_idx/);
assert.doesNotMatch(revisionFix, /order by r\.documento_id,r\.created_at desc,r\.id desc'\s*\n\s*\);/);

console.log('ABC_F5_C12_CLOSE_REHEARSAL_CONTRACT=PASS');
