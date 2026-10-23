import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const fuente = readFileSync(fileURLToPath(new URL("../../fuente.js", import.meta.url)), "utf8");
const inicio = fuente.indexOf("  async function recuperarCuentaSeleccionadaA06(");
const fin = fuente.indexOf("\n  (0, import_react4.useEffect)(() => {", inicio);

assert.ok(inicio >= 0 && fin > inicio, "No se encontró el controlador visible de recuperación");
const bloque = fuente.slice(inicio, fin);

const guardia = bloque.indexOf('estadoBorradorA06?.estado === "ACTIVO" && carrito.length > 0');
const llamada = bloque.indexOf("await recuperarCuentaA06(cuentaId, cuenta)");

assert.ok(guardia >= 0, "La recuperación debe detectar un borrador local activo");
assert.ok(llamada > guardia, "La protección del borrador debe ejecutarse antes de la RPC de recuperación");
assert.match(bloque, /Guárdalo o vacíalo antes de recuperar otra cuenta/);
assert.match(bloque, /no se ha borrado ni mezclado con la cuenta del servidor/);
assert.ok(bloque.slice(guardia, llamada).includes("return;"), "Un borrador activo debe bloquear la recuperación");

console.log("PLAN_MAESTRO_ETAPA5_RECUPERACION_BORRADOR_SEGURO_OK=1");
