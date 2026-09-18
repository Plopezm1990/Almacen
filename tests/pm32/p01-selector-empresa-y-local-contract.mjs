import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM32 P01: "En la pantalla principal se elige empresa y, dentro de ella, local."
//
// La empresa no se elegia en ningun sitio: se deducia del local en uso. Con dos
// empresas no habia forma de pasar de una a otra desde la pantalla principal.
// PM30 lo apaño listando todos los locales agrupados por empresa; esto lo
// sustituye por lo que de verdad se pedia: un selector de empresa y, debajo,
// el de local ya acotado a ella.
//
// La regla "no se puede desactivar el ultimo local activo de una empresa" es lo
// que sostiene esto: garantiza que toda empresa activa tiene al menos un local,
// asi que elegir empresa siempre aterriza en un local valido.

const src = fs.readFileSync('fuente.js', 'utf8');

// --------------------------------------------------------------------------
// Renderizado del selector
// --------------------------------------------------------------------------
const ini = src.indexOf('function SelectorLocalInformes({');
assert.ok(ini >= 0, 'SelectorLocalInformes no encontrada');
const fin = src.indexOf('\nfunction ', ini + 10);
const fuenteSelector = src.slice(ini, fin);

function render(props) {
  const createElement = (type, propsEl, ...children) => ({
    type: typeof type === 'function' ? type.name || 'anon' : String(type),
    props: propsEl || {},
    children,
  });
  const componente = (nombre) => {
    const f = function () {};
    Object.defineProperty(f, 'name', { value: nombre });
    return f;
  };
  const ctx = {
    import_react4: { default: { createElement } },
    C2: new Proxy({}, { get: (_, k) => `C2.${String(k)}` }),
    Card: componente('Card'),
    Field: componente('Field'),
    PROPS: props,
  };
  vm.createContext(ctx);
  vm.runInContext(fuenteSelector + '\nSALIDA = SelectorLocalInformes(PROPS);', ctx);
  return ctx.SALIDA;
}

function aplanar(nodo, salida = []) {
  if (nodo === null || nodo === undefined || typeof nodo === 'boolean') return salida;
  if (Array.isArray(nodo)) { nodo.forEach((n) => aplanar(n, salida)); return salida; }
  if (typeof nodo === 'string' || typeof nodo === 'number') { salida.push({ texto: String(nodo) }); return salida; }
  if (nodo.type) { salida.push(nodo); aplanar(nodo.children, salida); return salida; }
  return salida;
}

const campos = (nodos) => nodos.filter((n) => n.type === 'Field');
const selects = (nodos) => nodos.filter((n) => n.type === 'select');

const empresasDos = [
  { id: 'emp1', razonSocial: 'Chocolateria San Gines', activo: true },
  { id: 'emp2', razonSocial: 'Comercio', activo: true },
];

// ---- 1. Con varias empresas hay selector de empresa, y el de local ya viene
//         acotado por quien lo usa. ----
{
  const nodos = aplanar(render({
    empresas: empresasDos,
    empresaActivaId: 'emp2',
    onCambiarEmpresa: () => {},
    locales: [
      { id: 'loc2', empresaId: 'emp2', nombre: 'Centro', activo: true },
      { id: 'loc3', empresaId: 'emp2', nombre: 'Norte', activo: true },
    ],
    valor: '',
    onChange: () => {},
  }));

  const etiquetas = campos(nodos).map((f) => f.props.label);
  assert.deepEqual(etiquetas, ['Empresa', 'Local'],
    'primero se elige empresa y despues local, en ese orden');

  const [selEmpresa, selLocal] = selects(nodos);
  assert.equal(selEmpresa.props.value, 'emp2', 'el selector debe marcar la empresa en uso');
  const opcionesEmpresa = aplanar(selEmpresa.children).filter((n) => n.type === 'option').map((o) => o.children[0]);
  assert.deepEqual(opcionesEmpresa, ['Chocolateria San Gines', 'Comercio'], 'deben ofrecerse las empresas activas');

  const opcionesLocal = aplanar(selLocal.children).filter((n) => n.type === 'option').map((o) => o.children[0]);
  assert.deepEqual(opcionesLocal, ['Todos los locales de esta empresa', 'Centro', 'Norte'],
    'el consolidado debe decir que es de esta empresa, no de todo');
  console.log('P01_EMPRESA_Y_LUEGO_LOCAL=PASS');
}

