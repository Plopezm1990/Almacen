import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM29 P01: "Solo el propietario puede desactivar locales, y un rechazo del
// servidor no puede pasar desapercibido."
//
// Contexto real (verificado contra el proyecto de Supabase de produccion):
//   - `guardar_contexto_instalacion_ui` ya exige rol Propietario en el servidor
//     y ya respeta `activo` para locales (borrado logico, nunca borra la fila).
//   - Pero en el cliente el boton "Desactivar" no miraba el rol, y el guardado
//     es optimista: `desactivarLocal` cambia el estado y el guardado ocurre
//     despues en un efecto, con `saveKey` tragandose el error y convirtiendolo
//     en un evento "fallo-guardado" que solo alimentaba un contador.
//     Resultado: un rechazo del servidor dejaba la pantalla diciendo que el
//     local estaba desactivado mientras el servidor seguia diciendo lo contrario.
//
// Este contrato fija las dos garantias del lado cliente.

const src = fs.readFileSync('fuente.js', 'utf8');
const ini = src.indexOf('function Locales({');
assert.ok(ini >= 0, 'Locales no encontrada');
const fin = src.indexOf('\nfunction ', ini + 10);
assert.ok(fin > ini, 'no se pudo acotar Locales');
const fuenteLocales = src.slice(ini, fin);

// --- Renderizador minimo: createElement devuelve un arbol inspeccionable. ---
function construirContexto(estadoInicial) {
  let iUseState = 0;
  const createElement = (type, props, ...children) => ({
    type: typeof type === 'function' ? type.name || 'anon' : String(type),
    props: props || {},
    children,
  });
  const componente = (nombre) => {
    const f = function () {};
    Object.defineProperty(f, 'name', { value: nombre });
    return f;
  };
  const ctx = {
    import_react4: {
      default: {
        createElement,
        useState: (inicial) => {
          const idx = iUseState++;
          const valor = Object.prototype.hasOwnProperty.call(estadoInicial, idx)
            ? estadoInicial[idx]
            : inicial;
          return [valor, () => {}];
        },
        useEffect: () => {},
        Fragment: 'Fragment',
      },
    },
    C2: new Proxy({}, { get: (_, k) => `C2.${String(k)}` }),
    SectionTitle: componente('SectionTitle'),
    Card: componente('Card'),
    Btn: componente('Btn'),
    Field: componente('Field'),
    Input: componente('Input'),
    Modal: componente('Modal'),
    Pill2: componente('Pill2'),
    GestorEmpresas: componente('GestorEmpresas'),
    DiagnosticoSincronizacion: componente('DiagnosticoSincronizacion'),
    DiagnosticoDatosLegadosPM10: componente('DiagnosticoDatosLegadosPM10'),
    FichaDatosLocal: componente('FichaDatosLocal'),
    empresaDestinoParaNuevoLocalPM15: (a, b) => a || b || '',
  };
  vm.createContext(ctx);
  vm.runInContext(fuenteLocales, ctx);
  return ctx;
}

function aplanar(nodo, salida = []) {
  if (nodo === null || nodo === undefined || nodo === false || nodo === true) return salida;
  if (Array.isArray(nodo)) {
    nodo.forEach((n) => aplanar(n, salida));
    return salida;
  }
  if (typeof nodo === 'string' || typeof nodo === 'number') {
    salida.push({ texto: String(nodo) });
    return salida;
  }
  if (typeof nodo === 'object' && nodo.type) {
    salida.push(nodo);
    aplanar(nodo.children, salida);
    return salida;
  }
  return salida;
}

const localesDemo = [
  { id: 'loc1', empresaId: 'emp1', nombre: 'Local Uno', activo: true },
  { id: 'loc2', empresaId: 'emp1', nombre: 'Local Dos', activo: true },
];
const empresasDemo = [{ id: 'emp1', razonSocial: 'Empresa Demo SL', activo: true }];

function render(props, estadoInicial = {}) {
  const ctx = construirContexto(estadoInicial);
  const arbol = ctx.Locales({
    locales: localesDemo,
    localActivoId: 'loc1',
    crearLocal: () => ({ ok: true }),
    actualizarLocal: () => {},
    desactivarLocal: () => {},
    cambiarLocalActivo: () => {},
    configEmpresa: {},
    empresas: empresasDemo,
    setEmpresas: () => {},
    ...props,
  });
  return aplanar(arbol);
}

