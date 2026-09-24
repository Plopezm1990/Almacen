// Real PostgreSQL 16/17 contract. Requires a disposable local server and pg in TEMP.
// A09 remains a draft under tests/f3/a09; this script never touches remote databases.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { Client } = require(process.env.A09_PG_CLIENT ??
  join(tmpdir(), 'a09-pg-client', 'node_modules', 'pg'));
const root = resolve(import.meta.dirname, '../../..');
const port = Number(process.env.A09_PG_PORT ?? 55416);
const database = process.env.A09_PG_DATABASE ?? 'a09';
const owner = '00000000-0000-0000-0000-000000000021';
const issuer = '10000000-0000-0000-0000-000000000008';
const terminal = '20000000-0000-0000-0000-000000000013';
const session = '40000000-0000-0000-0000-000000000008';
const line = '70000000-0000-0000-0000-000000000011';
const account1 = '50000000-0000-0000-0000-000000000011';
const account2 = '50000000-0000-0000-0000-000000000012';
const day = '2026-09-24';
const connection = (name) => new Client({host: '127.0.0.1', port, user: 'postgres',
  database, application_name: name});

async function fixture(file) {
  const absolute = resolve(root, file);
  const lines = (await readFile(absolute, 'utf8')).split(/\r?\n/);
  const expanded = [];
  for (const line of lines) {
    const nested = line.match(/^\\ir\s+(.+)$/);
    if (nested) expanded.push(await fixture(resolve(dirname(absolute), nested[1])));
    else if (!line.startsWith('\\set ')) expanded.push(line);
  }
  return expanded.join('\n');
}

async function bootstrap(db) {
  await db.query(await fixture('tests/f3/a08/fixture-a08.sql'));
  const migrations = (await readdir(resolve(root, 'supabase/migrations')))
    .filter((name) => /^2026092[34].*\.sql$/.test(name) &&
      name <= '20260924060000_abc_f3_a08_account_split_merge.sql').sort();
  assert.equal(migrations.length, 17, 'expected F2/A03-A08 migration count');
  for (const name of migrations) {
    await db.query(await readFile(resolve(root, 'supabase/migrations', name), 'utf8'));
  }
  await db.query(await readFile(resolve(root, 'tests/f3/a09/a09-migration-draft.sql'), 'utf8'));
  const a08 = await readFile(resolve(root, 'tests/f3/a08/a08-contract.sql'), 'utf8');
  const marker = a08.indexOf('-- Replay exacto.');
  assert(marker > 0);
  await db.query(a08.slice(0, marker).replace(/^\\set[^\n]*\n/m, ''));
  process.stdout.write(`PASS PostgreSQL ${((await db.query('show server_version')).rows[0].server_version)} bootstrap\n`);
}

async function actor(db) {
  await db.query('select set_config($1,$2,false),set_config($3,$4,false),set_config($5,$6,false)',
    ['app.test_empresa','emp-f','app.test_local','loc-f1','request.jwt.claim.sub',owner]);
}

async function discount(db, operationId, accountId, version, kind = 'AMOUNT', value = '2') {
  const result = await db.query(`select public.abc_aplicar_descuento_cuenta(
    $1,'emp-f','loc-f1',$2::uuid,$3,$4::numeric,'Prueba A09 local',
    $5,$6::uuid,$7::uuid,$8::date) as value`,
  [operationId, accountId, kind, value, version, terminal, session, day]);
  return result.rows[0].value;
}

