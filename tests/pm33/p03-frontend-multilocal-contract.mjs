// PM33 P03 — contrato del parche de frontend (compatibilidad multilocal).
//
// Extrae y EJECUTA (no solo busca texto) el IIFE de fuente.js que instala
// el guard de contexto operativo (window.__contextoRolSeguroInstalado),
// contra un window/localStorage/Supabase simulados, para comprobar:
//   1. Cuando window.__localActivoIdParaContexto está fijado, la RPC se
//      invoca CON p_local_id (no sin argumentos).
//   2. Un rechazo explícito del servidor (respuesta.error) NUNCA reutiliza
//      un contexto previo, ni el de memoria ni el guardado en disco.
//   3. Cambiar de local invalida la caché en memoria aunque el TTL no
//      haya vencido: se vuelve a llamar a la RPC.
//   4. El respaldo en disco (leerContextoLocal) NUNCA sirve el contexto de
//      un local distinto al que se está pidiendo ahora (protege frente a
//      un corte de red justo después de cambiar de local).
//   5. (P04) Condición de carrera: dos peticiones pendientes para el mismo
//      usuario/local -- la segunda rechaza primero; la primera resuelve
//      con éxito DESPUÉS. El éxito tardío nunca reescribe la caché que la
//      más reciente ya limpió, y la siguiente lectura dispara una RPC
//      nueva en vez de devolver la respuesta obsoleta "gratis".
//   6. (P05) Fuga cruzada de identidad al descartar una respuesta obsoleta
//      (cambio de local con una recarga forzada de por medio).
//   7. (P05) Concurrencia normal, mismo usuario/local, sin caché previa:
//      ninguna de las dos lecturas debe volver vacía por la otra.
//   8. (ronda actual) Concurrencia ENTRE SESIONES: el usuario A inicia una
//      lectura normal (sin forzar) que queda pendiente; la sesión cambia
//      al usuario B, MISMO local, y B inicia otra lectura normal mientras
//      la de A sigue pendiente. B nunca debe recibir la respuesta de A --
//      la reutilización de la petición en curso debe distinguir
//      usuario/sesión, no solo local.
//   9. (ronda actual) Cerrar sesión (logout) con una lectura pendiente
//      invalida también la caché y la respuesta en curso: una lectura
//      posterior sin sesión nunca hereda la del usuario anterior.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');

const inicio = src.lastIndexOf('(function() {', src.indexOf('window.__contextoRolSeguroInstalado'));
const finMarcador = 'window.__recargarContextoOperativo = function() {';
const finIdx = src.indexOf(finMarcador);
assert.ok(inicio >= 0 && finIdx > inicio, 'IIFE de contexto operativo localizado');
const fin = src.indexOf('})();', finIdx) + '})();'.length;
const bloque = src.slice(inicio, fin);

for (const pieza of [
  'contextoLocalIdUsado',
  'window.__localActivoIdParaContexto',
  'p_local_id: localIdSolicitado',
  'limpiarContextoLocalGuardado',
  'contextoUsuarioEnVuelo',
  'sesionUsuarioConocido',
  'invalidarPorCambioDeSesion',
  'onAuthStateChange',
]) {
  assert.ok(bloque.includes(pieza), `el parche incluye: ${pieza}`);
}

// --- Entorno simulado ---------------------------------------------------
let rpcCalls = [];
let rpcImpl = async () => ({ data: null, error: { message: 'no configurado' } });
const storageBackend = {};
// Sesión simulada, MUTABLE desde fuera (a diferencia de la versión
// anterior, con un usuario fijo 'user-1') -- necesaria para el escenario
// 8/9: cambiar de sesión (incluido cerrar sesión) con una lectura
// pendiente. sesionSuscriptores recibe los callbacks que el propio
// parche registra vía supabase.auth.onAuthStateChange, compartido entre
// todos los clientes simulados que devuelva getSupabaseClient (igual que
// el cliente real de Supabase es un único objeto compartido en la app).
let sesionActualId = 'user-1';
let sesionSuscriptores = [];
function cambiarSesion(nuevoUsuarioId) {
  sesionActualId = nuevoUsuarioId;
  const sesion = nuevoUsuarioId ? { user: { id: nuevoUsuarioId } } : null;
  const evento = nuevoUsuarioId ? 'SIGNED_IN' : 'SIGNED_OUT';
  sesionSuscriptores.forEach((cb) => { try { cb(evento, sesion); } catch (e) { /* no debe tumbar la prueba */ } });
}
// Deja pasar suficientes vueltas de microtask/macrotask para que la
// suscripción a onAuthStateChange que el propio parche registra al
// arrancar (clienteSupabase() + sesionActual(), ambos async) ya se haya
// completado -- necesario para que los escenarios de cambio de sesión
// sean deterministas en vez de depender de una carrera de arranque.
function esperarSuscripcionDeSesion() {
  return new Promise((r) => setTimeout(r, 0));
}

