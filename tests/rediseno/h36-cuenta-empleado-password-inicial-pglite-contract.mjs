/**
 * Contrato PGlite de la migración
 *   supabase/migrations/20261128110000_abc_f6_cuenta_empleado_password_inicial_pendiente.sql
 *
 *   node tests/rediseno/h36-cuenta-empleado-password-inicial-pglite-contract.mjs
 *
 * Hallazgo H-36 (auditoría del TPV, 25/11/2026): las cuentas de empleado que crea la aplicación tienen una contraseña
 * inicial que fija quien las crea y no obligaban a cambiarla. El mecanismo servidor ya existía (lo usa el alta de
 * Propietario): `private.plataforma_password_pendiente`, el disparador que la desmarca al cambiar el hash, y el bloqueo de
 * capacidades mientras esté pendiente. Faltaba que el alta de empleado la marcara.
 *
 * Qué se fija:
 *   A. ANTES (texto original de la función, leído de la migración que la definió por última vez): crear una cuenta de
 *      empleado NO deja ninguna marca de contraseña pendiente.
 *   B. DESPUÉS: la cuenta nueva queda marcada (motivo `alta_empleado`) en la misma transacción que crea membresía y
 *      perfil; si el alta falla, no queda marca; la rama «ya creada» NO vuelve a marcar (una cuenta que ya cambió su
 *      contraseña no se vuelve a bloquear al repetir la llamada); al cambiar la contraseña la marca desaparece.
 *   C. La migración parchea la definición viva, es idempotente y falla en voz alta si falta una pieza.
 *   D. Estático: las dos funciones Edge de alta de empleado crean la cuenta a través de esa función de servidor.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const { PGlite } = await import(
  new URL('file://' + path.join(raiz, 'tests/f3/a09/node_modules/@electric-sql/pglite/dist/index.js').replace(/\\/g, '/'))
);
const MIG = await readFile(path.join(raiz, 'supabase/migrations/20261128110000_abc_f6_cuenta_empleado_password_inicial_pendiente.sql'), 'utf8');
const ORIGEN = await readFile(path.join(raiz, 'supabase/migrations/20260922180000_p2_sec_pm11_finalize_account_dependency.sql'), 'utf8');
const PASSWORD = await readFile(path.join(raiz, 'supabase/migrations/20261016120000_plataforma_password_inicial_pendiente.sql'), 'utf8');

const ini = ORIGEN.indexOf('CREATE OR REPLACE FUNCTION public.pm11_finalizar_creacion_cuenta_empleado(');
const finTxt = '$function$;';
const fin = ORIGEN.indexOf(finTxt, ini);
if (ini < 0 || fin < 0) throw new Error('No se encontró la función original en la migración 20260922180000');
const FUNCION_ORIGINAL = ORIGEN.slice(ini, fin + finTxt.length);

// El disparador y las funciones de la marca se copian de la migración real (no se reescriben aquí).
function trozo(texto, desde, hasta) {
  const a = texto.indexOf(desde);
  const b = texto.indexOf(hasta, a);
  if (a < 0 || b < 0) throw new Error('No se encontró ' + desde);
  return texto.slice(a, b + hasta.length);
}
const FUNCION_MARCAR = trozo(PASSWORD, 'create or replace function private.plataforma_marcar_password_pendiente(', '$$;');
const FUNCION_DISPARADOR = trozo(PASSWORD, 'create or replace function private.plataforma_password_cambiada_trg()', '$$;');

let fallos = 0;
function check(nombre, ok, detalle = '') {
  if (!ok) fallos++;
  console.log(`${ok ? '[OK]  ' : '[FAIL]'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}
async function intenta(db, sql) {
  try { return { ok: true, filas: (await db.query(sql)).rows }; }
  catch (e) { return { ok: false, error: String(e && (e.message || e)) }; }
}

const ACTOR = '11111111-1111-4111-8111-111111111111';
const NUEVO = '22222222-2222-4222-8222-222222222222';
const OTRO = '33333333-3333-4333-8333-333333333333';
const E = 'E1', L = 'L1';

const ANDAMIO = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth; create schema private;
  create table auth.users (id uuid primary key, encrypted_password text);
  create table public.empleados (id text primary key, empresa_id text, local_id text, estado text);
  create table public.perfiles (user_id uuid primary key, rol text, nombre text, empleado_id text, activo boolean);
  create table public.membresias_usuario (id serial primary key, user_id uuid, empresa_id text, local_id text, todos_locales boolean, rol text, activo boolean);
  create table public.auditoria_registro (id text primary key, fecha date, datos jsonb, empresa_id text, local_id text, actor_user_id uuid);
  create function private.pm11_local_activo(e text, l text) returns boolean language sql stable as $$ select true $$;

  -- Tabla y funciones de la marca, tal como las define la migración 20261016120000.
  create table private.plataforma_password_pendiente (
    user_id uuid primary key references auth.users(id) on delete cascade,
    creado_en timestamptz not null default now(),
    motivo text not null default 'alta_propietario');
  ${FUNCION_MARCAR}
  ${FUNCION_DISPARADOR}
  create trigger plataforma_password_cambiada_trg after update of encrypted_password on auth.users
    for each row when (new.encrypted_password is distinct from old.encrypted_password)
    execute function private.plataforma_password_cambiada_trg();

  insert into auth.users(id, encrypted_password) values ('${ACTOR}', 'h-actor'), ('${NUEVO}', 'h-inicial'), ('${OTRO}', 'h-otro');
  insert into public.perfiles(user_id, rol, nombre, activo) values ('${ACTOR}', 'Propietario', 'Propietario', true);
  insert into public.membresias_usuario(user_id, empresa_id, local_id, todos_locales, rol, activo) values ('${ACTOR}', '${E}', null, true, 'Propietario', true);
  insert into public.empleados(id, empresa_id, local_id, estado) values ('EMP1', '${E}', '${L}', 'activo'), ('EMP2', '${E}', '${L}', 'activo');

  ${FUNCION_ORIGINAL}
  revoke all on function public.pm11_finalizar_creacion_cuenta_empleado(uuid,uuid,text,text,text,text,text) from public, anon, authenticated, service_role;
  grant execute on function public.pm11_finalizar_creacion_cuenta_empleado(uuid,uuid,text,text,text,text,text) to service_role;
`;

async function base(conMigracion) {
  const db = new PGlite();
  await db.exec(ANDAMIO);
  if (conMigracion) await db.exec(MIG);
  return db;
}
const alta = (db, { actor = ACTOR, user = NUEVO, empleado = 'EMP1', rol = 'Cajero/a' } = {}) =>
  intenta(db, `select public.pm11_finalizar_creacion_cuenta_empleado('${actor}'::uuid, '${user}'::uuid, '${E}', '${L}', '${empleado}', 'Ana', '${rol}') r`);
const pendientes = async (db) => (await db.query(`select user_id, motivo from private.plataforma_password_pendiente order by 1`)).rows;

// ---------- A: antes ----------
{
  const db = await base(false);
  const r = await alta(db);
  check('A1 ANTES: el alta de empleado se completa', r.ok && r.filas[0].r.ok === true && r.filas[0].r.yaCreada === false, r.error || '');
  check('A2 ANTES: ...y NO deja ninguna marca de contraseña pendiente (la cuenta entra sin cambiar la contraseña)', (await pendientes(db)).length === 0);
}

// ---------- B: después ----------
{
  const db = await base(true);
  const r = await alta(db);
  const p = await pendientes(db);
  check('B1 DESPUÉS: el alta se completa y crea membresía y perfil', r.ok && r.filas[0].r.ok === true
    && Number((await db.query(`select count(*) c from public.membresias_usuario where user_id='${NUEVO}'`)).rows[0].c) === 1
    && Number((await db.query(`select count(*) c from public.perfiles where user_id='${NUEVO}'`)).rows[0].c) === 1, r.error || '');
  check('B2 la cuenta nueva queda con la contraseña inicial pendiente (motivo alta_empleado)', p.length === 1 && p[0].user_id === NUEVO && p[0].motivo === 'alta_empleado', JSON.stringify(p));

  // La rama «ya creada» no vuelve a marcar: la persona ya cambió su contraseña (el disparador desmarca al cambiar el hash).
  await db.exec(`update auth.users set encrypted_password = 'h-elegida-por-la-persona' where id = '${NUEVO}'`);
  check('B3 al cambiar la contraseña la marca desaparece', (await pendientes(db)).length === 0);
  const otra = await alta(db);
  check('B4 repetir la llamada devuelve «ya creada» y NO la vuelve a bloquear', otra.ok && otra.filas[0].r.yaCreada === true && (await pendientes(db)).length === 0, otra.error || JSON.stringify(await pendientes(db)));

  // Un alta que falla no deja marca (misma transacción).
  const noAutorizado = await alta(db, { actor: OTRO, user: NUEVO, empleado: 'EMP2' });
  check('B5 un alta rechazada (actor sin permiso) falla y no deja marca', !noAutorizado.ok && /cuenta_creacion_no_autorizada/.test(noAutorizado.error || '') && (await pendientes(db)).length === 0, noAutorizado.error || '');
  const rolMalo = await alta(db, { user: OTRO, empleado: 'EMP2', rol: 'Propietario' });
  check('B6 un rol no permitido falla y no deja marca', !rolMalo.ok && /cuenta_rol_no_permitido/.test(rolMalo.error || '') && (await pendientes(db)).length === 0, rolMalo.error || '');

  // Dos empleados distintos: cada cuenta nueva queda marcada por separado.
  const e2 = await alta(db, { user: OTRO, empleado: 'EMP2', rol: 'Encargado' });
  const p2 = await pendientes(db);
  check('B7 otra cuenta nueva (Encargado) también queda marcada, sin afectar a las demás', e2.ok && p2.length === 1 && p2[0].user_id === OTRO && p2[0].motivo === 'alta_empleado', e2.error || JSON.stringify(p2));
}

// ---------- C: migración ----------
{
  const db = await base(true);
  const otra = await intenta(db, MIG);
  check('C1 la migración es idempotente (segunda ejecución sin error)', otra.ok, otra.error || '');
  const def = (await db.query(`select pg_get_functiondef('public.pm11_finalizar_creacion_cuenta_empleado(uuid,uuid,text,text,text,text,text)'::regprocedure) d`)).rows[0].d;
  check('C2 la marca aparece una sola vez tras aplicarla dos veces', (def.match(/plataforma_marcar_password_pendiente/g) || []).length === 1);
  check('C3 conserva SECURITY DEFINER y sigue sin ser ejecutable por authenticated ni anon',
    /SECURITY DEFINER/.test(def)
    && !(await db.query(`select has_function_privilege('authenticated','public.pm11_finalizar_creacion_cuenta_empleado(uuid,uuid,text,text,text,text,text)','EXECUTE') v`)).rows[0].v
    && !(await db.query(`select has_function_privilege('anon','public.pm11_finalizar_creacion_cuenta_empleado(uuid,uuid,text,text,text,text,text)','EXECUTE') v`)).rows[0].v
    && (await db.query(`select has_function_privilege('service_role','public.pm11_finalizar_creacion_cuenta_empleado(uuid,uuid,text,text,text,text,text)','EXECUTE') v`)).rows[0].v);

  const sinDependencia = new PGlite();
  await sinDependencia.exec(ANDAMIO + '\n drop function private.plataforma_marcar_password_pendiente(uuid);');
  const r1 = await intenta(sinDependencia, MIG);
  check('C4 sin la función que marca, falla en voz alta', !r1.ok && /DEPENDENCIA_OBLIGATORIA_NO_ENCONTRADA/.test(r1.error || ''), r1.error || 'no falló');
  const sinFuncion = new PGlite();
  await sinFuncion.exec(ANDAMIO + '\n drop function public.pm11_finalizar_creacion_cuenta_empleado(uuid,uuid,text,text,text,text,text);');
  const r2 = await intenta(sinFuncion, MIG);
  check('C5 sin la función de alta, falla en voz alta', !r2.ok && /FUNCION_OBLIGATORIA_NO_ENCONTRADA/.test(r2.error || ''), r2.error || 'no falló');
  const otraForma = new PGlite();
  await otraForma.exec(ANDAMIO.replace(FUNCION_ORIGINAL, FUNCION_ORIGINAL.replace('v_audit_id := gen_random_uuid()::text;', 'v_audit_id := md5(random()::text);')));
  const r3 = await intenta(otraForma, MIG);
  check('C6 si la función tiene otra forma, falla en voz alta y no la toca', !r3.ok && /ESTRUCTURA_NO_ENCONTRADA/.test(r3.error || ''), r3.error || 'no falló');
}

// ---------- D: las funciones Edge de alta usan esa función de servidor ----------
{
  for (const f of ['crear-cuenta-empleado', 'qa-crear-empleado']) {
    const t = await readFile(path.join(raiz, `supabase/functions/${f}/index.ts`), 'utf8');
    check(`D ${f} crea la cuenta a través de pm11_finalizar_creacion_cuenta_empleado`, /rpc\(\s*"pm11_finalizar_creacion_cuenta_empleado"/.test(t));
  }
  const arranque = await readFile(path.join(raiz, 'owner-bootstrap-post-reset.js'), 'utf8');
  check('D3 la pantalla «Elige tu contraseña» se decide por el servidor para cualquier sesión (no solo Propietarios)', /plat\.sigueDebiendoCambiar\(supabase, sesion\)/.test(arranque));
}

console.log(fallos === 0 ? 'H36_CUENTA_EMPLEADO_PASSWORD_INICIAL_CONTRACT=PASS' : `H36_CUENTA_EMPLEADO_PASSWORD_INICIAL_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
