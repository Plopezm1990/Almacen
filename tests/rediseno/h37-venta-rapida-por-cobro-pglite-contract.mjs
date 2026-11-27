/**
 * Contrato PGlite de la migración
 *   supabase/migrations/20261127110000_abc_f5_venta_rapida_completar_por_cobro.sql
 *
 *   node tests/rediseno/h37-venta-rapida-por-cobro-pglite-contract.mjs
 *
 * Hallazgo H-37 de la auditoría del TPV (26/11/2026), decisión del usuario el 27/11/2026: con la cuenta de
 * Cajero/a, «Cobrar ahora» guardaba y enviaba el pedido y se cortaba al iniciar la preparación («Tu perfil no
 * tiene permiso para realizar esta transición del pedido»): la cuenta quedaba ENVIADA y sin cobrar, con el
 * stock ya consumido. El Cajero/a no tiene `ABC_PREPARACION_INICIAR`, `ABC_PREPARACION_COMPLETAR` ni
 * `ABC_PEDIDO_SERVIR`, y la venta rápida encadena esos tres pasos.
 *
 * Diseño (el mismo que en H-38: no se abren los primitivos, se abre una ENTRADA):
 *   1. `abc_completar_venta_rapida` exige `ABC_COBRO_INICIAR` y solo sirve pedidos de cuentas de modalidad
 *      BARRA (el mostrador, donde quien cobra entrega). Hace por dentro los tres pasos de cada línea.
 *   2. Marca la TRANSACCIÓN en curso (`app.abc_venta_rapida` = id de transacción); solo esa marca abre la
 *      transición de línea para quien no tiene los permisos de cocina.
 *   3. Las funciones públicas de transición llamadas directamente siguen exigiendo su capacidad.
 *   4. Cada paso queda registrado a nombre de quien cobra (transiciones y eventos reales).
 *   5. La migración es idempotente y falla en voz alta si no encuentra la guarda esperada.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const { PGlite } = await import(
  new URL('file://' + path.join(raiz, 'tests/f3/a09/node_modules/@electric-sql/pglite/dist/index.js').replace(/\\/g, '/'))
);
const MIG = await readFile(path.join(raiz, 'supabase/migrations/20261127110000_abc_f5_venta_rapida_completar_por_cobro.sql'), 'utf8');

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
  create role anon; create role authenticated; create role service_role;
  create schema if not exists private;
  create schema if not exists auth;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create function private.abc_tiene_capacidad(p_empresa_id text, p_local_id text, p_capacidad text)
  returns boolean language sql stable as
    $$ select upper(p_capacidad) = any (string_to_array(coalesce(current_setting('test.caps', true), ''), ',')) $$;
  create function private.abc_terminal_sesion_operativa(a text, b text, c uuid, d uuid) returns boolean language sql stable as $$ select true $$;
  create function private.abc_operacion_iniciar(op text, e text, l text, t text, r jsonb, term uuid) returns jsonb language sql as $$ select jsonb_build_object('replayed', false) $$;
  create function private.abc_operacion_completar(op text, r jsonb) returns void language sql as $$ select 1 $$;

  create table public.cuentas_comerciales (id uuid primary key, empresa_id text, local_id text, modalidad text, estado text default 'ABIERTA');
  create table public.pedidos_tpv (id uuid primary key, empresa_id text, local_id text, cuenta_id uuid, estado text, version bigint default 1, created_operating_day date);
  create table public.pedido_lineas (id uuid primary key, empresa_id text, local_id text, pedido_id uuid, estado text, version bigint default 1);
  create table public.pedido_linea_transiciones (linea_id uuid, operation_id text, estado_anterior text, estado_nuevo text, actor_user_id uuid);

  create function private.abc_actualizar_estado_pedido_desde_lineas(e text, l text, p uuid, op text, u uuid, t uuid, s uuid, d date)
  returns jsonb language plpgsql as $f$
  declare v_estado text; v_version bigint;
  begin
    select case when bool_and(estado in ('SERVIDA','CANCELADA')) then 'SERVIDO' else 'ENVIADO' end into v_estado
      from public.pedido_lineas where pedido_id=p;
    update public.pedidos_tpv set estado=v_estado, version=version+1 where id=p returning version into v_version;
    return jsonb_build_object('estado', v_estado, 'version', v_version);
  end $f$;

  -- Texto original de la transición de línea (la guarda está en UN solo sitio y con este formato).
  create or replace function private.abc_transicionar_linea_operativa(p_objetivo text, p_operation_id text, p_empresa_id text, p_local_id text, p_linea_id uuid, p_expected_linea_version bigint, p_expected_pedido_version bigint, p_terminal_id uuid, p_session_id uuid, p_operating_day date)
  returns jsonb language plpgsql security definer set search_path = '' as $function$
  declare
    v_objetivo text:=upper(btrim(coalesce(p_objetivo,'')));
    v_capacidad text;
    v_estado_requerido text;
    v_pedido_id uuid;
    v_pedido public.pedidos_tpv%rowtype;
    v_linea public.pedido_lineas%rowtype;
    v_order_result jsonb;
    v_linea_version bigint;
  begin
    v_capacidad:=case v_objetivo
      when 'EN_PREPARACION' then 'ABC_PREPARACION_INICIAR'
      when 'PREPARADA' then 'ABC_PREPARACION_COMPLETAR'
      when 'SERVIDA' then 'ABC_PEDIDO_SERVIR'
      else null
    end;
    v_estado_requerido:=case v_objetivo
      when 'EN_PREPARACION' then 'ENVIADA'
      when 'PREPARADA' then 'EN_PREPARACION'
      when 'SERVIDA' then 'PREPARADA'
      else null
    end;

    if v_capacidad is null then raise exception 'transicion_linea_objetivo_invalido'; end if;
    if auth.uid() is null or not private.abc_tiene_capacidad(
      p_empresa_id,p_local_id,v_capacidad
    ) then
      raise exception 'transicion_linea_no_autorizada';
    end if;

    select pedido_id into v_pedido_id from public.pedido_lineas where empresa_id=p_empresa_id and local_id=p_local_id and id=p_linea_id;
    if not found then raise exception 'linea_no_encontrada'; end if;
    select * into v_pedido from public.pedidos_tpv where empresa_id=p_empresa_id and local_id=p_local_id and id=v_pedido_id for update;
    if v_pedido.estado in ('CERRADO','CANCELADO') then raise exception 'pedido_no_operable'; end if;
    if v_pedido.version<>p_expected_pedido_version then raise exception 'pedido_version_conflict'; end if;
    select * into v_linea from public.pedido_lineas where id=p_linea_id for update;
    if v_linea.version<>p_expected_linea_version then raise exception 'linea_version_conflict'; end if;
    if v_linea.estado<>v_estado_requerido then raise exception 'transicion_linea_invalida:%->%',v_linea.estado,v_objetivo; end if;

    update public.pedido_lineas set estado=v_objetivo, version=version+1 where id=p_linea_id returning version into v_linea_version;
    insert into public.pedido_linea_transiciones values (p_linea_id, p_operation_id, v_linea.estado, v_objetivo, auth.uid());
    v_order_result:=private.abc_actualizar_estado_pedido_desde_lineas(p_empresa_id,p_local_id,v_pedido_id,p_operation_id,auth.uid(),p_terminal_id,p_session_id,p_operating_day);
    return jsonb_build_object('ok',true,'linea_id',p_linea_id,'estado',v_objetivo,'linea_version',v_linea_version,'pedido_id',v_pedido_id,'pedido_estado',v_order_result->>'estado','pedido_version',(v_order_result->>'version')::bigint);
  end $function$;

  -- Las tres funciones públicas, como en el repositorio: delegan en la privada.
  create or replace function public.abc_iniciar_preparacion_linea(p_operation_id text, p_empresa_id text, p_local_id text, p_linea_id uuid, p_expected_linea_version bigint, p_expected_pedido_version bigint, p_terminal_id uuid, p_session_id uuid, p_operating_day date)
  returns jsonb language sql security definer set search_path = '' as $$ select private.abc_transicionar_linea_operativa('EN_PREPARACION',$1,$2,$3,$4,$5,$6,$7,$8,$9) $$;
  create or replace function public.abc_marcar_linea_preparada(p_operation_id text, p_empresa_id text, p_local_id text, p_linea_id uuid, p_expected_linea_version bigint, p_expected_pedido_version bigint, p_terminal_id uuid, p_session_id uuid, p_operating_day date)
  returns jsonb language sql security definer set search_path = '' as $$ select private.abc_transicionar_linea_operativa('PREPARADA',$1,$2,$3,$4,$5,$6,$7,$8,$9) $$;
  create or replace function public.abc_servir_linea(p_operation_id text, p_empresa_id text, p_local_id text, p_linea_id uuid, p_expected_linea_version bigint, p_expected_pedido_version bigint, p_terminal_id uuid, p_session_id uuid, p_operating_day date)
  returns jsonb language sql security definer set search_path = '' as $$ select private.abc_transicionar_linea_operativa('SERVIDA',$1,$2,$3,$4,$5,$6,$7,$8,$9) $$;
`;

const E = 'E1', L = 'L1', T = '30000000-0000-4000-8000-000000000001', S = '30000000-0000-4000-8000-000000000002';
const U = '11111111-1111-4111-8111-111111111111';
let n = 0;
const id = () => `30000000-0000-4000-8000-${String(100 + ++n).padStart(12, '0')}`;
async function base(conMigracion) {
  const db = new PGlite();
  await db.exec(ANDAMIO);
  if (conMigracion) await db.exec(MIG);
  return db;
}
async function como(db, caps, autenticado = true) {
  await db.exec(`set test.caps = '${caps}'; set test.uid = '${autenticado ? U : ''}'`);
}
async function pedido(db, { modalidad = 'BARRA', estadoPedido = 'ENVIADO', lineas = ['ENVIADA', 'ENVIADA'] } = {}) {
  const c = id(), p = id();
  await db.exec(`insert into public.cuentas_comerciales(id,empresa_id,local_id,modalidad) values ('${c}','${E}','${L}','${modalidad}')`);
  await db.exec(`insert into public.pedidos_tpv(id,empresa_id,local_id,cuenta_id,estado,created_operating_day) values ('${p}','${E}','${L}','${c}','${estadoPedido}','2026-11-27')`);
  const ls = [];
  for (const e of lineas) { const l = id(); ls.push(l); await db.exec(`insert into public.pedido_lineas(id,empresa_id,local_id,pedido_id,estado) values ('${l}','${E}','${L}','${p}','${e}')`); }
  return { p, ls };
}
const completar = (db, p, version = 1) => intenta(db, `select public.abc_completar_venta_rapida('vr-${p}','${E}','${L}','${p}'::uuid,${version},'${T}'::uuid,'${S}'::uuid,'2026-11-27'::date) r`);
const estados = async (db, p) => (await db.query(`select estado from public.pedido_lineas where pedido_id='${p}' order by id`)).rows.map((x) => x.estado);
const CAJERO = 'ABC_COBRO_INICIAR,ABC_CAJA_OPERAR';

// A. ANTES: H-37 reproducido.
{
  const db = await base(false);
  const { ls } = await pedido(db);
  await como(db, CAJERO);
  const r = await intenta(db, `select public.abc_iniciar_preparacion_linea('op-1-a-1','${E}','${L}','${ls[0]}'::uuid,1,1,'${T}'::uuid,'${S}'::uuid,'2026-11-27'::date)`);
  check('H-37 reproducido: el Cajero/a no puede iniciar la preparación', !r.ok && /transicion_linea_no_autorizada/.test(r.error), r.error || '');
  await db.close();
}

// B. DESPUÉS.
{
  const db = await base(true);

  const a = await pedido(db);
  await como(db, CAJERO);
  const r = await completar(db, a.p);
  check('B1 el Cajero/a completa la venta rápida: todas las líneas SERVIDAS', r.ok && (await estados(db, a.p)).every((x) => x === 'SERVIDA'), r.error || JSON.stringify(await estados(db, a.p)));
  const res = r.filas?.[0]?.r;
  check('B2 el resultado trae el pedido SERVIDO, su versión y las líneas', res && res.ok === true && res.pedido_estado === 'SERVIDO' && Number(res.pedido_version) > 1 && Array.isArray(res.lineas) && res.lineas.length === 2 && res.lineas.every((x) => x.estado === 'SERVIDA'), JSON.stringify(res));
  const tr = (await db.query(`select estado_anterior, estado_nuevo, actor_user_id from public.pedido_linea_transiciones where linea_id='${a.ls[0]}' order by ctid`)).rows;
  check('B3 cada línea pasa por los tres pasos y queda a nombre de quien cobra', tr.length === 3 && tr.map((x) => x.estado_nuevo).join() === 'EN_PREPARACION,PREPARADA,SERVIDA' && tr.every((x) => x.actor_user_id === U), JSON.stringify(tr));
  const ops = (await db.query(`select distinct operation_id from public.pedido_linea_transiciones where linea_id in ('${a.ls[0]}','${a.ls[1]}')`)).rows;
  check('B4 cada paso usa su propio identificador de operación (6 distintos)', ops.length === 6);

  // Estados mezclados.
  const b = await pedido(db, { lineas: ['ENVIADA', 'EN_PREPARACION', 'PREPARADA', 'SERVIDA', 'CANCELADA'] });
  const rb = await completar(db, b.p);
  check('B5 con líneas en estados mezclados las deja SERVIDAS (la servida y la cancelada no se tocan)', rb.ok && (await estados(db, b.p)).filter((x) => x !== 'CANCELADA').every((x) => x === 'SERVIDA') && (await estados(db, b.p)).filter((x) => x === 'CANCELADA').length === 1, rb.error || JSON.stringify(await estados(db, b.p)));

  // Repetir no duplica ni falla.
  const rr = await completar(db, a.p, Number(res.pedido_version));
  check('B6 repetir la operación sobre el pedido ya servido no cambia nada ni falla', rr.ok && (await db.query(`select count(*)::int n from public.pedido_linea_transiciones where linea_id='${a.ls[0]}'`)).rows[0].n === 3, rr.error || '');

  // Las funciones públicas siguen cerradas para quien no tiene los permisos de cocina.
  const c = await pedido(db);
  const dir = [];
  for (const f of ['abc_iniciar_preparacion_linea', 'abc_marcar_linea_preparada', 'abc_servir_linea']) {
    dir.push(await intenta(db, `select public.${f}('op-d-${f}-${c.ls[0]}','${E}','${L}','${c.ls[0]}'::uuid,1,1,'${T}'::uuid,'${S}'::uuid,'2026-11-27'::date)`));
  }
  check('B7 llamadas DIRECTAS del Cajero/a a las tres transiciones siguen CERRADAS', dir.every((x) => !x.ok && /transicion_linea_no_autorizada/.test(x.error)), JSON.stringify(dir.map((x) => x.error)));
  await db.exec(`select set_config('app.abc_venta_rapida', '1', false)`);
  const falsa = await intenta(db, `select public.abc_iniciar_preparacion_linea('op-f-${c.ls[0]}','${E}','${L}','${c.ls[0]}'::uuid,1,1,'${T}'::uuid,'${S}'::uuid,'2026-11-27'::date)`);
  check('B8 una marca falseada no abre la transición', !falsa.ok && /no_autorizada/.test(falsa.error), falsa.error || '');
  await db.exec(`select set_config('app.abc_venta_rapida', '', false)`);
  const tras = await intenta(db, `select public.abc_servir_linea('op-t-${c.ls[0]}','${E}','${L}','${c.ls[0]}'::uuid,1,1,'${T}'::uuid,'${S}'::uuid,'2026-11-27'::date)`);
  check('B9 tras completar una venta, la marca interna ya no existe (la transición directa sigue cerrada)', !tras.ok && /no_autorizada/.test(tras.error), tras.error || '');

  // Quién no puede.
  const d = await pedido(db);
  await como(db, 'ABC_CAJA_OPERAR');
  const sinCobro = await completar(db, d.p);
  check('B10 sin ABC_COBRO_INICIAR se rechaza y no cambia nada', !sinCobro.ok && /venta_rapida_no_autorizada/.test(sinCobro.error) && (await estados(db, d.p)).every((x) => x === 'ENVIADA'), sinCobro.error || '');
  await como(db, CAJERO, false);
  const sinSesion = await completar(db, d.p);
  check('B11 sin sesión de usuario se rechaza', !sinSesion.ok && /venta_rapida_no_autorizada/.test(sinSesion.error), sinSesion.error || '');
  await como(db, CAJERO);
  const mesa = await pedido(db, { modalidad: 'MESA' });
  const rm = await completar(db, mesa.p);
  check('B12 una cuenta de MESA no se sirve por aquí (la cocina real sigue su flujo) y no cambia nada', !rm.ok && /venta_rapida_modalidad_no_permitida/.test(rm.error) && (await estados(db, mesa.p)).every((x) => x === 'ENVIADA'), rm.error || '');
  const cerrado = await pedido(db, { estadoPedido: 'CERRADO' });
  const rc = await completar(db, cerrado.p);
  check('B13 un pedido cerrado o cancelado no se opera', !rc.ok && /pedido_no_operable/.test(rc.error), rc.error || '');
  const conflicto = await pedido(db);
  const rv = await completar(db, conflicto.p, 9);
  check('B14 con una versión del pedido distinta se rechaza (otro terminal lo cambió)', !rv.ok && /pedido_version_conflict/.test(rv.error) && (await estados(db, conflicto.p)).every((x) => x === 'ENVIADA'), rv.error || '');
  const ajeno = await intenta(db, `select public.abc_completar_venta_rapida('vr-x','${E}','${L}','${id()}'::uuid,1,'${T}'::uuid,'${S}'::uuid,'2026-11-27'::date)`);
  check('B15 un pedido que no existe se rechaza', !ajeno.ok && /pedido_no_encontrado/.test(ajeno.error), ajeno.error || '');

  // Quien ya tenía los permisos de cocina sigue pudiendo usar las funciones directas.
  const e = await pedido(db);
  await como(db, 'ABC_PREPARACION_INICIAR,ABC_PREPARACION_COMPLETAR,ABC_PEDIDO_SERVIR');
  const cocina = await intenta(db, `select public.abc_iniciar_preparacion_linea('op-k-${e.ls[0]}','${E}','${L}','${e.ls[0]}'::uuid,1,1,'${T}'::uuid,'${S}'::uuid,'2026-11-27'::date)`);
  check('B16 con los permisos de cocina las funciones directas siguen funcionando', cocina.ok, cocina.error || '');

  // Un fallo a mitad no deja líneas a medias.
  await como(db, CAJERO);
  const f = await pedido(db, { lineas: ['ENVIADA', 'ENVIADA'] });
  await db.exec(`update public.pedido_lineas set estado='PREPARADA', version=5 where id='${f.ls[1]}'`);
  await db.exec(`create or replace function private.abc_actualizar_estado_pedido_desde_lineas(e text, l text, p uuid, op text, u uuid, t uuid, s uuid, d date) returns jsonb language plpgsql as $x$ begin raise exception 'fallo_simulado'; end $x$;`);
  const rf = await completar(db, f.p);
  check('B17 si un paso falla se deshace todo: ninguna línea queda a medias', !rf.ok && /fallo_simulado/.test(rf.error) && (await estados(db, f.p)).join() === 'ENVIADA,PREPARADA', rf.error || JSON.stringify(await estados(db, f.p)));
  await db.close();
}

// C. Función de la marca, forma e idempotencia.
{
  const db = await base(true);
  const fn = (await db.query(`select pg_get_functiondef('private.abc_venta_rapida_interna()'::regprocedure) d`)).rows[0].d;
  check('C1 la marca se compara con el id de la transacción y no con una constante', /txid_current\(\)/.test(fn) && /app\.abc_venta_rapida/.test(fn));
  check('C2 la función de la marca no es ejecutable por PUBLIC', (await db.query(`select has_function_privilege('public','private.abc_venta_rapida_interna()','execute') p`)).rows[0].p === false);
  const pub = (await db.query(`select has_function_privilege('public','public.abc_completar_venta_rapida(text,text,text,uuid,bigint,uuid,uuid,date)','execute') p, has_function_privilege('anon','public.abc_completar_venta_rapida(text,text,text,uuid,bigint,uuid,uuid,date)','execute') a, has_function_privilege('authenticated','public.abc_completar_venta_rapida(text,text,text,uuid,bigint,uuid,uuid,date)','execute') u`)).rows[0];
  check('C3 la entrada solo es ejecutable por usuarios autenticados', pub.p === false && pub.a === false && pub.u === true, JSON.stringify(pub));
  const d1 = (await db.query(`select pg_get_functiondef('private.abc_transicionar_linea_operativa(text,text,text,text,uuid,bigint,bigint,uuid,uuid,date)'::regprocedure) d`)).rows[0].d;
  await db.exec(MIG);
  const d2 = (await db.query(`select pg_get_functiondef('private.abc_transicionar_linea_operativa(text,text,text,text,uuid,bigint,bigint,uuid,uuid,date)'::regprocedure) d`)).rows[0].d;
  check('C4 la migración es idempotente', d1 === d2);
  check('C5 la transición conserva su capacidad y suma solo la marca interna, una vez', /v_capacidad/.test(d1) && (d1.match(/abc_venta_rapida_interna\(\)/g) || []).length === 1);
  const entrada = (await db.query(`select pg_get_functiondef('public.abc_completar_venta_rapida(text,text,text,uuid,bigint,uuid,uuid,date)'::regprocedure) d`)).rows[0].d;
  check('C6 la entrada es SECURITY DEFINER, con search_path vacío, exige COBRO_INICIAR y marca DESPUÉS de autorizar',
    /SECURITY DEFINER/.test(entrada) && /SET search_path TO ''/.test(entrada) && entrada.indexOf('ABC_COBRO_INICIAR') > 0 && entrada.indexOf('ABC_COBRO_INICIAR') < entrada.indexOf('app.abc_venta_rapida') && /'BARRA'/.test(entrada));
  await db.close();
}
{
  const db = new PGlite();
  await db.exec(ANDAMIO);
  await db.exec(`create or replace function private.abc_transicionar_linea_operativa(p_objetivo text, p_operation_id text, p_empresa_id text, p_local_id text, p_linea_id uuid, p_expected_linea_version bigint, p_expected_pedido_version bigint, p_terminal_id uuid, p_session_id uuid, p_operating_day date)
    returns jsonb language plpgsql as $f$ begin if auth.uid() is null then raise exception 'x'; end if; return '{}'::jsonb; end $f$;`);
  let msg = '';
  try { await db.exec(MIG); } catch (e) { msg = String(e.message || e); }
  check('C7 si la transición no tiene la guarda esperada, falla en voz alta', msg.includes('GUARDA_NO_ENCONTRADA'), msg.slice(0, 120));
  await db.close();
}
const sc = MIG.replace(/--.*$/gm, '');
check('C8 la migración no toca datos ni tablas', !/\b(insert\s+into|update\s+public|delete\s+from|drop\s+table|alter\s+table|truncate)\b/i.test(sc));

console.log(fallos === 0 ? 'H37_VENTA_RAPIDA_POR_COBRO_PGLITE_CONTRACT=PASS' : `H37_VENTA_RAPIDA_POR_COBRO_PGLITE_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
