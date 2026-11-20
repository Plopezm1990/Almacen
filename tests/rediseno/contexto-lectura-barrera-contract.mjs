// Contrato: con la barrera de sincronización cerrada, la lectura del contexto
// de empresa/local NO puede responder «no hay locales».
//
// Por qué existe este contrato
// ----------------------------
// `ui-context-bridge.js` intercepta las tres claves de contexto —`empresas`,
// `locales` y `localActivoId`— y las sirve SOLO desde localStorage, detrás de la
// barrera `__instalacionSyncPermitida`. Al escribir, el propio fichero trata el
// agotamiento de esa barrera como fatal:
//
//     if (!(await esperarBarrera())) throw new Error("Instalación no validada");
//
// Al leer, en cambio, hacía esto:
//
//     await esperarBarrera();
//     return respuesta(key, leerLocal(key));
//
// Esperaba a la barrera y tiraba el resultado. `esperarBarrera()` devuelve
// `false` tras 400 intentos de 25 ms —diez segundos justos— y la lectura
// respondía igualmente con lo que hubiera en localStorage. Y justo en ese
// momento puede no haber nada: `edge-auth-patch.js` aparta la copia local
// cuando era de otra cuenta (D01, copia local por cuenta), y en el Deploy
// Preview `reset-pruebas-preview.js` siembra `almacen:*` en la pantalla de
// acceso, antes de que exista ninguna cuenta, así que al entrar esa copia es de
// nadie y se aparta.
//
// El resultado es que la lectura decía «no hay locales» cuando lo cierto era
// «todavía no lo sé». Son dos cosas distintas, y quien recibe la primera actúa:
// `fuente.js:105556` la toma por una instalación antigua de un solo local e
// INVENTA uno («Local principal», con un identificador generado en el
// navegador). Eso se vio en vivo en el Deploy Preview #225 el 20/11/2026 con la
// cuenta `qa.permisos.20261116@qa.invalid`, cuya membresía de QA-A1 es correcta.
//
// Qué fija este contrato, y qué no
// --------------------------------
// Fija la conducta del puente, que se puede comprobar aquí sin navegador: con
// la barrera cerrada, una lectura de contexto o dice la verdad —preguntando al
// servidor, que es la autoridad— o falla; lo que no puede es inventarse un
// vacío. No pretende demostrar que esto fuera la causa del síntoma de QA: ese
// eslabón necesita observar la ejecución y queda anotado como pendiente en el
// acta. El defecto se sostiene por sí solo: el mismo fichero ya considera fatal
// ese agotamiento al escribir.
//
// El contrato existente `tests/ui-context-bridge.mjs` no lo veía porque monta
// el puente con `__instalacionSyncPermitida: true`, es decir con la barrera
// siempre abierta. Aquí se monta cerrada.

import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const bridge = fs.readFileSync('ui-context-bridge.js', 'utf8');

// El contexto que QA devuelve de verdad para esa cuenta, tal como lo volcó
// DIAGNOSTICO_CONTEXTO_UI_QA.sql el 20/11/2026.
const CONTEXTO_QA = {
  state: 'ready',
  generation: 'gen-qa',
  empresa_id: 'QA-EMP-A',
  local_id: 'QA-A1',
  permite_todos_locales: false,
  empresas: [{ id: 'QA-EMP-A', nombre: 'QA Empresa A, S.L.', activo: true }],
  locales: [{ id: 'QA-A1', empresaId: 'QA-EMP-A', nombre: 'Local A1', activo: true }]
};

function montar({ barreraAbierta, copiaLocal, rpc }) {
  const local = new Map(copiaLocal);
  const rpcCalls = [];
  const contexto = {
    console,
    JSON,
    Error,
    Array,
    String,
    Promise,
    // La espera de la barrera son 400 vueltas de 25 ms. Aquí el reloj se
    // dispara al momento para que el agotamiento ocurra sin esperar diez
    // segundos de verdad; lo que se mide es la conducta, no el tiempo.
    setTimeout(fn) { fn(); return 0; },
    window: {
      __instalacionSyncPermitida: barreraAbierta,
      storage: {
        async get(key) { return { key, value: '', shared: false }; },
        async set(key, value) { return { key, value, shared: false }; }
      },
      async getSupabaseClient() {
        return {
          auth: { async getSession() { return { data: { session: { user: { id: 'u-qa' } } } }; } },
          async rpc(nombre, args) {
            rpcCalls.push({ nombre, args });
            return rpc(nombre, args);
          }
        };
      },
      __laOwnerBootstrapSeedUiContext() {}
    },
    localStorage: {
      getItem(k) { return local.has(k) ? local.get(k) : null; },
      setItem(k, v) { local.set(k, String(v)); },
      removeItem(k) { local.delete(k); }
    }
  };
  contexto.window.localStorage = contexto.localStorage;
  vm.createContext(contexto);
  vm.runInContext(bridge, contexto, { filename: 'ui-context-bridge.js' });
  return { ventana: contexto.window, local, rpcCalls };
}

