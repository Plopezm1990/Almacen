import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, patch, resetPatch, migration] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../edge-auth-patch.js", import.meta.url), "utf8"),
  readFile(new URL("../reset-pruebas-preview.js", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260914223000_hotfix_barrera_reset_local.sql", import.meta.url), "utf8")
]);
const ownerMigration = await readFile(new URL("../supabase/migrations/20260914223100_owner_identity_bootstrap.sql", import.meta.url), "utf8");

// Orden de arranque: la barrera temprana se instala en <head>, antes de los
// módulos PM12, edge-auth-patch y fuente.js.
const resetPos = html.indexOf('<script src="./reset-pruebas-preview.js"></script>');
const edgePos = html.indexOf('<script src="./edge-auth-patch.js"></script>');
const fuentePos = html.indexOf('<script type="module" src="./fuente.js"></script>');
assert.ok(resetPos >= 0 && edgePos > resetPos && fuentePos > edgePos);

// Ninguna cola antigua puede procesarse hasta validar generación.
assert.match(html, /__instalacionSyncPermitida !== true\) return;/);
assert.match(patch, /__prepararSesionPostReset/);
assert.match(patch, /obtener_generacion_instalacion/);
assert.match(patch, /almacen__pendientes/);
assert.match(patch, /almacen__borrados:/);
assert.match(patch, /__instalacionSesionConNube/);
assert.match(patch, /iniciarBarreraConSesion/);
assert.match(patch, /window\.location\.reload\(\)/);
assert.doesNotMatch(patch, /signOut\(\{ scope: "local" \}\).*generacion/s);

// Barrera temprana: antes de P1 no se leen/escriben bloques empresariales ni
// se permiten mutaciones remotas. Auth y los RPC de lectura necesarios sí.
assert.match(resetPatch, /__laPostResetEarlyGateV1/);
assert.match(resetPatch, /__laPostResetStorageGateV1/);
assert.match(resetPatch, /__laPostResetNetworkGateV1/);
assert.match(resetPatch, /clave\.indexOf\("almacen:"\) === 0/);
assert.match(resetPatch, /clave\.indexOf\("almacen__"\) === 0/);
assert.match(resetPatch, /chocoloyos_contexto_operativo_seguro_v1/);
assert.match(resetPatch, /return null;/);
assert.match(resetPatch, /POST_RESET_BARRIER_BLOCKED/);
assert.match(resetPatch, /\/auth\\\/v1\\\//);
assert.match(resetPatch, /obtener_generacion_instalacion\|obtener_contexto_operativo/);
assert.match(resetPatch, /metodo === "GET" \|\| metodo === "HEAD" \|\| metodo === "OPTIONS"/);

// Para no dejar la UI construida sobre fallbacks vacíos, tras validar se
// permite una única lectura local ligada a la generación recién comprobada.
assert.match(resetPatch, /la_suite_post_reset_boot_generation_v1/);
assert.match(resetPatch, /lecturaPreautorizadaUnArranque/);
assert.match(resetPatch, /removeItemNativo\.call\(window\.sessionStorage, CLAVE_ARRANQUE_VALIDADO\)/);
assert.match(resetPatch, /setItemNativo\.call\(window\.sessionStorage, CLAVE_ARRANQUE_VALIDADO, generacion\)/);
assert.match(resetPatch, /window\.location\.reload\(\)/);

// P1 servidor: marcador privado + RPC autenticado, sin crear datos de negocio.
assert.match(migration, /create table if not exists private\.la_instalacion_estado/i);
assert.match(migration, /security definer/i);
assert.match(migration, /set search_path = pg_catalog, private/i);
assert.match(migration, /if auth\.uid\(\) is null/i);
assert.match(migration, /grant execute on function public\.obtener_generacion_instalacion\(\) to authenticated/i);
assert.doesNotMatch(migration, /insert into public\.(perfiles|empresas|locales|membresias_usuario)/i);

// P2 solo restaura la identidad mínima del Propietario correcto.
assert.match(ownerMigration, /PREFLIGHT_FALLO: aplicar primero la barrera post-reset P1/);
assert.match(ownerMigration, /685cfc8f-f674-4681-9a81-61d3a26c0287/);
assert.match(ownerMigration, /lower\(u\.email\) = v_owner_email/);
assert.match(ownerMigration, /PREFLIGHT_FALLO: la instalación ya no está vacía/);
assert.match(ownerMigration, /insert into public\.perfiles/i);
assert.doesNotMatch(ownerMigration, /insert into public\.(empresas|locales|membresias_usuario)/i);

console.log("hotfix-barrera-reset-local: OK");