async function exactReconciliation(db, sourceLine) {
  const {rows} = await db.query(`select
    l.descuento_total::text source_discount,l.base::text source_base,
    l.impuestos::text source_tax,l.total::text source_total,
    sum(r.descuento)::text split_discount,sum(r.base)::text split_base,
    sum(r.impuestos)::text split_tax,sum(r.total)::text split_total,
    (l.descuento_total-sum(r.descuento))::text discount_difference,
    (l.base-sum(r.base))::text base_difference,
    (l.impuestos-sum(r.impuestos))::text tax_difference,
    (l.total-sum(r.total))::text total_difference
    from public.pedido_lineas l join public.cuenta_linea_repartos r
      on r.source_line_id=l.id and r.estado='ACTIVO'
    where l.id=$1 group by l.id`, [sourceLine]);
  const row = rows[0];
  for (const field of ['discount','base','tax','total']) {
    assert.equal(Number(row[`${field}_difference`]), 0, `${field} internal mismatch`);
    assert.equal(row[`source_${field}`], row[`split_${field}`]);
  }
  return row;
}

async function fiscalHeader(db, fiscalId, accountId, sourceLine, repartId) {
  await db.query(`insert into public.ventas_fiscales(
    id,empresa_id,local_id,cuenta_id,entidad_fiscal_id,currency_code,
    estado,version,subtotal,descuento_total,impuestos_total,total,
    snapshot_calculo,created_by,created_operating_day)
    select $1,'emp-f','loc-f1',$2,$3,'EUR','ABIERTA',1,
      r.base+r.descuento,r.descuento,r.impuestos,r.total,'{}'::jsonb,$4,$5::date
    from public.cuenta_linea_repartos r where r.id=$6`,
  [fiscalId, accountId, issuer, owner, day, repartId]);
  await db.query(`insert into public.venta_fiscal_lineas(
    empresa_id,local_id,venta_fiscal_id,source_line_id,entidad_fiscal_id,currency_code,
    cantidad,precio_unitario,descuento,base,impuesto,total,snapshot)
    select 'emp-f','loc-f1',$1,$2,$3,'EUR',r.cantidad,
      r.base+r.descuento,r.descuento,r.base,r.impuestos,r.total,'{}'::jsonb
    from public.cuenta_linea_repartos r where r.id=$4`,
  [fiscalId, sourceLine, issuer, repartId]);
}

async function fiscalExact(db, fiscalId, expectedRepartId) {
  const {rows} = await db.query(`select
    v.subtotal::text subtotal,v.descuento_total::text discount,
    v.impuestos_total::text tax,v.total::text total,
    (v.subtotal-v.descuento_total+v.impuestos_total-v.total)::text identity_delta,
    (v.descuento_total-r.descuento)::text repart_discount_delta,
    (v.subtotal-v.descuento_total-r.base)::text repart_base_delta,
    (v.impuestos_total-r.impuestos)::text repart_tax_delta,
    (v.total-r.total)::text repart_total_delta,
    (v.total-sum(vl.total))::text lines_total_delta,
    (v.impuestos_total-sum(vl.impuesto))::text lines_tax_delta,
    (round(v.subtotal,2)-round(v.descuento_total,2)+round(v.impuestos_total,2)-round(v.total,2))::text cents_identity_delta,
    (round(v.total,2)-sum(round(vl.total,2)))::text cents_lines_delta
    from public.ventas_fiscales v join public.venta_fiscal_lineas vl
      on vl.venta_fiscal_id=v.id join public.cuenta_linea_repartos r on r.id=$2
    where v.id=$1 group by v.id,r.id`, [fiscalId, expectedRepartId]);
  const row = rows[0];
  for (const [key, value] of Object.entries(row)) if (key.endsWith('_delta')) {
    assert.equal(Number(value), 0, `${key} = ${value}`);
  }
  return row;
}

