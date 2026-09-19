// PM33 P03: pruebas de aislamiento específicas para roles fuera del
// bloque obligatorio (Camarero/a es el caso real hoy), pedidas en la
// revisión de cierre tras encontrar que el fallback sin acotar de P02
// podía filtrar datos de otra empresa/local.
//
// Requiere PM33_TEST_DATABASE_URL con fixtures.sql + fixtures_p03_extra.sql
// + el candidato bajo prueba ya cargados.
import pg from 'pg';

const DB_URL = process.env.PM33_TEST_DATABASE_URL;
if (!DB_URL) {
  console.error('Falta PM33_TEST_DATABASE_URL.');
  process.exit(1);
}

const UID = {
  camareroActivo: '00000000-0000-0000-0000-0000000000c4',   // ea-6, membresía única emp-A/loc-A
  camareroColision: '00000000-0000-0000-0000-0000000000c5', // dup-9, EXISTE en emp-A/loc-A Y emp-B/loc-B, sin membresía
  camareroMembresiaInactiva: '00000000-0000-0000-0000-0000000000c6', // ea-7, solo "candidato" vía membresía activo=false
  camareroEmpresaBaja: '00000000-0000-0000-0000-0000000000c7',      // ea-8, membresía única pero a emp-C-baja/loc-C-baja
};

let pass = 0, fail = 0;
const failures = [];

async function conSesion(client, uid) {
  await client.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid || '']);
}
async function llamar(client, uid, pLocalId) {
  await conSesion(client, uid);
  if (pLocalId === undefined) return client.query('select public.obtener_contexto_operativo() as ctx');
  return client.query('select public.obtener_contexto_operativo($1) as ctx', [pLocalId]);
}
function check(name, cond, detalle) {
  if (cond) { pass++; console.log(`[PASS] ${name}`); }
  else { fail++; failures.push(name); console.log(`[FAIL] ${name}${detalle ? ' -- ' + detalle : ''}`); }
}

async function main() {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();

  console.log('\n=== T16: Camarero/a activo con membresía única -> ve su propio empleado (no siempre null) ===');
  {
    let ctx, errored = false, msg = '';
    try { ctx = (await llamar(client, UID.camareroActivo)).rows[0].ctx; }
    catch (e) { errored = true; msg = String(e.message || ''); }
    check('T16a no lanza excepción', !errored, msg);
    if (!errored) {
      check('T16b empleado no es null', ctx.empleado !== null, JSON.stringify(ctx.empleado));
      check('T16c empleado.id = ea-6', ctx.empleado && ctx.empleado.id === 'ea-6', JSON.stringify(ctx.empleado));
      check('T16d empleado.nombre = Hugo (no el de la colisión ni otro)', ctx.empleado && ctx.empleado.nombre === 'SEÑUELO-A-Camarero-Activo-Hugo', JSON.stringify(ctx.empleado));
      check('T16e empresaId=emp-A (acotado)', ctx.empresaId === 'emp-A', JSON.stringify(ctx.empresaId));
    }
  }

  console.log('\n=== T17: empleado_id duplicado entre empresas, sin membresía -> contexto ambiguo, SIN dato (no se adivina) ===');
  {
    let ctx, errored = false, msg = '';
    try { ctx = (await llamar(client, UID.camareroColision)).rows[0].ctx; }
    catch (e) { errored = true; msg = String(e.message || ''); }
    check('T17a no lanza excepción (rol no gestionado)', !errored, msg);
    if (!errored) {
      check('T17b empleado es null (ambiguo: NUNCA se sirve un registro arbitrario de otra empresa)', ctx.empleado === null, JSON.stringify(ctx.empleado));
      check('T17c empleadosFichaje vacío', Array.isArray(ctx.empleadosFichaje) && ctx.empleadosFichaje.length === 0, JSON.stringify(ctx.empleadosFichaje));
      check('T17d empresaId permanece null', ctx.empresaId === null, JSON.stringify(ctx.empresaId));
    }
  }

  console.log('\n=== T18: Camarero/a con contexto propio pide EXPLÍCITAMENTE un local ajeno -> rechazado (sin dato) ===');
  {
    let ctx, errored = false, msg = '';
    try { ctx = (await llamar(client, UID.camareroActivo, 'loc-B')).rows[0].ctx; }
    catch (e) { errored = true; msg = String(e.message || ''); }
    check('T18a no lanza excepción', !errored, msg);
    if (!errored) {
      check('T18b empleado es null (loc-B no es suyo, aunque loc-A sí lo sea)', ctx.empleado === null, JSON.stringify(ctx.empleado));
      check('T18c empresaId permanece null', ctx.empresaId === null, JSON.stringify(ctx.empresaId));
    }
  }

  console.log('\n=== T19: única "candidatura" es una membresía INACTIVA -> no cuenta, sin dato ===');
  {
    let ctx, errored = false, msg = '';
    try { ctx = (await llamar(client, UID.camareroMembresiaInactiva)).rows[0].ctx; }
    catch (e) { errored = true; msg = String(e.message || ''); }
    check('T19a no lanza excepción', !errored, msg);
    if (!errored) {
      check('T19b empleado es null (membresía inactiva no cuenta como candidato)', ctx.empleado === null, JSON.stringify(ctx.empleado));
    }
  }

  console.log('\n=== T20: contexto resuelve de forma inequívoca pero a empresa/local DADOS DE BAJA -> sin dato ===');
  {
    let ctx, errored = false, msg = '';
    try { ctx = (await llamar(client, UID.camareroEmpresaBaja)).rows[0].ctx; }
    catch (e) { errored = true; msg = String(e.message || ''); }
    check('T20a no lanza excepción', !errored, msg);
    if (!errored) {
      check('T20b empleado es null (empresa/local de baja, aunque el contexto fuera inequívoco)', ctx.empleado === null, JSON.stringify(ctx.empleado));
      check('T20c empresaId permanece null', ctx.empresaId === null, JSON.stringify(ctx.empresaId));
    }
  }

  console.log(`\nPM33_P03_CHECKS=${pass + fail}`);
  console.log(`TOTAL PASS=${pass} FAIL=${fail}`);
  if (fail > 0) console.log('Fallos:', failures.join(', '));
  await client.end();
  if (fail > 0) throw new Error('PM33_P03_CAMARERO_AISLAMIENTO_FAIL');
  console.log('PM33_P03_CAMARERO_AISLAMIENTO_OK=1');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
