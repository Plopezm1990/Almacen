import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync('supabase/migrations/20260906183000_pm11_contexto_operativo_acceso_smoke.sql', 'utf8');
const patch = fs.readFileSync('pm11-access-patch.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

for (const token of [
  'public.obtener_contexto_operativo()',
  'security definer',
  "v_uid uuid := auth.uid()",
  'public.membresias_usuario',
  'm.activo is true',
  "v_perfil.activo is not true",
  "v_rol <> 'Propietario'",
  'contexto_local_operativo_ambiguo',
  "kv.key = 'locales'",
  "coalesce((c.elem->>'activo')::boolean, true) is true",
  "v_rol = 'Camarero/a'",
  "jsonb_build_array('tpv', 'fichajes')",
  "e.estado = 'activo'",
  'revoke all on function public.obtener_contexto_operativo() from public, anon',
  'grant execute on function public.obtener_contexto_operativo() to authenticated'
]) assert.ok(migration.includes(token), `falta contrato SQL smoke: ${token}`);

for (const token of [
  'supabase.rpc("obtener_contexto_operativo")',
  'la_suite_contexto_operativo_seguro_v2',
  'if (key === "locales")',
  'if (key === "localActivoId")',
  'filtrarFilasPorLocal',
  'filtrarFichajesPropios',
  'PM11_LOCAL_SCOPE_DENIED',
  'PM11_FICHAJE_SCOPE_DENIED',
  'contexto.rol === "Propietario"',
  'contexto.rol === "Camarero/a"',
  'ocultarControl(["Inicio", "Hoy", "Panel general", "Resumen general"])',
  'controlExacto(["TPV"] ) || controlExacto(["Fichajes"])',
  'la-suite-logo.svg',
  'repararLogoDashboard',
  'podarSelectoresLocales'
]) assert.ok(patch.includes(token), `falta barrera frontend smoke: ${token}`);

assert.ok(index.includes('<script src="./pm11-access-patch.js?v=pm11-p10-smoke-v1"></script>'), 'index debe cargar la barrera PM11');
const acceso = index.indexOf('./pm11-access-patch.js?v=pm11-p10-smoke-v1');
const fuente = index.indexOf('<script type="module" src="./fuente.js"></script>');
assert.ok(acceso >= 0 && fuente > acceso, 'la barrera debe instalarse antes del bundle React');

// El parche no debe otorgar permisos: solo restringe caché/UI y obtiene el
// contexto firmado por backend. No se aceptan roles/empresa/local desde querystring.
for (const forbidden of [
  'URLSearchParams',
  'location.search',
  'localStorage.setItem("rol"',
  'localStorage.setItem("empresaId"',
  'localStorage.setItem("localId"'
]) assert.ok(!patch.includes(forbidden), `contexto no confiable prohibido: ${forbidden}`);

console.log('PM11 P10 smoke acceso/contexto: contrato OK');
