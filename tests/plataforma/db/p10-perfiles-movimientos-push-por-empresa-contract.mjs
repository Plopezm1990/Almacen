// PLATAFORMA F4e — contrato con Postgres real: cuentas, movimientos y avisos push separados por empresa.
//
// Base desechable, solo loopback. Monta dos formas de las tablas:
//   * «prod»: reglas y disparadores copiados de producción (perfiles «leer propio o propietario»,
//     movimientos «leer/insertar/borrar» para cualquier perfil activo, push «propia …» con la rama
//     «user_id nulo y Propietario», y las funciones antiguas completar_local_movimiento() y
//     estampar_propiedad_suscripcion_push() con su texto exacto);
//   * «qa»: reglas qa_* de perfiles y push, movimientos_registro con empresa_id/local_id y solo lectura,
//     y el disparador pm11_perfiles_guard_sensible; sin las funciones antiguas.
// Aplica las migraciones reales F4, F4d y F4e y comprueba que:
//   * un Propietario solo lee y actualiza perfiles de su empresa activa; una empresa dada de baja no cuenta;
//   * los movimientos llevan empresa y local, se atribuyen solos, nadie ve ni borra los de otra empresa y
//     las filas que no se pueden atribuir se conservan ocultas;
//   * los avisos push propios siguen funcionando y la rama «user_id nulo» desaparece;
//   * los dos disparadores antiguos ya no fallan ni mezclan empresas cuando hay dos con la misma clave;
//   * la migración es idempotente, atómica y se niega ante reglas, versiones o requisitos desconocidos.
import pg from 'pg';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const url = new URL(process.env.PLATAFORMA_TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/plataforma_p01_test');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Solo se admiten bases de datos de loopback');
assert.equal(url.pathname, '/plataforma_p01_test', 'Solo se admite la base desechable plataforma_p01_test');

const M = (v, def) => process.env[v] || def;
const F4 = M('PLATAFORMA_MIGRACION_F4', 'supabase/migrations/20261009140000_plataforma_f4_colecciones_por_empresa.sql');
const F4D = M('PLATAFORMA_MIGRACION_F4D', 'supabase/migrations/20261009170000_plataforma_f4d_empresas_vigentes.sql');
const F4E = M('PLATAFORMA_MIGRACION_F4E', 'supabase/migrations/20261009180000_plataforma_f4e_perfiles_movimientos_push_por_empresa.sql');
const FX = 'tests/plataforma/db/fixtures-f4e/';
const sql = (p) => fs.readFileSync(p, 'utf8');
const sinComentarios = (t) => t.replace(/--.*$/gm, '');

const U = (n) => `00000000-0000-4000-8000-0000000000${n}`;
const A_OWN = U('a1'), A_ENC = U('a2'), A_CAM = U('a4'), B_OWN = U('b1'), B_EMP = U('b2'), MULTI = U('c1');
const NADIE = U('d1'), OFF_OWN = U('e1'), A_OFF = U('e2'), INACTIVO = U('f2');

const admin = new pg.Client({ connectionString: url.href });
await admin.connect();
const clientes = [];
async function como(uid, rol = 'authenticated') {
  const c = new pg.Client({ connectionString: url.href });
  await c.connect();
  clientes.push(c);
  await c.query("select set_config('plataforma.actor', $1, false)", [uid || '']);
  await c.query(`set role ${rol}`);
  return c;
}
async function fallo(promesa, { code, mensaje }, etiqueta) {
  try { await promesa; } catch (e) {
    if (code) assert.equal(e.code, code, `${etiqueta}: código esperado ${code}, llegó ${e.code} (${e.message})`);
    if (mensaje) assert.ok(String(e.message).includes(mensaje), `${etiqueta}: mensaje esperado «${mensaje}», llegó «${e.message}»`);
    return;
  }
  assert.fail(`${etiqueta}: debía fallar y no falló`);
}
const n = async (consulta, args = []) => (await admin.query(consulta, args)).rows[0].n;
const defFuncion = async (firma) => (await admin.query('select pg_get_functiondef($1::regprocedure) d', [firma])).rows[0].d;
const md5 = async (texto) => (await admin.query('select md5($1) h', [texto])).rows[0].h;
const politicas = async (tabla) => (await admin.query("select polname from pg_policy where polrelid=$1::regclass order by 1", [`public.${tabla}`])).rows.map((r) => r.polname);
const nombresVisibles = async (c) => (await c.query('select nombre from public.perfiles')).rows.map((r) => r.nombre).sort();
const movIds = async (c) => (await c.query('select id from public.movimientos_registro order by id')).rows.map((r) => r.id);
const upsertKv = (c, key, value) => c.query(
  `insert into public.almacen_kv ("key", "value")
     select pgrst_body."key", pgrst_body."value"
       from (select $1::json as json_data) pgrst_payload,
            lateral (select case when json_typeof(pgrst_payload.json_data) = 'array' then pgrst_payload.json_data else json_build_array(pgrst_payload.json_data) end as val) pgrst_uniform_body,
            lateral (select "key", "value" from json_to_recordset(pgrst_uniform_body.val) as _("key" text, "value" jsonb)) pgrst_body
     on conflict (empresa_id, key) do update set "key" = excluded."key", "value" = excluded."value"`,
  [JSON.stringify([{ key, value }])]);

