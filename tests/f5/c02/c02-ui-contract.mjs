import fs from 'node:fs';
import assert from 'node:assert/strict';

const fuente = fs.readFileSync('fuente.js', 'utf8').replace(/\r\n/g, '\n');
const recuperado = fs.readFileSync('source-recovery/fuente-recuperado.js', 'utf8').replace(/\r\n/g, '\n');

function extraer(texto, inicio, fin) {
  const desde = texto.indexOf(inicio);
  assert.notEqual(desde, -1, `falta ${inicio}`);
  const hasta = texto.indexOf(fin, desde + inicio.length);
  assert.notEqual(hasta, -1, `no se pudo cerrar ${inicio}`);
  return texto.slice(desde, hasta);
}

const bloques = [
  ['function normalizarMovimientoCajaPM08(', 'function normalizarArqueoPM08('],
  ['function crearLogicaMovimientosCaja(', 'function crearLogicaDevoluciones('],
  ['function BloqueEntradasSalidas(', '// PM-09 / Punto 10:']
];

for (const [inicio, fin] of bloques) {
  assert.equal(extraer(fuente, inicio, fin), extraer(recuperado, inicio, fin), `${inicio} debe coincidir en ambas fuentes`);
}

const logica = extraer(fuente, bloques[1][0], bloques[1][1]);
const ui = extraer(fuente, bloques[2][0], bloques[2][1]);
const normalizador = extraer(fuente, bloques[0][0], bloques[0][1]);

assert.match(logica, /rpc\("abc_registrar_movimiento_caja"/);
assert.match(logica, /rpc\("abc_revertir_movimiento_caja"/);
assert.doesNotMatch(logica, /rpc\("registrar_movimiento_caja"/);
assert.doesNotMatch(logica, /rpc\("revertir_movimiento_caja"/);

for (const parametro of [
  'p_operation_id', 'p_empresa_id', 'p_local_id', 'p_caja_id',
  'p_session_id', 'p_terminal_id', 'p_currency_code', 'p_categoria',
  'p_importe', 'p_concepto', 'p_motivo', 'p_operating_day'
]) assert.match(logica, new RegExp(`${parametro}:`), `falta ${parametro}`);

assert.match(logica, /from\("caja_sesion_terminales"\)/);
assert.match(logica, /from\("caja_sesiones"\)/);
assert.match(logica, /rpc\("abc_obtener_dia_operativo_local"/);
assert.match(logica, /String\(fecha\) !== contexto\.operatingDay/);
assert.match(logica, /prepararPendientePM08/);
assert.match(logica, /r2\.data\?\.replayed/);
assert.match(logica, /ref_operation_id: original\.operationId/);

for (const categoria of ['REPOSICION_CAJA', 'INGRESO_MANUAL', 'RETIRADA_CAJA', 'GASTO_CAJA']) {
  assert.match(logica + ui, new RegExp(categoria), `falta categoría ${categoria}`);
}

assert.match(ui, /Concepto o justificante/);
assert.match(ui, /Motivo obligatorio/);
assert.match(ui, /!motivo\.trim\(\) \|\| !motivoOperacion\.trim\(\)/);
assert.match(ui, /m22\.origen === "ABC_CAJA_MANUAL"/);
assert.match(ui, /!!m22\.abcCommandId && !!m22\.sessionId/);
assert.match(ui, /El movimiento original se conserva/);

for (const campo of ['abcCommandId', 'cajaId', 'sessionId', 'terminalId', 'currencyCode', 'operatingDay', 'categoria']) {
  assert.match(normalizador, new RegExp(`${campo}:`), `el normalizador no conserva ${campo}`);
}

console.log('ABC_F5_C02_UI_CONTRACT=PASS');
