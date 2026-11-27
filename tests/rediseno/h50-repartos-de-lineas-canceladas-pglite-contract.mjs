/**
 * Contrato PGlite de la migración
 *   supabase/migrations/20261128150000_abc_f6_repartos_de_lineas_canceladas_no_retienen_cuenta.sql
 *
 *   node tests/rediseno/h50-repartos-de-lineas-canceladas-pglite-contract.mjs
 *
 * H-50 (hallado al probar H-47 en QA): una cuenta con un reparto ACTIVO sobre una línea ya CANCELADA no se cerraba ni al cancelar su pedido (H-21,
 * `abc_cancelar_pedido`) ni con «Cerrar cuentas sin actividad» (H-28, `abc_cerrar_cuentas_sin_actividad`).
 *
 * Qué se fija:
 *   A. ANTES de la migración se reproduce el fallo en las dos funciones (el reparto sobre línea cancelada retiene la cuenta).
 *   B. DESPUÉS: al cancelar el pedido, la cuenta se cierra aunque conserve un reparto sobre su línea cancelada; y la limpieza de H-28 la cierra.
 *   C. NO se cierra de más: un reparto sobre una línea VIVA (p. ej. una parte recibida de otra cuenta) sigue reteniendo la cuenta, y las cuotas por importe también.
 *   D. La migración es idempotente, falla en voz alta si falta una función y deja las dos con la marca H-50.
 *
 * El esquema es un andamio con las columnas que usan las dos funciones y sustitutos de las funciones privadas; la versión de `abc_cancelar_pedido` es el texto
 * original sobre el que se aplican las migraciones H-21 y H-28 reales.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const { PGlite } = await import(
  new URL('file://' + path.join(raiz, 'tests/f3/a09/node_modules/@electric-sql/pglite/dist/index.js').replace(/\\/g, '/'))
);
const leer = (f) => readFile(path.join(raiz, 'supabase/migrations', f), 'utf8');
const MIG_H21 = await leer('20261127100000_abc_f5_cancelar_pedido_cierra_cuenta_vacia.sql');
const MIG_H28 = await leer('20261128140000_abc_f6_cerrar_cuentas_sin_actividad.sql');
const MIG_H50 = await leer('20261128150000_abc_f6_repartos_de_lineas_canceladas_no_retienen_cuenta.sql');

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
  create function private.abc_tiene_capacidad(a text, b text, c text) returns boolean language sql stable as $$ select true $$;
  create function private.abc_terminal_sesion_operativa(a text, b text, c uuid, d uuid) returns boolean language sql stable as $$ select true $$;
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
  create function private.abc_registrar_transicion_pedido(e text, l text, p uuid, op text, a text, b text, m text, u uuid, t uuid, s uuid, d date, md jsonb) returns void language sql as $$ select 1 $$;

  create table public.cuentas_comerciales (id uuid primary key, empresa_id text, local_id text, estado text, version bigint default 1, closed_at timestamptz, opened_operating_day date, created_at timestamptz default now());
  create table public.pedidos_tpv (id uuid primary key, empresa_id text, local_id text, cuenta_id uuid, estado text, version bigint default 1, created_operating_day date, closed_at timestamptz);
  create table public.pedido_lineas (id uuid primary key, empresa_id text, local_id text, pedido_id uuid, estado text, version bigint default 1);
  create table public.checkouts (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, cuenta_id uuid, estado text, version bigint default 1, cancelled_at timestamptz);
  create table public.pagos (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, checkout_id uuid, estado text);
  create table public.pago_intentos (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, pago_id uuid);
  create table public.abc_cobro_incidencias (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, intento_id uuid, estado text);
  create table public.ventas_fiscales (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, cuenta_id uuid, estado text, version bigint default 1, locked_at timestamptz);
  create table public.checkout_ventas (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, checkout_id uuid, venta_fiscal_id uuid);
  create table public.cuenta_linea_repartos (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, source_line_id uuid, cuenta_id uuid, estado text);
  create table public.cuenta_cuotas_importe (id uuid primary key default gen_random_uuid(), empresa_id text, local_id text, cuenta_origen_id uuid, cuenta_destino_id uuid, estado text);
  create table public.abc_eventos (id bigserial primary key, empresa_id text, local_id text, operation_id text, aggregate_type text, aggregate_id text, event_type text, payload jsonb, actor_user_id uuid, terminal_id uuid, occurred_at timestamptz, operating_day date);

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
    select * into v_pedido from public.pedidos_tpv
     where empresa_id=p_empresa_id and local_id=p_local_id and id=p_pedido_id for update;
    if not found then raise exception 'pedido_no_encontrado'; end if;
    if v_pedido.estado in ('CERRADO','CANCELADO') then raise exception 'pedido_no_cancelable'; end if;
    if v_pedido.version<>p_expected_pedido_version then raise exception 'pedido_version_conflict'; end if;
    update public.pedido_lineas set estado='CANCELADA', version=version+1
     where empresa_id=p_empresa_id and local_id=p_local_id and pedido_id=p_pedido_id and estado<>'CANCELADA';
    get diagnostics v_canceladas = row_count;
    update public.pedidos_tpv set estado='CANCELADO', closed_at=now(), version=version+1
     where empresa_id=p_empresa_id and local_id=p_local_id and id=p_pedido_id
    returning version into v_new_version;
    perform private.abc_registrar_transicion_pedido(
      p_empresa_id,p_local_id,p_pedido_id,p_operation_id,
      v_pedido.estado,'CANCELADO',v_motivo,auth.uid(),p_terminal_id,p_session_id,
      p_operating_day,jsonb_build_object('lineas_canceladas',v_canceladas)
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
const id = () => `50000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
let op = 0;
const nuevaOp = () => `op-${++op}`;
const HOY = '2026-11-27', AYER = '2026-11-26';

async function base({ conH50 = false } = {}) {
  const db = new PGlite();
  await db.exec(ANDAMIO);
  await db.exec(MIG_H21);
  await db.exec(MIG_H28);
  if (conH50) await db.exec(MIG_H50);
  return db;
}
/**
 * Cuenta ABIERTA con un pedido (con una línea) y, opcionalmente, un reparto ACTIVO:
 *  - `reparto: 'propia'`  → sobre la línea de su propio pedido (el caso de H-50 tras cancelar);
 *  - `reparto: 'ajena'`   → sobre una línea VIVA de otro pedido (una parte recibida de otra cuenta).
 */
