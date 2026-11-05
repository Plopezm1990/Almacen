import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = fs.readFileSync(path.join(repo, "fuente.js"), "utf8");

assert.match(source, /function normalizarTextoBusquedaLA\(texto\)/, "debe existir una normalización común de búsqueda");
assert.match(source, /normalize\("NFD"\)/, "la búsqueda debe descomponer caracteres Unicode");
assert.ok(source.includes('replace(/[\\u0300-\\u036f]/g, "")'), "la búsqueda debe eliminar diacríticos");
assert.match(source, /toLocaleLowerCase\("es-ES"\)/, "la búsqueda debe normalizar mayúsculas con locale español");
assert.match(source, /aria-label": "Buscar productos, proveedores, clientes, fichas de costo y personal"/, "la búsqueda debe tener etiqueta accesible");
assert.match(source, /setTab\(g2\.tab, \{ tipo: g2\.clave, id: item\.id \}\)/, "el resultado debe transportar el identificador del registro");
assert.match(source, /navegacionObjetivoId: navegacionObjetivoPM15\?\.tipo === "productos"/, "Productos debe recibir el destino de navegación");
assert.match(source, /openEdit\(objetivo\)/, "el destino de producto debe abrir el registro concreto");
assert.match(source, /function crearContextoNavegacionLA\(/, "debe existir un contrato común de contexto de navegación");
for (const field of ["empresaId", "empresaNombre", "localId", "localNombre", "alcance", "rol", "capacidades", "fechaDeCarga", "estadoDeSincronizacion"]) {
  assert.match(source, new RegExp(`\\b${field}\\b`), `el contexto de navegación debe contemplar ${field}`);
}
assert.match(source, /window\.__contextoNavegacionPM15 = contextoNavegacionPM15/, "el contexto calculado debe quedar disponible para los puentes de navegación");
assert.match(source, /role: "navigation", "aria-label": "Navegación principal"/, "el menú de escritorio debe tener landmark accesible");
assert.match(source, /role: "navigation", "aria-label": "Navegación móvil"/, "el menú móvil debe tener landmark accesible");
assert.match(source, /"aria-current": active \? "page" : void 0/, "la navegación debe exponer la pantalla activa");
assert.match(source, /aria-label": "Más opciones de navegación"/, "el botón Más debe tener nombre accesible");
assert.match(source, /function leerRutaPanelLA\(\)/, "debe existir un lector de ruta privada de panel");
assert.match(source, /function escribirRutaPanelLA\(tab, reemplazar = false\)/, "debe existir un escritor controlado de ruta privada");
assert.match(source, /history\.pushState\(\{.*laSuitePanel: tab/s, "los cambios de pantalla deben entrar en el historial del navegador");
assert.match(source, /addEventListener\("popstate", aplicarRutaDesdeHistorial\)/, "atrás y adelante deben resolver el panel");
assert.match(source, /addEventListener\("hashchange", aplicarRutaDesdeHistorial\)/, "los cambios de hash deben resolver el panel");
assert.match(source, /!puedeConsultarPantallaPM13\(nuevaTab\)/, "la ruta profunda debe validar la capacidad de consulta");
assert.ok(!source.includes("#/panel/\${empresa"), "la ruta no debe incluir datos de empresa por interpolación");

console.log("P0/P1 panel/navegación: contrato estático OK");
