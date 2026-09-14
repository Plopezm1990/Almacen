import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, patch, resetPatch, prelock, bootstrapFlow, migration, ownerMigration, bootstrapMigration] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../edge-auth-patch.js", import.meta.url), "utf8"),
  readFile(new URL("../reset-pruebas-preview.js", import.meta.url), "utf8"),
  readFile(new URL("../owner-bootstrap-prelock.js", import.meta.url), "utf8"),
  readFile(new URL("../owner-bootstrap-post-reset.js", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260914223000_hotfix_barrera_reset_local.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260914223100_owner_identity_bootstrap.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260914223200_owner_installation_bootstrap.sql", import.meta.url), "utf8")
]);

// Orden de arranque: P4 instala el interlock antes de P1; el flujo de setup se
// instala después del adaptador Auth/P1 y antes del bundle funcional.
const prelockPos = html.indexOf('<script src="./owner-bootstrap-prelock.js"></script>');
const resetPos = html.indexOf('<script src="./reset-pruebas-preview.js"></script>');
const edgePos = html.indexOf('<script src="./edge-auth-patch.js"></script>');
const bootstrapFlowPos = html.indexOf('<script src="./owner-bootstrap-post-reset.js"></script>');
const fuentePos = html.indexOf('<script type="module" src="./fuente.js"></script>');
assert.ok(prelockPos >= 0 && resetPos > prelockPos && edgePos > resetPos && bootstrapFlowPos > edgePos && fuentePos > bootstrapFlowPos);

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

// Interlock P4: un true pedido por P1 no se vuelve efectivo hasta que el
// bootstrap/estado empresarial confirme ready. El bypass de red es estrecho:
// solo existen los dos RPC de P4, nunca un fetch genérico expuesto.
assert.match(prelock, /Object\.defineProperty\(window, "__instalacionSyncPermitida"/);
assert.match(prelock, /return bootstrapListo && syncSolicitada/);
assert.match(prelock, /obtener_estado_instalacion: true/);
assert.match(prelock, /bootstrap_owner_instalacion: true/);
assert.match(prelock, /RPC bootstrap no permitido/);
assert.doesNotMatch(prelock, /window\.__laFetchAntesPostReset/);
assert.match(prelock, /la-installation-checking/);
assert.match(prelock, /la-installation-needs-setup/);

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

// P4 servidor: estado explícito + bootstrap atómico/idempotente, serializado
// por advisory xact lock y sin reparación/borrado silencioso.
assert.match(bootstrapMigration, /create or replace function public\.obtener_estado_instalacion\(\)/i);
assert.match(bootstrapMigration, /'state', 'needs_setup'/);
assert.match(bootstrapMigration, /'state', 'ready'/);
assert.match(bootstrapMigration, /'state', 'blocked_inconsistent'/);
assert.match(bootstrapMigration, /create or replace function public\.bootstrap_owner_instalacion/i);
assert.match(bootstrapMigration, /pg_advisory_xact_lock\(hashtextextended/i);
assert.match(bootstrapMigration, /insert into public\.empresas/i);
assert.match(bootstrapMigration, /insert into public\.locales/i);
assert.match(bootstrapMigration, /insert into public\.membresias_usuario/i);
assert.match(bootstrapMigration, /'idempotent', true/);
assert.match(bootstrapMigration, /PREFLIGHT_FALLO: estado empresarial no vacío o inconsistente/);
assert.match(bootstrapMigration, /grant execute on function public\.bootstrap_owner_instalacion\(text, text\) to authenticated/i);
assert.doesNotMatch(bootstrapMigration, /delete from public\.(empresas|locales|membresias_usuario)/i);

// P4 cliente: primero revalida P1, después consulta estado; needs_setup mantiene
// el interlock cerrado y el alta solo termina tras releer ready + generación.
assert.match(bootstrapFlow, /__prepararSesionPostReset/);
assert.match(bootstrapFlow, /obtener_estado_instalacion/);
assert.match(bootstrapFlow, /bootstrap_owner_instalacion/);
assert.match(bootstrapFlow, /estado\.state === "needs_setup"/);
assert.match(bootstrapFlow, /estado\.state === "ready"/);
assert.match(bootstrapFlow, /__laOwnerBootstrapSetReady\(false\)/);
assert.match(bootstrapFlow, /__laOwnerBootstrapSetReady\(true\)/);
assert.match(bootstrapFlow, /comprobacion\.generation !== generacionLocal\(\)/);
assert.match(bootstrapFlow, /window\.__instalacionSyncPermitida !== true/);
assert.match(bootstrapFlow, /window\.location\.reload\(\)/);

console.log("hotfix-barrera-reset-local: OK");
