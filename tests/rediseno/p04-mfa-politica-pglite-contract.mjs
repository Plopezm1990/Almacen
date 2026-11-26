/**
 * Validacion local de supabase/migrations/20261115120000_mfa_politica_opcional.sql
 * ---------------------------------------------------------------------------
 * Levanta un PostgreSQL desechable en memoria (PGlite), monta los minimos del
 * entorno real que la migracion necesita -esquema auth, auth.uid(), auth.jwt(),
 * membresias_usuario, perfiles y empleados-, deja una la_usuario_activo() con
 * la forma de M-03 y aplica la migracion tal cual. No toca ningun proyecto
 * remoto.
 *
 *   node tests/rediseno/p04-mfa-politica-pglite-contract.mjs
 *
 * Por que existe: el encargo del 15/11/2026 es que el segundo factor sea
 * VOLUNTARIO y que el propietario conserve la palanca para exigirlo. Eso toca
 * `private.la_usuario_activo()`, que es la guarda maestra del RLS de todo el
 * programa: si devuelve false, esa sesion no es usuario activo para nada. Una
 * migracion asi no se manda a QA "a ver que pasa", y yo no puedo aplicarla -la
 * CLI del propietario apunta a produccion-. Asi que se prueba aqui, contra un
 * Postgres de verdad, antes de que la toque nadie.
 *
 * Lo que se fija, en una frase: sin politica no se exige a nadie; con politica
 * se exige solo a los cargos marcados de esa empresa; y solo un Propietario
 * puede cambiarla.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const { PGlite } = await import(
  new URL('file://' + path.join(raiz, 'tests/f3/a09/node_modules/@electric-sql/pglite/dist/index.js').replace(/\\/g, '/'))
);

const db = new PGlite();
let fallos = 0;
const resultados = [];

function check(nombre, ok, detalle = '') {
  resultados.push({ nombre, ok: !!ok, detalle });
  if (!ok) fallos++;
  console.log(`${ok ? '[OK]  ' : '[FAIL]'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}

async function esperaError(nombre, fragmento, fn) {
  try {
    await fn();
    check(nombre, false, 'no lanzo ningun error');
  } catch (error) {
    const msg = String(error && (error.message || error));
    check(nombre, msg.includes(fragmento), msg.slice(0, 140));
  }
}

/** Fija quien mira y con que nivel de garantia viene su JWT. */
async function sesion(uuid, aal) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${uuid}', false);`);
  await db.exec(`select set_config('request.jwt.claim.aal', '${aal}', false);`);
}

async function activo() {
  const r = await db.query('select private.la_usuario_activo() as v');
  return r.rows[0].v;
}

/* ------------------------------------------------- entorno minimo real --- */

await db.exec(`
  create schema if not exists auth;
  create schema if not exists private;
  do $$ begin
    if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  end $$;

  create table auth.users(id uuid primary key);

  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  -- auth.jwt() del entorno real devuelve el token como jsonb; aqui basta con
  -- que lleve el 'aal', que es lo unico que mira la guarda.
  create or replace function auth.jwt() returns jsonb language sql stable as $$
    select jsonb_build_object('aal', coalesce(nullif(current_setting('request.jwt.claim.aal', true), ''), 'aal1'));
  $$;

  create table public.membresias_usuario(
    id         bigserial primary key,
    user_id    uuid not null references auth.users(id),
    empresa_id text not null,
    local_id   text,
    rol        text not null,
    activo     boolean not null default true
  );

  create table public.empleados(
    id     text primary key,
    estado text not null default 'activo'
  );

  create table public.perfiles(
    user_id     uuid primary key references auth.users(id),
    empleado_id text references public.empleados(id),
    rol         text,
    activo      boolean not null default true
  );
`);

