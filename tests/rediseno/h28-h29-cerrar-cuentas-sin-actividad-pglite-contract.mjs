/**
 * Contrato PGlite de la migración
 *   supabase/migrations/20261128140000_abc_f6_cerrar_cuentas_sin_actividad.sql
 *
 *   node tests/rediseno/h28-h29-cerrar-cuentas-sin-actividad-pglite-contract.mjs
 *
 * Hallazgos H-28 (cuentas abiertas de días ya cerrados que nadie cierra) y H-29 (una recarga a mitad de «Guardar pedido» deja una cuenta sin pedido).
 *
 * Qué se fija:
 *   1. Cierra la cuenta ABIERTA sin actividad: de un día operativo ya cerrado, o sin ningún pedido ni cobro y con más de N minutos; cancela sus checkouts y la foto
 *      fiscal; deja el evento CUENTA_CERRADA_SIN_ACTIVIDAD y devuelve el recuento.
 *   2. NO cierra, y las cuenta como omitidas: con un pedido vivo (aunque sea de un día cerrado), con dinero en juego (pago confirmado, pendiente, autorizado, desconocido o
 *      reembolsado, checkout completado, incidencia abierta), con una venta fiscal que no es la foto del cobro, con un reparto o una cuota vivos, ni las del día actual que
 *      aún no han agotado el tiempo o que ya tuvieron pedido.
 *   3. Solo Propietario y Encargado de ese local; no toca otra empresa o local; repetir la operación no duplica nada; el mínimo de minutos es 15.
 *   4. Es SECURITY DEFINER con search_path vacío y solo la ejecuta `authenticated`.
 *
 * El esquema es un andamio con las columnas que usa la función y sustitutos de las funciones privadas.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const { PGlite } = await import(
  new URL('file://' + path.join(raiz, 'tests/f3/a09/node_modules/@electric-sql/pglite/dist/index.js').replace(/\\/g, '/'))
);
const MIG = await readFile(path.join(raiz, 'supabase/migrations/20261128140000_abc_f6_cerrar_cuentas_sin_actividad.sql'), 'utf8');

let fallos = 0;
function check(nombre, ok, detalle = '') {
  if (!ok) fallos++;
  console.log(`${ok ? '[OK]  ' : '[FAIL]'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}
async function intenta(db, sql) {
  try { return { ok: true, filas: (await db.query(sql)).rows }; }
  catch (e) { return { ok: false, error: String(e && (e.message || e)) }; }
}

const ANDAMIO = `
  create role anon; create role authenticated;
  create schema if not exists private; create schema if not exists auth;
  create table public.ajustes (clave text primary key, valor text);
  insert into public.ajustes values ('puede_gestionar','true'), ('dia','2026-11-27');
  create function auth.uid() returns uuid language sql stable as $$ select '11111111-1111-4111-8111-111111111111'::uuid $$;
  create function private.la_tiene_local(e text, l text) returns boolean language sql stable as $$ select e = 'E1' and l = 'L1' $$;
  create function private.pm06_puede_gestionar_finanzas() returns boolean language sql stable as $$ select valor = 'true' from public.ajustes where clave = 'puede_gestionar' $$;
  create function private.abc_config_dia_evento(e text, l text) returns date language sql stable as $$ select valor::date from public.ajustes where clave = 'dia' $$;
  create table public.abc_operaciones (operation_id text primary key, empresa_id text, local_id text, command_type text, request jsonb, resultado jsonb);
  create function private.abc_operacion_iniciar(op text, e text, l text, tipo text, req jsonb, term uuid) returns jsonb language plpgsql as $$
  declare x public.abc_operaciones%rowtype;
  begin
    select * into x from public.abc_operaciones where operation_id = op;
    if found then
      if x.command_type <> upper(tipo) or x.request <> req then raise exception 'operation_id_conflict'; end if;
      return jsonb_build_object('ok', true, 'replayed', true, 'resultado', x.resultado);
    end if;
    insert into public.abc_operaciones(operation_id, empresa_id, local_id, command_type, request) values (op, e, l, upper(tipo), req);
    return jsonb_build_object('ok', true, 'replayed', false);
  end $$;
  create function private.abc_operacion_completar(op text, r jsonb) returns void language sql as $$ update public.abc_operaciones set resultado = r where operation_id = op $$;

  create table public.cuentas_comerciales (id uuid primary key, empresa_id text, local_id text, estado text, version bigint default 1, closed_at timestamptz, opened_operating_day date, created_at timestamptz default now());
  create table public.pedidos_tpv (id uuid primary key, empresa_id text, local_id text, cuenta_id uuid, estado text);
  create table public.pedido_lineas (id uuid primary key, empresa_id text, local_id text, pedido_id uuid);
  create table public.checkouts (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, cuenta_id uuid, estado text, version bigint default 1, cancelled_at timestamptz);
  create table public.pagos (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, checkout_id uuid, estado text);
  create table public.pago_intentos (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, pago_id uuid);
  create table public.abc_cobro_incidencias (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, intento_id uuid, estado text);
  create table public.ventas_fiscales (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, cuenta_id uuid, estado text, version bigint default 1, locked_at timestamptz);
  create table public.checkout_ventas (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, checkout_id uuid, venta_fiscal_id uuid);
  create table public.cuenta_linea_repartos (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, source_line_id uuid, cuenta_id uuid, estado text);
  create table public.cuenta_cuotas_importe (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, cuenta_origen_id uuid, cuenta_destino_id uuid, estado text);
  create table public.abc_eventos (id bigserial primary key, empresa_id text, local_id text, operation_id text, aggregate_type text, aggregate_id text, event_type text, payload jsonb, actor_user_id uuid, terminal_id uuid, occurred_at timestamptz, operating_day date);
`;

const E = 'E1', L = 'L1';
let n = 0;
const id = () => `40000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
let op = 0;
const nuevaOp = () => `op-${++op}`;
const HOY = '2026-11-27', AYER = '2026-11-26';

async function base() {
  const db = new PGlite();
  await db.exec(ANDAMIO);
  await db.exec(MIG);
  return db;
}
// Cuenta ABIERTA con las piezas que se pidan. `dia`: día operativo de apertura; `minutos`: antigüedad.
async function cuenta(db, { dia = AYER, minutos = 600, pedido = null, checkout = null, pagos = [], incidencia = null, venta = null, reparto = null, cuota = null, empresa = E, local = L } = {}) {
  const c = id();
  await db.exec(`insert into public.cuentas_comerciales(id,empresa_id,local_id,estado,opened_operating_day,created_at) values ('${c}','${empresa}','${local}','ABIERTA','${dia}', now() - interval '${minutos} minutes')`);
  let p = null, k = null, v = null;
  if (pedido) {
    p = id();
    await db.exec(`insert into public.pedidos_tpv(id,empresa_id,local_id,cuenta_id,estado) values ('${p}','${empresa}','${local}','${c}','${pedido}')`);
    await db.exec(`insert into public.pedido_lineas(id,empresa_id,local_id,pedido_id) values ('${id()}','${empresa}','${local}','${p}')`);
  }
  if (checkout) {
    k = id();
    await db.exec(`insert into public.checkouts(id,empresa_id,local_id,cuenta_id,estado) values ('${k}','${empresa}','${local}','${c}','${checkout}')`);
    for (const e of pagos) {
      const g = id(), t = id();
      await db.exec(`insert into public.pagos(id,empresa_id,local_id,checkout_id,estado) values ('${g}','${empresa}','${local}','${k}','${e}')`);
      await db.exec(`insert into public.pago_intentos(id,empresa_id,local_id,pago_id) values ('${t}','${empresa}','${local}','${g}')`);
      if (incidencia) await db.exec(`insert into public.abc_cobro_incidencias(empresa_id,local_id,intento_id,estado) values ('${empresa}','${local}','${t}','${incidencia}')`);
    }
  }
  if (venta) {
    v = id();
    await db.exec(`insert into public.ventas_fiscales(id,empresa_id,local_id,cuenta_id,estado,locked_at) values ('${v}','${empresa}','${local}','${c}','${venta.estado}',${venta.bloqueada ? 'now()' : 'null'})`);
    if (venta.enlazada !== false && k) await db.exec(`insert into public.checkout_ventas(empresa_id,local_id,checkout_id,venta_fiscal_id) values ('${empresa}','${local}','${k}','${v}')`);
  }
  if (reparto) await db.exec(`insert into public.cuenta_linea_repartos(empresa_id,local_id,source_line_id,cuenta_id,estado) values ('${empresa}','${local}','${id()}','${c}','${reparto}')`);
  if (cuota) await db.exec(`insert into public.cuenta_cuotas_importe(empresa_id,local_id,cuenta_origen_id,cuenta_destino_id,estado) values ('${empresa}','${local}','${c}','${id()}','${cuota}')`);
  return { c, p, k, v };
}
const limpiar = (db, { operacion = nuevaOp(), minutos = null, empresa = E, local = L } = {}) =>
  intenta(db, `select public.abc_cerrar_cuentas_sin_actividad('${operacion}','${empresa}','${local}'${minutos == null ? '' : ',' + minutos}) r`);
const estado = async (db, c) => (await db.query(`select estado, version, closed_at is not null cerrada from public.cuentas_comerciales where id='${c}'`)).rows[0];
const eventos = async (db, c) => (await db.query(`select payload->>'motivo' motivo from public.abc_eventos where aggregate_id='${c}' and event_type='CUENTA_CERRADA_SIN_ACTIVIDAD'`)).rows;

// ---------- A. Cierra las que están sin actividad ----------
{
  const db = await base();
  const a = await cuenta(db);                                                                              // ayer, sin nada (H-29 de un día cerrado)
  const b = await cuenta(db, { pedido: 'CANCELADO', checkout: 'EN_COBRO', pagos: ['RECHAZADO'], venta: { estado: 'ABIERTA' } }); // ayer: caso H-49
  const c = await cuenta(db, { dia: HOY, minutos: 90 });                                                    // hoy, sin pedido ni cobro, 90 min (H-29)
  const d = await cuenta(db, { pedido: 'CANCELADO' });                                                      // ayer, pedido cancelado, sin cobro
  const r = await limpiar(db);
  const res = r.filas?.[0]?.r;
  check('A1 cierra las 4 cuentas sin actividad y lo dice', r.ok && res.cerradas === 4 && res.omitidas === 0 && res.dia_operativo === HOY, JSON.stringify(res || r.error));
  const ea = await estado(db, a.c);
  check('A2 la cuenta queda CERRADA con fecha de cierre y versión +1', ea.estado === 'CERRADA' && ea.cerrada === true && Number(ea.version) === 2, JSON.stringify(ea));
  check('A3 cada cierre deja su evento con el motivo (día cerrado / sin pedido)', (await eventos(db, a.c))[0]?.motivo === 'DIA_OPERATIVO_CERRADO' && (await eventos(db, c.c))[0]?.motivo === 'SIN_PEDIDO' && (await eventos(db, b.c)).length === 1 && (await eventos(db, d.c)).length === 1);
  const kb = (await db.query(`select estado, version, cancelled_at is not null cancelado from public.checkouts where id='${b.k}'`)).rows[0];
  const vb = (await db.query(`select estado, version from public.ventas_fiscales where id='${b.v}'`)).rows[0];
  check('A4 al cerrar la cuenta del caso H-49 se cancelan su checkout y la foto fiscal (versión +1) y el pago rechazado queda', kb.estado === 'CANCELADO' && kb.cancelado && Number(kb.version) === 2 && vb.estado === 'CANCELADA' && Number(vb.version) === 2 && (await db.query(`select estado from public.pagos where checkout_id='${b.k}'`)).rows[0].estado === 'RECHAZADO');
  check('A5 la lista de cuentas cerradas es la devuelta', JSON.stringify([...res.cuentas].sort()) === JSON.stringify([a.c, b.c, c.c, d.c].sort()));
  await db.close();
}

// ---------- B. No cierra lo que no debe ----------
{
  const db = await base();
  const casos = [];
  const quiere = async (nombre, args, esperado = 'ABIERTA') => { const x = await cuenta(db, args); casos.push({ nombre, x, esperado }); };
  await quiere('B1 con un pedido vivo (ENVIADO) aunque sea de un día cerrado', { pedido: 'ENVIADO' });
  await quiere('B2 con un pedido ABIERTO', { pedido: 'ABIERTO' });
  await quiere('B3 con un pago CONFIRMADO', { pedido: 'CANCELADO', checkout: 'EN_COBRO', pagos: ['CONFIRMADO'] });
  await quiere('B4 con un pago PENDIENTE', { checkout: 'EN_COBRO', pagos: ['PENDIENTE'] });
  await quiere('B5 con un pago AUTORIZADO', { checkout: 'EN_COBRO', pagos: ['AUTORIZADO'] });
  await quiere('B6 con un pago DESCONOCIDO', { checkout: 'EN_COBRO', pagos: ['DESCONOCIDO'] });
  await quiere('B7 con un pago REEMBOLSADO', { checkout: 'EN_COBRO', pagos: ['REEMBOLSADO'] });
  await quiere('B8 con un checkout COMPLETADO', { checkout: 'COMPLETADO' });
  await quiere('B9 con una incidencia de cobro ABIERTA (aunque el pago esté rechazado)', { checkout: 'EN_COBRO', pagos: ['RECHAZADO'], incidencia: 'ABIERTA' });
  await quiere('B10 con una venta fiscal BLOQUEADA', { checkout: 'EN_COBRO', pagos: ['RECHAZADO'], venta: { estado: 'BLOQUEADA', bloqueada: true } });
  await quiere('B11 con una venta fiscal CERRADA', { checkout: 'EN_COBRO', pagos: ['RECHAZADO'], venta: { estado: 'CERRADA', bloqueada: true } });
  await quiere('B12 con una venta ABIERTA sin enlazar a un checkout (no es la foto de un cobro)', { checkout: 'EN_COBRO', pagos: ['RECHAZADO'], venta: { estado: 'ABIERTA', enlazada: false } });
  await quiere('B13 con un reparto ACTIVO', { reparto: 'ACTIVO' });
  await quiere('B14 con una cuota por importe ACTIVA', { cuota: 'ACTIVA' });
  await quiere('B15 del día actual, sin pedido, de solo 30 minutos (aún puede estar guardándose)', { dia: HOY, minutos: 30 });
  await quiere('B16 del día actual con un pedido CANCELADO (no es el caso H-29: eso lo cierra H-21 al cancelar)', { dia: HOY, minutos: 600, pedido: 'CANCELADO' });
  await quiere('B17 del día actual, sin pedido pero con un checkout abierto (hay cobro iniciado)', { dia: HOY, minutos: 600, checkout: 'EN_COBRO' });
  await quiere('B18 de OTRO local con la misma forma', { local: 'L2' });
  await quiere('B19 de OTRA empresa con la misma forma', { empresa: 'E2' });
  const r = await limpiar(db);
  const res = r.filas?.[0]?.r;
  for (const { nombre, x, esperado } of casos) {
    const e = await estado(db, x.c);
    check(`${nombre}: la cuenta sigue ${esperado} y sin tocar`, e.estado === esperado && Number(e.version) === 1 && (await eventos(db, x.c)).length === 0);
  }
  // los dos últimos casos son de otro contexto: ni siquiera cuentan como omitidos
  check('B20 las vivas del local cuentan como omitidas (17) y las de otro local o empresa no cuentan', r.ok && res.cerradas === 0 && res.omitidas === 17, JSON.stringify(res || r.error));
  const pagos = (await db.query(`select count(*)::int n from public.pagos where estado='CONFIRMADO'`)).rows[0].n;
  check('B21 no se tocó ningún pago ni checkout con dinero', pagos === 1 && (await db.query(`select count(*)::int n from public.checkouts where estado='CANCELADO'`)).rows[0].n === 0);
  await db.close();
}

// ---------- C. Autorización, idempotencia y mínimo de minutos ----------
{
  const db = await base();
  const a = await cuenta(db);
  await db.exec(`update public.ajustes set valor='false' where clave='puede_gestionar'`);
  const r1 = await limpiar(db);
  check('C1 sin ser Propietario ni Encargado se rechaza y no se cierra nada', !r1.ok && r1.error.includes('cuentas_limpieza_no_autorizada') && (await estado(db, a.c)).estado === 'ABIERTA', r1.error);
  await db.exec(`update public.ajustes set valor='true' where clave='puede_gestionar'`);
  const r2 = await limpiar(db, { local: 'L2' });
  check('C2 un local que no es suyo se rechaza', !r2.ok && r2.error.includes('cuentas_limpieza_no_autorizada'));
  const r3 = await intenta(db, `select public.abc_cerrar_cuentas_sin_actividad('  ','${E}','${L}') r`);
  check('C3 sin identificador de operación se rechaza', !r3.ok && r3.error.includes('cuentas_limpieza_parametros_invalidos'));

  const b = await cuenta(db);
  const operacion = nuevaOp();
  const x1 = await limpiar(db, { operacion });
  const x2 = await limpiar(db, { operacion });
  check('C4 repetir la misma operación devuelve el mismo resultado y no vuelve a cerrar ni a anotar eventos', x1.ok && x2.ok && JSON.stringify(x1.filas[0].r.cuentas) === JSON.stringify(x2.filas[0].r.cuentas) && (await eventos(db, b.c)).length === 1 && Number((await estado(db, b.c)).version) === 2, JSON.stringify([x1.filas?.[0]?.r, x2.filas?.[0]?.r]));
  const x3 = await limpiar(db, { operacion, minutos: 200 });
  check('C5 reutilizar el identificador con otros parámetros es un conflicto', !x3.ok && x3.error.includes('operation_id_conflict'));
  await db.close();
}
{
  const db = await base();
  const joven = await cuenta(db, { dia: HOY, minutos: 20 });
  const r = await limpiar(db, { minutos: 1 });
  check('C6 el mínimo de minutos es 15: pedir 1 no cierra una cuenta de 20 minutos... y sí una de 20 con el mínimo exacto de 15', r.ok && r.filas[0].r.cerradas === 1 && (await estado(db, joven.c)).estado === 'CERRADA', JSON.stringify(r.filas?.[0]?.r || r.error));
  const reciente = await cuenta(db, { dia: HOY, minutos: 10 });
  const r2 = await limpiar(db, { minutos: 1 });
  check('C7 y una de 10 minutos sigue abierta aunque se pida 1', r2.ok && r2.filas[0].r.cerradas === 0 && (await estado(db, reciente.c)).estado === 'ABIERTA');
  await db.close();
}

// ---------- D. Forma e higiene ----------
{
  const db = await base();
  const d = (await db.query(`select pg_get_functiondef('public.abc_cerrar_cuentas_sin_actividad(text,text,text,integer)'::regprocedure) d`)).rows[0].d;
  check('D1 SECURITY DEFINER con search_path vacío', /SECURITY DEFINER/.test(d) && /SET search_path TO ''/.test(d));
  const priv = (await db.query(`select has_function_privilege('authenticated','public.abc_cerrar_cuentas_sin_actividad(text,text,text,integer)','execute') aut, has_function_privilege('anon','public.abc_cerrar_cuentas_sin_actividad(text,text,text,integer)','execute') anon`)).rows[0];
  check('D2 solo `authenticated` puede ejecutarla (no `anon`)', priv.aut === true && priv.anon === false, JSON.stringify(priv));
  await db.close();
}
const sc = MIG.replace(/--.*$/gm, '');
check('D3 la migración no borra datos ni cambia tablas', !/\b(delete\s+from|drop\s+table|alter\s+table|truncate|create\s+table)\b/i.test(sc));

console.log(fallos === 0 ? 'H28_H29_CERRAR_CUENTAS_SIN_ACTIVIDAD_PGLITE_CONTRACT=PASS' : `H28_H29_CERRAR_CUENTAS_SIN_ACTIVIDAD_PGLITE_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
