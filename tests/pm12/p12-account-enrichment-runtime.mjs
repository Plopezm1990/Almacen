import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const fuente = fs.readFileSync(new URL('../../fuente.js', import.meta.url), 'utf8');
const recuperada = fs.readFileSync(new URL('../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8');

function bloque(codigo, inicio) {
  const desde = codigo.indexOf('  (0, import_react4.useEffect)(() => {', inicio);
  const hasta = codigo.indexOf('  const localesEmpresaActiva', desde);
  assert.ok(desde >= 0 && hasta > desde, 'no se encontró el efecto PM11');
  return codigo.slice(desde, hasta);
}

const inicioClave = fuente.indexOf('const empleadosIdentidadKeyPM11 =');
const efecto = bloque(fuente, inicioClave);
const efectoRecuperado = bloque(recuperada, recuperada.indexOf('const empleadosIdentidadKeyPM11 ='));
assert.equal(efectoRecuperado.replaceAll('\r\n', '\n'), efecto.replaceAll('\r\n', '\n'), 'el efecto PM11 debe mantener paridad con la fuente recuperada');

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  promise.abortSignal = (signal) => {
    promise.signal = signal;
    return promise;
  };
  return { promise, resolve, reject, signal: null };
}

function instalar({ localActivoId, empleados, locales = [{ id: localActivoId, empresaId: 'E1', activo: true }], empresas = [{ id: 'E1' }], state, requests }) {
  let efectoRegistrado;
  const supabase = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'owner-1' } } } }) },
    rpc(nombre, parametros) {
      const espera = deferred();
      requests.push({ nombre, parametros, ...espera });
      return espera.promise;
    }
  };
  const contexto = {
    ready: true,
    miPerfil: { rol: 'Propietario' },
    localActivoId,
    empleados,
    empleadosIdentidadKeyPM11: empleados.map((empleado) => `${empleado?.id || ""}:${empleado?.empresaId || ""}:${empleado?.localId || ""}`).sort().join("|"),
    locales,
    empresas,
    window: { __nubeActiva: true, getSupabaseClient: async () => supabase },
    AbortController,
    import_react4: { useEffect(fn) { efectoRegistrado = fn; } },
    setEstadoCuentasPM11(actualizar) {
      state.cuentas = typeof actualizar === 'function' ? actualizar(state.cuentas) : actualizar;
    },
    setEmpleados(actualizar) {
      state.empleados = typeof actualizar === 'function' ? actualizar(state.empleados) : actualizar;
    },
    console: { error() {} }
  };
  vm.runInNewContext(`(function () { ${efecto} })()`, contexto);
  assert.equal(typeof efectoRegistrado, 'function', 'el efecto PM11 debe registrarse');
  return { ejecutar: () => efectoRegistrado() };
}

async function iniciar(config) {
  const state = config.state || { cuentas: {}, empleados: config.empleados };
  const requests = config.requests || [];
  const instalado = instalar({ ...config, state, requests });
  const cleanup = instalado.ejecutar();
  await tick();
  return { state, requests, cleanup };
}

const empleadoBase = { id: 'e1', empresaId: 'E1', localId: 'L1', nombre: 'Empleado QA', tieneCuenta: false, cuentaActiva: false };

// Arranque antes de tener empleados: no consulta un conjunto vacío; al llegar
// los empleados, vuelve a ejecutar el efecto y reconstruye la cuenta.
{
  const state = { cuentas: {}, empleados: [] };
  const primero = await iniciar({ localActivoId: 'L1', empleados: [], state });
  assert.equal(Object.keys(state.cuentas).length, 0);
  assert.equal(primero.requests.length, 0);
  state.empleados = [{ ...empleadoBase }];
  const segundo = await iniciar({ localActivoId: 'L1', empleados: state.empleados, state });
  assert.equal(segundo.requests.length, 1);
  segundo.requests[0].resolve({ data: { ok: true, cuentas: [{ empleado_id: 'e1', estado: 'activa', rol: 'Camarero/a' }] }, error: null });
  await tick();
  assert.equal(state.cuentas.e1, 'activa');
  assert.equal(state.empleados[0].tieneCuenta, true);
  assert.equal(state.empleados[0].cuentaActiva, true);
}

