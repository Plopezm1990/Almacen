/**
 * Validacion local de supabase/migrations/20261113090000_rediseno_apariencia_empresa.sql
 * ---------------------------------------------------------------------------
 * Levanta un PostgreSQL desechable en memoria (PGlite), monta los minimos que
 * la migracion necesita del entorno real (esquema auth, auth.uid(), roles y
 * public.membresias_usuario), aplica la migracion tal cual y comprueba su
 * comportamiento. No toca ningun proyecto remoto.
 *
 *   node docs/rediseno/validar-apariencia-local.mjs
 *
 * PGlite se toma de tests/f3/a09/node_modules (npm ci --prefix tests/f3/a09).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
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

async function comoUsuario(uuid, sql, params) {
  await db.query(`set local role none`).catch(() => {});
  await db.exec(`select set_config('request.jwt.claim.sub', '${uuid}', false);`);
  return db.query(sql, params);
}

async function esperaError(nombre, codigoEsperado, fn) {
  try {
    await fn();
    check(nombre, false, 'no lanzo ningun error');
  } catch (error) {
    const msg = String(error && (error.message || error));
    check(nombre, msg.includes(codigoEsperado), msg.slice(0, 120));
  }
}

/* ------------------------------------------------- entorno minimo real --- */

await db.exec(`
  create schema if not exists auth;
  create schema if not exists private;
  do $$ begin
    if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
  end $$;

  create table auth.users(id uuid primary key);

  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  create table public.membresias_usuario(
    id            bigserial primary key,
    user_id       uuid not null references auth.users(id),
    empresa_id    text not null,
    local_id      text,
    todos_locales boolean not null default false,
    rol           text not null,
    activo        boolean not null default true
  );
`);

const DUENA   = '11111111-1111-1111-1111-111111111111';
const ENCARG  = '22222222-2222-2222-2222-222222222222';
const CAMARER = '33333333-3333-3333-3333-333333333333';
const AJENA   = '44444444-4444-4444-4444-444444444444';

await db.exec(`
  insert into auth.users(id) values
    ('${DUENA}'),('${ENCARG}'),('${CAMARER}'),('${AJENA}');
  insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo) values
    ('${DUENA}','QA-EMP-A',null,true,'Propietario',true),
    ('${ENCARG}','QA-EMP-A','QA-A1',false,'Encargado',true),
    ('${CAMARER}','QA-EMP-A','QA-A1',false,'Camarero/a',true),
    ('${AJENA}','QA-EMP-B',null,true,'Propietario',true);
`);

/* ------------------------------------------------------ la migracion ----- */

const MIGRACIONES = [
  '20261113090000_rediseno_apariencia_empresa.sql',
  '20261113140000_rediseno_apariencia_delegaciones.sql'
];
for (const nombre of MIGRACIONES) {
  const sql = await readFile(path.join(raiz, 'supabase/migrations', nombre), 'utf8');
  try {
    await db.exec(sql);
    check(`se aplica ${nombre.slice(0, 15)} sin errores`, true);
  } catch (error) {
    check(`se aplica ${nombre.slice(0, 15)} sin errores`, false, String(error.message || error).slice(0, 220));
    process.exit(1);
  }
}

/* ------------------------------------------------------- comprobaciones -- */

// 1. Sin configuracion previa, leer devuelve existe=false y el permiso real.
let r = await comoUsuario(DUENA, `select public.abc_apariencia_leer('QA-EMP-A') as d`);
check('sin configuracion, leer devuelve existe=false',
  r.rows[0].d.ok === true && r.rows[0].d.existe === false && r.rows[0].d.puede_aplicar === true);

// 2. Un usuario de otra empresa no puede ni leer.
await esperaError('un usuario de otra empresa no puede leer', 'apariencia_no_autorizada',
  () => comoUsuario(AJENA, `select public.abc_apariencia_leer('QA-EMP-A')`));

