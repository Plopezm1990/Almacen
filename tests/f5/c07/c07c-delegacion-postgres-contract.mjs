import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { Client } = require(process.env.C07_PG_CLIENT || resolve(tmpdir(), 'c07-pg-client', 'node_modules', 'pg'));
const root = resolve(import.meta.dirname, '../../..');
const databaseUrl = process.env.ABC_F5_C07_TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';

const companyA = 'group-a-company-a';
const companyB = 'group-a-company-b';
const localA = 'group-a-local-a1';
const localB = 'group-a-local-b1';
const ownerA = '00000000-0000-0000-0000-000000000101';
const advisorA = '00000000-0000-0000-0000-000000000102';
const ownerB = '00000000-0000-0000-0000-000000000103';
const wrongUser = '00000000-0000-0000-0000-000000000104';
const entityA = '20000000-0000-0000-0000-000000000101';
const entityB = '20000000-0000-0000-0000-000000000102';
const future30 = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

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

async function apply(file, db) {
  await db.query(await readFile(resolve(root, file), 'utf8'));
}

async function bootstrap(db) {
  await db.query(await expandFixture('tests/f3/a08/fixture-a08.sql'));
  // El fixture mínimo solo modela auth.users(id); Supabase real también
  // expone auth.users.email, que C07-C utiliza para aceptar invitaciones.
  await db.query('alter table auth.users add column if not exists email text');
  const baseline = (await readdir(resolve(root, 'supabase/migrations')))
    .filter((name) => /^2026092[34].*\.sql$/.test(name) && name <= '20260924060000_abc_f3_a08_account_split_merge.sql')
    .sort();
  assert.equal(baseline.length, 17, 'Debe existir el baseline F2/A03-A08');
  for (const name of baseline) await apply(`supabase/migrations/${name}`, db);
  for (const name of [
    '20260928223000_pm10_cierre_sesion_caja.sql',
    '20261001140000_abc_f5_c04_close_reopen.sql',
    '20261001150000_abc_f5_c05_document_series.sql',
    '20261001160000_abc_f5_c06_document_types.sql',
    '20261001170000_abc_f5_c07_fiscal_gate.sql',
    'supabase/migrations/20261026175245_abc_fiscal_multiempresa_borradores.sql',
    'supabase/migrations/20261026182012_abc_fiscal_multiempresa_panel.sql',
    'supabase/migrations/20261027110000_abc_fiscal_multiempresa_delegacion.sql',
    'supabase/migrations/20261027111500_abc_fiscal_multiempresa_delegacion_accept.sql',
    'supabase/migrations/20261027113000_abc_fiscal_multiempresa_representacion_read.sql',
    'supabase/migrations/20261027114500_abc_fiscal_multiempresa_delegacion_lifecycle_checks.sql',
  ]) {
    await apply(name.startsWith('supabase/') ? name : `supabase/migrations/${name}`, db);
  }
  await db.query(`insert into auth.users(id,email) values
    ($1,'owner-a@example.invalid'),($2,'advisor-a@example.invalid'),
    ($3,'owner-b@example.invalid'),($4,'wrong@example.invalid')`,
    [ownerA, advisorA, ownerB, wrongUser]);
  await db.query(`insert into public.empresas(id,nombre,activo) values
    ($1,'Empresa Grupo A',true),($2,'Empresa Grupo B',true)`, [companyA, companyB]);
  await db.query(`insert into public.locales(id,empresa_id,nombre,activo) values
    ($1,$2,'Local A1',true),($3,$4,'Local B1',true)`, [localA, companyA, localB, companyB]);
  await db.query(`insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo) values
    ($1,$2,null,true,'Propietario',true),($3,$4,null,true,'Propietario',true)`,
    [ownerA, companyA, ownerB, companyB]);
  await db.query(`insert into public.entidades_fiscales(id,empresa_id,nombre_legal,country_code,activa) values
    ($1,$2,'Emisor Grupo A','ES',true),($3,$4,'Emisor Grupo B','ES',true)`,
    [entityA, companyA, entityB, companyB]);
  await db.query(`insert into public.entidad_fiscal_locales(empresa_id,local_id,entidad_fiscal_id,activa) values
    ($1,$2,$3,true),($4,$5,$6,true)`,
    [companyA, localA, entityA, companyB, localB, entityB]);
}

