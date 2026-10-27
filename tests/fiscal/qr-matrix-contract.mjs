import assert from "node:assert/strict";
import test from "node:test";

import { buildAeatQrPayload } from "../../fiscal/qr/aeat-qr.mjs";
import { encodeQrMatrix, renderQrSvg } from "../../fiscal/qr/qr-matrix.mjs";

const payload = buildAeatQrPayload({
  nif: "A12345678",
  numserie: "T-2026/000001",
  fecha: "27-10-2026",
  importe: "1234.50",
});

test("genera una matriz QR local válida en byte mode con tamaño estándar", () => {
  const qr = encodeQrMatrix(payload.url);
  assert.equal(qr.size % 4, 1);
  assert.ok(qr.size >= 21);
  assert.equal(qr.modules.length, qr.size);
  assert.ok(qr.modules.every((row) => row.length === qr.size && row.every((cell) => typeof cell === "boolean")));
  assert.equal(qr.modules[0][0], true);
  assert.equal(qr.modules[1][1], false);
  assert.equal(qr.modules[3][3], true);
});

test("es determinista, cambia por payload y no incrusta la URL en el SVG", () => {
  const first = encodeQrMatrix(payload.url);
  const second = encodeQrMatrix(payload.url);
  assert.deepEqual(first, second);
  const other = encodeQrMatrix(payload.url.replace("A12345678", "B12345678"));
  assert.notDeepEqual(first.modules, other.modules);
  const svg = renderQrSvg(payload.url);
  assert.match(svg, /<svg /);
  assert.match(svg, /aria-label="QR tributario"/);
  assert.match(svg, /shape-rendering="crispEdges"/);
  assert.doesNotMatch(svg, /A12345678/);
  assert.doesNotMatch(svg, /<script/i);
});

test("mantiene la zona de silencio y rechaza entrada vacía o demasiado larga", () => {
  assert.throws(() => renderQrSvg(payload.url, { quietZone: 1 }), { message: "QR_QUIET_ZONE_INVALIDA" });
  assert.throws(() => encodeQrMatrix(""), { message: "QR_PAYLOAD_VACIO" });
  assert.throws(() => encodeQrMatrix("x".repeat(2000)), { message: "QR_PAYLOAD_DEMASIADO_LARGO" });
});
