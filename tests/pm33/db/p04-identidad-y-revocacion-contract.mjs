// PM33 P04: pruebas de los dos defectos encontrados en una revisión
// independiente sobre P03 (colisión de identidad + local explícito, y
// revocación de membresía eludida por la vía heredada). Requiere
// PM33_TEST_DATABASE_URL con fixtures.sql + fixtures_p02_extra.sql +
// fixtures_p03_extra.sql + fixtures_p04_extra.sql + el candidato bajo
// prueba ya cargados.
import pg from 'pg';

const DB_URL = process.env.PM33_TEST_DATABASE_URL;
if (!DB_URL) { console.error('Falta PM33_TEST_DATABASE_URL.'); process.exit(1); }

const UID = {
  camareroColision: '00000000-0000-0000-0000-0000000000c5',      // dup-9, sin membresía
  camareroActivo: '00000000-0000-0000-0000-0000000000c4',        // ea-6, membresía activa id=20 en loc-A
  cajeroColision: '00000000-0000-0000-0000-0000000000c0',       // dup-77, sin membresía
  cajeroSoloA: '00000000-0000-0000-0000-0000000000c1',          // membresía única en emp-A/loc-A
  cajeroMembresiaRevocada: '00000000-0000-0000-0000-0000000000c2', // ea-11, membresía id=25 inactiva
  camareroMembresiaRevocada: '00000000-0000-0000-0000-0000000000c8', // ea-9, membresía id=23 inactiva
  camareroHeredadoLegitimo: '00000000-0000-0000-0000-0000000000c9',  // ea-10, sin ninguna membresía
  cajeroA: '00000000-0000-0000-0000-0000000a0a01',                // de fixtures.sql: legado legítimo, mandatorio
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

  console.log('\n=== DEFECTO 1a: Camarero/a con id duplicado + local explícito -> NUNCA autoriza, ni A ni B ===');
  {
    const rA = (await llamar(client, UID.camareroColision, 'loc-A')).rows[0].ctx;
    check('D1a-A empleado null pidiendo loc-A (id ambiguo a nivel global)', rA.empleado === null, JSON.stringify(rA.empleado));
    const rB = (await llamar(client, UID.camareroColision, 'loc-B')).rows[0].ctx;
    check('D1a-B empleado null pidiendo loc-B (id ambiguo a nivel global)', rB.empleado === null, JSON.stringify(rB.empleado));
  }

  console.log('\n=== DEFECTO 1b: Cajero/a con id duplicado + local explícito (bloque obligatorio) -> rechazado, ni A ni B ===');
  {
    await esperarError(client, UID.cajeroColision, 'loc-A', 'Contexto no autorizado', 'D1b-A rechazado pidiendo loc-A');
    await esperarError(client, UID.cajeroColision, 'loc-B', 'Contexto no autorizado', 'D1b-B rechazado pidiendo loc-B');
  }

  console.log('\n=== DEFECTO 1c: Cajero/a con membresía válida SOLO en A pide explícitamente B -> rechazado ===');
  {
    await esperarError(client, UID.cajeroSoloA, 'loc-B', 'Contexto no autorizado', 'D1c rechazado: B no es su local');
    // Control: su propio local sí debe funcionar.
    const propio = (await llamar(client, UID.cajeroSoloA, 'loc-A')).rows[0].ctx;
    check('D1c-control su propio local (A) sí resuelve', propio.empresaId === 'emp-A', JSON.stringify(propio));
  }

  console.log('\n=== DEFECTO 2a: revocar membresía (Camarero/a) bloquea también la vía heredada ===');
  {
    const r = (await llamar(client, UID.camareroMembresiaRevocada)).rows[0].ctx;
    check('D2a empleado null (membresía revocada bloquea el legado para ESE par)', r.empleado === null, JSON.stringify(r.empleado));
    check('D2a no lanza excepción (rol no gestionado, coherente con el resto del diseño)', true);
  }

  console.log('\n=== DEFECTO 2b: revocar membresía (bloque obligatorio) también rechaza ===');
  {
    await esperarError(client, UID.cajeroMembresiaRevocada, undefined, 'no determinable', 'D2b rechazado: membresía revocada, sin otro candidato');
  }

  console.log('\n=== CONTROL: usuarios heredados LEGÍTIMOS (sin ninguna membresía) siguen funcionando ===');
  {
    const rCamarero = (await llamar(client, UID.camareroHeredadoLegitimo)).rows[0].ctx;
    check('Control-Camarero empleado resuelto (ea-10), sin membresía ni revocación', rCamarero.empleado && rCamarero.empleado.id === 'ea-10', JSON.stringify(rCamarero.empleado));
    const rCajero = (await llamar(client, UID.cajeroA)).rows[0].ctx;
    check('Control-Cajero/a (T01, legado puro, bloque obligatorio) sigue resolviendo emp-A/loc-A', rCajero.empresaId === 'emp-A' && rCajero.localId === 'loc-A', JSON.stringify(rCajero));
  }

  console.log('\n=== CONTROL: camareroActivo (membresía ACTIVA, sin revocar) sigue viendo su propio empleado ===');
  {
    const r = (await llamar(client, UID.camareroActivo)).rows[0].ctx;
    check('Control-camareroActivo empleado=ea-6 (membresía intacta)', r.empleado && r.empleado.id === 'ea-6', JSON.stringify(r.empleado));
  }

  console.log(`\nPM33_P04_CHECKS=${pass + fail}`);
  console.log(`TOTAL PASS=${pass} FAIL=${fail}`);
  if (fail > 0) console.log('Fallos:', failures.join(', '));
  await client.end();
  if (fail > 0) throw new Error('PM33_P04_FAIL');
  console.log('PM33_P04_OK=1');
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
