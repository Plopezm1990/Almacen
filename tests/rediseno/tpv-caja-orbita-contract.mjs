// Contrato: modo caja del TPV en Órbita, «doble banda», pantalla fija.
//
// Contexto
// --------
// 25/11/2026: el usuario pidió que el modo caja ocupara toda la pantalla y
// que NO se desplazara nunca; lo que no cupiera debía abrirse con un botón en
// otra pantalla. Tras varias rondas aprobó la propuesta 1 («doble banda»):
// catálogo arriba (buscador, categorías, productos por páginas) y cuenta y
// cobro abajo; funciones secundarias detrás de «···», «Mesas», «Ventas del
// día» y «Terminal», cada una en una capa con «Volver al pedido».
//
// Qué fija este contrato
// ----------------------
// - Es solo composición: los render* de la cuenta se siguen llamando siempre
//   y en el mismo orden; las capas son envoltorios display:contents fuera del
//   modo caja de Órbita, así que el TPV normal no cambia.
// - El estado nuevo es solo visual (qué capa está abierta y cuántas filas de
//   productos caben); la paginación normal sigue en FILAS_REJILLA_TPV.
// - No se rotula F4: el programa no tiene esa tecla (solo F2 y F9).
// - Las capas quedan por debajo de los diálogos del programa (z-index 40 < 50).
// - Todo el CSS del modo caja cuelga de Órbita + caja.

import fs from 'node:fs';
import assert from 'node:assert/strict';

