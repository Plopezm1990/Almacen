// PM33 P05: identidad antes de actividad. El filtro de "activo" no debe
// decidir si un empleado_id es único antes de contar todas sus
// coincidencias -- una coincidencia ACTIVA en otra empresa no demuestra
// pertenencia. Un escenario por cada rol del bloque obligatorio. Requiere
// PM33_TEST_DATABASE_URL con fixtures.sql + ..._p02/p03/p04_extra.sql +
// fixtures_p05_extra.sql + el candidato bajo prueba ya cargados.
import pg from 'pg';

const DB_URL = process.env.PM33_TEST_DATABASE_URL;
if (!DB_URL) { console.error('Falta PM33_TEST_DATABASE_URL.'); process.exit(1); }

const UID = {
  cajero: '00000000-0000-0000-0000-0000000000d1',    // dup-501: A inactivo, B activo; membresía solo en A
  encargado: '00000000-0000-0000-0000-0000000000d2', // dup-502, mismo patrón
  churrero: '00000000-0000-0000-0000-0000000000d3',  // dup-503, mismo patrón
};

let pass = 0, fail = 0;
const failures = [];
async function conSesion(client, uid) { await client.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid || '']); }
async function llamar(client, uid, pLocalId) {
  await conSesion(client, uid);
  if (pLocalId === undefined) return client.query('select public.obtener_contexto_operativo() as ctx');
  return client.query('select public.obtener_contexto_operativo($1) as ctx', [pLocalId]);
}
function check(name, cond, detalle) {
  if (cond) { pass++; console.log(`[PASS] ${name}`); }
  else { fail++; failures.push(name); console.log(`[FAIL] ${name}${detalle ? ' -- ' + detalle : ''}`); }
}
async function esperarError(client, uid, pLocalId, fragmentoEsperado, nombre) {
  try { await llamar(client, uid, pLocalId); check(nombre, false, 'no lanzó error, se esperaba rechazo'); }
  catch (e) { const msg = String(e.message || ''); check(nombre, msg.includes(fragmentoEsperado), `mensaje real: "${msg}"`); }
}

async function main() {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();

  for (const [rol, uid] of [['Cajero/a', UID.cajero], ['Encargado', UID.encargado], ['Churrero/a', UID.churrero]]) {
    console.log(`\n=== ${rol}: id duplicado (A inactivo, B activo), membresía SOLO en A ===`);
    await esperarError(client, uid, 'loc-B', 'Contexto no autorizado', `${rol}: pedir loc-B (ajeno, aunque su copia allí esté "activa") es rechazado`);
    const propio = (await llamar(client, uid, 'loc-A')).rows[0].ctx;
    check(`${rol}: su propio local (A) sí resuelve, vía membresía`, propio.empresaId === 'emp-A' && propio.localId === 'loc-A', JSON.stringify(propio));
  }

  console.log(`\nPM33_P05_IDENTIDAD_CHECKS=${pass + fail}`);
  console.log(`TOTAL PASS=${pass} FAIL=${fail}`);
  if (fail > 0) console.log('Fallos:', failures.join(', '));
  await client.end();
  if (fail > 0) throw new Error('PM33_P05_IDENTIDAD_FAIL');
  console.log('PM33_P05_IDENTIDAD_OK=1');
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
