// PLATAFORMA P11 — contrato con Postgres real: blindaje en servidor de la contraseña inicial.
//
// D01, decisión 3 (16/10/2026). Diseño:
// docs/plan-empresas/D01_BLINDAJE_PASSWORD_INICIAL_DISENO_2026-10-16.md
//
// Base desechable, solo loopback. Monta un esquema mínimo propio (auth.users
// con encrypted_password, membresias_usuario y perfiles reducidos a lo que
// hace falta para las pruebas) y aplica la migración real
// 20261016120000_plataforma_password_inicial_pendiente.sql. Después crea DOS
// funciones de permisos *equivalentes a modo de contrato* — no el texto
// exacto de producción — que representan los dos filtros compartidos reales
// (private.abc_tiene_capacidad, con 122 usos en 39 migraciones, y
// private.plataforma_kv_permitido, de F4/F4e) con la única línea nueva de
// este diseño añadida al principio. Sustituir el texto EXACTO de esas dos
// funciones de producción, con comprobación de huella previa, es el
// subpunto de migración siguiente, no este contrato.
//
// Comprueba que:
//   * con la fila pendiente, los dos filtros deniegan aunque el rol sea válido (T1, T5);
//   * un cambio REAL de auth.users.encrypted_password borra la fila sola (T2) y, a partir
//     de ahí, los filtros vuelven a decidir según el rol real (T3);
//   * mientras está pendiente, iniciar sesión, leer el perfil propio y consultar el estado
//     siguen disponibles, y el estado se lee de la tabla, no de user_metadata (T4);
//   * nadie puede leer ni escribir la tabla directamente (T6);
//   * no existe ningún camino público para consultar la cuenta de otra persona (T7);
//   * la cuenta de administrador de plataforma (sin fila pendiente) no se ve afectada (T8);
//   * una llamada sin fila pendiente para nadie se comporta exactamente como hoy (T9, regresión).
import pg from 'pg';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const url = new URL(process.env.PLATAFORMA_TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/plataforma_p01_test');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Solo se admiten bases de datos de loopback');
assert.equal(url.pathname, '/plataforma_p01_test', 'Solo se admite la base desechable plataforma_p01_test');

const M = (v, def) => process.env[v] || def;
const MIGRACION = M('PLATAFORMA_MIGRACION_PASSWORD_PENDIENTE', 'supabase/migrations/20261016120000_plataforma_password_inicial_pendiente.sql');
const sql = (p) => fs.readFileSync(p, 'utf8');

const U = (n) => `00000000-0000-4000-8000-0000000000${n}`;
const PROPIETARIO = U('a1');
const ENCARGADO = U('a2');
const ADMIN_PLATAFORMA = U('b1');
const OTRO_PROPIETARIO = U('c1');

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
async function fallo(promesa, { code, mensaje } = {}, etiqueta) {
  try {
    await promesa;
  } catch (e) {
    if (code) assert.equal(e.code, code, `${etiqueta}: código esperado ${code}, llegó ${e.code} (${e.message})`);
    if (mensaje) assert.ok(String(e.message).includes(mensaje), `${etiqueta}: mensaje esperado «${mensaje}», llegó «${e.message}»`);
    return;
  }
  assert.fail(`${etiqueta}: debía fallar y no falló`);
}

await admin.query(`
  drop schema if exists public cascade; drop schema if exists private cascade; drop schema if exists auth cascade;
  create schema public; create schema private; create schema auth;
  do $$begin
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  end$$;
  grant usage on schema public, private, auth to authenticated, anon;

  -- Esquema mínimo de auth.users: solo lo que esta migración necesita.
  create table auth.users (
    id uuid primary key,
    encrypted_password text
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('plataforma.actor', true), '')::uuid $$;

  -- Membresía y perfil reducidos: lo mínimo para que los dos filtros de
  -- contrato puedan decidir un rol.
  create table public.membresias_usuario (
    user_id uuid not null,
    empresa_id text not null,
    rol text not null,
    activo boolean not null default true,
    todos_locales boolean not null default true,
    local_id text,
    primary key (user_id, empresa_id)
  );
  create table public.perfiles (
    user_id uuid primary key references auth.users(id),
    rol text not null default 'Básico',
    activo boolean not null default true
  );
  alter table public.perfiles enable row level security;
  create policy perfiles_select_propio on public.perfiles for select to authenticated
    using (user_id = (select auth.uid()));
  grant select on public.perfiles to authenticated;
`);

// Aplica la migración real del diseño (tabla + disparador + 3 funciones).
await admin.query(sql(MIGRACION));

