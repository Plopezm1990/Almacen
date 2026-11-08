import fs from 'node:fs';
import assert from 'node:assert/strict';

const sources = [
  'source-recovery/fuente-recuperado.js',
  'fuente.js',
].map((path) => ({ path, text: fs.readFileSync(path, 'utf8') }));

for (const { path, text } of sources) {
  for (const fn of [
    'iniciarCierreSesionCajaA10',
    'confirmarCierreProvisionalA10',
    'finalizarCierreSesionCajaA10',
    'reabrirCierreProvisionalA10',
  ]) {
    assert.match(text, new RegExp(`listarEstacionesA10\\.${fn}\\s*=\\s*${fn}`), `${path}: falta exponer ${fn}`);
  }
  for (const rpc of [
    'abc_iniciar_cierre_sesion_caja',
    'abc_confirmar_cierre_provisional',
    'abc_finalizar_cierre_sesion_caja',
    'abc_reabrir_cierre_provisional',
  ]) {
    assert.match(text, new RegExp(rpc), `${path}: falta conectar ${rpc}`);
  }
  assert.doesNotMatch(text, /rpc\("abc_cerrar_sesion_caja"/, `${path}: la UI conserva el cierre directo antiguo`);
  assert.match(text, /f5\.ui\.cash\.close\.(start|provisional|finalize|reopen)/, `${path}: falta idempotencia C04 desde UI`);
  assert.match(text, /CIERRE_PROVISIONAL/);
  assert.match(text, /Reabrir cierre provisional/);
  assert.match(text, /motivo_reapertura_requerido/);
}

console.log('ABC_F5_C04_UI_CONTRACT=PASS');
