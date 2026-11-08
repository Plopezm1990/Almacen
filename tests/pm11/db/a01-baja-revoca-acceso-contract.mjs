// A-01 — dar de baja a un empleado le retira el acceso.
//
// Antes de la migración 20261108100000_a01_baja_empleado_revoca_acceso.sql,
// `pm11_baja_empleado` marcaba al empleado y lo auditaba, pero no tocaba
// perfiles, ni membresías, ni auth. Comprobado en QA el 2026-11-08: tras la
// baja, `/auth/v1/token` seguía devolviendo 200 y la membresía seguía activa.
//
// Se corta en la membresía y no solo en `private.la_usuario_activo()` porque
// la guarda cubre una minoría del API: en producción hay 182 funciones
// SECURITY DEFINER ejecutables por `authenticated` y solo 33 pasan por ella;
// las 71 del TPV autorizan con `private.abc_tiene_capacidad`, que se apoya
// únicamente en `membresias_usuario`. Por eso el contrato comprueba las dos
// cosas: la membresía y la guarda.
//
// Requiere una URL de Postgres real en PM11_A01_TEST_DATABASE_URL, apuntando
// a una base desechable donde ya se hayan cargado, en este orden:
//   1) tests/pm11/db/fixtures-a01.sql
//   2) supabase/migrations/20261108100000_a01_baja_empleado_revoca_acceso.sql
//
// No crea ni destruye la base: solo consulta y ejecuta las RPC de Personal.
import pg from 'pg';

const DB_URL = process.env.PM11_A01_TEST_DATABASE_URL;
if (!DB_URL) {
  console.error('Falta PM11_A01_TEST_DATABASE_URL. Ver cabecera de este archivo.');
  process.exit(1);
}

const UID = {
  camarero: '11111111-1111-4111-8111-111111111111',
  otraEmpresa: '22222222-2222-4222-8222-222222222222',
  historico: '33333333-3333-4333-8333-333333333333',
};

let pruebas = 0;
let fallos = 0;

function comprobar(nombre, condicion, detalle) {
  pruebas += 1;
  if (condicion) {
    console.log(`ok ${pruebas} - ${nombre}`);
  } else {
    fallos += 1;
    console.log(`not ok ${pruebas} - ${nombre}${detalle ? ' -> ' + detalle : ''}`);
  }
}

const cliente = new pg.Client({ connectionString: DB_URL });

async function fila(sql, params) {
  const r = await cliente.query(sql, params);
  return r.rows[0];
}

async function comoUsuario(uid) {
  await cliente.query("select set_config('a01.uid', $1, false)", [uid]);
}

async function membresiasActivas(uid) {
  const r = await fila('select count(*)::int as n from public.membresias_usuario where user_id = $1 and activo = true', [uid]);
  return r.n;
}

async function guarda(uid) {
  await comoUsuario(uid);
  const r = await fila('select private.la_usuario_activo() as v');
  return r.v;
}

