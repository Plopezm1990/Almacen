// Contrato: cuando la puerta de autoridad no ha podido verificar el cargo
// todavía, la lectura debe FALLAR, no responder un valor vacío.
//
// Lo que se midió
// ---------------
// 20/11/2026, Deploy Preview #225, cuenta de ensayo
// `qa.permisos.20261116@qa.invalid` (Camarero/a, membresía QA-A1 correcta). Un
// guion de diagnóstico que se vuelve a poner por encima de las envolturas de
// `window.storage` cada vez que lo desplazan registró esto:
//
//   locales       <- puerta-autoridad   a los  4081 ms   devuelve ""
//                    en el dispositivo: [{"id":"QA-A1","nombre":"Local A1",…}]
//                    barrera: cerrada
//   empresas      <- puerta-autoridad   a los 15385 ms   devuelve [{QA-EMP-A…}]
//   localActivoId <- puerta-autoridad   a los 15567 ms   devuelve "QA-A1"
//
// No era la clave: era **cuándo** se lee. `locales` se pide a los cuatro
// segundos, cuando el contexto operativo todavía no está resuelto; `empresas` y
// `localActivoId` se piden a los quince, cuando ya lo está. Y en el primer caso
// la puerta entra por esta rama de `edge-auth-patch.js`:
//
//     var contexto = null;
//     try { contexto = await obtenerContexto(false); } catch (e) {}
//     var rol = contexto && contexto.rol;
//     // Si hay una sesión pero no se ha podido verificar su rol, se falla
//     // cerrado … loadKey aplicará el fallback del módulo …
//     if (!rol) { … return respuestaVacia(key); }
//
// La intención es correcta —fallar cerrado— pero la forma miente: `respuestaVacia`
// devuelve `{ value: "" }`, y quien lo recibe no puede distinguir «todavía no sé
// quién eres» de «no tienes ninguno». `fuente.js:101783` lo convierte en el valor
// por defecto, que para locales es `[]`, y `fuente.js:105556` lee cero locales
// como una instalación antigua de un solo local e inventa uno. Ése es el «Local
// principal» fantasma, con identificador nuevo en cada arranque.
//
// Por qué lanzar es lo correcto, y no un parche
// --------------------------------------------
// `loadKey` ya tiene la maquinaria exacta para esto, y solo se activa con una
// excepción:
//
//     for (let attempt = 0; attempt <= retries; attempt++) {
//       try { res = await window.storage.get(key, false); }
//       catch (e2) { … await new Promise(r => setTimeout(r, 350)); continue; }
//       if (!res || !res.value) return fallback;      // ← un vacío NO reintenta
//
// Tres intentos, 350 ms de espera. Un vacío se da por bueno al primer golpe; una
// excepción se reintenta y, para cuando toca el segundo intento, el contexto ya
// está resuelto. Y si tras los tres sigue sin resolverse, `loadKey` aplica el
// mismo valor por defecto que antes: el peor caso no empeora.
//
// Lanzar es además MÁS cerrado que devolver vacío: no entrega dato alguno y
// además lo dice. Fallar cerrado y fallar callado no son lo mismo.

import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const edge = fs.readFileSync('edge-auth-patch.js', 'utf8');

