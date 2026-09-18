import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM29 P02: "Desactivar una empresa es una baja logica, reservada al
// propietario y confirmada con su contrasena real."
//
// Dos mitades, y las dos importan:
//
//   - Servidor: la rama de 'empresas' de guardar_contexto_instalacion_ui
//     descartaba el campo 'activo' y jamas lo escribia en la columna. El
//     cliente podia mandar una baja, el servidor respondia "ok" y la empresa
//     seguia activa; la pantalla mostraba la baja hasta recargar. La migracion
//     20260918120000 lo corrige y anade los frenos.
//   - Cliente: no habia forma de dar de baja una empresa, y la baja de un local
//     no pedia ninguna credencial.

const src = fs.readFileSync('fuente.js', 'utf8');

// =========================== 1. Contrato de la migracion ===========================
{
  const ruta = 'supabase/migrations/20260918120000_pm29_desactivar_empresa_propietario.sql';
  assert.ok(fs.existsSync(ruta), 'falta la migracion PM29');
  const sql = fs.readFileSync(ruta, 'utf8');

  const ini = sql.indexOf("if v_clave = 'empresas' then");
  const fin = sql.indexOf("elsif v_clave = 'locales' then");
  assert.ok(ini > 0 && fin > ini, 'no se pudo acotar la rama de empresas');
  const ramaEmpresas = sql.slice(ini, fin);

  // El fallo original: el update no tocaba 'activo'.
  assert.match(
    ramaEmpresas,
    /update public\.empresas\s+set nombre = v_nombre,\s+activo = v_activo,\s+datos = v_datos/,
    'el update de empresas debe persistir activo'
  );

  // Omitir 'activo' no puede reactivar una empresa dada de baja.
  assert.match(
    ramaEmpresas,
    /else coalesce\(\(select e\.activo from public\.empresas e where e\.id = v_id\), true\)/,
    'omitir activo debe conservar el valor guardado, no forzar true'
  );

  // Los dos frenos pedidos.
  assert.ok(
    /locales l\s+where l\.empresa_id = v_id and l\.activo = true/.test(ramaEmpresas),
    'debe existir el freno de locales activos'
  );
  assert.ok(
    ramaEmpresas.includes('No se puede desactivar la ultima empresa activa'),
    'debe existir el freno de ultima empresa activa'
  );
  assert.ok(
    ramaEmpresas.includes('Una empresa nueva debe crearse activa'),
    'un alta no puede nacer desactivada'
  );

  // El interbloqueo que se detecto ensayando en QA: con el freno del "ultimo
  // local activo" acotado POR EMPRESA, una empresa de un solo local no se podia
  // dar de baja jamas (no se puede dar de baja con locales activos, ni quitarle
  // el ultimo local). El freno pasa a ser por propietario.
  const iniLocales = sql.indexOf("elsif v_clave = 'locales' then");
  const finLocales = sql.indexOf("elsif v_clave = 'localActivoId' then");
  assert.ok(iniLocales > 0 && finLocales > iniLocales, 'no se pudo acotar la rama de locales');
  const ramaLocales = sql.slice(iniLocales, finLocales);

  assert.doesNotMatch(
    ramaLocales,
    /where l\.empresa_id = v_empresa_id and l\.activo = true and l\.id <> v_id/,
    'el freno del ultimo local no puede seguir acotado por empresa: crea un interbloqueo'
  );
  assert.match(
    ramaLocales,
    /join public\.empresas e on e\.id = m\.empresa_id and e\.activo = true\s+join public\.locales l/,
    'el freno del ultimo local debe mirar los locales activos del propietario'
  );

  // Segundo fallo, este detectado ya en produccion: la comprobacion de
  // pertenencia exigia que la empresa del local estuviera activa. Como el
  // cliente manda SIEMPRE la lista completa de locales, en cuanto una empresa
  // se daba de baja su local (ya inactivo) seguia en la lista y tumbaba el
  // lote entero: dejaba de poder guardarse ningun local.
  const pertenencia = ramaLocales.slice(
    ramaLocales.indexOf('Identidad de local'),
    ramaLocales.indexOf('El local pertenece a otra empresa')
  );
  assert.doesNotMatch(
    pertenencia,
    /join public\.empresas e on e\.id = m\.empresa_id and e\.activo = true/,
    'la pertenencia del local no puede exigir que la empresa este activa'
  );
  assert.match(
    pertenencia,
    /if v_activo = true\s+and not exists \(\s+select 1 from public\.empresas e\s+where e\.id = v_empresa_id and e\.activo = true/,
    'la empresa activa solo debe exigirse para tener el local ACTIVO'
  );
  console.log('P02_LOCAL_DE_EMPRESA_BAJA_NO_TUMBA_EL_LOTE=PASS');

  // Lo que NO debe cambiar: sigue sin borrarse ninguna fila y sigue exigiendose
  // Propietario. Una baja logica que borrase la fila destruiria el historico.
  assert.doesNotMatch(sql, /delete\s+from\s+public\.(empresas|locales)/i, 'la baja debe ser logica, nunca un DELETE');
  assert.ok(sql.includes("and p.rol = 'Propietario'"), 'debe conservarse la exigencia de Propietario');
  console.log('P02_MIGRACION_EMPRESAS_ACTIVO=PASS');
}

// =========================== 2. Contrato del cliente ===========================
function acotar(nombreFn) {
  const ini = src.indexOf(`function ${nombreFn}(`);
  assert.ok(ini >= 0, `${nombreFn} no encontrada`);
  const fin = src.indexOf('\nfunction ', ini + 10);
  assert.ok(fin > ini, `no se pudo acotar ${nombreFn}`);
  return src.slice(ini, fin);
}

const fuenteGestor = acotar('GestorEmpresas');
const fuenteConfirmar = acotar('ConfirmarConContrasenaPM29');
const fuenteVerificar = acotar('verificarContrasenaPropietarioPM29');

function construirContexto(estadoInicial = {}) {
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
          const valor = Object.prototype.hasOwnProperty.call(estadoInicial, idx) ? estadoInicial[idx] : inicial;
          return [valor, () => {}];
        },
        useEffect: () => {},
        Fragment: 'Fragment',
      },
    },
    C2: new Proxy({}, { get: (_, k) => `C2.${String(k)}` }),
    Card: componente('Card'),
    Btn: componente('Btn'),
    Field: componente('Field'),
    Input: componente('Input'),
    Modal: componente('Modal'),
    FichaEmpresaBasica: componente('FichaEmpresaBasica'),
    ConfirmarConContrasenaPM29: componente('ConfirmarConContrasenaPM29'),
    estadoIdentidadFiscalPM18: () => 'valido',
    etiquetaEstadoIdentidadFiscalPM18: () => 'ok',
    prepararLogoEmpresa: async () => '',
    uid: () => 'id-nuevo',
  };
  vm.createContext(ctx);
  vm.runInContext(fuenteGestor, ctx);
  return ctx;
}

