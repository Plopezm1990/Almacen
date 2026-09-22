import fs from 'node:fs';

const path='supabase/migrations/20260917173000_p2_pm13_fichajes_post_reset.sql';
const fixPath='supabase/migrations/20260917182000_p2_pm13_fichajes_self_rls_fix.sql';
const sql=fs.readFileSync(path,'utf8');
const fix=fs.readFileSync(fixPath,'utf8');
const must=(re,msg,src=sql)=>{ if(!re.test(src)) throw new Error(`P2_PM13_CONTRACT_FALLO:${msg}`); };

must(/begin;[\s\S]*set local lock_timeout='5s';[\s\S]*set local statement_timeout='30s';/i,'transaction/timeouts');
must(/P2_PM13_PREFLIGHT_FALLO/i,'preflight');
must(/private\.pm11_puede_mutar_personal\(text,text\)/i,'pm11 mutation dependency');
must(/private\.pm11_puede_ver_personal\(text,text\)/i,'pm11 read dependency');
must(/private\.pm11_local_activo\(text,text\)/i,'active local dependency');
must(/create or replace function private\.pm13_fichaje_actor_es_empleado/i,'self helper');
must(/m\.empresa_id=e\.empresa_id[\s\S]*m\.todos_locales=true or m\.local_id=e\.local_id/i,'self tenant/local binding');
must(/create or replace function private\.pm13_fichaje_secuencia_valida/i,'sequence helper');
must(/mismos_minuto>1/i,'same-minute rejection');
must(/o\.rn=1 and o\.tipo<>'entrada'/i,'first event entry');
must(/o\.rn>1 and o\.tipo=o\.tipo_anterior/i,'alternation');

for(const sig of [
  'public.pm13_fichar','public.pm13_fichaje_manual','public.pm13_corregir_fichaje','public.pm13_anular_fichaje'
]) must(new RegExp(`create or replace function ${sig.replaceAll('.','\\.')}`,'i'),`${sig} missing`);

must(/pg_advisory_xact_lock\([\s\S]*pm13:fichaje-op:/i,'operation concurrency lock');
must(/create unique index if not exists pm13_fichajes_operation_id_uq[\s\S]*datos->>'operationId'/i,'global operation unique index');
must(/fichaje_operation_id_conflicto/i,'replay conflict');
must(/fichaje_correccion_operation_id_conflicto/i,'correction replay conflict');
must(/historialCorrecciones[\s\S]*'operationId',p_operation_id[\s\S]*'despues'/i,'durable correction operation history');
must(/fichaje_anulacion_operation_id_conflicto/i,'annul replay conflict');
must(/fichaje_ya_anulado/i,'annul different operation rejection');

must(/for v in select policyname from pg_policies where schemaname='public' and tablename='fichajes_registro'/i,'drop all legacy policies');
must(/create policy pm13_fichajes_select_scope/i,'single scoped select policy');
must(/revoke all privileges on table public\.fichajes_registro from public,anon,authenticated;/i,'table revoke');
must(/grant select on table public\.fichajes_registro to authenticated;/i,'select only');
must(/revoke all on function private\.pm13_fichaje_actor_es_empleado\(text\) from public,anon,authenticated;/i,'self helper revoke baseline');
must(/grant execute on function private\.pm13_fichaje_actor_es_empleado\(text\) to authenticated;/i,'RLS self helper execute');
must(/revoke all on function private\.pm13_fichaje_secuencia_valida\(text,text,text,jsonb\) from public,anon,authenticated;/i,'sequence helper closed');
must(/grant execute on function public\.pm13_fichar\(text,text,text,text\) to authenticated;/i,'authenticated rpc grant');
must(/commit;\s*$/i,'commit');

must(/P2_PM13_RLS_FIX_PREFLIGHT_FALLO/i,'RLS fix preflight',fix);
must(/drop policy if exists pm13_fichajes_select_scope/i,'RLS fix drops prior policy',fix);
must(/private\.pm13_fichaje_actor_es_empleado\(fichajes_registro\.datos->>'empleadoId'\)[\s\S]*or exists/i,'self branch outside empleados RLS',fix);
must(/private\.pm11_puede_ver_personal\(e\.empresa_id,e\.local_id\)/i,'management branch remains tenant/local scoped',fix);
must(/commit;\s*$/i,'RLS fix commit',fix);

console.log('P2_PM13_CONTRACT_OK=1');

const both=(sql+'\n'+fix).toLowerCase();
must(/create unique index if not exists pm13_fichajes_operation_id_uq[\s\S]*datos->>'operationId'/i,'global operationId uniqueness retained');
must(/drop index if exists public\.pm13_fichajes_operation_id_empleado_uq/i,'legacy per-employee operation index removed');
must(/create index if not exists pm13_fichajes_empleado_local_fecha_idx/i,'scope index retained');
must(/private\.pm13_fichaje_actor_es_empleado\(fichajes_registro\.datos->>'empleadoId'\)\s*or\s*exists/i,'self RLS branch outside employees RLS',fix);
if (/grant\s+(insert|update|delete|truncate|references|trigger)\s+on\s+(table\s+)?public\.fichajes_registro\s+to\s+authenticated/i.test(both)) {
  throw new Error('P2_PM13_CONTRACT_FALLO:direct write/grant reopened');
}
console.log('P2_PM13_RELEASE_CURRENT_CONTRACT_OK=1');
