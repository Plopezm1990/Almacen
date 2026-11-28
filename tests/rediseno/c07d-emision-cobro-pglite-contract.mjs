/**
 * Contrato PGlite de las migraciones
 *   supabase/migrations/20261126120000_abc_f7_c07d_emision_por_capacidad_de_cobro.sql
 *   supabase/migrations/20261126130000_abc_f7_c07d_emision_cobro_acceso_interno.sql
 *
 *   node tests/rediseno/c07d-emision-cobro-pglite-contract.mjs
 *
 * Por qué existe (hallazgo H-38 de la auditoría del TPV, 26/11/2026): con la
 * cuenta de Cajero/a, un cobro se cierra SIN documento fiscal. Causa raíz: la
 * lectura del estado de la configuración fiscal y la emisión del documento
 * exigen `ABC_EMISOR_CAMBIAR`, una capacidad administrativa de «cambiar el
 * emisor» que solo tienen Propietario y Encargado.
 *
 * Lo que enseñó la primera versión (y por qué este contrato modela la cadena
 * ENTERA): la emisión no es una función, son cuatro capas. La entrada
 * `abc_c07d_emitir_checkout` llama por dentro a tres primitivos de numeración
 * fiscal (`abc_reservar_numero_documental`, `abc_resolver_emision_documental`,
 * `abc_c07d_registrar_documento_fiscal`) que vuelven a exigir
 * `ABC_EMISOR_CAMBIAR` al usuario de la sesión. Abrir solo la entrada daba un
 * contrato en verde con funciones de una sola capa y un Cajero/a que seguía sin
 * poder emitir en el servidor real. Aquí no hay ese hueco: la entrada llama a
 * los tres primitivos.
 *
 * Diseño que se fija:
 *   1. Quien puede iniciar un cobro (`ABC_COBRO_INICIAR`) puede, a través de la
 *      ENTRADA, emitir el documento de ese cobro y leer el estado de la emisión.
 *   2. Los PRIMITIVOS no se abren a quien cobra: llamados directamente siguen
 *      exigiendo `ABC_EMISOR_CAMBIAR`. Un Cajero/a no puede reservar números de
 *      documento a su antojo.
 *   3. La entrada, tras su propia autorización, marca la TRANSACCIÓN EN CURSO
 *      (`app.c07d_emision_cobro` = id de transacción) y solo esa marca abre los
 *      primitivos. La marca no sobrevive a la transacción y no vale si se
 *      falsea con otro valor.
 *   4. Las funciones de ADMINISTRACIÓN fiscal siguen exigiendo
 *      `ABC_EMISOR_CAMBIAR`.
 *   5. Las migraciones son idempotentes y fallan en voz alta si la guarda
 *      esperada no está.
 *
 * El esquema es un andamio mínimo: auth.uid(), una tabla de capacidades por
 * cargo con los valores del catálogo, y la cadena de funciones con su guarda
 * ORIGINAL (texto de 20261027160000, 20261001150000 y 20261027163000). Las
 * migraciones se aplican tal cual.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const { PGlite } = await import(
  new URL('file://' + path.join(raiz, 'tests/f3/a09/node_modules/@electric-sql/pglite/dist/index.js').replace(/\\/g, '/'))
);
const M1 = await readFile(path.join(raiz, 'supabase/migrations/20261126120000_abc_f7_c07d_emision_por_capacidad_de_cobro.sql'), 'utf8');
const M2 = await readFile(path.join(raiz, 'supabase/migrations/20261126130000_abc_f7_c07d_emision_cobro_acceso_interno.sql'), 'utf8');

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

  -- Efectos observables de la cadena de emisión.
  create table public.stub_docs (id serial primary key, origen text);
  create table public.stub_registros (id serial primary key, doc_id int);
  create table public.stub_estados (id serial primary key, doc_id int, estado text);
`;

// Los tres PRIMITIVOS, con su guarda original (el de resolver sin espacios, como en el repositorio).
const PRIMITIVOS = `
  create or replace function public.abc_reservar_numero_documental(
    p_operation_id text, p_empresa_id text, p_local_id text, p_tipo_documento text,
    p_codigo_serie text, p_documento_origen_id text, p_metadata jsonb
  ) returns jsonb language plpgsql security definer set search_path='' as $function$
  declare v_id int;
  begin
    if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_EMISOR_CAMBIAR') then
      raise exception 'abc_documento_no_autorizado';
    end if;
    insert into public.stub_docs(origen) values (p_documento_origen_id) returning id into v_id;
    return jsonb_build_object('documento_id', v_id);
  end $function$;

  create or replace function public.abc_resolver_emision_documental(
    p_operation_id text, p_empresa_id text, p_local_id text, p_documento_id int, p_estado text, p_resultado jsonb
  ) returns jsonb language plpgsql security definer set search_path='' as $function$
  begin
    if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_EMISOR_CAMBIAR') then
      raise exception 'abc_documento_no_autorizado';
    end if;
    insert into public.stub_estados(doc_id, estado) values (p_documento_id, p_estado);
    return jsonb_build_object('ok', true);
  end $function$;

  create or replace function public.abc_c07d_registrar_documento_fiscal(
    p_operation_id text, p_empresa_id text, p_local_id text, p_documento_id int, p_payload jsonb
  ) returns jsonb language plpgsql security definer set search_path='' as $function$
  begin
    if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_EMISOR_CAMBIAR') then
      raise exception 'abc_registro_fiscal_no_autorizado';
    end if;
    insert into public.stub_registros(doc_id) values (p_documento_id);
    return jsonb_build_object('ok', true);
  end $function$;
`;

// La ENTRADA: llama a los tres primitivos, igual que la real.
const ENTRADA = `
  create or replace function public.abc_c07d_emitir_checkout(
    p_operation_id text, p_empresa_id text, p_local_id text, p_cuenta_id uuid,
    p_tipo_documento text default 'FACTURA', p_codigo_serie text default null
  ) returns jsonb language plpgsql security definer set search_path='' as $function$
  declare v_reserva jsonb; v_doc int;
  begin
    if auth.uid() is null
       or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_EMISOR_CAMBIAR') then
      raise exception 'abc_documento_no_autorizado';
    end if;
    v_reserva := public.abc_reservar_numero_documental(p_operation_id, p_empresa_id, p_local_id, p_tipo_documento, p_codigo_serie, p_cuenta_id::text, '{}'::jsonb);
    v_doc := (v_reserva->>'documento_id')::int;
    perform public.abc_resolver_emision_documental(p_operation_id, p_empresa_id, p_local_id, v_doc, 'EMITIDO', '{}'::jsonb);
    perform public.abc_c07d_registrar_documento_fiscal(p_operation_id, p_empresa_id, p_local_id, v_doc, '{}'::jsonb);
    return jsonb_build_object('ok', true, 'documento_id', v_doc);
  end $function$;`;

const ESTADO = `
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

const QR_QA = `
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
const ADMIN = `
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
  await db.exec(ANDAMIO + PRIMITIVOS + ENTRADA + ESTADO + ADMIN + (conQr ? QR_QA : ''));
  return db;
}

const U = '00000000-0000-4000-8000-000000000001';
const LLAMADAS = {
  emitir: `select public.abc_c07d_emitir_checkout('op-' || gen_random_uuid()::text,'E','L','${U}'::uuid)`,
  estado: "select public.abc_c07d_estado_configuracion_emision('E','L')",
  qr: `select public.abc_preparar_ticket_fiscal_qa('E','L','${U}'::uuid)`,
  admin: "select public.abc_c07d_guardar_emision_config('E','L')",
  reservar: "select public.abc_reservar_numero_documental('op','E','L','FACTURA',null,'x','{}'::jsonb)",
  resolver: "select public.abc_resolver_emision_documental('op','E','L',1,'EMITIDO','{}'::jsonb)",
  registrar: "select public.abc_c07d_registrar_documento_fiscal('op','E','L',1,'{}'::jsonb)",
};

async function como(db, rol, llamada, autenticado = true) {
  await db.exec(`set test.rol = '${rol}'; set test.uid = '${autenticado ? '11111111-1111-4111-8111-111111111111' : ''}'`);
  return intenta(db, LLAMADAS[llamada]);
}
const cuenta = async (db, tabla) => Number((await db.query(`select count(*)::int n from public.${tabla}`)).rows[0].n);
const def = async (db, firma) => (await db.query(`select pg_get_functiondef('${firma}'::regprocedure) d`)).rows[0].d;

const FIRMAS = {
  entrada: 'public.abc_c07d_emitir_checkout(text,text,text,uuid,text,text)',
  reservar: 'public.abc_reservar_numero_documental(text,text,text,text,text,text,jsonb)',
  resolver: 'public.abc_resolver_emision_documental(text,text,text,integer,text,jsonb)',
  registrar: 'public.abc_c07d_registrar_documento_fiscal(text,text,text,integer,jsonb)',
  estado: 'public.abc_c07d_estado_configuracion_emision(text,text,text)',
  admin: 'public.abc_c07d_guardar_emision_config(text,text)',
};

// ---------------------------------------------------------------------------
// A. ANTES de las migraciones: se reproduce H-38.
// ---------------------------------------------------------------------------
{
  const db = await nuevaBase();
  const r1 = await como(db, 'Cajero/a', 'emitir');
  check('H-38 reproducido: el Cajero/a NO puede emitir', !r1.ok && r1.error.includes('abc_documento_no_autorizado'), r1.error);
  const r2 = await como(db, 'Cajero/a', 'estado');
  check('H-38 reproducido: el Cajero/a NO puede leer el estado fiscal', !r2.ok && r2.error.includes('C07D_CONFIG_NO_AUTORIZADO'), r2.error);
  await db.close();
}

// ---------------------------------------------------------------------------
// B. SOLO la primera migración: el estado parcial que se encontró en QA.
//    Es la prueba que faltó: abrir solo la entrada no basta.
// ---------------------------------------------------------------------------
{
  const db = await nuevaBase();
  await db.exec(M1);
  const est = await como(db, 'Cajero/a', 'estado');
  check('solo con la primera migración el Cajero/a ya lee el estado fiscal', est.ok, est.error || '');
  const emi = await como(db, 'Cajero/a', 'emitir');
  check('PERO solo con la primera migración el Cajero/a sigue sin poder emitir (falla dentro, en un primitivo)',
    !emi.ok && /abc_documento_no_autorizado/.test(emi.error), emi.error || 'no lanzó error');
  check('y no deja ningún documento a medias', (await cuenta(db, 'stub_docs')) === 0);
  await db.close();
}

// ---------------------------------------------------------------------------
// C. Con LAS DOS migraciones.
// ---------------------------------------------------------------------------
{
  const db = await nuevaBase();
  await db.exec(M1);
  await db.exec(M2);

  // C1. La entrada, de extremo a extremo, para quien inicia cobros.
  for (const rol of ['Propietario', 'Encargado', 'Cajero/a', 'Camarero/a']) {
    const docs = await cuenta(db, 'stub_docs');
    const r = await como(db, rol, 'emitir');
    check(`${rol} emite el documento de su cobro de extremo a extremo`, r.ok, r.error || '');
    check(`${rol}: la emisión crea un documento, un estado y un registro fiscal`,
      (await cuenta(db, 'stub_docs')) === docs + 1 && (await cuenta(db, 'stub_estados')) >= 1 && (await cuenta(db, 'stub_registros')) >= 1);
    for (const llamada of ['estado', 'qr']) {
      const r2 = await como(db, rol, llamada);
      check(`${rol} puede ${llamada}`, r2.ok, r2.error || '');
    }
  }
  for (const llamada of ['emitir', 'estado', 'qr']) {
    const sin = await como(db, 'Sin cobro', llamada);
    check(`un cargo sin cobro NO puede ${llamada}`, !sin.ok, sin.error || 'no lanzó error');
    const ses = await como(db, 'Propietario', llamada, false);
    check(`sin sesión NO puede ${llamada}`, !ses.ok, ses.error || 'no lanzó error');
  }
  const antes = await cuenta(db, 'stub_docs');
  await como(db, 'Sin cobro', 'emitir');
  check('un cargo sin cobro no deja documentos al intentar emitir', (await cuenta(db, 'stub_docs')) === antes);

  // C2. Los PRIMITIVOS no se abren a quien cobra.
  for (const prim of ['reservar', 'resolver', 'registrar']) {
    const enc = await como(db, 'Encargado', prim);
    check(`el primitivo ${prim} sigue abierto al Encargado`, enc.ok, enc.error || '');
    for (const rol of ['Cajero/a', 'Camarero/a', 'Sin cobro']) {
      const r = await como(db, rol, prim);
      check(`el primitivo ${prim} llamado DIRECTAMENTE sigue CERRADO a ${rol}`, !r.ok && /no_autorizado/.test(r.error), r.error || 'no lanzó error');
    }
  }

  // C3. La marca interna no se puede falsear ni sobrevive a la transacción.
  await db.exec(`set test.rol = 'Cajero/a'; set test.uid = '11111111-1111-4111-8111-111111111111'`);
  await db.exec(`select set_config('app.c07d_emision_cobro', '1', false)`);
  const falsa = await intenta(db, LLAMADAS.reservar);
  check('una marca falseada (valor de sesión que no es el id de transacción) NO abre el primitivo', !falsa.ok && /no_autorizado/.test(falsa.error), falsa.error || 'no lanzó error');
  await db.exec(`select set_config('app.c07d_emision_cobro', '', false)`);
  await como(db, 'Cajero/a', 'emitir');
  const trasEmitir = await como(db, 'Cajero/a', 'reservar');
  check('tras emitir, la marca interna ya no existe: el primitivo vuelve a estar cerrado', !trasEmitir.ok && /no_autorizado/.test(trasEmitir.error), trasEmitir.error || 'no lanzó error');
  const fn = (await db.query(`select pg_get_functiondef('private.abc_emision_cobro_interna()'::regprocedure) d`)).rows[0].d;
  check('la función de la marca compara con el id de la transacción y no con una constante',
    /txid_current\(\)/.test(fn) && /app\.c07d_emision_cobro/.test(fn));
  const priv = (await db.query(`select has_function_privilege('public', 'private.abc_emision_cobro_interna()', 'execute') p`)).rows[0].p;
  check('la función de la marca no es ejecutable por PUBLIC', priv === false);

  // C4. No se ensancha la administración fiscal.
  const adminEnc = await como(db, 'Encargado', 'admin');
  check('la administración fiscal sigue abierta al Encargado', adminEnc.ok, adminEnc.error || '');
  for (const rol of ['Cajero/a', 'Camarero/a', 'Sin cobro']) {
    const r = await como(db, rol, 'admin');
    check(`la administración fiscal sigue CERRADA a ${rol}`, !r.ok && r.error.includes('C07D_CONFIG_NO_AUTORIZADO'), r.error || '');
  }
  const admin = await def(db, FIRMAS.admin);
  check('la función de administración no se tocó', !/ABC_COBRO_INICIAR|abc_emision_cobro_interna/.test(admin));

  // C5. Idempotencia de las dos migraciones.
  const antesDefs = {};
  for (const [k, f] of Object.entries(FIRMAS)) antesDefs[k] = await def(db, f);
  await db.exec(M1);
  await db.exec(M2);
  let iguales = true;
  for (const [k, f] of Object.entries(FIRMAS)) if ((await def(db, f)) !== antesDefs[k]) iguales = false;
  check('las migraciones son idempotentes (ninguna función cambia al reaplicarlas)', iguales);
  const entrada = antesDefs.entrada;
  check('la entrada tiene cada capacidad una vez y pone la marca una vez',
    (entrada.match(/ABC_COBRO_INICIAR/g) || []).length === 1 && (entrada.match(/ABC_EMISOR_CAMBIAR/g) || []).length === 1
    && (entrada.match(/app\.c07d_emision_cobro/g) || []).length === 1);
  check('la marca se pone DESPUÉS de la autorización de la entrada',
    entrada.indexOf("raise exception 'abc_documento_no_autorizado'") < entrada.indexOf('app.c07d_emision_cobro'));
  for (const k of ['reservar', 'resolver', 'registrar']) {
    check(`el primitivo ${k} conserva su capacidad y suma solo la marca interna`,
      /ABC_EMISOR_CAMBIAR/.test(antesDefs[k]) && (antesDefs[k].match(/abc_emision_cobro_interna\(\)/g) || []).length === 1 && !/ABC_COBRO_INICIAR/.test(antesDefs[k]));
  }
  check('la entrada sigue siendo SECURITY DEFINER con search_path vacío', /SECURITY DEFINER/.test(entrada) && /SET search_path TO ''/.test(entrada));
  check('la función de estado sigue siendo STABLE', /STABLE/.test(antesDefs.estado));
  await db.close();
}

// ---------------------------------------------------------------------------
// D. La función opcional de QA no existe: las migraciones se aplican igual.
// ---------------------------------------------------------------------------
{
  const db = await nuevaBase({ conQr: false });
  let aplicadas = true;
  let error = '';
  try { await db.exec(M1); await db.exec(M2); } catch (e) { aplicadas = false; error = String(e.message || e); }
  check('sin la función opcional de QA, las migraciones se aplican', aplicadas, error);
  const c = await como(db, 'Cajero/a', 'emitir');
  check('y el Cajero/a emite de extremo a extremo', c.ok, c.error || '');
  await db.close();
}

// ---------------------------------------------------------------------------
// D2. Revision de codigo de #226: la marca de idempotencia es el texto EXACTO insertado. Una funcion que ya NOMBRA ABC_COBRO_INICIAR en otro
//     sitio (aqui, un comentario) pero conserva la guarda original SE PARCHEA igualmente; antes la migracion la daba por aplicada en silencio.
// ---------------------------------------------------------------------------
{
  const db = await nuevaBase();
  await db.exec(`
    create or replace function public.abc_c07d_estado_configuracion_emision(
      p_empresa_id text, p_local_id text, p_tipo_documento text default 'FACTURA'
    ) returns jsonb language plpgsql stable security definer set search_path='' as $function$
    begin
      -- nota historica: antes tambien se hablaba de ABC_COBRO_INICIAR en otro contexto
      if auth.uid() is null
         or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_EMISOR_CAMBIAR') then
        raise exception 'C07D_CONFIG_NO_AUTORIZADO' using errcode = '42501';
      end if;
      return jsonb_build_object('ok', true, 'configurada', true);
    end $function$;`);
  const antes = await como(db, 'Cajero/a', 'estado');
  check('D2 antes: el Cajero/a no lee el estado fiscal aunque la funcion nombre ABC_COBRO_INICIAR en un comentario', !antes.ok && antes.error.includes('C07D_CONFIG_NO_AUTORIZADO'), antes.error || '');
  await db.exec(M1);
  const despues = await como(db, 'Cajero/a', 'estado');
  check('D2 despues de la migracion el Cajero/a SI lo lee (el parche se aplico, no se dio por hecho)', despues.ok, despues.error || '');
  await db.close();
}

// ---------------------------------------------------------------------------
// E. Si la guarda esperada no está, las migraciones fallan en voz alta.
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
  try { await db.exec(M1); } catch (e) { lanzo = true; msg = String(e.message || e); }
  check('M1: si la guarda esperada no está, falla en voz alta', lanzo && msg.includes('GUARDA_NO_ENCONTRADA'), msg.slice(0, 120));
  await db.close();
}
{
  const db = await nuevaBase();
  await db.exec(M1);
  await db.exec(`
    create or replace function public.abc_reservar_numero_documental(
      p_operation_id text, p_empresa_id text, p_local_id text, p_tipo_documento text,
      p_codigo_serie text, p_documento_origen_id text, p_metadata jsonb
    ) returns jsonb language plpgsql security definer set search_path='' as $function$
    begin
      if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'OTRA_CAPACIDAD') then
        raise exception 'abc_documento_no_autorizado';
      end if;
      return jsonb_build_object('documento_id', 1);
    end $function$;`);
  let lanzo = false;
  let msg = '';
  try { await db.exec(M2); } catch (e) { lanzo = true; msg = String(e.message || e); }
  check('M2: si la guarda de un primitivo no está, falla en voz alta y no deja la cadena a medias', lanzo && msg.includes('GUARDA_NO_ENCONTRADA'), msg.slice(0, 120));
  const intacta = await def(db, FIRMAS.entrada);
  check('M2 fallida: la entrada no quedó marcada (la transacción se deshizo)', !/app\.c07d_emision_cobro/.test(intacta));
  await db.close();
}

// ---------------------------------------------------------------------------
// F. Las migraciones no mencionan nada que no deban.
// ---------------------------------------------------------------------------
const sinComentarios = (s) => s.replace(/--.*$/gm, '');
for (const [nombre, sql] of [['M1', M1], ['M2', M2]]) {
  const c = sinComentarios(sql);
  check(`${nombre} no toca tablas ni datos`, !/\b(insert\s+into|update\s+\w|delete\s+from|drop\s+table|alter\s+table|truncate)\b/i.test(c));
}
check('M1 no concede ni revoca privilegios', !/\b(grant|revoke)\b/i.test(sinComentarios(M1)));
check('M2 solo revoca privilegios de su propia función privada y no concede ninguno',
  !/\bgrant\b/i.test(sinComentarios(M2)) &&
  (sinComentarios(M2).match(/\brevoke\b[^;]*;/gi) || []).every((r) => /private\.abc_emision_cobro_interna\(\)/.test(r)));

console.log(fallos === 0 ? 'C07D_EMISION_COBRO_PGLITE_CONTRACT=PASS' : `C07D_EMISION_COBRO_PGLITE_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