// --- Un entorno mínimo donde el cargo NO se puede verificar ---------------
// La sesión existe (hay usuario), pero la RPC del contexto operativo no
// responde. Es exactamente el estado de los primeros segundos del arranque.
function montar({ contextoResuelve }) {
  const almacen = new Map([
    ['almacen:locales', JSON.stringify([{ id: 'QA-A1', nombre: 'Local A1', empresaId: 'QA-EMP-A', activo: true }])],
    ['la_suite_installation_generation_v1', 'gen-qa']
  ]);

  const baseLlamadas = [];
  const storageBase = {
    async get(key) {
      baseLlamadas.push(key);
      const v = almacen.get('almacen:' + key);
      return { key, value: v === undefined ? '' : v, shared: false };
    },
    async set(key, value) { almacen.set('almacen:' + key, value); return { key, value, shared: false }; },
    async delete(key) { almacen.delete('almacen:' + key); return { key, shared: false }; }
  };

  const localStorageFalso = {
    get length() { return almacen.size; },
    key(i) { return Array.from(almacen.keys())[i] ?? null; },
    getItem(k) { return almacen.has(k) ? almacen.get(k) : null; },
    setItem(k, v) { almacen.set(k, String(v)); },
    removeItem(k) { almacen.delete(k); },
    clear() { almacen.clear(); }
  };

  const supabase = {
    auth: {
      async getSession() { return { data: { session: { user: { id: 'u-qa' } }, access_token: 't' } }; },
      onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; }
    },
    async rpc(nombre) {
      if (nombre === 'obtener_contexto_operativo') {
        if (contextoResuelve) {
          return { data: { rol: 'Camarero/a', localId: 'QA-A1', empresaId: 'QA-EMP-A' }, error: null };
        }
        // El estado real de los primeros segundos: todavía no se sabe.
        return { data: null, error: { message: 'contexto no disponible todavia' } };
      }
      return { data: null, error: { message: 'rpc no esperada: ' + nombre } };
    }
  };

  const ventana = {
    location: { hostname: 'deploy-preview-225--chic-entremet-9107cf.netlify.app', href: 'https://deploy-preview-225--chic-entremet-9107cf.netlify.app/', hash: '' },
    storage: storageBase,
    localStorage: localStorageFalso,
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    __nubeActiva: true,
    __nubeCliente: supabase,
    __instalacionSesionConNube: true,
    __instalacionSyncPermitida: false,
    async getSupabaseClient() { return supabase; },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 1)),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: () => 0,
    clearInterval: () => {},
    fetch: async () => ({ ok: false, status: 503, async text() { return ''; }, async json() { return {}; } }),
    NUBE_URL: 'https://qjqorixtkilwsndqayyx.supabase.co'
  };
  ventana.window = ventana;

  const ctx = {
    window: ventana,
    localStorage: localStorageFalso,
    sessionStorage: ventana.sessionStorage,
    Storage: function Storage() {},
    console: { log() {}, warn() {}, error() {}, info() {} },
    JSON, Error, Object, Array, String, Number, Boolean, Date, Math, Promise, Map, Set, RegExp, URL,
    setTimeout: ventana.setTimeout, clearTimeout: ventana.clearTimeout,
    setInterval: ventana.setInterval, clearInterval: ventana.clearInterval,
    fetch: ventana.fetch,
    CustomEvent: function CustomEvent(t, o) { this.type = t; Object.assign(this, o || {}); },
    // El fichero también monta avisos en pantalla (el overlay de MFA). Aquí no
    // se ejercita eso, así que basta un DOM de juguete para que no estorbe.
    document: (() => {
      const nodo = () => {
        const n = {
          style: {}, dataset: {}, classList: { add() {}, remove() {}, contains() { return false; } },
          children: [], textContent: '', innerHTML: '', id: '', parentNode: null,
          setAttribute() {}, removeAttribute() {}, getAttribute() { return null; },
          appendChild(h) { this.children.push(h); if (h) h.parentNode = this; return h; },
          insertBefore(h) { this.children.unshift(h); return h; },
          removeChild() {}, remove() {},
          addEventListener() {}, removeEventListener() {}, focus() {},
          querySelector() { return null; }, querySelectorAll() { return []; }
        };
        Object.defineProperty(n, 'lastChild', { get() { return n.children[n.children.length - 1] || null; } });
        Object.defineProperty(n, 'firstChild', { get() { return n.children[0] || null; } });
        return n;
      };
      const doc = nodo();
      doc.createElement = nodo;
      doc.createTextNode = () => nodo();
      doc.getElementById = () => null;
      doc.visibilityState = 'visible';
      doc.documentElement = nodo();
      doc.body = nodo();
      doc.head = nodo();
      return doc;
    })()
  };
  ctx.Storage.prototype = {
    getItem(k) { return localStorageFalso.getItem(k); },
    setItem(k, v) { localStorageFalso.setItem(k, v); },
    removeItem(k) { localStorageFalso.removeItem(k); },
    clear() { localStorageFalso.clear(); }
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(edge, ctx, { filename: 'edge-auth-patch.js' });
  return { ventana, almacen, baseLlamadas };
}

