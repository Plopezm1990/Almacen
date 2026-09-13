import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// PM27 / C13 / Punto 6
// Pruebas reproducibles del contrato SECURITY DEFINER.
// Nunca conecta a Supabase remoto: usa exclusivamente PostgreSQL local aislado.

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');
const MIGRATION = path.join(ROOT, 'supabase/migrations/20260913190500_pm27_c13_security_definer_tenant_guard.sql');
const HARDENING = path.join(ROOT, 'supabase/migrations/20260913193500_pm27_c13_private_helper_hardening.sql');

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: ROOT, ...opts });
  return r;
}

function assertOk(r, label) {
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
  }
  assert.equal(r.status, 0, label);
}

// --- 1) Contrato estatico: la correccion que se prueba es exactamente la esperada. ---
const migrationSql = read(MIGRATION);
const hardeningSql = read(HARDENING);
assert.match(migrationSql, /revoke all on function public\.descontar_stock_carrito\(jsonb,text\) from authenticated;/i);
assert.match(migrationSql, /revoke all on function public\.anular_venta_tpv\(text,text\) from authenticated;/i);
assert.match(migrationSql, /create or replace function public\.obtener_contexto_operativo\(\)/i);
assert.match(migrationSql, /security definer\s+set search_path = ''/i);
assert.match(migrationSql, /private\.la_usuario_activo\(\)/i);
assert.match(migrationSql, /from public\.membresias_usuario/i);
assert.match(migrationSql, /grant execute on function public\.obtener_contexto_operativo\(\) to authenticated;/i);
assert.match(hardeningSql, /alter function private\.es_propietario_activo\(\) set search_path = '';/i);
console.log('PM27_C13_STATIC_CONTRACT=PASS');

// El gate remoto (Punto 8) ejecuta la parte PostgreSQL. En cualquier entorno donde
// psql no exista, fallamos de forma explicita para que nunca se confunda con PASS.
const psqlProbe = run('bash', ['-lc', 'command -v psql >/dev/null 2>&1']);
if (psqlProbe.status !== 0) {
  console.error('PM27_C13_POSTGRES_LOCAL=NO_DISPONIBLE');
  process.exit(2);
}

const suffix = `${process.pid}_${Date.now()}`;
const db = `pm27_c13_${suffix}`.replace(/[^a-zA-Z0-9_]/g, '_');
const ownUser = crypto.randomUUID();
const noMembershipUser = crypto.randomUUID();
const weakRoleUser = crypto.randomUUID();
const ownEmpresa = `pm27_empresa_own_${suffix}`;
const foreignEmpresa = `pm27_empresa_foreign_${suffix}`;
const ownLocal = `pm27_local_own_${suffix}`;
const foreignLocal = `pm27_local_foreign_${suffix}`;