function aplanar(nodo, salida = []) {
  if (nodo === null || nodo === undefined || typeof nodo === 'boolean') return salida;
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
    Object.values(nodo.props || {}).forEach((v) => {
      if (v && typeof v === 'object' && v.type) aplanar(v, salida);
    });
    aplanar(nodo.children, salida);
    return salida;
  }
  return salida;
}

const dos = [
  { id: 'e1', razonSocial: 'Empresa Uno SL', activo: true },
  { id: 'e2', razonSocial: 'Empresa Dos SL', activo: true },
];
const contieneTexto = (nodos, t) => nodos.some((n) => n.texto && n.texto.includes(t));
const tipos = (nodos) => nodos.map((n) => n.type);
const botonDesactivar = (nodos) =>
  nodos.find((n) => n.type === 'Btn' && (n.children || []).some((c) => c === 'Desactivar')) || null;

function render(empresas, props = {}, estado = {}) {
  const ctx = construirContexto(estado);
  return aplanar(ctx.GestorEmpresas({ empresas, setEmpresas: () => {}, ...props }));
}

// ---- Propietario con 2+ empresas activas: puede dar de baja. ----
{
  const nodos = render(dos, { esPropietario: true });
  assert.ok(contieneTexto(nodos, 'Desactivar'), 'el propietario deberia poder desactivar');
  console.log('P02_PROPIETARIO_VE_DESACTIVAR=PASS');
}