// 3. El propietario aplica: revision 1, actor del servidor.
r = await comoUsuario(DUENA, `select public.abc_apariencia_guardar('QA-EMP-A', null, 'pase', null, null) as d`);
check('el propietario aplica y crea la revision 1',
  r.rows[0].d.revision === 1 && r.rows[0].d.diseno === 'pase' && r.rows[0].d.actualizado_por === DUENA,
  'rev ' + r.rows[0].d.revision);

// 4. Un camarero SIN delegacion es rechazado por el servidor.
await esperaError('un cargo sin delegacion no puede aplicar', 'apariencia_no_autorizada',
  () => comoUsuario(CAMARER, `select public.abc_apariencia_guardar('QA-EMP-A', 1, 'oliva', null, null)`));

// 5. Tampoco puede restaurar.
await esperaError('un cargo sin delegacion no puede restaurar', 'apariencia_no_autorizada',
  () => comoUsuario(CAMARER, `select public.abc_apariencia_restaurar('QA-EMP-A', 1)`));

// 6. Una revision antigua se rechaza en el servidor.
r = await comoUsuario(DUENA, `select public.abc_apariencia_guardar('QA-EMP-A', 1, 'sello', 'bosque', null) as d`);
check('segundo guardado correcto crea la revision 2',
  r.rows[0].d.revision === 2 && r.rows[0].d.diseno === 'sello' && r.rows[0].d.paleta === 'bosque');
await esperaError('una revision antigua se rechaza', 'apariencia_revision_obsoleta',
  () => comoUsuario(DUENA, `select public.abc_apariencia_guardar('QA-EMP-A', 1, 'claro', null, null)`));
await esperaError('guardar sin revision sobre una existente se rechaza', 'apariencia_revision_obsoleta',
  () => comoUsuario(DUENA, `select public.abc_apariencia_guardar('QA-EMP-A', null, 'claro', null, null)`));

// 7. La revision anterior se conserva para poder restaurar.
r = await comoUsuario(DUENA, `select public.abc_apariencia_leer('QA-EMP-A') as d`);
check('la revision 2 conserva la anterior',
  r.rows[0].d.anterior && r.rows[0].d.anterior.diseno === 'pase' && r.rows[0].d.anterior.revision === 1);

// 8. Restaurar recupera el disenno anterior creando revision nueva.
r = await comoUsuario(DUENA, `select public.abc_apariencia_restaurar('QA-EMP-A', 2) as d`);
check('restaurar recupera el disenno anterior como revision 3',
  r.rows[0].d.diseno === 'pase' && r.rows[0].d.revision === 3,
  r.rows[0].d.diseno + ' rev ' + r.rows[0].d.revision);
await esperaError('restaurar con revision antigua se rechaza', 'apariencia_revision_obsoleta',
  () => comoUsuario(DUENA, `select public.abc_apariencia_restaurar('QA-EMP-A', 2)`));

// 9. Validaciones de contenido.
await esperaError('un disenno no registrado se rechaza', 'apariencia_diseno_no_registrado',
  () => comoUsuario(DUENA, `select public.abc_apariencia_guardar('QA-EMP-A', 3, 'inexistente', null, null)`));
await esperaError('unos colores incompletos se rechazan', 'apariencia_colores_invalidos',
  () => comoUsuario(DUENA, `select public.abc_apariencia_guardar('QA-EMP-A', 3, 'oliva', null, '{"fondo":"#FFFFFF"}'::jsonb)`));
await esperaError('un HEX invalido se rechaza', 'apariencia_colores_invalidos',
  () => comoUsuario(DUENA, `select public.abc_apariencia_guardar('QA-EMP-A', 3, 'oliva', null,
    '{"fondo":"#FFFFFF","tarjetas":"#FFFFFF","texto":"#000000","enlaces":"#123456","boton":"#123456","detalle":"rojo"}'::jsonb)`));
