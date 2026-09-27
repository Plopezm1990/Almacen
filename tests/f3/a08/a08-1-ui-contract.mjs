// A08.1 UI contract — reparto por productos/líneas sobre backend A08 existente.
import fs from "node:fs";
import assert from "node:assert/strict";

const src = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");
const a08 = fs.readFileSync("supabase/migrations/20260924060000_abc_f3_a08_account_split_merge.sql", "utf8");

// Backend preexistente que A08.1 debe reutilizar, no reimplementar.
for (const required of [
  "create function public.abc_mover_cantidad_linea_cuenta(",
  "create function public.abc_consultar_reparto_cuenta(",
  "ABC_CUENTA_REPARTIR",
  "cuenta_origen_version_conflict",
  "cuenta_destino_version_conflict",
  "reparto_parte_fiscalizada_inmovil",
  "reparto_cantidad_no_fraccionable",
  "reparto_cantidad_precision_invalida",
  "CUENTA_REPARTO_LINEA_MOVIDO"
]) {
  assert.ok(a08.includes(required), "A08 backend incompleto para UI: " + required);
}

// Snapshot dedicado de origen: exige la RPC A08 con capacidad ABC_CUENTA_REPARTIR.
const consultIni = src.indexOf("async function consultarRepartoCuentaA08()");
const consultFin = src.indexOf("\n  async function listarCuentasRepartoA08()", consultIni);
assert.ok(consultIni >= 0 && consultFin > consultIni, "A08.1 consulta de snapshot no localizable");
const consult = src.slice(consultIni, consultFin);
for (const required of [
  'supabase.rpc("abc_consultar_reparto_cuenta"',
  "p_cuenta_id: contexto.cuentaId",
  "p_terminal_id: terminal.terminalId",
  "p_session_id: terminal.sessionId",
  "p_operating_day: contexto.operatingDay",
  'String(data.estado || "") !== "ABIERTA"',
  "reparto: data.reparto"
]) {
  assert.ok(consult.includes(required), "A08.1 snapshot dedicado incompleto: " + required);
}

// Listado de destinos: usa cuentas reales del mismo contexto y snapshot A08.
const listIni = src.indexOf("async function listarCuentasRepartoA08()");
const listFin = src.indexOf("\n  async function moverCantidadLineaCuentaA08(", listIni);
assert.ok(listIni >= 0 && listFin > listIni, "A08.1 listado de cuentas no localizable");
const list = src.slice(listIni, listFin);
for (const required of [
  "leerContextoCuentaA02(empresaId, localActivoId)",
  "await consultarRepartoCuentaA08()",
  'supabase.rpc("abc_listar_cuentas_recuperables"',
  "p_empresa_id: empresaId",
  "p_local_id: localActivoId",
  "p_operating_day: contexto.operatingDay",
  "String(cuenta.cuenta_id || \"\") !== String(contexto.cuentaId)",
  "cuenta.reanudable_mismo_dia !== false",
  "String(cuenta.opened_operating_day || \"\") === String(contexto.operatingDay)",
  "String(cuenta.currency_code || \"\") === moneda",
  "reparto"
]) {
  assert.ok(list.includes(required), "A08.1 listado inseguro/incompleto: " + required);
}