// ---- No propietario: no se ofrece la baja. ----
{
  const nodos = render(dos, { esPropietario: false });
  assert.ok(!contieneTexto(nodos, 'Desactivar'), 'quien no es propietario no debe poder desactivar');
  console.log('P02_NO_PROPIETARIO_SIN_DESACTIVAR=PASS');
}

// ---- Una sola empresa activa: la accion sigue visible pero inutilizable, y se
//      dice por que. Antes se ocultaba el boton, y entonces la pantalla era
//      identica a la de una version sin esta funcion: quien tuviera una sola
//      empresa -- el caso mas comun -- nunca sabria que existe. ----
{
  const nodos = render([dos[0]], { esPropietario: true });
  const btn = botonDesactivar(nodos);
  assert.ok(btn, 'el boton debe seguir siendo visible aunque no se pueda usar');
  assert.equal(btn.props.disabled, true, 'debe estar deshabilitado con una sola empresa activa');
  assert.ok(
    contieneTexto(nodos, 'tiene que haber al menos dos activas'),
    'debe explicarse por que no se puede usar'
  );
  console.log('P02_ULTIMA_EMPRESA_PROTEGIDA=PASS');
}

// ---- Con dos activas, el boton esta realmente utilizable. ----
{
  const btn = botonDesactivar(render(dos, { esPropietario: true }));
  assert.ok(btn, 'con dos empresas activas debe haber boton');
  assert.notEqual(btn.props.disabled, true, 'con dos activas no debe estar deshabilitado');
  console.log('P02_CON_DOS_ACTIVAS_HABILITADO=PASS');
}

// ---- Las desactivadas se listan aparte y no se mezclan con las activas. ----
{
  const nodos = render(
    [dos[0], { id: 'e9', razonSocial: 'Empresa Baja SL', activo: false }],
    { esPropietario: true }
  );
  assert.ok(contieneTexto(nodos, 'Empresas desactivadas'), 'debe haber una seccion para las desactivadas');
  assert.ok(contieneTexto(nodos, 'Empresa Baja SL'), 'la empresa dada de baja debe seguir visible');
  assert.equal(
    botonDesactivar(nodos).props.disabled,
    true,
    'una empresa ya inactiva no cuenta para poder dar de baja la unica activa'
  );
  console.log('P02_INACTIVAS_LISTADAS_APARTE=PASS');
}

// ---- La baja pasa por el dialogo de contrasena, no por un boton directo. ----
{
  // indice 8 de useState = confirmarDesactivarEmpresaPM29 (ver orden en el componente).
  const nodos = render(dos, { esPropietario: true }, { 8: dos[0] });
  assert.ok(
    tipos(nodos).includes('ConfirmarConContrasenaPM29'),
    'la baja debe confirmarse con el dialogo de contrasena'
  );
  console.log('P02_BAJA_PIDE_CONTRASENA=PASS');
}

// ---- El dialogo verifica de verdad: sin contrasena correcta no confirma. ----
{
  assert.match(
    fuenteConfirmar,
    /const r2 = await verificarContrasenaPropietarioPM29\(contrasena\);[\s\S]*?if \(!r2\.ok\) \{[\s\S]*?return;[\s\S]*?\}[\s\S]*?onConfirmar\(\);/,
    'onConfirmar solo puede ejecutarse tras verificar la contrasena'
  );
  assert.match(fuenteVerificar, /signInWithPassword/, 'debe verificarse contra la cuenta real');
  assert.match(
    fuenteVerificar,
    /if \(!correo\) return \{ ok: false/,
    'sin sesion no puede darse por buena la contrasena'
  );
  console.log('P02_VERIFICACION_REAL=PASS');
}

// ---- El local tambien pasa por el mismo dialogo. ----
{
  const fuenteLocales = acotar('Locales');
  assert.match(
    fuenteLocales,
    /confirmarDesactivar && [\s\S]{0,80}createElement\(ConfirmarConContrasenaPM29/,
    'la baja de un local debe pedir la contrasena igual que la de una empresa'
  );
  console.log('P02_LOCAL_TAMBIEN_PIDE_CONTRASENA=PASS');
}

console.log('PM29_P02_EMPRESAS_DESACTIVAR_PROPIETARIO=PASS');
