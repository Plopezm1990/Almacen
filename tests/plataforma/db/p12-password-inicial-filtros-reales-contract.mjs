// PLATAFORMA P12 — contrato con Postgres real: el bloqueo de la contraseña
// inicial, sobre el texto EXACTO de las funciones de producción.
//
// D01, decisión 3 (16/10/2026). Migraciones:
//   20261016120000_plataforma_password_inicial_pendiente.sql (base, ya probada en P11)
//   20261016130000_plataforma_password_inicial_bloqueo_filtros.sql (esta)
//
// A diferencia de P11 (que usa dos filtros EQUIVALENTES a modo de contrato),
// este contrato aplica la migración F1 real
// (20261009120000_plataforma_f1_administrador_y_empresas.sql, el mismo
// archivo que ya prueba P01) para tener plataforma_asignar_propietario y
// sus dependencias de verdad, y crea private.abc_tiene_capacidad,
// plataforma_kv_permitido y plataforma_mov_permitido con el texto EXACTO
// (byte a byte, leído de pg_proc.prosrc, sin retipear) de producción el
// 16/10/2026, con dependencias de hoja (la_tiene_local, la_tiene_empresa,
// abc_cap_efectiva, plataforma_kv_rol_puede) simplificadas a modo de
// contrato -- mismo criterio de proporción que ya usa P10 para las suyas.
//
// Comprueba que:
//   * la migración 20261016130000 SE NIEGA si el texto de alguna de las 4
//     funciones no coincide con la huella capturada (preflight real, no
//     solo teórico): se simula una mutación mínima y se restaura después (T10);
//   * plataforma_asignar_propietario, end-to-end con la función real, deja
//     al nuevo dueño con la contraseña pendiente (T11);
//   * mientras está pendiente, abc_tiene_capacidad, plataforma_kv_permitido
//     y plataforma_mov_permitido deniegan pese al rol Propietario (T12);
//   * un cambio real de contraseña lo libera y los tres filtros vuelven a
//     conceder (T13);
//   * plataforma_asignar_propietario sigue siendo idempotente por
//     operation_id tras el cambio (regresión de P01, T14);
//   * una cuenta YA establecida, sin fila pendiente, no se ve afectada (T15).
import pg from 'pg';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const url = new URL(process.env.PLATAFORMA_TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/plataforma_p01_test');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Solo se admiten bases de datos de loopback');
assert.equal(url.pathname, '/plataforma_p01_test', 'Solo se admite la base desechable plataforma_p01_test');

const M = (v, def) => process.env[v] || def;
const F1 = M('PLATAFORMA_MIGRACION', 'supabase/migrations/20261009120000_plataforma_f1_administrador_y_empresas.sql');
const PM29 = 'supabase/migrations/20260918120000_pm29_desactivar_empresa_propietario.sql';
const BASE = M('PLATAFORMA_MIGRACION_PASSWORD_PENDIENTE', 'supabase/migrations/20261016120000_plataforma_password_inicial_pendiente.sql');
const FILTROS = M('PLATAFORMA_MIGRACION_PASSWORD_FILTROS', 'supabase/migrations/20261016130000_plataforma_password_inicial_bloqueo_filtros.sql');
const sql = (p) => fs.readFileSync(p, 'utf8');
const extraerFuncion = (fuente, cabecera) => {
  const i = fuente.indexOf(cabecera);
  assert.ok(i >= 0, cabecera);
  const fin = fuente.indexOf('$$;', fuente.indexOf('$$', i) + 2);
  assert.ok(fin > i, cabecera);
  return fuente.slice(i, fin + 3);
};

const ADMIN = '00000000-0000-4000-8000-0000000000a1';
const NUEVO = '00000000-0000-4000-8000-0000000000d1';
const ESTABLECIDO = '00000000-0000-4000-8000-0000000000e1';

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
const rpc = async (c, nombre, args = []) => {
  const marcas = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await c.query(`select public.${nombre}(${marcas}) as r`, args)).rows[0].r;
};

let fallos = 0;
function ok(etiqueta, cond) {
  if (cond) { console.log(`OK ${etiqueta}`); } else { fallos++; console.log(`FALLO ${etiqueta}`); }
}