function pg(sql, database = db, extra = []) {
  return run('sudo', ['-u', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-X', '-qAt', '-d', database, ...extra, '-c', sql]);
}

function pgFile(file, database = db) {
  return run('sudo', ['-u', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-d', database, '-f', file]);
}

function scalar(sql) {
  const r = pg(sql);
  assertOk(r, `SQL debe pasar: ${sql.slice(0, 120)}`);
  return r.stdout.trim().split('\n').filter(Boolean).at(-1) ?? '';
}

function expectFailure(sql, expected, label) {
  const r = pg(sql);
  assert.notEqual(r.status, 0, `${label}: la operacion debia fallar`);
  const combined = `${r.stdout}\n${r.stderr}`;
  assert.match(combined, expected, `${label}: fallo distinto al esperado`);
}

let createdAuthenticated = false;
let createdAnon = false;
try {
  const authExists = run('sudo', ['-u', 'postgres', 'psql', '-X', '-qAt', '-d', 'postgres', '-c', "select 1 from pg_roles where rolname='authenticated';"]);
  assertOk(authExists, 'debe poder consultar roles locales');
  if (authExists.stdout.trim() !== '1') {
    assertOk(run('sudo', ['-u', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-d', 'postgres', '-c', 'create role authenticated nologin;']), 'crear rol authenticated local');
    createdAuthenticated = true;
  }

  const anonExists = run('sudo', ['-u', 'postgres', 'psql', '-X', '-qAt', '-d', 'postgres', '-c', "select 1 from pg_roles where rolname='anon';"]);
  assertOk(anonExists, 'debe poder consultar rol anon local');
  if (anonExists.stdout.trim() !== '1') {
    assertOk(run('sudo', ['-u', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-d', 'postgres', '-c', 'create role anon nologin;']), 'crear rol anon local');
    createdAnon = true;
  }

  assertOk(run('sudo', ['-u', 'postgres', 'createdb', db]), 'crear base PostgreSQL temporal');

  const setup = `
    create schema auth;
    create schema private;
    revoke create on schema public from public;
    grant usage on schema public to authenticated, anon;
    grant usage on schema private to authenticated;

    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;

    create table public.perfiles(
      user_id uuid primary key,
      rol text not null,
      empleado_id text,
      activo boolean not null default true
    );

    create table public.membresias_usuario(
      id bigserial primary key,
      user_id uuid not null,
      empresa_id text not null,
      local_id text,
      todos_locales boolean not null default false,
      rol text not null,
      activo boolean not null default true
    );

    create table public.almacen_kv(
      key text primary key,
      value jsonb not null,
      updated_at timestamptz not null default now()
    );

    create table public.pm27_c13_effects(
      id bigserial primary key,
      kind text not null
    );

    create function private.la_usuario_activo() returns boolean
    language sql stable security definer set search_path = '' as $$
      select auth.uid() is not null
         and exists(select 1 from public.membresias_usuario m where m.user_id=auth.uid() and m.activo=true)
         and not exists(select 1 from public.perfiles p where p.user_id=auth.uid() and p.activo=false)
    $$;

    create function private.la_tiene_empresa(p_empresa text) returns boolean
    language sql stable security definer set search_path = '' as $$
      select private.la_usuario_activo()
         and nullif(btrim(p_empresa),'') is not null
         and exists(select 1 from public.membresias_usuario m where m.user_id=auth.uid() and m.empresa_id=p_empresa and m.activo=true)
    $$;

    create function private.la_tiene_local(p_empresa text, p_local text) returns boolean
    language sql stable security definer set search_path = '' as $$
      select private.la_usuario_activo()
         and nullif(btrim(p_empresa),'') is not null
         and nullif(btrim(p_local),'') is not null
         and upper(btrim(p_local)) <> 'TODOS'
         and exists(
           select 1 from public.membresias_usuario m
            where m.user_id=auth.uid() and m.empresa_id=p_empresa and m.activo=true
              and (m.todos_locales=true or m.local_id=p_local)
         )
    $$;

    create function private.es_propietario_activo() returns boolean
    language sql stable security definer set search_path = 'public','pg_temp' as $$
      select exists(select 1 from public.perfiles p where p.user_id=auth.uid() and p.activo=true and p.rol='Propietario')
    $$;
    revoke all on function private.es_propietario_activo() from public;
    grant execute on function private.es_propietario_activo() to authenticated;

    create function public.descontar_stock_carrito(p_lineas jsonb, p_venta_id text) returns jsonb
    language plpgsql security definer set search_path='public' as $$
    begin
      insert into public.pm27_c13_effects(kind) values ('descontar');
      return jsonb_build_object('ok', true);
    end $$;

    create function public.anular_venta_tpv(p_venta_id text, p_motivo text default '') returns jsonb
    language plpgsql security definer set search_path='public' as $$
    begin
      insert into public.pm27_c13_effects(kind) values ('anular');
      return jsonb_build_object('ok', true);
    end $$;

    grant execute on function public.descontar_stock_carrito(jsonb,text) to authenticated;
    grant execute on function public.anular_venta_tpv(text,text) to authenticated;
  `;
  assertOk(pg(setup), 'preparar fixture local aislada');

  assertOk(pgFile(MIGRATION), 'aplicar migracion funcional C13 en PostgreSQL local');
  assertOk(pgFile(HARDENING), 'aplicar hardening C13 en PostgreSQL local');
  console.log('PM27_C13_LOCAL_MIGRATIONS=PASS');

  // ACLs: las dos mutadoras legacy quedan fuera del navegador autenticado;
  // el contexto sigue disponible y anon continua fuera.
  assert.equal(scalar("select has_function_privilege('authenticated','public.descontar_stock_carrito(jsonb,text)','EXECUTE');"), 'f');
  assert.equal(scalar("select has_function_privilege('authenticated','public.anular_venta_tpv(text,text)','EXECUTE');"), 'f');
  assert.equal(scalar("select has_function_privilege('authenticated','public.obtener_contexto_operativo()','EXECUTE');"), 't');
  assert.equal(scalar("select has_function_privilege('anon','public.obtener_contexto_operativo()','EXECUTE');"), 'f');
  assert.equal(scalar("select proconfig::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='obtener_contexto_operativo' and p.pronargs=0;"), '{search_path=""}');
  assert.equal(scalar("select proconfig::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='es_propietario_activo' and p.pronargs=0;"), '{search_path=""}');
  console.log('PM27_C13_ACL_SEARCH_PATH=PASS');

  // Caso 1: sin sesion.
  expectFailure(
    "set role authenticated; reset request.jwt.claim.sub; select public.obtener_contexto_operativo();",
    /contexto_sesion_requerida/,
    'sin sesion'
  );
  assert.equal(scalar('select count(*) from public.pm27_c13_effects;'), '0');
  console.log('PM27_C13_NEG_SIN_SESION=PASS');

  // Caso 2: perfil activo, pero sin membresia activa.
  assertOk(pg(`insert into public.perfiles(user_id,rol,activo) values ('${noMembershipUser}','Encargado',true);`), 'insert perfil sin membresia');
  expectFailure(
    `set role authenticated; set request.jwt.claim.sub='${noMembershipUser}'; select public.obtener_contexto_operativo();`,
    /contexto_usuario_no_activo|contexto_sin_membresia_activa/,
    'perfil sin membresia'
  );
  assert.equal(scalar('select count(*) from public.pm27_c13_effects;'), '0');
  console.log('PM27_C13_NEG_SIN_MEMBRESIA=PASS');

  // Fixture positiva y catalogo con vecinos ajenos. Los datos de prueba son efimeros
  // y generados en runtime; no reutilizan ningun ID real de QA o produccion.
  assertOk(pg(`
    insert into public.perfiles(user_id,rol,activo) values ('${ownUser}','Encargado',true);
    insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo)
      values ('${ownUser}','${ownEmpresa}','${ownLocal}',false,'Encargado',true);
    insert into public.almacen_kv(key,value) values (
      'locales',
      jsonb_build_array(
        jsonb_build_object('id','${ownLocal}','empresaId','${ownEmpresa}','nombre','Own','activo',true),
        jsonb_build_object('id','${foreignLocal}','empresaId','${foreignEmpresa}','nombre','Foreign company','activo',true),
        jsonb_build_object('id','${foreignLocal}','empresaId','${ownEmpresa}','nombre','Foreign local','activo',true)
      )
    );
  `), 'insertar fixture tenant');

  const ownRaw = scalar(`set role authenticated; set request.jwt.claim.sub='${ownUser}'; select public.obtener_contexto_operativo()::text;`);
  const own = JSON.parse(ownRaw);
  assert.equal(own.ok, true);
  assert.equal(own.rol, 'Encargado');
  assert.equal(own.empresaId, ownEmpresa);
  assert.equal(own.localId, ownLocal);
  assert.deepEqual(own.empresas.map((x) => x.id), [ownEmpresa]);
  assert.deepEqual(own.locales.map((x) => x.id), [ownLocal]);
  assert.ok(own.locales.every((x) => x.empresaId === ownEmpresa));
  assert.ok(!own.locales.some((x) => x.id === foreignLocal), 'local ajeno no debe filtrarse al contexto');
  assert.ok(!own.empresas.some((x) => x.id === foreignEmpresa), 'empresa ajena no debe filtrarse al contexto');
  console.log('PM27_C13_NEG_EMPRESA_AJENA=PASS');
  console.log('PM27_C13_NEG_LOCAL_AJENO=PASS');
  console.log('PM27_C13_POS_CONTEXTO_PROPIO=PASS');

  // Caso 5: rol insuficiente para las antiguas mutaciones privilegiadas.
  // La barrera principal es ahora ACL: ni siquiera alcanza el cuerpo SECURITY DEFINER.
  assertOk(pg(`
    insert into public.perfiles(user_id,rol,activo) values ('${weakRoleUser}','Invitado',true);
    insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo)
      values ('${weakRoleUser}','${ownEmpresa}','${ownLocal}',false,'Invitado',true);
  `), 'insertar fixture rol insuficiente');
  expectFailure(
    `set role authenticated; set request.jwt.claim.sub='${weakRoleUser}'; select public.descontar_stock_carrito('[]'::jsonb,'pm27-test');`,
    /permission denied for function descontar_stock_carrito/,
    'rol insuficiente descontar'
  );
  expectFailure(
    `set role authenticated; set request.jwt.claim.sub='${weakRoleUser}'; select public.anular_venta_tpv('pm27-test','test');`,
    /permission denied for function anular_venta_tpv/,
    'rol insuficiente anular'
  );
  assert.equal(scalar('select count(*) from public.pm27_c13_effects;'), '0', 'los rechazos no pueden dejar efectos residuales');
  console.log('PM27_C13_NEG_ROL_INSUFICIENTE=PASS');
  console.log('PM27_C13_NEG_SIN_EFECTOS_PARCIALES=PASS');

  console.log('PM27_C13_PUNTO6_CONTRATO_COMPLETO=PASS');
} finally {
  // Limpieza local. Ninguna ruta de este test contiene hosts Supabase ni credenciales remotas.
  run('sudo', ['-u', 'postgres', 'dropdb', '--if-exists', db]);
  if (createdAuthenticated) {
    run('sudo', ['-u', 'postgres', 'psql', '-X', '-q', '-d', 'postgres', '-c', 'drop role if exists authenticated;']);
  }
  if (createdAnon) {
    run('sudo', ['-u', 'postgres', 'psql', '-X', '-q', '-d', 'postgres', '-c', 'drop role if exists anon;']);
  }
}