// ---- 2. Cambiar de empresa avisa a quien sabe mover el contexto. ----
{
  const elegidas = [];
  const nodos = aplanar(render({
    empresas: empresasDos,
    empresaActivaId: 'emp1',
    onCambiarEmpresa: (id) => elegidas.push(id),
    locales: [{ id: 'loc1', empresaId: 'emp1', nombre: 'Chocoloyos S.L', activo: true }],
    valor: '',
    onChange: () => {},
  }));
  const [selEmpresa] = selects(nodos);
  selEmpresa.props.onChange({ target: { value: 'emp2' } });
  assert.deepEqual(elegidas, ['emp2'], 'elegir empresa debe propagarse');
  console.log('P01_CAMBIO_DE_EMPRESA_SE_PROPAGA=PASS');
}

// ---- 3. Una empresa desactivada no se ofrece. ----
{
  const nodos = aplanar(render({
    empresas: [...empresasDos, { id: 'emp3', razonSocial: 'De baja', activo: false }],
    empresaActivaId: 'emp1',
    onCambiarEmpresa: () => {},
    locales: [{ id: 'loc1', empresaId: 'emp1', nombre: 'Chocoloyos S.L', activo: true }],
    valor: '',
    onChange: () => {},
  }));
  const [selEmpresa] = selects(nodos);
  const opciones = aplanar(selEmpresa.children).filter((n) => n.type === 'option').map((o) => o.children[0]);
  assert.ok(!opciones.includes('De baja'), 'una empresa dada de baja no debe poder elegirse');
  console.log('P01_EMPRESA_DE_BAJA_NO_SE_OFRECE=PASS');
}

// ---- 4. Con una sola empresa la pantalla queda como estaba. ----
{
  const nodos = aplanar(render({
    empresas: [empresasDos[0]],
    empresaActivaId: 'emp1',
    onCambiarEmpresa: () => {},
    locales: [
      { id: 'loc1', empresaId: 'emp1', nombre: 'Chocoloyos S.L', activo: true },
      { id: 'loc9', empresaId: 'emp1', nombre: 'De baja', activo: false },
      { id: 'loc8', empresaId: 'emp1', nombre: 'Fusionado', activo: true, fusionadoEn: 'loc1' },
    ],
    valor: 'loc1',
    onChange: () => {},
  }));
  assert.deepEqual(campos(nodos).map((f) => f.props.label), ['Local'],
    'con una sola empresa no debe aparecer el selector de empresa');
  const opciones = aplanar(selects(nodos)[0].children).filter((n) => n.type === 'option').map((o) => o.children[0]);
  assert.deepEqual(opciones, ['Todos los locales', 'Chocoloyos S.L'],
    'ni locales de baja ni fusionados, y el texto de siempre');
  assert.ok(aplanar(nodos).some((n) => n.texto === 'Mostrando solo Chocoloyos S.L.'),
    'con una sola empresa el texto no debe nombrar empresa alguna');
  console.log('P01_UNA_EMPRESA_SIN_CAMBIOS=PASS');
}

// ---- 5. Con varias, el texto dice en que empresa estas. ----
{
  const consolidado = aplanar(render({
    empresas: empresasDos, empresaActivaId: 'emp2', onCambiarEmpresa: () => {},
    locales: [{ id: 'loc2', empresaId: 'emp2', nombre: 'Centro', activo: true }],
    valor: '', onChange: () => {},
  }));
  assert.ok(consolidado.some((n) => n.texto === 'Mostrando datos consolidados de Comercio.'),
    'el consolidado debe nombrar la empresa, no dar a entender que es todo');
  const concreto = aplanar(render({
    empresas: empresasDos, empresaActivaId: 'emp2', onCambiarEmpresa: () => {},
    locales: [{ id: 'loc2', empresaId: 'emp2', nombre: 'Centro', activo: true }],
    valor: 'loc2', onChange: () => {},
  }));
  assert.ok(concreto.some((n) => n.texto && n.texto.includes('Centro') && n.texto.includes('Comercio')),
    'con local concreto debe verse el local y su empresa');
  console.log('P01_DICE_LA_EMPRESA=PASS');
}

