import pg from 'pg';
import fs from 'node:fs';
import assert from 'node:assert/strict';

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
const registrarPago = async (c, args) =>
  (await c.query('select public.registrar_pago_encargo($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) as r', args)).rows[0].r;
const revertirPago = async (c, args) =>
  (await c.query('select public.revertir_pago_encargo($1,$2,$3,$4) as r', args)).rows[0].r;

async function reset() {
  await admin.query('truncate public.pagos_encargo, public.encargos_empresa cascade;');
  await admin.query("update public.stock_ubicacion set local_operable=true where local_id='L';");
}

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

    -- Estado y helpers minimos: no se reimplementa la cadena real de PM11
    -- (perfiles/membresias/empleados), solo lo que registrar_pago_encargo/
    -- revertir_pago_encargo necesitan: presencia de sesion, rol activo y
    -- pertenencia a empresa/local. Ese resto ya tiene su propio contrato en PM05/PM11.
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
  const cajero = await actor('Cajero/a', '22222222-2222-2222-2222-222222222222');
  const basico = await actor('Básico', '33333333-3333-3333-3333-333333333333');

  // --- Camino feliz: registrar el espejo del encargo, cobrar una señal parcial. ---
  let r = await registrarEncargo(owner, ['enc-1', 'E', 'L', 'c1', 20, 'Pendiente', '{}']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.encargo.datos.total, 20);

  r = await registrarPago(cajero, ['pago-1', 'anticipo-encargo:enc-1:1', 'enc-1', 'E', 'L', 'SEÑAL', 5, '2026-09-08', 'Tarjeta', '{}']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.replayed, false);
  assert.equal(r.pagado, 5);
  assert.equal(r.pendiente, 15);
  console.log('P02_PG_ALTA_Y_SEÑAL_OK=PASS');

  // --- Replay: mismo operation_id + mismo payload = no duplica. ---
  r = await registrarPago(cajero, ['pago-1', 'anticipo-encargo:enc-1:1', 'enc-1', 'E', 'L', 'SEÑAL', 5, '2026-09-08', 'Tarjeta', '{}']);
  assert.equal(r.ok, true);
  assert.equal(r.replayed, true);
  assert.equal(Number((await admin.query("select count(*) from public.pagos_encargo where encargo_id='enc-1'")).rows[0].count), 1);
  console.log('P02_PG_REPLAY_MISMO_PAYLOAD=PASS');

  // --- Conflicto: mismo operation_id, payload distinto. ---
  await assert.rejects(
    registrarPago(cajero, ['pago-1', 'anticipo-encargo:enc-1:1', 'enc-1', 'E', 'L', 'SEÑAL', 6, '2026-09-08', 'Tarjeta', '{}']),
    /operation_id_conflict/
  );
  console.log('P02_PG_CONFLICTO_PAYLOAD_DISTINTO=PASS');

  // --- No sobrecobro: pedir más de lo pendiente (15) se rechaza. ---
  await assert.rejects(
    registrarPago(cajero, ['pago-2', 'entrega-encargo:enc-1:resto', 'enc-1', 'E', 'L', 'RESTO_ENTREGA', 16, '2026-09-08', 'Efectivo', '{}']),
    /pago_supera_saldo/
  );
  console.log('P02_PG_NO_SOBRECOBRO=PASS');

  // --- Liquidar el resto exacto (15) deja el encargo en saldo 0. ---
  r = await registrarPago(cajero, ['pago-2', 'entrega-encargo:enc-1:resto', 'enc-1', 'E', 'L', 'RESTO_ENTREGA', 15, '2026-09-08', 'Efectivo', '{}']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.pendiente, 0);

  // --- Encargo ya liquidado: cualquier cobro adicional se rechaza. ---
  await assert.rejects(
    registrarPago(cajero, ['pago-3', 'entrega-encargo:enc-1:extra', 'enc-1', 'E', 'L', 'OTRO', 1, '2026-09-08', 'Efectivo', '{}']),
    /encargo_ya_liquidado/
  );
  console.log('P02_PG_ENCARGO_YA_LIQUIDADO=PASS');

  // --- Reverso: revertir el resto devuelve el saldo pendiente; reverso duplicado bloqueado. ---
  r = await revertirPago(owner, ['reverso-1', 'reverso-encargo:enc-1:pago-2', 'pago-2', 'Cliente no recogió el resto']);
  assert.equal(r.ok, true, JSON.stringify(r));
  const pendienteTrasReverso = 20 - 5; // señal sigue confirmada, resto revertido
  const suma = Number(
    (await admin.query("select coalesce(sum(case when estado='CONFIRMADO' then importe else -importe end),0) as s from public.pagos_encargo where encargo_id='enc-1'")).rows[0].s
  );
  assert.equal(20 - suma, pendienteTrasReverso);
  await assert.rejects(
    revertirPago(owner, ['reverso-2', 'reverso-encargo:enc-1:pago-2-otra-vez', 'pago-2', 'Reintento']),
    /pago_ya_revertido/
  );
  console.log('P02_PG_REVERSO_Y_NO_DUPLICADO=PASS');

  // --- Rol: Básico no puede cobrar ni el encargo de su propia empresa. ---
  await assert.rejects(
    registrarPago(basico, ['pago-x', 'anticipo-encargo:enc-1:basico', 'enc-1', 'E', 'L', 'SEÑAL', 1, '2026-09-08', 'Efectivo', '{}']),
    /pago_encargo_no_autorizado/
  );
  // --- Rol: Cajero/a puede cobrar, pero no revertir (reverso exige Propietario/Encargado). ---
  await assert.rejects(
    revertirPago(cajero, ['reverso-x', 'reverso-encargo:enc-1:por-cajero', 'pago-1', 'Intento no autorizado']),
    /reverso_pago_encargo_no_autorizado/
  );
  console.log('P02_PG_ROLES_CAJERO_VS_BASICO=PASS');

  // --- Aislamiento: otra empresa/local no puede ver ni cobrar el encargo. ---
  await reset();
  await registrarEncargo(owner, ['enc-2', 'E', 'L', 'c1', 10, 'Pendiente', '{}']);
  await assert.rejects(
    registrarPago(owner, ['pago-o1', 'anticipo-encargo:enc-2:otro', 'enc-2', 'OTRA-EMPRESA', 'L', 'SEÑAL', 1, '2026-09-08', 'Efectivo', '{}']),
    /contexto_no_autorizado/
  );
  console.log('P02_PG_AISLAMIENTO_CROSS_EMPRESA=PASS');

  // --- Local inactivo bloquea nuevos cobros. ---
  await admin.query("update public.stock_ubicacion set local_operable=false where local_id='L';");
  await assert.rejects(
    registrarPago(owner, ['pago-inact', 'anticipo-encargo:enc-2:inactivo', 'enc-2', 'E', 'L', 'SEÑAL', 1, '2026-09-08', 'Efectivo', '{}']),
    /local_inactivo/
  );
  console.log('P02_PG_LOCAL_INACTIVO_BLOQUEA=PASS');

  console.log('PM14 P02 Postgres — pagos_encargo/registrar_pago_encargo/revertir_pago_encargo: contrato OK');
} finally {
  for (const c of clients) await c.end().catch(() => {});
  await admin.end();
}
