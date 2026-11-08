import fs from "node:fs";
import assert from "node:assert/strict";

const files = ["fuente.js", "source-recovery/fuente-recuperado.js"];
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  assert.match(source, /function ConfigCargos\(/, `${file}: falta el componente de cargos`);
  assert.match(source, /\[\"cargos\", \"Cargos y permisos\"\]/, `${file}: falta la sección de cargos`);
  assert.match(source, /seccion === \"cargos\" .*ConfigCargos/, `${file}: falta el render de la sección de cargos`);
  assert.match(source, /ConfiguracionLocal, \{ empresa: empresaDelLocalActivo[\s\S]*\bempleados(?:,|\s*\})/, `${file}: falta pasar empleados al panel de cargos`);
  assert.match(source, /Cargos personalizados/, `${file}: falta el estado de cargos personalizados`);
  assert.match(source, /Roles y cargos actuales/, `${file}: falta el listado de roles y cargos`);
}

console.log("PM13 P08 Cargos y permisos: contrato de UI OK");
