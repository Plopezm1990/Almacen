/**
 * Validacion local de supabase/migrations/20261120120000_rediseno_org33_tarifas_horario.sql
 * ---------------------------------------------------------------------------
 * Levanta un PostgreSQL desechable en memoria (PGlite), monta los minimos del
 * entorno real que la migracion necesita -esquema auth, auth.uid(), locales,
 * catalogo_tpv_productos, la_tiene_local, abc_catalogo_puede_gestionar y el
 * trio de operaciones idempotentes- y aplica la migracion tal cual. No toca
 * ningun proyecto remoto.
 *
 *   node tests/rediseno/org33-tarifas-pglite-contract.mjs
 *
 * Por que existe: estas cuatro piezas (dos tablas y dos funciones) se crearon
 * a mano directamente en QA el 18/11/2026. El repositorio no sabia hacerlas, y
 * la pantalla de gestion de sala de org-33 las usaba igual. La migracion del
 * 20/11 las reconstruye desde un volcado de solo lectura de los catalogos del
 * sistema de QA.
 *
 * Una migracion reconstruida desde un volcado no se manda a QA "a ver que
 * pasa": en QA los objetos ya estan y el `create ... if not exists` no diria
 * nada, asi que un push verde no probaria absolutamente nada. Se prueba aqui,
 * contra un Postgres de verdad, donde las tablas no existen y por tanto se
 * crean y se ejercitan de cero.
 *
 * Lo que se fija, en una frase: la migracion se aplica sola y dos veces sin
 * cambiar nada, solo escribe quien puede gestionar el catalogo, las tarifas de
 * un mismo local no se solapan ni repiten nombre, un reintento con el mismo
 * operation_id no crea una segunda tarifa, y authenticated puede leer pero no
 * escribir.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const { PGlite } = await import(
  new URL('file://' + path.join(raiz, 'tests/f3/a09/node_modules/@electric-sql/pglite/dist/index.js').replace(/\\/g, '/'))
);

const MIGRACION = 'supabase/migrations/20261120120000_rediseno_org33_tarifas_horario.sql';
const sqlMigracion = await readFile(path.join(raiz, MIGRACION), 'utf8');

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
    check(nombre, msg.includes(fragmento), msg.slice(0, 160));
  }
}

async function sesion(uuid) {
  await db.exec(`select set_config('request.jwt.claim.sub', ${uuid === null ? "''" : `'${uuid}'`}, false);`);
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

  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  create table public.locales(
    empresa_id text not null,
    id         text not null,
    nombre     text not null,
    primary key (empresa_id, id)
  );

  create table public.catalogo_tpv_productos(
    empresa_id    text not null,
    local_id      text not null,
    producto_id   text not null,
    currency_code text not null,
    activo        boolean not null default true,
    primary key (empresa_id, local_id, producto_id, currency_code)
  );

  -- Quien puede VER: aqui, quien tenga sesion. El aislamiento por local de
  -- verdad lo decide la membresia, que no hace falta reproducir para fijar que
  -- la politica existe y que cuelga de esta funcion.
  create table public.qa_acceso_local(
    user_id uuid not null, empresa_id text not null, local_id text not null
  );
  create or replace function private.la_tiene_local(p_empresa text, p_local text)
  returns boolean language sql stable security definer set search_path to '' as $$
    select exists(
      select 1 from public.qa_acceso_local a
       where a.user_id=(select auth.uid()) and a.empresa_id=p_empresa and a.local_id=p_local
    );
  $$;

  -- Quien puede GESTIONAR el catalogo.
  create table public.qa_gestor_catalogo(
    user_id uuid not null, empresa_id text not null, local_id text not null
  );
  create or replace function private.abc_catalogo_puede_gestionar(p_empresa_id text, p_local_id text)
  returns boolean language sql stable security definer set search_path to '' as $$
    select exists(
      select 1 from public.qa_gestor_catalogo g
       where g.user_id=(select auth.uid()) and g.empresa_id=p_empresa_id and g.local_id=p_local_id
    );
  $$;

  -- El trio de operaciones idempotentes, con la forma justa que usan las dos
  -- funciones: iniciar devuelve {replayed, resultado} y completar guarda.
  create table public.qa_operaciones(
    operation_id text primary key,
    estado       text not null,
    resultado    jsonb
  );
  create or replace function private.abc_operacion_iniciar(
    p_operation_id text, p_empresa_id text, p_local_id text, p_tipo text,
    p_request jsonb, p_actor uuid
  ) returns jsonb language plpgsql security definer set search_path to '' as $$
  declare v public.qa_operaciones%rowtype;
  begin
    select * into v from public.qa_operaciones where operation_id=p_operation_id;
    if found and v.estado='completada' then
      return jsonb_build_object('replayed', true, 'resultado', v.resultado);
    end if;
    insert into public.qa_operaciones(operation_id, estado)
         values (p_operation_id, 'en_curso')
    on conflict (operation_id) do update set estado='en_curso';
    return jsonb_build_object('replayed', false);
  end $$;
  create or replace function private.abc_operacion_completar(p_operation_id text, p_resultado jsonb)
  returns void language sql security definer set search_path to '' as $$
    update public.qa_operaciones set estado='completada', resultado=p_resultado
     where operation_id=p_operation_id;
  $$;
  create or replace function private.abc_operacion_fallar(p_operation_id text, p_error jsonb)
  returns void language sql security definer set search_path to '' as $$
    update public.qa_operaciones set estado='fallida' where operation_id=p_operation_id;
  $$;
`);

/* --------------------------------------------- la migracion se aplica --- */

