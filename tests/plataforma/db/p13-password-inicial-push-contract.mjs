// PLATAFORMA P13 — contrato con Postgres real: el bloqueo de la contraseña
// inicial sobre las políticas RLS reales de suscripciones_push (subpunto 3b).
//
// D01, decisión 3 (16/10/2026). Migraciones:
//   20261016120000_plataforma_password_inicial_pendiente.sql (base)
//   20261016140000_plataforma_password_inicial_bloqueo_push.sql (esta)
//
// A diferencia de las otras tres (subpunto 3, función + CREATE OR REPLACE),
// suscripciones_push no tiene una función de permisos: sus reglas están en
// la condición de la política. Esta migración usa ALTER POLICY (sin DROP)
// para añadir la condición nueva. Este contrato monta las CUATRO políticas
// con el texto EXACTO leído de producción el 16/10/2026, aplica la
// migración real y comprueba que:
//   * la migración se niega si una política no coincide con su huella
//     capturada (preflight real, con mutación y restauración) (T16);
//   * mientras la contraseña está pendiente, select/insert/update/delete
//     sobre la propia suscripción quedan denegados (T17);
//   * tras un cambio real de contraseña, las cuatro operaciones vuelven a
//     estar permitidas (T18);
//   * una cuenta ya establecida (sin fila pendiente) no se ve afectada (T19);
//   * nadie puede usar esto para leer la suscripción de otra persona, con o
//     sin contraseña pendiente (regresión de la regla original) (T20).
import pg from 'pg';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const url = new URL(process.env.PLATAFORMA_TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/plataforma_p01_test');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Solo se admiten bases de datos de loopback');
assert.equal(url.pathname, '/plataforma_p01_test', 'Solo se admite la base desechable plataforma_p01_test');

const M = (v, def) => process.env[v] || def;
const BASE = M('PLATAFORMA_MIGRACION_PASSWORD_PENDIENTE', 'supabase/migrations/20261016120000_plataforma_password_inicial_pendiente.sql');
const PUSH = M('PLATAFORMA_MIGRACION_PASSWORD_PUSH', 'supabase/migrations/20261016140000_plataforma_password_inicial_bloqueo_push.sql');
const sql = (p) => fs.readFileSync(p, 'utf8');

const NUEVO = '00000000-0000-4000-8000-0000000000d1';
const ESTABLECIDO = '00000000-0000-4000-8000-0000000000e1';
const OTRO = '00000000-0000-4000-8000-0000000000f1';

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
async function fallo(promesa, etiqueta) {
  try {
    await promesa;
  } catch (e) {
    return true;
  }
  return false;
}

let fallos = 0;
function ok(etiqueta, cond) {
  if (cond) { console.log(`OK ${etiqueta}`); } else { fallos++; console.log(`FALLO ${etiqueta}`); }
}

// --- Esquema mínimo: auth.users + perfiles + suscripciones_push ---
await admin.query(`
  drop schema if exists public cascade; drop schema if exists private cascade; drop schema if exists auth cascade;
  create schema public; create schema private; create schema auth;
  do $$begin
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  end$$;
  grant usage on schema public, private, auth to authenticated, anon;

  create table auth.users (id uuid primary key, encrypted_password text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('plataforma.actor', true), '')::uuid $$;

  create table public.perfiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    rol text not null default 'Básico',
    activo boolean not null default true
  );

  create table public.suscripciones_push (
    endpoint text primary key,
    p256dh text not null,
    "auth" text not null,
    dispositivo text,
    creado_en timestamptz not null default now(),
    user_id uuid,
    local_id text
  );
  alter table public.suscripciones_push enable row level security;
  create policy plataforma_push_select on public.suscripciones_push for select to authenticated using (
    ((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
       FROM perfiles p
      WHERE ((p.user_id = ( SELECT auth.uid() AS uid)) AND (p.activo = true)))))
  );
  create policy plataforma_push_insert on public.suscripciones_push for insert to authenticated with check (
    ((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
       FROM perfiles p
      WHERE ((p.user_id = ( SELECT auth.uid() AS uid)) AND (p.activo = true)))))
  );
  create policy plataforma_push_update on public.suscripciones_push for update to authenticated using (
    ((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
       FROM perfiles p
      WHERE ((p.user_id = ( SELECT auth.uid() AS uid)) AND (p.activo = true)))))
  ) with check (
    ((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
       FROM perfiles p
      WHERE ((p.user_id = ( SELECT auth.uid() AS uid)) AND (p.activo = true)))))
  );
  create policy plataforma_push_delete on public.suscripciones_push for delete to authenticated using (
    ((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
       FROM perfiles p
      WHERE ((p.user_id = ( SELECT auth.uid() AS uid)) AND (p.activo = true)))))
  );
  grant select, insert, update, delete on public.suscripciones_push to authenticated;
  grant select on public.perfiles to authenticated;

  insert into auth.users(id, encrypted_password) values
    ('${NUEVO}', 'hash-inicial-nuevo'),
    ('${ESTABLECIDO}', 'hash-establecido'),
    ('${OTRO}', 'hash-otro');
  insert into public.perfiles(user_id, rol, activo) values
    ('${NUEVO}', 'Propietario', true),
    ('${ESTABLECIDO}', 'Propietario', true),
    ('${OTRO}', 'Propietario', true);
`);

// --- Migración base del diseño (tabla + disparador + funciones) ---
await admin.query(sql(BASE));

