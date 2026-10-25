import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fuentes = ["fuente.js", "source-recovery/fuente-recuperado.js"].map((archivo) => ({
  archivo,
  texto: fs.readFileSync(path.join(root, archivo), "utf8")
}));

for (const { archivo, texto } of fuentes) {
  assert.match(texto, /data-tpv-fase5-cobro/, `${archivo}: falta el contenedor de cobro de la Fase 5`);
  assert.match(texto, /data-tpv-fase5-payment-state/, `${archivo}: falta el estado visible del pago`);
  assert.match(texto, /data-tpv-fase5-final-action/, `${archivo}: falta la acción final identificable`);
  assert.match(texto, /Confirmar efectivo/, `${archivo}: falta el texto explícito de confirmar efectivo`);
  assert.match(texto, /Confirmado/, `${archivo}: falta el total confirmado`);
  assert.match(texto, /Pendiente/, `${archivo}: falta el total pendiente`);
  assert.match(texto, /Procesando el pago/, `${archivo}: falta el estado de procesamiento`);
  assert.match(texto, /no inicies otro cobro/, `${archivo}: falta el bloqueo visible frente a pago incierto`);
  assert.match(texto, /teclaEfectivoCobroF5/, `${archivo}: falta el teclado contextual de efectivo`);
  assert.match(texto, /data-tpv-fase5-cash-keypad/, `${archivo}: falta el contenedor del teclado de efectivo`);
  assert.match(texto, /inputMode: "decimal"/, `${archivo}: falta la entrada decimal accesible`);
  assert.match(texto, /billetesRapidosF4/, `${archivo}: se perdió la selección rápida de billetes`);
  assert.match(texto, /no inicia el cobro/, `${archivo}: el teclado no declara su aislamiento del cobro`);
  assert.match(texto, /procesandoCobroF4/, `${archivo}: falta el bloqueo durante procesamiento`);
  assert.match(texto, /data-tpv-fase5-caja/, `${archivo}: falta el contenedor de caja de la Fase 5`);
  assert.match(texto, /Movimientos, arqueo y cierre son tareas distintas/, `${archivo}: no se separan movimientos, arqueo y cierre`);
  assert.match(texto, /ejecutarCobroF4/, `${archivo}: falta la acción de cobro ya protegida por estado`);
}

console.log("DOCUMENTO2_FASE5_COBRO_CAJA=PASS");