async function montar(forma, { politicaAjena = null } = {}) {
  await admin.query(`
    drop schema if exists public cascade; drop schema if exists private cascade; drop schema if exists auth cascade;
    create schema public; create schema private; create schema auth;
    do $$begin
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
    end$$;
    grant usage on schema public, private, auth to authenticated, anon;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('plataforma.actor', true), '')::uuid $$;
    create table public.perfiles (user_id uuid primary key, rol text not null default 'Básico', empleado_id text, nombre text, activo boolean not null default true,
                                  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    create table public.empleados (id text primary key, empresa_id text, local_id text, estado text);
    create table public.empresas (id text primary key, nombre text, activo boolean not null default true);
    create table public.locales (id text primary key, empresa_id text not null, nombre text, activo boolean not null default true);
    create table public.membresias_usuario (
      id bigint primary key, user_id uuid not null, empresa_id text not null, local_id text, todos_locales boolean not null default false,
      rol text not null, activo boolean not null default true);
    alter table public.perfiles enable row level security;
    grant select, insert, update, delete on public.perfiles to authenticated;
    grant select on public.empleados, public.empresas, public.locales, public.membresias_usuario to authenticated;

    create or replace function private.la_usuario_activo() returns boolean language sql stable security definer set search_path to 'public', 'auth', 'private', 'pg_temp' as $f$
      select exists (
        select 1 from public.perfiles p
         where p.user_id = auth.uid() and p.activo = true
           and ((p.empleado_id is null and exists (select 1 from public.membresias_usuario m where m.user_id = p.user_id and m.activo = true))
             or (p.empleado_id is not null and exists (
                  select 1 from public.empleados e join public.membresias_usuario m
                    on m.user_id = p.user_id and m.activo = true and m.empresa_id = e.empresa_id
                   and (m.todos_locales = true or (m.todos_locales = false and m.local_id = e.local_id))
                  where e.id = p.empleado_id and e.estado = 'activo')))
      );
    $f$;
    create or replace function private.la_tiene_empresa(p_empresa text) returns boolean language sql stable security definer set search_path to 'public', 'auth', 'private', 'pg_temp' as $f$
      select private.la_usuario_activo()
         and exists(select 1 from public.membresias_usuario m where m.user_id=auth.uid() and m.empresa_id=p_empresa and m.activo=true);
    $f$;
    create or replace function private.la_tiene_local(p_empresa text, p_local text) returns boolean language sql stable security definer set search_path to 'public', 'auth', 'private', 'pg_temp' as $f$
      select private.la_usuario_activo()
         and nullif(btrim(p_local), '') is not null
         and upper(btrim(p_local)) <> 'TODOS'
         and exists(select 1 from public.membresias_usuario m where m.user_id = auth.uid() and m.empresa_id = p_empresa and m.activo = true and (m.todos_locales = true or m.local_id = p_local));
    $f$;
    grant execute on function private.la_tiene_empresa(text), private.la_tiene_local(text, text) to authenticated;
    create or replace function private.es_propietario_activo() returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $f$
      select exists (select 1 from public.perfiles p where p.user_id = (select auth.uid()) and p.activo = true and p.rol = 'Propietario');
    $f$;
    grant execute on function private.es_propietario_activo() to authenticated;

    -- almacen_kv con la forma de producción antes de F4.
    create table public.almacen_kv (key text primary key, value jsonb not null, updated_at timestamptz not null default now(), empresa_id text, local_id text);
    alter table public.almacen_kv enable row level security;
    grant select, insert, update, delete on public.almacen_kv to authenticated;
    create policy "acceso por rol y clave - select" on public.almacen_kv for select using (exists (select 1 from public.perfiles p where p.user_id = auth.uid() and p.activo));
    create policy "acceso por rol y clave - insert" on public.almacen_kv for insert with check (exists (select 1 from public.perfiles p where p.user_id = auth.uid() and p.activo));
    create policy "acceso por rol y clave - update" on public.almacen_kv for update using (exists (select 1 from public.perfiles p where p.user_id = auth.uid() and p.activo)) with check (exists (select 1 from public.perfiles p where p.user_id = auth.uid() and p.activo));
    create policy "acceso por rol y clave - delete" on public.almacen_kv for delete using (exists (select 1 from public.perfiles p where p.user_id = auth.uid() and p.rol = 'Propietario'));

    create table public.suscripciones_push (endpoint text primary key, p256dh text, auth text, dispositivo text, creado_en timestamptz not null default now(), user_id uuid, local_id text);
    alter table public.suscripciones_push enable row level security;
    grant select, insert, update, delete on public.suscripciones_push to authenticated;
  `);

  if (forma === 'prod') {
    await admin.query(`
      create table public.movimientos_registro (id text primary key, fecha date not null default current_date, datos jsonb not null, creado_en timestamptz not null default now());
      alter table public.movimientos_registro enable row level security;
      grant select, insert, update, delete on public.movimientos_registro to authenticated;
      create policy "movimientos - leer" on public.movimientos_registro for select to authenticated using (exists (select 1 from perfiles p where p.user_id = (select auth.uid()) and p.activo = true));
      create policy "movimientos - insertar" on public.movimientos_registro for insert to authenticated with check (exists (select 1 from perfiles p where p.user_id = (select auth.uid()) and p.activo = true));
      create policy "movimientos - borrar" on public.movimientos_registro for delete to authenticated using (exists (select 1 from perfiles p where p.user_id = (select auth.uid()) and p.activo = true and p.rol = 'Propietario'));

      create policy "perfiles - leer propio o propietario" on public.perfiles for select to authenticated using (((select auth.uid()) = user_id) or (select private.es_propietario_activo()));
      create policy "perfiles - propietario actualiza" on public.perfiles for update to authenticated using ((select private.es_propietario_activo())) with check ((select private.es_propietario_activo()));

      create policy "push - propia lee" on public.suscripciones_push for select to authenticated using (exists (select 1 from perfiles p where p.user_id = (select auth.uid()) and p.activo = true and (suscripciones_push.user_id = (select auth.uid()) or (suscripciones_push.user_id is null and p.rol = 'Propietario'))));
      create policy "push - propia inserta" on public.suscripciones_push for insert to authenticated with check (user_id = (select auth.uid()) and exists (select 1 from perfiles p where p.user_id = (select auth.uid()) and p.activo = true));
      create policy "push - propia actualiza" on public.suscripciones_push for update to authenticated using (exists (select 1 from perfiles p where p.user_id = (select auth.uid()) and p.activo = true and (suscripciones_push.user_id = (select auth.uid()) or (suscripciones_push.user_id is null and p.rol = 'Propietario')))) with check (user_id = (select auth.uid()) and exists (select 1 from perfiles p where p.user_id = (select auth.uid()) and p.activo = true));
      create policy "push - propia borra" on public.suscripciones_push for delete to authenticated using (exists (select 1 from perfiles p where p.user_id = (select auth.uid()) and p.activo = true and (suscripciones_push.user_id = (select auth.uid()) or (suscripciones_push.user_id is null and p.rol = 'Propietario'))));
    `);
    await admin.query(sql(`${FX}prod_completar_local_movimiento.sql`));
    await admin.query(sql(`${FX}prod_estampar_propiedad_suscripcion_push.sql`));
    await admin.query(`
      create trigger movimientos_completar_local before insert or update of datos on public.movimientos_registro for each row execute function completar_local_movimiento();
      create trigger suscripciones_push_estampar_propiedad before insert or update on public.suscripciones_push for each row execute function estampar_propiedad_suscripcion_push();
    `);
  } else {
    await admin.query(`
      create table public.movimientos_registro (id text primary key, fecha date not null default current_date, datos jsonb not null, creado_en timestamptz not null default now(), empresa_id text, local_id text);
      alter table public.movimientos_registro enable row level security;
      grant select, insert, update, delete on public.movimientos_registro to authenticated;
      create policy movimientos_registro_select on public.movimientos_registro for select to authenticated
        using (private.la_usuario_activo() and empresa_id is not null and private.la_tiene_empresa(empresa_id)
               and ((exists (select 1 from perfiles p where p.user_id = auth.uid() and p.rol = 'Propietario'))
                    or (exists (select 1 from perfiles p where p.user_id = auth.uid() and p.rol = 'Encargado') and local_id is not null and private.la_tiene_local(empresa_id, local_id))));
      create policy qa_perfil_propio_select on public.perfiles for select to authenticated using (user_id = (select auth.uid()));
      create policy qa_perfil_propio_update on public.perfiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
      create or replace function private.pm11_perfiles_guard_sensible() returns trigger language plpgsql set search_path to 'public', 'auth', 'private', 'pg_temp' as $f$
      begin
        if current_user = 'authenticated' then
          if new.rol is distinct from old.rol then raise exception 'perfil_rol_no_autogestionable'; end if;
          if new.activo is distinct from old.activo then raise exception 'perfil_activo_no_autogestionable'; end if;
          if new.empleado_id is distinct from old.empleado_id then raise exception 'perfil_empleado_no_autogestionable'; end if;
        end if;
        return new;
      end $f$;
      create trigger pm11_perfiles_guard_sensible before update on public.perfiles for each row execute function private.pm11_perfiles_guard_sensible();
      create policy qa_push_propio on public.suscripciones_push for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
    `);
  }
  if (politicaAjena) await admin.query(`create policy politica_ajena on public.${politicaAjena} for select using (true)`);
}

