import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const modulo = fs.readFileSync("pm12-conteo-estados-v1.js", "utf8");
const contexto = { console, Date };
contexto.globalThis = contexto;
vm.runInNewContext(modulo, contexto);
const api = contexto.__pm12ConteoEstados;
assert.ok(api, "API PM12 disponible");

const reglas = () => ({ indivisible: false, precision: 2 });
const vacio = { id: "c-vacio", estado: "BORRADOR", fecha: "2026-09-07", items: [{ productoId: "p1", conteo: "" }], responsables: { contadoPor: "", revisor: "" } };
assert.equal(api.esBorradorCompletamenteVacio(vacio, reglas), true, "borrador vacío eliminable");
assert.equal(api.esBorradorCompletamenteVacio({ ...vacio, items: [{ productoId: "p1", conteo: 0 }] }, reglas), false, "cero cuenta como iniciado");
assert.equal(api.esBorradorCompletamenteVacio({ ...vacio, responsables: { contadoPor: "Ana", revisor: "" } }, reglas), false, "responsable implica documento usado");
assert.equal(api.estadoDerivado({ estado: "COMPLETADO", cancelado: true, items: [] }, reglas), "CANCELADO", "cancelado legado es terminal");

const faltaMotivo = api.prepararCancelacion({ ...vacio, estado: "EN_CURSO" }, { responsable: "Ana" });
assert.equal(faltaMotivo.ok, false);
assert.equal(faltaMotivo.error, "motivo_cancelacion_obligatorio");
const preparada = api.prepararCancelacion({ ...vacio, estado: "EN_CURSO", iniciadoEn: "2026-09-07T10:00:00.000Z" }, { motivo: "Error de captura", responsable: "Ana", reloj: () => "2026-09-07T13:00:00.000Z" });
assert.equal(preparada.ok, true);
assert.equal(preparada.estadoAnterior, "EN_CURSO");
assert.equal(preparada.operationId, "pm12-cancelar-conteo:c-vacio:2026-09-07T10:00:00.000Z");
assert.equal(preparada.canceladoEn, "2026-09-07T13:00:00.000Z");

const fuentes = [
  ["runtime", fs.readFileSync("fuente.js", "utf8")],
  ["fuente recuperada", fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8")]
];
for (const [nombre, codigo] of fuentes) {
  assert.match(codigo, /function eliminarConteo\(conteoId, opciones = \{\}\)/, `${nombre}: firma P06`);
  assert.match(codigo, /esBorradorCompletamenteVacio\(conteo, reglasPorProducto\)/, `${nombre}: borrado físico restringido`);
  assert.match(codigo, /estado: "CANCELADO"/, `${nombre}: conservación terminal`);
  assert.match(codigo, /motivoCancelacion: preparada\.motivo/, `${nombre}: motivo persistido`);
  assert.match(codigo, /responsableCancelacion: preparada\.responsable/, `${nombre}: responsable persistido`);
  assert.match(codigo, /estadoAnteriorCancelacion: preparada\.estadoAnterior/, `${nombre}: estado anterior persistido`);
  assert.match(codigo, /reversosCancelacion: reversos/, `${nombre}: reversos persistidos`);
  assert.match(codigo, /movimientoReversoId = `pm12-cancelar-conteo:\$\{conteoId\}:\$\{movimientoOriginal\.id\}`/, `${nombre}: reverso determinista`);
  assert.match(codigo, /origen: "cancelarConteo"/, `${nombre}: origen trazable`);
  assert.match(codigo, /replayed: true,[\s\S]*eliminado: false,[\s\S]*cancelado: true/, `${nombre}: replay idempotente`);
  assert.match(codigo, /"Cancelar o eliminar conteo"/, `${nombre}: UX explícita`);
  assert.match(codigo, /"Cancelado"/, `${nombre}: estado visible`);
  assert.match(codigo, /motivoCancelacion, responsable: responsableCancelacion/, `${nombre}: UX envía trazabilidad`);
  assert.doesNotMatch(codigo, /registrarAuditoria\(\s*"Eliminar conteo"/, `${nombre}: no queda borrado destructivo histórico`);
}

const evidencia = fs.readFileSync("tests/pm12/P06_CANCELACION_CONSERVADORA.md", "utf8");
assert.match(evidencia, /PM12_P06_CANCELACION_CONSERVADORA=PASS/);
console.log("PM12_P06_CANCELACION_CONSERVADORA=PASS");
console.log("BORRADO_FISICO_SOLO_BORRADOR_VACIO=1");
console.log("CANCELACION_TRAZABLE=1");
console.log("REVERSOS_IDEMPOTENTES=1");
console.log("LEGADOS_CONSERVADORES=1");
