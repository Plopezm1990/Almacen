import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

// PM27 / C15 — reproducción aislada del contrato RLS observado en producción.
// No conecta a Supabase remoto y no reutiliza IDs reales: todos los fixtures son efímeros.

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', ...opts });
}

function assertOk(r, label) {
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
  }
  assert.equal(r.status, 0, label);
}

const psqlProbe = run('bash', ['-lc', 'command -v psql >/dev/null 2>&1']);
if (psqlProbe.status !== 0) {
  console.error('PM27_C15_POSTGRES_LOCAL=NO_DISPONIBLE');
  process.exit(2);
}

const suffix = `${process.pid}_${Date.now()}`;
const db = `pm27_c15_${suffix}`.replace(/[^a-zA-Z0-9_]/g, '_');
const ownerUser = crypto.randomUUID();
const weakUser = crypto.randomUUID();
const wildcardUser = crypto.randomUUID();
const empresaOwn = `empresa_own_${suffix}`;
const empresaForeign = `empresa_foreign_${suffix}`;
const localOwn = `local_own_${suffix}`;
const localForeignSameEmpresa = `local_foreign_same_${suffix}`;
const localForeignEmpresa = `local_foreign_empresa_${suffix}`;

function pg(sql, database = db) {
  return run('sudo', ['-u', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-X', '-qAt', '-d', database, '-c', sql]);
}

function scalar(sql) {
  const r = pg(sql);
  assertOk(r, `SQL debe pasar: ${sql.slice(0, 160)}`);
  return r.stdout.trim().split('\n').filter(Boolean).at(-1) ?? '';
}

function expectFailure(sql, expected, label) {
  const r = pg(sql);
  assert.notEqual(r.status, 0, `${label}: debía fallar`);
  assert.match(`${r.stdout}\n${r.stderr}`, expected, `${label}: fallo distinto al esperado`);
}

let createdAuthenticated = false;
let createdAnon = false;
try {
  const authExists = run('sudo', ['-u', 'postgres', 'psql', '-X', '-qAt', '-d', 'postgres', '-c', "select 1 from pg_roles where rolname='authenticated';"]);
  assertOk(authExists, 'consultar rol authenticated');
  if (authExists.stdout.trim() !== '1') {
    assertOk(run('sudo', ['-u', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-d', 'postgres', '-c', 'create role authenticated nologin;']), 'crear authenticated');
    createdAuthenticated = true;
  }

  const anonExists = run('sudo', ['-u', 'postgres', 'psql', '-X', '-qAt', '-d', 'postgres', '-c', "select 1 from pg_roles where rolname='anon';"]);
  assertOk(anonExists, 'consultar rol anon');
  if (anonExists.stdout.trim() !== '1') {
    assertOk(run('sudo', ['-u', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-d', 'postgres', '-c', 'create role anon nologin;']), 'crear anon');
    createdAnon = true;
  }

  assertOk(run('sudo', ['-u', 'postgres', 'createdb', db]), 'crear base temporal C15');

  const setup = `
    create schema auth;
    create schema private;
    revoke create on schema public from public;
    grant usage on schema public to authenticated, anon;

    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;

    create table public.perfiles(
      user_id uuid primary key,
      rol text not null,
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

    create table public.prefiltros_candidatos(
      token text primary key,
      creado_en timestamptz not null default now(),
      candidato_nombre text not null,
      estado text not null,
      respuestas jsonb,
      resumen jsonb,
      completado_en timestamptz,
      expira_en timestamptz not null default (now() + interval '1 day'),
      empresa_id text not null,
      local_id text not null
    );

    create function private.la_usuario_activo() returns boolean
    language sql stable security definer set search_path = '' as $$
      select (select auth.uid()) is not null
         and exists(
           select 1 from public.membresias_usuario m
            where m.user_id=(select auth.uid()) and m.activo=true
         )
         and not exists(
           select 1 from public.perfiles p
            where p.user_id=(select auth.uid()) and p.activo=false
         );
    $$;

    create function private.la_tiene_local(p_empresa text, p_local text) returns boolean
    language sql stable security definer set search_path = '' as $$
      select private.la_usuario_activo()
         and nullif(btrim(p_empresa),'') is not null
         and nullif(btrim(p_local),'') is not null
         and upper(btrim(p_local)) <> 'TODOS'
         and exists(
           select 1 from public.membresias_usuario m
            where m.user_id=(select auth.uid()) and m.empresa_id=p_empresa and m.activo=true
              and (m.todos_locales=true or m.local_id=p_local)
         );
    $$;

    revoke all on function private.la_tiene_local(text,text) from public;
    grant execute on function private.la_tiene_local(text,text) to authenticated;

    grant select on public.perfiles to authenticated;
    grant select on public.membresias_usuario to authenticated;
    grant select, insert, delete on public.prefiltros_candidatos to authenticated;

    alter table public.prefiltros_candidatos enable row level security;

    create policy "prefiltros - propietario lee"
      on public.prefiltros_candidatos
      for select to authenticated
      using (
        exists (
          select 1 from public.perfiles p
          where p.user_id=(select auth.uid()) and p.activo=true and p.rol='Propietario'
        )
        and private.la_tiene_local(empresa_id, local_id)
      );

    create policy "prefiltros - propietario crea"
      on public.prefiltros_candidatos
      for insert to authenticated
      with check (
        exists (
          select 1 from public.perfiles p
          where p.user_id=(select auth.uid()) and p.activo=true and p.rol='Propietario'
        )
        and private.la_tiene_local(empresa_id, local_id)
      );

    create policy "prefiltros - propietario borra"
      on public.prefiltros_candidatos
      for delete to authenticated
      using (
        exists (
          select 1 from public.perfiles p
          where p.user_id=(select auth.uid()) and p.activo=true and p.rol='Propietario'
        )
        and private.la_tiene_local(empresa_id, local_id)
      );

    insert into public.perfiles(user_id,rol,activo) values
      ('${ownerUser}','Propietario',true),
      ('${weakUser}','Encargado',true),
      ('${wildcardUser}','Propietario',true);

    insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo) values
      ('${ownerUser}','${empresaOwn}','${localOwn}',false,'Propietario',true),
      ('${weakUser}','${empresaOwn}','${localOwn}',false,'Encargado',true),
      ('${wildcardUser}','${empresaOwn}',null,true,'Propietario',true);

    -- Fila ajena sembrada como owner de la base para comprobar invisibilidad RLS.
    insert into public.prefiltros_candidatos(token,candidato_nombre,estado,empresa_id,local_id)
      values ('foreign-seed','Foreign','pendiente','${empresaForeign}','${localForeignEmpresa}');
  `;
  assertOk(pg(setup), 'preparar reproducción local del RLS real');
  console.log('PM27_C15_FIXTURE_LOCAL=PASS');

  // Contrato estructural local equivalente al observado en producción.
  assert.equal(scalar("select relrowsecurity from pg_class where oid='public.prefiltros_candidatos'::regclass;"), 't');
  assert.equal(scalar("select count(*) from pg_policy where polrelid='public.prefiltros_candidatos'::regclass;"), '3');
  assert.equal(scalar("select count(*) from information_schema.columns where table_schema='public' and table_name='prefiltros_candidatos' and column_name in ('empresa_id','local_id') and is_nullable='NO';"), '2');
  console.log('PM27_C15_RLS_ESTRUCTURA=PASS');

  // Positivo: Propietario con membresía exacta puede crear y leer en su propio local.
  assertOk(pg(`set role authenticated; set request.jwt.claim.sub='${ownerUser}'; insert into public.prefiltros_candidatos(token,candidato_nombre,estado,empresa_id,local_id) values ('own-ok','Own','pendiente','${empresaOwn}','${localOwn}');`), 'insert propio autorizado');
  assert.equal(scalar(`set role authenticated; set request.jwt.claim.sub='${ownerUser}'; select count(*) from public.prefiltros_candidatos;`), '1');
  console.log('PM27_C15_POS_PROPIO=PASS');

  // Negativo: empresa ajena queda fuera del WITH CHECK.
  const totalBeforeForeign = scalar('select count(*) from public.prefiltros_candidatos;');
  expectFailure(
    `set role authenticated; set request.jwt.claim.sub='${ownerUser}'; insert into public.prefiltros_candidatos(token,candidato_nombre,estado,empresa_id,local_id) values ('foreign-company','X','pendiente','${empresaForeign}','${localForeignEmpresa}');`,
    /row-level security policy|violates row-level security/i,
    'empresa ajena'
  );
  assert.equal(scalar('select count(*) from public.prefiltros_candidatos;'), totalBeforeForeign);
  console.log('PM27_C15_NEG_EMPRESA_AJENA=PASS');

  // Negativo: otro local de la misma empresa, sin membresía concreta, también queda fuera.
  expectFailure(
    `set role authenticated; set request.jwt.claim.sub='${ownerUser}'; insert into public.prefiltros_candidatos(token,candidato_nombre,estado,empresa_id,local_id) values ('foreign-local','X','pendiente','${empresaOwn}','${localForeignSameEmpresa}');`,
    /row-level security policy|violates row-level security/i,
    'local ajeno'
  );
  assert.equal(scalar('select count(*) from public.prefiltros_candidatos;'), totalBeforeForeign);
  console.log('PM27_C15_NEG_LOCAL_AJENO=PASS');

  // Negativo: contexto incompleto/blanco no atraviesa la función de pertenencia.
  expectFailure(
    `set role authenticated; set request.jwt.claim.sub='${ownerUser}'; insert into public.prefiltros_candidatos(token,candidato_nombre,estado,empresa_id,local_id) values ('blank-company','X','pendiente','', '${localOwn}');`,
    /row-level security policy|violates row-level security/i,
    'empresa vacía'
  );
  expectFailure(
    `set role authenticated; set request.jwt.claim.sub='${ownerUser}'; insert into public.prefiltros_candidatos(token,candidato_nombre,estado,empresa_id,local_id) values ('blank-local','X','pendiente','${empresaOwn}', '');`,
    /row-level security policy|violates row-level security/i,
    'local vacío'
  );
  assert.equal(scalar('select count(*) from public.prefiltros_candidatos;'), totalBeforeForeign);
  console.log('PM27_C15_NEG_CONTEXTO_INCOMPLETO=PASS');

  // Negativo: sin sesión y rol insuficiente.
  expectFailure(
    `set role authenticated; set request.jwt.claim.sub=''; insert into public.prefiltros_candidatos(token,candidato_nombre,estado,empresa_id,local_id) values ('no-session','X','pendiente','${empresaOwn}','${localOwn}');`,
    /row-level security policy|violates row-level security/i,
    'sin sesión'
  );
  expectFailure(
    `set role authenticated; set request.jwt.claim.sub='${weakUser}'; insert into public.prefiltros_candidatos(token,candidato_nombre,estado,empresa_id,local_id) values ('weak-role','X','pendiente','${empresaOwn}','${localOwn}');`,
    /row-level security policy|violates row-level security/i,
    'rol insuficiente'
  );
  console.log('PM27_C15_NEG_SESION_ROL=PASS');

  // SELECT: la fila de empresa ajena sembrada por el owner de DB permanece invisible.
  assert.equal(scalar(`set role authenticated; set request.jwt.claim.sub='${ownerUser}'; select count(*) from public.prefiltros_candidatos where token='foreign-seed';`), '0');
  console.log('PM27_C15_SELECT_AJENO_INVISIBLE=PASS');

  // DELETE: no puede borrar fila ajena, sí la propia.
  assert.equal(scalar(`set role authenticated; set request.jwt.claim.sub='${ownerUser}'; with d as (delete from public.prefiltros_candidatos where token='foreign-seed' returning 1) select count(*) from d;`), '0');
  assert.equal(scalar(`set role authenticated; set request.jwt.claim.sub='${ownerUser}'; with d as (delete from public.prefiltros_candidatos where token='own-ok' returning 1) select count(*) from d;`), '1');
  console.log('PM27_C15_DELETE_RLS=PASS');

  // todos_locales autoriza locales de SU empresa, pero nunca cruza de empresa.
  assertOk(pg(`set role authenticated; set request.jwt.claim.sub='${wildcardUser}'; insert into public.prefiltros_candidatos(token,candidato_nombre,estado,empresa_id,local_id) values ('wild-own','W','pendiente','${empresaOwn}','${localForeignSameEmpresa}');`), 'todos_locales dentro de empresa');
  expectFailure(
    `set role authenticated; set request.jwt.claim.sub='${wildcardUser}'; insert into public.prefiltros_candidatos(token,candidato_nombre,estado,empresa_id,local_id) values ('wild-foreign-company','W','pendiente','${empresaForeign}','${localForeignEmpresa}');`,
    /row-level security policy|violates row-level security/i,
    'todos_locales no cruza empresa'
  );
  console.log('PM27_C15_TODOS_LOCALES_ACOTADO_EMPRESA=PASS');

  // anon no tiene superficie de tabla.
  expectFailure(
    `set role anon; select count(*) from public.prefiltros_candidatos;`,
    /permission denied for table prefiltros_candidatos/i,
    'anon sin acceso'
  );
  console.log('PM27_C15_ANON_BLOQUEADO=PASS');

  console.log('PM27_C15_RESULTADO=PASS');
} finally {
  run('sudo', ['-u', 'postgres', 'dropdb', '--if-exists', db]);
  if (createdAuthenticated) run('sudo', ['-u', 'postgres', 'psql', '-X', '-q', '-d', 'postgres', '-c', 'drop role if exists authenticated;']);
  if (createdAnon) run('sudo', ['-u', 'postgres', 'psql', '-X', '-q', '-d', 'postgres', '-c', 'drop role if exists anon;']);
}
