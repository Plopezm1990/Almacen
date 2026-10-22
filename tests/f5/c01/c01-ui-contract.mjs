import fs from 'node:fs';
import assert from 'node:assert/strict';

const fuente = fs.readFileSync('fuente.js', 'utf8').replace(/\r\n/g, '\n');
const recuperado = fs.readFileSync('source-recovery/fuente-recuperado.js', 'utf8').replace(/\r\n/g, '\n');
const migracion = fs.readFileSync('supabase/migrations/20261009054351_c01_listar_responsables_caja.sql', 'utf8');

const funciones = [
  'consultarSesionCajaC01',
  'vincularTerminalCajaC01',
  'desvincularTerminalCajaC01',
  'cambiarResponsableCajaC01'
];

function extraerFuncion(texto, nombre) {
  const inicio = texto.indexOf(`  async function ${nombre}(`);
  assert.notEqual(inicio, -1, `falta ${nombre}`);
  const siguiente = texto.indexOf('\n  async function ', inicio + 20);
  assert.notEqual(siguiente, -1, `no se pudo cerrar ${nombre}`);
  return texto.slice(inicio, siguiente);
}

for (const nombre of funciones) {
  const principal = extraerFuncion(fuente, nombre);
  const respaldo = extraerFuncion(recuperado, nombre);
  assert.equal(principal, respaldo, `${nombre} debe ser idéntica en las dos fuentes`);
}

const c01 = funciones.map((nombre) => extraerFuncion(fuente, nombre)).join('\n');

assert.match(c01, /rpc\("abc_listar_responsables_caja"/);
assert.match(c01, /rpcA02ConRecuperacion\(contexto\.supabase, "abc_vincular_terminal_caja"/);
assert.match(c01, /rpcA02ConRecuperacion\(contexto\.supabase, "abc_desvincular_terminal_caja"/);
assert.match(c01, /rpcA02ConRecuperacion\(contexto\.supabase, "abc_cambiar_responsable_caja"/);
assert.match(c01, /p_motivo: motivoLimpio/);
assert.match(c01, /terminal_actual_no_desvinculable/);
assert.match(c01, /p_operating_day: contexto\.operatingDay/);
assert.doesNotMatch(c01, /\.from\("(?:caja_sesiones|caja_sesion_terminales|caja_sesion_responsables|terminales_tpv)"\)[\s\S]*?\.(?:insert|update|delete|upsert)\(/,
  'C01 no debe escribir directamente en tablas de caja');

for (const texto of [fuente, recuperado]) {
  assert.match(texto, /data-c01-sesion/);
  assert.match(texto, /Sesión, responsable y terminales/);
  assert.match(texto, /Motivo del relevo/);
  assert.match(texto, /Motivo para desvincular un terminal auxiliar/);
  assert.match(texto, /Registrar relevo/);
  assert.match(texto, /Vincular terminal/);
  assert.match(texto, /!responsableCajaC01 \|\| !motivoRelevoC01\.trim\(\)/);
  assert.match(texto, /!motivoDesvinculoC01\.trim\(\)/);
}

assert.match(migracion, /create function public\.abc_listar_responsables_caja\(/i);
assert.match(migracion, /auth\.uid\(\) is null/i);
assert.match(migracion, /'ABC_CAJA_OPERAR'/);
assert.doesNotMatch(migracion, /'ABC_CUENTA_REASIGNAR'/);
assert.match(migracion, /private\.abc_terminal_sesion_operativa\(/);
assert.match(migracion, /m\.empresa_id=p_empresa_id/);
assert.match(migracion, /m\.activo=true/);
assert.match(migracion, /m\.local_id=p_local_id/);
assert.match(migracion, /security definer\s+set search_path=''/i);
assert.match(migracion, /revoke all on function public\.abc_listar_responsables_caja\([\s\S]*?from public,anon,authenticated,service_role/i);
assert.match(migracion, /grant execute on function public\.abc_listar_responsables_caja\([\s\S]*?to authenticated/i);

console.log('ABC_F5_C01_UI_CONTRACT=PASS');