let aplicada = true;
try {
  await db.exec(sqlMigracion);
} catch (error) {
  aplicada = false;
  check('la migracion se aplica sobre un Postgres limpio', false, String(error && (error.message || error)).slice(0, 400));
}
if (aplicada) check('la migracion se aplica sobre un Postgres limpio', true);
if (!aplicada) {
  console.log('');
  console.log('ORG33_TARIFAS=FAIL (la migracion no se aplica; el resto no se puede comprobar)');
  await db.close();
  process.exit(1);
}

// Es de reconciliacion: en QA los objetos ya existen, asi que tiene que poder
// volver a pasar sin romper nada ni duplicar nada.
try {
  await db.exec(sqlMigracion);
  check('aplicarla dos veces no rompe nada (es de reconciliacion)', true);
} catch (error) {
  check('aplicarla dos veces no rompe nada (es de reconciliacion)', false,
    String(error && (error.message || error)).slice(0, 300));
}

/* ----------------------------------------- forma: RLS, permisos, llaves --- */

const rls = await db.query(`
  select c.relname, c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public'
     and c.relname in ('catalogo_tpv_tarifas_horario','catalogo_tpv_tarifa_precios')
   order by c.relname;
`);
check('RLS activada en las dos tablas',
  rls.rows.length === 2 && rls.rows.every((r) => r.relrowsecurity === true),
  JSON.stringify(rls.rows));

const politicas = await db.query(`
  select tablename, policyname, cmd from pg_policies
   where schemaname='public'
     and tablename in ('catalogo_tpv_tarifas_horario','catalogo_tpv_tarifa_precios')
   order by tablename;
`);
check('cada tabla tiene su unica politica, y es de solo lectura',
  politicas.rows.length === 2 && politicas.rows.every((r) => r.cmd === 'SELECT'),
  JSON.stringify(politicas.rows));

for (const tabla of ['catalogo_tpv_tarifas_horario', 'catalogo_tpv_tarifa_precios']) {
  const g = await db.query(`
    select has_table_privilege('authenticated', 'public.${tabla}', 'select') as auth_select,
           has_table_privilege('authenticated', 'public.${tabla}', 'insert') as auth_insert,
           has_table_privilege('authenticated', 'public.${tabla}', 'update') as auth_update,
           has_table_privilege('authenticated', 'public.${tabla}', 'delete') as auth_delete,
           has_table_privilege('anon',          'public.${tabla}', 'select') as anon_select,
           has_table_privilege('service_role',  'public.${tabla}', 'select') as srv_select;
  `);
  const r = g.rows[0];
  check(`${tabla}: authenticated lee`, r.auth_select === true, JSON.stringify(r));
  check(`${tabla}: authenticated no escribe`,
    r.auth_insert === false && r.auth_update === false && r.auth_delete === false, JSON.stringify(r));
  check(`${tabla}: ni anon ni service_role la alcanzan`,
    r.anon_select === false && r.srv_select === false, JSON.stringify(r));
}

