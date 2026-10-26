import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fuentes = ["fuente.js", "source-recovery/fuente-recuperado.js"].map((archivo) => ({
  archivo,
  texto: fs.readFileSync(path.join(root, archivo), "utf8")
}));
const cssMarker = "/* Documento 2 · cobro, documentos, cocina y caja (A11-A16) */";
let cssBase = null;

for (const { archivo, texto } of fuentes) {
  const cssStart = texto.indexOf(cssMarker);
  const cssEnd = texto.indexOf("@media print", cssStart);
  assert.ok(cssStart >= 0 && cssEnd > cssStart, `${archivo}: falta el bloque visual A11-A16`);
  const css = texto.slice(cssStart, cssEnd);
  if (cssBase === null) cssBase = css;
  assert.equal(css, cssBase, `${archivo}: el CSS A11-A16 no coincide con el espejo`);

  assert.match(texto, /tpv-a11-payment-card/, `${archivo}: falta el marco visual de cobro A11`);
  assert.match(texto, /data-tpv-pdf-section": "A11"/, `${archivo}: falta la sección PDF A11`);
  assert.match(texto, /data-tpv-fase5-payment-state/, `${archivo}: falta el estado visible del pago`);
  assert.match(texto, /data-tpv-fase5-final-action/, `${archivo}: falta la acción final de cobro`);
  assert.match(texto, /data-tpv-fase5-cash-keypad/, `${archivo}: falta el teclado contextual de efectivo`);
  assert.match(texto, /Factura a empresa/, `${archivo}: falta la capacidad de factura a empresa`);
  assert.match(texto, /Ticket por correo/, `${archivo}: falta la capacidad de ticket por correo`);
  assert.match(texto, /Resultado pendiente o incierto|no se permite iniciar otro cobro|no inicies otro cobro/, `${archivo}: falta el bloqueo de pago incierto`);

  assert.match(texto, /tpv-a13-voucher-card/, `${archivo}: falta el marco visual de vales A13`);
  assert.match(texto, /data-tpv-pdf-section": "A13"/, `${archivo}: falta la sección PDF A13`);
  assert.match(texto, /Vale regalo/, `${archivo}: falta el flujo de vale regalo`);
  assert.match(texto, /Borrar cálculo/, `${archivo}: falta el reinicio de calculadora`);

  assert.match(texto, /tpv-a15-kitchen-view/, `${archivo}: falta el marco visual de cocina A15`);
  assert.match(texto, /tpv-a15-comanda-card/, `${archivo}: falta la tarjeta visual de comanda A15`);
  assert.match(texto, /data-tpv-pdf-section": "A15"/, `${archivo}: falta la sección PDF A15`);
  assert.match(texto, /data-tpv-kitchen-product/, `${archivo}: falta la jerarquía de producto de cocina`);
  assert.match(texto, /data-tpv-kitchen-quantity/, `${archivo}: falta la jerarquía de cantidad de cocina`);
  assert.match(texto, /Cocina y comandas/, `${archivo}: falta la pantalla de cocina`);
  assert.match(texto, /No mueve stock, no cobra ni emite fiscalidad/, `${archivo}: falta el límite operativo de cocina`);

  assert.match(texto, /tpv-a16-cash-view/, `${archivo}: falta el marco visual de caja A16`);
  assert.match(texto, /data-tpv-pdf-section": "A16"/, `${archivo}: falta la sección PDF A16`);
  assert.match(texto, /Movimientos, arqueo y cierre son tareas distintas/, `${archivo}: falta la separación de tareas de caja`);
  assert.match(texto, /Faltan/, `${archivo}: falta la visualización de diferencias de arqueo`);
}

assert.match(cssBase, /min-height: 96px/, "A11: falta el resumen de 96px");
assert.match(cssBase, /min-height: 64px/, "A11: falta la acción final de 64px");
assert.match(cssBase, /min-height: 56px/, "A11: faltan teclas de efectivo de 56px");
assert.match(cssBase, /font-size: 22px/, "A15: falta producto de 22px");
assert.match(cssBase, /font-size: 28px/, "A15/A11: falta cantidad o importe de 28px");
assert.match(cssBase, /width: min\(100%, 980px\)/, "A11/A15/A16: falta el ancho de lectura");

console.log("DOCUMENTO2_A11_A16_PUESTO=PASS");
