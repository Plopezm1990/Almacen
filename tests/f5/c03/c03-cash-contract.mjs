import fs from 'node:fs';
import assert from 'node:assert/strict';

const contrato = fs.readFileSync('docs/plan-abc/F5_C03_CONTRATO_ARQUEO_SERVIDOR_2026-10-01.md', 'utf8');
const previo = fs.readFileSync('supabase/migrations/20261005160403_abc_f5_c03_arqueo_sesion.sql', 'utf8');
const registro = fs.readFileSync('supabase/migrations/20261009060339_c03_arqueo_servidor.sql', 'utf8');
const fuente = fs.readFileSync('fuente.js', 'utf8').replace(/\r\n/g, '\n');
const recuperado = fs.readFileSync('source-recovery/fuente-recuperado.js', 'utf8').replace(/\r\n/g, '\n');

function extraer(texto, inicio, fin) {
  const desde = texto.indexOf(inicio);
  assert.notEqual(desde, -1, `falta ${inicio}`);
  const hasta = texto.indexOf(fin, desde + inicio.length);
  assert.notEqual(hasta, -1, `no se pudo cerrar ${inicio}`);
  return texto.slice(desde, hasta);
}

for (const term of ['Cálculo autoritativo', 'efectivo_esperado', 'efectivo_contado', 'diferencia', 'operation_id', 'replay', 'Concurrencia', 'Anulación']) {
  assert.match(contrato, new RegExp(term, 'i'), `el contrato C03 no contiene ${term}`);
}

assert.match(previo, /create function public\.abc_previsualizar_arqueo_caja/i);
assert.match(previo, /co\.session_id=p_session_id/i);
assert.match(previo, /co\.categoria='FONDO_INICIAL'/i);
assert.match(previo, /v_fondo\+v_entradas-v_salidas/i);
assert.match(previo, /grant execute[\s\S]*?to authenticated/i);

assert.match(registro, /create or replace function public\.abc_registrar_arqueo_caja/i);
assert.match(registro, /abc_tiene_capacidad\(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR'\)/i);
assert.match(registro, /abc_obtener_dia_operativo_local/i);
assert.match(registro, /abc_terminal_sesion_operativa/i);
assert.match(registro, /sum\(co\.efecto_efectivo\) filter\(where co\.categoria='FONDO_INICIAL'\)/i);
assert.match(registro, /sum\(co\.efecto_efectivo\)/i);
assert.match(registro, /v_contado-v_esperado/i);
assert.match(registro, /denominaciones_no_coinciden_contado/i);
assert.match(registro, /private\.abc_operacion_iniciar/i);
assert.match(registro, /private\.abc_operacion_completar/i);
assert.match(registro, /'CAJA_ARQUEO_REGISTRADO'/i);
assert.match(registro, /revoke all on function public\.abc_registrar_arqueo_caja[\s\S]*?from public,anon,authenticated,service_role/i);
assert.match(registro, /grant execute on function public\.abc_registrar_arqueo_caja[\s\S]*?to authenticated/i);

const cajaPrincipal = extraer(fuente, 'function crearLogicaCaja(', 'function crearLogicaLocales(');
const cajaRecuperada = extraer(recuperado, 'function crearLogicaCaja(', 'function crearLogicaLocales(');
const uiPrincipal = extraer(fuente, 'function ArqueoCaja(', 'var PLANTILLAS_TURNO');
const uiRecuperada = extraer(recuperado, 'function ArqueoCaja(', 'var PLANTILLAS_TURNO');
assert.equal(cajaPrincipal, cajaRecuperada, 'crearLogicaCaja debe coincidir en las dos fuentes');
assert.equal(uiPrincipal, uiRecuperada, 'ArqueoCaja debe coincidir en las dos fuentes');

assert.match(cajaPrincipal, /rpc\("abc_registrar_arqueo_caja"/);
assert.doesNotMatch(cajaPrincipal, /rpc\("registrar_arqueo_caja"/);
assert.match(cajaPrincipal, /p_session_id: contexto\.sessionId/);
assert.match(cajaPrincipal, /p_terminal_id: contexto\.terminalId/);
assert.match(cajaPrincipal, /p_denominaciones: denominaciones/);
assert.match(cajaPrincipal, /p_operating_day: contexto\.operatingDay/);
assert.doesNotMatch(cajaPrincipal, /p_efectivo_base:/);

for (const source of [fuente, recuperado]) {
  assert.match(source, /rpc\("abc_previsualizar_arqueo_caja"/);
  assert.match(source, /Esperado por el servidor/);
  assert.match(source, /Contar por denominaciones/);
  assert.match(source, /Total por denominaciones/);
  assert.match(source, /!arqueoPrevio \|\| !String\(efectivoContado\)\.trim\(\)/);
}

console.log('ABC_F5_C03_CASH_CONTRACT=PASS');