async function cuenta(db, { pedido = 'ENVIADO', linea = 'ENVIADA', dia = AYER, reparto = null, cuota = null } = {}) {
  const c = id(), p = id(), l = id();
  await db.exec(`insert into public.cuentas_comerciales(id,empresa_id,local_id,estado,opened_operating_day,created_at) values ('${c}','${E}','${L}','ABIERTA','${dia}', now() - interval '600 minutes')`);
  await db.exec(`insert into public.pedidos_tpv(id,empresa_id,local_id,cuenta_id,estado,created_operating_day) values ('${p}','${E}','${L}','${c}','${pedido}','${dia}')`);
  await db.exec(`insert into public.pedido_lineas(id,empresa_id,local_id,pedido_id,estado) values ('${l}','${E}','${L}','${p}','${linea}')`);
  if (reparto === 'propia') {
    await db.exec(`insert into public.cuenta_linea_repartos(empresa_id,local_id,source_line_id,cuenta_id,estado) values ('${E}','${L}','${l}','${c}','ACTIVO')`);
  } else if (reparto === 'ajena') {
    const po = id(), lo = id(), co = id();
    await db.exec(`insert into public.cuentas_comerciales(id,empresa_id,local_id,estado,opened_operating_day) values ('${co}','${E}','${L}','ABIERTA','${dia}')`);
    await db.exec(`insert into public.pedidos_tpv(id,empresa_id,local_id,cuenta_id,estado) values ('${po}','${E}','${L}','${co}','ENVIADO')`);
    await db.exec(`insert into public.pedido_lineas(id,empresa_id,local_id,pedido_id,estado) values ('${lo}','${E}','${L}','${po}','ENVIADA')`);
    await db.exec(`insert into public.cuenta_linea_repartos(empresa_id,local_id,source_line_id,cuenta_id,estado) values ('${E}','${L}','${lo}','${c}','ACTIVO')`);
  }
  if (cuota) await db.exec(`insert into public.cuenta_cuotas_importe(empresa_id,local_id,cuenta_origen_id,cuenta_destino_id,estado) values ('${E}','${L}','${c}','${id()}','${cuota}')`);
  return { c, p, l };
}
const cancelar = (db, pedido) => intenta(db, `select public.abc_cancelar_pedido('${nuevaOp()}','${E}','${L}','${pedido}'::uuid,'prueba',1,'${id()}'::uuid,'${id()}'::uuid,'${HOY}'::date) r`);
const limpiar = (db) => intenta(db, `select public.abc_cerrar_cuentas_sin_actividad('${nuevaOp()}','${E}','${L}') r`);
const estado = async (db, c) => (await db.query(`select estado from public.cuentas_comerciales where id='${c}'`)).rows[0].estado;

// ---------- A. ANTES de la migración: el fallo se reproduce ----------
{
  const db = await base();
  const x = await cuenta(db, { reparto: 'propia' });
  const r = await cancelar(db, x.p);
  check('A1 antes: cancelar el pedido deja la cuenta ABIERTA (el reparto sobre su línea cancelada la retiene)', r.ok && r.filas[0].r.cuenta_cerrada === false && (await estado(db, x.c)) === 'ABIERTA', JSON.stringify(r.filas?.[0]?.r || r.error));
  const y = await cuenta(db, { pedido: 'CANCELADO', linea: 'CANCELADA', reparto: 'propia' });
  const l = await limpiar(db);
  check('A2 antes: «Cerrar cuentas sin actividad» omite la cuenta con el reparto sobre una línea cancelada', l.ok && (await estado(db, y.c)) === 'ABIERTA', JSON.stringify(l.filas?.[0]?.r || l.error));
  await db.close();
}

