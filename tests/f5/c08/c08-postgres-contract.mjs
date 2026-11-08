import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { Client } = require(process.env.C08_PG_CLIENT || resolve(tmpdir(), 'c08-pg-client', 'node_modules', 'pg'));
const root = resolve(import.meta.dirname, '../../..');
const databaseUrl = process.env.ABC_F5_C08_TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';
const empresa = 'emp-f';
const local = 'loc-f1';
const owner = '00000000-0000-0000-0000-000000000021';
const serie = '50000000-0000-0000-0000-000000000008';

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
  assert.equal(migrations.length, 17, 'C08 necesita el baseline F2/A03-A08 completo');
  for (const name of migrations) await db.query(await readFile(resolve(root, 'supabase/migrations', name), 'utf8'));
  for (const name of [
    '20260928223000_pm10_cierre_sesion_caja.sql',
    '20261001140000_abc_f5_c04_close_reopen.sql',
    '20261001150000_abc_f5_c05_document_series.sql',
    '20261001160000_abc_f5_c06_document_types.sql',
    '20261001170000_abc_f5_c07_fiscal_gate.sql',
    '20261001180000_abc_f5_c08_document_retention.sql',
  ]) await db.query(await readFile(resolve(root, 'supabase/migrations', name), 'utf8'));
  await db.query(`
    insert into auth.users(id) values ('${owner}') on conflict (id) do nothing;
    insert into public.empresas(id,nombre,activo) values ('${empresa}','Empresa C08',true);
    insert into public.locales(id,empresa_id,nombre,activo) values ('${local}','${empresa}','Local C08',true);
    insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo)
      values ('${owner}','${empresa}','${local}',false,'Propietario',true);
    insert into public.abc_c05_series_documentales(id,empresa_id,local_id,tipo_documento,codigo_serie,nombre)
      values ('${serie}','${empresa}','${local}','FACTURA','F','Serie simulador C08');
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

async function emitAndClassify(db, suffix, type, reference = null) {
  const reserved = await call(db, 'abc_reservar_numero_documental', [`c08.pg.reserve.${suffix}`, empresa, local, 'FACTURA', 'F', `venta-c08-${suffix}`, {}]);
  await call(db, 'abc_resolver_emision_documental', [`c08.pg.emit.${suffix}`, empresa, local, { type: 'uuid', value: reserved.documento_id }, 'EMITIDO', { resultado: 'simulado' }]);
  const classified = await call(db, 'abc_clasificar_documento', [`c08.pg.classify.${suffix}`, empresa, local, { type: 'uuid', value: reserved.documento_id }, type, reference ? { type: 'uuid', value: reference } : null, type === 'FACTURA_COMPLETA' ? { nombre: 'Cliente C08', identificador_fiscal: 'X0000000X' } : { motivo: 'correccion simulada' }]);
  return { id: reserved.documento_id, classified };
}

const admin = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c08-bootstrap' });
const first = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c08-retention-1' });
const second = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c08-retention-2' });

try {
  await admin.connect();
  await bootstrap(admin);
  await first.connect();
  await second.connect();
  await context(first);
  await context(second);

  const original = await emitAndClassify(first, '0001', 'FACTURA_COMPLETA');
  const snapshot = { lines: [{ sku: 'SKU-C08', quantity: 1, total: '10.00' }], total: '10.00' };
  const preserved = await call(first, 'abc_conservar_documento_emitido', [
    'c08.pg.retain.0001', empresa, local, { type: 'uuid', value: original.id }, snapshot,
    { name: 'Simulador' }, { name: 'Cliente C08', identificador_fiscal: 'X0000000X' }, { mode: 'SIMULADOR' },
  ]);
  assert.equal(preserved.ok, true);
  assert.match(preserved.snapshot_hash, /^[0-9a-f]{64}$/);
  assert.equal(preserved.numero_version, 1);
  const replay = await call(first, 'abc_conservar_documento_emitido', [
    'c08.pg.retain.0001', empresa, local, { type: 'uuid', value: original.id }, snapshot,
    { name: 'Simulador' }, { name: 'Cliente C08', identificador_fiscal: 'X0000000X' }, { mode: 'SIMULADOR' },
  ]);
  assert.equal(replay.version_id, preserved.version_id);
  assert.equal(replay.snapshot_hash, preserved.snapshot_hash);
  await rejects(call(second, 'abc_conservar_documento_emitido', [
    'c08.pg.retain.0002', empresa, local, { type: 'uuid', value: original.id }, snapshot,
    { name: 'Otro' }, {}, {},
  ]), 'documento_version_ya_conservada');
  await rejects(admin.query(`update public.abc_c08_documento_versiones set snapshot='{"tampered":true}'::jsonb where id=$1`, [preserved.version_id]), 'documento_version_inmutable');

  const correction = await emitAndClassify(first, '0002', 'FACTURA_RECTIFICATIVA', original.id);
  const correctionVersion = await call(first, 'abc_conservar_documento_emitido', [
    'c08.pg.retain.0002', empresa, local, { type: 'uuid', value: correction.id }, { total: '9.00', reason: 'ajuste' },
    { name: 'Simulador' }, { name: 'Cliente C08' }, { mode: 'SIMULADOR' },
  ]);
  assert.equal(correctionVersion.ok, true);
  const rectification = await call(first, 'abc_registrar_correccion_documental', [
    'c08.pg.correct.0001', empresa, local, { type: 'uuid', value: original.id }, 'RECTIFICACION',
    { type: 'uuid', value: correction.id }, 'Ajuste de importe', { amount_delta: '-1.00' },
  ]);
  assert.equal(rectification.tipo_correccion, 'RECTIFICACION');
  assert.equal(rectification.estado, 'REGISTRADA');
  await rejects(call(first, 'abc_registrar_correccion_documental', [
    'c08.pg.correct.0002', empresa, local, { type: 'uuid', value: original.id }, 'RECTIFICACION', null,
    'Falta documento', {},
  ]), 'rectificacion_documento_requerido');
  const cancellation = await call(first, 'abc_registrar_correccion_documental', [
    'c08.pg.correct.0003', empresa, local, { type: 'uuid', value: original.id }, 'CANCELACION_OPERATIVA', null,
    'Solicitud del cliente', {},
  ]);
  assert.equal(cancellation.tipo_correccion, 'CANCELACION_OPERATIVA');
  const refund = await call(first, 'abc_registrar_correccion_documental', [
    'c08.pg.correct.0004', empresa, local, { type: 'uuid', value: original.id }, 'REEMBOLSO', null,
    'Devolucion simulada', { amount: '10.00' },
  ]);
  assert.equal(refund.tipo_correccion, 'REEMBOLSO');
  await rejects(admin.query(`update public.abc_c08_correcciones_documentales set motivo='alterado' where id=$1`, [rectification.correccion_id]), 'correccion_documental_inmutable');

  console.log('ABC_F5_C08_POSTGRES_CONTRACT=PASS');
} finally {
  await Promise.allSettled([first.end(), second.end(), admin.end()]);
}
