// Contrato estático A-05: el terminal compartido no puede quedar abierto por
// una renovación automática ni levantar el contexto operativo local después
// del bloqueo. El contrato comprueba la guarda que se empaqueta antes de React.
// node tests/a05/a05-session-expiry-static-contract.mjs
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const patch = read("edge-auth-patch.js");
const entry = read("source-recovery/entrada-recuperada.js");
const bundledSources = [
  ["fuente.js", read("fuente.js")],
];

assert.match(patch, /__laA05SessionIdleGuardInstalada/,
  "A-05: falta la guarda de inactividad instalada una sola vez");
assert.match(patch, /A05_INACTIVITY_TIMEOUT_MS\s*=\s*15\s*\*\s*60\s*\*\s*1000/,
  "A-05: el bloqueo del terminal no está fijado a 15 minutos");
assert.match(patch, /Date\.now\(\)\s*-\s*ultimaActividadAt\s*>=\s*A05_INACTIVITY_TIMEOUT_MS/,
  "A-05: falta la comparación de inactividad");
assert.match(patch, /\["pointerdown", "keydown", "touchstart", "mousedown", "wheel"\]/,
  "A-05: la actividad humana no cubre los eventos de interacción previstos");
assert.match(patch, /evento === "TOKEN_REFRESHED"[\s\S]*?return;/,
  "A-05: la renovación automática debe quedar fuera del reloj de actividad");
assert.match(patch, /TOKEN_REFRESHED no representa actividad humana/,
  "A-05: falta documentar que renovar el token no es actividad humana");
assert.match(patch, /auth\.signOut\(\{ scope: "local" \}\)/,
  "A-05: la caducidad no cierra la sesión local de Auth");
assert.match(patch, /localStorage\.removeItem\("almacen:" \+ clave\)/,
  "A-05: no se limpia el contexto operativo persistido");
assert.match(patch, /\["modoEmpleado", "usuarioActivoId"\]/,
  "A-05: no se retiran los identificadores operativos locales");
assert.match(patch, /if \(!sesion \|\| evento === "SIGNED_OUT"\)/,
  "A-05: SIGNED_OUT no detiene el reloj de inactividad");
assert.match(entry, /import "\.\.\/edge-auth-patch\.js";/,
  "A-05: la guarda no forma parte de la entrada reproducible del bundle");

for (const [name, source] of bundledSources) {
  assert.match(source, /__laA05SessionIdleGuardInstalada/,
    `A-05: el artefacto empaquetado ${name} no incluye la guarda`);
  assert.match(source, /15\s*\*\s*60\s*\*\s*(?:1000|1e3)/,
    `A-05: el artefacto empaquetado ${name} no conserva el límite de 15 minutos`);
  assert.match(source, /auth\.signOut\(\{\s*scope:\s*["']local["']\s*\}\)/,
    `A-05: el artefacto empaquetado ${name} no cierra la sesión local`);
}

console.log("a05-session-expiry-static-contract: OK");
