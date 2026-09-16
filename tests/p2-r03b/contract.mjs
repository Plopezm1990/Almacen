import fs from 'node:fs';

const migrationPath = 'supabase/migrations/20260916203000_p2_r03b_auditoria_tenant_post_reset.sql';
const sql = fs.readFileSync(migrationPath, 'utf8');
const lower = sql.toLowerCase();

function check(name, ok) {
  console.log(`P2_R03B_${name}=${ok ? 1 : 0}`);
  if (!ok) process.exitCode = 1;
}

function fn(name) {
  const re = new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`, 'i');
  const m = re.exec(sql);
  if (!m) throw new Error(`P2_R03B_FUNCION_AUSENTE=${name}`);
  const bodyStart = sql.indexOf('as $$', m.index);
  const end = sql.indexOf('\n$$;', bodyStart);
  if (bodyStart < 0 || end < 0) throw new Error(`P2_R03B_FUNCION_INCOMPLETA=${name}`);
  return sql.slice(m.index, end + 4);
}

const audit = fn('registrar_auditoria');

check('PREFLIGHT_FAIL_CLOSED', sql.includes('P2_R03B_PREFLIGHT_FALLO'));
check('TENANT_COLUMNS',
  ['empresa_id text','local_id text','actor_user_id uuid']
    .every(s => lower.includes(`add column if not exists ${s}`)));
check('RLS_ENABLED', lower.includes('alter table public.auditoria_registro enable row level security'));
check('OLD_POLICIES_REMOVED', lower.includes("from pg_policies") && lower.includes("tablename='auditoria_registro'"));
check('SINGLE_SELECT_POLICY', lower.includes('create policy auditoria_p2_r03b_select'));
check('RLS_SECURITY_DEFINER_HELPER',
  lower.includes('create or replace function private.p2_r03b_puede_leer_auditoria') &&
  lower.includes('security definer') &&
  lower.includes("set search_path=''"));
check('OWNER_SCOPED_MEMBERSHIP',
  lower.includes("m.rol='propietario'") &&
  lower.includes('m.empresa_id=p_empresa') &&
  lower.includes('m.todos_locales=true'));
check('LOCAL_BELONGS_TO_EMPRESA_POLICY',
  lower.includes('l.id=p_local') &&
  lower.includes('l.empresa_id=p_empresa'));
check('POLICY_USES_HELPER',
  lower.includes('private.p2_r03b_puede_leer_auditoria(empresa_id,local_id)'));
check('HELPER_EXECUTE_LEAST_PRIVILEGE',
  lower.includes('revoke all on function private.p2_r03b_puede_leer_auditoria(text,text)') &&
  lower.includes('grant execute on function private.p2_r03b_puede_leer_auditoria(text,text)'));
check('APPEND_ONLY_TABLE',
  lower.includes('revoke all privileges on table public.auditoria_registro') &&
  lower.includes('from public, anon, authenticated') &&
  lower.includes('grant select on table public.auditoria_registro to authenticated'));

check('RPC_EIGHT_ARGS',
  /registrar_auditoria\s*\(\s*p_id text,\s*p_usuario text,\s*p_accion text,\s*p_detalle text,\s*p_fecha date,\s*p_hora text,\s*p_empresa_id text,\s*p_local_id text\s*\)/is.test(sql));
check('RPC_SECURITY_DEFINER', audit.toLowerCase().includes('security definer'));
check('RPC_SAFE_SEARCH_PATH', audit.toLowerCase().includes("set search_path=''"));
check('RPC_ACTIVE_USER', audit.includes('private.la_usuario_activo()'));
check('RPC_EMPRESA_MEMBERSHIP', audit.includes('private.la_tiene_empresa(v_empresa)'));
check('RPC_LOCAL_MEMBERSHIP', audit.includes('private.la_tiene_local(v_empresa,v_local)'));
check('RPC_EXPLICIT_LOCAL_EMPRESA',
  audit.includes('l.id=v_local') && audit.includes('l.empresa_id=v_empresa'));
check('RPC_ACTOR_CAPTURED',
  audit.includes('actor_user_id') && audit.includes("'actorUserId',v_uid"));
check('RPC_REPLAY_CONFLICT',
  audit.includes('get diagnostics v_insertados = row_count') &&
  audit.includes("raise exception 'auditoria_id_conflict'") &&
  audit.includes("'replayed',(v_insertados=0)"));
check('RPC_JSON_LEGACY_KEYS',
  ['usuarioAutenticado','accion','detalle','fecha','hora','usuario']
    .every(k => audit.includes(`'${k}'`)));

check('NEW_RPC_ANON_REVOKED',
  lower.includes('revoke all on function public.registrar_auditoria(') &&
  lower.includes('text,text,text,text,date,text,text,text'));
check('NEW_RPC_AUTH_GRANTED',
  lower.includes('grant execute on function public.registrar_auditoria(') &&
  lower.includes('text,text,text,text,date,text,text,text'));
check('LEGACY_AUDIT_REVOKED',
  lower.includes("to_regprocedure('public.registrar_auditoria(text,text,text)'") &&
  lower.includes("to_regprocedure('public.registrar_auditoria(text,text,text,text,text,text)'"));
check('P2_R02_GUARDS',
  ['anular_venta_tpv(text,text)','descontar_stock(text,numeric,text,jsonb)','descontar_stock_carrito(jsonb,text)']
    .every(sig => lower.includes(`to_regprocedure('public.${sig}')`)));
check('NO_LEGACY_GRANT',
  !/grant\s+execute\s+on\s+function\s+public\.(?:anular_venta_tpv|descontar_stock|descontar_stock_carrito)/i.test(sql));

if (process.exitCode) throw new Error('P2_R03B_CONTRACT_FAIL');
console.log('P2_R03B_CONTRACT_OK=1');
