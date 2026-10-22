import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("fuente.js", "utf8");
const inventory = fs.readFileSync(
  "docs/plan-empresas/PM13_P04_01_INVENTARIO_PANTALLAS_2026-10-17.md",
  "utf8",
);

const expectedIds = [
  "dashboard", "direccion", "buscar", "proveedores", "pedidos", "recepcion",
  "albaranes", "facturas", "resumen_almacen", "productos", "historial_producto",
  "conteo", "saldo", "mapa", "traspasos", "diagnostico", "etiquetas", "venta",
  "cocina", "encargos", "clientes", "devoluciones", "descuentos", "fichas",
  "produccion", "mermas", "pagos", "resultados", "reportes", "libroiva", "caja",
  "tesoreria", "estacionalidad", "personal", "fichaje", "turnos", "nominas", "appcc",
  "aceite", "auditoria", "respaldos", "notificaciones", "locales", "configuracion",
  "errores_sistema",
];

const start = source.indexOf("const itemsMeta = [");
const end = source.indexOf("  const porId =", start);
assert.ok(start >= 0 && end > start, "itemsMeta no encontrado");
const block = source.slice(start, end);
const actualIds = [...block.matchAll(/\{ id: "([^"]+)"/g)].map((match) => match[1]);

assert.equal(actualIds.length, 45);
assert.deepEqual([...actualIds].sort(), [...expectedIds].sort());
assert.equal(new Set(actualIds).size, actualIds.length);
for (const id of expectedIds) assert.ok(inventory.includes(`\u0060${id}\u0060`), `inventario sin ${id}`);

assert.match(source, /const GRUPOS = \[/);
assert.ok(source.includes("var matchPrefiltro = /^#\\/prefiltro\\/(.+)$/.exec(rutaHash);"));
assert.match(inventory, /45 pantallas privadas/);
assert.match(inventory, /restablecer-contrasena\.html/);

console.log("PM13 P14 Inventario de pantallas: 45 claves privadas y entradas especiales documentadas OK");
