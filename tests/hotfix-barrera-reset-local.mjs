import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, patch, migration] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../edge-auth-patch.js", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260914223000_hotfix_barrera_reset_local.sql", import.meta.url), "utf8")
]);
const ownerMigration = await readFile(new URL("../supabase/migrations/20260914205720_owner_identity_bootstrap.sql", import.meta.url), "utf8");

assert.match(html, /__instalacionSyncPermitida !== true\) return;/);
assert.match(patch, /__prepararSesionPostReset/);
assert.match(patch, /obtener_generacion_instalacion/);
assert.match(patch, /almacen__pendientes/);
assert.match(patch, /almacen__borrados:/);
assert.match(patch, /__instalacionSesionConNube/);
assert.match(html, /<script src="\.\/edge-auth-patch\.js"><\/script>/);
assert.match(patch, /iniciarBarreraConSesion/);
assert.match(patch, /window\.location\.reload\(\)/);
assert.doesNotMatch(patch, /signOut\(\{ scope: "local" \}\).*generacion/s);

assert.match(migration, /create table if not exists private\.la_instalacion_estado/i);
assert.match(migration, /security definer/i);
assert.match(migration, /set search_path = pg_catalog, private/i);
assert.match(migration, /if auth\.uid\(\) is null/i);
assert.match(migration, /grant execute on function public\.obtener_generacion_instalacion\(\) to authenticated/i);
assert.doesNotMatch(migration, /insert into public\.(perfiles|empresas|locales|membresias_usuario)/i);

assert.match(ownerMigration, /PREFLIGHT_FALLO: aplicar primero la barrera post-reset P1/);
assert.match(ownerMigration, /685cfc8f-f674-4681-9a81-61d3a26c0287/);
assert.match(ownerMigration, /lower\(u\.email\) = v_owner_email/);
assert.match(ownerMigration, /PREFLIGHT_FALLO: la instalación ya no está vacía/);
assert.match(ownerMigration, /insert into public\.perfiles/i);
assert.doesNotMatch(ownerMigration, /insert into public\.(empresas|locales|membresias_usuario)/i);

console.log("hotfix-barrera-reset-local: OK");
