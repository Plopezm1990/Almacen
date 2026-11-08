import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  "supabase/migrations/20261017185011_pm13_p05_empleados_rls_gate.sql",
  "utf8",
);

assert.match(migration, /to_regclass\('public\.empleados'\)/);
assert.match(migration, /to_regprocedure\('public\.pm13_resolver_cargo_permiso\(text,text,text,text,text,text\)'\)/);
assert.match(migration, /drop policy if exists pm11_empleados_select_gestion/i);
assert.match(migration, /create policy pm13_empleados_select_consulta/i);
assert.match(migration, /for select\s+to authenticated/i);
assert.match(migration, /public\.pm13_resolver_cargo_permiso\(/);
assert.match(migration, /PM13_PERSONAL_CONSULTAR/);
assert.match(migration, /->>['"]permitido['"]\s*\)\s*=\s*['"]true['"]/);
assert.doesNotMatch(migration, /grant\s+select\s+on\s+table\s+public\.empleados\s+to\s+anon/i);
assert.doesNotMatch(migration, /db push|migration repair/i);

console.log("PM13_P23_EMPLEADOS_RLS_PERMISSION_CONTRACT=PASS");