// --- Esquema base (mismo que P01, más encrypted_password para el disparador) ---
await admin.query(`
  drop schema if exists public cascade; drop schema if exists private cascade; drop schema if exists auth cascade;
  create schema public; create schema private; create schema auth;
  do $$begin
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  end$$;
  grant usage on schema public, private, auth to authenticated, anon;

  create table auth.users (id uuid primary key, email text, deleted_at timestamptz, encrypted_password text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('plataforma.actor', true), '')::uuid $$;

  create table public.perfiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    rol text not null default 'Básico',
    empleado_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    nombre text,
    activo boolean not null default true,
    constraint perfiles_rol_check check (rol in ('Propietario','Encargado','Básico','Camarero/a','Cajero/a','Churrero/a'))
  );
  create table public.empresas (
    id text primary key, nombre text not null, activo boolean not null default true,
    created_at timestamptz not null default now(), datos jsonb not null default '{}'::jsonb
  );
  create table public.locales (
    id text primary key, empresa_id text not null references public.empresas(id),
    nombre text not null, activo boolean not null default true,
    created_at timestamptz not null default now(), datos jsonb not null default '{}'::jsonb
  );
  create table public.membresias_usuario (
    id bigint primary key, user_id uuid not null references auth.users(id) on delete cascade,
    empresa_id text not null, local_id text, todos_locales boolean not null default false,
    rol text not null, activo boolean not null default true,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
    constraint pm12_prod_membresia_empresa check (nullif(btrim(empresa_id), '') is not null),
    constraint pm12_prod_membresia_local check ((todos_locales = true and local_id is null) or (todos_locales = false and nullif(btrim(local_id), '') is not null))
  );
  create table private.la_instalacion_estado (singleton boolean primary key default true, generation text not null);
  create function public.obtener_contexto_instalacion_ui() returns jsonb language sql stable as $$ select jsonb_build_object('ok', true) $$;
  grant select on public.empresas, public.locales, public.membresias_usuario, public.perfiles to authenticated;

  insert into auth.users(id, email, encrypted_password) values
    ('${ADMIN}', 'admin@example.test', 'hash-admin'),
    ('${NUEVO}', 'nuevo@example.test', 'hash-inicial-nuevo'),
    ('${ESTABLECIDO}', 'establecido@example.test', 'hash-establecido');
  insert into public.perfiles(user_id, rol, nombre) values
    ('${ADMIN}', 'Propietario', 'Admin'),
    ('${ESTABLECIDO}', 'Propietario', 'Dueño establecido');
  insert into public.empresas(id, nombre, datos) values ('E1', 'Empresa Uno', '{"nif":"B00000001"}');
  insert into public.locales(id, empresa_id, nombre) values ('L1', 'E1', 'Local Uno');
  -- Dueño YA establecido, sin pasar por esta migración: sin fila pendiente.
  insert into public.membresias_usuario(id, user_id, empresa_id, todos_locales, rol)
    values (1, '${ESTABLECIDO}', 'E1', true, 'Propietario');
`);

// --- Sustituto real de guardar_contexto_instalacion_ui (misma versión que
//     exige el preflight de F1; P01 hace exactamente este mismo paso) ---
await admin.query(extraerFuncion(sql(PM29), 'create or replace function public.guardar_contexto_instalacion_ui('));
await admin.query('grant execute on function public.guardar_contexto_instalacion_ui(text, jsonb) to authenticated');

// --- Migración F1 real (misma que prueba P01) ---
await admin.query(sql(F1));
await admin.query("select private.plataforma_registrar_admin($1, 'prueba')", [ADMIN]);

// --- Migración base del diseño (tabla + disparador + funciones) ---
await admin.query(sql(BASE));

