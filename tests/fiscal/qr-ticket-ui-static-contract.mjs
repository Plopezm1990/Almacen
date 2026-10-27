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

test("el ticket rechaza payloads sin HTTPS o marcados como producción", () => {
  assert.equal(source.includes("qr.production !== false"), true);
  assert.equal(source.includes("https:\\/\\//u.test(qr.url)"), true);
});
