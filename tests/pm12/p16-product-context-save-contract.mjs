import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../../", import.meta.url);
const fuente = fs.readFileSync(new URL("fuente.js", root), "utf8").replace(/\r\n/g, "\n");
const recuperada = fs.readFileSync(new URL("source-recovery/fuente-recuperado.js", root), "utf8").replace(/\r\n/g, "\n");

assert.match(
  fuente,
  /const ultimaFirmaProductosGuardadaRef = import_react4\.default\.useRef\(null\);/,
  "la persistencia de productos necesita una firma guardada para deduplicar cambios de contexto"
);

const saveProductos = fuente.indexOf('saveKey("productos", productos);');
const inicio = fuente.lastIndexOf('(0, import_react4.useEffect)(() => {', saveProductos);
const fin = fuente.indexOf('\n  (0, import_react4.useEffect)(() => {', saveProductos);
assert.ok(inicio > 0 && fin > inicio, "no se encontró el efecto de persistencia de productos");
const efecto = fuente.slice(inicio, fin);

assert.match(efecto, /window\.__localActivoIdParaContexto/);
assert.match(efecto, /window\.__empresaActivaIdParaContexto/);
assert.match(efecto, /const firmaProductos = JSON\.stringify\(productos\);/);
assert.match(efecto, /if \(ultimaFirmaProductosGuardadaRef\.current === firmaProductos\) return;/);
assert.match(efecto, /ultimaFirmaProductosGuardadaRef\.current = firmaProductos;/);
assert.match(efecto, /saveKey\("productos", productos\);/);
assert.match(efecto, /\[productos, ready, localActivoId, empresaDelLocalActivo\?\.id\]/);

const saveProductosRec = recuperada.indexOf('saveKey("productos", productos);');
const inicioRec = recuperada.lastIndexOf('(0, import_react4.useEffect)(() => {', saveProductosRec);
assert.ok(inicioRec > 0, "la fuente recuperada debe conservar el efecto de persistencia de productos");
const finRec = recuperada.indexOf('\n  (0, import_react4.useEffect)(() => {', saveProductosRec);
assert.ok(finRec > inicioRec, "no se encontró el efecto recuperado de persistencia de productos");
const bloqueRec = recuperada.slice(inicioRec, finRec);
assert.equal(
  bloqueRec,
  fuente.slice(inicio, fin),
  "fuente.js y fuente-recuperado.js deben mantener paridad en la persistencia contextual de productos"
);

console.log("PM12_P16_PRODUCT_CONTEXT_SAVE=PASS");
