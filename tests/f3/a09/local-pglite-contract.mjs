// Functional local smoke on PostgreSQL 18 WASM. PostgreSQL 16 CI remains required.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { bootstrapA08 } from './local-pglite-bootstrap.mjs';

const root = resolve(import.meta.dirname, '../../..');
const db = await bootstrapA08();
const owner = '00000000-0000-0000-0000-000000000021';
const manager = '00000000-0000-0000-0000-000000000023';
const account1 = '50000000-0000-0000-0000-000000000011';
const account2 = '50000000-0000-0000-0000-000000000012';
const line = '70000000-0000-0000-0000-000000000011';
const terminal = '20000000-0000-0000-0000-000000000013';
const session = '40000000-0000-0000-0000-000000000008';
const day = '2026-09-24';

const call = async ({ operationId, accountId = account2, kind = 'AMOUNT', value = '2',
  reason = 'Atención al cliente', version = 3 } = {}) => {
  const result = await db.query(`select public.abc_aplicar_descuento_cuenta(
    $1,'emp-f','loc-f1',$2::uuid,$3,$4::numeric,$5,$6,$7::uuid,$8::uuid,$9::date
  ) as result`, [operationId, accountId, kind, value, reason, version, terminal, session, day]);
  return result.rows[0].result;
};

