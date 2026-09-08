import assert from 'node:assert/strict';
import fs from 'node:fs';
import pg from 'pg';

const env = Object.fromEntries(fs.readFileSync(new URL('./supabase/.temp/status.env', import.meta.url), 'utf8')
  .split(/\r?\n/).filter(Boolean).map(line => {
    const at = line.indexOf('=');
    return [line.slice(0, at), line.slice(at + 1).replace(/^"|"$/g, '')];
  }));
assert.match(env.DB_URL || '', /@(127\.0\.0\.1|localhost):\d+\/postgres$/);
const db = new pg.Client({ connectionString: env.DB_URL });
await db.connect();
try {
  const required = await db.query(`select
    to_regclass('public.perfiles') is not null as perfiles,
    to_regclass('public.membresias_usuario') is not null as membresias,
    to_regclass('public.stock_ubicacion') is not null as stock,
    to_regclass('public.stock_operaciones') is not null as operaciones,
    to_regclass('public.movimientos_stock') is not null as movimientos,
    to_regprocedure('public.pm12_confirmar_ajuste_stock(text,text,text,jsonb,jsonb,jsonb)') is not null as ajustar,
    to_regprocedure('public.pm12_cancelar_conteo_stock(text,text,jsonb,jsonb)') is not null as cancelar`);
  assert.ok(Object.values(required.rows[0]).every(Boolean), JSON.stringify(required.rows[0]));

  const absent = await db.query(`select
    to_regclass('public.caja_operaciones') is null as caja,
    to_regclass('public.arqueos_caja') is null as arqueos,
    to_regclass('public.arqueos_caja_anulaciones') is null as anulaciones,
    to_regclass('public.devoluciones_venta') is null as devoluciones_venta,
    to_regclass('public.devoluciones_proveedor') is null as devoluciones_proveedor,
    to_regclass('public.empleados') is null as empleados`);
  assert.ok(Object.values(absent.rows[0]).every(Boolean), JSON.stringify(absent.rows[0]));
  console.log('PM12_PROD_BASELINE_MINIMAL=PASS');

  const rls = await db.query(`select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and relname in ('membresias_usuario','stock_ubicacion','stock_operaciones','movimientos_stock')`);
  assert.equal(rls.rowCount, 4);
  assert.ok(rls.rows.every(x => x.relrowsecurity === true), JSON.stringify(rls.rows));

  const grants = await db.query(`select
    has_table_privilege('anon','public.membresias_usuario','select') as anon_membresias,
    has_table_privilege('authenticated','public.membresias_usuario','select') as auth_membresias,
    has_table_privilege('anon','public.stock_operaciones','select') as anon_stock,
    has_table_privilege('authenticated','public.stock_operaciones','select') as auth_stock_select,
    has_table_privilege('authenticated','public.stock_operaciones','insert') as auth_stock_insert,
    has_function_privilege('anon','public.pm12_confirmar_ajuste_stock(text,text,text,jsonb,jsonb,jsonb)','execute') as anon_rpc,
    has_function_privilege('authenticated','public.pm12_confirmar_ajuste_stock(text,text,text,jsonb,jsonb,jsonb)','execute') as auth_rpc`);
  const g = grants.rows[0];
  assert.equal(g.anon_membresias, false);
  assert.equal(g.auth_membresias, false);
  assert.equal(g.anon_stock, false);
  assert.equal(g.auth_stock_select, true);
  assert.equal(g.auth_stock_insert, false);
  assert.equal(g.anon_rpc, false);
  assert.equal(g.auth_rpc, true);
  console.log('PM12_PROD_BASELINE_RLS_GRANTS=PASS');

  const constraints = await db.query(`select conname,pg_get_expr(conbin,conrelid) expression from pg_constraint
    where conname in ('stock_operaciones_tipo_check','movimientos_stock_tipo_check') order by conname`);
  assert.equal(constraints.rowCount, 2);
  assert.ok(constraints.rows.every(x => /INVENTARIO_PM12/.test(x.expression)), JSON.stringify(constraints.rows));
  const unique = await db.query("select to_regclass('public.pm12_un_ajuste_por_conteo') is not null as ok");
  assert.equal(unique.rows[0].ok, true);
  console.log('PM12_PROD_BASELINE_P08_CONSTRAINTS=PASS');

  const qaLeak = await db.query(`select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.proname like 'qa_%'`);
  assert.equal(qaLeak.rows[0].n, 0);
  console.log('PM12_PROD_BASELINE_NO_QA_OBJECTS=PASS');
} finally {
  await db.end();
}
