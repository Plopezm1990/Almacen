import fs from 'node:fs';
import assert from 'node:assert/strict';

const layout = fs.readFileSync('pm11-mobile-layout-v3.js', 'utf8');
const fixer = fs.readFileSync('tools/corregir_pm11_p10_smoke_acceso.py', 'utf8');

for (const token of [
  '__pm11MobileLayoutV3Installed',
  '(max-width: 640px)',
  'document.documentElement.clientWidth',
  'shellDeMain',
  'pareceReservaLateral',
  'gapRight',
  'MIN_GAP = 20',
  'MAX_GAP = 120',
  'modoViewport ? "100vw" : "100%"',
  'margin-right", "0", "important"',
  'box-sizing", "border-box", "important"',
  'position',
  'marcarFijoCompleto',
  'MutationObserver',
  'visualViewport',
  'document.documentElement.scrollLeft = 0',
  'document.body.scrollLeft = 0',
  '__pm11MobileLayoutV3'
]) assert.ok(layout.includes(token), `falta contrato de geometría móvil v3: ${token}`);

// El corrector debe terminar cargando la capa geométrica nueva sin sustituir
// la barrera de permisos PM11: son responsabilidades distintas.
assert.ok(fixer.includes('pm11-access-patch.js'), 'debe conservarse la barrera de acceso existente');
assert.ok(fixer.includes('pm11-mobile-layout-v3.js'), 'el fixer debe cargar el layout móvil v3');

// Nunca debe tocar permisos, roles ni contexto operativo: solo geometría.
for (const forbidden of [
  'supabase.rpc',
  'membresias_usuario',
  'localStorage.setItem("rol"',
  'localStorage.setItem("empresaId"',
  'localStorage.setItem("localId"'
]) assert.ok(!layout.includes(forbidden), `la capa geométrica no puede alterar autorización: ${forbidden}`);

console.log('PM11 P10 layout móvil v3: contrato OK');