const firmaHorario = 'public.abc_guardar_tarifa_horario(text,text,text,uuid,text,smallint[],time,time,boolean,text)';
const firmaPrecio = 'public.abc_guardar_tarifa_precio(text,text,text,uuid,text,text,numeric,boolean,text)';
for (const [etiqueta, firma] of [['tarifa_horario', firmaHorario], ['tarifa_precio', firmaPrecio]]) {
  const p = await db.query(`
    select has_function_privilege('authenticated', '${firma}', 'execute') as auth,
           has_function_privilege('anon',          '${firma}', 'execute') as anon,
           has_function_privilege('service_role',  '${firma}', 'execute') as srv;
  `);
  const r = p.rows[0];
  check(`abc_guardar_${etiqueta}: la llama authenticated y nadie mas`,
    r.auth === true && r.anon === false && r.srv === false, JSON.stringify(r));
}

const definer = await db.query(`
  select p.proname, p.prosecdef, p.proconfig
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in ('abc_guardar_tarifa_horario','abc_guardar_tarifa_precio')
   order by p.proname;
`);
check('las dos funciones son security definer con search_path vacio',
  definer.rows.length === 2
    && definer.rows.every((r) => r.prosecdef === true)
    && definer.rows.every((r) => String(r.proconfig).includes('search_path=')),
  JSON.stringify(definer.rows));

const nombreIdx = await db.query(`
  select indexdef from pg_indexes
   where schemaname='public' and indexname='abc_tarifa_horario_nombre_uq';
`);
check('el nombre de la tarifa es unico por local, sin mayusculas ni espacios',
  nombreIdx.rows.length === 1
    && /unique/i.test(nombreIdx.rows[0].indexdef)
    && /lower\(btrim\(nombre\)\)/.test(nombreIdx.rows[0].indexdef),
  JSON.stringify(nombreIdx.rows));

/* -------------------------------------------------------- datos de QA --- */

const U_GESTOR = '11111111-1111-4111-8111-111111111111';
const U_MIRON = '22222222-2222-4222-8222-222222222222';
const T1 = '33333333-3333-4333-8333-333333333333';
const T2 = '44444444-4444-4444-8444-444444444444';
const T3 = '55555555-5555-4555-8555-555555555555';

await db.exec(`
  insert into public.locales(empresa_id, id, nombre) values ('QA-EMP-A','QA-A1','Local de ensayo A1');
  insert into public.catalogo_tpv_productos(empresa_id, local_id, producto_id, currency_code, activo)
       values ('QA-EMP-A','QA-A1','CAFE','EUR', true),
              ('QA-EMP-A','QA-A1','RETIRADO','EUR', false);
  insert into public.qa_acceso_local(user_id, empresa_id, local_id)
       values ('${U_GESTOR}','QA-EMP-A','QA-A1'), ('${U_MIRON}','QA-EMP-A','QA-A1');
  insert into public.qa_gestor_catalogo(user_id, empresa_id, local_id)
       values ('${U_GESTOR}','QA-EMP-A','QA-A1');
`);

function llamadaHorario(op, tarifa, nombre, dias, ini, fin, activo, motivo) {
  const diasSql = dias === null ? 'null::smallint[]' : `array[${dias.join(',')}]::smallint[]`;
  const motivoSql = motivo === null ? 'null' : `'${motivo}'`;
  return `select public.abc_guardar_tarifa_horario(
    '${op}','QA-EMP-A','QA-A1','${tarifa}'::uuid,'${nombre}',${diasSql},
    '${ini}'::time,'${fin}'::time,${activo},${motivoSql}
  ) as r`;
}

function llamadaPrecio(op, tarifa, producto, moneda, precio, activo, motivo) {
  return `select public.abc_guardar_tarifa_precio(
    '${op}','QA-EMP-A','QA-A1','${tarifa}'::uuid,'${producto}','${moneda}',
    ${precio},${activo},${motivo === null ? 'null' : `'${motivo}'`}
  ) as r`;
}

/* ---------------------------------------------------------- quien puede --- */

await sesion(null);
await esperaError('sin sesion no se guarda una tarifa', 'abc_catalogo_no_autorizado',
  () => db.query(llamadaHorario('op.sin-sesion', T1, 'Manana', [1], '08:00', '12:00', true, 'ensayo')));

await sesion(U_MIRON);
await esperaError('quien solo mira no guarda una tarifa', 'abc_catalogo_no_autorizado',
  () => db.query(llamadaHorario('op.miron', T1, 'Manana', [1], '08:00', '12:00', true, 'ensayo')));
await esperaError('quien solo mira no guarda un precio', 'abc_catalogo_no_autorizado',
  () => db.query(llamadaPrecio('op.miron.precio', T1, 'CAFE', 'EUR', 1.5, true, 'ensayo')));

/* --------------------------------------------------- el camino que vale --- */

await sesion(U_GESTOR);