// --- 1. Cargo sin verificar: debe LANZAR, no responder vacío --------------
{
  const { ventana, almacen } = montar({ contextoResuelve: false });
  assert.ok(ventana.__contextoRolSeguroInstalado, 'la puerta de autoridad debe haberse instalado');

  let resultado = null;
  let lanzo = null;
  try { resultado = await ventana.storage.get('locales', false); }
  catch (e) { lanzo = e; }

  assert.ok(
    lanzo !== null,
    'con el cargo sin verificar, la lectura de «locales» debe LANZAR: devolver un valor vacío hace que el cliente concluya que la cuenta no tiene locales y se invente uno'
  );
  assert.equal(
    resultado,
    null,
    'y no debe resolverse con ningún valor'
  );
  // El vacío mentiroso era exactamente éste.
  assert.notEqual(
    resultado && resultado.value,
    '',
    'nunca «{ value: "" }» en este estado'
  );
  // Fallar cerrado sigue siendo cerrado: la copia local no se entrega ni se borra.
  assert.ok(
    almacen.get('almacen:locales'),
    'fallar no debe borrar la copia local: loadKey la volverá a pedir'
  );
}

// --- 2. Cargo verificado: la lectura funciona como siempre ----------------
{
  const { ventana } = montar({ contextoResuelve: true });
  const r = await ventana.storage.get('locales', false);
  assert.ok(r && typeof r.value === 'string', 'con el cargo verificado debe responder normalmente');
  assert.deepEqual(
    JSON.parse(r.value),
    [{ id: 'QA-A1', nombre: 'Local A1', empresaId: 'QA-EMP-A', activo: true }],
    'y debe entregar los locales de su membresía, que es el arreglo del contrato hermano'
  );
}

// --- 3. Una clave no controlada no pasa por la puerta ---------------------
{
  const { ventana } = montar({ contextoResuelve: false });
  const r = await ventana.storage.get('empresas', false);
  assert.ok(r, '«empresas» no es clave controlada y debe seguir pasando sin verificar cargo');
}

// --- 4. La intención queda escrita en el código --------------------------
// Si alguien vuelve a poner un vacío en esa rama, que salte aquí.
assert.doesNotMatch(
  edge,
  /no se ha podido verificar su rol[\s\S]{0,400}?return respuestaVacia\(key\)/,
  'la rama del cargo sin verificar no debe responder con un valor vacío'
);

// --- 5. Y la copia que de verdad manda, la del paquete -------------------
// `fuente.js` lleva inlineada su propia copia de esta puerta, y como el paquete
// se carga el último, su envoltura queda por fuera: es la que decide. Arreglar
// solo `edge-auth-patch.js` no cambia nada en la aplicación —me costó media
// tarde comprobarlo—, así que aquí se exige el arreglo en las dos.
{
  const paquete = fs.readFileSync('fuente.js', 'utf8');
  assert.match(
    paquete,
    /sinCargo\.code = "CARGO_SIN_VERIFICAR"/,
    'la copia inlineada en fuente.js también debe lanzar cuando el cargo no está verificado: es la que corre'
  );
  assert.doesNotMatch(
    paquete,
    /var rol = contexto && contexto\.rol;\s*if \(!rol\) \{\s*if \(modoLocalNoReclamado\(\)\) return getOriginal\(key, shared\);\s*return respuestaVacia\(key\);/,
    'la copia del paquete no debe responder con un valor vacío en la rama del cargo sin verificar'
  );
}

console.log('FALLAR_CERRADO_SIN_MENTIR=OK (5 bloques, las dos copias)');
