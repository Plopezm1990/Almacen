// Contrato estático de ALCANCE: ningún identificador de la aplicación se usa sin estar declarado donde se usa.
//
// Fallo que corrige (3/10/2026, descubierto con Cowork en el preview): el panel «Descuento / cortesía» del TPV se quedaba colgado porque cinco funciones
// de VentaRapida usaban dos ayudas (leerContextoCuentaA02 y respuestaErrorA06) que solo existen dentro de crearLogicaVenta. En el navegador eso da
// «ReferenceError: … is not defined» y nada lo avisa antes: los contratos que comprueban el texto del código no lo ven.
//
// Cómo: analiza el código con un analizador de JavaScript (acorn + eslint-scope) y lista los identificadores sin declarar. Solo se admiten:
//   - los que son del entorno o de librerías empaquetadas (detección de funciones de otros navegadores o entornos: Buffer, Deno, process, chrome…);
//   - los alias que el recuperador del fuente deja sin declarar (X2, utils2, writeFileSync2, import_client2: en el bundle sí existen);
//   - los fallos CONOCIDOS y anotados (ahora ninguno: `money`, que usaba el registro de movimientos manuales de caja PM-08 y no existe, se arregló el 3/10/2026).
// Si aparece cualquier otro, falla. Si se anota un fallo conocido y luego se arregla, falla hasta quitarlo de la lista.
//
// Necesita librerías que no están en el repositorio: CFG_SCOPE_DEPS = carpeta (con node_modules) que contenga acorn y eslint-scope
// (por defecto /opt/node-tools). Por ejemplo:  mkdir /tmp/scopedeps && cd /tmp/scopedeps && npm init -y && npm i acorn eslint-scope
//   CFG_SCOPE_DEPS=/tmp/scopedeps node tests/cfg/alcance-static-contract.mjs
// CFG_SCOPE_FUENTE_RECUPERADA y CFG_SCOPE_FUENTE_BUNDLE permiten probar variantes rotas en las comprobaciones de mutantes.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const deps = resolve(process.env.CFG_SCOPE_DEPS || "/opt/node-tools");
let acorn;
let escope;
try {
  const require = createRequire(join(deps, "package.json"));
  acorn = require("acorn");
  escope = require("eslint-scope");
} catch (e) {
  console.error("CFG_SCOPE_DEPS no apunta a una carpeta con node_modules que contenga acorn y eslint-scope: " + deps);
  process.exit(2);
}
const root = new URL("../../", import.meta.url);
const leer = async (env, ruta) => (process.env[env] ? readFile(process.env[env], "utf8") : readFile(new URL(ruta, root), "utf8"));
const recuperado = await leer("CFG_SCOPE_FUENTE_RECUPERADA", "source-recovery/fuente-recuperado.js");
const bundle = await leer("CFG_SCOPE_FUENTE_BUNDLE", "fuente.js");

