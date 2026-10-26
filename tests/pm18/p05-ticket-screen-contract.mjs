import assert from "node:assert/strict";
import fs from "node:fs";

const fuente = fs.readFileSync("fuente.js", "utf8");

assert.match(fuente, /mostrarTicketPantallaF4/);
assert.match(fuente, /data-tpv-ticket-screen/);
assert.match(fuente, /Ver ticket en pantalla/);
assert.match(fuente, /Vista en pantalla · no crea otra venta ni otro documento/);
assert.match(fuente, /lineasTicketPantallaF4\.map/);
assert.match(fuente, /qrFiscalSvg/);
assert.match(fuente, /Simulador QA; no presentado a AEAT/);

console.log("PASS: vista de ticket en pantalla TPV QA P18");