// ---------- B. DESPUÉS: se cierran ----------
{
  const db = await base({ conH50: true });
  const x = await cuenta(db, { reparto: 'propia' });
  const r = await cancelar(db, x.p);
  check('B1 cancelar el pedido cierra la cuenta aunque conserve un reparto sobre su línea cancelada', r.ok && r.filas[0].r.cuenta_cerrada === true && (await estado(db, x.c)) === 'CERRADA', JSON.stringify(r.filas?.[0]?.r || r.error));
  const ev = (await db.query(`select count(*)::int n from public.abc_eventos where aggregate_id='${x.c}' and event_type='CUENTA_CERRADA_SIN_PEDIDOS'`)).rows[0].n;
  check('B2 y deja su evento de cierre', ev === 1);
  const y = await cuenta(db, { pedido: 'CANCELADO', linea: 'CANCELADA', reparto: 'propia' });
  const l = await limpiar(db);
  check('B3 «Cerrar cuentas sin actividad» cierra la cuenta con pedido cancelado y reparto sobre su línea cancelada (día cerrado)', l.ok && l.filas[0].r.cerradas === 1 && (await estado(db, y.c)) === 'CERRADA', JSON.stringify(l.filas?.[0]?.r || l.error));
  await db.close();
}

// ---------- C. No se cierra de más ----------
{
  const db = await base({ conH50: true });
  // Cuenta cuyo pedido se cancela pero que sostiene una parte VIVA recibida de otra cuenta.
  const x = await cuenta(db, { reparto: 'ajena' });
  const r = await cancelar(db, x.p);
  check('C1 un reparto sobre una línea VIVA (parte recibida de otra cuenta) sigue reteniendo la cuenta al cancelar su pedido', r.ok && r.filas[0].r.cuenta_cerrada === false && (await estado(db, x.c)) === 'ABIERTA', JSON.stringify(r.filas?.[0]?.r || r.error));
  const y = await cuenta(db, { pedido: 'CANCELADO', linea: 'CANCELADA', reparto: 'ajena' });
  const l = await limpiar(db);
  check('C2 en la limpieza, el reparto sobre una línea viva sigue omitiendo la cuenta', l.ok && (await estado(db, y.c)) === 'ABIERTA', JSON.stringify(l.filas?.[0]?.r || l.error));
  const z = await cuenta(db, { cuota: 'ACTIVA' });
  const rz = await cancelar(db, z.p);
  check('C3 una cuota por importe activa sigue reteniendo la cuenta', rz.ok && rz.filas[0].r.cuenta_cerrada === false && (await estado(db, z.c)) === 'ABIERTA');
  const w = await cuenta(db, { pedido: 'ENVIADO', linea: 'ENVIADA', reparto: 'propia' });
  const l2 = await limpiar(db);
  check('C4 la cuenta con un pedido vivo y su reparto no se toca en la limpieza', l2.ok && (await estado(db, w.c)) === 'ABIERTA');
  await db.close();
}

// ---------- D. La migración ----------
{
  const db = await base({ conH50: true });
  const marcas = (await db.query(`select p.proname, position('H-50' in pg_get_functiondef(p.oid)) > 0 marca from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname in ('abc_cancelar_pedido','abc_cerrar_cuentas_sin_actividad') order by 1`)).rows;
  check('D1 las dos funciones quedan con la marca H-50', marcas.length === 2 && marcas.every((m) => m.marca));
  const antes = (await db.query(`select md5(pg_get_functiondef(p.oid)) h from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname in ('abc_cancelar_pedido','abc_cerrar_cuentas_sin_actividad') order by p.proname`)).rows.map((r) => r.h).join();
  const dos = await intenta(db, MIG_H50);
  const despues = (await db.query(`select md5(pg_get_functiondef(p.oid)) h from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname in ('abc_cancelar_pedido','abc_cerrar_cuentas_sin_actividad') order by p.proname`)).rows.map((r) => r.h).join();
  check('D2 es idempotente: aplicarla otra vez no cambia nada', dos.ok && antes === despues);
  const priv = (await db.query(`select has_function_privilege('anon','public.abc_cerrar_cuentas_sin_actividad(text,text,text,integer)','execute') anon`)).rows[0];
  check('D3 los permisos de la función de limpieza no se alteran (anon sigue sin ejecutarla)', priv.anon === false);
  await db.close();
}
{
  const db = new PGlite();
  await db.exec(`create schema if not exists private; create schema if not exists auth;`);
  const r = await intenta(db, MIG_H50);
  check('D4 sin las funciones, falla en voz alta (FUNCION_OBLIGATORIA_NO_ENCONTRADA)', !r.ok && /FUNCION_OBLIGATORIA_NO_ENCONTRADA/.test(r.error), r.error);
  await db.close();
}
const sc = MIG_H50.replace(/--.*$/gm, '');
check('D5 la migración no borra datos ni cambia tablas', !/\b(delete\s+from|drop\s+table|alter\s+table|truncate|create\s+table|update\s+public\.)/i.test(sc));

console.log(fallos === 0 ? 'H50_REPARTOS_LINEAS_CANCELADAS_PGLITE_CONTRACT=PASS' : `H50_REPARTOS_LINEAS_CANCELADAS_PGLITE_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