// La guarda tal y como la dejo M-03: tres cargos con aal2 obligatorio.
await db.exec(`
  create or replace function private.la_usuario_activo()
  returns boolean language sql stable security definer set search_path to ''
  as $function$
    select (select auth.uid()) is not null
       and exists(select 1 from public.membresias_usuario m
                   where m.user_id=(select auth.uid()) and m.activo=true)
       and (
         not exists(select 1 from public.membresias_usuario m
                     where m.user_id=(select auth.uid()) and m.activo=true
                       and m.rol in ('Propietario', 'Encargado', 'Cajero/a'))
         or coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
       );
  $function$;
`);

const DUENA = '11111111-1111-1111-1111-111111111111';
const CAJERA = '22222222-2222-2222-2222-222222222222';
const CAMARERA = '33333333-3333-3333-3333-333333333333';
const DUENA_B = '44444444-4444-4444-4444-444444444444';

await db.exec(`
  insert into auth.users(id) values ('${DUENA}'),('${CAJERA}'),('${CAMARERA}'),('${DUENA_B}');
  insert into public.empleados(id,estado) values ('emp-1','activo');
  insert into public.perfiles(user_id,empleado_id,rol,activo) values
    ('${DUENA}','emp-1','Propietario',true),
    ('${CAJERA}','emp-1','Cajero/a',true),
    ('${CAMARERA}','emp-1','Camarero/a',true),
    ('${DUENA_B}','emp-1','Propietario',true);
  insert into public.membresias_usuario(user_id,empresa_id,local_id,rol,activo) values
    ('${DUENA}','QA-EMP-A','QA-A1','Propietario',true),
    ('${CAJERA}','QA-EMP-A','QA-A1','Cajero/a',true),
    ('${CAMARERA}','QA-EMP-A','QA-A1','Camarero/a',true),
    ('${DUENA_B}','QA-EMP-B','QA-B1','Propietario',true);
`);

/* ------------------------------------- antes de migrar: lo de M-03 --- */

await sesion(DUENA, 'aal1');
check('antes de migrar, la propietaria sin aal2 NO es usuario activo', (await activo()) === false,
  'es la conducta de M-03 que se viene a cambiar');

/* --------------------------------------------- se aplica la migracion --- */

const sql = await readFile(path.join(raiz, 'supabase/migrations/20261115120000_mfa_politica_opcional.sql'), 'utf8');
try {
  await db.exec(sql);
  check('la migracion se aplica entera', true);
} catch (error) {
  check('la migracion se aplica entera', false, String(error && (error.message || error)).slice(0, 200));
}

/* ------------------------------------------ por defecto: nadie obligado --- */

await sesion(DUENA, 'aal1');
check('sin politica, la propietaria sin aal2 SI es usuario activo', (await activo()) === true,
  'es el encargo: voluntario por defecto');

await sesion(CAJERA, 'aal1');
check('sin politica, la cajera sin aal2 SI es usuario activo', (await activo()) === true);

await sesion(CAMARERA, 'aal1');
check('sin politica, la camarera sin aal2 SI es usuario activo', (await activo()) === true);

/* ------------------------------------------- con politica: se exige --- */

await db.exec(`insert into private.mfa_politica(empresa_id,rol,exigida) values ('QA-EMP-A','Propietario',true);`);

await sesion(DUENA, 'aal1');
check('con politica puesta, la propietaria sin aal2 NO es usuario activo', (await activo()) === false);

await sesion(DUENA, 'aal2');
check('con politica puesta, la propietaria con aal2 SI es usuario activo', (await activo()) === true);

await sesion(CAJERA, 'aal1');
check('la politica del Propietario no afecta a la cajera', (await activo()) === true);

await sesion(DUENA_B, 'aal1');
check('la politica de una empresa no afecta a la propietaria de otra', (await activo()) === true,
  'QA-EMP-B no tiene politica');

/* ----------------------------------------- exigida = false no obliga --- */

await db.exec(`update private.mfa_politica set exigida=false where empresa_id='QA-EMP-A' and rol='Propietario';`);
await sesion(DUENA, 'aal1');
check('una fila con exigida=false no obliga', (await activo()) === true);

/* ------------------------------------------------------- la API --- */

