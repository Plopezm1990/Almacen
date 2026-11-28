import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync("supabase/migrations/20261129120000_abc_f6_cargos_estado_eliminacion.sql", "utf8");
const files = ["fuente.js", "source-recovery/fuente-recuperado.js"];

assert.match(sql, /add column if not exists eliminado boolean not null default false/);
assert.match(sql, /create unique index if not exists abc_cargos_empresa_nombre_activo_uq/);
assert.match(sql, /where eliminado = false/);
assert.match(sql, /create or replace function public\.abc_desactivar_cargo\(/);
assert.match(sql, /create or replace function public\.abc_reactivar_cargo\(/);
assert.match(sql, /create or replace function public\.abc_eliminar_cargo\(/);
assert.match(sql, /update public\.abc_cargo_asignaciones[\s\S]*set activo = false/);
assert.match(sql, /CARGO_ELIMINADO/);
assert.match(sql, /cargo_eliminado_no_reactivable/);
assert.doesNotMatch(sql, /delete from public\.abc_cargos/);
assert.match(sql, /pm13_listar_pantallas_efectivas/);
assert.match(sql, /if exists \(select 1 from public\.abc_cargo_asignaciones/);

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  assert.match(source, /Mostrar cargos eliminados/, `${file}: falta el filtro de cargos eliminados`);
  assert.match(source, /Eliminar cargo/, `${file}: falta la acción de eliminación`);
  assert.match(source, /abc_eliminar_cargo/, `${file}: falta la RPC de eliminación`);
  assert.match(source, /Eliminado · solo histórico/, `${file}: falta el estado histórico`);
  assert.match(source, /Sí, desactivar/, `${file}: falta la confirmación de desactivación`);
  assert.match(source, /Las asignaciones activas se cerraron/, `${file}: falta explicar la conservación histórica`);
}

console.log("PM13 P25 Ciclo de vida: desactivar, eliminar lógicamente y conservar historial OK");
