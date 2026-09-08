import pg from 'pg';
import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM14 P07: concurrencia real sobre registrar_pago_encargo. Dos llamadas concurrentes
// con el MISMO operation_id deben serializarse por el advisory lock que ya usa PM08
// (private.pm08_bloquear_operation_id, reutilizado sin cambios) y la segunda debe
// resolverse como replay, nunca como un segundo cobro.

const url = new URL(process.env.PM14_TEST_DATABASE_URL || 'postgresql://postgres:pm14-local-only@127.0.0.1:5432/pm14_p02_test');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Only loopback databases are allowed');
assert.equal(url.pathname, '/pm14_p02_test', 'Only the disposable PM14 test database is allowed');

const admin = new pg.Client({ connectionString: url.href });
await admin.connect();
const clients = [];
const sql = (p) => fs.readFileSync(p, 'utf8');
const migration = (name) => sql('supabase/migrations/' + name);
const extract = (source, name) => {
  const i = source.indexOf('create or replace function ' + name + '(');
  assert.ok(i >= 0, name);
  const end = source.indexOf('$$;', i);
  assert.ok(end > i, name);
  return source.slice(i, end + '$$;'.length);
};

async function actor(role = 'Propietario', uid = '11111111-1111-1111-1111-111111111111') {
  const c = new pg.Client({ connectionString: url.href });
  await c.connect();
  clients.push(c);
  await c.query("select set_config('pm14.actor',$1,false),set_config('pm14.rol',$2,false)", [uid, role]);
  await c.query('set role authenticated');
  return c;
}

const registrarEncargo = async (c, args) =>
  (await c.query('select public.registrar_encargo($1,$2,$3,$4,$5,$6,$7::jsonb) as r', args)).rows[0].r;
const registrarPagoSql = 'select public.registrar_pago_encargo($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) as r';

try {
  assert.equal((await admin.query('select current_database() as db')).rows[0].db, 'pm14_p02_test');

  await admin.query(`
    drop schema if exists public cascade; drop schema if exists private cascade; drop schema if exists auth cascade;
    create schema public; create schema private; create schema auth;
    do $$begin
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
    end$$;
    grant usage on schema public, private, auth to authenticated, anon;
    grant all on all tables in schema public to authenticated;

    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('pm14.actor', true), '')::uuid$$;
    create function private.la_usuario_activo() returns boolean language sql stable as $$select auth.uid() is not null$$;
    create function private.la_rol() returns text language sql stable as $$select current_setting('pm14.rol', true)$$;
    create function private.la_tiene_empresa(p_empresa text) returns boolean language sql stable as $$select private.la_usuario_activo() and p_empresa = 'E'$$;
    create function private.la_tiene_local(p_empresa text, p_local text) returns boolean language sql stable as $$select private.la_usuario_activo() and p_empresa = 'E' and p_local = 'L'$$;
    create function private.pm08_puede_operar_caja() returns boolean language sql stable as $$select private.la_usuario_activo() and coalesce(private.la_rol(),'') in ('Propietario','Encargado','Cajero/a')$$;
    create function private.pm06_puede_gestionar_finanzas() returns boolean language sql stable as $$select private.la_usuario_activo() and coalesce(private.la_rol(),'') in ('Propietario','Encargado')$$;

    create table public.stock_ubicacion(empresa_id text, local_id text, producto_id text, local_operable boolean default true);
    create table public.almacen_kv(key text primary key, value jsonb, empresa_id text, local_id text);
    create function private.pm08_local_operable(p_empresa_id text, p_local_id text) returns boolean language sql stable as $$
      select not exists(select 1 from public.stock_ubicacion s where s.empresa_id=p_empresa_id and s.local_id=p_local_id and s.local_operable=false)
    $$;

    create table public.stock_operaciones(operation_id text primary key);
    create table public.caja_operaciones(operation_id text primary key);
    create table public.pagos_factura(operation_id text primary key);
  `);

  const pm08 = migration('20260904204500_pm08_caja_devolucion_indivisible.sql');
  await admin.query(extract(pm08, 'private.pm08_validar_operation_id') + extract(pm08, 'private.pm08_bloquear_operation_id') + extract(pm08, 'private.pm08_validar_dinero'));
  await admin.query(sql('supabase/migrations/20260908071757_pm14_p02_encargos_pagos_encargo.sql'));

  await admin.query("insert into public.stock_ubicacion(empresa_id,local_id,producto_id) values ('E','L','p');");

  const owner = await actor('Propietario');
  await registrarEncargo(owner, ['enc-1', 'E', 'L', 'c1', 20, 'Pendiente', '{}']);

  const a = await actor('Propietario', '11111111-1111-1111-1111-111111111111');
  const b = await actor('Propietario', '11111111-1111-1111-1111-111111111111');
  const pagoArgs = ['pago-1', 'anticipo-encargo:enc-1:senal', 'enc-1', 'E', 'L', 'SEÑAL', 5, '2026-09-08', 'Tarjeta', '{}'];

  // A adquiere el advisory lock (private.pm08_bloquear_operation_id) y ya tiene su
  // resultado, pero como sigue dentro de una transaccion sin confirmar, el lock
  // permanece retenido hasta el commit -- igual que en el patron ya probado de PM12.
  await a.query('begin');
  const first = await a.query(registrarPagoSql, pagoArgs);

  let bSettled = false;
  const second = b.query(registrarPagoSql, pagoArgs).then((r) => { bSettled = true; return r; });

  let blocked = false;
  for (let i = 0; i < 100; i++) {
    const r = await admin.query("select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like 'select public.registrar_pago_encargo%'");
    if (r.rowCount > 0) { blocked = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(blocked, true, 'la segunda llamada concurrente con el mismo operation_id debe esperar el advisory lock');
  assert.equal(bSettled, false, 'no debe resolverse mientras A no confirme');
  assert.equal(first.rows[0].r.ok, true, JSON.stringify(first.rows[0].r));

  await a.query('commit');
  const resultB = (await second).rows[0].r;

  assert.equal(resultB.ok, true, JSON.stringify(resultB));
  assert.equal(resultB.replayed, true, 'la segunda llamada concurrente debe resolverse como replay, no como un segundo cobro');

  const filas = await admin.query("select count(*) as n from public.pagos_encargo where encargo_id='enc-1'");
  assert.equal(Number(filas.rows[0].n), 1, 'no debe quedar mas de un cobro pese a la carrera real');
  console.log('P07_PG_CONCURRENCIA_REAL_MISMO_OPERATION_ID=PASS');
} finally {
  for (const c of clients) await c.end().catch(() => {});
  await admin.end();
}
