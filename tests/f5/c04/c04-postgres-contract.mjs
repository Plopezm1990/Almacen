import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { Client } = require(process.env.C04_PG_CLIENT || resolve(tmpdir(), 'c04-pg-client', 'node_modules', 'pg'));
const root = resolve(import.meta.dirname, '../../..');
const databaseUrl = process.env.ABC_F5_C04_TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';
const empresa = 'emp-f';
const local = 'loc-f1';
const owner = '00000000-0000-0000-0000-000000000021';
const terminal = '20000000-0000-0000-0000-000000000013';
const session = '40000000-0000-0000-0000-000000000008';
const day = '2026-09-24';

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
  assert.equal(migrations.length, 17, 'C04 necesita el baseline F2/A03-A08 completo');
  for (const name of migrations) await db.query(await readFile(resolve(root, 'supabase/migrations', name), 'utf8'));
  await db.query(await readFile(resolve(root, 'supabase/migrations/20260928223000_pm10_cierre_sesion_caja.sql'), 'utf8'));
  await db.query(await readFile(resolve(root, 'supabase/migrations/20261001140000_abc_f5_c04_close_reopen.sql'), 'utf8'));
  await db.query(`
    insert into auth.users(id) values ('${owner}') on conflict (id) do nothing;
    insert into public.empresas(id,nombre,activo) values ('${empresa}','Empresa C04',true);
    insert into public.locales(id,empresa_id,nombre,activo) values ('${local}','${empresa}','Local C04',true);
    insert into public.membresias_usuario(user_id,empresa_id,local_id,todos_locales,rol,activo)
      values ('${owner}','${empresa}','${local}',false,'Propietario',true);
    insert into public.terminales_tpv(id,empresa_id,local_id,nombre,activo)
      values ('${terminal}','${empresa}','${local}','Terminal C04',true);
    insert into public.cajas_fisicas(id,empresa_id,local_id,nombre,activo)
      values ('30000000-0000-0000-0000-000000000098','${empresa}','${local}','Caja C04',true);
    insert into public.caja_sesiones(id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por)
      values ('${session}','${empresa}','${local}','30000000-0000-0000-0000-000000000098','ABIERTA',1,now(),'${owner}');
    insert into public.caja_sesion_terminales(empresa_id,local_id,session_id,terminal_id,desde)
      values ('${empresa}','${local}','${session}','${terminal}',now());
    insert into public.caja_sesion_responsables(empresa_id,local_id,session_id,user_id,desde,asignado_por,motivo)
      values ('${empresa}','${local}','${session}','${owner}',now(),'${owner}','TEST_C04');
  `);
}

async function context(db) {
  await db.query('select set_config($1,$2,false),set_config($3,$4,false),set_config($5,$6,false)', [
    'app.test_empresa', empresa, 'app.test_local', local, 'request.jwt.claim.sub', owner,
  ]);
}

async function call(db, name, args) {
  const placeholders = args.map((_, index) => `$${index + 1}`).join(',');
  const values = args.map((value) => value?.type === 'uuid' || value?.type === 'date' ? value.value : value);
  const casts = args.map((value) => value?.type === 'uuid' ? '::uuid' : value?.type === 'date' ? '::date' : '').join(',');
  const expression = args.map((_, index) => `$${index + 1}${casts.split(',')[index]}`).join(',');
  const result = await db.query(`select public.${name}(${expression}) as value`, values);
  return result.rows[0].value;
}

async function rejects(promise, fragment) {
  await assert.rejects(promise, (error) => String(error?.message || error).includes(fragment), `se esperaba ${fragment}`);
}

const admin = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c04-bootstrap' });
const first = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c04-cierre-1' });
const second = new Client({ connectionString: databaseUrl, application_name: 'abc-f5-c04-cierre-2' });