const alta = await db.query(llamadaHorario('op.alta.1', T1, 'Manana', [1, 2, 3, 4, 5], '08:00', '12:00', true, 'alta de ensayo'));
check('el gestor crea la tarifa, en version 1 y marcada como creada',
  alta.rows[0].r.ok === true && alta.rows[0].r.creado === true && String(alta.rows[0].r.version) === '1',
  JSON.stringify(alta.rows[0].r));

const reintento = await db.query(llamadaHorario('op.alta.1', T1, 'Manana', [1, 2, 3, 4, 5], '08:00', '12:00', true, 'alta de ensayo'));
check('un reintento con el mismo operation_id devuelve el mismo resultado',
  JSON.stringify(reintento.rows[0].r) === JSON.stringify(alta.rows[0].r),
  JSON.stringify(reintento.rows[0].r));

const cuantas = await db.query('select count(*)::int as n from public.catalogo_tpv_tarifas_horario');
check('y no crea una segunda tarifa', cuantas.rows[0].n === 1, JSON.stringify(cuantas.rows[0]));

const edicion = await db.query(llamadaHorario('op.edita.1', T1, 'Manana', [1, 2, 3, 4, 5], '08:00', '11:30', true, 'acorto la manana'));
check('editarla sube la version a 2 y ya no dice creada',
  edicion.rows[0].r.creado === false && String(edicion.rows[0].r.version) === '2',
  JSON.stringify(edicion.rows[0].r));

/* ------------------------------------------- lo que el servidor rechaza --- */

await esperaError('dos tarifas activas del mismo local no se solapan', 'tarifa_horario_solapada',
  () => db.query(llamadaHorario('op.solapa', T2, 'Solapada', [1], '10:00', '14:00', true, 'ensayo')));

const otroDia = await db.query(llamadaHorario('op.sabado', T2, 'Sabado', [6], '10:00', '14:00', true, 'ensayo'));
check('la misma hora en otro dia de la semana si entra', otroDia.rows[0].r.ok === true,
  JSON.stringify(otroDia.rows[0].r));

await esperaError('el nombre no se repite aunque cambien mayusculas y espacios', 'tarifa_horario_nombre_duplicado',
  () => db.query(llamadaHorario('op.dup', T3, '  manana  ', [7], '20:00', '22:00', true, 'ensayo')));

await esperaError('la hora de fin no puede ser anterior a la de inicio', 'tarifa_horario_rango_invalido',
  () => db.query(llamadaHorario('op.rango', T3, 'AlReves', [7], '14:00', '10:00', true, 'ensayo')));

await esperaError('no hay un dia 8 de la semana', 'tarifa_horario_dias_invalidos',
  () => db.query(llamadaHorario('op.dia8', T3, 'DiaOcho', [8], '10:00', '14:00', true, 'ensayo')));

await esperaError('una tarifa sin dias no vale', 'tarifa_horario_dias_invalidos',
  () => db.query(llamadaHorario('op.sindias', T3, 'SinDias', [], '10:00', '14:00', true, 'ensayo')));

await esperaError('todo cambio lleva motivo', 'tarifa_horario_motivo_requerido',
  () => db.query(llamadaHorario('op.sinmotivo', T3, 'SinMotivo', [7], '10:00', '14:00', true, null)));

await esperaError('un nombre vacio no vale', 'tarifa_horario_nombre_invalido',
  () => db.query(llamadaHorario('op.sinnombre', T3, '   ', [7], '10:00', '14:00', true, 'ensayo')));

/* ----------------------------------------------------- precios por tarifa --- */

const precio = await db.query(llamadaPrecio('op.precio.1', T1, 'CAFE', 'eur', 1.2, true, 'precio de ensayo'));
check('el precio se guarda y la moneda se normaliza a mayusculas',
  precio.rows[0].r.ok === true && precio.rows[0].r.currency_code === 'EUR'
    && String(precio.rows[0].r.version) === '1',
  JSON.stringify(precio.rows[0].r));

const precio2 = await db.query(llamadaPrecio('op.precio.2', T1, 'CAFE', 'EUR', 1.4, true, 'subo el cafe'));
check('cambiar el precio sube la version a 2',
  precio2.rows[0].r.creado === false && String(precio2.rows[0].r.version) === '2',
  JSON.stringify(precio2.rows[0].r));

await esperaError('un precio no puede ser negativo', 'tarifa_precio_valor_invalido',
  () => db.query(llamadaPrecio('op.precio.neg', T1, 'CAFE', 'EUR', -1, true, 'ensayo')));