// Movimiento: versiones de origen, destino y línea salen del servidor.
const moveIni = src.indexOf("async function moverCantidadLineaCuentaA08(");
const moveFin = src.indexOf("\n  async function venderCarrito(", moveIni);
assert.ok(moveIni >= 0 && moveFin > moveIni, "A08.1 adaptador de movimiento no localizable");
const move = src.slice(moveIni, moveFin);
for (const required of [
  "p_cuenta_origen_id: contexto.cuentaId",
  "p_cuenta_destino_id: destinoId",
  "p_cantidad: cantidadNumero",
  "p_expected_origen_version: origenVersion",
  "p_expected_destino_version: destinoVersion",
  "p_expected_linea_version: lineaVersion",
  "p_terminal_id: terminal.terminalId",
  "p_session_id: terminal.sessionId",
  "p_operating_day: contexto.operatingDay",
  "const operationSeed = JSON.stringify({",
  'crypto.subtle.digest("SHA-256"',
  'const operationId = "a08.1.linea:" + operationHash',
  "terminalId: terminal.terminalId",
  "sessionId: terminal.sessionId",
  "operatingDay: contexto.operatingDay",
  'rpcA02ConRecuperacion(supabase, "abc_mover_cantidad_linea_cuenta"',
  "await recuperarCuentaA06()",
  "await listarCuentasRepartoA08()"
]) {
  assert.ok(move.includes(required), "A08.1 movimiento incompleto: " + required);
}
for (const forbidden of [
  'supabase.from("pagos")',
  'supabase.from("checkouts")',
  'supabase.from("reembolsos")',
  'supabase.from("pedidos_tpv")',
  'supabase.from("pedido_lineas")'
]) {
  assert.ok(!move.includes(forbidden), "A08.1 no debe mutar directamente " + forbidden);
}
assert.ok(!move.includes("comensal.slice(0, 32)"), "A08.1 no debe introducir texto libre truncado en operation_id");

// UI: cantidad disponible deriva del snapshot comercial, restando lo fiscalizado.
for (const required of [
  "function cantidadMovibleA08(linea)",
  "Number(linea?.cantidad_fiscalizada)",
  "function lineasMoviblesA08(",
  "estado?.origen?.reparto?.lineas",
  "Repartir productos",
  "Producto / línea",
  "Cantidad a mover",
  "Cuenta destino",
  "Comensal (opcional)",
  "Parte fiscalizada inmóvil",
  "Mover producto",
  "No hay otra cuenta abierta compatible en este local y día operativo.",
  "Ambas cuentas se han recargado desde el servidor."
]) {
  assert.ok(src.includes(required), "A08.1 UI incompleta: " + required);
}

// La selección del destino usa etiquetas humanas; nunca solicita un UUID al operador.
const labelIni = src.indexOf("function etiquetaCuentaDestinoA08(");
const labelFin = src.indexOf("\n\n  const vendibles", labelIni);
assert.ok(labelIni >= 0 && labelFin > labelIni, "A08.1 etiqueta destino no localizable");
const labelBlock = src.slice(labelIni, labelFin);
assert.ok(labelBlock.includes("ubicacion.mesa_nombre"));
assert.ok(labelBlock.includes("total_comercial"));
assert.ok(!labelBlock.includes("return cuenta.cuenta_id"), "A08.1 no debe mostrar UUID como etiqueta");
assert.ok(!src.includes('placeholder: "UUID'), "A08.1 no debe pedir UUID manual");

// Conflictos de las dos cuentas se clasifican como optimistic locking.
assert.ok(src.includes('msg.includes("cuenta_origen_version_conflict")'));
assert.ok(src.includes('msg.includes("cuenta_destino_version_conflict")'));

// Wiring completo desde la factoría hasta VentaRapida.
assert.ok(src.includes("listarCuentasRepartoA08, moverCantidadLineaCuentaA08 } = crearLogicaVenta"));
assert.ok(src.includes("movimientos: movimientosDelLocalActivo, listarCuentasRepartoA08, moverCantidadLineaCuentaA08, registrarAuditoria"));
assert.ok(src.includes("renderSalaA07(), renderRepartoProductosA08(), renderPedidoOperativoA05()"));

console.log("A08_1_DEDICATED_SNAPSHOT=PASS");
console.log("A08_1_OPERATION_ID_SAFE=PASS");
console.log("A08_1_LINES_UI=PASS");
console.log("A08_1_OPTIMISTIC_LOCKING=PASS");
console.log("A08_1_NO_MANUAL_UUID=PASS");
console.log("A08_1_NO_PAYMENT_MUTATION=PASS");