async function makeLine(db, suffix) {
  const account = `50000000-0000-0000-0000-0000000000${suffix}`;
  const order = `60000000-0000-0000-0000-0000000000${suffix}`;
  const source = `70000000-0000-0000-0000-0000000000${suffix}`;
  await db.query(`insert into public.cuentas_comerciales(
    id,empresa_id,local_id,currency_code,modalidad,estado,version,created_by,opened_operating_day)
    values ($1,'emp-f','loc-f1','EUR','BARRA','ABIERTA',1,$2,$3::date)`,[account,owner,day]);
  await db.query(`insert into public.pedidos_tpv(
    id,empresa_id,local_id,cuenta_id,currency_code,estado,version,created_by,created_operating_day)
    values ($1,'emp-f','loc-f1',$2,'EUR','ABIERTO',1,$3,$4::date)`,[order,account,owner,day]);
  await db.query(`insert into public.pedido_lineas(
    id,empresa_id,local_id,pedido_id,producto_id,cantidad,unidad,estado,version,
    entidad_fiscal_id,currency_code,precio_unitario,descuento_total,base,impuestos,total,
    snapshot_comercial,snapshot_calculo,created_by,created_operating_day)
    values ($1,'emp-f','loc-f1',$2,'prod-unit-f',1,'ud','CONFIRMADA',1,
      $3,'EUR',10,0,10,1,11,'{"impuesto_pct":10}'::jsonb,
      '{"modo":"SERVER_AUTHORITY_A03","impuesto_pct":10}'::jsonb,$4,$5::date)`,
    [source,order,issuer,owner,day]);
  return {account,source};
}

