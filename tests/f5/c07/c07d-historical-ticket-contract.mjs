import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runtime = readFileSync(new URL("../../../fuente.js", import.meta.url), "utf8");
const recovered = readFileSync(new URL("../../../source-recovery/fuente-recuperado.js", import.meta.url), "utf8");

for (const [name, source] of [["RUNTIME", runtime], ["RECOVERED", recovered]]) {
  for (const marker of [
    'select("id,pedido_id,precio_unitario,base,impuestos,total,snapshot_comercial")',
    'from("pedidos_tpv").select("id,cuenta_id")',
    'from("checkouts").select("id,cuenta_id,estado,completed_at")',
    'from("pagos").select("checkout_id,medio,estado,importe_objetivo,importe_recibido,cambio_entregado,created_at")',
    'from("checkout_ventas").select("checkout_id,venta_fiscal_id,importe_objetivo")',
    "const datosTicketHistorico = (datos)",
    "async function abrirTicketHistorial(v22)",
    "leerEstadoFiscalC07D(v22.cuentaId)",
    'production: false'
  ]) {
    assert.ok(source.includes(marker), `${name}: falta ${marker}`);
  }
}

console.log("C07D_HISTORICAL_TICKET_CONTRACT=PASS");