function crearWindow() {
  const w = {
    __nubeActiva: true,
    storage: {
      get: async (key) => ({ key, value: storageBackend[key] || '', shared: false }),
      set: async (key, value) => { storageBackend[key] = JSON.stringify(value); return { key, value, shared: false }; },
    },
    getSupabaseClient: async () => ({
      auth: {
        getSession: async () => ({ data: { session: sesionActualId ? { user: { id: sesionActualId } } : null } }),
        onAuthStateChange: (cb) => {
          sesionSuscriptores.push(cb);
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
      rpc: async (nombre, args) => {
        rpcCalls.push({ nombre, args: args || null });
        return rpcImpl(nombre, args);
      },
    }),
  };
  return w;
}

function crearLocalStorage() {
  const datos = {};
  return {
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => { datos[k] = String(v); },
    removeItem: (k) => { delete datos[k]; },
  };
}

function nuevoSandbox() {
  sesionActualId = 'user-1';
  sesionSuscriptores = [];
  const window_ = crearWindow();
  const localStorage = crearLocalStorage();
  const sandbox = { window: window_, localStorage, setTimeout, console, Promise };
  vm.createContext(sandbox);
  vm.runInContext(bloque, sandbox);
  return sandbox;
}

async function main() {
  // 1) Con local activo fijado, la RPC se llama CON p_local_id.
  {
    rpcCalls = [];
    rpcImpl = async () => ({ data: { rol: 'Camarero/a', empresaId: 'emp-A', localId: 'loc-A', empleado: { id: 'ea-1' }, empleadosFichaje: [{ id: 'ea-1' }], proveedores: [], fichasProduccion: [], cobrosEncargos: [] }, error: null });
    const sb = nuevoSandbox();
    sb.window.__localActivoIdParaContexto = 'loc-A';
    const ctx = await sb.window.__recargarContextoOperativo();
    assert.equal(rpcCalls.length, 1);
    assert.ok(rpcCalls[0].args && rpcCalls[0].args.p_local_id === 'loc-A', 'la RPC se llama con p_local_id cuando hay local activo');
    assert.equal(Object.keys(rpcCalls[0].args).length, 1, 'la RPC se llama únicamente con p_local_id, sin argumentos extra');
    assert.equal(ctx.localId, 'loc-A');
  }

  // 2) Rechazo explícito del servidor: NO se reutiliza contexto previo
  //    (ni memoria ni disco), y la llamada siguiente vuelve a intentarlo.
  {
    rpcCalls = [];
    rpcImpl = async () => ({ data: { rol: 'Camarero/a', localId: 'loc-A', empleado: { id: 'ea-1' }, empleadosFichaje: [], proveedores: [], fichasProduccion: [], cobrosEncargos: [] }, error: null });
    const sb = nuevoSandbox();
    sb.window.__localActivoIdParaContexto = 'loc-A';
    const primero = await sb.window.__recargarContextoOperativo();
    assert.ok(primero && primero.rol === 'Camarero/a', 'primera llamada obtiene contexto válido');

    rpcImpl = async () => ({ data: null, error: { message: 'Contexto no autorizado' } });
    const rechazado = await sb.window.__recargarContextoOperativo();
    assert.equal(rechazado, null, 'un rechazo explícito nunca reutiliza el contexto anterior');

    // Aunque la red falle justo después, no debe recuperar el contexto
    // previo del respaldo en disco: se limpió al rechazar.
    rpcImpl = async () => { throw new Error('red caída'); };
    const trasCorteDeRed = await sb.window.__recargarContextoOperativo();
    assert.equal(trasCorteDeRed, null, 'tras un rechazo, un corte de red posterior tampoco recupera datos antiguos');
  }

  // 3) Cambiar de local invalida la caché en memoria (nueva llamada RPC),
  //    y el nuevo contexto está acotado al NUEVO local, nunca al anterior.
  {
    rpcCalls = [];
    let quePedir = 'loc-A';
    rpcImpl = async (_n, args) => {
      const loc = (args && args.p_local_id) || null;
      return { data: { rol: 'Cajero/a', localId: loc, empresaId: loc === 'loc-A' ? 'emp-A' : 'emp-B', empleado: null, empleadosFichaje: [], proveedores: [{ id: 'p-' + loc }], fichasProduccion: [], cobrosEncargos: [] }, error: null };
    };
    const sb = nuevoSandbox();
    sb.window.__localActivoIdParaContexto = 'loc-A';
    const ctxA = await sb.window.__recargarContextoOperativo();
    assert.equal(ctxA.localId, 'loc-A');

    sb.window.__localActivoIdParaContexto = 'loc-B';
    // Llamada normal (forzar=false) vía window.storage.get, no
    // __recargarContextoOperativo: debe detectar igualmente el cambio de
    // local y no servir el contexto cacheado de loc-A.
    await sb.window.storage.get('empleados');
    assert.equal(rpcCalls[rpcCalls.length - 1].args.p_local_id, 'loc-B', 'un cambio de local dispara una nueva llamada acotada al nuevo local, sin esperar a que venza el TTL');
  }

  // 4) El respaldo en disco nunca mezcla contextos de locales distintos.
  {
    rpcCalls = [];
    rpcImpl = async (_n, args) => ({ data: { rol: 'Cajero/a', localId: (args && args.p_local_id) || null, empresaId: 'emp-A', empleado: null, empleadosFichaje: [], proveedores: [], fichasProduccion: [], cobrosEncargos: [] }, error: null });
    const sb = nuevoSandbox();
    sb.window.__localActivoIdParaContexto = 'loc-A';
    await sb.window.__recargarContextoOperativo(); // guarda respaldo en disco para loc-A

    sb.window.__localActivoIdParaContexto = 'loc-B';
    rpcImpl = async () => { throw new Error('red caída justo al cambiar de local'); };
    const resultado = await sb.window.__recargarContextoOperativo();
    assert.equal(resultado, null, 'el respaldo en disco de loc-A NUNCA se sirve como si fuera el de loc-B');
  }

  // 5) Condición de carrera: A pide primero, se queda pendiente. B pide
  //    después (mismo usuario/local), rechaza YA. A resuelve con éxito
  //    DESPUÉS: no debe restaurar la caché. Una lectura posterior debe
  //    disparar una RPC nueva, no reutilizar la respuesta tardía de A.
  {
    rpcCalls = [];
    const sb = nuevoSandbox();
    sb.window.__localActivoIdParaContexto = 'loc-A';

    let resolverA;
    const pendienteA = new Promise((r) => { resolverA = r; });
    let numLlamada = 0;
    rpcImpl = async () => {
      numLlamada++;
      if (numLlamada === 1) return pendienteA; // A: se queda pendiente
      return { data: null, error: { message: 'Contexto no autorizado' } }; // B: rechaza ya
    };

    const promesaA = sb.window.__recargarContextoOperativo(); // dispara A (queda pendiente)
    const resultadoB = await sb.window.__recargarContextoOperativo(); // dispara B, resuelve antes que A
    assert.equal(resultadoB, null, 'B (la petición más reciente) rechaza y limpia la caché');

    resolverA({ data: { rol: 'Camarero/a', localId: 'loc-A', empleado: { id: 'ea-1' }, empleadosFichaje: [{ id: 'ea-1' }], proveedores: [], fichasProduccion: [], cobrosEncargos: [] }, error: null });
    const resultadoA = await promesaA;
    assert.equal(resultadoA, null, 'el éxito TARDÍO de A se descarta -- B ya invalidó su generación, no reescribe la caché que B limpió');

    const llamadasAntes = rpcCalls.length;
    rpcImpl = async () => ({ data: { rol: 'Camarero/a', localId: 'loc-A', empleado: { id: 'ea-1' }, empleadosFichaje: [{ id: 'ea-1' }], proveedores: [], fichasProduccion: [], cobrosEncargos: [] }, error: null });
    const trasElRechazo = await sb.window.storage.get('empleados');
    assert.ok(rpcCalls.length > llamadasAntes, 'la siguiente lectura dispara una RPC nueva, no reutiliza la respuesta obsoleta de A sin llamar al servidor');
    assert.ok(JSON.parse(trasElRechazo.value).length === 1, 'y esa RPC nueva sí devuelve el dato correcto');
  }

  // 6) (P05) Fuga cruzada de identidad: A pendiente para loc-A. Mientras
  //    tanto cambia el local a loc-B y una recarga forzada para loc-B
  //    resuelve YA con éxito. A resuelve DESPUÉS, también con éxito, pero
  //    para loc-A: nunca debe filtrarse ni devolverse como si fuera de
  //    loc-B, ni sobrescribir la caché que loc-B dejó.
  {
    rpcCalls = [];
    const sb = nuevoSandbox();
    sb.window.__localActivoIdParaContexto = 'loc-A';

    let resolverA;
    const pendienteA = new Promise((r) => { resolverA = r; });
    let primera = true;
    rpcImpl = async (_n, args) => {
      const loc = (args && args.p_local_id) || null;
      if (loc === 'loc-A' && primera) { primera = false; return pendienteA; }
      return { data: { rol: 'Cajero/a', localId: loc, empresaId: loc === 'loc-A' ? 'emp-A' : 'emp-B', empleado: null, empleadosFichaje: [], proveedores: [{ id: 'p-' + loc }], fichasProduccion: [], cobrosEncargos: [] }, error: null };
    };

    const promesaA = sb.window.__recargarContextoOperativo(); // pide loc-A, queda pendiente

    sb.window.__localActivoIdParaContexto = 'loc-B';
    const resultadoB = await sb.window.__recargarContextoOperativo(); // pide loc-B, resuelve ya
    assert.equal(resultadoB.localId, 'loc-B', 'B resuelve correctamente para loc-B');

    resolverA({ data: { rol: 'Cajero/a', localId: 'loc-A', empresaId: 'emp-A', empleado: null, empleadosFichaje: [], proveedores: [{ id: 'p-loc-A' }], fichasProduccion: [], cobrosEncargos: [] }, error: null });
    const resultadoA = await promesaA;
    assert.notEqual(resultadoA && resultadoA.localId, 'loc-B', 'la respuesta tardía de A (loc-A) nunca se devuelve como si fuera la de B');
    assert.equal(resultadoA, null, 'A queda descartada por completo: no coincide con el usuario/local vigente en el momento en que resuelve');

    // La caché sigue siendo la de B, sin contaminar: una lectura normal
    // (con TTL, sin forzar) debe devolver B sin disparar una RPC nueva.
    const llamadasAntesControl = rpcCalls.length;
    await sb.window.storage.get('empleados');
    assert.equal(rpcCalls.length, llamadasAntesControl, 'no hizo falta una RPC nueva: la caché de B seguía intacta, sin rastro de A');
  }

  // 7) (P05) Concurrencia normal, mismo usuario/local, SIN caché previa,
  //    ambas RPC correctas: la primera en terminar no debe devolver vacío
  //    solo porque la segunda sigue pendiente.
  {
    rpcCalls = [];
    const sb = nuevoSandbox();
    sb.window.__localActivoIdParaContexto = 'loc-A';
    rpcImpl = async () => ({ data: { rol: 'Camarero/a', localId: 'loc-A', empleado: { id: 'ea-1' }, empleadosFichaje: [{ id: 'ea-1' }], proveedores: [], fichasProduccion: [], cobrosEncargos: [] }, error: null });

    // Dos lecturas concurrentes normales (sin forzar), disparadas sin
    // esperar una a la otra -- el patrón real de dos componentes leyendo
    // 'empleados' casi a la vez.
    const p1 = sb.window.storage.get('empleados');
    const p2 = sb.window.storage.get('empleados');
    const [r1, r2] = await Promise.all([p1, p2]);
    assert.ok(JSON.parse(r1.value).length === 1, 'la primera lectura concurrente NO devuelve vacío aunque la segunda siguiera en curso');
    assert.ok(JSON.parse(r2.value).length === 1, 'la segunda lectura concurrente también resuelve con el dato correcto');
  }

  // 8) Concurrencia ENTRE SESIONES, MISMO local: A inicia una lectura
  //    normal (sin forzar) que queda pendiente. La sesión cambia a B
  //    (mismo local activo, sin que el usuario lo cambie). B inicia otra
  //    lectura normal mientras la de A sigue pendiente. B NUNCA debe
  //    recibir la respuesta de A: debe disparar su PROPIA llamada RPC. El
  //    éxito tardío de A, una vez resuelto, queda descartado (igual que
  //    cualquier respuesta de una generación ya superada) -- nunca se
  //    devuelve como si fuera la de B ni se escribe sobre la caché de B.
  {
    rpcCalls = [];
    const sb = nuevoSandbox();
    sb.window.__localActivoIdParaContexto = 'loc-A';
    await esperarSuscripcionDeSesion(); // sesionUsuarioConocido ya vale 'user-1'

    let resolverA;
    const pendienteA = new Promise((r) => { resolverA = r; });
    rpcImpl = async () => {
      // La primera llamada (la de A) se queda pendiente; cualquier
      // llamada posterior debe ser la de B -- si el parche fallara y B
      // reutilizara la petición de A, esta segunda rama nunca se
      // alcanzaría y rpcCalls.length se quedaría en 1.
      if (rpcCalls.length === 1) return pendienteA;
      return { data: { rol: 'Cajero/a', localId: 'loc-A', empresaId: 'emp-B', empleado: null, empleadosFichaje: [{ id: 'emp-B-1' }], proveedores: [], fichasProduccion: [], cobrosEncargos: [] }, error: null };
    };

    const promesaA = sb.window.storage.get('empleados'); // A: lectura normal, queda pendiente
    await new Promise((r) => setTimeout(r, 0)); // deja que A llegue de verdad a la RPC (y quede bloqueada en pendienteA) antes de cambiar de sesión
    assert.equal(rpcCalls.length, 1, 'A ya disparó su llamada RPC antes del cambio de sesión');

    cambiarSesion('user-2'); // cambia la sesión a B, MISMO local activo
    const promesaB = sb.window.storage.get('empleados'); // B: lectura normal mientras A sigue pendiente

    resolverA({ data: { rol: 'Cajero/a', localId: 'loc-A', empresaId: 'emp-A', empleado: null, empleadosFichaje: [{ id: 'emp-A-1' }], proveedores: [], fichasProduccion: [], cobrosEncargos: [] }, error: null });
    const [resultadoA, resultadoB] = await Promise.all([promesaA, promesaB]);

    assert.equal(rpcCalls.length, 2, 'B disparó su PROPIA llamada RPC -- nunca reutilizó la petición en curso de A');
    const idsB = resultadoB.value ? JSON.parse(resultadoB.value).map((e) => e.id) : [];
    assert.deepEqual(idsB, ['emp-B-1'], 'B recibe su propio resultado, nunca el de A');
    const idsA = resultadoA.value ? JSON.parse(resultadoA.value).map((e) => e.id) : [];
    assert.ok(idsA.indexOf('emp-B-1') === -1, 'A nunca recibe, ni por error, el resultado de B');
    assert.notDeepEqual(idsA, idsB, 'A y B nunca comparten el mismo resultado en este escenario');

    // Control: la caché sigue siendo la de B, sin contaminar por el
    // éxito tardío de A -- una lectura posterior no debería tener que
    // repetir la RPC si sigue dentro del TTL.
    const llamadasAntesControl = rpcCalls.length;
    const control = await sb.window.storage.get('empleados');
    assert.deepEqual(JSON.parse(control.value).map((e) => e.id), ['emp-B-1'], 'la lectura posterior sigue viendo los datos de B, sin rastro de A');
    assert.equal(rpcCalls.length, llamadasAntesControl, 'no hizo falta una RPC nueva: la caché de B seguía intacta');
  }

  // 9) Cerrar sesión (logout) con una lectura pendiente: invalida también
  //    la caché y la respuesta en curso. Una lectura posterior sin sesión
  //    nunca hereda ni el resultado ni la caché del usuario anterior.
  {
    rpcCalls = [];
    const sb = nuevoSandbox();
    sb.window.__localActivoIdParaContexto = 'loc-A';
    await esperarSuscripcionDeSesion();

    let resolverPendiente;
    const pendiente = new Promise((r) => { resolverPendiente = r; });
    rpcImpl = async () => pendiente;

    const promesaAntesDeCerrar = sb.window.storage.get('empleados'); // pendiente
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(rpcCalls.length, 1, 'la lectura ya disparó su RPC antes de cerrar sesión');

    cambiarSesion(null); // logout
    resolverPendiente({ data: { rol: 'Cajero/a', localId: 'loc-A', empresaId: 'emp-A', empleado: null, empleadosFichaje: [{ id: 'no-debe-verse' }], proveedores: [], fichasProduccion: [], cobrosEncargos: [] }, error: null });
    const resultadoTardio = await promesaAntesDeCerrar;
    assert.equal(resultadoTardio.value, '', 'el éxito tardío tras cerrar sesión se descarta -- no se entrega ni se cachea');

    // Una lectura posterior, ya sin sesión, tampoco debe disparar la RPC
    // (resolverContexto corta en seco en cuanto no hay userId) ni heredar
    // nada de la sesión anterior.
    const llamadasAntes = rpcCalls.length;
    const trasCerrar = await sb.window.storage.get('empleados');
    assert.equal(trasCerrar.value, '', 'sin sesión, la lectura no devuelve datos del usuario anterior');
    assert.equal(rpcCalls.length, llamadasAntes, 'sin sesión no se llama a la RPC de nuevo');
  }

  console.log('PM33_P03_FRONTEND_MULTILOCAL_OK=1');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
