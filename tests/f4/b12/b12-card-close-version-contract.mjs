import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const sources = [
  path.join(root, "fuente.js"),
  path.join(root, "source-recovery/fuente-recuperado.js")
];

for (const file of sources) {
  const source = fs.readFileSync(file, "utf8");
  assert.match(
    source,
    /const versionCierre = estadoPrevio\.cuentaVersion \?\? recuperada\.cuentaVersion;/,
    `${file}: el cierre no usa la versión autoritativa posterior al cobro`
  );
  assert.match(
    source,
    /cerrarCuentaPagadaF4\(recuperada\.cuentaId, checkoutCompletado\.id, estadoFinal\.cuentaVersion \?\? recuperada\.cuentaVersion, terminal\)/,
    `${file}: la ruta de cobro efectivo conserva la versión actual del servidor`
  );
  assert.match(
    source,
    /No se pudo cerrar la cuenta pagada:/,
    `${file}: el fallo de cierre no debe caer en el mensaje genérico de efectivo`
  );
}

console.log("F4_B12_CARD_CLOSE_VERSION_CONTRACT=PASS");
