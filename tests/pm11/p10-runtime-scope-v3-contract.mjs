import fs from 'node:fs';
import assert from 'node:assert/strict';

const runtime = fs.readFileSync('pm11-access-runtime-v3.js', 'utf8');
const fixer = fs.readFileSync('tools/corregir_pm11_p10_smoke_acceso.py', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

for (const token of [
  '__pm11RuntimeScopeV3Installed',
  'RELOAD_PREFIX = "la_suite_pm11_scope_rehidratado_v3:"',
  'supabase.auth.onAuthStateChange',
  'event === "SIGNED_IN"',
  'event === "SIGNED_OUT"',
  'window.location.reload()',
  'key !== "empleados"',
  'ctx.rol === "Camarero/a"',
  'empleadosPermitidos(ctx)',
  'todos los locales',
  'sel.dispatchEvent(new Event("change", { bubbles: true }))',
  'controlExacto(["Más"])',
  'controlExacto(["TPV"])',
  'Registro horario',
  'estaEnDashboard()',
  'bloquearCorreccionManualCamarero()',
  'etiqueta === "corrección manual"',
  'dentroDeModalCorreccion(target)',
  'pm11CorreccionManualBloqueada',
  'pm11GuardarCorreccionBloqueado',
  'stopImmediatePropagation',
  'correccionManualBloqueada: contexto.rol === "Camarero/a"',
  '__pm11RuntimeScopeV3Estado'
]) assert.ok(runtime.includes(token), `falta contrato runtime scope v3: ${token}`);

// La capa runtime consume exclusivamente el contexto autoritativo ya instalado.
assert.ok(runtime.includes('__pm11ObtenerContextoOperativo'), 'debe usar contexto autoritativo PM11');
for (const forbidden of [
  'URLSearchParams',
  'location.search',
  'localStorage.setItem("rol"',
  'localStorage.setItem("empresaId"',
  'localStorage.setItem("localId"',
  'supabase.from("membresias_usuario")'
]) assert.ok(!runtime.includes(forbidden), `runtime no puede inventar autorización: ${forbidden}`);

// El Camarero mantiene el fichaje ordinario Entrada/Salida. La restricción de
// este gate es específicamente la corrección manual, no el registro horario.
assert.ok(!runtime.includes('etiqueta === "entrada"'), 'no debe bloquear Entrada');
assert.ok(!runtime.includes('etiqueta === "salida"'), 'no debe bloquear Salida');

assert.ok(fixer.includes('pm11-access-runtime-v3.js?v=pm11-runtime-scope-v3'), 'fixer debe cargar runtime v3');
assert.ok(index.includes('<script src="./pm11-access-runtime-v3.js?v=pm11-runtime-scope-v3"></script>'), 'index corregido debe cargar runtime v3');

const access = index.indexOf('./pm11-access-patch.js?v=pm11-p10-smoke-v2');
const runtimePos = index.indexOf('./pm11-access-runtime-v3.js?v=pm11-runtime-scope-v3');
const layout = index.indexOf('./pm11-mobile-layout-v3.js?v=pm11-mobile-layout-v3');
const fuente = index.indexOf('<script type="module" src="./fuente.js"></script>');
assert.ok(access >= 0 && runtimePos > access && layout > runtimePos && fuente > layout,
  'orden requerido: acceso -> runtime scope v3 -> layout v3 -> fuente');

console.log('PM11 P10 runtime scope v3: contrato OK');
