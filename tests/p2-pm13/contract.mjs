import fs from 'node:fs';

const path='supabase/migrations/20260917173000_p2_pm13_fichajes_post_reset.sql';
const sql=fs.readFileSync(path,'utf8');
const must=(re,msg)=>{ if(!re.test(sql)) throw new Error(`P2_PM13_CONTRACT_FALLO:${msg}`); };

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
must(/revoke all on function private\.pm13_fichaje_actor_es_empleado\(text\) from public,anon,authenticated;/i,'private helper acl');
must(/grant execute on function public\.pm13_fichar\(text,text,text,text\) to authenticated;/i,'authenticated rpc grant');
must(/commit;\s*$/i,'commit');

console.log('P2_PM13_CONTRACT_OK=1');
