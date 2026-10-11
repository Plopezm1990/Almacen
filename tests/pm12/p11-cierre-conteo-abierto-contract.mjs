import assert from "node:assert/strict";
import fs from "node:fs";

const runtime = fs.readFileSync("fuente.js", "utf8");
const recuperada = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");

for (const [nombre, codigo] of [["runtime", runtime], ["fuente recuperada", recuperada]]) {
  assert.match(codigo, /const conteosAbiertos = .*filter\(\(c22\) => !c22\.completado && c22\.cancelado !== true\)[\s\S]*const conteoAbierto = conteosAbiertos\[0\] \|\| null/, `${nombre}: el conteo abierto debe abrirse automáticamente y excluir cancelados`);
  assert.match(codigo, /puedeFinalizarConteo = false/, `${nombre}: el cierre debe recibir una autorización explícita`);
  assert.match(codigo, /Solo Propietario puede finalizar un conteo\./, `${nombre}: el cierre debe estar restringido al Propietario`);
  assert.match(codigo, /cierre_no_autorizado/, `${nombre}: la lógica debe rechazar el cierre no autorizado`);
  assert.match(codigo, /registrarAuditoria\("Finalizar conteo"/, `${nombre}: el cierre debe conservar auditoría`);
  assert.match(codigo, /puedeFinalizarConteo: miPerfil\?\.rol === "Propietario"/, `${nombre}: la pantalla debe pasar el rol del perfil`);
}

console.log("PM12_P11_CONTEO_ABIERTO_UI=PASS");
console.log("PM12_P11_CIERRE_PROPIETARIO=PASS");
console.log("PM12_P11_AUDITORIA=PASS");
