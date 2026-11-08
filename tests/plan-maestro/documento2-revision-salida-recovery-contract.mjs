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
  assert.match(texto, /const pendienteExistente = Boolean\(pendiente\)/, `${archivo}: falta distinguir una recuperación de un cobro nuevo`);
  assert.match(texto, /const checkoutYaConocido = pendienteExistente[\s\S]*estadoPrevio\.checkouts\.some/, `${archivo}: falta reconocer el checkout ya preparado`);
  assert.match(texto, /const preparado = checkoutYaConocido \? null : await rpcA02ConRecuperacion\(supabase, "abc_preparar_checkout_cuenta"/, `${archivo}: la recuperación vuelve a preparar el checkout y puede provocar operation_id_conflict`);
  assert.match(texto, /if \(ready && !skipSaveRef\.current\) saveKey\("pagosFacturas", pagosFacturas\)/, `${archivo}: pagosFacturas no respeta el bloqueo de hidratación inicial`);
  assert.match(texto, /\["pagosFacturas", "arqueos", "movimientosCaja", "devoluciones"\]\.includes\(key\)/, `${archivo}: los ledgers server-side siguen intentando guardarse como bloque local`);
}

console.log("DOCUMENTO2_REVISION_SALIDA_RECOVERY=PASS");
