import assert from "node:assert/strict";
import fs from "node:fs";

const files = ["fuente.js", "source-recovery/fuente-recuperado.js"];

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const logicStart = source.indexOf("function crearLogicaPersonal({");
  const logicEnd = source.indexOf("function crearLogicaTurnos({", logicStart);
  const uiStart = source.indexOf("function Personal({");
  const uiEnd = source.indexOf("function Turnos({", uiStart);
  assert.ok(logicStart >= 0 && logicEnd > logicStart, `${file}: lógica Personal no encontrada`);
  assert.ok(uiStart >= 0 && uiEnd > uiStart, `${file}: UI Personal no encontrada`);

  const logic = source.slice(logicStart, logicEnd);
  const ui = source.slice(uiStart, uiEnd);

  assert.match(logic, /if \(!motorPersonalRemotoDisponiblePM13\(\)\) return errorValidacionPM10\("contexto_no_autorizado", "ausencia"/,
    `${file}: registrar ausencia no falla cerrado sin servidor`);
  assert.match(logic, /pm13_registrar_ausencia/,
    `${file}: falta persistencia remota de registrar ausencia`);
  assert.match(logic, /pm13_anular_ausencia/,
    `${file}: falta persistencia remota de anular ausencia`);

  assert.match(ui, /pm13_resolver_cargo_permiso/,
    `${file}: la UI no resuelve permisos de acción`);
  assert.match(ui, /PM13_AUSENCIA_REGISTRAR/,
    `${file}: falta clave de registrar ausencia`);
  assert.match(ui, /PM13_AUSENCIA_ANULAR/,
    `${file}: falta clave de anular ausencia`);
  assert.match(ui, /puedeRegistrarAusenciaPM13 && .*Registrar ausencia/s,
    `${file}: el control de registrar ausencia no está condicionado`);
  assert.match(ui, /puedeAnularAusenciaPM13 && .*aria-label": "Anular ausencia"/s,
    `${file}: el control de anular ausencia no está condicionado`);
  assert.match(source, /localId: localActivoId/,
    `${file}: la UI no recibe el local activo para resolver el permiso`);
}

console.log("PM13 P21 Ausencias: UI, RPC de resolución y fallback offline fail-closed OK");
