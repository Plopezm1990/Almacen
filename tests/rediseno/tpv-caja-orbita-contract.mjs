// Contrato: modo caja del TPV en Órbita, a pantalla completa y organizado
// como un TPV profesional.
//
// Contexto
// --------
// 25/11/2026: el usuario pidió que el modo caja ocupara toda la pantalla
// (ordenador, tablet y móvil) y aprobó combinar dos organizaciones: «barra
// rápida» en venta rápida (categorías en columna | productos | ticket) y
// «sala y mesas» en sala (mesas | cuenta | catálogo). Antes, el lateral se
// ocultaba pero su columna se quedaba vacía y seguían la fila de pestañas y
// la barra inferior.
//
// Qué fija este contrato
// ----------------------
// Que es solo composición: React añade marcas (data-tpv-*, clases tpv-*) y
// lleva el plano de sala a su propia columna únicamente en modo caja + sala
// + Órbita, sin hooks movidos ni handlers nuevos; y que todo el CSS cuelga de
// html[data-la-diseno="orbita"][data-tpv-caja="1"], para no tocar los demás
// diseños ni el TPV fuera del modo caja.

import fs from 'node:fs';
import assert from 'node:assert/strict';

for (const [nombre, ruta] of [
  ['fuente.js', 'fuente.js'],
  ['source-recovery/fuente-recuperado.js', 'source-recovery/fuente-recuperado.js'],
]) {
  const t = fs.readFileSync(ruta, 'utf8');

  // 1. El plano de sala solo cambia de columna en modo caja + sala + Órbita,
  //    y se pinta una sola vez por render (aquí o en la columna del ticket).
  assert.ok(t.includes('const bloqueSalaCaja = modoCajaTpv && modoTPV !== "RAPIDA" && leerDisenoNavegacion() === "orbita" ? renderSalaA07() : null;'), `${nombre}: condición del bloque de sala`);
  assert.ok(t.includes(', bloqueSalaCaja ? null : renderSalaA07(), renderRepartoProductosA08()'), `${nombre}: la columna del ticket no repite la sala`);
  assert.equal((t.match(/renderSalaA07\(\)/g) || []).length, 3, `${nombre}: renderSalaA07 solo se define una vez y se llama en dos sitios excluyentes`);
  const ini = t.indexOf('  function renderSalaA07() {');
  const fin = t.indexOf('\n  function ', ini + 10);
  assert.ok(ini > 0 && fin > ini, `${nombre}: no se encuentra renderSalaA07`);
  assert.doesNotMatch(t.slice(ini, fin), /use(State|Effect|Ref|Memo|Callback)\(/, `${nombre}: renderSalaA07 no debe usar hooks para poder cambiar de sitio`);

  // 2. Marcas de composición.
  assert.ok(t.includes('createElement("div", { className: "tpv-layout", "data-tpv-modo": modoTPV, "data-tpv-columnas": bloqueSalaCaja ? "3" : "2" }, bloqueSalaCaja ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "tpv-sala-col" }, bloqueSalaCaja) : null,'), `${nombre}: rejilla del TPV con modo y columnas`);
  for (const marca of ['"data-tpv-buscar": "1"', '"data-tpv-categorias": "1"', '"data-tpv-paginas": "1"', '"data-tpv-total": "1"', 'className: "mb-4 tpv-selector-modo"', 'className: "flex items-center justify-between mb-3 tpv-cabecera"', 'className: "tpv-raiz"']) {
    assert.ok(t.includes(marca), `${nombre}: falta la marca ${marca}`);
  }

  // 3. El modo caja sigue gobernado por el mismo estado y el mismo botón.
  assert.ok(t.includes('onClick: () => setModoCajaTpv(!modoCajaTpv) }, modoCajaTpv ? "Salir del modo caja" : "Modo caja")'), `${nombre}: el botón del modo caja no cambia`);
}

const css = fs.readFileSync('la-apariencia.css', 'utf8');
const O = 'html[data-la-diseno="orbita"][data-tpv-caja="1"]';
// 4. Pantalla completa: sin columna lateral, sin pestañas y sin barra inferior.
assert.ok(css.includes(`${O} .la-orbita-shell { grid-template-columns: minmax(0, 1fr); }`), 'la rejilla del marco pierde la columna lateral');
assert.ok(css.includes(`${O} :is(.la-orbita-sidebar, .la-orbita-pestanas, .la-orbita-bottom-nav) { display: none !important; }`), 'en caja no hay lateral, pestañas ni barra inferior');
// 5. Opción 1 y opción 2.
assert.ok(css.includes(`${O} .tpv-layout[data-tpv-modo="RAPIDA"] [data-tpv-categorias] {`), 'barra rápida: categorías en columna');
assert.ok(css.includes(`${O} .tpv-layout[data-tpv-columnas="3"] > .tpv-sala-col {`), 'sala y mesas: mesas en la primera columna');
assert.ok(css.includes(`${O} .tpv-layout[data-tpv-columnas="3"] > .tpv-main { grid-column: 3; grid-row: 1; }`), 'sala y mesas: catálogo a la derecha');
// 6. En móvil el selector de modo no se pone en fila (no cabría).
assert.match(css, /@media \(min-width: 640px\) \{\n  html\[data-la-diseno="orbita"\]\[data-tpv-caja="1"\] \.tpv-selector-modo \{ display: flex;/, 'el selector en fila solo desde 640 px');
// 7. Todo el CSS nuevo del TPV en caja cuelga de Órbita + caja.
const bloque = css.slice(css.indexOf('/* Modo caja de Órbita a pantalla completa'), css.indexOf('.la-orbita-sidebar {', css.indexOf('/* Modo caja de Órbita a pantalla completa')));
for (const linea of bloque.split('\n')) {
  if (/^\s*html\[/.test(linea)) assert.ok(linea.trim().startsWith(O), `regla fuera de Órbita + caja: ${linea.trim().slice(0, 80)}`);
}

console.log('REDISENO_TPV_CAJA_ORBITA=OK');
