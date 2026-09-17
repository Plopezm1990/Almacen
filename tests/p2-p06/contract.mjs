import fs from 'node:fs';

const bridge=fs.readFileSync('server-authority-storage-bridge.js','utf8');
const migration=fs.readFileSync('supabase/migrations/20260917194000_p2_p06_server_authority_capabilities.sql','utf8');
const index=fs.readFileSync('index.html','utf8');
const must=(ok,msg)=>{if(!ok) throw new Error(`P2_P06_CONTRACT_FALLO:${msg}`);};

must(/TARGETS\s*=\s*Object\.freeze\(\{\s*empleados:\s*true,\s*fichajes:\s*true\s*\}\)/s.test(bridge),'targets must be only empleados/fichajes');
must(/p2_server_authority_capabilities/.test(bridge),'capability rpc missing');
must(/data\.personal\s*===\s*"pm11"/.test(bridge),'pm11 capability proof missing');
must(/data\.fichajes\s*===\s*"pm13"/.test(bridge),'pm13 capability proof missing');
must(/data\.legacyPersistence\s*===\s*false/.test(bridge),'legacy-off capability proof missing');
must(/\.from\("empleados"\)[\s\S]*\.select\("id,empresa_id,local_id,estado,nombre,datos,created_at,updated_at,baja_at,reactivado_at,anonimizado_at"\)/.test(bridge),'authoritative empleados read missing');
must(/\.from\("fichajes_registro"\)[\s\S]*\.select\("id,fecha,datos,creado_en"\)/.test(bridge),'authoritative fichajes read missing');
must(/serverAuthoritative:\s*true/.test(bridge),'legacy write suppression marker missing');
must(!/\.insert\s*\(|\.upsert\s*\(|\.update\s*\(|\.delete\s*\(/.test(bridge),'bridge must never write to Supabase');
must(/return originalGet\.apply/.test(bridge) && /return originalSet\.apply/.test(bridge),'fallback/delegation missing');
must(index.includes('<script src="./server-authority-storage-bridge.js"></script>'),'bridge not wired before frontend');
must(index.indexOf('server-authority-storage-bridge.js') < index.indexOf('type="module" src="./fuente.js"'),'bridge must load before fuente.js');

must(/begin;[\s\S]*set local lock_timeout='5s';[\s\S]*set local statement_timeout='30s';/i.test(migration),'migration transaction/timeouts');
must(/P2_P06_PREFLIGHT_FALLO/.test(migration),'migration fail-closed preflight');
must(/to_regprocedure\('public\.pm11_alta_empleado\(text,text,text,text,jsonb\)'\)/.test(migration),'pm11 dependency missing');
must(/to_regprocedure\('public\.pm13_fichar\(text,text,text,text\)'\)/.test(migration),'pm13 dependency missing');
must(/create or replace function public\.p2_server_authority_capabilities\(\)/i.test(migration),'capability function missing');
must(/security invoker/i.test(migration),'capability must not elevate privileges');
must(/revoke all on function public\.p2_server_authority_capabilities\(\) from public,anon,authenticated;/i.test(migration),'capability revoke baseline missing');
must(/grant execute on function public\.p2_server_authority_capabilities\(\) to authenticated;/i.test(migration),'capability authenticated grant missing');
must(/'legacyPersistence',false/.test(migration),'capability legacy flag wrong');
must(/commit;\s*$/i.test(migration),'migration commit missing');

console.log('P2_P06_CONTRACT_OK=1');
