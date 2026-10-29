import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../../fuente.js", import.meta.url), "utf8");
const quickStart = source.indexOf("async function confirmarVentaRapida()");
const quickEnd = source.indexOf("function renderVentaRapidaStatus()", quickStart);
assert.ok(quickStart >= 0 && quickEnd > quickStart, "No se pudo aislar el flujo de venta rápida");
const quick = source.slice(quickStart, quickEnd);

for (const required of [
  "const guardada = await venderRapida(lineas, { modalidad: \"BARRA\" });",
  "await enviarPedidoA05()",
  "INICIAR_PREPARACION",
  "MARCAR_PREPARADA",
  "SERVIR",
  "await iniciarCobroCuentaF4(pagoRapida",
  "setTicketVenta({",
  "lineasTicketRapida",
  "qrFiscalRapida",
  'production: false'
]) {
  assert.ok(quick.includes(required), `Falta en venta rápida: ${required}`);
}

const statusStart = source.indexOf("function renderVentaRapidaStatus()");
const statusEnd = source.indexOf("\n  return /* @__PURE__ */", statusStart);
assert.ok(statusStart >= 0 && statusEnd > statusStart, "No se pudo aislar el estado de venta rápida");
const status = source.slice(statusStart, statusEnd);
assert.ok(status.includes('"data-ticket-quick": "1"'), "La venta rápida no ofrece ver el ticket");
assert.ok(status.includes("Ver ticket"), "Falta el CTA visible del ticket");

assert.ok(source.includes('data-tpv-quick'), "Falta el panel específico de cobro de mostrador");
assert.ok(source.includes("Venta rápida completada"), "Falta el estado final de la venta rápida");

console.log("A02_QUICK_SALE_TICKET_CONTRACT=PASS");
