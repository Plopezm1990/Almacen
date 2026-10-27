import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../fuente.js", import.meta.url), "utf8");

test("el historial conserva el payload fiscal asociado a la venta", () => {
  assert.match(source, /qrFiscal:\s*lineas\[0\]\?\.qrFiscal\s*\|\|\s*null/);
});

test("la fixture visual QR solo puede activarse en preview QA o localhost", () => {
  assert.match(source, /get\("qa"\)/);
  assert.match(source, /qa !== "qr-fiscal-ticket"/);
  assert.match(source, /deploy-preview-\\d\+--/u);
  assert.match(source, /production: false/);
});

test("el ticket muestra el payload solo como QA y lo incluye en la zona imprimible", () => {
  assert.match(source, /data-qr-fiscal-preview/);
  assert.match(source, /data-qr-fiscal-matrix/);
  assert.match(source, /renderQrSvg\(qr\.url/);
  assert.match(source, /EMISI\\xD3N REAL DESACTIVADA/);
  assert.match(source, /Matriz QR generada localmente a partir del payload verificable de QA/);
  assert.match(source, /className: "rounded-xl p-4 mono zona-impresion"/);
});

test("la impresión del ticket desancla el modal y conserva todo el contenido", () => {
  assert.match(source, /claseImpresion: "modal-ticket-impresion"/);
  assert.match(source, /\.modal-ticket-impresion-dialog/);
    assert.match(source, /html, body, #root \{ margin: 0 !important; padding: 0 !important; height: var\(--ticket-print-height, auto\) !important;/);
  assert.match(source, /\.zona-impresion \{[\s\S]*?position: static !important;/);
    assert.match(source, /function imprimirTicketVenta\(\)/);
    assert.match(source, /ticket-printing/);
    assert.match(source, /requestAnimationFrame\(\(\) =>/);
    assert.match(source, /--ticket-print-height/);
    assert.match(source, /window\.addEventListener\("afterprint"/);
    assert.match(source, /onClick: imprimirTicketVenta/);
});

test("el ticket rechaza payloads sin HTTPS o marcados como producción", () => {
  assert.equal(source.includes("qr.production !== false"), true);
  assert.equal(source.includes("https:\\/\\//u.test(qr.url)"), true);
});
