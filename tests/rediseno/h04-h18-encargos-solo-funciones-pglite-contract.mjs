/**
 * Contrato PGlite de la migración
 *   supabase/migrations/20261128100000_abc_f6_encargos_solo_funciones_y_privilegios.sql
 *
 *   node tests/rediseno/h04-h18-encargos-solo-funciones-pglite-contract.mjs
 *
 * Hallazgos H-04 y H-18 (auditoría del TPV, 25/11/2026): `encargos_empresa` se podía escribir con la sesión del
 * usuario (políticas INSERT/UPDATE por pertenecer al local) y `pagos_encargo` conservaba privilegios de escritura
 * que solo la falta de políticas neutralizaba. En QA (27/11/2026) además `authenticated` tenía TRUNCATE, REFERENCES
 * y TRIGGER sobre 13 tablas y la vista `stock_estado` tenía privilegios de escritura.
 *
 * Qué se fija:
 *   A. Estado de QA reproducido: ANTES, un miembro del local puede insertar y modificar encargos con la tabla.
 *   B. DESPUÉS: no puede escribir encargos ni sus pagos (por tabla), conserva SELECT, y las funciones SECURITY
 *      DEFINER (registrar_encargo, registrar_pago_encargo, revertir_pago_encargo) siguen escribiendo.
 *   C. TRUNCATE/REFERENCES/TRIGGER desaparecen de todas las tablas; los INSERT/UPDATE/DELETE de otras tablas con
 *      política (p. ej. clientes_empresa) NO se tocan; la vista de stock queda de solo lectura.
 *   D. Idempotente; falla en voz alta si falta una función de servidor (la interfaz se quedaría sin camino).
 *   E. Estático: ningún JavaScript entregado escribe `encargos_empresa` ni `pagos_encargo` directamente.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, readdir } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const { PGlite } = await import(
  new URL('file://' + path.join(raiz, 'tests/f3/a09/node_modules/@electric-sql/pglite/dist/index.js').replace(/\\/g, '/'))
);
const MIG = await readFile(path.join(raiz, 'supabase/migrations/20261128100000_abc_f6_encargos_solo_funciones_y_privilegios.sql'), 'utf8');

let fallos = 0;
function check(nombre, ok, detalle = '') {
  if (!ok) fallos++;
  console.log(`${ok ? '[OK]  ' : '[FAIL]'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}
async function intenta(db, sql) {
  try { return { ok: true, filas: (await db.query(sql)).rows }; }
  catch (e) { return { ok: false, error: String(e && (e.message || e)) }; }
}
// Ejecuta `sql` con el rol del cliente (como lo haría PostgREST) y vuelve al rol propietario.
async function comoCliente(db, sql, rol = 'authenticated') {
  await db.exec(`set role ${rol}`);
  const r = await intenta(db, sql);
  await db.exec('reset role');
  return r;
}
const priv = async (db, rol, tabla, p) =>
  (await db.query(`select has_table_privilege('${rol}', '${tabla}', '${p}') v`)).rows[0].v;

// Andamio con el estado de QA medido el 27/11/2026: authenticated con todo, políticas de insert/update en encargos.
const ANDAMIO = `
  create role anon nologin; create role authenticated nologin;
  create schema private;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select '11111111-1111-4111-8111-111111111111'::uuid $$;
  create function private.la_tiene_empresa(e text) returns boolean language sql stable as $$ select e = 'E1' $$;
  create function private.la_tiene_local(e text, l text) returns boolean language sql stable as $$ select l = 'L1' $$;
  grant usage on schema public, private, auth to authenticated, anon;
  grant execute on all functions in schema private, auth to authenticated, anon;

  create table public.encargos_empresa (
    id text primary key, empresa_id text not null, local_id text not null, cliente_id text,
    datos jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
  alter table public.encargos_empresa enable row level security;
  create policy pm14_encargos_select on public.encargos_empresa for select using (private.la_tiene_empresa(empresa_id) and private.la_tiene_local(empresa_id, local_id));
  create policy pm14_encargos_insert on public.encargos_empresa for insert with check (private.la_tiene_empresa(empresa_id) and private.la_tiene_local(empresa_id, local_id));
  create policy pm14_encargos_update on public.encargos_empresa for update using (private.la_tiene_empresa(empresa_id) and private.la_tiene_local(empresa_id, local_id)) with check (private.la_tiene_empresa(empresa_id) and private.la_tiene_local(empresa_id, local_id));

  create table public.pagos_encargo (
    id text primary key, operation_id text not null unique, encargo_id text not null, empresa_id text not null, local_id text not null,
    concepto text not null, importe numeric not null, estado text not null);
  alter table public.pagos_encargo enable row level security;
  create policy pm14_pagos_encargo_select on public.pagos_encargo for select using (private.la_tiene_empresa(empresa_id) and private.la_tiene_local(empresa_id, local_id));

  -- Otra tabla que la interfaz SÍ escribe con sesión de usuario (política propia): sus escrituras no deben tocarse.
  create table public.clientes_empresa (id text primary key, empresa_id text not null, datos jsonb not null default '{}'::jsonb);
  alter table public.clientes_empresa enable row level security;
  create policy clientes_todo on public.clientes_empresa for all using (private.la_tiene_empresa(empresa_id)) with check (private.la_tiene_empresa(empresa_id));

  create table public.stock_ubicacion (empresa_id text, local_id text, producto_id text, almacen numeric);
  create view public.stock_estado with (security_invoker = true) as select empresa_id, local_id, producto_id, almacen from public.stock_ubicacion;

  -- Las funciones de servidor que escriben (en producción son SECURITY DEFINER y propiedad de un rol con BYPASSRLS).
  create function public.registrar_encargo(p_id text, p_empresa_id text, p_local_id text) returns jsonb
    language plpgsql security definer set search_path = 'public', 'pg_temp' as $f$
  begin
    insert into public.encargos_empresa(id, empresa_id, local_id) values (p_id, p_empresa_id, p_local_id)
      on conflict (id) do update set updated_at = now();
    return jsonb_build_object('ok', true);
  end $f$;
  create function public.registrar_pago_encargo(p_id text, p_encargo_id text, p_importe numeric) returns jsonb
    language plpgsql security definer set search_path = 'public', 'pg_temp' as $f$
  begin
    insert into public.pagos_encargo(id, operation_id, encargo_id, empresa_id, local_id, concepto, importe, estado)
    values (p_id, 'op:' || p_id, p_encargo_id, 'E1', 'L1', 'SEÑAL', p_importe, 'CONFIRMADO');
    return jsonb_build_object('ok', true);
  end $f$;
  create function public.revertir_pago_encargo(p_id text) returns jsonb
    language plpgsql security definer set search_path = 'public', 'pg_temp' as $f$
  begin
    update public.pagos_encargo set estado = 'REVERSO' where id = p_id;
    return jsonb_build_object('ok', true);
  end $f$;
  grant execute on function public.registrar_encargo(text, text, text), public.registrar_pago_encargo(text, text, numeric),
    public.revertir_pago_encargo(text) to authenticated;

  -- Estado de QA el 27/11/2026: authenticated con todos los privilegios sobre tablas y vista.
  grant all on all tables in schema public to authenticated;
`;

async function base(conMigracion = true) {
  const db = new PGlite();
  await db.exec(ANDAMIO);
  if (conMigracion) await db.exec(MIG);
  return db;
}

// ---------- A: estado de QA reproducido (antes) ----------
{
  const db = await base(false);
  const ins = await comoCliente(db, `insert into public.encargos_empresa(id, empresa_id, local_id, datos) values ('E-X','E1','L1','{"total":9999,"estado":"Entregado"}')`);
  check('A1 ANTES: un miembro del local inserta un encargo con la tabla, sin validación del servidor', ins.ok, ins.error || '');
  const upd = await comoCliente(db, `update public.encargos_empresa set datos = '{"total":0,"estado":"Cancelado"}' where id = 'E-X'`);
  check('A2 ANTES: ...y cambia su total y su estado', upd.ok, upd.error || '');
  check('A3 ANTES: authenticated tiene TRUNCATE sobre encargos y pagos', (await priv(db, 'authenticated', 'public.encargos_empresa', 'TRUNCATE')) && (await priv(db, 'authenticated', 'public.pagos_encargo', 'TRUNCATE')));
  check('A4 ANTES: la vista de stock admite escritura', await priv(db, 'authenticated', 'public.stock_estado', 'INSERT'));
}

// ---------- B: después ----------
{
  const db = await base(true);
  const ins = await comoCliente(db, `insert into public.encargos_empresa(id, empresa_id, local_id) values ('E-Y','E1','L1')`);
  check('B1 DESPUÉS: no se puede insertar un encargo con la tabla', !ins.ok && /permission denied/i.test(ins.error || ''), ins.error || 'se insertó');
  const upd = await comoCliente(db, `update public.encargos_empresa set datos = '{}'`);
  check('B2 DESPUÉS: no se puede modificar', !upd.ok && /permission denied/i.test(upd.error || ''), upd.error || 'se modificó');
  const del = await comoCliente(db, `delete from public.encargos_empresa`);
  check('B3 DESPUÉS: no se puede borrar', !del.ok && /permission denied/i.test(del.error || ''), del.error || 'se borró');
  const pins = await comoCliente(db, `insert into public.pagos_encargo(id, operation_id, encargo_id, empresa_id, local_id, concepto, importe, estado) values ('P-X','o','E-Y','E1','L1','SEÑAL',5,'CONFIRMADO')`);
  check('B4 DESPUÉS: no se puede insertar un pago de encargo con la tabla', !pins.ok && /permission denied/i.test(pins.error || ''), pins.error || 'se insertó');
  const trunc = await comoCliente(db, `truncate public.pagos_encargo`);
  check('B5 DESPUÉS: no se puede vaciar pagos_encargo (TRUNCATE no pasa por RLS)', !trunc.ok && /permission denied/i.test(trunc.error || ''), trunc.error || 'se vació');

  // Las funciones de servidor siguen escribiendo, y el cliente lee lo suyo.
  const f1 = await comoCliente(db, `select public.registrar_encargo('E-Z','E1','L1')`);
  const f2 = await comoCliente(db, `select public.registrar_pago_encargo('P-Z','E-Z',5)`);
  const f3 = await comoCliente(db, `select public.revertir_pago_encargo('P-Z')`);
  check('B6 las tres funciones de servidor siguen escribiendo', f1.ok && f2.ok && f3.ok, [f1, f2, f3].map((r) => r.error || 'ok').join(' | '));
  const lee = await comoCliente(db, `select (select count(*) from public.encargos_empresa) e, (select count(*) from public.pagos_encargo) p`);
  check('B7 authenticated sigue leyendo encargos y pagos de su local (RLS de SELECT intacta)', lee.ok && Number(lee.filas[0].e) === 1 && Number(lee.filas[0].p) === 1, JSON.stringify(lee.filas || lee.error));
  const pol = (await db.query(`select policyname from pg_policies where tablename = 'encargos_empresa' order by 1`)).rows.map((r) => r.policyname);
  check('B8 solo queda la política SELECT en encargos_empresa', pol.length === 1 && pol[0] === 'pm14_encargos_select', pol.join(','));
  check('B9 anon no tiene ningún privilegio de escritura sobre ellas', !(await priv(db, 'anon', 'public.encargos_empresa', 'INSERT')) && !(await priv(db, 'anon', 'public.pagos_encargo', 'UPDATE')));
}

// ---------- C: el resto no se toca ----------
{
  const db = await base(true);
  check('C1 TRUNCATE, REFERENCES y TRIGGER fuera de todas las tablas (también de clientes_empresa)',
    !(await priv(db, 'authenticated', 'public.clientes_empresa', 'TRUNCATE')) && !(await priv(db, 'authenticated', 'public.clientes_empresa', 'TRIGGER')) && !(await priv(db, 'authenticated', 'public.clientes_empresa', 'REFERENCES')));
  const w = await comoCliente(db, `insert into public.clientes_empresa(id, empresa_id) values ('C1','E1')`);
  const u = await comoCliente(db, `update public.clientes_empresa set datos = '{"a":1}' where id = 'C1'`);
  const d = await comoCliente(db, `delete from public.clientes_empresa where id = 'C1'`);
  check('C2 una tabla que la interfaz escribe con política (clientes_empresa) conserva INSERT/UPDATE/DELETE', w.ok && u.ok && d.ok, [w, u, d].map((r) => r.error || 'ok').join(' | '));
  const vista = await comoCliente(db, `insert into public.stock_estado(empresa_id, local_id, producto_id, almacen) values ('E1','L1','P',1)`);
  check('C3 la vista de stock queda de solo lectura', !vista.ok && /permission denied/i.test(vista.error || ''), vista.error || 'se escribió');
  const lee = await comoCliente(db, `select count(*) from public.stock_estado`);
  check('C4 ...y se puede leer', lee.ok, lee.error || '');
}

// ---------- D: idempotencia y fallo en voz alta ----------
{
  const db = await base(true);
  const otra = await intenta(db, MIG);
  check('D1 la migración es idempotente (segunda ejecución sin error)', otra.ok, otra.error || '');
  const sinFuncion = new PGlite();
  await sinFuncion.exec(ANDAMIO + '\n drop function public.revertir_pago_encargo(text);');
  const r = await intenta(sinFuncion, MIG);
  check('D2 sin una función de servidor de encargos, falla en voz alta y no revoca nada', !r.ok && /FUNCION_OBLIGATORIA_NO_ENCONTRADA/.test(r.error || '') && (await priv(sinFuncion, 'authenticated', 'public.encargos_empresa', 'INSERT')), r.error || 'no falló');
  const sinTabla = new PGlite();
  await sinTabla.exec(ANDAMIO + '\n drop function public.registrar_pago_encargo(text, text, numeric); drop function public.revertir_pago_encargo(text); drop table public.pagos_encargo;');
  const r2 = await intenta(sinTabla, MIG);
  check('D3 sin la tabla de pagos, falla en voz alta', !r2.ok && /TABLA_OBLIGATORIA_NO_ENCONTRADA/.test(r2.error || ''), r2.error || 'no falló');
}

// ---------- E: ningún JavaScript entregado escribe estas tablas directamente ----------
{
  const archivos = [];
  async function recorre(dir, prof = 0) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'tests' || e.name === 'docs' || e.name === 'source-recovery' || e.name === 'supabase') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (prof < 3) await recorre(p, prof + 1); }
      else if (/\.(js|mjs|html)$/.test(e.name)) archivos.push(p);
    }
  }
  await recorre(raiz);
  const infractores = [];
  for (const f of archivos) {
    const t = await readFile(f, 'utf8');
    if (/\.from\(\s*["'`](encargos_empresa|pagos_encargo)["'`]\s*\)\s*\.(insert|upsert|update|delete)\b/.test(t)) infractores.push(path.relative(raiz, f));
  }
  check(`E1 ninguno de los ${archivos.length} archivos entregados escribe encargos_empresa/pagos_encargo con .from(...)`, infractores.length === 0, infractores.join(', '));
  const fuente = await readFile(path.join(raiz, 'fuente.js'), 'utf8');
  check('E2 la interfaz escribe encargos solo con las funciones de servidor',
    /rpc\("registrar_encargo"/.test(fuente) && /rpc\("registrar_pago_encargo"/.test(fuente) && /rpc\("revertir_pago_encargo"/.test(fuente));
}

console.log(fallos === 0 ? 'H04_H18_ENCARGOS_SOLO_FUNCIONES_CONTRACT=PASS' : `H04_H18_ENCARGOS_SOLO_FUNCIONES_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
