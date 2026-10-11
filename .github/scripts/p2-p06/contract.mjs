import fs from 'node:fs';
import assert from 'node:assert/strict';

const bridge=fs.readFileSync('server-authority-storage-bridge.js','utf8');
const migration=fs.readFileSync('supabase/migrations/20260922170000_p2_p06_server_authority_capabilities_release_current.sql','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.equal((bridge.match(/TARGETS\s*=\s*Object\.freeze\(\{\s*empleados:\s*true,\s*fichajes:\s*true\s*\}\)/s)||[]).length,1);
assert.match(bridge,/p2_server_authority_capabilities/);
assert.match(bridge,/data\.personal\s*===\s*"pm11"/);
assert.match(bridge,/data\.fichajes\s*===\s*"pm13"/);
assert.match(bridge,/data\.legacyPersistence\s*===\s*false/);
assert.match(bridge,/return\s+\{\s*key:\s*key,\s*value:\s*value,\s*shared:/s);
assert.match(bridge,/\.from\("empleados"\)[\s\S]{0,300}\.select\("id,empresa_id,local_id,estado,nombre,datos,created_at,updated_at,baja_at,reactivado_at,anonimizado_at"\)/);
assert.match(bridge,/\.from\("fichajes_registro"\)[\s\S]{0,200}\.select\("id,fecha,datos,creado_en"\)/);
assert.match(bridge,/serverAuthoritative:\s*true/);
assert.match(bridge,/almacen__pendientes/);
assert.match(bridge,/retirarTargetsPendientes/);
assert.doesNotMatch(bridge,/\.from\([^)]*\)[\s\S]{0,300}\.(?:insert|upsert|update|delete)\s*\(/);
assert.match(bridge,/if\s*\(!autoridad\.active\)\s*return originalGet/);
assert.match(bridge,/var value = await leerAutoritativo[\s\S]{0,200}return respuestaStorage/);
assert.doesNotMatch(bridge,/leerAutoritativo[\s\S]{0,400}catch[\s\S]{0,200}originalGet/);

const posStorage=index.indexOf('./index-storage-bootstrap.js');
const posP06=index.indexOf('./server-authority-storage-bridge.js');
const posEdge=index.indexOf('./edge-auth-patch.js');
const posUi=index.indexOf('./ui-context-bridge.js');
const posOwner=index.indexOf('./owner-bootstrap-post-reset.js');
const posFuente=index.indexOf('./fuente.js');
assert.ok(posStorage>=0 && posStorage<posP06 && posP06<posEdge && posEdge<posUi && posUi<posOwner && posOwner<posFuente);

assert.match(migration,/begin;[\s\S]*set local lock_timeout='5s';[\s\S]*set local statement_timeout='30s';/i);
assert.match(migration,/P2_P06_PREFLIGHT_FALLO/);
assert.match(migration,/to_regprocedure\('public\.pm11_editar_empleado\(text,text,text,jsonb,text\)'\)/);
assert.doesNotMatch(migration,/to_regprocedure\('public\.pm11_editar_empleado\(text,text,jsonb\)'\)/);
for (const sig of [
  'pm11_alta_empleado\\(text,text,text,text,jsonb\\)',
  'pm11_baja_empleado\\(text,text,text,text\\)',
  'pm11_reactivar_empleado\\(text,text,text\\)',
  'pm13_fichar\\(text,text,text,text\\)',
  'pm13_fichaje_manual\\(text,text,date,text,text,text,text\\)',
  'pm13_corregir_fichaje\\(text,date,text,text,text,text\\)',
  'pm13_anular_fichaje\\(text,text,text\\)'
]) assert.match(migration,new RegExp(sig),sig);
assert.match(migration,/relrowsecurity/);
assert.match(migration,/empleados_direct_dml_open/);
assert.match(migration,/fichajes_direct_dml_open/);
assert.match(migration,/pm11_empleados_select_gestion/);
assert.match(migration,/pm13_fichajes_select_scope/);
assert.match(migration,/create or replace function public\.p2_server_authority_capabilities\(\)/i);
assert.match(migration,/security invoker/i);
assert.match(migration,/revoke all on function public\.p2_server_authority_capabilities\(\) from public,anon,authenticated;/i);
assert.match(migration,/grant execute on function public\.p2_server_authority_capabilities\(\) to authenticated;/i);
assert.match(migration,/'legacyPersistence',false/);
assert.match(migration,/commit;\s*$/i);

console.log('P2_P06_CONTRACT_OK=1');