// --- Dependencias de hoja, simplificadas a modo de contrato (mismo criterio
//     que P10 para las suyas: no son el objeto de esta prueba). ---
await admin.query(`
  create or replace function private.la_tiene_empresa(p_empresa text) returns boolean language sql stable security definer set search_path to 'public', 'auth', 'private', 'pg_temp' as $f$
    select exists(select 1 from public.membresias_usuario m where m.user_id=auth.uid() and m.empresa_id=p_empresa and m.activo=true);
  $f$;
  create or replace function private.la_tiene_local(p_empresa text, p_local text) returns boolean language sql stable security definer set search_path to 'public', 'auth', 'private', 'pg_temp' as $f$
    select nullif(btrim(p_local), '') is not null
       and exists(select 1 from public.membresias_usuario m where m.user_id = auth.uid() and m.empresa_id = p_empresa and m.activo = true and (m.todos_locales = true or m.local_id = p_local));
  $f$;
  grant execute on function private.la_tiene_empresa(text), private.la_tiene_local(text, text) to authenticated;

  -- Simplificado a modo de contrato: el catálogo real de capacidades (pieza 5)
  -- no se aplica aquí; basta con que Propietario/Encargado puedan y el resto no,
  -- para probar la línea nueva sin replicar la matriz completa.
  create or replace function private.abc_cap_efectiva(p_empresa text, p_local text, p_rol text, p_capacidad text, p_familia text)
  returns boolean language sql stable security definer set search_path to '' as $f$
    select p_rol in ('Propietario', 'Encargado');
  $f$;
  create or replace function private.plataforma_kv_rol_puede(p_rol text, p_key text) returns boolean language sql stable security definer set search_path to '' as $f$
    select p_rol in ('Propietario', 'Encargado');
  $f$;
`);

// --- Texto EXACTO de producción (16/10/2026, antes de esta migración), leído
//     de pg_proc.prosrc por lectura y volcado aquí sin retipear -- idéntico,
//     carácter a carácter, al que valida el preflight de la migración 20261016130000. ---
await admin.query(`
CREATE OR REPLACE FUNCTION private.abc_tiene_capacidad(p_empresa_id text, p_local_id text, p_capacidad text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_rol text;
  v_capacidad text := upper(btrim(coalesce(p_capacidad,'')));
begin
  if auth.uid() is null then return false; end if;
  if nullif(btrim(coalesce(p_empresa_id,'')),'') is null
     or nullif(btrim(coalesce(p_local_id,'')),'') is null
     or v_capacidad='' then
    return false;
  end if;
  if not private.la_tiene_local(p_empresa_id,p_local_id) then return false; end if;

  select m.rol into v_rol
    from public.membresias_usuario m
   where m.user_id=auth.uid()
     and m.empresa_id=p_empresa_id
     and m.activo=true
     and ((m.todos_locales=false and m.local_id=p_local_id)
       or (m.todos_locales=true and m.local_id is null))
   order by case when m.todos_locales=false and m.local_id=p_local_id then 0 else 1 end,m.id desc
   limit 1;

  if v_rol is null then return false; end if;

  return private.abc_cap_efectiva(p_empresa_id,p_local_id,v_rol,v_capacidad,'GENERAL');
end $function$;

CREATE OR REPLACE FUNCTION private.plataforma_kv_permitido(p_empresa text, p_local text, p_key text, p_accion text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_empresa is not null
     and p_key is not null
     and private.la_tiene_empresa(p_empresa)
     and (p_local is null or private.la_tiene_local(p_empresa, p_local))
     and exists (
       select 1
         from public.membresias_usuario m
         join public.empresas e on e.id = m.empresa_id and e.activo = true
        where m.user_id = auth.uid()
          and m.empresa_id = p_empresa
          and m.activo = true
          and (p_accion is distinct from 'borrar' or m.rol = 'Propietario')
          and private.plataforma_kv_rol_puede(m.rol, p_key)
     )
$function$;

CREATE OR REPLACE FUNCTION private.plataforma_mov_permitido(p_empresa text, p_local text, p_accion text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_empresa is not null
     and private.la_tiene_empresa(p_empresa)
     and (p_local is null or private.la_tiene_local(p_empresa, p_local))
     and exists (
       select 1
         from public.membresias_usuario m
         join public.empresas e on e.id = m.empresa_id and e.activo = true
        where m.user_id = auth.uid()
          and m.empresa_id = p_empresa
          and m.activo = true
          and (p_accion is distinct from 'borrar' or m.rol = 'Propietario')
     )
$function$;

`);
await admin.query(`
  create or replace function public.contrato_tiene_capacidad(p_empresa_id text, p_local_id text, p_capacidad text)
  returns boolean language sql stable security definer set search_path = '' as
    $$ select private.abc_tiene_capacidad(p_empresa_id, p_local_id, p_capacidad) $$;
  grant execute on function public.contrato_tiene_capacidad(text, text, text) to authenticated;

  create or replace function public.contrato_kv_permitido(p_empresa text, p_local text, p_key text, p_accion text)
  returns boolean language sql stable security definer set search_path = '' as
    $$ select private.plataforma_kv_permitido(p_empresa, p_local, p_key, p_accion) $$;
  grant execute on function public.contrato_kv_permitido(text, text, text, text) to authenticated;

  create or replace function public.contrato_mov_permitido(p_empresa text, p_local text, p_accion text)
  returns boolean language sql stable security definer set search_path = '' as
    $$ select private.plataforma_mov_permitido(p_empresa, p_local, p_accion) $$;
  grant execute on function public.contrato_mov_permitido(text, text, text) to authenticated;
`);

