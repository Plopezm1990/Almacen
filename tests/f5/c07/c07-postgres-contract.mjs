import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { Client } = require(process.env.C07_PG_CLIENT || resolve(tmpdir(), 'c07-pg-client', 'node_modules', 'pg'));
const root = resolve(import.meta.dirname, '../../..');
const databaseUrl = process.env.ABC_F5_C07_TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';
const empresa = 'emp-f';
const local = 'loc-f1';
const owner = '00000000-0000-0000-0000-000000000021';
const serie = '50000000-0000-0000-0000-000000000007';

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
  assert.equal(migrations.length, 17, 'C07 necesita el baseline F2/A03-A08 completo');
  for (const name of migrations) await db.query(await readFile(resolve(root, 'supabase/migrations', name), 'utf8'));
  for (const name of [
    '20260928223000_pm10_cierre_sesion_caja.sql',
    '20261001140000_abc_f5_c04_close_reopen.sql',
    '20261001150000_abc_f5_c05_document_series.sql',
    '20261001160000_abc_f5_c06_document_types.sql',
    '20261001170000_abc_f5_c07_fiscal_gate.sql',
  ]) await db.query(await readFile(resolve(root, 'supabase/migrations', name), 'utf8'));
  await db.query(`
    insert into auth.users(id) values ('${owner}') on conflict (id) do nothing;
    insert into public.empresas(id,nombre,activo) values ('${empresa}','Empresa C07',true);
    insert into public.locales(id,empresa_id,nombre,activo) values ('${local}','${empresa}','Local C07',true);
    insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo)
      values ('${owner}','${empresa}','${local}',false,'Propietario',true);
    insert into public.abc_c05_series_documentales(id,empresa_id,local_id,tipo_documento,codigo_serie,nombre)
      values ('${serie}','${empresa}','${local}','FACTURA','F','Serie simulador C07');
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

const admin = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c07-bootstrap' });
const first = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c07-fiscal-1' });
const second = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c07-fiscal-2' });

try {
  await admin.connect();
  await bootstrap(admin);
  await first.connect();
  await context(first);

  const configured = await call(first, 'abc_configurar_modalidad_fiscal', [
    'c07.pg.config.0001', empresa, local, 'ES', 'INTERNO', 'SIF_SIMULADOR', null, 'SIMULADOR', false, { proveedor: 'pendiente' },
  ]);
  assert.equal(configured.estado, 'SIMULADOR');
  await rejects(call(first, 'abc_configurar_modalidad_fiscal', ['c07.pg.config.0002', empresa, local, 'ES', 'INTERNO', 'SIF_PRODUCCION', null, 'ACTIVO', true, {}]), 'c07_activacion_requiere_validacion_asesoria');
  await rejects(call(first, 'abc_configurar_modalidad_fiscal', ['c07.pg.config.0003', empresa, local, 'ES', 'PROVEEDOR_FISCAL', 'SIF_SIMULADOR', null, 'SIMULADOR', false, {}]), 'proveedor_fiscal_requerido');

  const invoice = await call(first, 'abc_reservar_numero_documental', ['c07.pg.reserve.0001', empresa, local, 'FACTURA', 'F', 'venta-c07-1', {}]);
  await call(first, 'abc_resolver_emision_documental', ['c07.pg.emit.0001', empresa, local, { type: 'uuid', value: invoice.documento_id }, 'EMITIDO', { resultado: 'simulado' }]);
  await call(first, 'abc_clasificar_documento', ['c07.pg.classify.0001', empresa, local, { type: 'uuid', value: invoice.documento_id }, 'FACTURA_SIMPLIFICADA', null, {}]);
  const simulated = await call(first, 'abc_evaluar_documento_fiscal', ['c07.pg.eval.0001', empresa, local, { type: 'uuid', value: invoice.documento_id }, true]);
  assert.equal(simulated.ok, true);
  assert.equal(simulated.resultado, 'PREPARADO_SIMULADOR');
  const blocked = await call(first, 'abc_evaluar_documento_fiscal', ['c07.pg.eval.0002', empresa, local, { type: 'uuid', value: invoice.documento_id }, false]);
  assert.equal(blocked.ok, false);
  assert.deepEqual(blocked.bloqueos, ['MODALIDAD_NO_ACTIVA']);

  await admin.query(await readFile(resolve(root, 'supabase/migrations/20261026175245_abc_fiscal_multiempresa_borradores.sql'), 'utf8'));
  await admin.query(await readFile(resolve(root, 'supabase/migrations/20261026182012_abc_fiscal_multiempresa_panel.sql'), 'utf8'));
  const multiempresa = await admin.query(await readFile(resolve(root, 'tests/f5/c07/fiscal-config-multiempresa.sql'), 'utf8'));
  const fiscalChecks = multiempresa.flatMap(r => r.rows).find(row => row.fiscal_config_checks !== undefined)?.fiscal_config_checks;
  assert.ok(fiscalChecks >= 30, 'Contrato multiempresa completo');
  console.log(`FISCAL_CONFIG_MULTIEMPRESA_CHECKS=${fiscalChecks}`);

  // Dos conexiones contra el mismo emisor: una sola gana la versión 0.
  const entity = '20000000-0000-0000-0000-000000000100';
  await admin.query(`insert into public.membresias_usuario(user_id,empresa_id,rol,todos_locales,local_id)
    values ($1,$2,'Propietario',true,null)`, [owner,empresa]);
  await admin.query(`insert into public.entidades_fiscales(id,empresa_id,nombre_legal,country_code)
    values ($1,$2,'Emisor sintético para concurrencia','ES')`, [entity,empresa]);
  await admin.query(`insert into public.entidad_fiscal_locales(empresa_id,local_id,entidad_fiscal_id)
    values ($1,$2,$3)`, [empresa,local,entity]);
  await second.connect();
  await context(second);
  await first.query('set role authenticated');
  await second.query('set role authenticated');
  const saveDraft = (client,operation) => client.query(`select public.abc_fiscal_guardar_borrador(
    $1,$2,$3,$4,0,'{}'::jsonb) as result`, [operation,empresa,local,entity]);
  const race = await Promise.allSettled([
    saveDraft(first,'30000000-0000-0000-0000-000000000100'),
    saveDraft(second,'30000000-0000-0000-0000-000000000101'),
  ]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1,'Una sola escritura concurrente');
  const rejected = race.find(r=>r.status==='rejected');
  assert.match(rejected.reason.message,/FISCAL_CONFIG_VERSION_OBSOLETA/);
  assert.equal((await admin.query(`select count(*)::int as n from private.abc_fiscal_borrador_revisiones
    where empresa_id=$1 and entidad_fiscal_id=$2`,[empresa,entity])).rows[0].n,1);
  await first.query('reset role');
  await second.query('reset role');
  console.log('FISCAL_CONFIG_CONCURRENCIA=PASS');
  console.log('ABC_F5_C07_POSTGRES_CONTRACT=PASS');
} finally {
  await Promise.allSettled([first.end(), second.end(), admin.end()]);
}