const contieneTexto = (nodos, txt) => nodos.some((n) => n.texto && n.texto.includes(txt));

// ---- 1. Propietario: el boton de desactivar existe. ----
{
  const nodos = render({ esPropietario: true });
  assert.ok(contieneTexto(nodos, 'Desactivar'), 'el propietario deberia ver "Desactivar"');
  assert.ok(
    !contieneTexto(nodos, 'Solo el propietario puede desactivar locales'),
    'no se debe avisar de falta de permiso a un propietario'
  );
  console.log('P01_PROPIETARIO_VE_DESACTIVAR=PASS');
}

// ---- 2. No propietario: el boton desaparece y se explica por que. ----
{
  const nodos = render({ esPropietario: false });
  assert.ok(
    !contieneTexto(nodos, 'Desactivar'),
    'quien no es propietario no debe ver ningun boton "Desactivar"'
  );
  assert.ok(
    contieneTexto(nodos, 'Solo el propietario puede desactivar locales'),
    'debe explicarse por que no aparece la accion'
  );
  console.log('P01_NO_PROPIETARIO_SIN_DESACTIVAR=PASS');
}

// ---- 3. Por defecto (prop ausente) se conserva el comportamiento previo. ----
{
  const nodos = render({});
  assert.ok(contieneTexto(nodos, 'Desactivar'), 'sin la prop, el comportamiento no debe cambiar');
  console.log('P01_DEFECTO_RETROCOMPATIBLE=PASS');
}

// ---- 4. Un rechazo del servidor posterior al intento se muestra, sin afirmar
//         que el dato se perdio y sin ocultar el mensaje real del servidor. ----
{
  // indice 5 de useState = momentoDesactivarPM29 (ver orden en el componente).
  const momento = '2026-01-01T10:00:00.000Z';
  const nodos = render(
    {
      esPropietario: true,
      fallosGuardado: [
        { id: 'f1', key: 'locales', mensaje: 'Propietario requerido', fecha: '2026-01-01T10:00:05.000Z' },
      ],
    },
    { 5: momento }
  );
  assert.ok(
    contieneTexto(nodos, 'No se ha podido confirmar la desactivaci'),
    'un fallo de guardado de locales debe hacerse visible'
  );
  assert.ok(
    contieneTexto(nodos, 'Propietario requerido'),
    'el mensaje real del servidor debe conservarse'
  );
  assert.ok(
    contieneTexto(nodos, 'Recarga la p'),
    'debe invitarse a comprobar el estado real en vez de afirmar el resultado'
  );
  console.log('P01_FALLO_SERVIDOR_VISIBLE=PASS');
}

// ---- 5. Fallos anteriores al intento, o de otras claves, no se muestran. ----
{
  const momento = '2026-01-01T10:00:00.000Z';
  const previo = render(
    {
      esPropietario: true,
      fallosGuardado: [
        { id: 'f0', key: 'locales', mensaje: 'viejo', fecha: '2026-01-01T09:59:00.000Z' },
      ],
    },
    { 5: momento }
  );
  assert.ok(
    !contieneTexto(previo, 'No se ha podido confirmar la desactivaci'),
    'un fallo anterior al intento no debe atribuirse a esta desactivacion'
  );

  const otraClave = render(
    {
      esPropietario: true,
      fallosGuardado: [
        { id: 'f2', key: 'productos', mensaje: 'otro', fecha: '2026-01-01T10:00:05.000Z' },
      ],
    },
    { 5: momento }
  );
  assert.ok(
    !contieneTexto(otraClave, 'No se ha podido confirmar la desactivaci'),
    'un fallo de otra clave no debe atribuirse a los locales'
  );

  const sinIntento = render({
    esPropietario: true,
    fallosGuardado: [
      { id: 'f3', key: 'locales', mensaje: 'x', fecha: '2026-01-01T10:00:05.000Z' },
    ],
  });
  assert.ok(
    !contieneTexto(sinIntento, 'No se ha podido confirmar la desactivaci'),
    'sin intento de desactivacion no debe aparecer el aviso'
  );
  console.log('P01_FALLOS_NO_RELACIONADOS_IGNORADOS=PASS');
}

console.log('PM29_P01_LOCALES_DESACTIVAR_PROPIETARIO=PASS');
