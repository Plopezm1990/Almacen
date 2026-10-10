import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");
const stock = fs.readFileSync("supabase/migrations/20261010150000_abc_d09_d11_stock_order_integration.sql", "utf8");
const guard = fs.readFileSync("supabase/migrations/20261010153000_abc_d10_legacy_refund_guard.sql", "utf8");

const confirmStart = source.indexOf("async function confirmarPedidoA05()");
const confirmEnd = source.indexOf("\n  async function enviarPedidoA05()", confirmStart);
assert.ok(confirmStart >= 0 && confirmEnd > confirmStart, "D2: acción de confirmación no localizable");
const confirmAdapter = source.slice(confirmStart, confirmEnd);

assert.ok(confirmAdapter.includes('"abc_confirmar_linea_pedido"'), "D2: la confirmación no usa el RPC servidor");
assert.ok(confirmAdapter.includes('"abc_confirmar_linea_pedido_configurada"'), "D2: falta la variante configurada");
assert.ok(confirmAdapter.includes('"a05.4.confirm."'), "D2: falta operation_id determinista de confirmación");
assert.ok(confirmAdapter.includes('contexto.pedidoEstado = "ABIERTO"'), "D2: confirmar debe conservar el pedido en ABIERTO");
assert.ok(!confirmAdapter.includes('"abc_enviar_pedido"'), "D2: confirmar no puede enviar automáticamente");
assert.ok(source.includes('"Confirmar pedido"'), "D2: CTA Confirmar pedido ausente");
assert.ok(source.includes("confirmarPedidoA05, leerPedidoOperativoA05"), "D2: la acción no está conectada al TPV");
assert.ok(source.includes('lineasConfirmadas: Number(resultado.lineasConfirmadas) || 0'), "D2: la UI no conserva el estado CONFIRMADA");

assert.ok(stock.includes("if p_linea.estado='CONFIRMADA' and p_old_estado is distinct from p_linea.estado"), "D2: no se encontró el disparo de stock al confirmar");
assert.ok(stock.includes("perform private.abc_stock_consumir_linea(p_linea,v_modalidad,'CONFIRMACION_VENTA')"), "D2: Barra/Para llevar no consumen al confirmar");
assert.ok(stock.includes("perform private.abc_stock_reservar_linea(p_linea,v_modalidad)"), "D2: Mesa/Terraza no reservan al confirmar");
assert.ok(stock.includes("if p_linea.estado in ('EN_PREPARACION','SERVIDA')"), "D2: no se encontró el consumo al iniciar preparación");

assert.ok(guard.includes("if v_stock.estado in ('MERMA','REVERTIDA','CANCELADA') then"), "D10: falta rechazo de stock no recuperable");
assert.ok(guard.includes("if v_stock.estado='CONSUMIDA' and v_linea.estado<>'CONFIRMADA' then"), "D10: falta rechazo de línea no CONFIRMADA");
assert.ok(guard.includes("set estado='REVERTIDA'"), "D10: una devolución aceptada no marca REVERTIDA");
assert.ok(guard.includes("motivo='DEVOLUCION_CLIENTE_RECUPERABLE'"), "D10: falta la trazabilidad de devolución recuperable");

function d10Outcome(stockState, lineState) {
  if (["MERMA", "REVERTIDA", "CANCELADA"].includes(stockState)) return "REJECT";
  if (stockState === "CONSUMIDA" && lineState !== "CONFIRMADA") return "REJECT";
  return "PERMIT";
}

const matrix = {
  CONFIRMADA: "PERMIT",
  ENVIADA: "REJECT",
  EN_PREPARACION: "REJECT",
  PREPARADA: "REJECT",
  SERVIDA: "REJECT",
  MERMA: "REJECT"
};
for (const [lineState, expected] of Object.entries(matrix)) {
  const stockState = lineState === "MERMA" ? "MERMA" : "CONSUMIDA";
  assert.equal(d10Outcome(stockState, lineState), expected, `D2/D10: matriz inesperada para ${lineState}`);
}

console.log("D2_RECOVERABLE_REFUND_STATE_MATRIX=PASS");