// Un `null` de JSON es un valor invalido, no una ausencia de paleta.
await esperaError('un solo null de JSON entre los seis se rechaza', 'apariencia_colores_invalidos',
  () => comoUsuario(DUENA, `select public.abc_apariencia_guardar('QA-EMP-A', 3, 'oliva', null,
    '{"fondo":"#FFFFFF","tarjetas":"#FFFFFF","texto":"#000000","enlaces":"#123456","boton":"#123456","detalle":null}'::jsonb)`));
await esperaError('los seis null de JSON se rechazan', 'apariencia_colores_invalidos',
  () => comoUsuario(DUENA, `select public.abc_apariencia_guardar('QA-EMP-A', 3, 'oliva', null,
    '{"fondo":null,"tarjetas":null,"texto":null,"enlaces":null,"boton":null,"detalle":null}'::jsonb)`));
await esperaError('un valor que no es cadena se rechaza', 'apariencia_colores_invalidos',
  () => comoUsuario(DUENA, `select public.abc_apariencia_guardar('QA-EMP-A', 3, 'oliva', null,
    '{"fondo":"#FFFFFF","tarjetas":"#FFFFFF","texto":"#000000","enlaces":"#123456","boton":123456,"detalle":"#FDBA74"}'::jsonb)`));
// La ausencia de paleta propia es el NULL de SQL, y si se acepta.
{
  const r0 = await comoUsuario(DUENA, `select private.abc_apariencia_colores_validos(null) as v`);
  const r1 = await comoUsuario(DUENA, `select private.abc_apariencia_colores_validos('null'::jsonb) as v`);
  const r2 = await comoUsuario(DUENA, `select private.abc_apariencia_colores_validos(
    '{"fondo":null,"tarjetas":null,"texto":null,"enlaces":null,"boton":null,"detalle":null}'::jsonb) as v`);
  check('el NULL de SQL se acepta como ausencia de paleta', r0.rows[0].v === true, String(r0.rows[0].v));
  check('el null de JSON no cuenta como ausencia', r1.rows[0].v === false, String(r1.rows[0].v));
  check('seis null de JSON devuelven false, no NULL', r2.rows[0].v === false, String(r2.rows[0].v));
}
r = await comoUsuario(DUENA, `select public.abc_apariencia_guardar('QA-EMP-A', 3, 'oliva', null,
  '{"fondo":"#FFF7ED","tarjetas":"#FFE4C7","texto":"#7F1D1D","enlaces":"#F97316","boton":"#DC2626","detalle":"#FDBA74"}'::jsonb) as d`);
check('seis HEX validos se aceptan', r.rows[0].d.revision === 4 && r.rows[0].d.colores.boton === '#DC2626');

// 10. La delegacion se concede y se retira desde el contrato, no a mano.
{
  const sinPermiso = await esperaError('un cargo no puede listar las delegaciones', 'apariencia_no_autorizada',
    () => comoUsuario(ENCARG, `select public.abc_apariencia_listar_delegaciones('QA-EMP-A')`));
  await esperaError('un cargo no puede delegarse a si mismo', 'apariencia_no_autorizada',
    () => comoUsuario(ENCARG, `select public.abc_apariencia_delegar('QA-EMP-A','Encargado')`));
  await esperaError('no se delega un cargo inexistente', 'apariencia_rol_inexistente',
    () => comoUsuario(DUENA, `select public.abc_apariencia_delegar('QA-EMP-A','Sumiller')`));
  await esperaError('no se delega el propio cargo de propietario', 'apariencia_rol_no_delegable',
    () => comoUsuario(DUENA, `select public.abc_apariencia_delegar('QA-EMP-A','Propietario')`));

  let r10 = await comoUsuario(DUENA, `select public.abc_apariencia_listar_delegaciones('QA-EMP-A') as d`);
  check('el propietario ve los cargos delegables de su empresa',
    JSON.stringify(r10.rows[0].d.cargos) === JSON.stringify(['Camarero/a', 'Encargado']),
    JSON.stringify(r10.rows[0].d.cargos));

  r10 = await comoUsuario(DUENA, `select public.abc_apariencia_delegar('QA-EMP-A','Encargado') as d`);
  check('delegar deja la fila y devuelve la lista',
    r10.rows[0].d.delegaciones.length === 1 && r10.rows[0].d.delegaciones[0].rol === 'Encargado');

  r10 = await comoUsuario(DUENA, `select public.abc_apariencia_delegar('QA-EMP-A','Encargado') as d`);
  check('delegar dos veces no duplica', r10.rows[0].d.delegaciones.length === 1);
  const ev = await db.query(`select count(*)::int as n from public.apariencia_delegacion_eventos
                              where empresa_id='QA-EMP-A' and accion='ALTA'`);
  check('el evento de alta se registra una sola vez', ev.rows[0].n === 1, ev.rows[0].n + ' eventos');
}
r = await comoUsuario(ENCARG, `select public.abc_apariencia_guardar('QA-EMP-A', 4, 'claro', null, null) as d`);
check('un cargo delegado si puede aplicar',
  r.rows[0].d.revision === 5 && r.rows[0].d.actualizado_por === ENCARG);
