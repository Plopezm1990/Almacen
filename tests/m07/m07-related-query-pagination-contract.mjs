import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// M-07: una consulta con .in(ids) no puede truncar silenciosamente el conjunto
// combinado a 200 filas. El contrato es estático y no crea datos en Supabase.
const root = new URL("../../", import.meta.url);
const ficheros = [
  ["fuente recuperado", "source-recovery/fuente-recuperado.js"],
  ["bundle", "fuente.js"],
];
const normalizar = (texto) => texto.replace(/\r/g, "");
const fuentes = await Promise.all(ficheros.map(async ([nombre, ruta]) => [nombre, normalizar(await readFile(new URL(ruta, root), "utf8"))]));

const patrones = [
  ["pagos por checkout", /leerTodasLasFilasConPaginacionA09\(\(\) => supabase\s+\.from\("pagos"\)[\s\S]*?\.in\("checkout_id", checkoutIds\)[\s\S]*?\.order\("created_at", \{ ascending: false \}\)\);/],
  ["efectos de caja por pago", /leerTodasLasFilasConPaginacionA09\(\(\) => supabase\s+\.from\("caja_operaciones"\)[\s\S]*?\.in\("origen_id", pagoIds\)[\s\S]*?\.order\("created_at", \{ ascending: false \}\)\);/],
  ["líneas por pedido", /leerTodasLasFilasConPaginacionA09\(\(\) => supabase\s+\.from\("pedido_lineas"\)[\s\S]*?\.in\("pedido_id", pedidoIds\)[\s\S]*?\.order\("id", \{ ascending: true \}\)\);/],
  ["descuentos por línea", /leerTodasLasFilasConPaginacionA09\(\(\) => supabase\s+\.from\("abc_descuentos_aplicados"\)[\s\S]*?\.in\("source_line_id", lineaIds\)[\s\S]*?\.order\("created_at", \{ ascending: false \}\)\);/],
  ["líneas fiscales por venta", /leerTodasLasFilasConPaginacionA09\(\(\) => supabase\s+\.from\("venta_fiscal_lineas"\)[\s\S]*?\.in\("venta_fiscal_id", ventaIds\)[\s\S]*?\.order\("created_at", \{ ascending: false \}\)\);/],
];

for (const [nombre, texto] of fuentes) {
  assert.equal((texto.match(/async function leerTodasLasFilasConPaginacionA09\(/g) || []).length, 1, `${nombre}: helper único de paginación`);
  assert.match(texto, /const respuesta = await construirConsulta\(\)\.range\(desde, desde \+ tamanoPagina - 1\);/, `${nombre}: range inclusivo por página`);
  assert.match(texto, /if \(pagina\.length < tamanoPagina\) return \{ data: filas, error: null \};/, `${nombre}: termina solo con página incompleta`);
  assert.equal((texto.match(/leerTodasLasFilasConPaginacionA09\(\(\) => supabase/g) || []).length, 5, `${nombre}: cinco consultas relacionadas paginadas`);
  for (const [etiqueta, patron] of patrones) assert.match(texto, patron, `${nombre}: falta paginación en ${etiqueta}`);
  const sinTruncarEnLaMismaSentencia = (textoConsulta, campo, ids) => {
    const patron = new RegExp(`\\.in\\("${campo}", ${ids}\\)(?:\\s*\\.[^;]*)*\\.limit\\(200\\)`);
    return patron.test(textoConsulta);
  };
  assert.equal(sinTruncarEnLaMismaSentencia(texto, "checkout_id", "checkoutIds"), false, `${nombre}: pagos sigue truncado`);
  assert.equal(sinTruncarEnLaMismaSentencia(texto, "origen_id", "pagoIds"), false, `${nombre}: caja sigue truncada`);
  assert.equal(sinTruncarEnLaMismaSentencia(texto, "pedido_id", "pedidoIds"), false, `${nombre}: líneas de pedido siguen truncadas`);
  assert.equal(sinTruncarEnLaMismaSentencia(texto, "source_line_id", "lineaIds"), false, `${nombre}: descuentos siguen truncados`);
  assert.equal(sinTruncarEnLaMismaSentencia(texto, "venta_fiscal_id", "ventaIds"), false, `${nombre}: líneas fiscales siguen truncadas`);
}

async function paginarFilas(filas, tamanoPagina = 200, falloEn = null) {
  const resultado = [];
  const rangos = [];
  for (let desde = 0; ; desde += tamanoPagina) {
    const hasta = desde + tamanoPagina - 1;
    rangos.push([desde, hasta]);
    if (falloEn === desde) return { data: null, error: new Error("fallo simulado"), rangos };
    const pagina = filas.slice(desde, hasta + 1);
    resultado.push(...pagina);
    if (pagina.length < tamanoPagina) return { data: resultado, error: null, rangos };
  }
}

const doscientasUna = Array.from({ length: 201 }, (_, i) => i);
const cuatrocientasUna = Array.from({ length: 401 }, (_, i) => i);
const caso201 = await paginarFilas(doscientasUna);
assert.deepEqual(caso201.data, doscientasUna, "201 filas no se pierden");
assert.deepEqual(caso201.rangos, [[0, 199], [200, 399]], "201 filas fuerzan una segunda página");
const caso401 = await paginarFilas(cuatrocientasUna);
assert.deepEqual(caso401.data, cuatrocientasUna, "401 filas no se pierden");
assert.deepEqual(caso401.rangos, [[0, 199], [200, 399], [400, 599]], "401 filas recorren tres páginas");
const casoError = await paginarFilas(doscientasUna, 200, 200);
assert.equal(casoError.data, null, "un error de una página no se convierte en éxito parcial");
assert.equal(casoError.error?.message, "fallo simulado");

console.log("M-07: contrato de paginación de consultas relacionadas OK");
