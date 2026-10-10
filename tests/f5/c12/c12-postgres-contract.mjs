import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { Client } = require(process.env.C12_PG_CLIENT || resolve(tmpdir(), 'c12-pg-client', 'node_modules', 'pg'));
const root = resolve(import.meta.dirname, '../../..');
const databaseUrl = process.env.ABC_F5_C12_TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';
const empresa = 'emp-f';
const local = 'loc-f1';
const owner = '00000000-0000-0000-0000-000000000021';
const terminal = '20000000-0000-0000-0000-000000000012';
const caja = '30000000-0000-0000-0000-000000000097';
const otherCaja = '30000000-0000-0000-0000-000000000098';
const session = '40000000-0000-0000-0000-000000000007';
const otherSession = '40000000-0000-0000-0000-000000000008';
const serie = '50000000-0000-0000-0000-000000000012';
const day = '2026-10-01';

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
  assert.equal(migrations.length, 17, 'C12 necesita el baseline F2/A03-A08 completo');
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
    '20261001220000_abc_f5_c12_close_rehearsal.sql',
    '20261009111255_abc_f7_c12_reconciliation_revision.sql',
    '20261009112332_abc_f7_c12_session_scope.sql',
  ]) await db.query(await readFile(resolve(root, 'supabase/migrations', name), 'utf8'));
  await db.query(`
    insert into auth.users(id) values ('${owner}') on conflict (id) do nothing;
    insert into public.empresas(id,nombre,activo) values ('${empresa}','Empresa C12',true);
    insert into public.locales(id,empresa_id,nombre,activo) values ('${local}','${empresa}','Local C12',true);
    insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo)
      values ('${owner}','${empresa}','${local}',false,'Propietario',true);
    insert into public.terminales_tpv(id,empresa_id,local_id,nombre,activo)
      values ('${terminal}','${empresa}','${local}','Terminal C12',true);
    insert into public.cajas_fisicas(id,empresa_id,local_id,nombre,activo)
      values ('${caja}','${empresa}','${local}','Caja C12',true);
    insert into public.cajas_fisicas(id,empresa_id,local_id,nombre,activo)
      values ('${otherCaja}','${empresa}','${local}','Otra caja C12',true);
    insert into public.caja_sesiones(id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por)
      values ('${session}','${empresa}','${local}','${caja}','ABIERTA',1,now(),'${owner}');
    insert into public.caja_sesiones(id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por)
      values ('${otherSession}','${empresa}','${local}','${otherCaja}','ABIERTA',1,now(),'${owner}');
    insert into public.caja_sesion_terminales(empresa_id,local_id,session_id,terminal_id,desde)
      values ('${empresa}','${local}','${session}','${terminal}',now());
    insert into public.caja_sesion_responsables(empresa_id,local_id,session_id,user_id,desde,asignado_por,motivo)
      values ('${empresa}','${local}','${session}','${owner}',now(),'${owner}','TEST_C12');
    insert into public.abc_c05_series_documentales(id,empresa_id,local_id,tipo_documento,codigo_serie,nombre)
      values ('${serie}','${empresa}','${local}','FACTURA','F','Serie simulador C12');
  `);
}

async function context(db) {
  await db.query('select set_config($1,$2,false),set_config($3,$4,false),set_config($5,$6,false)', [
    'app.test_empresa', empresa, 'app.test_local', local, 'request.jwt.claim.sub', owner,
  ]);
}

async function call(db, name, args) {
  const casts = args.map((value) => value?.type === 'uuid' ? '::uuid' : value?.type === 'date' ? '::date' : '').join(',');
  const expression = args.map((_, index) => `$${index + 1}${casts.split(',')[index]}`).join(',');
  const values = args.map((value) => value?.type === 'uuid' || value?.type === 'date' ? value.value : value);
  const result = await db.query(`select public.${name}(${expression}) as value`, values);
  return result.rows[0].value;
}

async function rejects(promise, fragment) {
  await assert.rejects(promise, (error) => String(error?.message || error).includes(fragment), `se esperaba ${fragment}`);
}

const admin = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c12-bootstrap' });
const first = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c12-rehearsal-1' });
const second = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c12-rehearsal-2' });

