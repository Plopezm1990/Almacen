import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fuentes = ["fuente.js", "source-recovery/fuente-recuperado.js"].map((archivo) => ({
  archivo,
  texto: fs.readFileSync(path.join(root, archivo), "utf8")
}));
const marker = "/* Documento 2 · A07/A08/A09: teclados y calculadora */";
const nextMarker = "/* Documento 2 · A05/A06: Mesas y Pedido como tareas dedicadas */";
const bloquesCss = [];

for (const { archivo, texto } of fuentes) {
  const inicioCss = texto.indexOf(marker);
  const finCss = texto.indexOf(nextMarker, inicioCss);
  assert.ok(inicioCss >= 0 && finCss > inicioCss, `${archivo}: falta el bloque CSS A07/A08/A09 completo`);
  bloquesCss.push(texto.slice(inicioCss, finCss));

  assert.match(texto, /data-tpv-pdf-section": "A07"/, `${archivo}: falta el marcador del teclado numérico del PDF`);
  assert.match(texto, /data-tpv-pdf-section": "A09"/, `${archivo}: falta el marcador de la calculadora del PDF`);
  assert.match(texto, /tpv-a08-search-field/, `${archivo}: falta el estilo semántico de búsqueda`);
  assert.match(texto, /tpv-a08-note-field/, `${archivo}: falta el estilo semántico de notas`);
  assert.match(texto, /tpv-a08-note-counter/, `${archivo}: falta el contador visible de la nota`);
  assert.match(texto, /inputMode: "search"/, `${archivo}: la búsqueda perdió inputmode search`);
  assert.match(texto, /"aria-label": "Buscar productos o escanear código"/, `${archivo}: falta el nombre accesible de búsqueda`);
  assert.match(texto, /maxLength: 500/, `${archivo}: la nota no mantiene el máximo de 500 caracteres`);
  assert.match(texto, /String\(notaA04 \|\| ""\)\.length}\/500/, `${archivo}: falta mostrar el contador de nota`);
  assert.match(texto, /Borrar cálculo/, `${archivo}: la calculadora perdió el nombre accesible de borrado`);

  const indiceBusqueda = texto.indexOf('placeholder: "Escanea un c\\xF3digo');
  assert.ok(indiceBusqueda >= 0, `${archivo}: no se encontró el campo de búsqueda del TPV`);
  const bloqueBusqueda = texto.slice(Math.max(0, indiceBusqueda - 240), indiceBusqueda + 420);
  assert.doesNotMatch(bloqueBusqueda, /autoFocus: true/, `${archivo}: la búsqueda no debe forzar autofocus en tablet`);
}

assert.equal(bloquesCss[0], bloquesCss[1], "fuente.js y source-recovery deben mantener el CSS A07/A08/A09 idéntico");
assert.match(bloquesCss[0], /min-height: 56px !important/);
assert.match(bloquesCss[0], /font-size: 18px/);
assert.match(bloquesCss[0], /width: min\(100%, 480px\)/);
assert.match(bloquesCss[0], /focus-visible/);

console.log("DOCUMENTO2_A07_A08_A09_TECLADOS=PASS");