try {
  await cliente.connect();

  // --- El histórico: la migración ya debe haberlo cerrado al aplicarse. ----
  comprobar('el relleno retira la membresia de una baja anterior a la migracion',
    (await membresiasActivas(UID.historico)) === 0);
  comprobar('y la guarda ya no deja pasar a esa baja antigua',
    (await guarda(UID.historico)) === false);
  const historico = await fila("select datos->'membresiasRevocadasEnBaja' as revocadas from public.empleados where id = 'EMP-3'");
  comprobar('el relleno deja anotado que membresia retiro',
    Array.isArray(historico.revocadas) && historico.revocadas.length === 1,
    JSON.stringify(historico.revocadas));

  // --- Punto de partida del caso principal -------------------------------
  comprobar('el camarero arranca con dos membresias activas',
    (await membresiasActivas(UID.camarero)) === 2);
  comprobar('y la guarda le deja pasar', (await guarda(UID.camarero)) === true);

  // --- La baja ------------------------------------------------------------
  await comoUsuario(UID.camarero);
  const baja = await fila("select public.pm11_baja_empleado('EMP-A','A1','EMP-1','prueba de contrato') as r");
  comprobar('la baja responde ok', baja.r && baja.r.ok === true && baja.r.yaBaja === false,
    JSON.stringify(baja.r));

  const empleado = await fila("select estado, baja_at is not null as con_fecha, datos->'membresiasRevocadasEnBaja' as revocadas from public.empleados where id = 'EMP-1'");
  comprobar('el empleado queda inactivo y con fecha de baja',
    empleado.estado === 'inactivo' && empleado.con_fecha === true);
  comprobar('la baja anota exactamente la membresia que retiro',
    Array.isArray(empleado.revocadas) && empleado.revocadas.length === 1,
    JSON.stringify(empleado.revocadas));

  comprobar('tras la baja solo le queda la membresia de la otra empresa',
    (await membresiasActivas(UID.camarero)) === 1);
  const ajena = await fila('select activo from public.membresias_usuario where user_id = $1 and empresa_id = $2', [UID.camarero, 'EMP-C']);
  comprobar('la membresia de la otra empresa sigue intacta', ajena.activo === true);
  comprobar('la guarda ya no le deja pasar', (await guarda(UID.camarero)) === false);

  const tpv = await fila('select count(*)::int as n from public.membresias_usuario where user_id = $1 and empresa_id = $2 and activo = true', [UID.camarero, 'EMP-A']);
  comprobar('el camino del TPV ya no encuentra membresia activa en su empresa', tpv.n === 0);

  // --- Nadie mas resulta afectado ----------------------------------------
  comprobar('el empleado de otra empresa no se toca',
    (await membresiasActivas(UID.otraEmpresa)) === 1);
  comprobar('y su guarda sigue pasando', (await guarda(UID.otraEmpresa)) === true);

  // --- Idempotencia -------------------------------------------------------
  await comoUsuario(UID.camarero);
  const repetida = await fila("select public.pm11_baja_empleado('EMP-A','A1','EMP-1') as r");
  comprobar('dar de baja dos veces es inocuo', repetida.r && repetida.r.yaBaja === true);
  comprobar('y no cambia las membresias', (await membresiasActivas(UID.camarero)) === 1);

  // --- La reactivacion devuelve exactamente lo retirado -------------------
  await comoUsuario(UID.camarero);
  const react = await fila("select public.pm11_reactivar_empleado('EMP-A','A1','EMP-1') as r");
  comprobar('la reactivacion responde ok', react.r && react.r.ok === true && react.r.yaActivo === false);
  comprobar('vuelve a tener dos membresias activas', (await membresiasActivas(UID.camarero)) === 2);
  comprobar('y la guarda vuelve a dejarle pasar', (await guarda(UID.camarero)) === true);
  const tras = await fila("select estado, datos ? 'membresiasRevocadasEnBaja' as queda_marca from public.empleados where id = 'EMP-1'");
  comprobar('el empleado vuelve a activo', tras.estado === 'activo');
  comprobar('y se borra la marca de revocacion', tras.queda_marca === false);

  // --- Reactivar no concede de mas ----------------------------------------
  // Si entretanto alguien desactiva por otro motivo la membresia de la otra
  // empresa, la reactivacion no debe revivirla.
  await cliente.query('update public.membresias_usuario set activo = false where user_id = $1 and empresa_id = $2', [UID.camarero, 'EMP-C']);
  await comoUsuario(UID.camarero);
  await cliente.query("select public.pm11_baja_empleado('EMP-A','A1','EMP-1')");
  await cliente.query("select public.pm11_reactivar_empleado('EMP-A','A1','EMP-1')");
  const suya = await fila('select activo from public.membresias_usuario where user_id = $1 and empresa_id = $2', [UID.camarero, 'EMP-A']);
  const otra = await fila('select activo from public.membresias_usuario where user_id = $1 and empresa_id = $2', [UID.camarero, 'EMP-C']);
  comprobar('reactivar devuelve la membresia que la baja quito', suya.activo === true);
  comprobar('y no revive la que estaba desactivada por otro motivo', otra.activo === false);

  // --- Rastro en auditoria -------------------------------------------------
  const aud = await fila("select datos->>'membresiasRevocadas' as n from public.auditoria_registro where accion like '%baja empleado%' order by id limit 1");
  comprobar('la auditoria anota cuantas membresias se retiraron', aud && aud.n === '1', String(aud && aud.n));
} catch (error) {
  fallos += 1;
  console.log(`not ok - error inesperado -> ${error && error.message ? error.message : error}`);
} finally {
  await cliente.end().catch(() => {});
}

console.log(`1..${pruebas}`);
console.log(`PM11_A01_PRUEBAS=${pruebas} PM11_A01_FALLOS=${fallos}`);
process.exit(fallos === 0 ? 0 : 1);
