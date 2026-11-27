/**
 * Contrato de la Ola 3 de la corrección del TPV (modo caja, solo presentación):
 * H-01, H-02, H-03, H-08, H-09, H-10, H-11, H-12 y H-13 de la auditoría del 25-26/11/2026.
 *
 *   node tests/rediseno/ola3-modo-caja-contract.mjs
 *   OLA3_FUENTE=/ruta/otra/fuente.js node tests/rediseno/ola3-...   (para comprobar que el código anterior falla)
 *
 * Se ejecuta el código REAL de las ayudas puras (se extraen de fuente.js) y se fija por texto lo que no se puede ejecutar sin
 * navegador (el estilo calculado, el foco y las medidas se comprobaron en el navegador; ver CORRECCION_OLA3_MODO_CAJA).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const src = await readFile(process.env.OLA3_FUENTE || path.join(raiz, 'fuente.js'), 'utf8');
const espejo = await readFile(path.join(raiz, 'source-recovery/fuente-recuperado.js'), 'utf8');
const css = await readFile(path.join(raiz, 'la-apariencia.css'), 'utf8');

let fallos = 0;
function check(nombre, ok, detalle = '') {
  if (!ok) fallos++;
  console.log(`${ok ? '[OK]  ' : '[FAIL]'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}
function extraeFuncion(nombre) {
  const m = src.match(new RegExp(`function ${nombre}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n`));
  return m ? m[0] : null;
}
// contraste WCAG entre dos colores #rrggbb
const luz = (hex) => {
  const c = (i) => { const v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * c(1) + 0.7152 * c(3) + 0.0722 * c(5);
};
const contraste = (a, b) => { const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// ---------- A: ayudas puras ----------
const fTexto = extraeFuncion('textoLegibleSobreFondoTpv');
check('A0 existe textoLegibleSobreFondoTpv', !!fTexto);
if (fTexto) {
  const textoLegible = new Function(`${fTexto}\nreturn textoLegibleSobreFondoTpv;`)();
  const paleta = src.match(/var COLOR_CLAVE_CATEGORIA_TPV = \{([^}]+)\}/);
  const colores = paleta ? [...paleta[1].matchAll(/#[0-9A-Fa-f]{6}/g)].map((m) => m[0]) : [];
  check('A1 se leyó la paleta de categorías', colores.length === 9, `${colores.length} colores`);
  const peor = colores.map((c) => contraste(c, textoLegible(c))).sort((a, b) => a - b)[0];
  check('A2 todos los colores de categoría dan texto con contraste ≥ 4,5:1', colores.length > 0 && peor >= 4.5, `peor ${peor?.toFixed(2)}:1`);
  const sobreNaranja = textoLegible('#FF4B32');
  check('A3 sobre el naranja #FF4B32 (antes blanco, 3,33:1) el texto es oscuro y pasa 4,5:1', sobreNaranja !== '#FFFFFF' && contraste('#FF4B32', sobreNaranja) >= 4.5, `${sobreNaranja} · ${contraste('#FF4B32', sobreNaranja).toFixed(2)}:1`);
  check('A4 sobre un fondo oscuro el texto es blanco', textoLegible('#15803D') === '#FFFFFF');
  check('A5 «Todos» (variable del tema) usa el color de texto del tema, no blanco', /var\(--c-on-accent/.test(textoLegible('var(--c-accent-fill)')));
}

const fPaginas = extraeFuncion('paginasCategoriasTpv');
check('A6 existe paginasCategoriasTpv', !!fPaginas);
if (fPaginas) {
  const paginas = new Function(`${fPaginas}\nreturn paginasCategoriasTpv;`)();
  check('A7 sin categorías no hay páginas', JSON.stringify(paginas([], 300)) === '[]');
  check('A8 si todas caben hay una sola página', JSON.stringify(paginas([80, 90, 100], 300)) === '[0]');
  check('A9 si no caben se parten sin dejar huecos ni páginas vacías', JSON.stringify(paginas([120, 120, 120, 120, 120], 300)) === '[0,2,4]', JSON.stringify(paginas([120, 120, 120, 120, 120], 300)));
  check('A10 una categoría más ancha que la fila ocupa una página para ella', JSON.stringify(paginas([100, 500, 100], 300)) === '[0,1,2]');
  const muchas = Array.from({ length: 25 }, (_, i) => 60 + (i % 5) * 20);
  const inicios = paginas(muchas, 400);
  const cubre = inicios[0] === 0 && inicios.every((v, i) => i === 0 || v > inicios[i - 1]);
  const sumas = inicios.map((v, i) => muchas.slice(v, inicios[i + 1] ?? muchas.length).reduce((a, b) => a + b, 0));
  check('A11 ninguna página supera el ancho disponible (salvo una categoría sola) y todas se alcanzan', cubre && sumas.every((s, i) => s <= 400 || (inicios[i + 1] ?? muchas.length) - inicios[i] === 1), `${inicios.length} páginas`);
}

const fCuenta = extraeFuncion('cuentaConSaldoParaCobrarTpv');
check('A12 existe cuentaConSaldoParaCobrarTpv', !!fCuenta);
if (fCuenta) {
  const cobrable = src.match(/var ESTADOS_PEDIDO_COBRABLE_F4 = (\[[^\]]+\]);/)?.[1];
  const cuentaConSaldo = new Function(`const ESTADOS_PEDIDO_COBRABLE_F4 = ${cobrable};\n${fCuenta}\nreturn cuentaConSaldoParaCobrarTpv;`)();
  const pedido = { cuentaId: 'c1', pedidoEstado: 'ENVIADO', lineas: [{ total: 10 }, { total: 5 }] };
  check('A13 sin cuenta: ninguna acción principal', cuentaConSaldo(null, null) === false && cuentaConSaldo({}, null) === false);
  check('A14 cuenta enviada con saldo: «Cobrar» es la principal', cuentaConSaldo(pedido, null) === true);
  check('A15 pedido sin enviar (ABIERTO): no se puede cobrar todavía', cuentaConSaldo({ ...pedido, pedidoEstado: 'ABIERTO' }, null) === false);
  check('A16 cuenta cerrada en el servidor: no hay nada que cobrar', cuentaConSaldo(pedido, { cuentaEstado: 'CERRADA' }) === false && cuentaConSaldo({ ...pedido, pedidoEstado: 'CANCELADO' }, null) === false);
  check('A17 con cobro iniciado manda el saldo del servidor', cuentaConSaldo(pedido, { checkouts: [{}], saldo: 0 }) === false && cuentaConSaldo(pedido, { checkouts: [{}], saldo: 3.5 }) === true);
  check('A18 sin cobro iniciado se descuenta lo confirmado', cuentaConSaldo(pedido, { confirmado: 15 }) === false && cuentaConSaldo(pedido, { confirmado: 4 }) === true);
}

// ---------- B: el código de la pantalla (fuente.js y su espejo) ----------
for (const [nombre, t] of [['fuente.js', src], ['source-recovery/fuente-recuperado.js', espejo]]) {
  const tiene = (id, x) => check(`${id} [${nombre}]`, t.includes(x));
  // H-03
  tiene('B1 la capa abierta es un diálogo (role, aria-modal, nombre)', 'role: cajaOrbita && capaCajaOrbita === id ? "dialog" : void 0, "aria-modal": cajaOrbita && capaCajaOrbita === id ? "true" : void 0, "aria-labelledby": cajaOrbita && capaCajaOrbita === id ? "tpv-capa-titulo-" + id : void 0');
  tiene('B2 el título de la capa lleva el id al que apunta aria-labelledby', 'import_react4.default.createElement("strong", { id: "tpv-capa-titulo-" + id }, titulo)');
  tiene('B3 el foco entra en «Volver al pedido» al abrir la capa', 'capaAbierta()?.querySelector(".tpv-capa-volver")?.focus();');
  tiene('B4 Tab queda dentro de la capa (salvo si hay un diálogo del programa encima)', 'if (evento.key !== "Tab" || document.querySelector(".la-ui-modal-backdrop")) return;');
  tiene('B5 al cerrar, el foco vuelve al botón de origen (o al buscador)', 'const destino = origen && origen !== document.body && document.contains(origen) ? origen : document.querySelector("[data-tpv-buscar] input");');
  tiene('B6 F2 no enfoca el buscador con una capa abierta', 'evento.preventDefault();\n        if (capaCajaOrbita) return;\n        inputEscaneoRef.current?.focus();');
  tiene('B7 F9 no guarda con una capa abierta', 'if (capaCajaOrbita) return;\n        if (lineasCarrito.length > 0 && !enviandoVenta && !cargandoA04) confirmarCobro();');
  tiene('B8 el escaneo (Intro en el buscador) se ignora con una capa abierta', 'function manejarEnterEscaneo(e2) {\n    if (e2.key !== "Enter") return;\n    if (capaCajaOrbita) return;');
  tiene('B9 los atajos se vuelven a enlazar al cambiar la capa', '}, [lineasCarrito.length, enviandoVenta, cargandoA04, confirmarCobro, capaCajaOrbita]);');
  // H-13 / H-10
  tiene('B10 el botón de tema no se muestra en el modo caja de Órbita', 'typeof setTemaOscuro === "function" && !cajaOrbita ?');
  tiene('B11 «Salir del modo caja» lleva su clase (fija a la vista en móvil)', 'claseExtra: modoCajaTpv ? "tpv-caja-salir" : void 0, onClick: () => setModoCajaTpv(!modoCajaTpv) }, modoCajaTpv ? "Salir del modo caja" : "Modo caja")');
  tiene('B12 Btn admite una clase extra', 'ariaLabel, claseExtra }) {');
  tiene('B13 Btn la añade a su clase', '${claseExtra ? " " + claseExtra : ""}`');
  // H-12 / H-01
  tiene('B14 «Cobrar» solo es principal con una cuenta con saldo', 'const cobroPrincipalCaja = !!(cajaOrbita && lineasCarrito.length === 0 && cuentaConSaldoParaCobrarTpv(pedidoOperativoA05, estadoCobroF4));');
  tiene('B15 «Guardar pedido» es la principal con líneas', 'disabled: enviandoVenta || cargandoA04, claseExtra: cajaOrbita ? "tpv-caja-principal" : void 0 }, enviandoVenta ? "Guardando pedido');
  // H-08
  tiene('B16 la categoría activa usa el texto legible sobre su color', 'color: categoria === c22 ? textoLegibleSobreFondoTpv(colorCategoriaTpv(c22, colorPorCategoriaTpv)) : C2.inkSoft,');
  check(`B17 ya no queda texto blanco fijo en la categoría activa [${nombre}]`, !t.includes('color: categoria === c22 ? "#fff" : C2.inkSoft,'));
  // H-09
  tiene('B18 la lista de categorías no se desplaza en el modo caja (se pagina)', 'className: cajaOrbita ? "tpv-cat-lista flex gap-2 flex-1 min-w-0" : "flex gap-2 overflow-x-auto flex-1 min-w-0"');
  tiene('B19 las categorías de otra página se ocultan (no quedan enfocables)', 'visibility: cajaOrbita && (i22 < inicioPaginaCategorias || i22 >= finPaginaCategorias) ? "hidden" : void 0,');
  tiene('B20 hay flechas anterior y siguiente con nombre accesible', '"aria-label": sentido < 0 ? "Categor\\u00edas anteriores" : "Categor\\u00edas siguientes"');
  tiene('B21 las flechas rodean la lista de categorías', 'flechaCategoriasCaja(-1), /* @__PURE__ */ import_react4.default.createElement("div", { ref: refCategoriasTpv');
  tiene('B22 la segunda flecha va tras la lista', '))), flechaCategoriasCaja(1), presentacionCategorias.puedeConfigurar');
  tiene('B23 las páginas se miden con el ancho real de cada categoría', 'paginasCategoriasTpv(Array.from(lista.children).map((boton) => boton.offsetWidth + hueco), lista.clientWidth + hueco)');
  // H-11
  tiene('B24 en pantallas de menos de 360 px la fila mínima es de 68 px', 'const minimo = typeof window !== "undefined" && window.innerWidth < 360 ? 68 : 96;');
}
check('B25 el espejo es idéntico a fuente.js en las piezas nuevas', ['function textoLegibleSobreFondoTpv', 'function paginasCategoriasTpv', 'function cuentaConSaldoParaCobrarTpv'].every((f) => extraeFuncion(f.replace('function ', '')) !== null && espejo.includes(extraeFuncion(f.replace('function ', '')))));

// ---------- C: CSS ----------
const S = 'html[data-la-diseno="orbita"][data-tpv-caja="1"]';
const hay = (id, x) => check(id, css.includes(x));
function especificidad(selector) {
  const ids = (selector.match(/#[\w-]+/g) || []).length;
  const clases = (selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length;
  const elementos = (selector.replace(/\[[^\]]*\]/g, '').match(/(^|[\s>+~])[a-z][\w-]*/g) || []).length;
  return [ids, clases, elementos];
}
const mayor = (a, b) => a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2];
const reglaGeneral = 'html[data-la-diseno] #root main[data-la-orbita-module="tpv"] .tpv-side > *';
const reglaPrincipal = `${S} #root main[data-la-orbita-module="tpv"] .tpv-side > .tpv-caja-principal`;
check('C0 la regla general del TPV de Órbita que pinta la superficie sigue existiendo', css.includes(`${reglaGeneral},`) || css.includes(`${reglaGeneral} {`));
check('C1 la regla de la acción principal tiene más especificidad que la general', mayor(especificidad(reglaPrincipal), especificidad(reglaGeneral)), `${especificidad(reglaPrincipal)} frente a ${especificidad(reglaGeneral)}`);
hay('C2 la principal es naranja con el texto del tema (contraste), sin borde', `${reglaPrincipal} { border: 0 !important; background: var(--c-accent-fill, #FF4B32) !important; color: var(--c-on-accent, #17191C) !important; cursor: pointer; }`);
check('C3 «Cobrar» sin saldo queda neutro (superficie, no naranja)', css.includes(`${S} #root .tpv-caja-cobrar { border: 1px solid var(--c-line, #343941) !important; background: var(--c-surface, #202328) !important;`));
check('C4 la altura de la acción es de 64 px (56 en móvil) y no la pisa la regla de controles de 44 px', /min-height: 64px !important; justify-content: center;/.test(css) && css.includes('.tpv-caja-cobrar) { min-height: 56px !important; }'));
hay('C5 el aviso de sincronización se pega abajo a la derecha en modo caja', `${S} #estado-guardado { top: auto !important; bottom: 6px !important; right: 12px !important; }`);
hay('C6 la pantalla reserva su franja mientras el aviso está visible', `${S}:has(#estado-guardado:not([style*="display: none"])) #root main.la-orbita-main { padding-bottom: 40px !important; }`);
hay('C7 las capas abiertas también la reservan', `${S}:has(#estado-guardado:not([style*="display: none"])) #root .tpv-capa[data-abierta="1"] { padding-bottom: 48px; }`);
hay('C8 la fila de categorías no tiene barra de desplazamiento', `${S} #root .tpv-cat-lista { overflow: hidden; scrollbar-width: none; }`);
check('C9 las flechas de categorías son de 44 × 44 px', /\.tpv-cat-flecha \{[^}]*width: 44px; min-width: 44px; height: 44px; min-height: 44px;/.test(css));
check('C10 en móvil «Salir del modo caja» va el primero de la barra y la barra avisa con sombras de que se desliza', css.includes(`${S} #root .tpv-cabecera > button.tpv-caja-salir.la-ui-button { order: 0; }`) && /\.tpv-cabecera \{\s*background:\s*linear-gradient\(to right[^;]*no-repeat local,[^;]*local,[^;]*radial-gradient[^;]*scroll,[^;]*radial-gradient[^;]*scroll;/.test(css));
check('C11 por debajo de 360 px la banda y las tarjetas son compactas', /@media \(max-width: 359px\) \{[\s\S]*--tpv-caja-banda: clamp\(168px, 26dvh, 240px\);[\s\S]*padding: 6px 8px !important;/.test(css));
// todo el CSS del modo caja sigue colgando de Órbita + caja (misma regla que tpv-caja-orbita-contract)
const ini = css.indexOf('/* Modo caja de Órbita, «doble banda»');
const bloque = css.slice(ini, css.indexOf('.la-orbita-sidebar {', ini));
const fuera = bloque.split('\n').filter((l) => /^\s*html\[/.test(l) && !l.trim().startsWith(S));
check('C12 ninguna regla nueva queda fuera de Órbita + caja', fuera.length === 0, fuera[0]?.trim().slice(0, 80));

console.log(fallos === 0 ? 'OLA3_MODO_CAJA_CONTRACT=PASS' : `OLA3_MODO_CAJA_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