await esperaError('la delegacion no alcanza a otros cargos', 'apariencia_no_autorizada',
  () => comoUsuario(CAMARER, `select public.abc_apariencia_guardar('QA-EMP-A', 5, 'pulso', null, null)`));

// 10 bis. Retirar la delegacion devuelve al cargo a su situacion anterior.
{
  const r = await comoUsuario(DUENA, `select public.abc_apariencia_retirar_delegacion('QA-EMP-A','Encargado') as d`);
  check('retirar la delegacion vacia la lista', r.rows[0].d.delegaciones.length === 0);
  await esperaError('tras retirarla, el cargo vuelve a ser rechazado', 'apariencia_no_autorizada',
    () => comoUsuario(ENCARG, `select public.abc_apariencia_guardar('QA-EMP-A', 5, 'patio', null, null)`));
  const ev = await db.query(`select accion from public.apariencia_delegacion_eventos
                              where empresa_id='QA-EMP-A' order by id`);
  check('los eventos registran alta y baja',
    ev.rows.map(x => x.accion).join(',') === 'ALTA,BAJA', ev.rows.map(x => x.accion).join(','));
  const r2 = await comoUsuario(DUENA, `select public.abc_apariencia_retirar_delegacion('QA-EMP-A','Encargado') as d`);
  check('retirar dos veces no annade otro evento', r2.rows[0].d.delegaciones.length === 0);
  const ev2 = await db.query(`select count(*)::int as n from public.apariencia_delegacion_eventos where empresa_id='QA-EMP-A'`);
  check('el registro de eventos sigue teniendo dos filas', ev2.rows[0].n === 2, ev2.rows[0].n + ' filas');
}

// 11. Aislamiento entre empresas.
r = await comoUsuario(AJENA, `select public.abc_apariencia_guardar('QA-EMP-B', null, 'orbita', null, null) as d`);
check('cada empresa tiene su propia configuracion', r.rows[0].d.revision === 1 && r.rows[0].d.diseno === 'orbita');
r = await comoUsuario(DUENA, `select public.abc_apariencia_leer('QA-EMP-A') as d`);
check('la empresa A no se ve afectada por la B', r.rows[0].d.diseno === 'claro' && r.rows[0].d.revision === 5);

// 12. Historial completo con actor.
r = await db.query(`select revision, diseno, accion, actor_user_id from public.apariencia_revisiones
                    where empresa_id='QA-EMP-A' order by revision`);
check('el historial guarda una fila por revision con su actor',
  r.rows.length === 5 && r.rows[2].accion === 'RESTAURAR' && r.rows[4].actor_user_id === ENCARG,
  r.rows.map(x => x.revision + ':' + x.diseno + ':' + x.accion).join(' '));

// 13. Las tablas no son accesibles directamente desde el navegador.
r = await db.query(`
  select count(*)::int as n from information_schema.role_table_grants
   where table_schema='public'
     and table_name in ('apariencia_empresa','apariencia_revisiones','apariencia_delegaciones')
     and grantee in ('anon','authenticated')`);
