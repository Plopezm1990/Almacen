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
  "totalLineaRapida",
  "precioNeto(productoRapida)",
  "const cuentaCerradaRapida",
  "Pago confirmado, pero la cuenta sigue abierta",
  "const cuentaCerradaServidor",
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
assert.match(source, /const pedidoDirectoId = datos\?\.pedido_id \|\| datos\?\.pedidoId \|\| null;/, "El historial no recupera la cuenta por pedido_id o pedidoId cuando falta el snapshot de línea");
assert.match(source, /const cuentaId = pedido\?\.cuenta_id \|\| pedidoDirecto\?\.cuenta_id \|\| datos\?\.cuenta_id \|\| datos\?\.cuentaId \|\| null;/, "El historial no aplica la cadena completa de identificadores de cuenta");
assert.match(quick, /const ventaOperacionIdRapida = documentoFiscalRapida\?\.venta_fiscal_id\s*\|\|\s*\(lineaCanonicaRapida \? `abc\.stock\.consume\.\$\{lineaCanonicaRapida\}`\s*:\s*null\)\s*\|\|\s*cobro\.ventaId/, "El ticket inmediato no prioriza la operación canónica frente al identificador técnico del cobro");
assert.match(quick, /referencia: `V-\$\{fechaVentaRapida\.replaceAll\("-", ""\)\}-\$\{String\(ventaOperacionIdRapida\)/, "La referencia inmediata no se deriva del identificador canónico de la venta");
assert.match(source, /const lineaIds = \[\.\.\.new Set\(movs\.map\(\(m4\) => m4\?\.datos\?\.linea_id \|\| m4\?\.datos\?\.lineaId\)/, "La sincronización no acepta identificadores de línea históricos en snake_case y camelCase");

console.log("A02_QUICK_SALE_TICKET_CONTRACT=PASS");
