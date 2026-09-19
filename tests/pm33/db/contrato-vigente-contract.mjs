// PM33: contrato de aislamiento multiempresa VIGENTE (candidato P04).
//
// Deriva del contrato original de P01
// (p01-aislamiento-multiempresa-contract.mjs, que se conserva SIN
// modificar como registro histórico de lo que afirmaba P01 -- no se toca
// ni se reutiliza como gate). Única diferencia respecto de aquel: T14c.
//
// JUSTIFICACIÓN DEL CAMBIO EN T14c: P01/P02/P03 nunca calculaban
// (empresaId, localId) para roles fuera del bloque obligatorio
// (Encargado/Cajero/a/Churrero/a) -- por eso T14c original afirmaba
// "empresaId permanece null" para Camarero/a. Desde P03, la función SÍ
// resuelve y devuelve empresaId/localId también para estos roles cuando
// el contexto es deducible sin ambigüedad (ver HALLAZGOS_P02.md sección
// 7.1) -- un cambio de contrato deliberado, no un defecto. T14c se
// actualiza para reflejar el comportamiento correcto vigente, con una
// comprobación MÁS estricta que la que sustituye: no solo "no es null",
// sino el valor exacto esperado (emp-A) -- lo que además re-verifica en
// esta misma batería, con cada ejecución, la clase de defecto que motivó
// P04 (que ese valor nunca sea el de OTRA empresa).
//
// Requiere una URL de Postgres real en PM33_TEST_DATABASE_URL, apuntando a
// una base desechable donde ya se hayan cargado, en este orden:
//   1) tests/pm33/db/fixtures.sql   (esquema mínimo + datos señuelo)
//   2) el candidato vigente (supabase/migrations/20260919150000_...sql o
//      su revisión P04, ver HALLAZGOS_P02.md)
//
// No crea ni destruye la base: solo consulta.
import pg from 'pg';

const DB_URL = process.env.PM33_TEST_DATABASE_URL;
if (!DB_URL) {
  console.error('Falta PM33_TEST_DATABASE_URL. Ver cabecera de este archivo.');
  process.exit(1);
}

const UID = {
  cajeroA: '00000000-0000-0000-0000-0000000a0a01',
  churreroA: '00000000-0000-0000-0000-0000000a0a02',
  encargadoA: '00000000-0000-0000-0000-0000000a0a03',
  cajeroB: '00000000-0000-0000-0000-0000000b0b01',
  encargadoB: '00000000-0000-0000-0000-0000000b0b02',
  multiLocal: '00000000-0000-0000-0000-00000000eeee',
  empleadoNoResoluble: '00000000-0000-0000-0000-000000000dea',
  sinContexto: '00000000-0000-0000-0000-0000000000ba',
  camarero: '00000000-0000-0000-0000-0000000000ca',
  perfilInactivo: '00000000-0000-0000-0000-0000000000aa',
  localDeBaja: '00000000-0000-0000-0000-0000000000cb',
};

let pass = 0, fail = 0;
const failures = [];

async function conSesion(client, uid) {
  await client.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid || '']);
}

async function llamar(client, uid, pLocalId) {
  await conSesion(client, uid);
  if (pLocalId === undefined) {
    return client.query('select public.obtener_contexto_operativo() as ctx');
  }
  return client.query('select public.obtener_contexto_operativo($1) as ctx', [pLocalId]);
}

