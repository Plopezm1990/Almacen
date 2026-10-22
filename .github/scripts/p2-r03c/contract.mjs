import fs from 'node:fs';

const migrationPath = 'supabase/migrations/20260917111500_p2_r03c_errores_sistema_post_reset.sql';
const sql = fs.readFileSync(migrationPath, 'utf8');
const lower = sql.toLowerCase();

function check(name, ok) {
  console.log(`P2_R03C_${name}=${ok ? 1 : 0}`);
  if (!ok) process.exitCode = 1;
}

function fn(name) {
  const re = new RegExp(`create\\s+or\\s+replace\\s+function\\s+private\\.${name}\\s*\\(`, 'i');
  const m = re.exec(sql);
  if (!m) throw new Error(`P2_R03C_FUNCION_AUSENTE=${name}`);
  const bodyStart = sql.indexOf('as $$', m.index);
  const end = sql.indexOf('\n$$;', bodyStart);
  if (bodyStart < 0 || end < 0) throw new Error(`P2_R03C_FUNCION_INCOMPLETA=${name}`);
  return sql.slice(m.index, end + 4);
}

const insertHelper = fn('p2_r03c_puede_insertar_error');
const readHelper = fn('p2_r03c_puede_leer_error');
const insertLower = insertHelper.toLowerCase();
const readLower = readHelper.toLowerCase();

check('PREFLIGHT_FAIL_CLOSED', sql.includes('P2_R03C_PREFLIGHT_FALLO'));
check('TRANSACTIONAL_TIMEOUTS',
  lower.includes('begin;') &&
  lower.includes("set local lock_timeout = '5s'") &&
  lower.includes("set local statement_timeout = '30s'") &&
  lower.includes('commit;'));
check('CONTRACT_COLUMNS',
  ['empresa_id text','local_id text','url text','vista text','detalle text','contexto jsonb']
    .every(s => lower.includes(`add column if not exists ${s}`)));
check('TYPE_CONFLICT_GUARD',
  lower.includes("c.column_name='contexto' and c.data_type <> 'jsonb'") &&
  lower.includes("c.data_type <> 'text'"));
check('RLS_ENABLED', lower.includes('alter table public.errores_sistema enable row level security'));
check('ALL_OLD_POLICIES_REMOVED',
  lower.includes('from pg_policies') &&
  lower.includes("tablename='errores_sistema'") &&
  lower.includes("execute format('drop policy if exists %i on public.errores_sistema'"));
check('EXACT_POLICY_NAMES',
  lower.includes('create policy errores_sistema_p2_r03c_select') &&
  lower.includes('create policy errores_sistema_p2_r03c_insert'));

for (const [label, body] of [['INSERT', insertLower], ['READ', readLower]]) {
  check(`${label}_HELPER_SECURITY_DEFINER`,
    body.includes('security definer') && body.includes("set search_path=''"));
  check(`${label}_ACTIVE_USER`, body.includes('private.la_usuario_activo()'));
  check(`${label}_NONBLANK_EMPRESA`, body.includes("nullif(btrim(p_empresa),'') is not null"));
  check(`${label}_MEMBERSHIP_SCOPE`,
    body.includes('m.user_id=(select auth.uid())') &&
    body.includes('m.empresa_id=p_empresa') &&
    body.includes('m.activo=true'));
  check(`${label}_LOCAL_MEMBERSHIP_SCOPE`,
    body.includes('m.todos_locales=true or m.local_id=p_local'));
  check(`${label}_LOCAL_BELONGS_TO_EMPRESA`,
    body.includes('from public.locales l') &&
    body.includes('l.id=p_local') &&
    body.includes('l.empresa_id=p_empresa'));
}

check('READ_OWNER_ONLY', readLower.includes("lower(btrim(m.rol))='propietario'"));
check('INSERT_ROLE_INDEPENDENT', !insertLower.includes("m.rol"));
check('NO_NULL_EMPRESA_ESCAPE',
  !/empresa_id\s+is\s+null\s+or\s+private\.la_tiene_empresa/i.test(sql));
check('HELPER_ACL_LEAST_PRIVILEGE',
  lower.includes('revoke all on function private.p2_r03c_puede_insertar_error(text,text) from public, anon, authenticated') &&
  lower.includes('revoke all on function private.p2_r03c_puede_leer_error(text,text) from public, anon, authenticated') &&
  lower.includes('grant execute on function private.p2_r03c_puede_insertar_error(text,text) to authenticated') &&
  lower.includes('grant execute on function private.p2_r03c_puede_leer_error(text,text) to authenticated'));
check('POLICIES_USE_HELPERS',
  lower.includes('private.p2_r03c_puede_leer_error(empresa_id,local_id)') &&
  lower.includes('private.p2_r03c_puede_insertar_error(empresa_id,local_id)'));
check('TABLE_ACL_LEAST_PRIVILEGE',
  lower.includes('revoke all privileges on table public.errores_sistema from public, anon, authenticated') &&
  lower.includes('grant select, insert on table public.errores_sistema to authenticated'));
check('NO_WRITE_GRANTS',
  !/grant\s+(?:update|delete|truncate|all)/i.test(sql));
check('NO_LEGACY_BACKFILL', !/update\s+public\.errores_sistema/i.test(sql));

if (process.exitCode) throw new Error('P2_R03C_CONTRACT_FAIL');
console.log('P2_R03C_CONTRACT_OK=1');