try {
  await db.exec(await readFile(resolve(root,
    'supabase/migrations/20260924093852_abc_f3_a09_discounts_courtesies.sql'), 'utf8'));
  const a08 = await readFile(resolve(root, 'tests/f3/a08/a08-contract.sql'), 'utf8');
  const marker = a08.indexOf('-- Replay exacto.');
  if (marker < 0) throw new Error('A08 fixture marker absent');
  await db.exec(a08.slice(0, marker).replace(/^\\set[^\n]*\n/m, ''));

  const acl = (await db.query(`select
    has_function_privilege('authenticated',
      'public.abc_aplicar_descuento_cuenta(text,text,text,uuid,text,numeric,text,bigint,uuid,uuid,date)',
      'EXECUTE') as authenticated,
    has_function_privilege('anon',
      'public.abc_aplicar_descuento_cuenta(text,text,text,uuid,text,numeric,text,bigint,uuid,uuid,date)',
      'EXECUTE') as anonymous,
    has_table_privilege('authenticated','public.abc_descuentos_aplicados','UPDATE') as direct_update,
    has_table_privilege('authenticated','public.abc_descuento_politicas','INSERT') as policy_insert,
    has_function_privilege('service_role',
      'public.abc_aplicar_descuento_cuenta(text,text,text,uuid,text,numeric,text,bigint,uuid,uuid,date)',
      'EXECUTE') as service_role_execute,
    has_function_privilege('authenticated',
      'private.abc_descuento_politica(text,text)','EXECUTE') as helper_execute,
    (select relrowsecurity from pg_class where oid='public.abc_descuentos_aplicados'::regclass) as rls,
    (select relrowsecurity from pg_class where oid='public.abc_descuento_politicas'::regclass) as policy_rls,
    (select prosecdef from pg_proc where oid=
      'public.abc_aplicar_descuento_cuenta(text,text,text,uuid,text,numeric,text,bigint,uuid,uuid,date)'::regprocedure) as security_definer`)).rows[0];
  assert.deepEqual(acl, { authenticated: true, anonymous: false, direct_update: false,
    policy_insert: false, service_role_execute: false, helper_execute: false,
    rls: true, policy_rls: true, security_definer: true });
  process.stdout.write('PASS ACL/RLS\n');

  let result = await call({ operationId: 'a09.test.discount.1' });
  assert.equal(Number(result.descuento), 2);
  assert.equal(Number(result.total_comercial), 8.8);
  assert.equal(Number(result.cuenta_version), 4);
  const amounts = (await db.query(`select r.cuenta_id,r.descuento,r.base,r.impuestos,r.total
    from public.cuenta_linea_repartos r where r.source_line_id=$1 and r.estado='ACTIVO'
    order by r.cuenta_id`, [line])).rows;
  assert.deepEqual(amounts.map((r) => [r.cuenta_id,Number(r.descuento),Number(r.base),
    Number(r.impuestos),Number(r.total)]), [
    [account1,0,30,3,33], [account2,2,8,0.8,8.8],
  ]);
  const source = (await db.query('select descuento_total,base,impuestos,total from public.pedido_lineas where id=$1', [line])).rows[0];
  assert.deepEqual(Object.values(source).map(Number), [2,38,3.8,41.8]);
  process.stdout.write('PASS split/source reconciliation\n');

  const retry = await call({ operationId: 'a09.test.discount.1' });
  assert.deepEqual(retry, result);
  assert.equal((await db.query(`select count(*)::int n from public.abc_descuentos_aplicados
    where operation_id='a09.test.discount.1'`)).rows[0].n, 1);
  await assert.rejects(call({ operationId: 'a09.test.discount.1', value: '1' }), /operation_id_conflict/);
  process.stdout.write('PASS idempotency/conflict\n');

  await db.exec(`insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo)
    values ('${manager}','emp-f','loc-f1',false,'Encargado',true);
    select set_config('request.jwt.claim.sub','${manager}',false);`);
  await assert.rejects(call({ operationId: 'a09.test.discount.2', value: '7', version: 4 }),
    /descuento_limite_acumulado_excedido/);
  assert.equal((await db.query(`select count(*)::int n from public.abc_descuentos_aplicados
    where operation_id='a09.test.discount.2'`)).rows[0].n, 0);
  process.stdout.write('PASS cumulative role cap and rollback\n');

  await db.exec(`select set_config('request.jwt.claim.sub','${owner}',false);`);
  result = await call({ operationId: 'a09.test.courtesy', kind: 'COURTESY', value: null, version: 4 });
  assert.equal(Number(result.total_comercial), 0);
  assert.equal(Number((await db.query('select total from public.pedido_lineas where id=$1', [line])).rows[0].total), 33);
  process.stdout.write('PASS courtesy preserves other account\n');

  await db.exec(`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000022',false);`);
  await assert.rejects(call({ operationId: 'a09.test.denied', accountId: account1,
    value: '1', version: 4 }), /descuento_no_autorizado/);
  process.stdout.write('PASS permission denial\n');

  await db.exec(`insert into public.abc_descuento_politicas(
    empresa_id,local_id,user_id,max_percent,requiere_doble_aprobacion
  ) values ('emp-f','loc-f1','00000000-0000-0000-0000-000000000022',10,true);`);
  await assert.rejects(call({ operationId: 'a09.test.dual', accountId: account1,
    value: '1', version: 4 }), /descuento_requiere_doble_aprobacion/);
  process.stdout.write('PASS dual approval fail-closed\n');

  await db.exec(`select set_config('request.jwt.claim.sub','${owner}',false);
    select set_config('app.test_local','loc-f2',false);`);
  await assert.rejects(call({ operationId: 'a09.test.crosslocal', accountId: account1,
    value: '1', version: 4 }), /descuento_no_autorizado/);
  await db.exec(`select set_config('app.test_local','loc-f1',false);`);
  await assert.rejects(call({ operationId: 'a09.test.stale', accountId: account1,
    value: '1', version: 3 }), /cuenta_version_conflict/);
  process.stdout.write('PASS cross-local and stale version\n');

  await db.exec(`insert into public.ventas_fiscales(
    id,empresa_id,local_id,cuenta_id,entidad_fiscal_id,currency_code,
    estado,version,subtotal,descuento_total,impuestos_total,total,
    snapshot_calculo,created_by,created_operating_day
  ) values (
    '81000000-0000-0000-0000-000000000009','emp-f','loc-f1','${account1}',
    '10000000-0000-0000-0000-000000000008','EUR','ABIERTA',1,10,0,1,11,
    '{}'::jsonb,'${owner}',date '${day}'
  );
  insert into public.venta_fiscal_lineas(
    id,empresa_id,local_id,venta_fiscal_id,source_line_id,entidad_fiscal_id,currency_code,
    cantidad,precio_unitario,descuento,base,impuesto,total,snapshot
  ) values (
    '82000000-0000-0000-0000-000000000009','emp-f','loc-f1',
    '81000000-0000-0000-0000-000000000009','${line}',
    '10000000-0000-0000-0000-000000000008','EUR',1,10,0,10,1,11,'{}'::jsonb
  );`);
  await assert.rejects(call({ operationId: 'a09.test.partial', accountId: account1,
    value: '1', version: 4 }), /descuento_linea_fiscalizada/);
  assert.equal((await db.query(`select count(*)::int n from public.abc_descuentos_aplicados
    where operation_id='a09.test.partial'`)).rows[0].n, 0);
  process.stdout.write('PASS partial fiscalization rejection\n');

  const account3 = '50000000-0000-0000-0000-000000000019';
  const order3 = '60000000-0000-0000-0000-000000000019';
  const negativeLine = '70000000-0000-0000-0000-000000000019';
  await db.exec(`insert into public.cuentas_comerciales(
    id,empresa_id,local_id,currency_code,modalidad,estado,version,created_by,opened_operating_day
  ) values ('${account3}','emp-f','loc-f1','EUR','BARRA','ABIERTA',1,'${owner}',date '${day}');
  insert into public.pedidos_tpv(
    id,empresa_id,local_id,cuenta_id,currency_code,estado,version,created_by,created_operating_day
  ) values ('${order3}','emp-f','loc-f1','${account3}','EUR','ABIERTO',1,'${owner}',date '${day}');
  insert into public.pedido_lineas(
    id,empresa_id,local_id,pedido_id,producto_id,cantidad,unidad,estado,version,
    entidad_fiscal_id,currency_code,precio_unitario,descuento_total,base,impuestos,total,
    snapshot_comercial,snapshot_calculo,created_by,created_operating_day
  ) values ('${negativeLine}','emp-f','loc-f1','${order3}','prod-unit-f',1,'ud',
    'CONFIRMADA',1,'10000000-0000-0000-0000-000000000008','EUR',8,0,8,0.8,8.8,
    '{"impuesto_base_pct":10}'::jsonb,'{"modo":"SERVER_AUTHORITY_A04","impuesto_base_pct":10}'::jsonb,'${owner}',date '${day}');
  insert into public.pedido_linea_opciones(
    empresa_id,local_id,linea_id,grupo_id,opcion_id,tipo_grupo,tipo_opcion,
    nombre_grupo,nombre_opcion,cantidad,delta_precio_unitario,impuesto_pct,
    base,impuestos,total,catalog_group_version,catalog_product_group_version,
    catalog_option_version,created_by,created_operating_day
  ) values ('emp-f','loc-f1','${negativeLine}',
    'a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',
    'MODIFICADOR','RETIRADA','Retirada','Sin ingrediente',1,-2,10,
    -2,-0.2,-2.2,1,1,1,'${owner}',date '${day}');`);
  result = await call({ operationId: 'a09.test.negative', accountId: account3,
    kind: 'PERCENT', value: '20', version: 1 });
  assert.equal(Number(result.descuento), 1.6);
  const negativeAmounts = (await db.query('select descuento_total,base,impuestos,total from public.pedido_lineas where id=$1',
    [negativeLine])).rows[0];
  assert.deepEqual(Object.values(negativeAmounts).map(Number), [1.6,6.4,0.64,7.04]);
  process.stdout.write('PASS A04 negative modifier uses net base\n');
  await assert.rejects(call({ operationId: 'a09.test.bypass.amount', accountId: account3,
    value: '6.4', version: 2 }), /descuento_cortesia_requerida/);
  await assert.rejects(call({ operationId: 'a09.test.bypass.percent', accountId: account3,
    kind: 'PERCENT', value: '100', version: 2 }), /descuento_cortesia_requerida/);
  process.stdout.write('PASS full discount requires COURTESY operation\n');

  const tinyLine = '70000000-0000-0000-0000-000000000021';
  await db.exec(`insert into public.pedido_lineas(
    id,empresa_id,local_id,pedido_id,producto_id,cantidad,unidad,estado,version,
    entidad_fiscal_id,currency_code,precio_unitario,descuento_total,base,impuestos,total,
    snapshot_comercial,snapshot_calculo,created_by,created_operating_day
  ) values ('${tinyLine}','emp-f','loc-f1','${order3}','prod-unit-f',1,'ud',
    'CONFIRMADA',1,'10000000-0000-0000-0000-000000000008','EUR',8,0,8,0.8,8.8,
    '{"impuesto_pct":10}'::jsonb,'{"modo":"SERVER_AUTHORITY_A03","impuesto_pct":10}'::jsonb,
    '${owner}',date '${day}');`);
  const negativeVersionBefore = (await db.query('select version from public.pedido_lineas where id=$1',
    [negativeLine])).rows[0].version;
  await assert.rejects(call({ operationId: 'a09.test.bypass.row', accountId: account3,
    value: '14.39999999', version: 2 }), /descuento_cortesia_requerida/);
  result = await call({ operationId: 'a09.test.rounding', accountId: account3,
    value: '0.00000001', version: 2 });
  assert.equal(Number(result.descuento), 0.00000001);
  assert.equal((await db.query('select version from public.pedido_lineas where id=$1',
    [negativeLine])).rows[0].version, negativeVersionBefore);
  assert.equal(Number((await db.query('select descuento_total from public.pedido_lineas where id=$1',
    [tinyLine])).rows[0].descuento_total), 0.00000001);
  process.stdout.write('PASS largest-remainder rounding and untouched line version\n');

  const mixedLine = '70000000-0000-0000-0000-000000000020';
  await db.exec(`insert into public.pedido_lineas(
    id,empresa_id,local_id,pedido_id,producto_id,cantidad,unidad,estado,version,
    entidad_fiscal_id,currency_code,precio_unitario,descuento_total,base,impuestos,total,
    snapshot_comercial,snapshot_calculo,created_by,created_operating_day
  ) values ('${mixedLine}','emp-f','loc-f1','${order3}','prod-unit-f',1,'ud',
    'CONFIRMADA',1,'10000000-0000-0000-0000-000000000008','EUR',13,0,13,1.63,14.63,
    '{"impuesto_base_pct":10}'::jsonb,'{"modo":"SERVER_AUTHORITY_A04","impuesto_base_pct":10}'::jsonb,'${owner}',date '${day}');
  insert into public.pedido_linea_opciones(
    empresa_id,local_id,linea_id,grupo_id,opcion_id,tipo_grupo,tipo_opcion,
    nombre_grupo,nombre_opcion,cantidad,delta_precio_unitario,impuesto_pct,
    base,impuestos,total,catalog_group_version,catalog_product_group_version,
    catalog_option_version,created_by,created_operating_day
  ) values ('emp-f','loc-f1','${mixedLine}',
    'a0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002',
    'MODIFICADOR','EXTRA','Extra','Extra distinto IVA',1,3,21,
    3,0.63,3.63,1,1,1,'${owner}',date '${day}');`);
  await assert.rejects(call({ operationId: 'a09.test.mixed', accountId: account3,
    value: '1', version: 3 }), /descuento_reparto_iva_mixto_no_soportado/);
  assert.equal((await db.query('select count(*)::int n from public.abc_descuentos_aplicados where operation_id=$1',
    ['a09.test.mixed'])).rows[0].n, 0);
  process.stdout.write('PASS mixed-tax A08 rejection\n');

  await db.exec(`delete from public.pedido_linea_opciones where linea_id='${mixedLine}';
    delete from public.pedido_lineas where id='${mixedLine}';
    insert into public.cuenta_cuotas_importe(
      empresa_id,local_id,cuenta_origen_id,cuenta_destino_id,currency_code,
      importe,created_by
    ) values ('emp-f','loc-f1','${account3}','${account1}','EUR',1,'${owner}');`);
  await assert.rejects(call({ operationId: 'a09.test.quota', accountId: account3,
    value: '1', version: 3 }), /descuento_compromiso_financiero/);
  assert.equal((await db.query('select count(*)::int n from public.abc_descuentos_aplicados where operation_id=$1',
    ['a09.test.quota'])).rows[0].n, 0);
  process.stdout.write('PASS active A08 quota rejection\n');

  await db.exec(`delete from public.cuenta_cuotas_importe
    where empresa_id='emp-f' and local_id='loc-f1' and cuenta_origen_id='${account3}';`);
  const competing = await Promise.allSettled([
    call({ operationId: 'a09.test.race.1', accountId: account3, value: '1', version: 3 }),
    call({ operationId: 'a09.test.race.2', accountId: account3, value: '1', version: 3 }),
  ]);
  assert.deepEqual(competing.map((x) => x.status), ['fulfilled','rejected']);
  assert.match(competing[1].reason.message, /cuenta_version_conflict/);
  assert.equal((await db.query(`select count(*)::int n from public.abc_descuentos_aplicados
    where operation_id in ('a09.test.race.1','a09.test.race.2')`)).rows[0].n, 2);
  const replayed = await Promise.all([
    call({ operationId: 'a09.test.race.replay', accountId: account3, value: '0.5', version: 4 }),
    call({ operationId: 'a09.test.race.replay', accountId: account3, value: '0.5', version: 4 }),
  ]);
  assert.deepEqual(replayed[0], replayed[1]);
  process.stdout.write('PASS concurrent dispatch on one PGlite connection\n');

  process.stdout.write('A09_PGLITE_FUNCTIONAL=PASS\n');
} catch (error) {
  process.stderr.write(`A09_PGLITE_FUNCTIONAL=FAIL ${error.message}\n`);
  process.exitCode = 1;
} finally {
  await db.close();
}
