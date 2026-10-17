import fs from "node:fs";
import assert from "node:assert/strict";

for (const file of ["fuente.js", "source-recovery/fuente-recuperado.js"]) {
  const source = fs.readFileSync(file, "utf8");
  assert.match(source, /pm13_listar_cargo_permisos/, `${file}: falta cargar permisos del cargo`);
  assert.match(source, /pm13_configurar_cargo_permiso/, `${file}: falta guardar permisos del cargo mediante RPC`);
  assert.match(source, /PM13_CARGO_PERMISOS_LABELS/, `${file}: falta el catálogo visual de permisos`);
  assert.match(source, /p_motivo: motivoPermiso\.trim\(\)/, `${file}: falta exigir motivo auditable`);
  assert.match(source, /Permisos protegidos del cargo/, `${file}: falta el editor de permisos`);
  assert.match(source, /value: "permitido"/, `${file}: falta la opción permitida`);
  assert.match(source, /value: "denegado"/, `${file}: falta la opción denegada`);
  assert.match(source, /Solo se guardan las reglas que cambies/, `${file}: el editor debe evitar escrituras masivas`);
}

console.log("PM13 P20 Editor de permisos de cargos: contrato de UI y RPC OK");
