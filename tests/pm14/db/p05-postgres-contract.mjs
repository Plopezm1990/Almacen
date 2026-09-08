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

  // Aplica P02 completo y luego P05 (el override de registrar_encargo/pm14_total_encargo),
  // exactamente en el mismo orden en que se aplicaron sobre L&A Suite QA.
  await admin.query(sql('supabase/migrations/20260908071757_pm14_p02_encargos_pagos_encargo.sql'));
  await admin.query(sql('supabase/migrations/20260908075655_pm14_p05_estado_devuelto_encargo.sql'));

  await admin.query("insert into public.stock_ubicacion(empresa_id,local_id,producto_id) values ('E','L','p');");

  const owner = await actor('Propietario');

  // ---- "Devuelto" es ahora un estado válido del espejo autoritativo. ----
  let r = await registrarEncargo(owner, ['enc-1', 'E', 'L', 'c1', 20, 'Entregado', '{}']);
  assert.equal(r.ok, true, JSON.stringify(r));
  r = await registrarPago(owner, ['pago-1', 'anticipo-encargo:enc-1:senal', 'enc-1', 'E', 'L', 'SEÑAL', 5, '2026-09-08', 'Tarjeta', '{}']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.pendiente, 15);

  r = await registrarEncargo(owner, ['enc-1', 'E', 'L', 'c1', 20, 'Devuelto', '{}']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.encargo.datos.estado, 'Devuelto');
  console.log('P05_PG_ESTADO_DEVUELTO_ACEPTADO=PASS');

  // ---- Un encargo Devuelto ya no admite nuevos cobros (igual que Cancelado). ----
  await assert.rejects(
    registrarPago(owner, ['pago-2', 'anticipo-encargo:enc-1:resto', 'enc-1', 'E', 'L', 'RESTO_ENTREGA', 15, '2026-09-08', 'Efectivo', '{}']),
    /encargo_no_encontrado_o_no_autorizado/
  );
  console.log('P05_PG_DEVUELTO_BLOQUEA_NUEVOS_COBROS=PASS');

  // ---- Estado inválido sigue rechazado. ----
  await assert.rejects(
    registrarEncargo(owner, ['enc-2', 'E', 'L', 'c1', 10, 'Inventado', '{}']),
    /estado_encargo_invalido/
  );
  console.log('P05_PG_ESTADO_INVALIDO_SIGUE_RECHAZADO=PASS');

  console.log('PM14 P05 Postgres — estado Devuelto en el espejo autoritativo: contrato OK');
} finally {
  for (const c of clients) await c.end().catch(() => {});
  await admin.end();
}