async function setIdentity(db, userId, company, local) {
  await db.query('reset role');
  await db.query('select set_config($1,$2,false),set_config($3,$4,false),set_config($5,$6,false)', [
    'app.test_empresa', company, 'app.test_local', local, 'request.jwt.claim.sub', userId,
  ]);
  await db.query('set role authenticated');
}

async function call(db, name, args, uuidIndices = []) {
  const placeholders = args.map((_, i) => `$${i + 1}${uuidIndices.includes(i) ? '::uuid' : ''}`).join(',');
  const result = await db.query(`select public.${name}(${placeholders}) as value`, args);
  return result.rows[0].value;
}

async function rejects(promise, fragment) {
  await assert.rejects(promise, (error) => String(error?.message || error).includes(fragment), `Se esperaba ${fragment}`);
}

const admin = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c07c-admin' });
const owner = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c07c-owner' });
const advisor = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c07c-advisor' });
const other = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c07c-other' });
const wrong = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c07c-wrong' });

try {
  await admin.connect();
  await bootstrap(admin);

  const tableChecks = await admin.query(`
    select bool_and(relrowsecurity) as all_rls
    from pg_class
    where oid in (
      'private.abc_fiscal_delegaciones'::regclass,
      'private.abc_fiscal_delegacion_revisiones'::regclass,
      'private.abc_fiscal_representaciones'::regclass,
      'private.abc_fiscal_representacion_revisiones'::regclass
    )
  `);
  assert.equal(tableChecks.rows[0].all_rls, true, 'RLS Grupo A');
  assert.equal((await admin.query("select has_table_privilege('authenticated','private.abc_fiscal_delegaciones','SELECT') as allowed")).rows[0].allowed, false, 'Sin lectura directa');
  assert.equal((await admin.query("select has_function_privilege('anon','public.abc_fiscal_aceptar_delegacion(uuid,uuid)','EXECUTE') as allowed")).rows[0].allowed, false, 'Anon sin aceptación');
  assert.equal((await admin.query("select has_function_privilege('service_role','public.abc_fiscal_guardar_representacion(uuid,text,text,uuid,text,text,text,text,date,date)','EXECUTE') as allowed")).rows[0].allowed, false, 'Service sin RPC pública');

  await owner.connect();
  await setIdentity(owner, ownerA, companyA, localA);
  const invitation = await call(owner, 'abc_fiscal_invitar_asesoria', [
    '30000000-0000-0000-0000-000000000101', companyA, localA, entityA,
    'Advisor-A@Example.Invalid', 'PROPONER', future30(),
  ], [0, 3]);
  assert.equal(invitation.estado, 'INVITADA');
  assert.equal(invitation.email, 'advisor-a@example.invalid');
  const replay = await call(owner, 'abc_fiscal_invitar_asesoria', [
    '30000000-0000-0000-0000-000000000101', companyA, localA, entityA,
    'advisor-a@example.invalid', 'PROPONER', future30(),
  ], [0, 3]);
  assert.deepEqual(replay, invitation, 'Invitación idempotente');

  await advisor.connect();
  await setIdentity(advisor, advisorA, companyA, localA);
  const accepted = await call(advisor, 'abc_fiscal_aceptar_delegacion', [
    '30000000-0000-0000-0000-000000000102', invitation.id,
  ], [0, 1]);
  assert.equal(accepted.estado, 'ACEPTADA');
  assert.equal(accepted.emision_habilitada, false);
  await rejects(call(advisor, 'abc_fiscal_aceptar_delegacion', [
    '30000000-0000-0000-0000-000000000102', invitation.id,
  ], [0, 1]), 'FISCAL_DELEGACION_ESTADO_INVALIDO');
  await rejects(call(advisor, 'abc_fiscal_listar_delegaciones', [companyA, localA, entityA], [2]), 'FISCAL_DELEGACION_NO_AUTORIZADO');
  await rejects(call(advisor, 'abc_fiscal_guardar_representacion', [
    '30000000-0000-0000-0000-000000000103', companyA, localA, entityA,
    'ACREDITADA', 'ACREDITADA', 'ref-no-owner', 'a'.repeat(64), null, null,
  ], [0, 3]), 'FISCAL_DELEGACION_NO_AUTORIZADO');

  await wrong.connect();
  await setIdentity(wrong, wrongUser, companyA, localA);
  await rejects(call(wrong, 'abc_fiscal_aceptar_delegacion', [
    '30000000-0000-0000-0000-000000000104', invitation.id,
  ], [0, 1]), 'FISCAL_DELEGACION_IDENTIDAD_NO_COINCIDE');

  await owner.query('reset role');
  await setIdentity(owner, ownerA, companyA, localA);
  const expired = await call(owner, 'abc_fiscal_invitar_asesoria', [
    '30000000-0000-0000-0000-000000000105', companyA, localA, entityA,
    'expired@example.invalid', 'CONSULTAR', future30(),
  ], [0, 3]);
  await admin.query('alter table private.abc_fiscal_delegaciones disable trigger abc_fiscal_delegacion_scope');
  await admin.query("update private.abc_fiscal_delegaciones set creada_at='1999-01-01T00:00:00Z', expira_at='2000-01-01T00:00:00Z', actualizada_at='1999-01-01T00:00:00Z' where id=$1", [expired.id]);
  await admin.query('alter table private.abc_fiscal_delegaciones enable trigger abc_fiscal_delegacion_scope');
  await admin.query("update auth.users set email='expired@example.invalid' where id=$1", [wrongUser]);
  await setIdentity(wrong, wrongUser, companyA, localA);
  await rejects(call(wrong, 'abc_fiscal_aceptar_delegacion', [
    '30000000-0000-0000-0000-000000000106', expired.id,
  ], [0, 1]), 'FISCAL_DELEGACION_CADUCADA');
  const listed = await call(owner, 'abc_fiscal_listar_delegaciones', [companyA, localA, entityA], [2]);
  assert.ok(listed.delegaciones.some((row) => row.id === expired.id && row.estado === 'CADUCADA'), 'Caducidad persistida');

  const revokedInvitation = await call(owner, 'abc_fiscal_invitar_asesoria', [
    '30000000-0000-0000-0000-000000000107', companyA, localA, entityA,
    'revoked@example.invalid', 'CONSULTAR', future30(),
  ], [0, 3]);
  const revoked = await call(owner, 'abc_fiscal_revocar_delegacion', [
    '30000000-0000-0000-0000-000000000108', companyA, localA, revokedInvitation.id,
  ], [0, 3]);
  assert.equal(revoked.estado, 'REVOCADA');

  const representation = await call(owner, 'abc_fiscal_guardar_representacion', [
    '30000000-0000-0000-0000-000000000109', companyA, localA, entityA,
    'APODERAMIENTO', 'ACREDITADA', 'aeat-ref-group-a', 'b'.repeat(64), null, null,
  ], [0, 3]);
  assert.equal(representation.estado, 'ACREDITADA');
  assert.equal(representation.emision_habilitada, false);
  const representationRead = await call(owner, 'abc_fiscal_leer_representacion', [companyA, localA, entityA], [2]);
  assert.equal(representationRead.evidencia_sha256, 'b'.repeat(64));

  await other.connect();
  await setIdentity(other, ownerB, companyB, localB);
  await rejects(call(other, 'abc_fiscal_leer_representacion', [companyA, localA, entityA], [2]), 'FISCAL_DELEGACION_NO_AUTORIZADO');
  await rejects(call(other, 'abc_fiscal_listar_delegaciones', [companyA, localA, entityA], [2]), 'FISCAL_DELEGACION_NO_AUTORIZADO');

  const history = await admin.query("select count(*)::int as n from private.abc_fiscal_delegacion_revisiones r join private.abc_fiscal_delegaciones d on d.id=r.delegacion_id where d.empresa_id=$1", [companyA]);
  assert.ok(history.rows[0].n >= 4, 'Historial de delegaciones');
  await assert.rejects(
    admin.query("update private.abc_fiscal_delegacion_revisiones set resultado='{}' where delegacion_id in (select id from private.abc_fiscal_delegaciones where empresa_id=$1)", [companyA]),
    /FISCAL_DELEGACION_HISTORIAL_INMUTABLE/
  );
  await assert.rejects(
    admin.query("update private.abc_fiscal_delegaciones set empresa_id=$2 where empresa_id=$1", [companyA, companyB]),
    /FISCAL_DELEGACION_ALCANCE_INMUTABLE/
  );

  console.log('C07C_DELEGACION_SECURITY=PASS');
  console.log('C07C_DELEGACION_IDENTITY=PASS');
  console.log('C07C_DELEGACION_EXPIRY_REVOCATION=PASS');
  console.log('C07C_REPRESENTACION_AISLAMIENTO=PASS');
  console.log('C07C_DELEGACION_POSTGRES_CONTRACT=PASS');
} finally {
  await Promise.allSettled([owner.end(), advisor.end(), other.end(), wrong.end(), admin.end()]);
}
