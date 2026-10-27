import assert from "node:assert/strict";
import test from "node:test";

import {
  AEAT_QR_ENDPOINT,
  QR_RENDER_CONTRACT,
  buildAeatQrPayload,
  buildAeatQrUrl,
  normalizeAeatQrInput,
} from "../../fiscal/qr/aeat-qr.mjs";

const valid = {
  nif: "A12345678",
  numserie: "T-2026/000001",
  fecha: "27-10-2026",
  importe: "1234.50",
};

test("construye una URL AEAT estable con los cuatro parámetros oficiales", () => {
  const expected = `${AEAT_QR_ENDPOINT}?nif=A12345678&numserie=T-2026%2F000001&fecha=27-10-2026&importe=1234.50`;
  assert.equal(buildAeatQrUrl(valid), expected);
  assert.equal(buildAeatQrUrl({ ...valid }), expected);
  assert.equal(buildAeatQrUrl(valid).includes("formato"), false);
  assert.equal(buildAeatQrUrl(valid).includes("idioma"), false);
});

test("codifica UTF-8 y conserva caracteres ASCII imprimibles de serie", () => {
  const url = buildAeatQrUrl({ ...valid, numserie: "SERIE 01&2/3" });
  assert.match(url, /numserie=SERIE%2001%262%2F3/);
});

test("normaliza NIF a mayúsculas y conserva el importe decimal exacto", () => {
  assert.deepEqual(normalizeAeatQrInput({ ...valid, nif: "a12345678" }), {
    ...valid,
    nif: "A12345678",
  });
  assert.equal(buildAeatQrUrl({ ...valid, importe: "0.00" }).endsWith("importe=0.00"), true);
});

test("rechaza NIF, fecha e importe fuera del contrato", () => {
  assert.throws(() => buildAeatQrUrl({ ...valid, nif: "A123" }), { code: "QR_NIF_INVALIDO" });
  assert.throws(() => buildAeatQrUrl({ ...valid, fecha: "31-02-2026" }), { code: "QR_FECHA_INVALIDA" });
  assert.throws(() => buildAeatQrUrl({ ...valid, importe: "1234567890123.45" }), { code: "QR_IMPORTE_INVALIDO" });
  assert.throws(() => buildAeatQrUrl({ ...valid, importe: "1,25" }), { code: "QR_IMPORTE_INVALIDO" });
});

test("rechaza series no imprimibles, demasiado largas y campos extra", () => {
  assert.throws(() => buildAeatQrUrl({ ...valid, numserie: "SERIE\n01" }), { code: "QR_VALOR_NO_ASCII" });
  assert.throws(() => buildAeatQrUrl({ ...valid, numserie: "x".repeat(61) }), { code: "QR_VALOR_NO_ASCII" });
  assert.throws(() => buildAeatQrUrl({ ...valid, idioma: "es" }), { code: "QR_CAMPO_NO_PERMITIDO" });
});

test("el payload visual fija rotulado, modalidad, contrato de render y modo no producción", () => {
  const payload = buildAeatQrPayload(valid);
  assert.equal(payload.url, buildAeatQrUrl(valid));
  assert.equal(payload.textLabel, "QR tributario:");
  assert.equal(payload.modalityLabel, "VERI*FACTU");
  assert.equal(payload.render.iso, "ISO/IEC 18004:2015");
  assert.equal(payload.render.errorCorrection, "M");
  assert.equal(payload.render.firstPageOnly, true);
  assert.equal(payload.production, false);
  assert.deepEqual(payload.render, QR_RENDER_CONTRACT);
});

test("no mezcla el NIF de otra empresa: el QR solo usa el snapshot recibido", () => {
  const empresaA = buildAeatQrPayload({ ...valid, nif: "A12345678" });
  const empresaB = buildAeatQrPayload({ ...valid, nif: "B12345678" });
  assert.notEqual(empresaA.url, empresaB.url);
  assert.match(empresaA.url, /nif=A12345678/);
  assert.match(empresaB.url, /nif=B12345678/);
});
