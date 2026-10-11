import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const motor = fs.readFileSync("pm12-conteo-estados-v1.js", "utf8");
const runtime = fs.readFileSync("fuente.js", "utf8");
const recuperada = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");

const contexto = { globalThis: {} };
vm.createContext(contexto);
vm.runInContext(motor, contexto);
const api = contexto.globalThis.__pm12ConteoEstados;
assert.ok(api && typeof api.fusionarConteoServidor === "function", "el motor debe exponer la fusión de cierres");

const cerrado = { id: "c1", empresaId: "e1", localId: "l1", completado: true, estado: "COMPLETADO", cerradoEn: "2026-10-11T10:00:00.000Z", cierre: { responsableId: "pm11" }, items: [{ productoId: "p1", conteo: 1 }] };
const abiertoRemoto = { id: "c1", empresaId: "e1", localId: "l1", completado: false, estado: "BORRADOR", items: [{ productoId: "p1", conteo: 1 }] };
const conservado = api.fusionarConteoServidor(cerrado, abiertoRemoto);
assert.equal(conservado.completado, true, "la recarga no debe reabrir un cierre local válido");
assert.equal(conservado._pm12CierreLocalPendiente, true, "el documento remoto abierto debe quedar identificado para revisión");
assert.equal(!conservado.completado, false, "un cierre conservado desbloquea el almacén");

const cerradoRemoto = api.fusionarConteoServidor({ ...abiertoRemoto }, { ...cerrado });
assert.equal(cerradoRemoto.completado, true, "un cierre confirmado en servidor prevalece al recargar");

for (const [nombre, codigo] of [["runtime", runtime], ["fuente recuperada", recuperada]]) {
  assert.match(codigo, /fusionarConteoServidor/, `${nombre}: debe conservar cierres locales frente a documentos remotos abiertos`);
  assert.match(codigo, /replayed: true/, `${nombre}: el doble envío debe ser idempotente`);
  assert.match(codigo, /const almacenCongelado = !!conteoAbierto/, `${nombre}: el bloqueo debe depender solo de conteos realmente abiertos`);
  assert.match(codigo, /filter\(\(c22\) => c22\.completado/, `${nombre}: el dashboard debe contar solo cierres completados`);
}

console.log("PM12_P13_CIERRE_RELOAD=PASS");
console.log("PM12_P13_ALMACEN_DESBLOQUEADO=PASS");
console.log("PM12_P13_DASHBOARD=PASS");
console.log("PM12_P13_IDEMPOTENCIA=PASS");
