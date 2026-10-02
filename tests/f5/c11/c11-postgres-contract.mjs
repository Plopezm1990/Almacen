import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { Client } = require(process.env.C11_PG_CLIENT || resolve(tmpdir(), 'c11-pg-client', 'node_modules', 'pg'));
const root = resolve(import.meta.dirname, '../../..');
const databaseUrl = process.env.ABC_F5_C11_TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';
const empresa = 'emp-f';
const local = 'loc-f1';
const owner = '00000000-0000-0000-0000-000000000021';
const serie = '50000000-0000-0000-0000-000000000011';

async function expandFixture(file) {
  const absolute = resolve(root, file);
  const lines = (await readFile(absolute, 'utf8')).split(/\r?\n/);
  const expanded = [];
  for (const line of lines) {
    const nested = line.match(/^\\ir\s+(.+)$/);
    if (nested) expanded.push(await expandFixture(resolve(dirname(absolute), nested[1])));
    else if (!line.startsWith('\\set ')) expanded.push(line);
  }
  return expanded.join('\n');
}

async function bootstrap(db) {
  await db.query(await expandFixture('tests/f3/a08/fixture-a08.sql'));
  const migrations = (await readdir(resolve(root, 'supabase/migrations')))
    .filter((name) => /^2026092[34].*\.sql$/.test(name) && name <= '20260924060000_abc_f3_a08_account_split_merge.sql')
    .sort();
  assert.equal(migrations.length, 17, 'C11 necesita el baseline F2/A03-A08 completo');
  for (const name of migrations) await db.query(await readFile(resolve(root, 'supabase/migrations', name), 'utf8'));
  for (const name of [
    '20260928223000_pm10_cierre_sesion_caja.sql',
    '20261001140000_abc_f5_c04_close_reopen.sql',
    '20261001150000_abc_f5_c05_document_series.sql',
    '20261001160000_abc_f5_c06_document_types.sql',
    '20261001170000_abc_f5_c07_fiscal_gate.sql',
    '20261001180000_abc_f5_c08_document_retention.sql',
    '20261001190000_abc_f5_c09_document_printing.sql',
    '20261001200000_abc_f5_c10_document_delivery.sql',
    '20261001210000_abc_f5_c11_explainable_reconciliation.sql',
  ]) await db.query(await readFile(resolve(root, 'supabase/migrations', name), 'utf8'));
  await db.query(`
    insert into auth.users(id) values ('${owner}') on conflict (id) do nothing;
    insert into public.empresas(id,nombre,activo) values ('${empresa}','Empresa C11',true);
    insert into public.locales(id,empresa_id,nombre,activo) values ('${local}','${empresa}','Local C11',true);
    insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo)
      values ('${owner}','${empresa}','${local}',false,'Propietario',true);
    insert into public.abc_c05_series_documentales(id,empresa_id,local_id,tipo_documento,codigo_serie,nombre)
      values ('${serie}','${empresa}','${local}','FACTURA','F','Serie simulador C11');
  `);
}

async function context(db) {
  await db.query('select set_config($1,$2,false),set_config($3,$4,false),set_config($5,$6,false)', [
    'app.test_empresa', empresa, 'app.test_local', local, 'request.jwt.claim.sub', owner,
  ]);
}

async function call(db, name, args) {
  const casts = args.map((value) => value?.type === 'uuid' ? '::uuid' : '').join(',');
  const expression = args.map((_, index) => `$${index + 1}${casts.split(',')[index]}`).join(',');
  const values = args.map((value) => value?.type === 'uuid' ? value.value : value);
  const result = await db.query(`select public.${name}(${expression}) as value`, values);
  return result.rows[0].value;
}

async function rejects(promise, fragment) {
  await assert.rejects(promise, (error) => String(error?.message || error).includes(fragment), `se esperaba ${fragment}`);
}

const admin = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c11-bootstrap' });
const first = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c11-reconciliation-1' });
const second = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c11-reconciliation-2' });