try {
  await admin.connect();
  await bootstrap(admin);
  await first.connect();
  await second.connect();
  await context(first);
  await context(second);

  const reserved = await call(first, 'abc_reservar_numero_documental', ['c12.pg.reserve.0001', empresa, local, 'FACTURA', 'F', 'venta-c12-1', { session_id: session }]);
  await call(first, 'abc_resolver_emision_documental', ['c12.pg.emit.0001', empresa, local, { type: 'uuid', value: reserved.documento_id }, 'EMITIDO', { resultado: 'simulado' }]);
  await call(first, 'abc_clasificar_documento', ['c12.pg.classify.0001', empresa, local, { type: 'uuid', value: reserved.documento_id }, 'FACTURA_COMPLETA', null, { nombre: 'Cliente C12', identificador_fiscal: 'X0000000X' }]);
  const version = await call(first, 'abc_conservar_documento_emitido', [
    'c12.pg.retain.0001', empresa, local, { type: 'uuid', value: reserved.documento_id },
    { lines: [{ sku: 'SKU-C12', quantity: 1, total: '10.00' }], total: '10.00' },
    { name: 'Simulador' }, { name: 'Cliente C12', identificador_fiscal: 'X0000000X' }, { mode: 'SIMULADOR' },
  ]);

  const pending = await call(first, 'abc_generar_conciliacion_documental', [
    'c12.pg.reconcile.0001', empresa, local, { type: 'uuid', value: reserved.documento_id }, { type: 'uuid', value: version.version_id },
  ]);
  assert.equal(pending.resultado, 'PENDIENTE_ENTREGA');

  const otherReserved = await call(first, 'abc_reservar_numero_documental', [
    'c12.pg.other.reserve.0001', empresa, local, 'FACTURA', 'F', 'venta-c12-otra-sesion', { session_id: otherSession },
  ]);
  await call(first, 'abc_resolver_emision_documental', [
    'c12.pg.other.emit.0001', empresa, local, { type: 'uuid', value: otherReserved.documento_id }, 'EMITIDO', { resultado: 'simulado' },
  ]);
  await call(first, 'abc_clasificar_documento', [
    'c12.pg.other.classify.0001', empresa, local, { type: 'uuid', value: otherReserved.documento_id },
    'FACTURA_COMPLETA', null, { nombre: 'Otra sesión', identificador_fiscal: 'X0000001X' },
  ]);
  const otherVersion = await call(first, 'abc_conservar_documento_emitido', [
    'c12.pg.other.retain.0001', empresa, local, { type: 'uuid', value: otherReserved.documento_id },
    { lines: [{ sku: 'SKU-OTHER', quantity: 1, total: '5.00' }], total: '5.00' },
    { name: 'Simulador' }, { name: 'Otra sesión', identificador_fiscal: 'X0000001X' }, { mode: 'SIMULADOR' },
  ]);
  const otherPending = await call(first, 'abc_generar_conciliacion_documental', [
    'c12.pg.other.reconcile.0001', empresa, local, { type: 'uuid', value: otherReserved.documento_id },
    { type: 'uuid', value: otherVersion.version_id },
  ]);
  assert.equal(otherPending.resultado, 'PENDIENTE_ENTREGA');

  const firstRehearsal = await call(first, 'abc_ensayar_cierre_sesion_caja', [
    'c12.pg.rehearse.0001', empresa, local, { type: 'uuid', value: session }, { type: 'uuid', value: terminal }, { type: 'date', value: day },
  ]);
  assert.equal(firstRehearsal.resultado, 'PENDIENTE');
  assert.deepEqual(firstRehearsal.informe.bloqueos.sort(), ['CONCILIACIONES_DOCUMENTALES_PENDIENTES', 'CONTEO_FALTANTE'].sort());
  assert.equal(firstRehearsal.informe.sin_cambios, true);
  assert.match(firstRehearsal.informe_hash, /^[0-9a-f]{64}$/);

  const printed = await call(first, 'abc_registrar_impresion_documental', [
    'c12.pg.print.0001', empresa, local, { type: 'uuid', value: reserved.documento_id }, { type: 'uuid', value: version.version_id },
    'ORIGINAL', 'PAPEL', 'EMISION', { terminal: 'T-C12' },
  ]);
  await call(first, 'abc_registrar_entrega_documental', [
    'c12.pg.delivery.0001', empresa, local, { type: 'uuid', value: reserved.documento_id }, { type: 'uuid', value: version.version_id }, { type: 'uuid', value: printed.impresion_id },
    'ORIGINAL', 'PAPEL', { role: 'cliente', reference: 'cliente-c12' }, 'Entrega confirmada', null, { terminal: 'T-C12' },
  ]);
  const reconciled = await call(second, 'abc_generar_conciliacion_documental', [
    'c12.pg.reconcile.0002', empresa, local, { type: 'uuid', value: reserved.documento_id }, { type: 'uuid', value: version.version_id },
  ]);
  assert.equal(reconciled.resultado, 'CONCILIADO');

  const started = await call(first, 'abc_iniciar_cierre_sesion_caja', [
    'c12.pg.start.0001', empresa, local, { type: 'uuid', value: session }, { type: 'uuid', value: terminal }, { type: 'date', value: day },
  ]);
  assert.equal(started.estado, 'EN_CIERRE');
  const provisional = await call(first, 'abc_confirmar_cierre_provisional', [
    'c12.pg.provisional.0001', empresa, local, { type: 'uuid', value: session }, { type: 'uuid', value: terminal }, 'EUR', 0, { type: 'date', value: day },
  ]);
  assert.equal(provisional.estado, 'CIERRE_PROVISIONAL');

  const before = await admin.query(`
    select s.estado, s.version,
           (select count(*)::int from public.caja_cierres where session_id=$1) as cierres,
           (select count(*)::int from public.caja_conteos cc join public.caja_cierres c on c.id=cc.cierre_id where c.session_id=$1) as conteos
      from public.caja_sesiones s where s.id=$1
  `, [session]);
  const finalRehearsal = await call(second, 'abc_ensayar_cierre_sesion_caja', [
    'c12.pg.rehearse.0002', empresa, local, { type: 'uuid', value: session }, { type: 'uuid', value: terminal }, { type: 'date', value: day },
  ]);
  assert.equal(finalRehearsal.resultado, 'APTO_CIERRE');
  assert.deepEqual(finalRehearsal.informe.bloqueos, []);
  assert.equal(finalRehearsal.informe.sin_cambios, true);
  assert.equal(finalRehearsal.informe.documentos.documentos_conciliados, 1);
  assert.equal(finalRehearsal.informe.documentos.documentos_pendientes, 0, 'otra sesión no bloquea C12');
  assert.equal(finalRehearsal.informe.caja.counted_amount, 0);
  assert.equal(finalRehearsal.informe.caja.difference, 0);

  const after = await admin.query(`
    select s.estado, s.version,
           (select count(*)::int from public.caja_cierres where session_id=$1) as cierres,
           (select count(*)::int from public.caja_conteos cc join public.caja_cierres c on c.id=cc.cierre_id where c.session_id=$1) as conteos
      from public.caja_sesiones s where s.id=$1
  `, [session]);
  assert.deepEqual(after.rows[0], before.rows[0], 'el ensayo no debe mutar el cierre real');

  const replay = await call(second, 'abc_ensayar_cierre_sesion_caja', [
    'c12.pg.rehearse.0002', empresa, local, { type: 'uuid', value: session }, { type: 'uuid', value: terminal }, { type: 'date', value: day },
  ]);
  assert.equal(replay.ensayo_id, finalRehearsal.ensayo_id);
  assert.equal(replay.informe_hash, finalRehearsal.informe_hash);
  await rejects(admin.query(`update public.abc_c12_ensayos_cierre set resultado='BLOQUEADO' where id=$1`, [finalRehearsal.ensayo_id]), 'ensayo_cierre_inmutable');
  await rejects(admin.query(`delete from public.abc_c12_ensayos_cierre where id=$1`, [finalRehearsal.ensayo_id]), 'ensayo_cierre_inmutable');

  const reportCount = await admin.query('select count(*)::int as n from public.abc_c12_ensayos_cierre where empresa_id=$1 and local_id=$2', [empresa, local]);
  assert.equal(reportCount.rows[0].n, 2);

  console.log('ABC_F5_C12_POSTGRES_CONTRACT=PASS');
} finally {
  await Promise.allSettled([first.end(), second.end(), admin.end()]);
}