// Dos filtros de permisos *equivalentes a modo de contrato*, con la línea
// nueva del diseño al principio. Representan, de forma simplificada,
// private.abc_tiene_capacidad y private.plataforma_kv_permitido reales.
await admin.query(`
  create or replace function private.abc_tiene_capacidad(p_empresa_id text, p_local_id text, p_capacidad text)
  returns boolean
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
  begin
    if auth.uid() is null then return false; end if;
    if private.plataforma_debe_cambiar_password() then return false; end if;
    return exists (
      select 1 from public.membresias_usuario m
       where m.user_id = auth.uid() and m.empresa_id = p_empresa_id and m.activo = true
         and m.rol in ('Propietario', 'Encargado')
    );
  end;
  $$;
  revoke all on function private.abc_tiene_capacidad(text, text, text) from public, anon, authenticated;

  create or replace function private.plataforma_kv_permitido(p_empresa text, p_local text, p_key text, p_accion text)
  returns boolean
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
  begin
    if auth.uid() is null then return false; end if;
    if private.plataforma_debe_cambiar_password() then return false; end if;
    return exists (
      select 1 from public.membresias_usuario m
       where m.user_id = auth.uid() and m.empresa_id = p_empresa and m.activo = true
    );
  end;
  $$;
  revoke all on function private.plataforma_kv_permitido(text, text, text, text) from public, anon, authenticated;

  -- Envoltorios públicos mínimos para poder llamar los filtros desde un
  -- cliente 'authenticated' (en producción los llaman otras RPC públicas).
  create or replace function public.contrato_tiene_capacidad(p_empresa_id text, p_local_id text, p_capacidad text)
  returns boolean language sql stable security definer set search_path = '' as
    $$ select private.abc_tiene_capacidad(p_empresa_id, p_local_id, p_capacidad) $$;
  grant execute on function public.contrato_tiene_capacidad(text, text, text) to authenticated;

  create or replace function public.contrato_kv_permitido(p_empresa text, p_local text, p_key text, p_accion text)
  returns boolean language sql stable security definer set search_path = '' as
    $$ select private.plataforma_kv_permitido(p_empresa, p_local, p_key, p_accion) $$;
  grant execute on function public.contrato_kv_permitido(text, text, text, text) to authenticated;
`);

// Fixtures: un Propietario y un Encargado de la empresa E1, un administrador
// de plataforma sin membresía (igual que en producción: no pasa por
// plataforma_asignar_propietario) y otro Propietario de otra empresa.
await admin.query(`
  insert into auth.users (id, encrypted_password) values
    ('${PROPIETARIO}', 'hash-inicial-1'),
    ('${ENCARGADO}', 'hash-inicial-2'),
    ('${ADMIN_PLATAFORMA}', 'hash-admin'),
    ('${OTRO_PROPIETARIO}', 'hash-inicial-3');
  insert into public.perfiles (user_id, rol, activo) values
    ('${PROPIETARIO}', 'Propietario', true),
    ('${ENCARGADO}', 'Básico', true),
    ('${ADMIN_PLATAFORMA}', 'Básico', true),
    ('${OTRO_PROPIETARIO}', 'Propietario', true);
  insert into public.membresias_usuario (user_id, empresa_id, rol, activo) values
    ('${PROPIETARIO}', 'E1', 'Propietario', true),
    ('${ENCARGADO}', 'E1', 'Encargado', true),
    ('${OTRO_PROPIETARIO}', 'E2', 'Propietario', true);
`);

let fallos = 0;
function ok(etiqueta, cond) {
  if (cond) {
    console.log(`OK ${etiqueta}`);
  } else {
    fallos++;
    console.log(`FALLO ${etiqueta}`);
  }
}

// --- T1: con fila pendiente, abc_tiene_capacidad deniega aunque el rol sea válido ---
await admin.query('select private.plataforma_marcar_password_pendiente($1)', [PROPIETARIO]);
{
  const c = await como(PROPIETARIO);
  const r = await c.query('select public.contrato_tiene_capacidad($1,$2,$3) v', ['E1', 'L1', 'ABC_CAJA_OPERAR']);
  ok('T1 abc_tiene_capacidad deniega con fila pendiente (rol válido)', r.rows[0].v === false);
}

// --- T5: con fila pendiente, plataforma_kv_permitido también deniega ---
{
  const c = await como(PROPIETARIO);
  const r = await c.query('select public.contrato_kv_permitido($1,$2,$3,$4) v', ['E1', 'L1', 'productos', 'leer']);
  ok('T5 plataforma_kv_permitido deniega con fila pendiente', r.rows[0].v === false);
}

// --- T4: con fila pendiente, login/perfil propio/estado siguen disponibles ---
{
  const c = await como(PROPIETARIO);
  const perfil = await c.query('select rol from public.perfiles where user_id = $1', [PROPIETARIO]);
  const estado = await c.query('select public.plataforma_mi_estado_password() e');
  ok('T4a lee su propio perfil con fila pendiente', perfil.rows[0]?.rol === 'Propietario');
  ok('T4b plataforma_mi_estado_password responde pendiente=true', estado.rows[0].e.pendiente === true);
  ok('T4c plataforma_mi_estado_password responde ok=true', estado.rows[0].e.ok === true);
}