try {
  await admin.connect();
  await bootstrap(admin);
  await first.connect();
  await second.connect();
  await context(first);
  await context(second);

  const reserved = await call(first, 'abc_reservar_numero_documental', ['c11.pg.reserve.0001', empresa, local, 'FACTURA', 'F', 'venta-c11-1', {}]);
  await call(first, 'abc_resolver_emision_documental', ['c11.pg.emit.0001', empresa, local, { type: 'uuid', value: reserved.documento_id }, 'EMITIDO', { resultado: 'simulado' }]);
  await call(first, 'abc_clasificar_documento', ['c11.pg.classify.0001', empresa, local, { type: 'uuid', value: reserved.documento_id }, 'FACTURA_COMPLETA', null, { nombre: 'Cliente C11', identificador_fiscal: 'X0000000X' }]);
  const version = await call(first, 'abc_conservar_documento_emitido', [
    'c11.pg.retain.0001', empresa, local, { type: 'uuid', value: reserved.documento_id },
    { lines: [{ sku: 'SKU-C11', quantity: 1, total: '10.00' }], total: '10.00' },
    { name: 'Simulador' }, { name: 'Cliente C11', identificador_fiscal: 'X0000000X' }, { mode: 'SIMULADOR' },
  ]);

  const pending = await call(first, 'abc_generar_conciliacion_documental', [
    'c11.pg.reconcile.0001', empresa, local, { type: 'uuid', value: reserved.documento_id }, { type: 'uuid', value: version.version_id },
  ]);
  assert.equal(pending.resultado, 'PENDIENTE_ENTREGA');
  assert.deepEqual(pending.informe.bloqueos, ['ENTREGA_FALTANTE']);
  assert.match(pending.informe_hash, /^[0-9a-f]{64}$/);
  assert.match(pending.informe.explicacion, /falta registrar una entrega/i);

  const printed = await call(first, 'abc_registrar_impresion_documental', [
    'c11.pg.print.0001', empresa, local, { type: 'uuid', value: reserved.documento_id }, { type: 'uuid', value: version.version_id },
    'ORIGINAL', 'PAPEL', 'EMISION', { terminal: 'T-01' },
  ]);
  const delivered = await call(first, 'abc_registrar_entrega_documental', [
    'c11.pg.delivery.0001', empresa, local, { type: 'uuid', value: reserved.documento_id }, { type: 'uuid', value: version.version_id }, { type: 'uuid', value: printed.impresion_id },
    'ORIGINAL', 'PAPEL', { role: 'cliente', reference: 'cliente-c11' }, 'Entrega confirmada en mostrador', null, { terminal: 'T-01' },
  ]);
  assert.equal(delivered.estado, 'REGISTRADA');
  const reconciled = await call(second, 'abc_generar_conciliacion_documental', [
    'c11.pg.reconcile.0002', empresa, local, { type: 'uuid', value: reserved.documento_id }, { type: 'uuid', value: version.version_id },
  ]);
  assert.equal(reconciled.resultado, 'CONCILIADO');
  assert.deepEqual(reconciled.informe.bloqueos, []);
  assert.equal(reconciled.informe.impresion.cantidad, 1);
  assert.equal(reconciled.informe.entrega.cantidad, 1);
  assert.match(reconciled.informe.explicacion, /emitido, clasificado, conservado/i);
  const replay = await call(second, 'abc_generar_conciliacion_documental', [
    'c11.pg.reconcile.0002', empresa, local, { type: 'uuid', value: reserved.documento_id }, { type: 'uuid', value: version.version_id },
  ]);
  assert.equal(replay.conciliacion_id, reconciled.conciliacion_id);
  assert.equal(replay.informe_hash, reconciled.informe_hash);
  await rejects(admin.query(`update public.abc_c11_conciliaciones_documentales set resultado='INCONSISTENTE' where id=$1`, [reconciled.conciliacion_id]), 'conciliacion_documental_inmutable');
  await rejects(admin.query(`delete from public.abc_c11_conciliaciones_documentales where id=$1`, [reconciled.conciliacion_id]), 'conciliacion_documental_inmutable');

  const documentCount = await admin.query('select count(*)::int as n from public.abc_c05_documentos_emitidos where empresa_id=$1 and local_id=$2', [empresa, local]);
  assert.equal(documentCount.rows[0].n, 1, 'conciliar no debe crear otro documento C05');
  const reconciliationCount = await admin.query('select count(*)::int as n from public.abc_c11_conciliaciones_documentales where empresa_id=$1 and local_id=$2', [empresa, local]);
  assert.equal(reconciliationCount.rows[0].n, 2, 'debe conservar el informe pendiente y el conciliado');

  console.log('ABC_F5_C11_POSTGRES_CONTRACT=PASS');
} finally {
  await Promise.allSettled([first.end(), second.end(), admin.end()]);
}