function check(name, cond, detalle) {
  if (cond) {
    pass++;
    console.log(`[PASS] ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`[FAIL] ${name}${detalle ? ' -- ' + detalle : ''}`);
  }
}

async function esperarError(client, uid, pLocalId, fragmentoEsperado, nombre) {
  try {
    await llamar(client, uid, pLocalId);
    check(nombre, false, 'no lanzó error, se esperaba rechazo');
  } catch (e) {
    const msg = String(e.message || '');
    check(nombre, msg.includes(fragmentoEsperado), `mensaje real: "${msg}"`);
  }
}

function contieneSenuelo(jsonArrayLike, senuelo) {
  return JSON.stringify(jsonArrayLike).includes(senuelo);
}

async function main() {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();

  console.log('\n=== T01: Cajero de A obtiene únicamente contexto A/loc-A ===');
  {
    const r = await llamar(client, UID.cajeroA);
    const ctx = r.rows[0].ctx;
    check('T01a empresaId=emp-A', ctx.empresaId === 'emp-A', JSON.stringify(ctx.empresaId));
    check('T01b localId=loc-A', ctx.localId === 'loc-A', JSON.stringify(ctx.localId));
    check('T01c proveedores contiene señuelo A', contieneSenuelo(ctx.proveedores, 'SEÑUELO-PROVEEDOR-A'));
    check('T01d proveedores NO contiene señuelo B', !contieneSenuelo(ctx.proveedores, 'SEÑUELO-PROVEEDOR-B'), JSON.stringify(ctx.proveedores));
    check('T01e cobros contiene 111.11 (A)', contieneSenuelo(ctx.cobrosEncargos, '111.11'));
    check('T01f cobros NO contiene 222.22 (B)', !contieneSenuelo(ctx.cobrosEncargos, '222.22'), JSON.stringify(ctx.cobrosEncargos));
  }

  console.log('\n=== T02: Cajero de B obtiene únicamente contexto B/loc-B ===');
  {
    const r = await llamar(client, UID.cajeroB);
    const ctx = r.rows[0].ctx;
    check('T02a empresaId=emp-B', ctx.empresaId === 'emp-B');
    check('T02b localId=loc-B', ctx.localId === 'loc-B');
    check('T02c proveedores contiene señuelo B', contieneSenuelo(ctx.proveedores, 'SEÑUELO-PROVEEDOR-B'));
    check('T02d proveedores NO contiene señuelo A', !contieneSenuelo(ctx.proveedores, 'SEÑUELO-PROVEEDOR-A'), JSON.stringify(ctx.proveedores));
    check('T02e cobros contiene 222.22 (B)', contieneSenuelo(ctx.cobrosEncargos, '222.22'));
    check('T02f cobros NO contiene 111.11 (A)', !contieneSenuelo(ctx.cobrosEncargos, '111.11'), JSON.stringify(ctx.cobrosEncargos));
  }

  console.log('\n=== T03: Encargado de A (sin membresía, resuelve por KV) no ve empleados de B ===');
  {
    const r = await llamar(client, UID.encargadoA);
    const ctx = r.rows[0].ctx;
    check('T03a empresaId=emp-A', ctx.empresaId === 'emp-A');
    check('T03b empleadosFichaje contiene señuelo A (Ana)', contieneSenuelo(ctx.empleadosFichaje, 'SEÑUELO-A-Cajera-Ana'));
    check('T03c empleadosFichaje NO contiene señuelo B (Elena)', !contieneSenuelo(ctx.empleadosFichaje, 'SEÑUELO-B-Cajera-Elena'), JSON.stringify(ctx.empleadosFichaje));
    check('T03d empleadosFichaje NO incluye el empleado dado de baja (Diego)', !contieneSenuelo(ctx.empleadosFichaje, 'SEÑUELO-A-Bajado-Diego'), JSON.stringify(ctx.empleadosFichaje));
  }

  console.log('\n=== T04: Encargado de B no ve empleados de A ===');
  {
    const r = await llamar(client, UID.encargadoB);
    const ctx = r.rows[0].ctx;
    check('T04a empresaId=emp-B', ctx.empresaId === 'emp-B');
    check('T04b empleadosFichaje contiene señuelo B (Elena)', contieneSenuelo(ctx.empleadosFichaje, 'SEÑUELO-B-Cajera-Elena'));
    check('T04c empleadosFichaje NO contiene señuelo A (Ana)', !contieneSenuelo(ctx.empleadosFichaje, 'SEÑUELO-A-Cajera-Ana'), JSON.stringify(ctx.empleadosFichaje));
  }

  console.log('\n=== T05: Churrero de A no ve fichas de costo de B ===');
  {
    const r = await llamar(client, UID.churreroA);
    const ctx = r.rows[0].ctx;
    check('T05a fichasProduccion contiene señuelo receta A', contieneSenuelo(ctx.fichasProduccion, 'SEÑUELO-RECETA-A'));
    check('T05b fichasProduccion NO contiene señuelo receta B', !contieneSenuelo(ctx.fichasProduccion, 'SEÑUELO-RECETA-B'), JSON.stringify(ctx.fichasProduccion));
  }

  console.log('\n=== T06: Empleado con dos locales recibe EXCLUSIVAMENTE el contexto solicitado ===');
  {
    const rA = await llamar(client, UID.multiLocal, 'loc-A');
    const ctxA = rA.rows[0].ctx;
    check('T06a p_local_id=loc-A -> empresaId=emp-A', ctxA.empresaId === 'emp-A');
    check('T06b p_local_id=loc-A -> proveedor A presente', contieneSenuelo(ctxA.proveedores, 'SEÑUELO-PROVEEDOR-A'));
    check('T06c p_local_id=loc-A -> proveedor A2 ausente', !contieneSenuelo(ctxA.proveedores, 'SEÑUELO-PROVEEDOR-A2'), JSON.stringify(ctxA.proveedores));

    const rA2 = await llamar(client, UID.multiLocal, 'loc-A2');
    const ctxA2 = rA2.rows[0].ctx;
    check('T06d p_local_id=loc-A2 -> localId=loc-A2', ctxA2.localId === 'loc-A2');
    check('T06e p_local_id=loc-A2 -> proveedor A2 presente', contieneSenuelo(ctxA2.proveedores, 'SEÑUELO-PROVEEDOR-A2'));
    check('T06f p_local_id=loc-A2 -> proveedor de loc-A ausente', !contieneSenuelo(ctxA2.proveedores, '"nombre":"SEÑUELO-PROVEEDOR-A"'), JSON.stringify(ctxA2.proveedores));
  }

  console.log('\n=== T07: Sin p_local_id y con dos locales -> contexto ambiguo, rechazado ===');
  await esperarError(client, UID.multiLocal, undefined, 'ambiguo', 'T07 multi-local sin especificar p_local_id es rechazado');

  console.log('\n=== T08: Local ajeno explícito es rechazado ===');
  await esperarError(client, UID.cajeroA, 'loc-B', 'Contexto no autorizado', 'T08 cajero de A pidiendo loc-B (de otra empresa) es rechazado');

  console.log('\n=== T09: Empresa/local dado de baja es rechazado ===');
  await esperarError(client, UID.localDeBaja, undefined, 'Local inactivo o inexistente', 'T09 empleado cuyo único local está de baja es rechazado');

  console.log('\n=== T10: Usuario sin sesión es rechazado ===');
  await esperarError(client, null, undefined, 'No autenticado', 'T10 sin auth.uid() es rechazado');

  console.log('\n=== T11: Perfil inactivo es rechazado ===');
  await esperarError(client, UID.perfilInactivo, undefined, 'Perfil no activo', 'T11 perfil inactivo es rechazado');

  console.log('\n=== T12: empleado_id que no resuelve en ningún local -> rechazado, sin fallback global ===');
  await esperarError(client, UID.empleadoNoResoluble, undefined, 'no determinable', 'T12 empleado_id inexistente en almacen_kv es rechazado (no cae a datos globales)');

  console.log('\n=== T13: Sin empleado_id y sin membresía -> rechazado ===');
  await esperarError(client, UID.sinContexto, undefined, 'no determinable', 'T13 sin empleado_id ni membresía es rechazado');

  console.log('\n=== T14: Rol legítimo no gestionado por esta RPC sigue funcionando (sin regresión) ===');
  {
    const r = await llamar(client, UID.camarero);
    const ctx = r.rows[0].ctx;
    check('T14a no lanza error', true);
    check('T14b rol=Camarero/a', ctx.rol === 'Camarero/a');
    // T14c (actualizado desde P03, ver cabecera de este archivo): el
    // contexto de este usuario SÍ es deducible sin ambigüedad (único
    // candidato: emp-A/loc-A, vía almacen_kv), así que empresaId/localId
    // ahora se resuelven -- deliberado, no una regresión. Se comprueba el
    // valor EXACTO, no solo que no sea null: esto es justo lo que P04
    // corrige (que nunca sea el de otra empresa).
    check('T14c\' empresaId=emp-A (resuelto, deliberado desde P03 -- ver cabecera)', ctx.empresaId === 'emp-A', JSON.stringify(ctx.empresaId));
    check('T14c\'\' localId=loc-A (idem)', ctx.localId === 'loc-A', JSON.stringify(ctx.localId));
    check('T14d proveedores vacío', Array.isArray(ctx.proveedores) && ctx.proveedores.length === 0);
  }

  console.log(`\nPM33_P04_CHECKS=${pass + fail}`);
  console.log(`TOTAL PASS=${pass} FAIL=${fail}`);
  if (fail > 0) console.log('Fallos:', failures.join(', '));
  await client.end();
  if (fail > 0) throw new Error('PM33_CONTRATO_VIGENTE_FAIL');
  console.log('PM33_CONTRATO_VIGENTE_OK=1');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