const rpcQaOk = async (nombre) => {
  if (nombre === 'obtener_contexto_instalacion_ui') return { data: CONTEXTO_QA, error: null };
  throw new Error('RPC inesperada en este contrato: ' + nombre);
};

// --- 1. Barrera cerrada y copia local apartada: la lectura no puede mentir ---
//
// Es el caso exacto del arranque en un navegador nuevo: la copia se acaba de
// apartar, así que no hay ni una clave `almacen:*`, y la barrera no se ha
// abierto. Responder «[]» aquí es afirmar que la cuenta no tiene locales.
{
  const { ventana, rpcCalls } = montar({
    barreraAbierta: false,
    copiaLocal: [['la_suite_installation_generation_v1', 'gen-qa']],
    rpc: rpcQaOk
  });

  const locales = await ventana.storage.get('locales', false);
  assert.notEqual(
    locales.value,
    '',
    'con la barrera cerrada y la copia apartada, la lectura de «locales» no puede responder vacío: eso dice «no hay» cuando lo cierto es «no lo sé»'
  );
  assert.deepEqual(
    JSON.parse(locales.value),
    CONTEXTO_QA.locales,
    'debe responder lo que dice el servidor, que es la autoridad'
  );
  assert.ok(
    rpcCalls.some((c) => c.nombre === 'obtener_contexto_instalacion_ui'),
    'y para saberlo tiene que preguntárselo al servidor'
  );

  const empresas = await ventana.storage.get('empresas', false);
  assert.deepEqual(JSON.parse(empresas.value), CONTEXTO_QA.empresas,
    'lo mismo vale para «empresas»');

  const activo = await ventana.storage.get('localActivoId', false);
  assert.equal(JSON.parse(activo.value), 'QA-A1',
    'y el local activo debe ser el que el servidor da por operativo');
}

// --- 2. Barrera cerrada y además sin servidor: falla, no se inventa un vacío ---
//
// Si tampoco se puede preguntar, la respuesta honesta es un error. Un vacío
// silencioso es lo que hace que el cliente invente un local.
{
  const { ventana } = montar({
    barreraAbierta: false,
    copiaLocal: [['la_suite_installation_generation_v1', 'gen-qa']],
    rpc: async () => ({ data: null, error: { message: 'sin red' } })
  });

  // El puente propaga el error tal como lo da Supabase, que es un objeto
  // llano y no un `Error` —igual que hace la ruta de escritura de este mismo
  // fichero—, así que se comprueba el motivo, no la clase.
  await assert.rejects(
    ventana.storage.get('locales', false),
    (e) => /sin red|no se pudo confirmar|Instalación no validada/i.test(String(e && e.message ? e.message : e)),
    'sin barrera y sin servidor, la lectura debe fallar en vez de responder «no hay locales»'
  );
}

// --- 3. Barrera cerrada pero con copia propia válida: se usa, sin preguntar ---
//
// El agotamiento de la barrera no debe convertir cada arranque lento en una
// llamada de red. Si el dispositivo ya tiene su copia, vale.
{
  const propios = JSON.stringify(CONTEXTO_QA.locales);
  const { ventana, rpcCalls } = montar({
    barreraAbierta: false,
    copiaLocal: [
      ['la_suite_installation_generation_v1', 'gen-qa'],
      ['almacen:locales', propios]
    ],
    rpc: rpcQaOk
  });

  const locales = await ventana.storage.get('locales', false);
  assert.equal(locales.value, propios, 'la copia propia del dispositivo se respeta');
  assert.equal(rpcCalls.length, 0, 'y no hace falta molestar al servidor para eso');
}

// --- 4. Barrera abierta: nada cambia ---
//
// La conducta normal no se toca. Con la barrera abierta la lectura sale de
// localStorage y no hay ni una llamada de más.
{
  const propios = JSON.stringify(CONTEXTO_QA.locales);
  const { ventana, rpcCalls } = montar({
    barreraAbierta: true,
    copiaLocal: [
      ['la_suite_installation_generation_v1', 'gen-qa'],
      ['almacen:locales', propios]
    ],
    rpc: rpcQaOk
  });

  const locales = await ventana.storage.get('locales', false);
  assert.equal(locales.value, propios);
  assert.equal(rpcCalls.length, 0, 'con la barrera abierta no se consulta al servidor');

  const vacio = await ventana.storage.get('pinPropietario', false);
  assert.equal(vacio.value, '', 'el PIN ausente sigue siendo un estado normal, no un error');
}

// --- 5. El fichero sigue tratando como fatal el agotamiento al ESCRIBIR ---
//
// Esta es la simetría que hacía evidente el defecto: lo que al escribir era
// fatal, al leer se tragaba. Si alguien relaja la escritura, que salte aquí.
assert.match(
  bridge,
  /if \(!\(await esperarBarrera\(\)\)\) throw new Error\("Instalación no validada"\)/,
  'la escritura debe seguir considerando fatal que la barrera no se abra'
);

console.log('CONTEXTO_LECTURA_BARRERA=OK (5 bloques)');
