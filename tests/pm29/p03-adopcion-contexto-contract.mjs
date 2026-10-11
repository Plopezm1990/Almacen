import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM29 P03: "Lo que el servidor confirma es lo que la pantalla muestra."
//
// Al dar de baja una empresa, el servidor desactiva tambien sus locales. El
// puente ya dejaba esa lista escrita en el navegador, pero la pantalla ya
// montada seguia mostrando los locales como activos hasta recargar. Peor: el
// siguiente guardado de locales salia de esa lista obsoleta y el servidor la
// rechazaba entera ("la empresa del local esta dada de baja").
//
// Este contrato fija las dos mitades del camino.

// ---------------------------------------------------------------------------
// 1. El puente anuncia el contexto que el servidor acaba de confirmar.
// ---------------------------------------------------------------------------
function montarPuente({ rpcDevuelve, rpcError = null }) {
  const eventos = [];
  const almacenLocal = new Map([['la_suite_installation_generation_v1', 'gen-1']]);
  const localStorageFalso = {
    getItem: (k) => (almacenLocal.has(k) ? almacenLocal.get(k) : null),
    setItem: (k, v) => almacenLocal.set(k, String(v)),
    removeItem: (k) => almacenLocal.delete(k),
  };
  const supabase = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
    rpc: async () => (rpcError ? { error: rpcError, data: null } : { error: null, data: rpcDevuelve }),
  };
  const window = {
    storage: {
      get: async (k) => ({ key: k, value: '', shared: false }),
      set: async (k, v) => ({ key: k, value: v, shared: false }),
      delete: async (k) => ({ key: k }),
    },
    localStorage: localStorageFalso,
    getSupabaseClient: async () => supabase,
    __laOwnerBootstrapSeedUiContext: () => {},
    dispatchEvent: (ev) => eventos.push(ev),
    __instalacionSyncPermitida: true,
  };
  class CustomEvent {
    constructor(type, init) { this.type = type; this.detail = init ? init.detail : undefined; }
  }
  const ctx = { window, localStorage: localStorageFalso, CustomEvent, setTimeout, Promise, JSON };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('ui-context-bridge.js', 'utf8'), ctx);
  return { window, eventos };
}

const contextoServidor = {
  state: 'ready',
  generation: 'gen-1',
  // El servidor devuelve la cascada ya aplicada: el local de la empresa dada
  // de baja vuelve como inactivo aunque el cliente lo mando activo.
  empresas: [
    { id: 'emp1', razonSocial: 'Empresa Uno', activo: true },
    { id: 'emp2', razonSocial: 'Empresa Dos', activo: false },
  ],
  locales: [
    { id: 'loc1', empresaId: 'emp1', nombre: 'Local Uno', activo: true },
    { id: 'loc2', empresaId: 'emp2', nombre: 'Local Dos', activo: false },
  ],
  local_id: 'loc1',
  permite_todos_locales: true,
};

{
  const { window, eventos } = montarPuente({ rpcDevuelve: contextoServidor });
  await window.storage.set('empresas', JSON.stringify([
    { id: 'emp1', razonSocial: 'Empresa Uno', activo: true },
    { id: 'emp2', razonSocial: 'Empresa Dos', activo: false },
  ]), false);

  const anuncio = eventos.find((e) => e.type === 'contexto-ui-actualizado');
  assert.ok(anuncio, 'el puente debe anunciar el contexto confirmado por el servidor');
  assert.deepEqual(anuncio.detail.locales, contextoServidor.locales,
    'el anuncio debe llevar los locales del servidor, con la cascada aplicada');
  assert.deepEqual(anuncio.detail.empresas, contextoServidor.empresas,
    'el anuncio debe llevar las empresas del servidor');
  console.log('P03_PUENTE_ANUNCIA_CONTEXTO=PASS');
}

{
  const { window, eventos } = montarPuente({
    rpcDevuelve: null,
    rpcError: new Error('Propietario requerido'),
  });
  await assert.rejects(
    () => window.storage.set('empresas', JSON.stringify([{ id: 'emp1' }]), false),
    'un rechazo del servidor debe propagarse'
  );
  assert.equal(eventos.filter((e) => e.type === 'contexto-ui-actualizado').length, 0,
    'un guardado rechazado no debe anunciar ningun contexto');
  console.log('P03_SIN_ANUNCIO_SI_FALLA=PASS');
}