// Un fallo de red no se convierte en «sin cuenta» y queda observable como error.
{
  const state = { cuentas: {}, empleados: [{ ...empleadoBase, tieneCuenta: true, cuentaActiva: true, rolCuenta: 'Camarero/a' }] };
  const r = await iniciar({ localActivoId: 'L1', empleados: state.empleados, state });
  assert.equal(state.cuentas.e1, 'cargando');
  r.requests[0].resolve({ data: null, error: { message: 'network down' } });
  await tick();
  assert.equal(state.cuentas.e1, 'error');
  assert.equal(state.empleados[0].tieneCuenta, true);
  assert.equal(state.empleados[0].cuentaActiva, true);
  assert.equal(state.empleados[0].rolCuenta, 'Camarero/a');
}

// Una cuenta suspendida conserva el vínculo, pero no queda como activa.
{
  const state = { cuentas: {}, empleados: [{ ...empleadoBase }] };
  const r = await iniciar({ localActivoId: 'L1', empleados: state.empleados, state });
  r.requests[0].resolve({ data: { ok: true, cuentas: [{ empleado_id: 'e1', estado: 'suspendida', rol: 'Camarero/a' }] }, error: null });
  await tick();
  assert.equal(state.cuentas.e1, 'suspendida');
  assert.equal(state.empleados[0].tieneCuenta, true);
  assert.equal(state.empleados[0].cuentaActiva, false);
  assert.equal(state.empleados[0].rolCuenta, 'Camarero/a');
}

// Al cambiar de local, la respuesta antigua se cancela/descarta y no puede
// sobrescribir el estado del local nuevo.
{
  const state = { cuentas: {}, empleados: [
    { ...empleadoBase, id: 'e1', localId: 'L1' },
    { ...empleadoBase, id: 'e2', localId: 'L2' }
  ] };
  const requests = [];
  const a1 = await iniciar({ localActivoId: 'L1', empleados: state.empleados, state, requests });
  const a2 = await iniciar({
    localActivoId: 'L2',
    empleados: state.empleados,
    locales: [{ id: 'L2', empresaId: 'E1', activo: true }],
    state,
    requests
  });
  a1.cleanup();
  assert.equal(requests.length, 2);
  assert.equal(requests[0].promise.signal.aborted, true);
  requests[1].resolve({ data: { ok: true, cuentas: [{ empleado_id: 'e2', estado: 'activa', rol: 'Encargado' }] }, error: null });
  await tick();
  requests[0].resolve({ data: { ok: true, cuentas: [{ empleado_id: 'e1', estado: 'activa', rol: 'Camarero/a' }] }, error: null });
  await tick();
  assert.equal(state.cuentas.e2, 'activa');
  assert.equal(state.cuentas.e1, undefined);
  assert.equal(state.empleados.find((e) => e.id === 'e2').cuentaActiva, true);
  assert.equal(state.empleados.find((e) => e.id === 'e1').tieneCuenta, false);
}

// Una recarga del mismo contexto vuelve a leer el servidor y conserva el estado
// confirmado, aunque el borrador local empezara sin el indicador de cuenta.
{
  const state = { cuentas: {}, empleados: [{ ...empleadoBase }] };
  const primera = await iniciar({ localActivoId: 'L1', empleados: state.empleados, state });
  primera.requests[0].resolve({ data: { ok: true, cuentas: [{ empleado_id: 'e1', estado: 'activa', rol: 'Camarero/a' }] }, error: null });
  await tick();
  const recarga = await iniciar({ localActivoId: 'L1', empleados: state.empleados, state });
  recarga.requests[0].resolve({ data: { ok: true, cuentas: [{ empleado_id: 'e1', estado: 'activa', rol: 'Camarero/a' }] }, error: null });
  await tick();
  assert.equal(state.cuentas.e1, 'activa');
  assert.equal(state.empleados[0].cuentaActiva, true);
  assert.equal(recarga.requests[0].parametros.p_local_id, 'L1');
  assert.deepEqual(recarga.requests[0].parametros.p_empleado_ids, ['e1']);
}

console.log('P12_ACCOUNT_ENRICHMENT_RUNTIME=PASS');
