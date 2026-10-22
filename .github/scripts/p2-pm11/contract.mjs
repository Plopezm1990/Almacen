import fs from 'node:fs';

const path = 'supabase/migrations/20260917143000_p2_pm11_personal_post_reset.sql';
const sql = fs.readFileSync(path, 'utf8');
const low = sql.toLowerCase();

function req(name, ok) {
  if (!ok) throw new Error(`P2_PM11_CONTRACT_FAIL:${name}`);
  console.log(`PASS ${name}`);
}

req('transaction', low.includes('begin;') && low.trimEnd().endsWith('commit;'));
req('timeouts', /lock_timeout\s*=\s*'5s'/i.test(sql) && /statement_timeout\s*=\s*'30s'/i.test(sql));
req('post-reset-preflight', low.includes("to_regclass('public.empresas')") && low.includes("to_regclass('public.locales')") && low.includes("to_regclass('public.auditoria_registro')"));
req('empleados-authority', low.includes('create table if not exists public.empleados') && low.includes('pm11_empleados_scope_estado'));
req('no-kv-runtime-dependency', !/from\s+public\.almacen_kv/i.test(sql));
req('relational-local', /from\s+public\.locales\s+l/i.test(sql) && low.includes('l.empresa_id=p_empresa_id') && low.includes('l.activo=true'));
req('helpers', ['pm11_local_pertenece_empresa','pm11_local_activo','pm11_puede_ver_personal','pm11_puede_mutar_personal','pm11_puede_migrar_personal','pm11_auditar_empleado'].every(x => low.includes(`function private.${x}`)));
req('membership-authority', low.includes("m.rol='propietario'") && low.includes("m.rol='encargado'") && low.includes('m.todos_locales'));
req('security-definer', (low.match(/security definer/g) || []).length >= 9);
req('hardened-search-path', (low.match(/set search_path=''/g) || []).length >= 10);
req('employees-rls', low.includes('alter table public.empleados enable row level security') && low.includes('create policy pm11_empleados_select_gestion'));
req('no-direct-write-grants', low.includes('revoke all privileges on table public.empleados from public,anon,authenticated') && !/grant\s+(insert|update|delete|all)\s+on\s+(table\s+)?public\.empleados\s+to\s+authenticated/i.test(sql));
req('select-only-table', /grant\s+select\s+on\s+table\s+public\.empleados\s+to\s+authenticated/i.test(sql));
req('core-rpcs', ['pm11_alta_empleado','pm11_editar_empleado','pm11_baja_empleado','pm11_reactivar_empleado'].every(x => low.includes(`function public.${x}`)));
req('rpc-exec-authenticated', ['pm11_alta_empleado','pm11_editar_empleado','pm11_baja_empleado','pm11_reactivar_empleado'].every(x => new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${x}\\(`,'i').test(sql)));
req('anon-rpc-closed', ['pm11_alta_empleado','pm11_editar_empleado','pm11_baja_empleado','pm11_reactivar_empleado'].every(x => new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${x}\\([\\s\\S]*?from\\s+public,anon,authenticated`,'i').test(sql)));
req('audit-tenant', low.includes('actor_user_id') && low.includes("'empresaid',p_empresa_id") && low.includes("'localid',p_local_id"));
req('alta-lock', low.includes('pg_advisory_xact_lock') && low.includes('pm13altaoperationid'));
req('pm13-alta-lock-preserved', low.includes("'pm13:empleado:alta:'") && !low.includes("'pm11:empleado:alta:'"));
req('pm13-local-concreto-preserved', low.includes("personal_local_concreto_requerido") && low.includes("'todos los locales'"));
req('no-almacen-kv-authority', !low.includes('public.almacen_kv') && !low.includes(' almacen_kv '));
req('no-profile-rls-rewrite', !/drop\s+policy[\s\S]*?on\s+public\.perfiles/i.test(sql));
req('no-membership-write', !/(insert|update|delete)\s+(into\s+|from\s+)?public\.membresias_usuario/i.test(sql));
req('no-fichajes-change', !/alter\s+table\s+public\.fichajes_registro/i.test(sql) && !/create\s+policy[\s\S]*?fichajes/i.test(sql));

console.log('P2_PM11_CONTRACT_OK=1');