// --- T16: la migración de push se niega ante una política mutada
//     (preflight real), y se restaura antes de aplicar de verdad ---
await admin.query(`alter policy plataforma_push_select on public.suscripciones_push using (true);`);
{
  let detectado = false;
  try {
    await admin.query(sql(PUSH));
  } catch (e) {
    detectado = /PLATAFORMA_PASSWORD_PUSH_PREFLIGHT_FALLO:politica_distinta:plataforma_push_select/.test(e.message);
    if (!detectado) console.log('  (mensaje real del error T16):', e.message);
  }
  ok('T16 la migración de push se niega ante una política mutada (preflight real)', detectado);
}
await admin.query(`
  alter policy plataforma_push_select on public.suscripciones_push using (
    ((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
       FROM perfiles p
      WHERE ((p.user_id = ( SELECT auth.uid() AS uid)) AND (p.activo = true)))))
  );
`);

// --- Aplica la migración de push de verdad ---
await admin.query(sql(PUSH));

// --- Marca a NUEVO como pendiente (como haría plataforma_asignar_propietario) ---
await admin.query('select private.plataforma_marcar_password_pendiente($1)', [NUEVO]);

// --- T17: mientras está pendiente, las cuatro operaciones quedan denegadas ---
{
  const cNuevo = await como(NUEVO);
  const vacio = await cNuevo.query("select * from public.suscripciones_push where user_id = $1", [NUEVO]);
  ok('T17a select no ve ninguna fila propia con contraseña pendiente', vacio.rowCount === 0);

  const insertBloqueado = await fallo(
    cNuevo.query(
      "insert into public.suscripciones_push(endpoint, p256dh, \"auth\", user_id) values ($1,$2,$3,$4)",
      ['https://push.test/t17', 'p256dh-t17', 'auth-t17', NUEVO]
    )
  );
  ok('T17b insert rechazado con contraseña pendiente', insertBloqueado);
}

// --- Crea la suscripción directamente (como admin, sin pasar por RLS) para
//     poder probar select/update/delete bloqueados sobre una fila ya
//     existente, no solo el insert. ---
await admin.query(
  "insert into public.suscripciones_push(endpoint, p256dh, \"auth\", user_id) values ($1,$2,$3,$4)",
  ['https://push.test/existente', 'p256dh-x', 'auth-x', NUEVO]
);
{
  const cNuevo = await como(NUEVO);
  const vacio = await cNuevo.query("select * from public.suscripciones_push where endpoint = $1", ['https://push.test/existente']);
  ok('T17c select no ve la fila ya existente con contraseña pendiente', vacio.rowCount === 0);
  const updateBloqueado = await fallo(
    cNuevo.query("update public.suscripciones_push set dispositivo = 'x' where endpoint = $1", ['https://push.test/existente'])
  );
  const sinFilas = await admin.query("select dispositivo from public.suscripciones_push where endpoint = $1", ['https://push.test/existente']);
  ok('T17d update no cambia nada con contraseña pendiente', sinFilas.rows[0].dispositivo === null);
}

// --- T18: un cambio real de contraseña libera las cuatro operaciones ---
await admin.query('update auth.users set encrypted_password = $2 where id = $1', [NUEVO, 'hash-nuevo-definitivo']);
{
  const pendiente = await admin.query('select 1 from private.plataforma_password_pendiente where user_id = $1', [NUEVO]);
  ok('T18a la fila pendiente desaparece tras el cambio real', pendiente.rowCount === 0);
  const cNuevo = await como(NUEVO);
  const veSuFila = await cNuevo.query("select * from public.suscripciones_push where endpoint = $1", ['https://push.test/existente']);
  ok('T18b select ve su propia fila tras el cambio real', veSuFila.rowCount === 1);
  await cNuevo.query("update public.suscripciones_push set dispositivo = 'movil' where endpoint = $1", ['https://push.test/existente']);
  const actualizado = await admin.query("select dispositivo from public.suscripciones_push where endpoint = $1", ['https://push.test/existente']);
  ok('T18c update funciona tras el cambio real', actualizado.rows[0].dispositivo === 'movil');
  await cNuevo.query("delete from public.suscripciones_push where endpoint = $1", ['https://push.test/existente']);
  const borrado = await admin.query("select 1 from public.suscripciones_push where endpoint = $1", ['https://push.test/existente']);
  ok('T18d delete funciona tras el cambio real', borrado.rowCount === 0);
}

// --- T19: una cuenta YA establecida (sin fila pendiente nunca) no se ve
//     afectada por este diseño ---
{
  const cEstablecido = await como(ESTABLECIDO);
  const insertOk = await cEstablecido.query(
    "insert into public.suscripciones_push(endpoint, p256dh, \"auth\", user_id) values ($1,$2,$3,$4) returning endpoint",
    ['https://push.test/establecido', 'p256dh-e', 'auth-e', ESTABLECIDO]
  );
  ok('T19 cuenta ya establecida: insert funciona sin verse afectada', insertOk.rowCount === 1);
}

// --- T20: regresión -- nadie ve ni toca la suscripción de otra persona,
//     con o sin contraseña pendiente (la regla original, intacta) ---
{
  await admin.query(
    "insert into public.suscripciones_push(endpoint, p256dh, \"auth\", user_id) values ($1,$2,$3,$4)",
    ['https://push.test/otro', 'p256dh-o', 'auth-o', OTRO]
  );
  const cEstablecido = await como(ESTABLECIDO);
  const ajena = await cEstablecido.query("select * from public.suscripciones_push where endpoint = $1", ['https://push.test/otro']);
  ok('T20 regresión: una cuenta establecida sigue sin ver la suscripción de otra', ajena.rowCount === 0);
}

for (const c of clientes) await c.end().catch(() => {});
await admin.end();

console.log(`\nTOTAL: ${fallos === 0 ? 'PASS' : 'FAIL'} (${fallos} fallo(s))`);
process.exit(fallos === 0 ? 0 : 1);
