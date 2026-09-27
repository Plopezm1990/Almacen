import fs from "node:fs";
import assert from "node:assert/strict";

const recovered = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");
const a05 = fs.readFileSync("supabase/migrations/20260924030000_abc_f3_a05_order_state_machine.sql", "utf8");

const start = recovered.indexOf("async function accionPedidoA05(");
const end = recovered.indexOf("\n  async function venderCarrito(", start);
assert.ok(start >= 0 && end > start, "A05.3: adaptador operativo no localizable");
const adapter = recovered.slice(start, end);

for (const rpc of [
  "abc_iniciar_preparacion_linea",
  "abc_marcar_linea_preparada",
  "abc_servir_linea",
  "abc_cancelar_linea",
  "abc_cancelar_pedido"
]) {
  assert.ok(adapter.includes('"' + rpc + '"'), "A05.3: falta RPC " + rpc);
}

for (const required of [
  "p_expected_linea_version",
  "p_expected_pedido_version",
  "p_terminal_id: contexto.terminalId",
  "p_session_id: contexto.sessionId",
  "p_operating_day: contexto.operatingDay",
  "motivo_cancelacion_requerido",
  "guardarContextoCuentaA02(empresaId, localActivoId, contexto)"
]) {
  assert.ok(adapter.includes(required), "A05.3: falta guarda " + required);
}

for (const forbidden of [
  "abc_iniciar_checkout",
  "abc_confirmar_pago",
  "abc_emitir",
  "registrar_venta_stock_carrito_pm09",
  "abc_cerrar_pedido_operativo"
]) {
  assert.ok(!adapter.includes(forbidden), "A05.3: fuera de alcance " + forbidden);
}

assert.ok(recovered.includes("function leerPedidoOperativoA05()"), "A05.3: falta recuperación de pedido operativo");
assert.ok(recovered.includes("function renderPedidoOperativoA05()"), "A05.3: falta panel operativo");
assert.ok(recovered.includes('"Iniciar preparación"'), "A05.3: CTA preparación ausente");
assert.ok(recovered.includes('"Marcar preparada"'), "A05.3: CTA preparada ausente");
assert.ok(recovered.includes('"Servir"'), "A05.3: CTA servido ausente");
assert.ok(recovered.includes('"Cancelar línea"'), "A05.3: CTA cancelar línea ausente");
assert.ok(recovered.includes('"Cancelar pedido"'), "A05.3: CTA cancelar pedido ausente");
assert.ok(recovered.includes("Motivo de cancelación (obligatorio para cancelar)"), "A05.3: motivo obligatorio no visible");
assert.ok(recovered.includes("Los permisos se validan siempre en el servidor."), "A05.3: UI no explicita autoridad de permisos");
assert.ok(recovered.includes('linea.estado === "ENVIADA"'), "A05.3: preparación no condicionada por estado");
assert.ok(recovered.includes('linea.estado === "EN_PREPARACION"'), "A05.3: preparada no condicionada por estado");
assert.ok(recovered.includes('linea.estado === "PREPARADA"'), "A05.3: servir no condicionado por estado");

for (const backend of [
  "create function public.abc_iniciar_preparacion_linea(",
  "create function public.abc_marcar_linea_preparada(",
  "create function public.abc_servir_linea(",
  "create function public.abc_cancelar_linea(",
  "create function public.abc_cancelar_pedido("
]) {
  assert.ok(a05.includes(backend), "A05.3: backend ausente " + backend);
}

for (const capability of [
  "ABC_PREPARACION_INICIAR",
  "ABC_PREPARACION_COMPLETAR",
  "ABC_PEDIDO_SERVIR",
  "ABC_LINEA_CANCELAR",
  "ABC_CANCELACION_SENSIBLE",
  "ABC_PEDIDO_CANCELAR"
]) {
  assert.ok(a05.includes(capability), "A05.3: capacidad server-side ausente " + capability);
}

assert.ok(a05.includes("if v_motivo is null then raise exception 'motivo_cancelacion_requerido'"), "A05.3: backend no exige motivo");
assert.ok(a05.includes("and not private.abc_tiene_capacidad("), "A05.3: backend no protege cancelación sensible");
assert.ok(a05.includes("pedido_con_lineas_servidas_no_cancelable"), "A05.3: backend no bloquea cancelar pedido servido");

console.log("A05_3_OPERATIONAL_ACTIONS_PERMISSIONS=PASS");
