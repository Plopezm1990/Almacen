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
]) {
  assert.ok(bloque.includes(pieza), `el parche P03 incluye: ${pieza}`);
}

// --- Entorno simulado ---------------------------------------------------
let rpcCalls = [];
let rpcImpl = async () => ({ data: null, error: { message: 'no configurado' } });
const storageBackend = {};

function crearWindow() {
  const w = {
    __nubeActiva: true,
    storage: {
      get: async (key) => ({ key, value: storageBackend[key] || '', shared: false }),
      set: async (key, value) => { storageBackend[key] = JSON.stringify(value); return { key, value, shared: false }; },
    },
    getSupabaseClient: async () => ({
      auth: { getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }) },
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

  console.log('PM33_P03_FRONTEND_MULTILOCAL_OK=1');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