// --------------------------------------------------------------------------
// 6. Elegir empresa mueve el contexto a un local suyo.
// --------------------------------------------------------------------------
{
  const iniH = src.indexOf('  function seleccionarContextoEmpresaPM32(empresaId) {');
  assert.ok(iniH >= 0, 'no se encontro el manejador de cambio de empresa');
  const finH = src.indexOf('  function cambiarLocalActivoConVista(', iniH);
  assert.ok(finH > iniH, 'no se pudo acotar el manejador');
  const fuenteHandler = src.slice(iniH, finH);

  const ejecutar = (empresaId, locales) => {
    const cambios = [];
    const informes = [];
    const ctx = {
      locales,
      cambiarLocalActivo: (id) => cambios.push(id),
      setLocalInformeId: (v) => informes.push(v),
      String,
      ELEGIDA: empresaId,
    };
    vm.createContext(ctx);
    vm.runInContext(fuenteHandler + '\nseleccionarContextoEmpresaPM32(ELEGIDA);', ctx);
    return { cambios, informes };
  };

  const locales = [
    { id: 'loc1', empresaId: 'emp1', nombre: 'Chocoloyos', activo: true },
    { id: 'locX', empresaId: 'emp2', nombre: 'De baja', activo: false },
    { id: 'locY', empresaId: 'emp2', nombre: 'Fusionado', activo: true, fusionadoEn: 'loc2' },
    { id: 'loc2', empresaId: 'emp2', nombre: 'Centro', activo: true },
  ];

  const r = ejecutar('emp2', locales);
  assert.deepEqual(r.cambios, ['loc2'],
    'debe aterrizar en un local activo y no fusionado de la empresa elegida');
  assert.deepEqual(r.informes, [''],
    'al cambiar de empresa el informe debe pasar a verla entera');

  const sinLocales = ejecutar('emp3', locales);
  assert.deepEqual(sinLocales.cambios, [], 'sin local al que ir, no se toca el contexto');
  console.log('P01_ELEGIR_EMPRESA_MUEVE_EL_CONTEXTO=PASS');
}

// --------------------------------------------------------------------------
// 7. Cableado: el selector recibe los locales de la empresa en uso y con que
//    cambiarla. Traspasos conserva su propia lista, porque un traspaso de
//    stock no puede cruzar empresas.
// --------------------------------------------------------------------------
{
  const usos = src.split('SelectorLocalInformes, {').slice(1);
  assert.equal(usos.length, 2, 'se esperaban dos usos del selector');
  for (const u of usos) {
    const props = u.slice(0, u.indexOf('}'));
    assert.ok(props.includes('locales: localesEmpresaActiva'),
      'el selector debe recibir los locales de la empresa en uso');
    assert.ok(props.includes('empresaActivaId'), 'necesita saber que empresa esta en uso');
    assert.ok(props.includes('onCambiarEmpresa: seleccionarContextoEmpresaPM32'),
      'necesita con que cambiarla');
  }
  assert.ok(/Traspasos, \{[^}]*locales: localesEmpresaActiva/.test(src),
    'Traspasos debe seguir limitado a los locales de la empresa en uso');
  console.log('P01_CABLEADO=PASS');
}

// --------------------------------------------------------------------------
// 8. El local que no se puede desactivar dice por que, en su propia tarjeta.
// --------------------------------------------------------------------------
{
  assert.ok(src.includes('esPropietario && esUltimoActivoDeSuEmpresaPM29(l22)') &&
            src.includes('Es el \\xFAnico local activo de'),
    'cada local bloqueado debe explicar en su tarjeta que es el unico de su empresa');
  console.log('P01_MOTIVO_EN_LA_TARJETA=PASS');
}

console.log('PM32_P01_SELECTOR_EMPRESA_Y_LOCAL=PASS');
