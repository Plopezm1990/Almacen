import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { Client } = require(process.env.C06_PG_CLIENT || resolve(tmpdir(), 'c06-pg-client', 'node_modules', 'pg'));
const root = resolve(import.meta.dirname, '../../..');
const databaseUrl = process.env.ABC_F5_C06_TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';
const empresa = 'emp-f';
const local = 'loc-f1';
const owner = '00000000-0000-0000-0000-000000000021';
const series = {
  FACTURA: '50000000-0000-0000-0000-000000000005',
  PEDIDO: '50000000-0000-0000-0000-000000000006',
};

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
  assert.equal(migrations.length, 17, 'C06 necesita el baseline F2/A03-A08 completo');
  for (const name of migrations) await db.query(await readFile(resolve(root, 'supabase/migrations', name), 'utf8'));
  await db.query(await readFile(resolve(root, 'supabase/migrations/20260928223000_pm10_cierre_sesion_caja.sql'), 'utf8'));
  await db.query(await readFile(resolve(root, 'supabase/migrations/20261001140000_abc_f5_c04_close_reopen.sql'), 'utf8'));
  await db.query(await readFile(resolve(root, 'supabase/migrations/20261001150000_abc_f5_c05_document_series.sql'), 'utf8'));
  await db.query(await readFile(resolve(root, 'supabase/migrations/20261001160000_abc_f5_c06_document_types.sql'), 'utf8'));
  await db.query(`
    insert into auth.users(id) values ('${owner}') on conflict (id) do nothing;
    insert into public.empresas(id,nombre,activo) values ('${empresa}','Empresa C06',true);
    insert into public.locales(id,empresa_id,nombre,activo) values ('${local}','${empresa}','Local C06',true);
    insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo)
      values ('${owner}','${empresa}','${local}',false,'Propietario',true);
    insert into public.abc_c05_series_documentales(id,empresa_id,local_id,tipo_documento,codigo_serie,nombre)
      values
        ('${series.FACTURA}','${empresa}','${local}','FACTURA','F','Serie de facturas C06'),
        ('${series.PEDIDO}','${empresa}','${local}','PEDIDO','P','Serie de pedidos C06');
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

const admin = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c06-bootstrap' });
const first = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c06-doc-1' });
const second = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c06-doc-2' });

try {
  await admin.connect();
  await bootstrap(admin);
  await first.connect();
  await second.connect();
  await context(first);
  await context(second);

  const invoice = await call(first, 'abc_reservar_numero_documental', ['c06.pg.reserve.0001', empresa, local, 'FACTURA', 'F', 'venta-c06-1', {}]);
  const emitted = await call(first, 'abc_resolver_emision_documental', ['c06.pg.emit.0001', empresa, local, { type: 'uuid', value: invoice.documento_id }, 'EMITIDO', { resultado: 'simulado' }]);
  assert.equal(emitted.estado, 'EMITIDO');
  const complete = await call(first, 'abc_clasificar_documento', ['c06.pg.classify.0001', empresa, local, { type: 'uuid', value: invoice.documento_id }, 'FACTURA_COMPLETA', null, { nombre: 'Cliente C06', identificador_fiscal: 'X0000000X' }]);
  assert.equal(complete.tipo_documental, 'FACTURA_COMPLETA');
  const replay = await call(first, 'abc_clasificar_documento', ['c06.pg.classify.0001', empresa, local, { type: 'uuid', value: invoice.documento_id }, 'FACTURA_COMPLETA', null, { nombre: 'Cliente C06', identificador_fiscal: 'X0000000X' }]);
  assert.equal(replay.clasificacion_id, complete.clasificacion_id);
  await rejects(call(second, 'abc_clasificar_documento', ['c06.pg.classify.0002', empresa, local, { type: 'uuid', value: invoice.documento_id }, 'FACTURA_SIMPLIFICADA', null, {}]), 'documento_tipo_ya_definido');

  const simpleInvoice = await call(second, 'abc_reservar_numero_documental', ['c06.pg.reserve.0002', empresa, local, 'FACTURA', 'F', 'venta-c06-2', {}]);
  await call(second, 'abc_resolver_emision_documental', ['c06.pg.emit.0002', empresa, local, { type: 'uuid', value: simpleInvoice.documento_id }, 'EMITIDO', { resultado: 'simulado' }]);
  const simple = await call(second, 'abc_clasificar_documento', ['c06.pg.classify.0003', empresa, local, { type: 'uuid', value: simpleInvoice.documento_id }, 'FACTURA_SIMPLIFICADA', null, {}]);
  assert.equal(simple.tipo_documental, 'FACTURA_SIMPLIFICADA');

  const rectInvoice = await call(first, 'abc_reservar_numero_documental', ['c06.pg.reserve.0003', empresa, local, 'FACTURA', 'F', 'venta-c06-3', {}]);
  await call(first, 'abc_resolver_emision_documental', ['c06.pg.emit.0003', empresa, local, { type: 'uuid', value: rectInvoice.documento_id }, 'EMITIDO', { resultado: 'simulado' }]);
  await rejects(call(first, 'abc_clasificar_documento', ['c06.pg.classify.0003b', empresa, local, { type: 'uuid', value: rectInvoice.documento_id }, 'FACTURA_COMPLETA', null, {}]), 'factura_completa_datos_receptor_requeridos');
  const rectified = await call(first, 'abc_clasificar_documento', ['c06.pg.classify.0004', empresa, local, { type: 'uuid', value: rectInvoice.documento_id }, 'FACTURA_RECTIFICATIVA', { type: 'uuid', value: invoice.documento_id }, { motivo: 'correccion simulada' }]);
  assert.equal(rectified.tipo_documental, 'FACTURA_RECTIFICATIVA');
  await rejects(call(first, 'abc_clasificar_documento', ['c06.pg.classify.0005', empresa, local, { type: 'uuid', value: rectInvoice.documento_id }, 'FACTURA_COMPLETA', null, { nombre: 'Otro', identificador_fiscal: 'X0000000X' }]), 'documento_tipo_ya_definido');
  await rejects(admin.query(`update public.abc_c06_documentos_clasificados set tipo_documental='FACTURA_SIMPLIFICADA' where id=$1`, [complete.clasificacion_id]), 'clasificacion_documental_inmutable');

  console.log('ABC_F5_C06_POSTGRES_CONTRACT=PASS');
} finally {
  await Promise.allSettled([first.end(), second.end(), admin.end()]);
}