async function datos(forma) {
  await admin.query(`
    insert into auth.users(id) values ('${A_OWN}'),('${A_ENC}'),('${A_CAM}'),('${B_OWN}'),('${B_EMP}'),('${MULTI}'),('${NADIE}'),('${OFF_OWN}'),('${A_OFF}'),('${INACTIVO}');
    insert into public.perfiles(user_id, rol, nombre, empleado_id) values
      ('${A_OWN}','Propietario','A-Dueña',null),('${A_ENC}','Encargado','A-Encargado',null),('${A_CAM}','Camarero/a','A-Camarero','EMP-A1'),
      ('${B_OWN}','Propietario','B-Dueño',null),('${B_EMP}','Cajero/a','B-Cajera',null),('${MULTI}','Propietario','Multi',null),
      ('${NADIE}','Propietario','Nadie',null),('${OFF_OWN}','Propietario','Baja-Dueño',null),('${A_OFF}','Propietario','A-Dueña-y-Baja',null),
      ('${INACTIVO}','Propietario','Inactivo',null);
    update public.perfiles set activo = false where user_id = '${INACTIVO}';
    insert into public.empresas(id, nombre, activo) values ('E-A','Empresa A',true),('E-B','Empresa B',true),('E-OFF','Empresa de baja',false);
    insert into public.locales(id, empresa_id, nombre) values ('L-A1','E-A','A1'),('L-A2','E-A','A2'),('L-B1','E-B','B1'),('L-OFF','E-OFF','Off');
    insert into public.empleados(id, empresa_id, local_id, estado) values ('EMP-A1','E-A','L-A1','activo');
    insert into public.membresias_usuario(id, user_id, empresa_id, local_id, todos_locales, rol) values
      (1,'${A_OWN}','E-A',null,true,'Propietario'),
      (2,'${A_ENC}','E-A','L-A1',false,'Encargado'),
      (3,'${A_CAM}','E-A','L-A1',false,'Camarero/a'),
      (4,'${B_OWN}','E-B',null,true,'Propietario'),
      (5,'${B_EMP}','E-B','L-B1',false,'Cajero/a'),
      (6,'${MULTI}','E-A',null,true,'Propietario'),
      (7,'${MULTI}','E-B',null,true,'Propietario'),
      (8,'${OFF_OWN}','E-OFF',null,true,'Propietario'),
      (9,'${A_OFF}','E-A',null,true,'Propietario'),
      (10,'${A_OFF}','E-OFF',null,true,'Propietario'),
      (11,'${INACTIVO}','E-A',null,true,'Propietario');
  `);
}

// Aplica F4 y F4d sobre almacen_kv de producción y deja listas de empleados/productos de dos empresas.
async function aplicarF4yF4d() {
  await admin.query(sql(F4));
  await admin.query(sql(F4D));
  await admin.query(`insert into public.almacen_kv(empresa_id, key, value) values
    ('E-A','empleados','[{"id":"EMP-A1","localId":"L-A1"}]'),
    ('E-B','empleados','[{"id":"EMP-B1","localId":"L-B1"}]'),
    ('E-A','productos','[{"id":"P1","localId":"L-A1","nombre":"Pan A"}]'),
    ('E-B','productos','[{"id":"P1","localId":"L-B1","nombre":"Pan B"}]'),
    ('E-A','locales','[{"id":"L-A1"}]'),('E-B','locales','[{"id":"L-B1"}]')`);
}