// --- T10: la migración de filtros se niega si el texto no coincide con la
//     huella capturada (preflight real, con una mutación real y restauración).
//     La mutación es el mismo texto original con UNA línea de comentario de
//     más, insertada por sustitución de ancla, no retipeada. ---
await admin.query(`
CREATE OR REPLACE FUNCTION private.abc_tiene_capacidad(p_empresa_id text, p_local_id text, p_capacidad text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_rol text;
  v_capacidad text := upper(btrim(coalesce(p_capacidad,'')));
begin
  if auth.uid() is null then return false; end if;
  -- mutación de prueba para T10
  if nullif(btrim(coalesce(p_empresa_id,'')),'') is null
     or nullif(btrim(coalesce(p_local_id,'')),'') is null
     or v_capacidad='' then
    return false;
  end if;
  if not private.la_tiene_local(p_empresa_id,p_local_id) then return false; end if;

  select m.rol into v_rol
    from public.membresias_usuario m
   where m.user_id=auth.uid()
     and m.empresa_id=p_empresa_id
     and m.activo=true
     and ((m.todos_locales=false and m.local_id=p_local_id)
       or (m.todos_locales=true and m.local_id is null))
   order by case when m.todos_locales=false and m.local_id=p_local_id then 0 else 1 end,m.id desc
   limit 1;

  if v_rol is null then return false; end if;

  return private.abc_cap_efectiva(p_empresa_id,p_local_id,v_rol,v_capacidad,'GENERAL');
end $function$;

`);
{
  let detectado = false;
  try {
    await admin.query(sql(FILTROS));
  } catch (e) {
    detectado = /PLATAFORMA_PASSWORD_FILTROS_PREFLIGHT_FALLO:funcion_distinta:abc_tiene_capacidad/.test(e.message);
    if (!detectado) console.log('  (mensaje real del error T10):', e.message);
  }
  ok('T10 la migración de filtros se niega ante una función mutada (preflight real)', detectado);
}

// Restaura el texto exacto original (mismo bloque que arriba) antes de
// aplicar la migración de verdad.
await admin.query(`
CREATE OR REPLACE FUNCTION private.abc_tiene_capacidad(p_empresa_id text, p_local_id text, p_capacidad text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_rol text;
  v_capacidad text := upper(btrim(coalesce(p_capacidad,'')));
begin
  if auth.uid() is null then return false; end if;
  if nullif(btrim(coalesce(p_empresa_id,'')),'') is null
     or nullif(btrim(coalesce(p_local_id,'')),'') is null
     or v_capacidad='' then
    return false;
  end if;
  if not private.la_tiene_local(p_empresa_id,p_local_id) then return false; end if;

  select m.rol into v_rol
    from public.membresias_usuario m
   where m.user_id=auth.uid()
     and m.empresa_id=p_empresa_id
     and m.activo=true
     and ((m.todos_locales=false and m.local_id=p_local_id)
       or (m.todos_locales=true and m.local_id is null))
   order by case when m.todos_locales=false and m.local_id=p_local_id then 0 else 1 end,m.id desc
   limit 1;

  if v_rol is null then return false; end if;

  return private.abc_cap_efectiva(p_empresa_id,p_local_id,v_rol,v_capacidad,'GENERAL');
end $function$;

`);

