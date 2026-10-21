import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");
const fuentes = [
  ["fuente.js", (await read("fuente.js")).replace(/\r/g, "")],
  ["source-recovery/fuente-recuperado.js", (await read("source-recovery/fuente-recuperado.js")).replace(/\r/g, "")]
];

// AUD-001: cada Field debe asociar su texto visible con el control real.
for (const [nombre, bundle] of fuentes) {
  const fieldIni = bundle.indexOf("function Field({ label, children })");
  assert.ok(fieldIni >= 0, `${nombre}: componente Field localizado`);
  const field = bundle.slice(fieldIni, bundle.indexOf("var CATEGORIAS_GASTO", fieldIni));
  assert.match(field, /htmlFor:/, `${nombre}: Field expone una asociación label-control`);
  assert.match(field, /cloneElement/, `${nombre}: Field inyecta el id en el control hijo`);

  // AUD-002: los importes unitarios conservan hasta tres decimales significativos.
  assert.match(bundle, /function fmtPrecio\(n2\)/, `${nombre}: existe el formateador de precios`);
  assert.match(bundle, /maximumFractionDigits: 3/, `${nombre}: el formateador permite tres decimales`);
  assert.match(bundle, /fmtPrecio\(p22\.costo\)/, `${nombre}: Productos muestra el coste con su precisión`);
  assert.match(bundle, /fmtPrecio\(p22\.precioVenta\)/, `${nombre}: Productos muestra el precio con su precisión`);

  // AUD-005: los roles retirados no se ofrecen al crear una ficha nueva.
  assert.match(bundle, /var NOMBRES_ROLES_ALTA = NOMBRES_ROLES\.filter/);
  assert.match(bundle, /NOMBRES_ROLES_ALTA\.concat\(ROLES_RETIRADOS\.includes\(form\.rol\)/);

  // AUD-007: el contenido principal puede encogerse y el móvil no arrastra el
  // ancho mínimo de tablas, controles o tarjetas.
  assert.match(bundle, /app-main-content flex-1 min-w-0/);
  assert.match(bundle, /\.app-main-content[^`]*overflow-x:\s*hidden/s);
  assert.match(bundle, /\.app-main-content table[^`]*overflow-x:\s*auto/s);

  // AUD-008: la navegación usa el periodo que se está viendo y tiene siguiente.
  const resultadosIni = bundle.indexOf("function Resultados(");
  const resultadosFin = bundle.indexOf("function LibroIVA(", resultadosIni);
  const resultados = bundle.slice(resultadosIni, resultadosFin);
  assert.match(resultados, /function irMesSiguiente\(\)/);
  assert.match(resultados, /new Date\(`\$\{desde\}T12:00:00`\)/);
  assert.match(resultados, /"Mes siguiente"/);
}

console.log("F5 Etapa 3 UI: contrato OK");
