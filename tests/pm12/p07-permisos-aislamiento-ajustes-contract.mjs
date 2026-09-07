import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const motor = fs.readFileSync("pm12-conteo-estados-v1.js", "utf8");
const contexto = { globalThis: {} };
vm.createContext(contexto);
vm.runInContext(motor, contexto);
const api = contexto.globalThis.__pm12ConteoEstados;
assert.ok(api, "motor PM12 disponible");
assert.equal(typeof api.autorizarAjusteInventario, "function", "política P07 exportada");
assert.equal(Array.from(api.ROLES_AJUSTE_INVENTARIO).sort().join("|"), "Encargado|Propietario", "roles privilegiados exactos");

const base = {
  actorNombre: "Responsable",
  empresaId: "empresa-a",
  localId: "local-1",
  conteoEmpresaId: "empresa-a",
  conteoLocalId: "local-1"
};

for (const rol of ["Propietario", "Encargado"]) {
  const r = api.autorizarAjusteInventario({ ...base, rol });
  assert.equal(r.ok, true, `${rol} autorizado`);
  assert.equal(r.empresaId, "empresa-a");
  assert.equal(r.localId, "local-1");
}

for (const rol of ["Cajero/a", "Churrero/a", "Camarero/a", "Estándar", "Básico", ""]) {
  const r = api.autorizarAjusteInventario({ ...base, rol });
  assert.equal(r.ok, false, `${rol || "sin rol"} no puede ajustar`);
  assert.equal(r.error, "ajuste_no_autorizado");
}

assert.equal(api.autorizarAjusteInventario({ ...base, rol: "Propietario", actorNombre: "", actorId: "" }).error, "actor_ajuste_obligatorio");
assert.equal(api.autorizarAjusteInventario({ ...base, rol: "Propietario", empresaId: "" }).error, "contexto_ajuste_incompleto");
assert.equal(api.autorizarAjusteInventario({ ...base, rol: "Propietario", localId: "" }).error, "contexto_ajuste_incompleto");
assert.equal(api.autorizarAjusteInventario({ ...base, rol: "Propietario", localId: "todos", conteoLocalId: "todos" }).error, "todos_no_es_destino");
assert.equal(api.autorizarAjusteInventario({ ...base, rol: "Propietario", todosLosLocales: true }).error, "todos_no_es_destino");
assert.equal(api.autorizarAjusteInventario({ ...base, rol: "Propietario", conteoEmpresaId: "" }).error, "identidad_conteo_incompleta");
assert.equal(api.autorizarAjusteInventario({ ...base, rol: "Propietario", conteoLocalId: "" }).error, "identidad_conteo_incompleta");
assert.equal(api.autorizarAjusteInventario({ ...base, rol: "Propietario", conteoEmpresaId: "empresa-b" }).error, "empresa_no_coincide");
assert.equal(api.autorizarAjusteInventario({ ...base, rol: "Propietario", conteoLocalId: "local-2" }).error, "local_no_coincide");

const fuentes = [
  ["runtime", fs.readFileSync("fuente.js", "utf8")],
  ["fuente recuperada", fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8")]
];

for (const [nombre, codigo] of fuentes) {
  assert.match(codigo, /crearLogicaConteos\(\{ productos, setProductos, conteos, setConteos, movimientos, setMovimientos, registrarAuditoria, localActivoId, empresaActivaId, obtenerContextoActor \}\)/, `${nombre}: contexto inyectado en lógica`);
  assert.match(codigo, /empresaActivaId && conteo\.empresaId && conteo\.empresaId !== empresaActivaId/, `${nombre}: aislamiento empresa`);
  assert.match(codigo, /empresaId: empresaActivaId \|\| null/, `${nombre}: identidad empresa en nuevos conteos`);
  assert.match(codigo, /function autorizarMutacionAjustes\(conteo\)/, `${nombre}: guarda interna`);
  assert.match(codigo, /function aplicarAjustes\([\s\S]*?const permisoAjuste = autorizarMutacionAjustes\(conteo\);[\s\S]*?if \(!permisoAjuste\.ok\) return respuestaPermisoAjuste/, `${nombre}: aplicar protegido antes de mutar`);
  assert.match(codigo, /function revertirUltimaAplicacion\([\s\S]*?autorizarMutacionAjustes\(conteo\)/, `${nombre}: reversión protegida`);
  assert.match(codigo, /const generados = movimientos\.filter\([\s\S]*?if \(generados\.length > 0\) \{[\s\S]*?autorizarMutacionAjustes\(conteo\)/, `${nombre}: cancelación con reversos protegida`);
  assert.match(codigo, /ajustesActor: \{ id: permisoAjuste\.actorId \|\| null, nombre: permisoAjuste\.actorNombre \|\| "", rol: permisoAjuste\.rol \}/, `${nombre}: actor trazado`);
  assert.match(codigo, /ajustesEmpresaId: permisoAjuste\.empresaId, ajustesLocalId: permisoAjuste\.localId/, `${nombre}: empresa/local trazados`);
  assert.match(codigo, /function obtenerContextoAjusteConteo\(\)/, `${nombre}: contexto UI resuelto`);
  assert.match(codigo, /puedeAplicarAjustesInventario/, `${nombre}: permiso calculado para UX`);
  assert.match(codigo, /solo Propietario o Encargado puede aplicar ajustes al stock/i, `${nombre}: UX explica restricción`);
  assert.match(codigo, /puedeAplicar: puedeAplicarAjustes/, `${nombre}: permiso llega al bloque de acción`);
}

const evidencia = fs.readFileSync("tests/pm12/P07_PERMISOS_AISLAMIENTO_AJUSTES.md", "utf8");
assert.match(evidencia, /PM12_P07_PERMISOS_AISLAMIENTO_AJUSTES=PASS/);

console.log("PM12_P07_PERMISOS_AISLAMIENTO_AJUSTES=PASS");
console.log("ROLES_AJUSTE=PROPIETARIO_ENCARGADO");
console.log("TODOS_NO_ES_DESTINO=1");
console.log("AISLAMIENTO_EMPRESA_LOCAL=1");
console.log("GUARDA_DENTRO_MUTACION=1");
console.log("TRAZABILIDAD_ACTOR_CONTEXTO=1");