async function waitForLock(db, applicationName) {
  for (let i=0; i<100; i++) {
    const {rows} = await db.query(`select wait_event_type from pg_stat_activity
      where application_name=$1 and state='active'`,[applicationName]);
    if (rows[0]?.wait_event_type === 'Lock') return;
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error(`${applicationName} did not wait on a PostgreSQL lock`);
}

const db = connection('a09-main');
const other = connection('a09-other');
try {
  await db.connect();
  await other.connect();
  await bootstrap(db);
  const {rows:[security]} = await db.query(`select
    exists(select 1 from pg_trigger where tgname='a09_guard_fiscal_linea'
      and tgrelid='public.venta_fiscal_lineas'::regclass and not tgisinternal) guard,
    (select prosecdef from pg_proc where oid=
      'private.abc_a09_guard_fiscal_linea()'::regprocedure) security_definer,
    has_function_privilege('authenticated',
      'private.abc_a09_guard_fiscal_linea()','EXECUTE') authenticated_execute,
    has_function_privilege('service_role',
      'private.abc_a09_guard_fiscal_linea()','EXECUTE') service_execute,
    (select relrowsecurity from pg_class where oid=
      'public.abc_descuentos_aplicados'::regclass) audit_rls`);
  assert.deepEqual(security,{guard:true,security_definer:true,
    authenticated_execute:false,service_execute:false,audit_rls:true});
  process.stdout.write('PASS A09 fiscal trigger ACL/RLS\n');
  await actor(db);
  await actor(other);
  const result = await discount(db,'a09.pg.split',account2,3);
  assert.equal(result.descuento, 2);
  const recon = await exactReconciliation(db,line);
  assert.equal(recon.source_total, '41.80000000');
  const retry = await discount(other,'a09.pg.split',account2,3);
  assert.deepEqual(retry,result);
  await assert.rejects(discount(other,'a09.pg.split',account2,3,'AMOUNT','1'),/operation_id_conflict/);
  process.stdout.write('PASS A08 split, source sums and idempotency across real connections\n');

  const repart = (await db.query(`select id from public.cuenta_linea_repartos
    where source_line_id=$1 and cuenta_id=$2 and estado='ACTIVO'`,[line,account2])).rows[0].id;
  const doc = '81000000-0000-0000-0000-000000000016';
  await fiscalHeader(db,doc,account2,line,repart);
  const fiscal = await fiscalExact(db,doc,repart);
  assert.equal(fiscal.total,'8.80000000');
  process.stdout.write('PASS fiscal line/header versus A08 split, exact at 8 and 2 decimals\n');

  const first = await makeLine(db,'31');
  const firstFiscal = '81000000-0000-0000-0000-000000000031';
  // Fiscalization owns the source lock first. A09 must wait, then reject.
  await other.query('begin');
  await other.query('select id from public.pedido_lineas where id=$1 for update',[first.source]);
  await other.query(`insert into public.ventas_fiscales(
    id,empresa_id,local_id,cuenta_id,entidad_fiscal_id,currency_code,
    estado,version,subtotal,descuento_total,impuestos_total,total,
    snapshot_calculo,created_by,created_operating_day)
    values ($1,'emp-f','loc-f1',$2,$3,'EUR','ABIERTA',1,10,0,1,11,'{}'::jsonb,$4,$5::date)`,
    [firstFiscal,first.account,issuer,owner,day]);
  await other.query(`insert into public.venta_fiscal_lineas(
    empresa_id,local_id,venta_fiscal_id,source_line_id,entidad_fiscal_id,currency_code,
    cantidad,precio_unitario,descuento,base,impuesto,total,snapshot)
    values ('emp-f','loc-f1',$1,$2,$3,'EUR',1,10,0,10,1,11,'{}'::jsonb)`,
    [firstFiscal,first.source,issuer]);
  const loser = discount(db,'a09.pg.fiscal-wins',first.account,1);
  await waitForLock(other,'a09-main');
  await other.query('commit');
  await assert.rejects(loser,/descuento_linea_fiscalizada/);
  assert.equal((await db.query(`select count(*)::int n from public.abc_descuentos_aplicados
    where operation_id='a09.pg.fiscal-wins'`)).rows[0].n,0);
  process.stdout.write('PASS fiscalization-first race: A09 waits and rolls back\n');

  const second = await makeLine(db,'32');
  // A09 owns the source lock first. Fiscalization waits and snapshots new values.
  await db.query('begin');
  await discount(db,'a09.pg.discount-wins',second.account,1);
  const fiscalWait = other.query('select id from public.pedido_lineas where id=$1 for update',
    [second.source]);
  await waitForLock(db,'a09-other');
  await db.query('commit');
  await fiscalWait;
  const secondRepart = (await other.query(`select id from public.cuenta_linea_repartos
    where source_line_id=$1 and estado='ACTIVO'`,[second.source])).rows[0].id;
  const secondDoc = '81000000-0000-0000-0000-000000000032';
  await fiscalHeader(other,secondDoc,second.account,second.source,secondRepart);
  await fiscalExact(other,secondDoc,secondRepart);
  await exactReconciliation(db,second.source);
  process.stdout.write('PASS discount-first race: fiscal snapshot sees committed A09 amounts\n');

  const third = await makeLine(db,'33');
  await db.query('begin');
  await discount(db,'a09.pg.concurrent.1',third.account,1);
  const stale = discount(other,'a09.pg.concurrent.2',third.account,1);
  await waitForLock(db,'a09-other');
  await db.query('commit');
  await assert.rejects(stale,/cuenta_version_conflict/);
  const thirdAudit = (await db.query(`select count(*)::int n from public.abc_descuentos_aplicados
    where source_line_id=$1`,[third.source])).rows[0].n;
  assert.equal(thirdAudit,1);
  await exactReconciliation(db,third.source);
  process.stdout.write('PASS two discounts: row lock, one winner, stale version without extra audit\n');

  const fractional = await makeLine(db,'34');
  await discount(db,'a09.pg.fractional-cent',fractional.account,1,'PERCENT','33.3333');
  await exactReconciliation(db,fractional.source);
  const {rows: [rounding]} = await db.query(`select
    descuento_total::text discount,base::text base,impuestos::text tax,
    total::text total,
    (round(base+descuento_total,2)-round(descuento_total,2)
      +round(impuestos,2)-round(total,2))::text naive_document_delta
    from public.pedido_lineas where id=$1`,[fractional.source]);
  assert.equal(rounding.naive_document_delta,'0.01');
  process.stdout.write(`KNOWN GAP naive fiscal rounding: ${JSON.stringify(rounding)}\n`);

  const direct = await makeLine(db,'35');
  const directDoc = '81000000-0000-0000-0000-000000000035';
  await db.query(`insert into public.ventas_fiscales(
    id,empresa_id,local_id,cuenta_id,entidad_fiscal_id,currency_code,
    estado,version,subtotal,descuento_total,impuestos_total,total,
    snapshot_calculo,created_by,created_operating_day)
    values ($1,'emp-f','loc-f1',$2,$3,'EUR','ABIERTA',1,10,0,1,11,'{}'::jsonb,$4,$5::date)`,
    [directDoc,direct.account,issuer,owner,day]);
  await db.query('begin');
  await discount(db,'a09.pg.direct-fiscal-writer',direct.account,1);
  const staleFiscalInsert = other.query(`insert into public.venta_fiscal_lineas(
    empresa_id,local_id,venta_fiscal_id,source_line_id,entidad_fiscal_id,currency_code,
    cantidad,precio_unitario,descuento,base,impuesto,total,snapshot)
    values ('emp-f','loc-f1',$1,$2,$3,'EUR',1,10,0,10,1,11,'{}'::jsonb)`,
    [directDoc,direct.source,issuer]);
  await waitForLock(db,'a09-other');
  await db.query('commit');
  await assert.rejects(staleFiscalInsert,/a09_fiscal_snapshot_obsoleto_o_parcial/);
  assert.equal((await db.query(`select count(*)::int n from public.venta_fiscal_lineas
    where venta_fiscal_id=$1`,[directDoc])).rows[0].n,0);
  process.stdout.write('PASS privileged direct fiscal insert rejects stale snapshot after A09 commit\n');
  await assert.rejects(other.query(`insert into public.venta_fiscal_lineas(
    empresa_id,local_id,venta_fiscal_id,source_line_id,entidad_fiscal_id,currency_code,
    cantidad,precio_unitario,descuento,base,impuesto,total,snapshot)
    values ('emp-f','loc-f1',$1,$2,$3,'EUR',0.5,5,1,4,0.4,4.4,'{}'::jsonb)`,
    [directDoc,direct.source,issuer]),/a09_fiscal_snapshot_obsoleto_o_parcial/);
  const directRepart = (await db.query(`select id from public.cuenta_linea_repartos
    where source_line_id=$1 and estado='ACTIVO'`,[direct.source])).rows[0].id;
  await db.query(`update public.ventas_fiscales v set
    subtotal=r.base+r.descuento,descuento_total=r.descuento,
    impuestos_total=r.impuestos,total=r.total
    from public.cuenta_linea_repartos r where v.id=$1 and r.id=$2`,
    [directDoc,directRepart]);
  await other.query(`insert into public.venta_fiscal_lineas(
    empresa_id,local_id,venta_fiscal_id,source_line_id,entidad_fiscal_id,currency_code,
    cantidad,precio_unitario,descuento,base,impuesto,total,snapshot)
    select 'emp-f','loc-f1',$1,$2,$3,'EUR',r.cantidad,
      r.base+r.descuento,r.descuento,r.base,r.impuestos,r.total,'{}'::jsonb
    from public.cuenta_linea_repartos r where r.id=$4`,
    [directDoc,direct.source,issuer,directRepart]);
  await fiscalExact(db,directDoc,directRepart);
  process.stdout.write('PASS post-A09 partial fiscalization fails closed; full current share reconciles\n');
  const serverVersion = (await db.query('show server_version_num')).rows[0].server_version_num;
  assert(['16','17'].includes(serverVersion.slice(0,2)));
  process.stdout.write(`A09_POSTGRES_LOCKS_${serverVersion}=PASS\n`);
  process.stdout.write('A09_LOCAL_ACCEPTANCE=OPEN fiscal cent projection and independent review\n');
} catch (error) {
  process.stderr.write(`A09_POSTGRES_CONTRACT=FAIL ${error.stack}\n`);
  process.exitCode=1;
} finally {
  await Promise.allSettled([db.end(),other.end()]);
}