// nombres globales del navegador o de Node que el código puede usar sin declarar
const GLOBALES = new Set(["window", "document", "localStorage", "sessionStorage", "navigator", "console", "Math", "JSON", "Object", "Array", "String", "Number", "Boolean", "Date", "Promise", "Map", "Set", "WeakMap", "WeakSet", "Symbol", "Error", "TypeError", "RangeError", "RegExp", "parseInt", "parseFloat", "isNaN", "isFinite", "undefined", "NaN", "Infinity", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "fetch", "URL", "URLSearchParams", "Blob", "File", "FileReader", "FormData", "Intl", "crypto", "TextEncoder", "TextDecoder", "Uint8Array", "Uint16Array", "Uint32Array", "Float64Array", "ArrayBuffer", "DataView", "Notification", "requestAnimationFrame", "cancelAnimationFrame", "alert", "confirm", "prompt", "atob", "btoa", "encodeURIComponent", "decodeURIComponent", "encodeURI", "decodeURI", "structuredClone", "queueMicrotask", "indexedDB", "IDBKeyRange", "performance", "location", "history", "screen", "Image", "Audio", "Event", "CustomEvent", "KeyboardEvent", "MouseEvent", "HTMLElement", "Node", "AbortController", "Reflect", "Proxy", "BigInt", "globalThis", "FileList", "DOMParser", "XMLSerializer", "ResizeObserver", "IntersectionObserver", "MutationObserver", "matchMedia", "getComputedStyle", "open", "close", "print", "scrollTo", "innerWidth", "innerHeight", "self", "top", "parent", "caches", "EventSource", "WebSocket", "BroadcastChannel", "MessageChannel", "Worker", "ServiceWorker", "Response", "Request", "Headers", "escape", "unescape", "eval", "arguments", "Function", "Uint8ClampedArray", "Int8Array", "Int16Array", "Int32Array", "Float32Array", "BigInt64Array", "SharedArrayBuffer", "Atomics", "WeakRef", "AggregateError", "EvalError", "SyntaxError", "URIError", "DOMException", "Text", "Element", "SVGElement", "HTMLInputElement", "HTMLSelectElement", "HTMLTextAreaElement", "HTMLButtonElement", "getSelection", "requestIdleCallback", "cancelIdleCallback", "visualViewport", "devicePixelRatio", "Option", "XMLHttpRequest", "Storage", "StorageEvent", "PopStateEvent", "HashChangeEvent", "ProgressEvent", "Touch", "TouchEvent", "PointerEvent", "FocusEvent", "InputEvent", "ClipboardEvent", "DragEvent", "WheelEvent", "UIEvent", "Range", "Selection", "Document", "DocumentFragment", "Window", "NodeList", "HTMLCollection", "DOMRect", "DOMPoint", "DOMMatrix", "Path2D", "CanvasRenderingContext2D", "ImageData", "ImageBitmap", "createImageBitmap", "OffscreenCanvas"]);
// del entorno o de librerías empaquetadas (detección de otros navegadores o entornos): no son del código de la aplicación
const LIBRERIAS = ["__magic__", "__REACT_DEVTOOLS_GLOBAL_HOOK__", "$", "AbortSignal", "ActiveXObject", "Buffer", "Bun", "checkDCE", "chrome", "CloseEvent", "define", "Deno", "encrypt_agile", "Folder", "global", "HTMLAnchorElement", "IE_SaveFile", "IS_REACT_ACT_ENVIRONMENT", "jest", "MSApp", "Pebble", "process", "PublicKeyCredential", "ReadableStream", "reportError", "RGBColor", "safari", "saveAs", "setImmediate"];
// alias que deja sin declarar el recuperador del fuente (en el bundle existen)
const ALIAS_RECUPERADO = ["import_client2", "utils2", "writeFileSync2", "X2"];
// fallos conocidos y anotados: nombre -> descripción (vacío desde el arreglo de `money`, 3/10/2026)
const CONOCIDOS = {};

function libres(codigo, nombre) {
  const ast = acorn.parse(codigo, { ecmaVersion: "latest", sourceType: "module", locations: true, ranges: true });
  const sm = escope.analyze(ast, { ecmaVersion: 2022, sourceType: "module" });
  const m = new Map();
  for (const ref of sm.globalScope.through) {
    const n = ref.identifier.name;
    if (GLOBALES.has(n)) continue;
    const l = m.get(n) || [];
    l.push(ref.identifier.loc.start.line);
    m.set(n, l);
  }
  assert.ok(m.size >= 0, nombre);
  return m;
}
for (const [nombre, codigo, permitidos] of [["bundle", bundle, [...LIBRERIAS, ...Object.keys(CONOCIDOS)]], ["fuente recuperado", recuperado, [...ALIAS_RECUPERADO, ...Object.keys(CONOCIDOS)]]]) {
  const m = libres(codigo, nombre);
  const sobran = [...m.entries()].filter(([n]) => !permitidos.includes(n)).map(([n, ls]) => `${n} (línea ${ls[0]}, ${ls.length} uso${ls.length === 1 ? "" : "s"})`);
  assert.deepEqual(sobran, [], `${nombre}: identificadores usados sin declarar (en el navegador darían «ReferenceError … is not defined»): ${sobran.join("; ")}`);
  for (const n of Object.keys(CONOCIDOS)) assert.ok(m.has(n), `${nombre}: «${n}» ya no falla; quítalo de la lista de fallos conocidos (${CONOCIDOS[n]})`);
}
console.log("alcance-static-contract: OK");
