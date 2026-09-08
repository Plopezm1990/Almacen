import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM15 (NR-08, ampliación acordada con el usuario tras P01): "cualquier formulario a medio
// rellenar se pierde sin aviso al cambiar de pestaña" -- registrado en P01 como pendiente
// explícito, no resuelto. Este punto lo resuelve.
//
// Diseño (cambio mínimo, deliberadamente simple): "borrador abierto" = el formulario está
// visible (showForm/mostrarForm === true), no un análisis campo por campo de si el usuario
// ya escribió algo -- así nunca hay falsos negativos (un formulario abierto siempre está
// protegido). El coste es una confirmación de más si el usuario abre un formulario vacío y
// navega sin escribir nada; se acepta ese coste frente al riesgo de perder datos reales sin
// avisar.
//
// Mecanismo: un ref mutable (formularioAbiertoPM15Ref) que cada componente con formulario
// actualiza vía la prop marcarFormularioAbiertoPM15; toda navegación real de usuario pasa
// por cambiarTabPM15, que antes de cambiar de pestaña pregunta (window.confirm) si hay un
// borrador abierto. La navegación programática interna (redirecciones tras guardar con
// éxito) sigue usando el setTab crudo, sin interrupción.

const src = fs.readFileSync('fuente.js', 'utf8');

// ---- decidirCambioTabPM15: la función pura que decide si se permite cambiar de pestaña. ----
{
  const ini = src.indexOf('function decidirCambioTabPM15(');
  assert.ok(ini >= 0, 'decidirCambioTabPM15 no encontrada');
  const fin = src.indexOf('function GestionAlmacen(', ini);
  assert.ok(fin > ini, 'no se pudo acotar decidirCambioTabPM15');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src.slice(ini, fin), ctx);
  const decidirCambioTabPM15 = ctx.decidirCambioTabPM15;
  assert.equal(typeof decidirCambioTabPM15, 'function');

  // Sin borrador abierto: nunca se pregunta, se permite el cambio directamente.
  let preguntado = false;
  assert.equal(decidirCambioTabPM15(false, () => { preguntado = true; return false; }), true);
  assert.equal(preguntado, false, 'sin borrador abierto, la confirmación nunca debe invocarse');
  console.log('P04_NR08_SIN_BORRADOR_NUNCA_PREGUNTA=PASS');

  // Con borrador abierto y el usuario confirma: se permite.
  assert.equal(decidirCambioTabPM15(true, () => true), true);
  console.log('P04_NR08_CON_BORRADOR_CONFIRMA_PERMITE=PASS');

  // Con borrador abierto y el usuario cancela: se bloquea el cambio.
  assert.equal(decidirCambioTabPM15(true, () => false), false);
  console.log('P04_NR08_CON_BORRADOR_CANCELA_BLOQUEA=PASS');
}

// ---- Los 4 componentes con formulario (Encargos, Clientes, Personal, Locales) reciben la
// prop y reportan su estado real (showForm/mostrarForm), no un valor inventado. ----
{
  const casos = [
    { nombre: 'Encargos', marcador: 'function Encargos({', estado: 'showForm' },
    { nombre: 'Clientes', marcador: 'function Clientes({', estado: 'showForm' },
    { nombre: 'Personal', marcador: 'function Personal({', estado: 'showForm' },
    { nombre: 'Locales', marcador: 'function Locales({', estado: 'mostrarForm' },
  ];
  for (const { nombre, marcador, estado } of casos) {
    const ini = src.indexOf(marcador);
    assert.ok(ini >= 0, `${nombre} no encontrado`);
    const finFirma = src.indexOf(') {', ini);
    assert.match(src.slice(ini, finFirma), /marcarFormularioAbiertoPM15 = \(\) => \{\}/, `${nombre} debe declarar la prop marcarFormularioAbiertoPM15`);
    const finEfecto = src.indexOf('}, [' + estado + ']);', ini);
    assert.ok(finEfecto > ini && finEfecto - ini < 900, `${nombre} debe reportar su propio estado (${estado}), no uno inventado`);
    const cuerpoEfecto = src.slice(ini, finEfecto);
    assert.match(cuerpoEfecto, new RegExp('marcarFormularioAbiertoPM15\\(' + estado + '\\)'), `${nombre} debe pasar ${estado} literal, no una constante fija`);
  }
  console.log('P04_NR08_CUATRO_COMPONENTES_REPORTAN_SU_PROPIO_BORRADOR=PASS');
}

// ---- La composición pasa marcarFormularioAbiertoPM15 real (no un no-op) a los 4. ----
{
  const ini = src.indexOf('tab === "personal" &&');
  const fin = src.indexOf('tab === "devoluciones" &&', ini);
  const bloque = src.slice(ini, fin);
  const apariciones = bloque.split('marcarFormularioAbiertoPM15').length - 1;
  assert.ok(apariciones >= 3, `marcarFormularioAbiertoPM15 debe pasarse a Personal, Encargos y Clientes (encontrado ${apariciones})`);
  const iniLocales = src.indexOf('createElement(Locales, {');
  assert.ok(iniLocales >= 0, 'composición de Locales no encontrada');
  const finLocales = src.indexOf('}));', iniLocales);
  assert.match(src.slice(iniLocales, finLocales), /marcarFormularioAbiertoPM15/, 'Locales debe recibir marcarFormularioAbiertoPM15');
  console.log('P04_NR08_COMPOSICION_PASA_LA_PROP_REAL=PASS');
}

// ---- Las superficies de navegación real de usuario usan cambiarTabPM15 (protegido), no el
// setTab crudo: barra lateral, barra superior C, navegación inferior móvil, buscador
// global y las tarjetas del dashboard. ----
{
  assert.match(src, /createElement\(TopBarC, \{[^}]*setTab: cambiarTabPM15/, 'TopBarC debe usar cambiarTabPM15');
  assert.match(src, /createElement\(BottomNavC, \{[^}]*setTab: cambiarTabPM15/, 'BottomNavC debe usar cambiarTabPM15');
  assert.match(src, /grupos: disenoMenu === "A" \? gruposA : gruposB,\s*tab,\s*setTab: cambiarTabPM15,/, 'SidebarGrupos debe usar cambiarTabPM15');
  assert.match(src, /createElement\(BusquedaGlobal, \{[^}]*setTab: cambiarTabPM15/, 'BusquedaGlobal debe usar cambiarTabPM15');
  assert.match(src, /sugerenciasPedido: sugerenciasPedidoInforme,\s*setTab: cambiarTabPM15,/, 'Dashboard debe usar cambiarTabPM15');
  console.log('P04_NR08_SUPERFICIES_DE_NAVEGACION_PROTEGIDAS=PASS');
}

// ---- Negativo importante: la navegación programática tras un guardado con éxito (dentro
// de la lógica de negocio, no un clic de usuario) sigue usando el setTab crudo -- no debe
// interrumpirse con una confirmación una acción que el usuario ya completó con éxito. ----
{
  assert.match(src, /setTab,\s*localActivoId,\s*locales,\s*empresaId: empresaDelLocalActivo\?\.id \|\| null,\s*pagosFacturas,/, 'la lógica de negocio de compras debe seguir recibiendo el setTab crudo, no el protegido');
  console.log('P04_NR08_NAVEGACION_TRAS_GUARDAR_NO_SE_INTERRUMPE=PASS');
}

console.log('PM15 (NR-08, ampliación) — borradores protegidos al cambiar de pestaña: contrato OK');
