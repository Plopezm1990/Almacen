import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fuente = fs.readFileSync(path.join(root, "fuente.js"), "utf8");

assert.match(
  fuente,
  /movimientosCaja: movimientosCajaDelLocalActivo, registrarMovimientoCaja, eliminarMovimientoCaja, leerBorradorMovimientoCaja/,
  "El TPV debe recibir el libro y las operaciones de caja ya validadas"
);
assert.match(
  fuente,
  /Caja · entradas y retiradas/,
  "El acceso a entradas y retiradas debe ser visible desde el TPV"
);
assert.match(
  fuente,
  /onClick: abrirMovimientosCajaDesdeTpv/,
  "El acceso del TPV debe resolver primero el contexto de caja"
);
assert.match(
  fuente,
  /rpc\("abc_obtener_dia_operativo_local"/,
  "El día operativo debe proceder del servidor cuando no hay contexto local válido"
);
assert.match(
  fuente,
  /createElement\(BloqueEntradasSalidas, \{ fecha: diaOperativoCajaTpv, movimientosCajaDelDia: movimientosDelDia, registrarMovimientoCaja, eliminarMovimientoCaja, leerBorradorMovimientoCaja \}\)/,
  "El TPV debe reutilizar el flujo trazable de caja en vez de duplicarlo"
);
assert.match(fuente, /Reposici\\xF3n de cambio/);
assert.match(fuente, /Otro ingreso manual/);
assert.match(fuente, /Retirada de efectivo/);
assert.match(fuente, /Gasto pagado desde caja/);

const inicio = fuente.indexOf("async function abrirMovimientosCajaDesdeTpv()");
const final = fuente.indexOf("function renderCuentasRecuperablesA06()", inicio);
assert.ok(inicio >= 0 && final > inicio, "No se encontró el flujo TPV de caja");
const flujo = fuente.slice(inicio, final);
assert.ok(
  flujo.indexOf('rpc("abc_obtener_dia_operativo_local"') < flujo.indexOf("setMostrarMovimientosCajaTpv(true)"),
  "El modal no puede abrirse antes de resolver el día operativo"
);
assert.doesNotMatch(flujo, /\.from\("caja_operaciones"\)\.(insert|update|delete)|Cobrar efectivo|iniciarCobroCuentaF4|venderCarrito/i);

console.log("PLAN_MAESTRO_ETAPA5_TPV_MOVIMIENTOS_CAJA_CONTRACT_OK=1");