try {
  assert.equal((await admin.query('select current_database() as db')).rows[0].db, 'plataforma_p01_test');
  const migracion = sql(F4E);

  // === 0. Contrato estático ================================================================================
  {
    const limpio = sinComentarios(migracion);
    assert.ok(!/\bdelete\s+from\b|\bdrop\s+(table|function|schema|column)\b|\btruncate\b/i.test(limpio), 'F4e no borra datos ni elimina tablas, funciones o columnas');
    assert.ok(!/\bupdate\s+public\.(perfiles|suscripciones_push|almacen_kv|empresas|locales|membresias_usuario)\b/i.test(limpio), 'F4e solo actualiza movimientos_registro');
    const nuevaC = sql(`${FX}nueva_completar_local_movimiento.sql`).replace(/\n$/, '');
    const nuevaE = sql(`${FX}nueva_estampar_propiedad_suscripcion_push.sql`).replace(/\n$/, '');
    assert.ok(migracion.includes(nuevaC), 'la migración lleva exactamente la función nueva completar_local_movimiento');
    assert.ok(migracion.includes(nuevaE), 'la migración lleva exactamente la función nueva estampar_propiedad_suscripcion_push');
    assert.ok(migracion.includes(await md5(sql(`${FX}prod_completar_local_movimiento.sql`))), 'la migración conoce la huella de producción de completar_local_movimiento');
    assert.ok(migracion.includes(await md5(sql(`${FX}prod_estampar_propiedad_suscripcion_push.sql`))), 'la migración conoce la huella de producción de estampar_propiedad_suscripcion_push');
    // Las huellas reales de producción (leídas el 2026-10-10 con pg_get_functiondef).
    assert.equal(await md5(sql(`${FX}prod_completar_local_movimiento.sql`)), 'b1cf0a6a62799a274b0b84a74902646f');
    assert.equal(await md5(sql(`${FX}prod_estampar_propiedad_suscripcion_push.sql`)), '573e7b05c005384039b43489e06cd518');
  }

  // === 1. Forma «prod» =======================================================================================
  await montar('prod');
  await datos('prod');
  await aplicarF4yF4d();
  const cAOwn = await como(A_OWN), cAEnc = await como(A_ENC), cACam = await como(A_CAM), cBOwn = await como(B_OWN), cBEmp = await como(B_EMP);
  const cMulti = await como(MULTI), cNadie = await como(NADIE), cOff = await como(OFF_OWN), cAOff = await como(A_OFF), cInact = await como(INACTIVO);

  // Datos de partida de movimientos y avisos push (se cargan como servicio, sin pasar por las reglas).
  await admin.query(`insert into public.movimientos_registro(id, datos) values
    ('M-A1', '{"empresaId":"E-A","localId":"L-A1","tipo":"entrada"}'),
    ('M-A2', '{"localId":"L-A2","tipo":"entrada"}'),
    ('M-B1', '{"empresaId":"E-B","localId":"L-B1","tipo":"entrada"}'),
    ('M-LEG', '{"tipo":"antiguo"}')`);
  await admin.query(`insert into public.suscripciones_push(endpoint, p256dh, auth, dispositivo, user_id) values
    ('ep-huerfana', 'k1', 'a1', 'viejo', null),
    ('ep-a', 'k2', 'a2', 'a', '${A_OWN}'),
    ('ep-b', 'k3', 'a3', 'b', '${B_OWN}')`);

  // --- Control: lo que pasa HOY (antes de F4e) --------------------------------------------------------------------
  assert.deepEqual(await nombresVisibles(cBOwn), ['A-Camarero', 'A-Dueña', 'A-Dueña-y-Baja', 'A-Encargado', 'B-Cajera', 'B-Dueño', 'Baja-Dueño', 'Inactivo', 'Multi', 'Nadie'].sort(), 'antes de F4e el Propietario de B ve los perfiles de todas las empresas');
  assert.equal((await cBOwn.query("update public.perfiles set nombre = 'Cambiado' where user_id = $1", [A_ENC])).rowCount, 1, 'antes de F4e el Propietario de B cambia un perfil de A');
  await admin.query("update public.perfiles set nombre = 'A-Encargado' where user_id = $1", [A_ENC]);
  assert.equal((await cBOwn.query('select count(*)::int n from public.movimientos_registro')).rows[0].n, 4, 'antes de F4e cualquier perfil activo ve los movimientos de todas las empresas');
  assert.equal((await cBOwn.query('select count(*)::int n from public.suscripciones_push where user_id is null')).rows[0].n, 1, 'antes de F4e cualquier Propietario ve los avisos push sin dueño');
  // Los dos disparadores antiguos ya no son válidos con dos empresas con la misma clave.
  await fallo(cACam.query("insert into public.suscripciones_push(endpoint, p256dh, auth, dispositivo) values ('ep-cam','kk','aa','tel')"),
    { code: '21000' }, 'antes de F4e el disparador de push falla con dos listas de empleados');

  const huellaDatos = async () => JSON.stringify([
    (await admin.query('select * from public.almacen_kv order by empresa_id, key')).rows,
    (await admin.query('select user_id, rol, nombre, activo from public.perfiles order by user_id')).rows,
    (await admin.query('select endpoint, user_id, local_id from public.suscripciones_push order by endpoint')).rows,
  ]);
  const antes = await huellaDatos();
  const defCompAntes = await defFuncion('public.completar_local_movimiento()');
  assert.equal(await md5(defCompAntes), 'b1cf0a6a62799a274b0b84a74902646f', 'la función de la base de prueba es la de producción');

  await admin.query(migracion);

  assert.equal(await huellaDatos(), antes, 'F4e no cambia perfiles, almacen_kv ni avisos push');
  assert.deepEqual(await politicas('perfiles'), ['plataforma_perfiles_select', 'plataforma_perfiles_update']);
  assert.deepEqual(await politicas('movimientos_registro'), ['plataforma_mov_delete', 'plataforma_mov_insert', 'plataforma_mov_select']);
  assert.deepEqual(await politicas('suscripciones_push'), ['plataforma_push_delete', 'plataforma_push_insert', 'plataforma_push_select', 'plataforma_push_update']);
  assert.equal(await n("select count(*)::int n from pg_proc where proname = 'es_propietario_activo'"), 1, 'F4e no elimina es_propietario_activo');

  if (process.env.P10_HUELLAS === '1') {
    const hs = await admin.query(`select p.oid::regprocedure::text fn, md5(pg_get_functiondef(p.oid)) h, length(pg_get_functiondef(p.oid)) n
        from pg_proc p where p.proname in ('plataforma_empresa_del_llamante','plataforma_mov_permitido','plataforma_perfil_gestionable','plataforma_f4e_movimientos_empresa','completar_local_movimiento','estampar_propiedad_suscripcion_push') order by 1`);
    for (const r of hs.rows) console.log('HUELLA_F4E', r.fn, r.h, r.n);
    const pol = await admin.query(`select c.relname t, p.polname, p.polcmd, md5(coalesce(pg_get_expr(p.polqual,p.polrelid),'-')||'|'||coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'-')) h
        from pg_policy p join pg_class c on c.oid=p.polrelid where c.relname in ('perfiles','movimientos_registro','suscripciones_push') and c.relnamespace='public'::regnamespace order by 1,2`);
    for (const r of pol.rows) console.log('HUELLA_F4E_POLITICA', r.t, r.polname, r.polcmd, r.h);
  }

  // --- Funciones sustituidas: exactamente las nuevas ---------------------------------------------------------------
  {
    const nuevaC = sql(`${FX}nueva_completar_local_movimiento.sql`);
    const nuevaE = sql(`${FX}nueva_estampar_propiedad_suscripcion_push.sql`);
    assert.equal(await md5(await defFuncion('public.completar_local_movimiento()')), await md5(nuevaC.replace(/\n$/, '') + '\n'), 'completar_local_movimiento es la versión nueva');
    assert.ok((await defFuncion('public.estampar_propiedad_suscripcion_push()')).includes('private.plataforma_empresa_del_llamante()'));
    assert.equal((await defFuncion('public.estampar_propiedad_suscripcion_push()')).split('and empresa_id = v_empresa').length - 1, 4, 'las cuatro lecturas de almacen_kv filtran por empresa');
    assert.ok(nuevaE.length > 0);
  }

  // --- perfiles ---------------------------------------------------------------------------------------------------------
  {
    assert.deepEqual(await nombresVisibles(cAOwn), ['A-Camarero', 'A-Dueña', 'A-Dueña-y-Baja', 'A-Encargado', 'Inactivo', 'Multi'], 'el Propietario de A ve solo las cuentas de A (también las desactivadas, para poder reactivarlas)');
    assert.deepEqual(await nombresVisibles(cBOwn), ['B-Cajera', 'B-Dueño', 'Multi'], 'el Propietario de B ve solo las cuentas de B');
    assert.deepEqual(await nombresVisibles(cMulti), ['A-Camarero', 'A-Dueña', 'A-Dueña-y-Baja', 'A-Encargado', 'B-Cajera', 'B-Dueño', 'Inactivo', 'Multi'], 'el Propietario de dos empresas ve las dos');
    assert.deepEqual(await nombresVisibles(cAEnc), ['A-Encargado'], 'un Encargado solo ve el suyo');
    assert.deepEqual(await nombresVisibles(cNadie), ['Nadie'], 'una cuenta sin empresa solo ve el suyo');
    assert.deepEqual(await nombresVisibles(cOff), ['Baja-Dueño'], 'el Propietario de una empresa dada de baja solo ve el suyo');
    assert.deepEqual(await nombresVisibles(cAOff), ['A-Camarero', 'A-Dueña', 'A-Dueña-y-Baja', 'A-Encargado', 'Inactivo', 'Multi'], 'una empresa dada de baja no amplía lo que ve');
    assert.deepEqual(await nombresVisibles(cInact), ['Inactivo'], 'un perfil inactivo solo ve el suyo (no gestiona a nadie)');

    const act = (c, uid, sets) => c.query(`update public.perfiles set ${sets} where user_id = $1`, [uid]);
    assert.equal((await act(cAOwn, A_ENC, "nombre = 'A-Enc 2'")).rowCount, 1, 'A cambia un perfil de A');
    assert.equal((await act(cAOwn, A_ENC, "rol = 'Cajero/a'")).rowCount, 1, 'A cambia el cargo de una cuenta de A (como hoy)');
    assert.equal((await act(cAOwn, B_EMP, "nombre = 'robado'")).rowCount, 0, 'A no cambia un perfil de B');
    assert.equal((await act(cAOwn, B_OWN, "activo = false")).rowCount, 0, 'A no desactiva al dueño de B');
    assert.equal((await act(cBOwn, A_ENC, "rol = 'Propietario'")).rowCount, 0, 'B no asciende a una cuenta de A');
    assert.equal((await act(cAEnc, A_OWN, "nombre = 'x'")).rowCount, 0, 'un Encargado no cambia perfiles');
    assert.equal((await act(cAEnc, A_ENC, "nombre = 'x'")).rowCount, 0, 'ni siquiera el suyo (como hoy: solo Propietario actualiza)');
    assert.equal((await act(cOff, A_OWN, "nombre = 'x'")).rowCount, 0, 'el Propietario de una empresa de baja no gestiona a nadie de otra');
    assert.equal((await act(cOff, OFF_OWN, "nombre = 'x'")).rowCount, 0, 'tampoco con su empresa de baja: ni su propio perfil');
    assert.equal((await act(cAOff, A_ENC, "nombre = 'A-Enc 3'")).rowCount, 1, 'A_OFF gestiona la parte viva');
    assert.equal((await act(cAOff, OFF_OWN, "nombre = 'x'")).rowCount, 0, 'y no la parte de baja');
    assert.equal((await act(cMulti, B_EMP, "nombre = 'B-Cajera 2'")).rowCount, 1, 'el Propietario de dos empresas gestiona las dos');
    assert.equal((await act(cInact, A_ENC, "nombre = 'x'")).rowCount, 0, 'un perfil inactivo no actualiza');
    // El cliente solo lee su propio perfil: sigue funcionando para todos.
    for (const [c, uid] of [[cAEnc, A_ENC], [cBEmp, B_EMP], [cNadie, NADIE], [cOff, OFF_OWN], [cACam, A_CAM]]) {
      assert.equal((await c.query('select count(*)::int n from public.perfiles where user_id = $1', [uid])).rows[0].n, 1, 'cada cuenta lee su propio perfil');
    }
    // Un perfil no se puede mover a otra cuenta: la comprobación de la actualización también mira la fila nueva.
    await fallo(cAOwn.query('update public.perfiles set user_id = $1 where user_id = $2', [U('99'), A_ENC]), { code: '42501', mensaje: 'row-level security' }, 'mover un perfil a una cuenta ajena');
    assert.equal(await n('select count(*)::int n from public.perfiles where user_id = $1', [A_ENC]), 1, 'el perfil sigue en su cuenta');
    // Para gestionar hace falta ser Propietario en el perfil Y en la membresía de esa empresa.
    const PROP_ENC = U('a7'), ENC_PROP = U('a8');
    await admin.query(`
      insert into auth.users(id) values ('${PROP_ENC}'),('${ENC_PROP}');
      insert into public.perfiles(user_id, rol, nombre) values ('${PROP_ENC}','Propietario','PropEnc'),('${ENC_PROP}','Encargado','EncProp');
      insert into public.membresias_usuario(id, user_id, empresa_id, todos_locales, rol) values (30,'${PROP_ENC}','E-A',true,'Encargado'),(31,'${ENC_PROP}','E-A',true,'Propietario')`);
    const cPE = await como(PROP_ENC), cEP = await como(ENC_PROP);
    assert.deepEqual(await nombresVisibles(cPE), ['PropEnc'], 'Propietario en el perfil pero Encargado en la empresa: no gestiona');
    assert.deepEqual(await nombresVisibles(cEP), ['EncProp'], 'Propietario en la empresa pero Encargado en el perfil: no gestiona');
    assert.equal((await act(cPE, A_ENC, "nombre = 'x'")).rowCount, 0);
    assert.equal((await act(cEP, A_ENC, "nombre = 'x'")).rowCount, 0);
  }

  // --- movimientos_registro --------------------------------------------------------------------------------------------
  {
    const filas = (await admin.query('select id, empresa_id, local_id from public.movimientos_registro order by id')).rows;
    assert.deepEqual(filas, [
      { id: 'M-A1', empresa_id: 'E-A', local_id: 'L-A1' },
      { id: 'M-A2', empresa_id: 'E-A', local_id: 'L-A2' },
      { id: 'M-B1', empresa_id: 'E-B', local_id: 'L-B1' },
      { id: 'M-LEG', empresa_id: null, local_id: null },
    ], 'relleno: por datos.empresaId, por el local, y la fila inatribuible se conserva sin empresa');
    assert.deepEqual(await movIds(cAOwn), ['M-A1', 'M-A2'], 'A ve sus movimientos');
    assert.deepEqual(await movIds(cBOwn), ['M-B1'], 'B ve los suyos');
    assert.deepEqual(await movIds(cMulti), ['M-A1', 'M-A2', 'M-B1'], 'el de dos empresas ve los de las dos');
    assert.deepEqual(await movIds(cNadie), [], 'una cuenta sin empresa no ve nada');
    assert.deepEqual(await movIds(cOff), [], 'una empresa dada de baja no ve nada');
    assert.deepEqual(await movIds(cACam), ['M-A1'], 'una cuenta limitada a un local solo ve los de ese local');
    assert.deepEqual(await movIds(cBEmp), ['M-B1'], 'cargo con local: ve el suyo');
    assert.deepEqual(await movIds(cInact), [], 'perfil inactivo: nada');
    assert.equal(await n("select count(*)::int n from public.movimientos_registro where id = 'M-LEG'"), 1, 'la fila antigua sin empresa sigue ahí');
    assert.equal((await cAOwn.query("select count(*)::int n from public.movimientos_registro where id = 'M-LEG'")).rows[0].n, 0, 'pero nadie la ve');

    const ins = (c, id, d) => c.query('insert into public.movimientos_registro(id, datos) values ($1, $2::jsonb)', [id, JSON.stringify(d)]);
    const fila = async (id) => (await admin.query('select empresa_id, local_id, datos from public.movimientos_registro where id = $1', [id])).rows[0];
    await ins(cAOwn, 'N-1', { empresaId: 'E-A', localId: 'L-A1', tipo: 'salida' });
    assert.deepEqual(await fila('N-1').then((r) => [r.empresa_id, r.local_id]), ['E-A', 'L-A1'], 'inserta con empresa y local del dato');
    await ins(cAOwn, 'N-2', { tipo: 'salida' });
    assert.deepEqual(await fila('N-2').then((r) => [r.empresa_id, r.local_id]), ['E-A', null], 'sin datos: la única empresa de la cuenta');
    await ins(cAOwn, 'N-3', { localId: 'L-A2' });
    assert.deepEqual(await fila('N-3').then((r) => [r.empresa_id, r.local_id]), ['E-A', 'L-A2'], 'solo el local: la empresa del local');
    await fallo(ins(cAOwn, 'N-4', { empresaId: 'E-B', localId: 'L-B1' }), { code: '42501' }, 'insertar en la empresa ajena');
    await fallo(ins(cBOwn, 'N-5', { empresaId: 'E-A' }), { code: '42501' }, 'B inserta en A');
    await fallo(ins(cMulti, 'N-6', { tipo: 'x' }), { code: '42501', mensaje: 'almacen_kv_empresa_ambigua' }, 'dos empresas y sin dato: falla cerrado');
    await ins(cMulti, 'N-6b', { empresaId: 'E-B' });
    assert.equal((await fila('N-6b')).empresa_id, 'E-B', 'con empresa explícita sí');
    await fallo(ins(cNadie, 'N-7', { tipo: 'x' }), { code: '42501', mensaje: 'movimientos_empresa_no_determinada' }, 'cuenta sin empresa');
    await fallo(ins(cOff, 'N-8', { tipo: 'x' }), { code: '42501', mensaje: 'movimientos_empresa_no_determinada' }, 'empresa dada de baja');
    await fallo(ins(cOff, 'N-8b', { empresaId: 'E-OFF' }), { code: '42501' }, 'ni con empresa explícita');
    // Una cuenta con una empresa viva y otra dada de baja: lo de la empresa de baja ni se ve ni se escribe.
    await admin.query(`insert into public.movimientos_registro(id, datos, empresa_id, local_id) values ('M-OFF', '{}', 'E-OFF', 'L-OFF')`);
    assert.equal((await cAOff.query("select count(*)::int n from public.movimientos_registro where id = 'M-OFF'")).rows[0].n, 0, 'no ve movimientos de su empresa de baja');
    await fallo(ins(cAOff, 'N-OFF', { empresaId: 'E-OFF' }), { code: '42501' }, 'no escribe en su empresa de baja');
    await ins(cAOff, 'N-OFF2', { empresaId: 'E-A' });
    assert.equal((await fila('N-OFF2')).empresa_id, 'E-A', 'y sí en la viva');
    // La empresa se deduce del local aunque la cuenta tenga dos empresas activas, y también sin sesión.
    await ins(cMulti, 'N-3b', { localId: 'L-B1' });
    assert.equal((await fila('N-3b')).empresa_id, 'E-B', 'empresa de un local de B para una cuenta con dos empresas');
    await admin.query(`insert into public.movimientos_registro(id, datos) values ('N-SVC2', '{"localId":"L-A1"}')`);
    assert.equal((await fila('N-SVC2')).empresa_id, 'E-A', 'sin sesión: la empresa del local');
    await ins(cACam, 'N-9', { localId: 'L-A1' });
    await fallo(ins(cACam, 'N-10', { localId: 'L-A2' }), { code: '42501' }, 'cuenta de un local en otro local');
    await fallo(ins(cInact, 'N-11', { empresaId: 'E-A' }), { code: '42501' }, 'perfil inactivo');
    // Servicio (sin sesión): no inventa empresa.
    await admin.query(`insert into public.movimientos_registro(id, datos) values ('N-SVC', '{"tipo":"x"}')`);
    assert.equal((await fila('N-SVC')).empresa_id, null, 'sin sesión no se inventa empresa');

    // Borrar: solo Propietario y solo de su empresa.
    assert.equal((await cAEnc.query("delete from public.movimientos_registro where id = 'N-1'")).rowCount, 0, 'un Encargado no borra');
    assert.equal((await cBOwn.query("delete from public.movimientos_registro where id in ('N-1','M-A1')")).rowCount, 0, 'B no borra los de A');
    assert.equal((await cAOwn.query("delete from public.movimientos_registro where id in ('N-1','M-B1')")).rowCount, 1, 'A borra solo los suyos');
    assert.equal(await n("select count(*)::int n from public.movimientos_registro where id = 'M-B1'"), 1);

    // El disparador antiguo de completar el local: ahora solo mira los productos de la empresa del movimiento.
    await ins(cBOwn, 'C-B', { productoId: 'P1', empresaId: 'E-B' });
    assert.equal((await fila('C-B')).datos.localId, 'L-B1', 'completa el local con el producto de SU empresa');
    await ins(cAOwn, 'C-A', { productoId: 'P1', empresaId: 'E-A' });
    assert.equal((await fila('C-A')).datos.localId, 'L-A1');
    await ins(cAOwn, 'C-A2', { productoId: 'P1' });
    assert.equal((await fila('C-A2')).datos.localId, 'L-A1', 'sin empresa en el dato: la de la cuenta');
    await admin.query(`insert into public.movimientos_registro(id, datos) values ('C-SVC', '{"productoId":"P1"}')`);
    assert.equal((await fila('C-SVC')).datos.localId ?? null, null, 'sin sesión ni empresa no se toma el producto de ninguna empresa');

    // La empresa y el local de una fila no se cambian desde la API (se prueba con una regla temporal de UPDATE).
    await admin.query(`create policy tmp_upd on public.movimientos_registro for update to authenticated using (true) with check (true); grant update on public.movimientos_registro to authenticated`);
    await fallo(cAOwn.query("update public.movimientos_registro set empresa_id = 'E-B' where id = 'N-2'"), { code: '42501' }, 'cambiar la empresa (la regla de escritura lo impide o el disparador)');
    await fallo(cMulti.query("update public.movimientos_registro set empresa_id = 'E-B' where id = 'M-A1'"), { code: '42501', mensaje: 'movimientos_empresa_inmutable' }, 'cambiar la empresa con acceso a las dos');
    await fallo(cAOwn.query("update public.movimientos_registro set local_id = 'L-A2' where id = 'N-2'"), { code: '42501', mensaje: 'movimientos_empresa_inmutable' }, 'cambiar el local');
    assert.equal((await cAOwn.query("update public.movimientos_registro set datos = datos || '{\"nota\":1}' where id = 'N-2'")).rowCount, 1, 'el resto de campos sí se actualiza');
    await admin.query('drop policy tmp_upd on public.movimientos_registro');
  }

  // --- avisos push -----------------------------------------------------------------------------------------------------
  {
    const veo = async (c) => (await c.query('select endpoint from public.suscripciones_push order by endpoint')).rows.map((r) => r.endpoint);
    assert.deepEqual(await veo(cAOwn), ['ep-a'], 'ya no se ven los avisos sin dueño ni los ajenos');
    assert.deepEqual(await veo(cBOwn), ['ep-b']);
    assert.equal((await cAOwn.query("delete from public.suscripciones_push where endpoint = 'ep-huerfana'")).rowCount, 0, 'un Propietario no borra avisos sin dueño');
    assert.equal(await n("select count(*)::int n from public.suscripciones_push where endpoint = 'ep-huerfana'"), 1, 'el aviso sin dueño se conserva');
    // Antes fallaba (21000); ahora el disparador toma el local del empleado de SU empresa.
    await cACam.query("insert into public.suscripciones_push(endpoint, p256dh, auth, dispositivo) values ('ep-cam','kk','aa','tel')");
    const cam = (await admin.query("select user_id, local_id from public.suscripciones_push where endpoint = 'ep-cam'")).rows[0];
    assert.deepEqual([cam.user_id, cam.local_id], [A_CAM, 'L-A1'], 'cuenta de empleado: su local, de su empresa');
    // Propietario: infiere el único local de los productos de SU empresa (no los de otras).
    await cAOwn.query("insert into public.suscripciones_push(endpoint, p256dh, auth, dispositivo) values ('ep-a2','kk','aa','pc')");
    assert.equal((await admin.query("select local_id from public.suscripciones_push where endpoint = 'ep-a2'")).rows[0].local_id, 'L-A1', 'infiere el único local de su empresa');
    await cBOwn.query("insert into public.suscripciones_push(endpoint, p256dh, auth, dispositivo, local_id) values ('ep-b2','kk','aa','pc','L-B1')");
    await fallo(cBOwn.query("insert into public.suscripciones_push(endpoint, p256dh, auth, dispositivo, local_id) values ('ep-b3','kk','aa','pc','L-A1')"), { code: '42501', mensaje: 'Local de suscripción no válido' }, 'un local de otra empresa no es válido');
    await fallo(cMulti.query("insert into public.suscripciones_push(endpoint, p256dh, auth, dispositivo) values ('ep-m','kk','aa','pc')"), { code: '42501', mensaje: 'almacen_kv_empresa_ambigua' }, 'dos empresas: falla cerrado');
    await fallo(cInact.query("insert into public.suscripciones_push(endpoint, p256dh, auth, dispositivo) values ('ep-i','kk','aa','pc')"), { code: '42501' }, 'perfil inactivo');
    // Ajeno: no se puede insertar a nombre de otra cuenta ni actualizar la de otra.
    assert.equal((await cAOwn.query("update public.suscripciones_push set dispositivo = 'x' where endpoint = 'ep-b'")).rowCount, 0, 'no actualiza avisos ajenos');
    assert.equal((await cAOwn.query("delete from public.suscripciones_push where endpoint = 'ep-b'")).rowCount, 0, 'no borra avisos ajenos');
    assert.equal((await cAOwn.query("delete from public.suscripciones_push where endpoint = 'ep-a2'")).rowCount, 1, 'borra los propios');
  }

  // --- Permisos de las ayudas ------------------------------------------------------------------------------------------
  {
    await fallo(cAOwn.query('select private.plataforma_empresa_del_llamante()'), { code: '42501' }, 'authenticated no ejecuta empresa_del_llamante');
    await fallo(cAOwn.query('select private.plataforma_f4e_movimientos_empresa()'), { code: '42501' }, 'authenticated no ejecuta el disparador');
    const cAnon = await como('', 'anon');
    await fallo(cAnon.query('select private.plataforma_mov_permitido($1, $2, $3)', ['E-A', null, 'leer']), { code: '42501' }, 'anon no ejecuta mov_permitido');
    await fallo(cAnon.query('select * from public.perfiles'), { code: '42501' }, 'anon no lee perfiles');
    await fallo(cAnon.query('select * from public.movimientos_registro'), { code: '42501' }, 'anon no lee movimientos');
  }

  // --- Idempotencia ----------------------------------------------------------------------------------------------------
  {
    const defs = async () => JSON.stringify([
      await defFuncion('public.completar_local_movimiento()'), await defFuncion('public.estampar_propiedad_suscripcion_push()'),
      await defFuncion('private.plataforma_empresa_del_llamante()'), await defFuncion('private.plataforma_mov_permitido(text,text,text)'),
      await defFuncion('private.plataforma_perfil_gestionable(uuid)'), await defFuncion('private.plataforma_f4e_movimientos_empresa()'),
    ]);
    const d0 = await defs();
    const datosFoto = async () => JSON.stringify((await admin.query('select id, empresa_id, local_id, datos from public.movimientos_registro order by id')).rows) + await huellaDatos();
    const f0 = await datosFoto();
    await admin.query(migracion);
    assert.equal(await defs(), d0, 're-aplicar F4e no cambia las funciones');
    assert.equal(await datosFoto(), f0, 're-aplicar F4e no cambia los datos');
    assert.deepEqual(await politicas('movimientos_registro'), ['plataforma_mov_delete', 'plataforma_mov_insert', 'plataforma_mov_select']);
    assert.equal(await n("select count(*)::int n from pg_trigger where tgrelid = 'public.movimientos_registro'::regclass and not tgisinternal"), 2, 'un solo disparador de F4e junto al antiguo');
  }

  // === 2. Forma «qa» ===========================================================================================
  {
    await montar('qa');
    await datos('qa');
    await aplicarF4yF4d();
    await admin.query(`insert into public.movimientos_registro(id, datos, empresa_id, local_id) values
      ('Q-A1','{"x":1}','E-A','L-A1'),('Q-B1','{"x":1}','E-B','L-B1'),('Q-SIN','{"x":1}',null,null),
      ('Q-X','{"empresaId":"E-A","localId":"L-A1"}','E-B','L-A2'),
      ('Q-Y','{"localId":"L-A1"}',null,'L-A2')`);
    const defFuera = async (nombre) => (await admin.query('select count(*)::int n from pg_proc where proname = $1', [nombre])).rows[0].n;
    assert.equal(await defFuera('completar_local_movimiento'), 0);
    const consultaFoto = "select id, empresa_id, local_id from public.movimientos_registro where id <> 'Q-Y' order by id";
    const foto = JSON.stringify((await admin.query(consultaFoto)).rows);
    await admin.query(migracion);
    assert.equal(JSON.stringify((await admin.query(consultaFoto)).rows), foto, 'QA: las filas con empresa no cambian y las sin empresa se quedan sin empresa');
    assert.equal(await defFuera('completar_local_movimiento'), 0, 'QA: no se crea ninguna función antigua');
    assert.equal(await defFuera('estampar_propiedad_suscripcion_push'), 0);
    assert.deepEqual(await politicas('perfiles'), ['plataforma_perfiles_select', 'plataforma_perfiles_update'], 'QA: las reglas qa_* se sustituyen');
    assert.deepEqual(await politicas('suscripciones_push'), ['plataforma_push_delete', 'plataforma_push_insert', 'plataforma_push_select', 'plataforma_push_update']);
    const qOwn = await como(A_OWN), qB = await como(B_OWN), qEnc = await como(A_ENC);
    assert.deepEqual(await movIds(qOwn), ['Q-A1', 'Q-Y'], 'QA: A ve el suyo (incluida Q-Y, que la migración completa con la empresa del local L-A2)');
    assert.deepEqual((await admin.query("select empresa_id, local_id from public.movimientos_registro where id = 'Q-Y'")).rows[0], { empresa_id: 'E-A', local_id: 'L-A2' }, 'QA: se completa la empresa que falta y se respeta el local ya puesto');
    assert.deepEqual(await movIds(qB), ['Q-B1', 'Q-X'], 'QA: una empresa o local ya puestos no se pisan con lo que diga el dato');
    await qOwn.query(`insert into public.movimientos_registro(id, datos) values ('Q-N','{"localId":"L-A1"}')`);
    assert.equal((await admin.query("select empresa_id from public.movimientos_registro where id = 'Q-N'")).rows[0].empresa_id, 'E-A', 'QA: la subida de movimientos del cliente ahora entra');
    assert.deepEqual(await nombresVisibles(qOwn), ['A-Camarero', 'A-Dueña', 'A-Dueña-y-Baja', 'A-Encargado', 'Inactivo', 'Multi']);
    assert.equal((await qOwn.query("update public.perfiles set nombre = 'nuevo' where user_id = $1", [A_ENC])).rowCount, 1);
    await fallo(qOwn.query("update public.perfiles set rol = 'Cajero/a' where user_id = $1", [A_ENC]), { mensaje: 'perfil_rol_no_autogestionable' }, 'QA: el guardián de cargos sigue');
    assert.equal((await qB.query("update public.perfiles set nombre = 'x' where user_id = $1", [A_ENC])).rowCount, 0, 'QA: B no toca a A');
    assert.equal((await qEnc.query("update public.perfiles set nombre = 'x' where user_id = $1", [A_ENC])).rowCount, 0, 'QA: la regla de actualización propia deja de existir');
    await qOwn.query("insert into public.suscripciones_push(endpoint, p256dh, auth, dispositivo, user_id) values ('q-ep','k','a','pc', $1)", [A_OWN]);
    assert.equal((await qB.query('select count(*)::int n from public.suscripciones_push')).rows[0].n, 0, 'QA: B no ve el aviso de A');
    const f2 = JSON.stringify((await admin.query(consultaFoto)).rows);
    await admin.query(migracion);
    assert.equal(JSON.stringify((await admin.query(consultaFoto)).rows), f2, 'QA: idempotente');
  }

  // === 3. La migración se niega ante lo que no conoce y no deja nada a medias =====================================
  {
    for (const tabla of ['perfiles', 'movimientos_registro', 'suscripciones_push']) {
      await montar('prod', { politicaAjena: tabla });
      await datos('prod');
      await aplicarF4yF4d();
      const antesPol = JSON.stringify([await politicas('perfiles'), await politicas('movimientos_registro'), await politicas('suscripciones_push')]);
      await fallo(admin.query(migracion), { mensaje: `PLATAFORMA_F4E_POLITICA_DESCONOCIDA:${tabla}` }, `política desconocida en ${tabla}`);
      await admin.query('rollback');
      assert.equal(JSON.stringify([await politicas('perfiles'), await politicas('movimientos_registro'), await politicas('suscripciones_push')]), antesPol, 'abortada: las reglas siguen como estaban');
      assert.equal(await n("select count(*)::int n from information_schema.columns where table_name = 'movimientos_registro' and column_name = 'empresa_id'"), 0, 'abortada: no se añadió ninguna columna');
    }
    // Versión de una función antigua que no es la de producción.
    for (const [funcion, firma] of [['completar_local_movimiento', 'public.completar_local_movimiento()'], ['estampar_propiedad_suscripcion_push', 'public.estampar_propiedad_suscripcion_push()']]) {
      await montar('prod');
      await datos('prod');
      await aplicarF4yF4d();
      await admin.query(`create or replace function public.${funcion}() returns trigger language plpgsql as $$ begin return new; end $$`);
      const defRara = await defFuncion(firma);
      await fallo(admin.query(migracion), { mensaje: `PLATAFORMA_F4E_FUNCION_DESCONOCIDA:${funcion}` }, `versión desconocida de ${funcion}`);
      await admin.query('rollback');
      assert.equal(await defFuncion(firma), defRara, 'abortada: la función queda como estaba');
      assert.equal(await n("select count(*)::int n from pg_policy where polrelid = 'public.perfiles'::regclass and polname like 'plataforma_%'"), 0, 'abortada: ninguna regla nueva');
    }
    // Sin F4 y sin F4d.
    await montar('prod');
    await datos('prod');
    await fallo(admin.query(migracion), { mensaje: 'PLATAFORMA_F4E_PREVIO:falta_F4' }, 'sin F4');
    await admin.query('rollback');
    await admin.query(sql(F4));
    await fallo(admin.query(migracion), { mensaje: 'PLATAFORMA_F4E_PREVIO:falta_F4d' }, 'sin F4d');
    await admin.query('rollback');
    assert.deepEqual(await politicas('perfiles'), ['perfiles - leer propio o propietario', 'perfiles - propietario actualiza']);
    // Falla un paso intermedio: todo se deshace (columna, relleno, reglas, funciones).
    await admin.query(sql(F4D));
    await admin.query(`insert into public.movimientos_registro(id, datos) values ('R-1','{"empresaId":"E-A","localId":"L-A1"}')`);
    await admin.query(`create or replace function private.plataforma_f4e_movimientos_empresa() returns int language sql as $$ select 1 $$`); // choca con la función de la migración (otro tipo de retorno)
    await fallo(admin.query(migracion), { code: '42P13' }, 'un paso intermedio falla');
    await admin.query('rollback');
    assert.equal(await n("select count(*)::int n from information_schema.columns where table_name = 'movimientos_registro' and column_name = 'empresa_id'"), 0, 'todo se deshace: la columna no queda');
    assert.deepEqual(await politicas('movimientos_registro'), ['movimientos - borrar', 'movimientos - insertar', 'movimientos - leer'], 'todo se deshace: las reglas antiguas siguen');
    assert.equal(await md5(await defFuncion('public.completar_local_movimiento()')), 'b1cf0a6a62799a274b0b84a74902646f', 'todo se deshace: la función antigua sigue');
  }

  console.log('PLATAFORMA_P10_PERFILES_MOVIMIENTOS_PUSH_POR_EMPRESA=PASS');
} finally {
  for (const c of clientes) { try { await c.end(); } catch { /* ya cerrado */ } }
  try { await admin.end(); } catch { /* ya cerrado */ }
}
