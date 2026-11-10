import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// M-05: el registro de auditoria no puede quedarse en la primera pagina.
// El contrato es estatico a proposito: no crea datos y comprueba el cliente
// que se desplegara. La RLS del servidor sigue siendo la que decide que filas
// puede ver cada usuario; .range() solo pagina ese conjunto autorizado.
const root = new URL("../../", import.meta.url);
const normalizar = (texto) => texto.replace(/\r/g, "");
const ficheros = [
  ["fuente recuperado", "source-recovery/fuente-recuperado.js"],
  ["bundle", "fuente.js"],
];

const fuentes = await Promise.all(ficheros.map(async ([nombre, ruta]) => [nombre, normalizar(await readFile(new URL(ruta, root), "utf8"))]));
const bloquePaginacion = [];

for (const [nombre, texto] of fuentes) {
  assert.equal((texto.match(/function cargarPaginaAuditoria\(/g) || []).length, 1, `${nombre}: una sola funcion de carga paginada`);
  assert.equal((texto.match(/\.from\("auditoria_registro"\)\.select\("datos"\)\.order\("creado_en", \{ ascending: false \}\)\.range\(desde, desde \+ 499\)/g) || []).length, 1,
    `${nombre}: la lectura de auditoria usa paginas ordenadas de 500`);
  assert.doesNotMatch(texto, /\.from\("auditoria_registro"\)[^\n]*\.limit\(500\)/,
    `${nombre}: no vuelve a limitar la lectura de auditoria a 500 sin paginar`);
  assert.doesNotMatch(texto, /setAuditoria\(\(s22\) => \[entrada, \.\.\.s22\]\.slice\(0, 500\)\)/,
    `${nombre}: no recorta la auditoria local a 500 entradas`);
  for (const marca of [
    "const [auditoriaDesdeServidor, setAuditoriaDesdeServidor]",
    "const [auditoriaHayMas, setAuditoriaHayMas]",
    "const [auditoriaCargando, setAuditoriaCargando]",
    "const [auditoriaError, setAuditoriaError]",
    "setAuditoria((actual) => reiniciar || !auditoriaDesdeServidor ? datos : [...actual, ...datos])",
    "auditoriaDesdeServidor ? auditoriaHayMas ? \"Mostrando una parte del registro; puedes cargar mas.\" : \"Registro completo cargado.\"",
    "Cargar mas registros",
  ]) assert.ok(texto.includes(marca), `${nombre}: falta la guarda de paginacion ${marca}`);
  assert.equal((texto.match(/function AuditoriaPaginacion\(/g) || []).length, 1, `${nombre}: control visible de paginacion`);
  assert.match(texto, /createElement\(Auditoria, \{ auditoria, cargarPaginaAuditoria, auditoriaDesdeServidor, auditoriaHayMas, auditoriaCargando, auditoriaError \}\)/,
    `${nombre}: el estado y el cargador llegan a la pantalla`);
  const inicio = texto.indexOf("function AuditoriaPaginacion(");
  const fin = texto.indexOf("function AuditoriaContenido(", inicio);
  assert.ok(inicio >= 0 && fin > inicio, `${nombre}: bloque de auditoria localizable`);
  bloquePaginacion.push(texto.slice(inicio, fin));
}

assert.equal(bloquePaginacion[0], bloquePaginacion[1], "la paginacion de auditoria es identica en fuente recuperado y bundle");

// Reproduce el criterio de fin de pagina que usa el cliente: con 500 filas
// sigue habiendo una pagina por probar; con menos, el registro esta completo.
const pagina = (total, offset, tamano = 500) => Math.max(0, Math.min(tamano, total - offset));
assert.equal(pagina(1011, 0), 500);
assert.equal(pagina(1011, 500), 500);
assert.equal(pagina(1011, 1000), 11);
assert.equal(pagina(1011, 1011), 0);

console.log("M-05: contrato de paginacion de auditoria OK");
