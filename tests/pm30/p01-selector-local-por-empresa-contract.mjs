import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM30 P01: "Con varias empresas se puede cambiar de empresa desde la pantalla
// principal."
//
// El selector de la pantalla principal se alimentaba de `localesEmpresaActiva`,
// es decir, solo de los locales de la empresa en la que ya estabas. Y la
// empresa no se elige en ningun sitio: se deduce del local activo. Resultado:
// con dos empresas era imposible llegar a la segunda desde la pantalla
// principal; habia que ir a Locales y pulsar "Usar este".

const src = fs.readFileSync('fuente.js', 'utf8');
const ini = src.indexOf('function SelectorLocalInformes({');
assert.ok(ini >= 0, 'SelectorLocalInformes no encontrada');
const fin = src.indexOf('\nfunction ', ini + 10);
assert.ok(fin > ini, 'no se pudo acotar SelectorLocalInformes');
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

const empresasDos = [
  { id: 'emp1', razonSocial: 'Chocolateria San Gines', activo: true },
  { id: 'emp2', razonSocial: 'Prueba', activo: true },
];
const localesDos = [
  { id: 'loc1', empresaId: 'emp1', nombre: 'Chocoloyos S.L', activo: true },
  { id: 'loc2', empresaId: 'emp2', nombre: 'Prueba 1', activo: true },
  { id: 'loc3', empresaId: 'emp2', nombre: 'Prueba 2', activo: true },
];

// ---- 1. Con varias empresas, los locales salen agrupados por empresa y
//         estan TODOS, no solo los de la empresa en uso. ----
{
  const nodos = aplanar(render({ locales: localesDos, empresas: empresasDos, valor: 'loc1', onChange: () => {} }));
  const grupos = nodos.filter((n) => n.type === 'optgroup');
  assert.deepEqual(grupos.map((g) => g.props.label), ['Chocolateria San Gines', 'Prueba'],
    'debe haber un grupo por empresa, con su nombre');

  const opciones = nodos.filter((n) => n.type === 'option').map((o) => o.children[0]);
  for (const nombre of ['Chocoloyos S.L', 'Prueba 1', 'Prueba 2']) {
    assert.ok(opciones.includes(nombre), `falta ${nombre}: el selector debe ofrecer los locales de TODAS las empresas`);
  }
  console.log('P01_AGRUPADO_Y_COMPLETO=PASS');
}

// ---- 2. Estando en una empresa se puede elegir un local de la otra: es la
//         unica via para cambiar de empresa desde la pantalla principal. ----
{
  const nodos = aplanar(render({ locales: localesDos, empresas: empresasDos, valor: 'loc1', onChange: () => {} }));
  const grupoOtra = nodos.find((n) => n.type === 'optgroup' && n.props.label === 'Prueba');
  const suyos = aplanar(grupoOtra.children).filter((n) => n.type === 'option').map((o) => o.props.value);
  assert.deepEqual(suyos, ['loc2', 'loc3'],
    'los locales de la otra empresa deben poder seleccionarse');
  console.log('P01_SE_PUEDE_SALTAR_DE_EMPRESA=PASS');
}

// ---- 3. Con varias empresas se dice en cual estas. ----
{
  const nodos = aplanar(render({ locales: localesDos, empresas: empresasDos, valor: 'loc2', onChange: () => {} }));
  assert.ok(nodos.some((n) => n.texto && n.texto.includes('Prueba 1') && n.texto.includes('Prueba')),
    'el texto debe nombrar el local y su empresa');
  console.log('P01_DICE_LA_EMPRESA=PASS');
}

// ---- 4. Con una sola empresa nada cambia: lista plana, sin grupos. ----
{
  const nodos = aplanar(render({
    locales: [
      { id: 'loc1', empresaId: 'emp1', nombre: 'Chocoloyos S.L', activo: true },
      { id: 'loc2', empresaId: 'emp1', nombre: 'Segundo local', activo: true },
    ],
    empresas: [empresasDos[0]],
    valor: 'loc1',
    onChange: () => {},
  }));
  assert.equal(nodos.filter((n) => n.type === 'optgroup').length, 0,
    'con una sola empresa no debe agruparse nada');
  const opciones = nodos.filter((n) => n.type === 'option').map((o) => o.children[0]);
  assert.deepEqual(opciones, ['Todos los locales', 'Chocoloyos S.L', 'Segundo local'],
    'con una sola empresa la lista debe quedar como estaba');
  assert.ok(nodos.some((n) => n.texto === 'Mostrando solo Chocoloyos S.L.'),
    'con una sola empresa el texto no debe mencionar empresa alguna');
  console.log('P01_UNA_EMPRESA_SIN_CAMBIOS=PASS');
}

// ---- 5. Los locales dados de baja o fusionados no se ofrecen. ----
{
  const nodos = aplanar(render({
    locales: [
      ...localesDos,
      { id: 'loc4', empresaId: 'emp2', nombre: 'De baja', activo: false },
      { id: 'loc5', empresaId: 'emp2', nombre: 'Fusionado', activo: true, fusionadoEn: 'loc2' },
    ],
    empresas: empresasDos,
    valor: 'loc1',
    onChange: () => {},
  }));
  const opciones = nodos.filter((n) => n.type === 'option').map((o) => o.children[0]);
  assert.ok(!opciones.includes('De baja'), 'un local desactivado no debe ofrecerse');
  assert.ok(!opciones.includes('Fusionado'), 'un local fusionado no debe ofrecerse');
  console.log('P01_SOLO_LOCALES_VIGENTES=PASS');
}

// ---- 6. El cableado: el selector recibe todos los locales, y Traspasos
//         sigue recibiendo solo los de la empresa en uso. Un traspaso no
//         puede cruzar empresas, asi que esa diferencia es deliberada. ----
{
  const usos = src.split('SelectorLocalInformes, {').slice(1);
  assert.equal(usos.length, 2, 'se esperaban dos usos del selector');
  for (const u of usos) {
    const props = u.slice(0, u.indexOf('}'));
    assert.ok(/(^|[{,\s])locales,/.test(props),
      'el selector debe recibir todos los locales, no los de una sola empresa');
    assert.ok(props.includes('empresas'), 'el selector necesita las empresas para agrupar');
    assert.ok(!props.includes('localesEmpresaActiva'),
      'el selector no debe volver a limitarse a la empresa en uso');
  }
  assert.ok(src.includes('createElement(Traspasos, {') && /Traspasos, \{[^}]*locales: localesEmpresaActiva/.test(src),
    'Traspasos debe seguir limitado a los locales de la empresa en uso');
  console.log('P01_CABLEADO_Y_TRASPASOS_INTACTO=PASS');
}

console.log('PM30_P01_SELECTOR_LOCAL_POR_EMPRESA=PASS');