check('las tablas no tienen permisos para anon ni authenticated', r.rows[0].n === 0, r.rows[0].n + ' permisos');
r = await db.query(`
  select bool_and(relrowsecurity) as rls from pg_class
   where relname in ('apariencia_empresa','apariencia_revisiones','apariencia_delegaciones')`);
check('las tres tablas tienen RLS activada', r.rows[0].rls === true);
r = await db.query(`
  select count(*)::int as n from information_schema.role_routine_grants
   where routine_schema='public' and grantee='authenticated'
     and routine_name in ('abc_apariencia_leer','abc_apariencia_guardar','abc_apariencia_restaurar')`);
check('los tres RPC si estan concedidos a authenticated', r.rows[0].n === 3, r.rows[0].n + ' de 3');

// 10 ter. Dos membresias en la misma empresa: basta con que UNA este delegada.
// El orden de `abc_apariencia_rol` devuelve aqui 'Encargado' (id mas alto), de
// modo que decidir por un solo cargo denegaria el permiso teniendolo.
{
  const DOBLE = '55555555-5555-5555-5555-555555555555';
  await db.exec(`
    insert into auth.users(id) values ('${DOBLE}');
    insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo) values
      ('${DOBLE}','QA-EMP-A','QA-A2',false,'Camarero/a',true),
      ('${DOBLE}','QA-EMP-A','QA-A1',false,'Encargado',true);`);
  let r = await comoUsuario(DOBLE, `select private.abc_apariencia_rol('QA-EMP-A') as rol`);
  check('con dos membresias, el cargo mostrado es uno solo', r.rows[0].rol === 'Encargado', r.rows[0].rol);
  await comoUsuario(DUENA, `select public.abc_apariencia_retirar_delegacion('QA-EMP-A','Encargado')`);
  await comoUsuario(DUENA, `select public.abc_apariencia_delegar('QA-EMP-A','Camarero/a')`);
  r = await comoUsuario(DOBLE, `select private.abc_apariencia_puede_aplicar('QA-EMP-A') as v`);
  check('basta con que una de sus membresias este delegada', r.rows[0].v === true, String(r.rows[0].v));
  const rev = await comoUsuario(DUENA, `select public.abc_apariencia_leer('QA-EMP-A') as d`);
  r = await comoUsuario(DOBLE, `select public.abc_apariencia_guardar('QA-EMP-A', ${rev.rows[0].d.revision}, 'patio', null, null) as d`);
  check('y puede aplicar de verdad', r.rows[0].d.diseno === 'patio' && r.rows[0].d.actualizado_por === DOBLE);
  await comoUsuario(DUENA, `select public.abc_apariencia_retirar_delegacion('QA-EMP-A','Camarero/a')`);
  r = await comoUsuario(DOBLE, `select private.abc_apariencia_puede_aplicar('QA-EMP-A') as v`);
  check('al retirar la unica delegacion, vuelve a no poder', r.rows[0].v === false, String(r.rows[0].v));
  await db.exec(`delete from public.membresias_usuario where user_id='${DOBLE}';`);
  await comoUsuario(DUENA, `select public.abc_apariencia_delegar('QA-EMP-A','Encargado')`);
}

// 14. Sin sesion no se puede leer.
await db.exec(`select set_config('request.jwt.claim.sub', '', false);`);
await esperaError('sin sesion no se puede leer', 'apariencia_no_autorizada',
  () => db.query(`select public.abc_apariencia_leer('QA-EMP-A')`));

console.log('');
console.log(`APARIENCIA_LOCAL_TOTAL=${resultados.length}`);
console.log(`APARIENCIA_LOCAL_PASS=${resultados.length - fallos}`);
console.log(`APARIENCIA_LOCAL_FAIL=${fallos}`);
console.log(fallos === 0 ? 'APARIENCIA_LOCAL=PASS' : 'APARIENCIA_LOCAL=FAIL');
await db.close();
process.exit(fallos === 0 ? 0 : 1);
