/**
 * Contrato PGlite de la migración
 *   supabase/migrations/20261128130000_abc_f6_cancelar_pedido_cancela_cobro_sin_dinero.sql
 *
 *   node tests/rediseno/h49-cancelar-pedido-cancela-cobro-sin-dinero-pglite-contract.mjs
 *
 * Hallazgo H-49 (verificación en el navegador de QA, 27/11/2026): cancelar el pedido DESPUÉS de iniciar el cobro dejaba la cuenta
 * ABIERTA para siempre. H-21 solo cerraba la cuenta si no había NINGÚN checkout y no existe función para cancelar un checkout.
 *
 * Qué se fija:
 *   1. Un checkout sin pagos, o con pagos solo RECHAZADO/CANCELADO y sin incidencia abierta, deja de impedir el cierre: la cancelación
 *      del último pedido cierra la cuenta y cancela esos checkouts (CANCELADO, cancelled_at, versión +1).
 *      Preparar el cobro crea además una «venta fiscal» ABIERTA y sin bloquear (solo la foto del importe, enlazada al checkout): esa foto
 *      tampoco impide el cierre y se cancela (CANCELADA, versión +1) junto con la cuenta.
 *   2. Todo lo que tiene dinero en juego sigue impidiéndolo: un checkout COMPLETADO, o un pago PENDIENTE, AUTORIZADO, CONFIRMADO,
 *      DESCONOCIDO o REEMBOLSADO, o una incidencia de cobro ABIERTA, o una venta fiscal BLOQUEADA, CERRADA, bloqueada con fecha o sin enlazar a un checkout. La cuenta
 *      queda ABIERTA y todo intacto.
 *   3. Lo de H-21 se mantiene (otro pedido vivo, venta fiscal, reparto, cuota, cuenta ya cerrada).
 *   4. La migración parchea la definición viva (con H-21 aplicada), es idempotente, exige H-21 y falla en voz alta si la forma esperada falta.
 *
 * El esquema es un andamio con las columnas que usa la función y el texto ORIGINAL de abc_cancelar_pedido; se le aplica primero la
 * migración de H-21 y después la de H-49.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const { PGlite } = await import(
  new URL('file://' + path.join(raiz, 'tests/f3/a09/node_modules/@electric-sql/pglite/dist/index.js').replace(/\\/g, '/'))
);
const MIG21 = await readFile(path.join(raiz, 'supabase/migrations/20261127100000_abc_f5_cancelar_pedido_cierra_cuenta_vacia.sql'), 'utf8');
const MIG = await readFile(path.join(raiz, 'supabase/migrations/20261128130000_abc_f6_cancelar_pedido_cancela_cobro_sin_dinero.sql'), 'utf8');

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
  create schema if not exists private;
  create schema if not exists auth;
  create function auth.uid() returns uuid language sql stable as $$ select '11111111-1111-4111-8111-111111111111'::uuid $$;
  create function private.abc_tiene_capacidad(a text, b text, c text) returns boolean language sql stable as $$ select true $$;
  create function private.abc_terminal_sesion_operativa(a text, b text, c uuid, d uuid) returns boolean language sql stable as $$ select true $$;
  create function private.abc_operacion_iniciar(op text, e text, l text, t text, r jsonb, term uuid) returns jsonb language sql as $$ select jsonb_build_object('replayed', false) $$;
  create function private.abc_operacion_completar(op text, r jsonb) returns void language sql as $$ select 1 $$;
  create function private.abc_registrar_transicion_pedido(e text, l text, p uuid, op text, a text, b text, m text, u uuid, t uuid, s uuid, d date, md jsonb) returns void language sql as $$ select 1 $$;

  create table public.cuentas_comerciales (id uuid primary key, empresa_id text, local_id text, estado text, version bigint default 1, closed_at timestamptz);
  create table public.pedidos_tpv (id uuid primary key, empresa_id text, local_id text, cuenta_id uuid, estado text, version bigint default 1, created_operating_day date, closed_at timestamptz);
  create table public.pedido_lineas (id uuid primary key, empresa_id text, local_id text, pedido_id uuid, estado text, version bigint default 1);
  create table public.pedido_linea_transiciones (empresa_id text, local_id text, pedido_id uuid, linea_id uuid, operation_id text, estado_anterior text, estado_nuevo text, motivo text, actor_user_id uuid, terminal_id uuid, session_id uuid, occurred_at timestamptz, operating_day date, metadata jsonb);
  create table public.ventas_fiscales (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, cuenta_id uuid, estado text, version bigint default 1, locked_at timestamptz);
  create table public.checkout_ventas (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, checkout_id uuid, venta_fiscal_id uuid);
  create table public.checkouts (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, cuenta_id uuid, estado text, version bigint default 1, cancelled_at timestamptz, completed_at timestamptz);
  create table public.pagos (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, checkout_id uuid, estado text);
  create table public.pago_intentos (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, pago_id uuid, estado text);
  create table public.abc_cobro_incidencias (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, intento_id uuid, estado text);
  create table public.cuenta_linea_repartos (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, source_line_id uuid, cuenta_id uuid, estado text);
  create table public.cuenta_cuotas_importe (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, cuenta_origen_id uuid, cuenta_destino_id uuid, estado text);
  create table public.abc_eventos (empresa_id text, local_id text, operation_id text, aggregate_type text, aggregate_id text, event_type text, payload jsonb, actor_user_id uuid, terminal_id uuid, occurred_at timestamptz, operating_day date);

  -- Texto original (20261001...).
  create or replace function public.abc_cancelar_pedido(p_operation_id text, p_empresa_id text, p_local_id text, p_pedido_id uuid, p_motivo text, p_expected_pedido_version bigint, p_terminal_id uuid, p_session_id uuid, p_operating_day date)
  returns jsonb language plpgsql security definer set search_path = '' as $function$
  declare
    v_pedido public.pedidos_tpv%rowtype;
    v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
    v_cmd jsonb;
    v_request jsonb;
    v_result jsonb;
    v_new_version bigint;
    v_canceladas integer;
  begin
    if auth.uid() is null
       or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_PEDIDO_CANCELAR') then
      raise exception 'pedido_cancelar_no_autorizado';
    end if;
    if v_motivo is null then raise exception 'motivo_cancelacion_requerido'; end if;
    v_request:=jsonb_build_object('pedido_id',p_pedido_id,'motivo',v_motivo);
    v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_CANCELAR_PEDIDO',v_request,p_terminal_id);
    if (v_cmd->>'replayed')::boolean then
      return coalesce(v_cmd->'resultado',v_cmd);
    end if;

    select *
      into v_pedido
      from public.pedidos_tpv
     where empresa_id=p_empresa_id and local_id=p_local_id and id=p_pedido_id
     for update;
    if not found then raise exception 'pedido_no_encontrado'; end if;
    if v_pedido.estado in ('CERRADO','CANCELADO') then raise exception 'pedido_no_cancelable'; end if;
    if v_pedido.version<>p_expected_pedido_version then raise exception 'pedido_version_conflict'; end if;

    if exists(
      select 1 from public.pedido_lineas
       where empresa_id=p_empresa_id and local_id=p_local_id and pedido_id=p_pedido_id
         and estado='SERVIDA'
    ) then
      raise exception 'pedido_con_lineas_servidas_no_cancelable';
    end if;

    update public.pedido_lineas
       set estado='CANCELADA',
           version=version+1
     where empresa_id=p_empresa_id and local_id=p_local_id and pedido_id=p_pedido_id
       and estado<>'CANCELADA';
    get diagnostics v_canceladas = row_count;

    update public.pedidos_tpv
       set estado='CANCELADO',
           closed_at=now(),
           version=version+1
     where empresa_id=p_empresa_id and local_id=p_local_id and id=p_pedido_id
    returning version into v_new_version;

    perform private.abc_registrar_transicion_pedido(
      p_empresa_id,p_local_id,p_pedido_id,p_operation_id,
      v_pedido.estado,'CANCELADO',v_motivo,auth.uid(),p_terminal_id,p_session_id,
      p_operating_day,jsonb_build_object('lineas_canceladas',v_canceladas)
    );

    insert into public.abc_eventos(
      empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
      payload,actor_user_id,terminal_id,occurred_at,operating_day
    ) values (
      p_empresa_id,p_local_id,p_operation_id,'PEDIDO',p_pedido_id::text,'PEDIDO_CANCELADO',
      jsonb_build_object(
        'estado_anterior',v_pedido.estado,'estado','CANCELADO',
        'motivo',v_motivo,'pedido_version',v_new_version,
        'lineas_canceladas',v_canceladas,'session_id',p_session_id
      ),
      auth.uid(),p_terminal_id,now(),p_operating_day
    );

    v_result:=jsonb_build_object(
      'ok',true,'pedido_id',p_pedido_id,'estado','CANCELADO',
      'pedido_version',v_new_version,'lineas_canceladas',v_canceladas
    );
    perform private.abc_operacion_completar(p_operation_id,v_result);
    return v_result;
  end $function$;
`;

const E = 'E1', L = 'L1';
let n = 0;
const id = () => `30000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const FIRMA = 'public.abc_cancelar_pedido(text,text,text,uuid,text,bigint,uuid,uuid,date)';

async function base({ h49 = true } = {}) {
  const db = new PGlite();
  await db.exec(ANDAMIO);
  await db.exec(MIG21);
  if (h49) await db.exec(MIG);
  return db;
}
// Cuenta con un pedido enviado y, opcionalmente, un checkout con sus pagos. Devuelve ids.
async function cuenta(db, { checkout = null, pagos = [], incidencia = null, extra = null, venta = 'ENLAZADA' } = {}) {
  const c = id(), p = id(), l = id();
  await db.exec(`insert into public.cuentas_comerciales(id,empresa_id,local_id,estado) values ('${c}','${E}','${L}','ABIERTA')`);
  await db.exec(`insert into public.pedidos_tpv(id,empresa_id,local_id,cuenta_id,estado,created_operating_day) values ('${p}','${E}','${L}','${c}','ENVIADO','2026-11-27')`);
  await db.exec(`insert into public.pedido_lineas(id,empresa_id,local_id,pedido_id,estado) values ('${l}','${E}','${L}','${p}','ENVIADA')`);
  let k = null;
  if (checkout) {
    k = id();
    await db.exec(`insert into public.checkouts(id,empresa_id,local_id,cuenta_id,estado) values ('${k}','${E}','${L}','${c}','${checkout}')`);
    for (const estadoPago of pagos) {
      const g = id(), t = id();
      await db.exec(`insert into public.pagos(id,empresa_id,local_id,checkout_id,estado) values ('${g}','${E}','${L}','${k}','${estadoPago}')`);
      await db.exec(`insert into public.pago_intentos(id,empresa_id,local_id,pago_id,estado) values ('${t}','${E}','${L}','${g}','X')`);
      if (incidencia) await db.exec(`insert into public.abc_cobro_incidencias(empresa_id,local_id,intento_id,estado) values ('${E}','${L}','${t}','${incidencia}')`);
    }
  }
  // Como en el flujo real, preparar el cobro deja una venta fiscal ABIERTA enlazada al checkout (la foto del importe).
  let v = null;
  if (k && venta) {
    v = id();
    const estadoVenta = venta === 'ENLAZADA' ? 'ABIERTA' : venta.estado;
    const bloqueada = venta !== 'ENLAZADA' && venta.locked ? 'now()' : 'null';
    await db.exec(`insert into public.ventas_fiscales(id,empresa_id,local_id,cuenta_id,estado,locked_at) values ('${v}','${E}','${L}','${c}','${estadoVenta}',${bloqueada})`);
    if (venta === 'ENLAZADA' || venta.enlazada !== false) await db.exec(`insert into public.checkout_ventas(empresa_id,local_id,checkout_id,venta_fiscal_id) values ('${E}','${L}','${k}','${v}')`);
  }
  if (extra) await extra(c, p, l);
  return { c, p, l, k, v };
}
const cancelar = (db, pedido) => intenta(db, `select public.abc_cancelar_pedido('op-${pedido}','${E}','${L}','${pedido}'::uuid,'prueba',1,'${id()}'::uuid,'${id()}'::uuid,'2026-11-27'::date) r`);
const estadoCuenta = async (db, c) => (await db.query(`select estado, version, closed_at is not null cerrada from public.cuentas_comerciales where id='${c}'`)).rows[0];
const estadoVenta = async (db, v) => (await db.query(`select estado, version from public.ventas_fiscales where id='${v}'`)).rows[0];
const estadoCheckout = async (db, k) => (await db.query(`select estado, version, cancelled_at is not null cancelado from public.checkouts where id='${k}'`)).rows[0];

// A. ANTES (solo H-21): se reproduce H-49.
{
  const db = await base({ h49: false });
  const a = await cuenta(db, { checkout: 'EN_COBRO', pagos: ['RECHAZADO'] });
  const r = await cancelar(db, a.p);
  check('A1 H-49 reproducido con solo H-21: cobro iniciado y tarjeta rechazada, cancelar el pedido deja la cuenta ABIERTA', r.ok && (await estadoCuenta(db, a.c)).estado === 'ABIERTA' && r.filas[0].r.cuenta_cerrada === false);
  await db.close();
}

// B. DESPUÉS: el cobro sin dinero ya no atasca la cuenta.
{
  const db = await base();

  const a = await cuenta(db, { checkout: 'EN_COBRO', pagos: ['RECHAZADO'] });
  const ra = await cancelar(db, a.p);
  const ea = await estadoCuenta(db, a.c), ka = await estadoCheckout(db, a.k);
  check('B1 cobro iniciado y pago RECHAZADO: cancelar el pedido cierra la cuenta', ra.ok && ea.estado === 'CERRADA' && ea.cerrada === true && ra.filas[0].r.cuenta_cerrada === true, JSON.stringify({ ra: ra.error || ra.filas[0].r, ea }));
  check('B2 y cancela el checkout (CANCELADO, con fecha, versión +1)', ka.estado === 'CANCELADO' && ka.cancelado === true && Number(ka.version) === 2, JSON.stringify(ka));

  const b = await cuenta(db, { checkout: 'ABIERTO' });
  await cancelar(db, b.p);
  check('B3 checkout ABIERTO sin pagos: cierra la cuenta y cancela el checkout', (await estadoCuenta(db, b.c)).estado === 'CERRADA' && (await estadoCheckout(db, b.k)).estado === 'CANCELADO');

  const c = await cuenta(db, { checkout: 'EN_COBRO', pagos: ['RECHAZADO', 'CANCELADO', 'RECHAZADO'] });
  await cancelar(db, c.p);
  check('B4 varios pagos, todos RECHAZADO/CANCELADO: cierra', (await estadoCuenta(db, c.c)).estado === 'CERRADA' && (await estadoCheckout(db, c.k)).estado === 'CANCELADO');

  const d = await cuenta(db, { checkout: 'CANCELADO' });
  await cancelar(db, d.p);
  const kd = await estadoCheckout(db, d.k);
  check('B5 un checkout ya CANCELADO no se toca (versión intacta) y la cuenta se cierra', (await estadoCuenta(db, d.c)).estado === 'CERRADA' && Number(kd.version) === 1);

  // C. Con dinero en juego NO se cierra y el checkout queda intacto.
  for (const [nombre, estadoPago] of [['CONFIRMADO', 'CONFIRMADO'], ['PENDIENTE', 'PENDIENTE'], ['AUTORIZADO', 'AUTORIZADO'], ['DESCONOCIDO', 'DESCONOCIDO'], ['REEMBOLSADO', 'REEMBOLSADO']]) {
    const x = await cuenta(db, { checkout: 'EN_COBRO', pagos: [estadoPago] });
    await cancelar(db, x.p);
    const kx = await estadoCheckout(db, x.k);
    check(`C-${nombre} un pago ${nombre}: la cuenta sigue ABIERTA y el checkout intacto`, (await estadoCuenta(db, x.c)).estado === 'ABIERTA' && kx.estado === 'EN_COBRO' && Number(kx.version) === 1, JSON.stringify(kx));
  }
  const mezcla = await cuenta(db, { checkout: 'EN_COBRO', pagos: ['RECHAZADO', 'CONFIRMADO'] });
  await cancelar(db, mezcla.p);
  check('C6 un pago RECHAZADO y otro CONFIRMADO: sigue ABIERTA (el confirmado manda)', (await estadoCuenta(db, mezcla.c)).estado === 'ABIERTA' && (await estadoCheckout(db, mezcla.k)).estado === 'EN_COBRO');
  const comp = await cuenta(db, { checkout: 'COMPLETADO' });
  await cancelar(db, comp.p);
  check('C7 un checkout COMPLETADO (aunque no tenga pagos visibles): sigue ABIERTA', (await estadoCuenta(db, comp.c)).estado === 'ABIERTA' && (await estadoCheckout(db, comp.k)).estado === 'COMPLETADO');
  const inc = await cuenta(db, { checkout: 'EN_COBRO', pagos: ['RECHAZADO'], incidencia: 'ABIERTA' });
  await cancelar(db, inc.p);
  check('C8 una incidencia de cobro ABIERTA, aunque el pago esté rechazado: sigue ABIERTA', (await estadoCuenta(db, inc.c)).estado === 'ABIERTA' && (await estadoCheckout(db, inc.k)).estado === 'EN_COBRO');
  const incR = await cuenta(db, { checkout: 'EN_COBRO', pagos: ['RECHAZADO'], incidencia: 'RESUELTA' });
  await cancelar(db, incR.p);
  check('C9 con la incidencia ya RESUELTA, sí se cierra', (await estadoCuenta(db, incR.c)).estado === 'CERRADA');

  // V. La foto fiscal del cobro (venta fiscal ABIERTA y sin bloquear, enlazada al checkout).
  const v1 = await cuenta(db, { checkout: 'EN_COBRO', pagos: ['RECHAZADO'] });
  await cancelar(db, v1.p);
  const sv1 = await estadoVenta(db, v1.v);
  check('V1 la foto fiscal ABIERTA y enlazada no impide cerrar, y se CANCELA (versión +1)', (await estadoCuenta(db, v1.c)).estado === 'CERRADA' && sv1.estado === 'CANCELADA' && Number(sv1.version) === 2, JSON.stringify(sv1));
  const v2 = await cuenta(db, { checkout: 'EN_COBRO', pagos: ['RECHAZADO'], venta: { estado: 'BLOQUEADA', locked: true } });
  await cancelar(db, v2.p);
  check('V2 una venta fiscal BLOQUEADA: sigue ABIERTA y todo intacto', (await estadoCuenta(db, v2.c)).estado === 'ABIERTA' && (await estadoVenta(db, v2.v)).estado === 'BLOQUEADA' && (await estadoCheckout(db, v2.k)).estado === 'EN_COBRO');
  const v3 = await cuenta(db, { checkout: 'EN_COBRO', pagos: ['RECHAZADO'], venta: { estado: 'CERRADA', locked: true } });
  await cancelar(db, v3.p);
  check('V3 una venta fiscal CERRADA: sigue ABIERTA y todo intacto', (await estadoCuenta(db, v3.c)).estado === 'ABIERTA' && (await estadoVenta(db, v3.v)).estado === 'CERRADA');
  const v4 = await cuenta(db, { checkout: 'EN_COBRO', pagos: ['RECHAZADO'], venta: { estado: 'ABIERTA', locked: true } });
  await cancelar(db, v4.p);
  check('V4 una venta ABIERTA con fecha de bloqueo: sigue ABIERTA y todo intacto', (await estadoCuenta(db, v4.c)).estado === 'ABIERTA' && (await estadoVenta(db, v4.v)).estado === 'ABIERTA');
  const v5 = await cuenta(db, { checkout: 'EN_COBRO', pagos: ['RECHAZADO'], venta: { estado: 'ABIERTA', locked: false, enlazada: false } });
  await cancelar(db, v5.p);
  check('V5 una venta ABIERTA sin enlazar a ningún checkout (no es la foto de un cobro): sigue ABIERTA', (await estadoCuenta(db, v5.c)).estado === 'ABIERTA' && (await estadoVenta(db, v5.v)).estado === 'ABIERTA');
  const v6 = await cuenta(db, { checkout: 'EN_COBRO', pagos: ['RECHAZADO'], venta: { estado: 'CANCELADA', locked: false } });
  await cancelar(db, v6.p);
  check('V6 una venta ya CANCELADA no se toca (versión intacta) y la cuenta se cierra', (await estadoCuenta(db, v6.c)).estado === 'CERRADA' && Number((await estadoVenta(db, v6.v)).version) === 1);
  const v7 = await cuenta(db, { checkout: 'EN_COBRO', pagos: ['CONFIRMADO'] });
  await cancelar(db, v7.p);
  check('V7 con dinero confirmado la foto fiscal tampoco se toca', (await estadoCuenta(db, v7.c)).estado === 'ABIERTA' && (await estadoVenta(db, v7.v)).estado === 'ABIERTA');

  // D. Lo de H-21 se mantiene.
  const f1 = await cuenta(db, { checkout: 'EN_COBRO', pagos: ['RECHAZADO'], extra: (cu) => db.exec(`insert into public.ventas_fiscales(empresa_id,local_id,cuenta_id,estado) values ('${E}','${L}','${cu}','ABIERTA')`) });
  await cancelar(db, f1.p);
  check('D1 con otra venta fiscal viva sin enlazar, NO se cierra aunque el cobro no tenga dinero', (await estadoCuenta(db, f1.c)).estado === 'ABIERTA' && (await estadoCheckout(db, f1.k)).estado === 'EN_COBRO');
  const f2 = await cuenta(db, { checkout: 'EN_COBRO', pagos: ['RECHAZADO'], extra: (cu) => db.exec(`insert into public.cuenta_linea_repartos(empresa_id,local_id,source_line_id,cuenta_id,estado) values ('${E}','${L}','${id()}','${cu}','ACTIVO')`) });
  await cancelar(db, f2.p);
  check('D2 con un reparto ACTIVO recibido, NO se cierra y el checkout queda intacto', (await estadoCuenta(db, f2.c)).estado === 'ABIERTA' && (await estadoCheckout(db, f2.k)).estado === 'EN_COBRO');
  const f3 = await cuenta(db, { checkout: 'EN_COBRO', pagos: ['RECHAZADO'], extra: async (cu, p) => {
    const p2 = id(), l2 = id();
    await db.exec(`insert into public.pedidos_tpv(id,empresa_id,local_id,cuenta_id,estado,created_operating_day) values ('${p2}','${E}','${L}','${cu}','ENVIADO','2026-11-27')`);
    await db.exec(`insert into public.pedido_lineas(id,empresa_id,local_id,pedido_id,estado) values ('${l2}','${E}','${L}','${p2}','ENVIADA')`);
  } });
  await cancelar(db, f3.p);
  check('D3 con otro pedido vivo en la cuenta, NO se cierra y el checkout queda intacto', (await estadoCuenta(db, f3.c)).estado === 'ABIERTA' && (await estadoCheckout(db, f3.k)).estado === 'EN_COBRO');

  // E. Aislamiento por empresa: un pago de OTRA empresa con el mismo id de checkout no cuenta.
  const g = await cuenta(db, { checkout: 'EN_COBRO', pagos: ['RECHAZADO'] });
  await db.exec(`insert into public.pagos(empresa_id,local_id,checkout_id,estado) values ('OTRA','${L}','${g.k}','CONFIRMADO')`);
  await cancelar(db, g.p);
  check('E1 un pago CONFIRMADO de otra empresa con el mismo id de checkout no impide cerrar', (await estadoCuenta(db, g.c)).estado === 'CERRADA');
  await db.close();
}

// F. Idempotencia, dependencia, forma e higiene.
{
  const db = await base();
  const d1 = (await db.query(`select pg_get_functiondef('${FIRMA}'::regprocedure) d`)).rows[0].d;
  await db.exec(MIG);
  const d2 = (await db.query(`select pg_get_functiondef('${FIRMA}'::regprocedure) d`)).rows[0].d;
  check('F1 la migración es idempotente', d1 === d2);
  check('F2 la marca de H-49 aparece en el bloqueo del checkout, en el de la foto fiscal y en la cancelación al cerrar, y sigue SECURITY DEFINER con search_path vacío', (d1.match(/H-49: el cobro que no movio dinero/g) || []).length === 3 && /SECURITY DEFINER/.test(d1) && /SET search_path TO ''/.test(d1));
  check('F3 la cancelación del checkout va después de cerrar la cuenta y antes del evento de la cuenta', d1.indexOf('v_cuenta_cerrada:=found;') < d1.indexOf("set estado='CANCELADO',cancelled_at=now()") && d1.indexOf("set estado='CANCELADO',cancelled_at=now()") < d1.indexOf("'CUENTA_CERRADA_SIN_PEDIDOS'"));
  await db.close();
}
{
  const db = new PGlite();
  await db.exec(ANDAMIO);
  let msg = '';
  try { await db.exec(MIG); } catch (e) { msg = String(e.message || e); }
  check('F4 sin la corrección de H-21 aplicada, falla en voz alta (DEPENDENCIA_OBLIGATORIA_NO_ENCONTRADA)', msg.includes('DEPENDENCIA_OBLIGATORIA_NO_ENCONTRADA'), msg.slice(0, 120));
  await db.close();
}
{
  const db = new PGlite();
  await db.exec(ANDAMIO);
  await db.exec(`create or replace function public.abc_cancelar_pedido(p_operation_id text, p_empresa_id text, p_local_id text, p_pedido_id uuid, p_motivo text, p_expected_pedido_version bigint, p_terminal_id uuid, p_session_id uuid, p_operating_day date)
    returns jsonb language plpgsql as $f$ begin /* CUENTA_CERRADA_SIN_PEDIDOS */ return '{}'::jsonb; end $f$;`);
  let msg = '';
  try { await db.exec(MIG); } catch (e) { msg = String(e.message || e); }
  check('F5 si la función no tiene la forma esperada, falla en voz alta (ESTRUCTURA_NO_ENCONTRADA)', msg.includes('ESTRUCTURA_NO_ENCONTRADA'), msg.slice(0, 120));
  await db.close();
}
const sc = MIG.replace(/--.*$/gm, '');
check('F6 la migración no concede ni revoca privilegios ni crea ni borra tablas', !/\b(grant|revoke|drop\s+table|alter\s+table|create\s+table|truncate)\b/i.test(sc));

console.log(fallos === 0 ? 'H49_CANCELAR_PEDIDO_CANCELA_COBRO_SIN_DINERO_PGLITE_CONTRACT=PASS' : `H49_CANCELAR_PEDIDO_CANCELA_COBRO_SIN_DINERO_PGLITE_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