await sesion(DUENA, 'aal1');
let r = await db.query('select public.mfa_politica_leer() as v');
check('leer: la propietaria se reconoce como propietaria', r.rows[0].v.es_propietario === true,
  JSON.stringify(r.rows[0].v).slice(0, 120));
check('leer: sin exigencia, exigida_para_mi es false', r.rows[0].v.exigida_para_mi === false);
check('leer: la propietaria ve la politica de su empresa', Array.isArray(r.rows[0].v.politica) && r.rows[0].v.politica.length === 1);

await sesion(CAMARERA, 'aal1');
r = await db.query('select public.mfa_politica_leer() as v');
check('leer: quien no es propietaria no ve la politica', r.rows[0].v.es_propietario === false && r.rows[0].v.politica.length === 0,
  'no se filtra la politica de la empresa a quien no la gobierna');

/* --------------------------------------------- guardar: solo la dueña --- */

await sesion(DUENA, 'aal1');
await db.query(`select public.mfa_politica_guardar('Cajero/a', true)`);
await sesion(CAJERA, 'aal1');
check('la dueña puede exigir el segundo factor a un cargo', (await activo()) === false,
  'la cajera pasa a necesitar aal2');
await sesion(CAJERA, 'aal2');
check('y con aal2 la cajera vuelve a entrar', (await activo()) === true);

await sesion(CAJERA, 'aal2');
await esperaError('quien no es propietaria no puede cambiar la politica', 'Solo un Propietario',
  () => db.query(`select public.mfa_politica_guardar('Camarero/a', true)`));

await sesion(DUENA, 'aal1');
await esperaError('un cargo inventado se rechaza', 'Cargo no reconocido',
  () => db.query(`select public.mfa_politica_guardar('Pirata', true)`));
await esperaError('un cargo vacio se rechaza', 'Indica el cargo',
  () => db.query(`select public.mfa_politica_guardar('   ', true)`));

/* ------------------------------------- la dueña puede quitarla otra vez --- */

await sesion(DUENA, 'aal1');
await db.query(`select public.mfa_politica_guardar('Cajero/a', false)`);
await sesion(CAJERA, 'aal1');
check('la dueña puede volver a dejarlo voluntario', (await activo()) === true);

/* ------------------------------------------------ sin sesion, nada --- */

await db.exec(`select set_config('request.jwt.claim.sub', '', false);`);
await esperaError('sin sesion, leer la politica exige sesion', 'Sesión requerida',
  () => db.query('select public.mfa_politica_leer()'));
await esperaError('sin sesion, guardar la politica exige sesion', 'Sesión requerida',
  () => db.query(`select public.mfa_politica_guardar('Cajero/a', true)`));

/* ------------------------------------------------ permisos de la API --- */

const permisos = await db.query(`
  select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon,
         has_function_privilege('authenticated', p.oid, 'execute') as auth
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='public' and p.proname in ('mfa_politica_leer','mfa_politica_guardar')
   order by p.proname;
`);
check('la API no es alcanzable por anon', permisos.rows.every((x) => x.anon === false),
  JSON.stringify(permisos.rows));
check('la API si es alcanzable por authenticated', permisos.rows.every((x) => x.auth === true));
check('se publican las dos funciones de la API', permisos.rows.length === 2);

const guarda = await db.query(`
  select has_function_privilege('authenticated', 'private.la_usuario_activo()', 'execute') as auth;
`);
check('la guarda maestra sigue sin ser invocable por authenticated', guarda.rows[0].auth === false,
  'M-03 la revoco y aqui no se devuelve');

console.log('');
console.log(`MFA_POLITICA_TOTAL=${resultados.length}`);
console.log(`MFA_POLITICA_PASS=${resultados.length - fallos}`);
console.log(`MFA_POLITICA_FAIL=${fallos}`);
console.log(fallos === 0 ? 'MFA_POLITICA=PASS' : 'MFA_POLITICA=FAIL');
await db.close();
process.exit(fallos === 0 ? 0 : 1);
