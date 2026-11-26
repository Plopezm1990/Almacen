/**
 * Contrato PGlite de la migración
 * supabase/migrations/20261126120000_abc_f7_c07d_emision_por_capacidad_de_cobro.sql
 *
 *   node tests/rediseno/c07d-emision-cobro-pglite-contract.mjs
 *
 * Por qué existe (hallazgo H-38 de la auditoría del TPV, 26/11/2026): con la
 * cuenta de Cajero/a, un cobro se cierra SIN documento fiscal. Causa raíz: la
 * lectura del estado de la configuración fiscal y la propia emisión del
 * documento exigen `ABC_EMISOR_CAMBIAR`, una capacidad administrativa de
 * «cambiar el emisor» que solo tienen Propietario y Encargado. Quien cobra no
 * puede emitir el documento de lo que cobra.
 *
 * Lo que se fija:
 *   1. Quien puede iniciar un cobro (`ABC_COBRO_INICIAR`) puede emitir el
 *      documento de ese cobro y leer el estado de la emisión.
 *   2. Quien no puede iniciar cobros ni cambiar el emisor sigue rechazado.
 *   3. Las funciones de ADMINISTRACIÓN fiscal siguen exigiendo
 *      `ABC_EMISOR_CAMBIAR`: no se ensancha nada más.
 *   4. La migración es idempotente.
 *   5. Si la guarda esperada no está (la función se reescribió), la migración
 *      falla en voz alta en vez de dejar la función sin tocar.
 *   6. Una función opcional de QA que no exista no impide aplicar la migración.
 *
 * El esquema es un andamio mínimo: auth.uid(), una tabla de capacidades por
 * cargo con los valores del catálogo, y las funciones con su guarda ORIGINAL
 * (texto de 20261027160000 y 20261027163000). La migración se aplica tal cual.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const { PGlite } = await import(
  new URL('file://' + path.join(raiz, 'tests/f3/a09/node_modules/@electric-sql/pglite/dist/index.js').replace(/\\/g, '/'))
);
const MIGRACION = path.join(raiz, 'supabase/migrations/20261126120000_abc_f7_c07d_emision_por_capacidad_de_cobro.sql');
const sqlMigracion = await readFile(MIGRACION, 'utf8');

let fallos = 0;
function check(nombre, ok, detalle = '') {
  if (!ok) fallos++;
  console.log(`${ok ? '[OK]  ' : '[FAIL]'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}

async function intenta(db, sql) {
  try {
    const r = await db.query(sql);
    return { ok: true, filas: r.rows };
  } catch (e) {
    return { ok: false, error: String(e && (e.message || e)) };
  }
}

const ANDAMIO = `
  create schema if not exists auth;
  create schema if not exists private;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

  -- Valores del catálogo (abc_cap_catalogo): COBRO_INICIAR para los cuatro cargos
  -- con caja o sala; EMISOR_CAMBIAR solo Propietario y Encargado.
  create table public.cap_base (rol text, capacidad text, permitido boolean);
  insert into public.cap_base values
    ('Propietario','ABC_COBRO_INICIAR',true),  ('Propietario','ABC_EMISOR_CAMBIAR',true),
    ('Encargado','ABC_COBRO_INICIAR',true),    ('Encargado','ABC_EMISOR_CAMBIAR',true),
    ('Cajero/a','ABC_COBRO_INICIAR',true),     ('Cajero/a','ABC_EMISOR_CAMBIAR',false),
    ('Camarero/a','ABC_COBRO_INICIAR',true),   ('Camarero/a','ABC_EMISOR_CAMBIAR',false),
    ('Sin cobro','ABC_COBRO_INICIAR',false),   ('Sin cobro','ABC_EMISOR_CAMBIAR',false);
  create function private.abc_tiene_capacidad(p_empresa_id text, p_local_id text, p_capacidad text)
  returns boolean language sql stable as
    $$ select coalesce((select permitido from public.cap_base
         where rol = current_setting('test.rol', true) and capacidad = upper(p_capacidad)), false) $$;
`;

const FUNCION_EMITIR = `
  create or replace function public.abc_c07d_emitir_checkout(
    p_operation_id text, p_empresa_id text, p_local_id text, p_cuenta_id uuid,
    p_tipo_documento text default 'FACTURA', p_codigo_serie text default null
  ) returns jsonb language plpgsql security definer set search_path='' as $function$
  begin
    if auth.uid() is null
       or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_EMISOR_CAMBIAR') then
      raise exception 'abc_documento_no_autorizado';
    end if;
    return jsonb_build_object('ok', true, 'emitido', true);
  end $function$;`;

const FUNCION_ESTADO = `
  create or replace function public.abc_c07d_estado_configuracion_emision(
    p_empresa_id text, p_local_id text, p_tipo_documento text default 'FACTURA'
  ) returns jsonb language plpgsql stable security definer set search_path='' as $function$
  begin
    if auth.uid() is null
       or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_EMISOR_CAMBIAR') then
      raise exception 'C07D_CONFIG_NO_AUTORIZADO' using errcode = '42501';
    end if;
    return jsonb_build_object('ok', true, 'configurada', true);
  end $function$;`;

const FUNCION_QR_QA = `
  create or replace function public.abc_preparar_ticket_fiscal_qa(
    p_empresa_id text, p_local_id text, p_venta_fiscal_id uuid
  ) returns jsonb language plpgsql security definer set search_path='' as $function$
  begin
    if auth.uid() is null
       or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_EMISOR_CAMBIAR') then
      raise exception 'abc_ticket_no_autorizado';
    end if;
    return jsonb_build_object('ok', true);
  end $function$;`;

// Función de ADMINISTRACIÓN: debe seguir exigiendo ABC_EMISOR_CAMBIAR.
const FUNCION_ADMIN = `
  create or replace function public.abc_c07d_guardar_emision_config(p_empresa_id text, p_local_id text)
  returns jsonb language plpgsql security definer set search_path='' as $function$
  begin
    if auth.uid() is null
       or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_EMISOR_CAMBIAR') then
      raise exception 'C07D_CONFIG_NO_AUTORIZADO' using errcode = '42501';
    end if;
    return jsonb_build_object('ok', true);
  end $function$;`;

async function nuevaBase({ conQr = true } = {}) {
  const db = new PGlite();
  await db.exec(ANDAMIO + FUNCION_EMITIR + FUNCION_ESTADO + FUNCION_ADMIN + (conQr ? FUNCION_QR_QA : ''));
  return db;
}

const LLAMADAS = {
  emitir: "select public.abc_c07d_emitir_checkout('op','E','L','00000000-0000-4000-8000-000000000001'::uuid)",
  estado: "select public.abc_c07d_estado_configuracion_emision('E','L')",
  qr: "select public.abc_preparar_ticket_fiscal_qa('E','L','00000000-0000-4000-8000-000000000001'::uuid)",
  admin: "select public.abc_c07d_guardar_emision_config('E','L')",
};

async function como(db, rol, llamada, autenticado = true) {
  await db.exec(`set test.rol = '${rol}'; set test.uid = '${autenticado ? '11111111-1111-4111-8111-111111111111' : ''}'`);
  return intenta(db, LLAMADAS[llamada]);
}

// ---------------------------------------------------------------------------
// A. ANTES de la migración: se reproduce el defecto H-38.
// ---------------------------------------------------------------------------
{
  const db = await nuevaBase();
  const r1 = await como(db, 'Cajero/a', 'emitir');
  check('H-38 reproducido: antes de la migración el Cajero/a NO puede emitir', !r1.ok && r1.error.includes('abc_documento_no_autorizado'), r1.error);
  const r2 = await como(db, 'Cajero/a', 'estado');
  check('H-38 reproducido: antes de la migración el Cajero/a NO puede leer el estado fiscal', !r2.ok && r2.error.includes('C07D_CONFIG_NO_AUTORIZADO'), r2.error);
  await db.close();
}

// ---------------------------------------------------------------------------
// B. DESPUÉS de aplicar la migración.
// ---------------------------------------------------------------------------
{
  const db = await nuevaBase();
  await db.exec(sqlMigracion);

  for (const rol of ['Propietario', 'Encargado', 'Cajero/a', 'Camarero/a']) {
    for (const llamada of ['emitir', 'estado', 'qr']) {
      const r = await como(db, rol, llamada);
      check(`${rol} puede ${llamada} (inicia cobros)`, r.ok, r.error || '');
    }
  }
  for (const llamada of ['emitir', 'estado', 'qr']) {
    const r = await como(db, 'Sin cobro', llamada);
    check(`un cargo sin cobro NO puede ${llamada}`, !r.ok, r.error || 'no lanzó error');
    const sinSesion = await como(db, 'Propietario', llamada, false);
    check(`sin sesión NO puede ${llamada}`, !sinSesion.ok, sinSesion.error || 'no lanzó error');
  }

  // No se ensancha la administración fiscal.
  const adminEnc = await como(db, 'Encargado', 'admin');
  check('la administración fiscal sigue abierta al Encargado', adminEnc.ok, adminEnc.error || '');
  for (const rol of ['Cajero/a', 'Camarero/a', 'Sin cobro']) {
    const r = await como(db, rol, 'admin');
    check(`la administración fiscal sigue CERRADA a ${rol}`, !r.ok && r.error.includes('C07D_CONFIG_NO_AUTORIZADO'), r.error || '');
  }

  // Idempotencia: aplicar de nuevo no duplica la guarda.
  const antes = (await db.query(`select pg_get_functiondef('public.abc_c07d_emitir_checkout(text,text,text,uuid,text,text)'::regprocedure) d`)).rows[0].d;
  await db.exec(sqlMigracion);
  const despues = (await db.query(`select pg_get_functiondef('public.abc_c07d_emitir_checkout(text,text,text,uuid,text,text)'::regprocedure) d`)).rows[0].d;
  check('la migración es idempotente (la función no cambia al reaplicarla)', antes === despues);
  check('la guarda contiene cada capacidad exactamente una vez',
    (despues.match(/ABC_COBRO_INICIAR/g) || []).length === 1 && (despues.match(/ABC_EMISOR_CAMBIAR/g) || []).length === 1);
  check('la función sigue siendo SECURITY DEFINER con search_path vacío',
    /SECURITY DEFINER/.test(despues) && /SET search_path TO ''/.test(despues));
  const estado = (await db.query(`select pg_get_functiondef('public.abc_c07d_estado_configuracion_emision(text,text,text)'::regprocedure) d`)).rows[0].d;
  check('la función de estado sigue siendo STABLE', /STABLE/.test(estado));
  const admin = (await db.query(`select pg_get_functiondef('public.abc_c07d_guardar_emision_config(text,text)'::regprocedure) d`)).rows[0].d;
  check('la función de administración no se tocó', !/ABC_COBRO_INICIAR/.test(admin));
  await db.close();
}

// ---------------------------------------------------------------------------
// C. La función opcional de QA no existe: la migración se aplica igual.
// ---------------------------------------------------------------------------
{
  const db = await nuevaBase({ conQr: false });
  let aplicada = true;
  let error = '';
  try { await db.exec(sqlMigracion); } catch (e) { aplicada = false; error = String(e.message || e); }
  check('sin la función opcional de QA, la migración se aplica', aplicada, error);
  const c = await como(db, 'Cajero/a', 'emitir');
  check('y el Cajero/a ya puede emitir', c.ok, c.error || '');
  await db.close();
}

// ---------------------------------------------------------------------------
// D. La guarda esperada no está: la migración falla en voz alta.
// ---------------------------------------------------------------------------
{
  const db = await nuevaBase();
  await db.exec(`
    create or replace function public.abc_c07d_emitir_checkout(
      p_operation_id text, p_empresa_id text, p_local_id text, p_cuenta_id uuid,
      p_tipo_documento text default 'FACTURA', p_codigo_serie text default null
    ) returns jsonb language plpgsql security definer set search_path='' as $function$
    begin
      if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'OTRA_CAPACIDAD') then
        raise exception 'abc_documento_no_autorizado';
      end if;
      return jsonb_build_object('ok', true);
    end $function$;`);
  let lanzo = false;
  let msg = '';
  try { await db.exec(sqlMigracion); } catch (e) { lanzo = true; msg = String(e.message || e); }
  check('si la guarda esperada no está, la migración falla en voz alta', lanzo && msg.includes('GUARDA_NO_ENCONTRADA'), msg.slice(0, 120));
  await db.close();
}

// ---------------------------------------------------------------------------
// E. La migración no menciona nada que no deba.
// ---------------------------------------------------------------------------
check('la migración no toca tablas ni datos', !/\b(insert\s+into|update\s+\w|delete\s+from|drop\s+table|alter\s+table|truncate)\b/i.test(sqlMigracion.replace(/--.*$/gm, '')));
check('la migración no concede ni revoca privilegios', !/\b(grant|revoke)\b/i.test(sqlMigracion.replace(/--.*$/gm, '')));

console.log(fallos === 0 ? 'C07D_EMISION_COBRO_PGLITE_CONTRACT=PASS' : `C07D_EMISION_COBRO_PGLITE_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
