import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { Client } = require(process.env.C05_PG_CLIENT || resolve(tmpdir(), 'c05-pg-client', 'node_modules', 'pg'));
const root = resolve(import.meta.dirname, '../../..');
const databaseUrl = process.env.ABC_F5_C05_TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';
const empresa = 'emp-f';
const local = 'loc-f1';
const owner = '00000000-0000-0000-0000-000000000021';
const serie = '50000000-0000-0000-0000-000000000005';

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
  assert.equal(migrations.length, 17, 'C05 necesita el baseline F2/A03-A08 completo');
  for (const name of migrations) await db.query(await readFile(resolve(root, 'supabase/migrations', name), 'utf8'));
  await db.query(await readFile(resolve(root, 'supabase/migrations/20260928223000_pm10_cierre_sesion_caja.sql'), 'utf8'));
  await db.query(await readFile(resolve(root, 'supabase/migrations/20261001140000_abc_f5_c04_close_reopen.sql'), 'utf8'));
  await db.query(await readFile(resolve(root, 'supabase/migrations/20261001150000_abc_f5_c05_document_series.sql'), 'utf8'));
  await db.query(`
    insert into auth.users(id) values ('${owner}') on conflict (id) do nothing;
    insert into public.empresas(id,nombre,activo) values ('${empresa}','Empresa C05',true);
    insert into public.locales(id,empresa_id,nombre,activo) values ('${local}','${empresa}','Local C05',true);
    insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo)
      values ('${owner}','${empresa}','${local}',false,'Propietario',true);
    insert into public.abc_c05_series_documentales(id,empresa_id,local_id,tipo_documento,codigo_serie,nombre)
      values ('${serie}','${empresa}','${local}','FACTURA','F','Serie fiscal pendiente de C07');
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

const admin = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c05-bootstrap' });
const first = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c05-series-1' });
const second = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c05-series-2' });

try {
  await admin.connect();
  await bootstrap(admin);
  await first.connect();
  await second.connect();
  await context(first);
  await context(second);

  const concurrent = await Promise.all([
    call(first, 'abc_reservar_numero_documental', ['c05.pg.reserve.0001', empresa, local, 'FACTURA', 'F', 'venta-1', { ok: true }]),
    call(second, 'abc_reservar_numero_documental', ['c05.pg.reserve.0002', empresa, local, 'FACTURA', 'F', 'venta-2', { ok: true }]),
  ]);
  assert.deepEqual(concurrent.map((item) => item.numero).sort((a, b) => a - b), [1, 2], 'la concurrencia debe asignar numeros distintos y consecutivos');

  const replay = await call(first, 'abc_reservar_numero_documental', ['c05.pg.reserve.0001', empresa, local, 'FACTURA', 'F', 'venta-1', { ok: true }]);
  assert.equal(replay.documento_id, concurrent[0].documento_id, 'el replay debe recuperar el documento original');
  assert.equal(replay.numero, concurrent[0].numero);

  const pending = await call(first, 'abc_resolver_emision_documental', ['c05.pg.resolve.0001', empresa, local, { type: 'uuid', value: concurrent[0].documento_id }, 'PENDIENTE', { consulta: 'simulador', confirmado: false }]);
  assert.equal(pending.estado, 'PENDIENTE');
  const emitted = await call(second, 'abc_resolver_emision_documental', ['c05.pg.resolve.0002', empresa, local, { type: 'uuid', value: concurrent[1].documento_id }, 'EMITIDO', { autoridad: 'interna', referencia: 'simulada-2' }]);
  assert.equal(emitted.estado, 'EMITIDO');
  const recovered = await call(first, 'abc_resolver_emision_documental', ['c05.pg.resolve.0003', empresa, local, { type: 'uuid', value: concurrent[1].documento_id }, 'EMITIDO', { reintento: true }]);
  assert.equal(recovered.recovered, true, 'la resolucion posterior debe recuperar el numero ya emitido');
  assert.equal(recovered.numero, emitted.numero);

  await rejects(admin.query(`update public.abc_c05_documentos_emitidos set numero=99 where id=$1`, [concurrent[1].documento_id]), 'documento_identidad_inmutable');
  await rejects(admin.query(`update public.abc_c05_documentos_emitidos set estado='ERROR' where id=$1`, [concurrent[1].documento_id]), 'documento_emitido_inmutable');

  console.log('ABC_F5_C05_POSTGRES_CONTRACT=PASS');
} finally {
  await Promise.allSettled([first.end(), second.end(), admin.end()]);
}
