/**
 * Contrato PGlite de la migración
 *   supabase/migrations/20261126140000_abc_f5_c04_bloqueo_ventas_sin_documento.sql
 *
 *   node tests/rediseno/c04-bloqueo-ventas-sin-documento-pglite-contract.mjs
 *
 * Por qué existe (hallazgo H-38 de la auditoría del TPV, 26/11/2026, parte b):
 * un cobro cerrado sin documento fiscal no lo detectaba nadie. El cierre de caja
 * (`private.abc_c04_bloqueos_cierre`, que alimentan el ensayo C12, el cierre
 * provisional y el cierre definitivo) solo miraba pagos y efectos pendientes. Una
 * sesión con ventas cobradas y SIN documento emitido se podía cerrar «apta».
 *
 * Segunda parte (misma migración de cierre, lectura para el botón «Emitir documento pendiente»):
 *   supabase/migrations/20261126150000_abc_f5_c04_listar_ventas_sin_documento.sql
 *   La función de lectura devuelve exactamente las ventas que producen el bloqueo, solo a quien puede
 *   operar la caja o iniciar cobros, y no escribe nada.
 *
 * Lo que se fija:
 *   1. Una venta cobrada (checkout COMPLETADO con importe) dentro de la ventana de la
 *      sesión (de su apertura a su cierre) y sin documento EMITIDO produce el
 *      bloqueo `VENTAS_SIN_DOCUMENTO`.
 *   2. No bloquea: venta con documento EMITIDO, venta de otra sesión/ventana u otro
 *      local, checkout sin completar, importe cero.
 *   3. Un documento que solo está reservado (no EMITIDO) sigue contando como falta.
 *   4. El bloqueo viaja por el punto único: el cierre definitivo (que rechaza
 *      cualquier bloqueo) lo rechaza; el ensayo lo clasifica como BLOQUEADO.
 *   5. Los bloqueos que ya existían (pagos y efectos) siguen intactos.
 *   6. La migración es idempotente y falla en voz alta si la estructura esperada
 *      no está.
 *
 * El esquema es un andamio: las tablas con las columnas que usa la función y las
 * funciones con su texto ORIGINAL (20261001140000 y 20261001220000). La migración
 * se aplica tal cual.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const { PGlite } = await import(
  new URL('file://' + path.join(raiz, 'tests/f3/a09/node_modules/@electric-sql/pglite/dist/index.js').replace(/\\/g, '/'))
);
const MIG = await readFile(path.join(raiz, 'supabase/migrations/20261126140000_abc_f5_c04_bloqueo_ventas_sin_documento.sql'), 'utf8');
const MIG_LISTA = await readFile(path.join(raiz, 'supabase/migrations/20261126150000_abc_f5_c04_listar_ventas_sin_documento.sql'), 'utf8');

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
  create table public.caja_sesiones (id uuid primary key, empresa_id text, local_id text, estado text, abierta_at timestamptz, cerrada_at timestamptz);
  create table public.checkouts (id uuid primary key, empresa_id text, local_id text, cuenta_id uuid, estado text, completed_at timestamptz);
  create table public.checkout_ventas (id serial primary key, empresa_id text, local_id text, checkout_id uuid, venta_fiscal_id uuid, importe_objetivo numeric(24,8));
  create table public.abc_c05_documentos_emitidos (id serial primary key, empresa_id text, local_id text, documento_origen_id text, estado text);
  create table public.pagos (id serial primary key, empresa_id text, local_id text, estado text);
  create table public.efectos_pendientes (id serial primary key, empresa_id text, local_id text, estado text);

  -- Texto original de 20261001140000.
  create or replace function private.abc_c04_bloqueos_cierre(p_empresa_id text, p_local_id text, p_session_id uuid)
  returns jsonb language sql stable security definer set search_path = '' as $function$
    select coalesce(jsonb_agg(x.motivo order by x.motivo),'[]'::jsonb)
      from (
        select 'PAGOS_PENDIENTES'::text motivo
          where exists (
            select 1 from public.pagos p
             where p.empresa_id=p_empresa_id
               and p.local_id=p_local_id
               and p.estado in ('PENDIENTE','AUTORIZADO','DESCONOCIDO')
          )
        union all
        select 'EFECTOS_PENDIENTES'::text
          where exists (
            select 1 from public.efectos_pendientes e
             where e.empresa_id=p_empresa_id
               and e.local_id=p_local_id
               and e.estado in ('PENDIENTE','EN_PROCESO','ERROR')
          )
      ) x;
  $function$;

  -- Cierre definitivo: rechaza cualquier bloqueo (texto de abc_finalizar_cierre_sesion_caja).
  create or replace function public.abc_finalizar_cierre_sesion_caja(p_empresa_id text, p_local_id text, p_session_id uuid)
  returns jsonb language plpgsql security definer set search_path = '' as $function$
  declare v_blockers jsonb;
  begin
    v_blockers:=private.abc_c04_bloqueos_cierre(p_empresa_id,p_local_id,p_session_id);
    if jsonb_array_length(v_blockers)>0 then raise exception 'cierre_definitivo_bloqueado:%',v_blockers::text; end if;
    update public.caja_sesiones set estado='CERRADA_FINAL', cerrada_at=now() where id=p_session_id;
    return jsonb_build_object('ok', true);
  end $function$;

  -- Ensayo: clasificación del resultado (fragmento original de abc_ensayar_cierre_sesion_caja).
  create or replace function public.abc_ensayar_cierre_sesion_caja(p_empresa_id text, p_local_id text, p_session_id uuid)
  returns jsonb language plpgsql security definer set search_path = '' as $function$
  declare
    v_blockers jsonb:='[]'::jsonb;
    v_c04_blockers jsonb;
    v_resultado text;
  begin
    v_c04_blockers:=private.abc_c04_bloqueos_cierre(p_empresa_id,p_local_id,p_session_id);
    v_blockers:=v_blockers||v_c04_blockers;
    v_resultado:=case
      when v_blockers ? 'PAGOS_PENDIENTES'
        or v_blockers ? 'EFECTOS_PENDIENTES'
        or v_blockers ? 'SESION_NO_REVISABLE' then 'BLOQUEADO'
      when jsonb_array_length(v_blockers)=0 then 'APTO_CIERRE'
      else 'PENDIENTE'
    end;
    return jsonb_build_object('resultado', v_resultado, 'bloqueos', v_blockers);
  end $function$;
`;

const E = 'E1', L = 'L1';
const S = '00000000-0000-4000-8000-0000000000a1';
const S_OTRA = '00000000-0000-4000-8000-0000000000a2';
let n = 0;
const uuid = () => `10000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

async function base() {
  const db = new PGlite();
  await db.exec(ANDAMIO);
  await db.exec(`insert into public.caja_sesiones values
    ('${S}','${E}','${L}','EN_CIERRE','2026-11-26 08:00+00', null),
    ('${S_OTRA}','${E}','${L}','CERRADA_FINAL','2026-11-25 08:00+00','2026-11-25 20:00+00')`);
  return db;
}
// Venta cobrada: devuelve el id de la venta fiscal.
async function venta(db, { estado = 'COMPLETADO', at = '2026-11-26 10:00+00', importe = 12.5, local = L, doc = null }) {
  const ch = uuid(), cu = uuid(), vf = uuid();
  await db.exec(`insert into public.checkouts values ('${ch}','${E}','${local}','${cu}','${estado}','${at}')`);
  await db.exec(`insert into public.checkout_ventas(empresa_id,local_id,checkout_id,venta_fiscal_id,importe_objetivo) values ('${E}','${local}','${ch}','${vf}',${importe})`);
  if (doc) await db.exec(`insert into public.abc_c05_documentos_emitidos(empresa_id,local_id,documento_origen_id,estado) values ('${E}','${local}','${vf}','${doc}')`);
  return vf;
}
const bloqueos = async (db, sesion = S) =>
  (await db.query(`select private.abc_c04_bloqueos_cierre('${E}','${L}','${sesion}'::uuid) b`)).rows[0].b;

// ---------------------------------------------------------------------------
// A. ANTES: se reproduce que la venta sin documento no bloquea nada.
// ---------------------------------------------------------------------------
{
  const db = await base();
  await venta(db, {});
  check('H-38b reproducido: una venta cobrada sin documento NO produce ningún bloqueo', (await bloqueos(db)).length === 0);
  const fin = await intenta(db, `select public.abc_finalizar_cierre_sesion_caja('${E}','${L}','${S}'::uuid)`);
  check('H-38b reproducido: y el cierre definitivo se completa', fin.ok, fin.error || '');
  await db.close();
}

// ---------------------------------------------------------------------------
// B. DESPUÉS de la migración.
// ---------------------------------------------------------------------------
{
  const db = await base();
  await db.exec(MIG);

  check('sin ventas no hay bloqueo', (await bloqueos(db)).length === 0);

  const sin = await venta(db, {});
  check('una venta cobrada sin documento bloquea con VENTAS_SIN_DOCUMENTO', (await bloqueos(db)).includes('VENTAS_SIN_DOCUMENTO'));

  const fin = await intenta(db, `select public.abc_finalizar_cierre_sesion_caja('${E}','${L}','${S}'::uuid)`);
  check('el cierre definitivo lo RECHAZA con el motivo', !fin.ok && /cierre_definitivo_bloqueado/.test(fin.error) && /VENTAS_SIN_DOCUMENTO/.test(fin.error), fin.error || 'no lanzó error');
  const est = (await db.query(`select estado from public.caja_sesiones where id='${S}'`)).rows[0].estado;
  check('y la sesión no se cierra', est === 'EN_CIERRE', est);

  const ens = (await db.query(`select public.abc_ensayar_cierre_sesion_caja('${E}','${L}','${S}'::uuid) r`)).rows[0].r;
  check('el ensayo C12 lo clasifica como BLOQUEADO (no como pendiente)', ens.resultado === 'BLOQUEADO' && ens.bloqueos.includes('VENTAS_SIN_DOCUMENTO'), JSON.stringify(ens));

  // Documento reservado pero no emitido: sigue faltando.
  await db.exec(`insert into public.abc_c05_documentos_emitidos(empresa_id,local_id,documento_origen_id,estado) values ('${E}','${L}','${sin}','RESERVADO')`);
  check('un documento solo RESERVADO sigue contando como falta', (await bloqueos(db)).includes('VENTAS_SIN_DOCUMENTO'));

  // Se emite: desaparece.
  await db.exec(`update public.abc_c05_documentos_emitidos set estado='EMITIDO' where documento_origen_id='${sin}'`);
  check('con el documento EMITIDO el bloqueo desaparece', !(await bloqueos(db)).includes('VENTAS_SIN_DOCUMENTO'));
  const fin2 = await intenta(db, `select public.abc_finalizar_cierre_sesion_caja('${E}','${L}','${S}'::uuid)`);
  check('y el cierre definitivo se completa', fin2.ok, fin2.error || '');

  await db.close();
}

// Lo que NO debe bloquear.
{
  const db = await base();
  await db.exec(MIG);
  await venta(db, { doc: 'EMITIDO' });
  await venta(db, { at: '2026-11-25 10:00+00' });            // antes de abrir la sesión
  await venta(db, { local: 'L2' });                          // otro local
  await venta(db, { estado: 'EN_COBRO', at: '2026-11-26 10:00+00' }); // sin completar
  await venta(db, { importe: 0 });                           // importe cero
  const b = await bloqueos(db);
  check('no bloquean: con documento, fuera de la ventana de la sesión, de otro local, sin completar, de importe cero', b.length === 0, JSON.stringify(b));

  // La sesión ya cerrada solo mira su propia ventana.
  await venta(db, { at: '2026-11-25 10:00+00' });
  const bOtra = await bloqueos(db, S_OTRA);
  check('una sesión cerrada mira solo las ventas de su ventana', bOtra.includes('VENTAS_SIN_DOCUMENTO'));
  await db.exec(`update public.caja_sesiones set cerrada_at='2026-11-25 09:00+00' where id='${S_OTRA}'`);
  check('y una venta posterior a su cierre ya no cuenta', !(await bloqueos(db, S_OTRA)).includes('VENTAS_SIN_DOCUMENTO'));
  await db.close();
}

// Los bloqueos que ya existían siguen intactos y conviven.
{
  const db = await base();
  await db.exec(MIG);
  await db.exec(`insert into public.pagos(empresa_id,local_id,estado) values ('${E}','${L}','PENDIENTE')`);
  await db.exec(`insert into public.efectos_pendientes(empresa_id,local_id,estado) values ('${E}','${L}','ERROR')`);
  check('los bloqueos de pagos y efectos siguen funcionando', JSON.stringify(await bloqueos(db)) === JSON.stringify(['EFECTOS_PENDIENTES', 'PAGOS_PENDIENTES']));
  await venta(db, {});
  check('y conviven con el nuevo, en orden estable', JSON.stringify(await bloqueos(db)) === JSON.stringify(['EFECTOS_PENDIENTES', 'PAGOS_PENDIENTES', 'VENTAS_SIN_DOCUMENTO']));
  const ens = (await db.query(`select public.abc_ensayar_cierre_sesion_caja('${E}','${L}','${S}'::uuid) r`)).rows[0].r;
  check('el ensayo sigue marcando BLOQUEADO por pagos y efectos', ens.resultado === 'BLOQUEADO');
  await db.close();
}

// Idempotencia y forma de las funciones.
{
  const db = await base();
  await db.exec(MIG);
  const d1 = (await db.query(`select pg_get_functiondef('private.abc_c04_bloqueos_cierre(text,text,uuid)'::regprocedure) d`)).rows[0].d;
  const e1 = (await db.query(`select pg_get_functiondef('public.abc_ensayar_cierre_sesion_caja(text,text,uuid)'::regprocedure) d`)).rows[0].d;
  await db.exec(MIG);
  const d2 = (await db.query(`select pg_get_functiondef('private.abc_c04_bloqueos_cierre(text,text,uuid)'::regprocedure) d`)).rows[0].d;
  const e2 = (await db.query(`select pg_get_functiondef('public.abc_ensayar_cierre_sesion_caja(text,text,uuid)'::regprocedure) d`)).rows[0].d;
  check('la migración es idempotente', d1 === d2 && e1 === e2);
  check('el bloqueo aparece una vez en cada función', (d1.match(/VENTAS_SIN_DOCUMENTO/g) || []).length === 1 && (e1.match(/VENTAS_SIN_DOCUMENTO/g) || []).length === 1);
  check('la función de bloqueos sigue siendo STABLE, SECURITY DEFINER y con search_path vacío', /STABLE/.test(d1) && /SECURITY DEFINER/.test(d1) && /SET search_path TO ''/.test(d1));
  check('cuenta solo ventas EMITIDAS, completadas y con importe positivo', /estado\s*=\s*'EMITIDO'/.test(d1) && /'COMPLETADO'/.test(d1) && /importe_objetivo\s*>\s*0/.test(d1));
  await db.close();
}

// Falla en voz alta.
{
  const db = new PGlite();
  await db.exec(ANDAMIO);
  await db.exec(`create or replace function private.abc_c04_bloqueos_cierre(p_empresa_id text, p_local_id text, p_session_id uuid)
    returns jsonb language sql stable as $f$ select '[]'::jsonb $f$;`);
  let msg = '';
  try { await db.exec(MIG); } catch (e) { msg = String(e.message || e); }
  check('si la función de bloqueos no tiene la forma esperada, falla en voz alta', msg.includes('ESTRUCTURA_NO_ENCONTRADA'), msg.slice(0, 120));
  await db.close();
}
{
  const db = new PGlite();
  await db.exec(ANDAMIO);
  await db.exec(`create or replace function public.abc_ensayar_cierre_sesion_caja(p_empresa_id text, p_local_id text, p_session_id uuid)
    returns jsonb language plpgsql as $f$ begin return '{}'::jsonb; end $f$;`);
  let msg = '';
  try { await db.exec(MIG); } catch (e) { msg = String(e.message || e); }
  check('si el ensayo no tiene la clasificación esperada, falla en voz alta', msg.includes('ESTRUCTURA_NO_ENCONTRADA'), msg.slice(0, 120));
  const d = (await db.query(`select pg_get_functiondef('private.abc_c04_bloqueos_cierre(text,text,uuid)'::regprocedure) d`)).rows[0].d;
  check('y no deja la función de bloqueos a medias (transacción deshecha)', !/VENTAS_SIN_DOCUMENTO/.test(d));
  await db.close();
}

// ---------------------------------------------------------------------------
// G. La lectura para el botón «Emitir documento pendiente».
// ---------------------------------------------------------------------------
{
  const db = await base();
  await db.exec(MIG);
  await db.exec(MIG_LISTA);
  const como = async (caps, autenticado = true) =>
    db.exec(`set test.caps = '${caps}'; set test.uid = '${autenticado ? '11111111-1111-4111-8111-111111111111' : ''}'`);
  const lista = async (sesion = S) => (await db.query(`select public.abc_c04_listar_ventas_sin_documento('${E}','${L}','${sesion}'::uuid) l`)).rows[0].l;

  await como('ABC_CAJA_OPERAR');
  check('G1. sin ventas, la lista está vacía', (await lista()).length === 0);
  const sin1 = await venta(db, { at: '2026-11-26 09:00+00', importe: 5 });
  const sin2 = await venta(db, { at: '2026-11-26 11:00+00', importe: 7.5 });
  await venta(db, { doc: 'EMITIDO' });
  await venta(db, { at: '2026-11-25 10:00+00' });
  await venta(db, { local: 'L2' });
  await venta(db, { estado: 'EN_COBRO' });
  await venta(db, { importe: 0 });
  const l = await lista();
  check('G2. devuelve solo las dos ventas sin documento, por orden de cobro', l.length === 2 && l[0].venta_fiscal_id === sin1 && l[1].venta_fiscal_id === sin2, JSON.stringify(l));
  check('G3. cada fila trae lo que hace falta para emitir: checkout, cuenta, venta fiscal e importe',
    l.every((f) => f.checkout_id && f.cuenta_id && f.venta_fiscal_id && Number(f.importe) > 0 && f.completed_at));
  check('G4. la lista coincide con el bloqueo: no vacía si y solo si hay VENTAS_SIN_DOCUMENTO', (await bloqueos(db)).includes('VENTAS_SIN_DOCUMENTO') === (l.length > 0));
  await db.exec(`insert into public.abc_c05_documentos_emitidos(empresa_id,local_id,documento_origen_id,estado) values ('${E}','${L}','${sin1}','EMITIDO')`);
  const l2 = await lista();
  check('G5. al emitir el documento de una venta, sale de la lista', l2.length === 1 && l2[0].venta_fiscal_id === sin2);
  await db.exec(`insert into public.abc_c05_documentos_emitidos(empresa_id,local_id,documento_origen_id,estado) values ('${E}','${L}','${sin2}','EMITIDO')`);
  check('G6. y con todas emitidas la lista queda vacía y el bloqueo desaparece', (await lista()).length === 0 && !(await bloqueos(db)).includes('VENTAS_SIN_DOCUMENTO'));

  await como('ABC_COBRO_INICIAR');
  check('G7. quien puede iniciar cobros también puede leerla (es quien emite)', (await intenta(db, `select public.abc_c04_listar_ventas_sin_documento('${E}','${L}','${S}'::uuid)`)).ok);
  await como('ABC_ALGO_AJENO');
  const sinPermiso = await intenta(db, `select public.abc_c04_listar_ventas_sin_documento('${E}','${L}','${S}'::uuid)`);
  check('G8. sin ninguna de las dos capacidades, se rechaza', !sinPermiso.ok && /ventas_sin_documento_no_autorizado/.test(sinPermiso.error), sinPermiso.error || 'no lanzó error');
  await como('ABC_CAJA_OPERAR', false);
  const sinSesion = await intenta(db, `select public.abc_c04_listar_ventas_sin_documento('${E}','${L}','${S}'::uuid)`);
  check('G9. sin sesión de usuario, se rechaza', !sinSesion.ok && /ventas_sin_documento_no_autorizado/.test(sinSesion.error), sinSesion.error || 'no lanzó error');

  const d = (await db.query(`select pg_get_functiondef('public.abc_c04_listar_ventas_sin_documento(text,text,uuid)'::regprocedure) d`)).rows[0].d;
  check('G10. es de solo lectura (STABLE), SECURITY DEFINER y con search_path vacío', /STABLE/.test(d) && /SECURITY DEFINER/.test(d) && /SET search_path TO ''/.test(d));
  const priv = (await db.query(`select has_function_privilege('public', 'public.abc_c04_listar_ventas_sin_documento(text,text,uuid)', 'execute') p`)).rows[0].p;
  check('G11. PUBLIC no puede ejecutarla', priv === false);
  await db.exec(MIG_LISTA);
  check('G12. aplicar la migración dos veces no falla', true);
  const sl = MIG_LISTA.replace(/--.*$/gm, '');
  check('G13. la migración no toca tablas ni datos', !/(insert\s+into|update\s+\w|delete\s+from|drop\s+table|alter\s+table|truncate)/i.test(sl));
  await db.close();
}

// Higiene de la migración.
const sc = MIG.replace(/--.*$/gm, '');
check('la migración no toca tablas ni datos', !/\b(insert\s+into|update\s+\w|delete\s+from|drop\s+table|alter\s+table|truncate)\b/i.test(sc));
check('la migración no concede ni revoca privilegios', !/\b(grant|revoke)\b/i.test(sc));

console.log(fallos === 0 ? 'C04_BLOQUEO_VENTAS_SIN_DOCUMENTO_PGLITE_CONTRACT=PASS' : `C04_BLOQUEO_VENTAS_SIN_DOCUMENTO_PGLITE_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
