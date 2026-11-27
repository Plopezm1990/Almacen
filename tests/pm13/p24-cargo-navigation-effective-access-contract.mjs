import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261128150000_abc_f6_cargos_nombres_navegacion_excepciones.sql"), "utf8");
const lifecycle = fs.readFileSync(path.join(root, "supabase/migrations/20261128160000_abc_f6_cargos_estado_eliminacion.sql"), "utf8");
const source = fs.readFileSync(path.join(root, "fuente.js"), "utf8");
const recovered = fs.readFileSync(path.join(root, "source-recovery/fuente-recuperado.js"), "utf8");

assert.match(migration, /create or replace function public\.pm13_listar_pantallas_efectivas\(/);
assert.match(migration, /abc_cargo_asignaciones[\s\S]*abc_cargo_pantallas/);
assert.match(migration, /c\.activo = true/);
assert.match(migration, /cargo_no_asignado/);
assert.match(migration, /rol_tecnico_compatibilidad/);
assert.match(migration, /grant execute on function public\.pm13_listar_pantallas_efectivas\([^\n]+\) to authenticated/);
assert.match(migration, /drop trigger if exists pm13_cargo_guard_nombre/);
assert.match(lifecycle, /c\.eliminado = false/);
assert.match(lifecycle, /Si una cuenta tuvo una asignación personalizada/);

// La excepción solo se evalúa después de validar la asignación y la pantalla.
assert.ok(migration.indexOf("cargo_no_asignado") < migration.indexOf("excepcion_denegada"), "la excepción no puede crear un cargo activo inexistente");
assert.ok(migration.indexOf("dependencia_consulta_faltante") < migration.indexOf("excepcion_concedida"), "la excepción allow conserva la dependencia de pantalla");
assert.match(migration, /join public\.abc_cargos c[\s\S]*c\.empresa_id = a\.empresa_id[\s\S]*c\.activo = true/);
assert.match(migration, /create or replace function private\.pm13_p05_accion_autorizada/);
assert.doesNotMatch(migration, /v_legacy := private\.pm11_puede_mutar_personal/);

for (const [nombre, texto] of [["fuente.js", source], ["source-recovery/fuente-recuperado.js", recovered]]) {
  assert.match(texto, /pm13_listar_pantallas_efectivas/);
  assert.match(texto, /porCapacidad/);
  assert.match(texto, /return permisosConsultaPM13\[id\] === true/);
  assert.match(texto, /Object\.entries\(permisosConsultaPM13\)/);
  assert.match(texto, /Pantallas visibles para las personas con este cargo/);
  assert.match(texto, /cargo personalizado controla el acceso efectivo/);
  console.log(`${nombre}: navegación efectiva por cargo OK`);
}

console.log("PM13 P24 Navegación y excepciones: cargo activo, pantalla y permisos efectivos OK");