// --- T6: nadie puede leer ni escribir la tabla directamente ---
{
  const c = await como(PROPIETARIO);
  let paso;
  paso = true;
  await fallo(
    c.query('select * from private.plataforma_password_pendiente'),
    { code: '42501' },
    'T6a select directo a la tabla rechazado'
  ).catch(() => { paso = false; });
  ok('T6a select directo a la tabla rechazado (42501)', paso);
  paso = true;
  await fallo(
    c.query("insert into private.plataforma_password_pendiente(user_id) values ($1)", [ENCARGADO]),
    { code: '42501' },
    'T6b insert directo a la tabla rechazado'
  ).catch(() => { paso = false; });
  ok('T6b insert directo a la tabla rechazado (42501)', paso);
  paso = true;
  await fallo(
    c.query('select private.plataforma_debe_cambiar_password($1)', [PROPIETARIO]),
    { code: '42501' },
    'T6c llamar directamente a la función private rechazado'
  ).catch(() => { paso = false; });
  ok('T6c llamar directamente a la función private rechazado (42501)', paso);
}

// --- T7: no existe camino público para consultar la cuenta de otra persona ---
{
  const c = await como(ENCARGADO);
  // plataforma_mi_estado_password no acepta ningún parámetro: solo puede
  // informar de auth.uid(), nunca de un tercero.
  const estado = await c.query('select public.plataforma_mi_estado_password() e');
  ok('T7 un tercero solo ve su propio estado (no el del Propietario pendiente)', estado.rows[0].e.pendiente === false);
}

// --- T2: un cambio REAL de la contraseña borra la fila sola ---
await admin.query('update auth.users set encrypted_password = $2 where id = $1', [PROPIETARIO, 'hash-nuevo-1']);
{
  const pendiente = await admin.query('select 1 from private.plataforma_password_pendiente where user_id = $1', [PROPIETARIO]);
  ok('T2 la fila pendiente desaparece tras un cambio real de contraseña', pendiente.rowCount === 0);
}

// --- T3: tras T2, el filtro vuelve a decidir según el rol real ---
{
  const c = await como(PROPIETARIO);
  const r = await c.query('select public.contrato_tiene_capacidad($1,$2,$3) v', ['E1', 'L1', 'ABC_CAJA_OPERAR']);
  ok('T3 abc_tiene_capacidad vuelve a conceder tras el cambio real de contraseña', r.rows[0].v === true);
}

// Repite el ciclo con un valor idéntico (sin cambio real) para confirmar que
// no dispara el trigger si el hash no cambia de verdad.
await admin.query('select private.plataforma_marcar_password_pendiente($1)', [ENCARGADO]);
await admin.query('update auth.users set encrypted_password = encrypted_password where id = $1', [ENCARGADO]);
{
  const pendiente = await admin.query('select 1 from private.plataforma_password_pendiente where user_id = $1', [ENCARGADO]);
  ok('T2b un UPDATE sin cambio real de hash no borra la fila pendiente', pendiente.rowCount === 1);
}
// Limpieza para no interferir con T8/T9.
await admin.query('delete from private.plataforma_password_pendiente where user_id = $1', [ENCARGADO]);

// --- T8: el administrador de plataforma (sin fila pendiente, nunca pasó
//     por plataforma_asignar_propietario) no se ve afectado ---
{
  const c = await como(ADMIN_PLATAFORMA);
  const r = await c.query('select public.contrato_tiene_capacidad($1,$2,$3) v', ['E1', 'L1', 'ABC_CAJA_OPERAR']);
  // No es miembro de E1, así que deniega por falta de membresía, no por
  // contraseña pendiente: lo confirma el estado por separado.
  const estado = await c.query('select public.plataforma_mi_estado_password() e');
  ok('T8a el administrador de plataforma nunca tiene fila pendiente', estado.rows[0].e.pendiente === false);
  ok('T8b su denegación (si la hay) es por falta de membresía, no por contraseña', r.rows[0].v === false);
}

// --- T9: regresión — sin fila pendiente para nadie, el comportamiento es
//     exactamente el de antes de este diseño (rol decide, nada más) ---
{
  const cProp = await como(PROPIETARIO);
  const cEnc = await como(ENCARGADO);
  const rProp = await cProp.query('select public.contrato_tiene_capacidad($1,$2,$3) v', ['E1', 'L1', 'ABC_CAJA_OPERAR']);
  const rEnc = await cEnc.query('select public.contrato_tiene_capacidad($1,$2,$3) v', ['E1', 'L1', 'ABC_CAJA_OPERAR']);
  const rOtraEmpresa = await cProp.query('select public.contrato_tiene_capacidad($1,$2,$3) v', ['E2', 'L1', 'ABC_CAJA_OPERAR']);
  ok('T9a Propietario de E1 sin fila pendiente: concedido', rProp.rows[0].v === true);
  ok('T9b Encargado de E1 sin fila pendiente: concedido', rEnc.rows[0].v === true);
  ok('T9c Propietario de E1 sobre la empresa E2 (no es miembro): denegado', rOtraEmpresa.rows[0].v === false);
}

for (const c of clientes) await c.end().catch(() => {});
await admin.end();

console.log(`\nTOTAL: ${fallos === 0 ? 'PASS' : 'FAIL'} (${fallos} fallo(s))`);
process.exit(fallos === 0 ? 0 : 1);
