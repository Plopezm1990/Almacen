import fs from 'node:fs';
import assert from 'node:assert/strict';

const guard = fs.readFileSync('pm11-session-guard-v4.js', 'utf8');
const fixer = fs.readFileSync('tools/corregir_pm11_p10_smoke_acceso.py', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

for (const token of [
  '__pm11SessionGuardV4Installed',
  'obtener_contexto_operativo',
  'supabase.rpc("obtener_contexto_operativo")',
  'supabase.auth.onAuthStateChange',
  'SIGNED_IN',
  'TOKEN_REFRESHED',
  'supabase.auth.signOut',
  'window.location.reload()',
  'la_suite_contexto_operativo_seguro_v2',
  'localStorage.removeItem(CACHE_LEGACY)',
  'Acceso suspendido',
  'rpc_contexto_rechazado',
  'setInterval(function () { validarSesion(true); }, 5000)',
  '__pm11ObtenerContextoOperativo = function (forzar)',
  '__pm11ObtenerContextoOperativoSeguroV4'
]) assert.ok(guard.includes(token), `falta contrato guard sesión v4: ${token}`);

// El guard debe validar directamente contra backend y nunca tomar decisiones
// de autorización desde rol/local cacheados por el navegador.
for (const forbidden of [
  'URLSearchParams',
  'location.search',
  'localStorage.getItem(CACHE_LEGACY)',
  'localStorage.setItem("rol"',
  'localStorage.setItem("empresaId"',
  'localStorage.setItem("localId"'
]) assert.ok(!guard.includes(forbidden), `guard v4 no puede confiar en autorización cliente: ${forbidden}`);

assert.ok(fixer.includes('pm11-session-guard-v4.js?v=pm11-session-guard-v4'), 'fixer debe cargar guard v4');
assert.ok(index.includes('<script src="./pm11-session-guard-v4.js?v=pm11-session-guard-v4"></script>'), 'index corregido debe cargar guard v4');

const access = index.indexOf('./pm11-access-patch.js?v=pm11-p10-smoke-v2');
const guardPos = index.indexOf('./pm11-session-guard-v4.js?v=pm11-session-guard-v4');
const runtime = index.indexOf('./pm11-access-runtime-v3.js?v=pm11-runtime-scope-v3');
const layout = index.indexOf('./pm11-mobile-layout-v3.js?v=pm11-mobile-layout-v3');
const fuente = index.indexOf('<script type="module" src="./fuente.js"></script>');
assert.ok(access >= 0 && guardPos > access && runtime > guardPos && layout > runtime && fuente > layout,
  'orden requerido: acceso -> guard sesión v4 -> runtime -> layout -> fuente');

console.log('PM11 P10 guard sesión v4: contrato OK');