// --- Aplica la migración de filtros de verdad (ya con los textos exactos) ---
await admin.query(sql(FILTROS));

// --- T11: plataforma_asignar_propietario real deja al nuevo dueño pendiente ---
{
  const cAdmin = await como(ADMIN);
  const r = await rpc(cAdmin, 'plataforma_asignar_propietario', ['op-t11-asignar', 'E1', NUEVO]);
  ok('T11a plataforma_asignar_propietario (real) concede', r.ok === true);
  const pendiente = await admin.query('select 1 from private.plataforma_password_pendiente where user_id = $1', [NUEVO]);
  ok('T11b el nuevo dueño queda con la contraseña pendiente', pendiente.rowCount === 1);
}

// --- T12: mientras está pendiente, los tres filtros reales deniegan ---
{
  const cNuevo = await como(NUEVO);
  const cap = await cNuevo.query('select public.contrato_tiene_capacidad($1,$2,$3) v', ['E1', 'L1', 'ABC_CAJA_OPERAR']);
  const kv = await cNuevo.query('select public.contrato_kv_permitido($1,$2,$3,$4) v', ['E1', 'L1', 'productos', 'leer']);
  const mov = await cNuevo.query('select public.contrato_mov_permitido($1,$2,$3) v', ['E1', 'L1', 'leer']);
  ok('T12a abc_tiene_capacidad (real) deniega con fila pendiente', cap.rows[0].v === false);
  ok('T12b plataforma_kv_permitido (real) deniega con fila pendiente', kv.rows[0].v === false);
  ok('T12c plataforma_mov_permitido (real) deniega con fila pendiente', mov.rows[0].v === false);
}

// --- T13: un cambio real de contraseña libera y los tres filtros conceden ---
await admin.query('update auth.users set encrypted_password = $2 where id = $1', [NUEVO, 'hash-nuevo-definitivo']);
{
  const pendiente = await admin.query('select 1 from private.plataforma_password_pendiente where user_id = $1', [NUEVO]);
  ok('T13a la fila pendiente desaparece tras el cambio real', pendiente.rowCount === 0);
  const cNuevo = await como(NUEVO);
  const cap = await cNuevo.query('select public.contrato_tiene_capacidad($1,$2,$3) v', ['E1', 'L1', 'ABC_CAJA_OPERAR']);
  const kv = await cNuevo.query('select public.contrato_kv_permitido($1,$2,$3,$4) v', ['E1', 'L1', 'productos', 'leer']);
  const mov = await cNuevo.query('select public.contrato_mov_permitido($1,$2,$3) v', ['E1', 'L1', 'leer']);
  ok('T13b abc_tiene_capacidad concede tras el cambio real', cap.rows[0].v === true);
  ok('T13c plataforma_kv_permitido concede tras el cambio real', kv.rows[0].v === true);
  ok('T13d plataforma_mov_permitido concede tras el cambio real', mov.rows[0].v === true);
}

// --- T14: regresión -- plataforma_asignar_propietario sigue siendo
//     idempotente por operation_id (igual que antes de esta migración) ---
{
  const cAdmin = await como(ADMIN);
  const r2 = await rpc(cAdmin, 'plataforma_asignar_propietario', ['op-t11-asignar', 'E1', NUEVO]);
  ok('T14 plataforma_asignar_propietario sigue idempotente por operation_id', r2.idempotente === true && r2.ok === true);
}

// --- T15: regresión -- una cuenta YA establecida (sin fila pendiente nunca)
//     no se ve afectada por este diseño ---
{
  const cEstablecido = await como(ESTABLECIDO);
  const cap = await cEstablecido.query('select public.contrato_tiene_capacidad($1,$2,$3) v', ['E1', 'L1', 'ABC_CAJA_OPERAR']);
  ok('T15 cuenta ya establecida (sin fila pendiente): abc_tiene_capacidad sigue concediendo', cap.rows[0].v === true);
}

for (const c of clientes) await c.end().catch(() => {});
await admin.end();

console.log(`\nTOTAL: ${fallos === 0 ? 'PASS' : 'FAIL'} (${fallos} fallo(s))`);
process.exit(fallos === 0 ? 0 : 1);