// ---------------------------------------------------------------------------
// 2. La pantalla adopta ese contexto, y no se queda dando vueltas.
// ---------------------------------------------------------------------------
const src = fs.readFileSync('fuente.js', 'utf8');
const ini = src.indexOf('    function onContextoUiPM29(ev) {');
assert.ok(ini >= 0, 'no se encontro el manejador de adopcion');
const fin = src.indexOf('    window.addEventListener("contexto-ui-actualizado"', ini);
assert.ok(fin > ini, 'no se pudo acotar el manejador');
const fuenteManejador = src.slice(ini, fin);

function ejecutarManejador(detail, estado) {
  const aplicados = { empresas: null, locales: null };
  const bailouts = [];
  const hacerSetter = (clave) => (fn) => {
    const previo = estado[clave];
    const nuevo = fn(previo);
    if (nuevo === previo) bailouts.push(clave);
    else aplicados[clave] = nuevo;
  };
  const ctx = {
    setEmpresas: hacerSetter('empresas'),
    setLocales: hacerSetter('locales'),
    JSON, Array,
    EVENTO: { detail },
  };
  vm.createContext(ctx);
  vm.runInContext(fuenteManejador + '\nonContextoUiPM29(EVENTO);', ctx);
  return { aplicados, bailouts };
}

{
  const estado = {
    empresas: [{ id: 'emp2', razonSocial: 'Empresa Dos', activo: true }],
    locales: [{ id: 'loc2', empresaId: 'emp2', nombre: 'Local Dos', activo: true }],
  };
  const { aplicados } = ejecutarManejador(
    { empresas: contextoServidor.empresas, locales: contextoServidor.locales },
    estado
  );
  assert.deepEqual(aplicados.locales, contextoServidor.locales,
    'la pantalla debe adoptar los locales del servidor');
  assert.equal(aplicados.locales.find((l) => l.id === 'loc2').activo, false,
    'el local arrastrado por la baja debe quedar inactivo en pantalla');
  assert.deepEqual(aplicados.empresas, contextoServidor.empresas,
    'la pantalla debe adoptar las empresas del servidor');
  console.log('P03_PANTALLA_ADOPTA=PASS');
}

{
  // Si el servidor confirma lo mismo que ya hay, no debe provocarse otro
  // render ni, con el, otro guardado: seria un bucle.
  // Copia profunda a proposito: el servidor devuelve JSON recien parseado, asi
  // que nunca es el mismo objeto. Comparar por referencia no cortaria nada.
  const estado = {
    empresas: JSON.parse(JSON.stringify(contextoServidor.empresas)),
    locales: JSON.parse(JSON.stringify(contextoServidor.locales)),
  };
  const { aplicados, bailouts } = ejecutarManejador(
    { empresas: contextoServidor.empresas, locales: contextoServidor.locales },
    estado
  );
  assert.equal(aplicados.empresas, null, 'no debe reemplazarse un estado identico');
  assert.equal(aplicados.locales, null, 'no debe reemplazarse un estado identico');
  assert.deepEqual(bailouts.sort(), ['empresas', 'locales'],
    'ambos setters deben devolver el estado previo para cortar el bucle');
  console.log('P03_SIN_BUCLE_SI_NO_CAMBIA=PASS');
}

{
  const estado = { empresas: [{ id: 'emp1' }], locales: [{ id: 'loc1' }] };
  const { aplicados } = ejecutarManejador({}, estado);
  assert.equal(aplicados.empresas, null, 'un anuncio sin datos no debe tocar el estado');
  assert.equal(aplicados.locales, null, 'un anuncio sin datos no debe tocar el estado');
  const noArray = ejecutarManejador({ empresas: 'x', locales: 7 }, estado);
  assert.equal(noArray.aplicados.empresas, null, 'un anuncio mal formado no debe tocar el estado');
  assert.equal(noArray.aplicados.locales, null, 'un anuncio mal formado no debe tocar el estado');
  console.log('P03_ANUNCIO_MAL_FORMADO_IGNORADO=PASS');
}

console.log('PM29_P03_ADOPCION_CONTEXTO=PASS');
