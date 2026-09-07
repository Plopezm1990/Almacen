import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const motor = fs.readFileSync("pm12-conteo-estados-v1.js", "utf8");
const runtime = fs.readFileSync("fuente.js", "utf8");
const recuperada = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");

const contexto = { globalThis: {} };
vm.createContext(contexto);
vm.runInContext(motor, contexto);
const api = contexto.globalThis.__pm12ConteoEstados;
assert.ok(api, "el motor PM12 debe estar disponible");

const base = {
  responsables: { contadoPor: "María" },
  items: [
    { productoId: "p1", conteo: "" },
    { productoId: "p2", conteo: "" }
  ]
};
assert.equal(api.validarCierre(base).error, "conteo_vacio", "un conteo vacío nunca se cierra");
assert.equal(api.validarCierre({ ...base, items: [{ productoId: "p1", conteo: 0 }, base.items[1]] }).error, "cobertura_incompleta", "cero cuenta como captura, no como vacío");
assert.equal(api.validarCierre({ ...base, items: [{ productoId: "p1", conteo: 0 }, base.items[1]] }, { confirmarParcial: true, motivoParcial: "Zona inaccesible" }).estado, "PARCIAL");
assert.equal(api.validarCierre({ ...base, items: [{ productoId: "p1", conteo: 0 }, { productoId: "p2", conteo: 3 }] }).estado, "COMPLETADO");

for (const [nombre, codigo] of [["runtime", runtime], ["fuente recuperada", recuperada]]) {
  assert.match(codigo, /conteo_vacio: "Aún no has contado ningún producto/);
  assert.match(codigo, /title: "Cerrar conteo parcial"/);
  assert.match(codigo, /" productos contados"/);
  assert.match(codigo, /El valor 0 cuenta como cantidad válida\./);
  assert.doesNotMatch(codigo, /onClick: \(\) => finalizarConteo\(activo\.id\)/, `${nombre}: no debe quedar el cierre directo antiguo`);
}
const motorPos = html.indexOf('<script src="./pm12-conteo-estados-v1.js"></script>');
const appPos = html.indexOf('<script type="module" src="./fuente.js"></script>');
assert.ok(motorPos >= 0 && appPos > motorPos, "el motor PM12 debe cargarse antes de la aplicación");

console.log("PM12_P04_OK=1");
console.log("VACIO_BLOQUEADO=1");
console.log("CERO_ES_VALIDO=1");
console.log("PARCIAL_CONFIRMADO_CON_MOTIVO=1");
console.log("COMPLETO_SIN_CONFIRMACION_EXTRA=1");
