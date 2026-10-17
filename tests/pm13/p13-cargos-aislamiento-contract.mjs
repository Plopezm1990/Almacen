import fs from "node:fs";
import assert from "node:assert/strict";

const catalogo = fs.readFileSync(
  "supabase/migrations/20261017120000_pm13_p08_cargos_catalogo.sql",
  "utf8",
);
const asignaciones = fs.readFileSync(
  "supabase/migrations/20261017130000_pm13_p08_cargo_asignaciones.sql",
  "utf8",
);
const estado = fs.readFileSync(
  "supabase/migrations/20261017140000_pm13_p08_cargos_estado.sql",
  "utf8",
);
const propietario = fs.readFileSync(
  "supabase/migrations/20261017150000_pm13_p08_proteccion_propietario.sql",
  "utf8",
);

// Una misma etiqueta puede existir en dos empresas, pero no repetirse dentro
// de la misma empresa después de normalizar espacios y mayúsculas.
assert.match(catalogo, /create or replace function private\.pm13_cargo_normalizar_nombre\(p_nombre text\)/);
assert.match(catalogo, /lower\(regexp_replace\(btrim\(coalesce\(p_nombre, ''\)\)/);
assert.match(
  catalogo,
  /create unique index if not exists abc_cargos_empresa_nombre_uq\s+on public\.abc_cargos\(empresa_id, nombre_normalizado\)/s,
);
assert.doesNotMatch(
  catalogo,
  /create unique index[^\n]+on public\.abc_cargos\(nombre_normalizado\)/i,
);
assert.match(catalogo, /char_length\(btrim\(nombre\)\) between 1 and 80/);
assert.match(catalogo, /char_length\(descripcion\) <= 500/);
assert.match(catalogo, /cargo_nombre_demasiado_largo/);
assert.match(catalogo, /cargo_descripcion_demasiado_larga/);

// Renombrar conserva el UUID y, por tanto, no rompe asignaciones ni historial.
assert.match(
  catalogo,
  /update public\.abc_cargos\s+set nombre = v_nombre, nombre_normalizado = v_normalizado, descripcion = v_descripcion/s,
);
assert.doesNotMatch(
  catalogo,
  /update public\.abc_cargos\s+set\s+id\s*=/is,
);
assert.match(asignaciones, /cargo_id uuid not null references public\.abc_cargos\(id\)/);

// La desactivación es reversible y bloquea el cargo mientras tenga asignaciones.
assert.match(estado, /select count\(\*\) into v_asignados/);
assert.match(estado, /if v_asignados > 0 then raise exception 'cargo_tiene_asignaciones:/);
assert.match(estado, /create or replace function public\.abc_reactivar_cargo\(/);
assert.doesNotMatch(estado, /delete\s+from\s+public\.abc_cargos/i);

// La lista de nombres protegidos no convierte el catálogo en una lista cerrada:
// solo evita colisiones con roles técnicos del sistema.
assert.match(propietario, /cargo_nombre_reservado/);
assert.match(propietario, /propietario.*encargado.*cajero\/a.*camarero\/a/s);
assert.doesNotMatch(catalogo, /nombre\s+in\s*\(/i);

// Duplicar siempre crea otro UUID y deja explícito que los permisos aún no se
// clonan: la matriz de permisos por cargo pertenece a los puntos 4 y 5.
assert.match(catalogo, /create or replace function public\.abc_duplicar_cargo\(/);
assert.match(catalogo, /copiado_de, created_by, updated_by/);
assert.match(catalogo, /'permisosClonados', false/);
assert.match(catalogo, /'permisos_clonados', false/);
assert.doesNotMatch(catalogo, /abc_cargo_(?:pantallas|permisos)/i);

console.log("PM13 P13 Aislamiento de cargos: empresas, normalización, renombrado y estados OK");
console.log("PM13 P13 PENDIENTE: permisos distintos por empresa requieren los puntos 4 y 5");
