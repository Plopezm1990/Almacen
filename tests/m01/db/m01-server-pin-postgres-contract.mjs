// M-01 — el PIN de empleado se comprueba en servidor y no se expone al cliente.
// La base la prepara tests/ci/preparar_postgres_local.sh con, en este orden:
//   1) tests/m01/db/fixtures-m01.sql
//   2) supabase/migrations/20261108120000_m01_server_pin_authentication.sql
// No crea ni destruye la base; solo usa datos sintéticos de una base desechable.
import assert from 'node:assert/strict';
import pg from 'pg';

const DB_URL = process.env.M01_TEST_DATABASE_URL;
if (!DB_URL) {
  console.error('Falta M01_TEST_DATABASE_URL. Ver cabecera de este archivo.');
  process.exit(1);
}

const cliente = new pg.Client({ connectionString: DB_URL });
const fila = async (sql, params = []) => (await cliente.query(sql, params)).rows[0];
let pruebas = 0;
let fallos = 0;
const comprobar = (nombre, condicion, detalle = '') => {
  pruebas += 1;
  if (condicion) console.log(`ok ${pruebas} - ${nombre}`);
  else { fallos += 1; console.log(`not ok ${pruebas} - ${nombre}${detalle ? ` -> ${detalle}` : ''}`); }
};

try {
  await cliente.connect();
  await cliente.query("select set_config('m01.uid', $1, false)", ['11111111-1111-4111-8111-111111111111']);

  const legacy = await fila("select datos ? 'pin' as tiene_pin from public.empleados where id='EMP-LEGACY'");
  const legacyStorage = await fila("select value->0 ? 'pin' as tiene_pin from public.almacen_kv where key='empleados'");
  comprobar('la migración retira el PIN legacy de empleados', legacy?.tiene_pin === false);
  comprobar('la migración retira el PIN legacy de almacen_kv', legacyStorage?.tiene_pin === false);

  const alta = await fila(
    `select public.pm11_alta_empleado($1,$2,$3,$4,$5) as r`,
    ['EMP-A', 'LOCAL-A', 'EMP-NUEVO', 'Nuevo', { pin: '1234', pm13AltaOperationId: 'm01-op-1' }]
  );
  const empleadoAlta = alta?.r?.empleado;
  comprobar('el alta responde ok', alta?.r?.ok === true, JSON.stringify(alta?.r));
  comprobar('la respuesta de alta no contiene pin', empleadoAlta?.datos?.pin === undefined, JSON.stringify(empleadoAlta));

  const secreto = await fila("select pin_hash, pin_hash like '$2%' as bcrypt from private.pm11_empleado_pin where empleado_id='EMP-NUEVO'");
  comprobar('el PIN queda en la tabla privada', Boolean(secreto?.pin_hash));
  comprobar('el PIN usa derivación bcrypt', secreto?.bcrypt === true, String(secreto?.pin_hash || '').slice(0, 4));

  const correcto = await fila("select public.pm11_verificar_pin_empleado('EMP-A','LOCAL-A','EMP-NUEVO','1234') as r");
  const incorrecto = await fila("select public.pm11_verificar_pin_empleado('EMP-A','LOCAL-A','EMP-NUEVO','9999') as r");
  comprobar('el PIN correcto verifica en servidor', correcto?.r?.ok === true && correcto?.r?.verificado === true, JSON.stringify(correcto?.r));
  comprobar('el PIN incorrecto no verifica', incorrecto?.r?.ok === true && incorrecto?.r?.verificado === false, JSON.stringify(incorrecto?.r));

  const listado = await fila("select public.pm11_listar_empleados_modo('EMP-A','LOCAL-A') as r");
  const listadoNuevo = listado?.r?.empleados?.find((e) => e.id === 'EMP-NUEVO');
  comprobar('el listado informa solo pinConfigurado', listadoNuevo?.pinConfigurado === true && listadoNuevo?.pin === undefined, JSON.stringify(listadoNuevo));

  const edicion = await fila(
    `select public.pm11_editar_empleado($1,$2,$3,$4,$5) as r`,
    ['EMP-A', 'LOCAL-A', 'EMP-NUEVO', { pin: '5678' }, 'Nuevo']
  );
  comprobar('la edición tampoco devuelve pin', edicion?.r?.empleado?.datos?.pin === undefined, JSON.stringify(edicion?.r));
  const antiguo = await fila("select public.pm11_verificar_pin_empleado('EMP-A','LOCAL-A','EMP-NUEVO','1234') as r");
  const nuevo = await fila("select public.pm11_verificar_pin_empleado('EMP-A','LOCAL-A','EMP-NUEVO','5678') as r");
  comprobar('la edición reemplaza el PIN anterior', antiguo?.r?.verificado === false && nuevo?.r?.verificado === true);

  const acl = await fila("select has_table_privilege('authenticated','private.pm11_empleado_pin','select') as puede_leer");
  comprobar('authenticated no puede leer la tabla privada', acl?.puede_leer === false, String(acl?.puede_leer));
} catch (error) {
  fallos += 1;
  console.log(`not ok - error inesperado -> ${error?.message || error}`);
} finally {
  await cliente.end().catch(() => {});
}

console.log(`1..${pruebas}`);
console.log(`M01_POSTGRES_PRUEBAS=${pruebas} M01_POSTGRES_FALLOS=${fallos}`);
assert.equal(fallos, 0);