try {
  await admin.connect();
  await bootstrap(admin);
  await first.connect();
  await second.connect();
  await context(first);
  await context(second);

  const started = await call(first, 'abc_iniciar_cierre_sesion_caja', [
    'c04.pg.start.0001', empresa, local, { type: 'uuid', value: session }, { type: 'uuid', value: terminal }, { type: 'date', value: day },
  ]);
  assert.equal(started.estado, 'EN_CIERRE');

  const concurrent = await Promise.allSettled([
    call(first, 'abc_confirmar_cierre_provisional', ['c04.pg.provisional.0001', empresa, local, { type: 'uuid', value: session }, { type: 'uuid', value: terminal }, 'EUR', 0, { type: 'date', value: day }]),
    call(second, 'abc_confirmar_cierre_provisional', ['c04.pg.provisional.0002', empresa, local, { type: 'uuid', value: session }, { type: 'uuid', value: terminal }, 'EUR', 0, { type: 'date', value: day }]),
  ]);
  assert.equal(concurrent.filter((item) => item.status === 'fulfilled').length, 1, 'solo una confirmación concurrente puede ganar');
  assert.equal(concurrent.filter((item) => item.status === 'rejected').length, 1, 'la segunda confirmación debe ser rechazada');

  await admin.query(`insert into public.abc_operaciones(operation_id,empresa_id,local_id,command_type,request_hash,status,actor_user_id,terminal_id,request)
    values ('c04.pg.effect.0001',$1,$2,'TEST_C04_EFFECT',repeat('a',64),'PROCESANDO',$3::uuid,$4::uuid,'{}'::jsonb)`, [empresa, local, owner, terminal]);
  await admin.query(`insert into public.efectos_pendientes(empresa_id,local_id,abc_command_id,tipo,dedupe_key,payload,estado,attempt_count,next_attempt_at)
    values ($1,$2,'c04.pg.effect.0001','TEST_C04_EFFECT','c04.pg.effect.dedupe','{}'::jsonb,'PENDIENTE',0,now())`, [empresa, local]);

  await rejects(call(first, 'abc_finalizar_cierre_sesion_caja', ['c04.pg.final.blocked', empresa, local, { type: 'uuid', value: session }, { type: 'uuid', value: terminal }, 'EUR', { type: 'date', value: day }]), 'cierre_definitivo_bloqueado');

  await admin.query(`update public.efectos_pendientes set estado='COMPLETADO',completed_at=now() where dedupe_key='c04.pg.effect.dedupe'`);
  const finalized = await call(first, 'abc_finalizar_cierre_sesion_caja', ['c04.pg.final.ok.0001', empresa, local, { type: 'uuid', value: session }, { type: 'uuid', value: terminal }, 'EUR', { type: 'date', value: day }]);
  assert.equal(finalized.estado, 'CERRADA_FINAL');

  const session2 = '40000000-0000-0000-0000-000000000099';
  const caja2 = '30000000-0000-0000-0000-000000000099';
  await admin.query(`insert into public.cajas_fisicas(id,empresa_id,local_id,nombre,activo) values ($1,$2,$3,'Caja C04 2',true)`, [caja2, empresa, local]);
  await admin.query(`insert into public.caja_sesiones(id,empresa_id,local_id,caja_id,estado,version,abierta_at,abierta_por)
    values ($1,$2,$3,$4,'ABIERTA',1,now(),$5::uuid)`, [session2, empresa, local, caja2, owner]);
  await admin.query(`insert into public.caja_sesion_terminales(empresa_id,local_id,session_id,terminal_id,desde)
    values ($1,$2,$3,$4::uuid,now())`, [empresa, local, session2, terminal]);
  await admin.query(`insert into public.caja_sesion_responsables(empresa_id,local_id,session_id,user_id,desde,asignado_por,motivo)
    values ($1,$2,$3,$4::uuid,now(),$4::uuid,'TEST_C04')`, [empresa, local, session2, owner]);

  const started2 = await call(first, 'abc_iniciar_cierre_sesion_caja', ['c04.pg.start.0002', empresa, local, { type: 'uuid', value: session2 }, { type: 'uuid', value: terminal }, { type: 'date', value: day }]);
  assert.equal(started2.estado, 'EN_CIERRE');
  const provisional2 = await call(first, 'abc_confirmar_cierre_provisional', ['c04.pg.provisional.0003', empresa, local, { type: 'uuid', value: session2 }, { type: 'uuid', value: terminal }, 'EUR', 0, { type: 'date', value: day }]);
  assert.equal(provisional2.estado, 'CIERRE_PROVISIONAL');
  const reopened = await call(first, 'abc_reabrir_cierre_provisional', ['c04.pg.reopen.0001', empresa, local, { type: 'uuid', value: session2 }, { type: 'uuid', value: terminal }, 'Ajuste de arqueo', { type: 'date', value: day }]);
  assert.equal(reopened.estado, 'ABIERTA');
  await rejects(first.query(`update public.caja_sesiones set estado='CERRADA_FINAL' where id=$1`, [session2]), 'cierre_definitivo_requiere_provisional');

  console.log('ABC_F5_C04_POSTGRES_CONTRACT=PASS');
} finally {
  await Promise.allSettled([first.end(), second.end(), admin.end()]);
}
