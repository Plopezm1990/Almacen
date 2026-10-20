import fs from "node:fs";
import assert from "node:assert/strict";

const sql = fs.readFileSync(
  "supabase/migrations/20261020140000_pm13_p05_roles_fijos_pantallas.sql",
  "utf8",
);

assert.match(sql, /create table if not exists public\.abc_pantallas_rol/);
assert.match(sql, /constraint abc_pantallas_rol_rol_ck check \(rol in \('Encargado','Cajero\/a','Camarero\/a'\)\)/);
assert.match(sql, /alter table public\.abc_pantallas_rol enable row level security/);
assert.match(sql, /revoke all on table public\.abc_pantallas_rol from public, anon, authenticated, service_role/);
assert.match(sql, /create or replace function private\.abc_rol_pantalla_catalogo/);
assert.match(sql, /create or replace function public\.abc_obtener_pantallas_rol\(p_empresa_id text, p_local_id text\)/);
assert.match(sql, /create or replace function public\.abc_configurar_pantalla_rol\(/);
assert.match(sql, /private\.abc_config_puede_configurar_empresa/);
assert.match(sql, /private\.abc_config_puede_configurar\(p_empresa_id,p_local_id\)/);
assert.match(sql, /'PANTALLA_ROL_CONFIGURADA'/);
assert.equal(new Set(sql.match(/ABC_PANTALLA_[A-Z0-9_]+_CONSULTAR/g) || []).size, 45);

for (const file of ["fuente.js", "source-recovery/fuente-recuperado.js"]) {
  const source = fs.readFileSync(file, "utf8");
  assert.match(source, /CONFIG_PANTALLAS_ROL/);
  assert.match(source, /abc_obtener_pantallas_rol/);
  assert.match(source, /abc_configurar_pantalla_rol/);
  assert.match(source, /Pantallas del modo empleado/);
  assert.match(source, /Editar permisos y pantallas/);
  assert.match(source, /pantallasRolEmpleado/);
}

const main = fs.readFileSync("fuente.js", "utf8");
const recovered = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");
const catalog = (text) => [...text.matchAll(/\["(ABC_PANTALLA_[A-Z0-9_]+_CONSULTAR)",/g)].map((m) => m[1]);
assert.deepEqual(catalog(recovered), catalog(main), "el espejo debe conservar el catálogo de pantallas");

console.log("PM13 P21 Pantallas configurables para roles fijos: contrato SQL, auditoría, UI y espejo OK");