await esperaError('la moneda tiene que ser un codigo de tres letras', 'tarifa_precio_moneda_invalida',
  () => db.query(llamadaPrecio('op.precio.moneda', T1, 'CAFE', 'EU', 1, true, 'ensayo')));

await esperaError('no se pone precio activo a un producto retirado', 'tarifa_precio_producto_no_disponible',
  () => db.query(llamadaPrecio('op.precio.retirado', T1, 'RETIRADO', 'EUR', 1, true, 'ensayo')));

const precioInactivo = await db.query(llamadaPrecio('op.precio.retirado.off', T1, 'RETIRADO', 'EUR', 1, false, 'lo dejo apagado'));
check('un precio apagado si se puede guardar sobre un producto retirado',
  precioInactivo.rows[0].r.ok === true, JSON.stringify(precioInactivo.rows[0].r));

await esperaError('no se pone precio a un producto que no existe', 'tarifa_precio_producto_no_encontrado',
  () => db.query(llamadaPrecio('op.precio.fantasma', T1, 'NO-EXISTE', 'EUR', 1, false, 'ensayo')));

await esperaError('no se pone precio a una tarifa que no existe', 'tarifa_precio_tarifa_no_disponible',
  () => db.query(llamadaPrecio('op.precio.sintarifa', T3, 'CAFE', 'EUR', 1, true, 'ensayo')));

await esperaError('un precio tambien lleva motivo', 'tarifa_precio_motivo_requerido',
  () => db.query(llamadaPrecio('op.precio.sinmotivo', T1, 'CAFE', 'EUR', 1, true, null)));

/* ------------------------------------------------- las llaves de verdad --- */

await esperaError('la base no acepta un precio colgado de una tarifa inexistente', 'abc_tarifa_precio_tarifa_fk',
  () => db.query(`
    insert into public.catalogo_tpv_tarifa_precios(
      empresa_id, local_id, tarifa_id, producto_id, currency_code, precio_unitario
    ) values ('QA-EMP-A','QA-A1','99999999-9999-4999-8999-999999999999'::uuid,'CAFE','EUR',1);
  `));

await esperaError('no se borra una tarifa que tiene precios colgados', 'abc_tarifa_precio_tarifa_fk',
  () => db.query(`delete from public.catalogo_tpv_tarifas_horario where id='${T1}'`));

await esperaError('no se cuela una tarifa en un local que no existe', 'abc_tarifa_horario_local_fk',
  () => db.query(`
    insert into public.catalogo_tpv_tarifas_horario(
      id, empresa_id, local_id, nombre, dias_semana, hora_inicio, hora_fin
    ) values (gen_random_uuid(),'QA-EMP-A','NO-EXISTE','X',array[1]::smallint[],'08:00','09:00');
  `));

/* --------------------------------------------- la politica deja ver y no --- */

await db.exec(`grant usage on schema public to authenticated;`);
await db.exec(`grant execute on function private.la_tiene_local(text,text) to authenticated;`);
await db.exec(`grant select on public.qa_acceso_local to authenticated;`);

async function cuantasVe(uuid) {
  await db.exec('begin');
  await db.exec(`select set_config('request.jwt.claim.sub', '${uuid}', true);`);
  await db.exec('set local role authenticated');
  const r = await db.query('select count(*)::int as n from public.catalogo_tpv_tarifas_horario');
  await db.exec('rollback');
  return r.rows[0].n;
}

try {
  const ve = await cuantasVe(U_MIRON);
  check('quien tiene el local ve sus tarifas', ve === 2, `ve ${ve}`);
  const ajeno = await cuantasVe('66666666-6666-4666-8666-666666666666');
  check('quien no tiene el local no ve ninguna', ajeno === 0, `ve ${ajeno}`);
} catch (error) {
  check('la politica de lectura se puede ejercitar como authenticated', false,
    String(error && (error.message || error)).slice(0, 200));
}

/* -------------------------------------------------------------- recuento --- */

console.log('');
console.log(`ORG33_TARIFAS_TOTAL=${resultados.length}`);
console.log(`ORG33_TARIFAS_PASS=${resultados.length - fallos}`);
console.log(`ORG33_TARIFAS_FAIL=${fallos}`);
console.log(fallos === 0 ? 'ORG33_TARIFAS=PASS' : 'ORG33_TARIFAS=FAIL');
await db.close();
process.exit(fallos === 0 ? 0 : 1);
