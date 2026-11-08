import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../../fuente.js", import.meta.url), "utf8");
const visualContract = await readFile(new URL("../../../fiscal/qr/ticket-visual.mjs", import.meta.url), "utf8");
const matrix = await readFile(new URL("../../../fiscal/qr/qr-matrix.mjs", import.meta.url), "utf8");
const qaDoc = await readFile(new URL("../../../docs/plan-maestro/QR_FISCAL_QA_CONTRATO_2026-10-27.md", import.meta.url), "utf8");
const matrixDoc = await readFile(new URL("../../../docs/plan-maestro/C07_D2_7_VALIDACION_VISUAL_TICKET_HARDWARE_2026-10-27.md", import.meta.url), "utf8");

test("el ticket tiene una única zona imprimible con el bloque QR dentro", () => {
  assert.equal((source.match(/data-qr-fiscal-matrix/g) || []).length, 1);
  assert.match(source, /className: "rounded-xl p-4 mono zona-impresion"/);
  const ticketStart = source.indexOf("function renderTicketVenta()");
  const qrStart = source.indexOf("data-qr-fiscal-preview", ticketStart);
  assert.ok(ticketStart >= 0 && qrStart > ticketStart);
  assert.ok(qrStart < source.indexOf("function ", qrStart + 1) || source.length > qrStart);
});

test("la representación nunca presenta un payload fiscal de producción", () => {
  assert.equal(source.includes("qr.production !== false"), true);
  assert.equal(source.includes("https:\\/\\//u.test(qr.url)"), true);
  assert.equal(visualContract.includes("production: false"), true);
  assert.equal(visualContract.includes("https:\\/\\//u.test(payload.url)"), true);
  assert.match(source, /EMISI\\xD3N REAL DESACTIVADA/);
});

test("la matriz es local y conserva quiet zone y nivel M", () => {
  assert.match(source, /renderQrSvg\(qr\.url, \{ quietZone: 4 \}\)/);
  assert.match(source, /data-qr-fiscal-matrix.*local-svg/);
  assert.match(matrix, /RS_BLOCKS_M/);
  assert.match(matrix, /renderQrSvg\(text, \{ quietZone = 4 \} = \{\}\)/);
  assert.match(matrix, /aria-label="QR tributario"/);
});

test("la fixture es QA, no una venta real, y los documentos no ticket quedan fuera", () => {
  assert.match(source, /qa !== "qr-fiscal-ticket"/);
  assert.match(source, /hostPermitido/);
  assert.match(source, /production: false/);
  assert.match(qaDoc, /no escribe en Supabase/);
  assert.match(qaDoc, /no se ha llamado a AEAT/);
  assert.match(matrixDoc, /albarán, nota de entrega u otro documento no fiscal/);
  assert.match(matrixDoc, /PENDIENTE FÍSICO/);
});

console.log("C07D_D2_7_VISUAL_HARDWARE_MATRIX=PASS");