for (const [nombre, ruta] of [
  ['fuente.js', 'fuente.js'],
  ['source-recovery/fuente-recuperado.js', 'source-recovery/fuente-recuperado.js'],
]) {
  const t = fs.readFileSync(ruta, 'utf8');
  const tiene = (x, msg) => assert.ok(t.includes(x), `${nombre}: ${msg}`);

  // 1. Sala: solo cambia de sitio en modo caja + sala + Órbita, y una sola vez por render.
  tiene('const bloqueSalaCaja = modoCajaTpv && modoTPV !== "RAPIDA" && leerDisenoNavegacion() === "orbita" ? renderSalaA07() : null;', 'condición del bloque de sala');
  tiene('bloqueSalaCaja ? capaCaja("mesas", "Sala y mesas", bloqueSalaCaja) : null,', 'la sala va en la capa «Mesas»');
  assert.equal((t.match(/renderSalaA07\(\)/g) || []).length, 3, `${nombre}: renderSalaA07 se define una vez y se llama en dos sitios excluyentes`);

  // 2. Los render* de la cuenta siguen en el mismo orden, ahora dentro de capas.
  tiene('capaCaja("cuenta", "Cuenta", renderCuentasAparcadasA06(), bloqueSalaCaja ? null : renderSalaA07(), renderRepartoProductosA08(), renderUnirCuentasA08(), renderPedidoOperativoA05(), renderDescuentoCuentaA09()), capaCaja("cobro", "Cobro", renderCobroF4())', 'paneles de la cuenta y cobro en sus capas, mismo orden');
  tiene('capaCaja("modalidad", "Modalidad del pedido", lineasCarrito.length > 0 && renderSelectorModalidadA02())', 'modalidad en su capa');
  tiene('capaCaja("ventas", "Ventas del d\\xEDa", renderHistorialVentas())', 'registro de ventas en su capa');
  tiene('capaCaja("terminal", "Terminal de este navegador", local?.id && configEmpresa?.id', 'terminal en su capa');
  for (const f of ['renderCuentasAparcadasA06', 'renderRepartoProductosA08', 'renderUnirCuentasA08', 'renderPedidoOperativoA05', 'renderDescuentoCuentaA09', 'renderCobroF4', 'renderHistorialVentas', 'renderSalaA07', 'renderSelectorModoTPV']) {
    const ini = t.indexOf(`  function ${f}() {`);
    const fin = t.indexOf('\n  function ', ini + 10);
    assert.ok(ini > 0 && fin > ini, `${nombre}: no se encuentra ${f}`);
    assert.doesNotMatch(t.slice(ini, fin), /use(State|Effect|Ref|Memo|Callback)\(/, `${nombre}: ${f} no debe usar hooks (se envuelve o cambia de sitio)`);
  }

  // 3. El envoltorio de capa no altera nada fuera del modo caja de Órbita.
  tiene('const cajaOrbita = modoCajaTpv && leerDisenoNavegacion() === "orbita";', 'condición del modo caja de Órbita');
  tiene('"data-activa": cajaOrbita ? "1" : void 0, "data-abierta": cajaOrbita && capaCajaOrbita === id ? "1" : void 0', 'la capa solo se activa en caja de Órbita');

  // 4. Estado solo visual; Escape cierra la capa salvo que haya un diálogo abierto.
  tiene('const [capaCajaOrbita, setCapaCajaOrbita] = (0, import_react4.useState)(null);', 'estado de capa');
  tiene('if (evento.key !== "Escape" || document.querySelector(".la-ui-modal-backdrop")) return;', 'Escape respeta los diálogos');

  // 5. Productos por página según el alto real, solo en modo caja de Órbita.
  tiene('var FILAS_REJILLA_TPV = 4;', 'la paginación normal no cambia');
  tiene('const porPaginaRejilla = Math.max(1, columnasRejilla * (modoCajaTpv && filasRejillaCaja ? filasRejillaCaja : FILAS_REJILLA_TPV));', 'filas según el alto solo en caja');
  tiene('if (!modoCajaTpv || leerDisenoNavegacion() !== "orbita" || !el || typeof ResizeObserver !== "function") {', 'la medición solo en caja de Órbita');
  tiene('ref: refRejillaTpv, style: filasRejillaCaja ? { "--tpv-filas": filasRejillaCaja } : void 0', 'la rejilla recibe las filas');

  // 6. Cobrar: botón nuevo que solo abre la capa de cobro existente; sin F4.
  tiene('cajaOrbita && lineasCarrito.length === 0 ? import_react4.default.createElement("button", { type: "button", className: "tpv-caja-cobrar", onClick: () => setCapaCajaOrbita("cobro") }, "Cobrar") : null', 'Cobrar abre la capa de cobro');
  assert.doesNotMatch(t, /tpv-caja-cobrar[^\n]{0,200}F4/, `${nombre}: no se rotula F4, el programa no tiene esa tecla`);

  // 7. El botón del modo caja no cambia.
  tiene('onClick: () => setModoCajaTpv(!modoCajaTpv) }, modoCajaTpv ? "Salir del modo caja" : "Modo caja")', 'botón del modo caja');
}

const css = fs.readFileSync('la-apariencia.css', 'utf8');
const S = 'html[data-la-diseno="orbita"][data-tpv-caja="1"]';
const O = `${S} #root`;
const hay = (x, msg) => assert.ok(css.includes(x), msg);
hay('.tpv-capa { display: contents; }', 'fuera del modo caja la capa no altera el diseño');
hay(`${S} :is(.la-orbita-sidebar, .la-orbita-pestanas, .la-orbita-bottom-nav, .tpv-dock) { display: none !important; }`, 'pantalla completa');
hay(`${O} main.la-orbita-main { height: 100dvh; max-height: 100dvh !important; overflow: hidden !important;`, 'la pantalla no se desplaza');
hay(`grid-template-rows: repeat(var(--tpv-filas, 2), minmax(0, 1fr));`, 'filas de productos según el alto');
hay(`grid-template-areas: "cab total" "aviso total" "lineas accion";`, 'banda de cuenta y cobro');
// Comprobado en vivo el 25/11/2026: sin «align-items: stretch» la zona de
// productos no llenaba su fila (la rejilla del TPV trae align-items:start) y
// quedaba un hueco de ~170 px sobre la cuenta.
hay('grid-template-rows: minmax(0, 1fr) auto; gap: 10px; align-items: stretch;', 'el catálogo llena su fila, sin hueco');
// En móvil la cabecera es una barra deslizable (la barra, no la página).
hay(`${O} .tpv-cabecera { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: thin; }`, 'cabecera de una fila en móvil');
hay(`${O} .tpv-capa[data-activa="1"] { display: none; }`, 'capas cerradas en caja');
assert.match(css, /\.tpv-capa\[data-abierta="1"\] \{\n  display: flex; flex-direction: column; gap: 12px; position: fixed; inset: 0; z-index: 40;/, 'capa abierta a pantalla completa, por debajo de los diálogos (z-50)');
hay('.tpv-side > .tpv-capa > *:not(.tpv-capa-cabecera) {', 'las tarjetas dentro de una capa conservan su estilo fuera del modo caja');
const ini = css.indexOf('/* Modo caja de Órbita, «doble banda»');
const bloque = css.slice(ini, css.indexOf('.la-orbita-sidebar {', ini));
for (const linea of bloque.split('\n')) {
  if (/^\s*html\[/.test(linea)) assert.ok(linea.trim().startsWith(S), `regla fuera de Órbita + caja: ${linea.trim().slice(0, 80)}`);
}

console.log('REDISENO_TPV_CAJA_ORBITA=OK');
