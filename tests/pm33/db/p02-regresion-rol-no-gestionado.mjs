// PM33 P02: pruebas adicionales sobre el mismo fixture de P01 (T01-T14),
// enfocadas exclusivamente en el hallazgo de la revisión de cierre:
// P01 vacía empleado/empleadosFichaje para roles fuera de
// Encargado/Cajero/a/Churrero/a (Camarero/a es el caso real hoy).
//
// Requiere PM33_TEST_DATABASE_URL con fixtures.sql + fixtures_p02_extra.sql
// + el candidato bajo prueba ya cargados.
import pg from 'pg';

const DB_URL = process.env.PM33_TEST_DATABASE_URL;
if (!DB_URL) {
  console.error('Falta PM33_TEST_DATABASE_URL.');
  process.exit(1);
}

const UID = {
  camarero: '00000000-0000-0000-0000-0000000000ca', // de fixtures.sql (empleado_id='ea-4', existe solo en emp-A/loc-A)
  camareroSinEmpleado: '00000000-0000-0000-0000-0000000000c3', // empleado_id que no existe en ningún sitio
};

let pass = 0, fail = 0;
const failures = [];

async function conSesion(client, uid) {
  await client.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid || '']);
}
async function llamar(client, uid) {
  await conSesion(client, uid);
  return client.query('select public.obtener_contexto_operativo() as ctx');
}
function check(name, cond, detalle) {
  if (cond) { pass++; console.log(`[PASS] ${name}`); }
  else { fail++; failures.push(name); console.log(`[FAIL] ${name}${detalle ? ' -- ' + detalle : ''}`); }
}

async function main() {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();

  console.log('\n=== T14e/f: Camarero/a con empleado_id resoluble sigue viendo SU PROPIO empleado (regresión P01) ===');
  {
    let ctx, errored = false, msg = '';
    try {
      const r = await llamar(client, UID.camarero);
      ctx = r.rows[0].ctx;
    } catch (e) { errored = true; msg = String(e.message || ''); }
    check('T14e no lanza excepción', !errored, msg);
    if (!errored) {
      check('T14f empleado no es null', ctx.empleado !== null, JSON.stringify(ctx.empleado));
      check('T14g empleado.id = ea-4', ctx.empleado && ctx.empleado.id === 'ea-4', JSON.stringify(ctx.empleado));
      check('T14h empleadosFichaje tiene exactamente 1 elemento (el propio)', Array.isArray(ctx.empleadosFichaje) && ctx.empleadosFichaje.length === 1, JSON.stringify(ctx.empleadosFichaje));
    }
  }

  console.log('\n=== T15: Camarero/a cuyo contexto NO es deducible no se rompe (a diferencia del bloque obligatorio) ===');
  {
    let ctx, errored = false, msg = '';
    try {
      const r = await llamar(client, UID.camareroSinEmpleado);
      ctx = r.rows[0].ctx;
    } catch (e) { errored = true; msg = String(e.message || ''); }
    check('T15a no lanza excepción (rol no gestionado, no se le exige contexto)', !errored, msg);
    if (!errored) {
      check('T15b rol=Camarero/a', ctx.rol === 'Camarero/a');
      check('T15c empleado=null (id no existe en ningún local, comportamiento previo)', ctx.empleado === null, JSON.stringify(ctx.empleado));
    }
  }

  console.log(`\nPM33_P02_CHECKS=${pass + fail}`);
  console.log(`TOTAL PASS=${pass} FAIL=${fail}`);
  if (fail > 0) console.log('Fallos:', failures.join(', '));
  await client.end();
  if (fail > 0) throw new Error('PM33_P02_REGRESION_CAMARERO_FAIL');
  console.log('PM33_P02_REGRESION_CAMARERO_OK=1');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
