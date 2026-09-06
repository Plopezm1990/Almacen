import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync('fuente.js','utf8');
function block(a,b,max=120000){
  const i=src.indexOf(a); assert.ok(i>=0,`falta ${a}`);
  let j=b?src.indexOf(b,i+a.length):-1; if(j<0||j-i>max) j=Math.min(src.length,i+max);
  return src.slice(i,j);
}

const motor=block('function crearMotorStock(', 'function crearLogicaReconciliacion');
assert.match(motor,/idsConocidos\.has\(id\)/);
assert.match(motor,/yaExistia: true/);
assert.match(motor,/movimientoId \|\| uid\(\)/);

const albaranes=block('function crearLogicaAlbaranes({','function crearLogicaRespaldos',180000);
const procStart=albaranes.indexOf('function procesarRecepcion(');
assert.ok(procStart>=0,'procesarRecepcion');
const procEnd=albaranes.indexOf('function confirmarAlbaran(',procStart);
const proc=albaranes.slice(procStart,procEnd);
assert.match(proc,/operationIdRecepcionPM10/);
assert.match(proc,/_pm10Resultados/);
assert.match(proc,/replayed: true/);
assert.match(proc,/operationId: operationIdRecepcionPM10/);
assert.match(proc,/movimientoId: `\$\{operationIdRecepcionPM10\}:linea:\$\{idxRecepcionPM10\}:producto:\$\{prod\.id\}`/);
assert.match(proc,/producto-auto:\$\{idxRecepcionPM10\}/);
assert.match(proc,/s22\.some\(\(m22\) => m22\.id === `\$\{operationIdRecepcionPM10\}:linea:\$\{idxRecepcionPM10\}:auto`\)/);
assert.match(proc,/resultadoRecepcionPM10/);

const confirmar=albaranes.slice(procEnd, albaranes.indexOf('function anularAlbaran(',procEnd));
assert.match(confirmar,/operationId: `pm10-recepcion-albaran:\$\{alb\.id\}`/);
assert.match(confirmar,/replayedRecepcionPM10/);
assert.match(confirmar,/if \(pedidoLigado && !replayedRecepcionPM10\)/);

const pedidos=block('function crearLogicaPedidos(','function crearLogicaFichasCosto');
const recibir=pedidos.slice(pedidos.indexOf('function recibirPedido('),pedidos.indexOf('return { crearPedido',pedidos.indexOf('function recibirPedido(')));
assert.match(recibir,/operationId: `pm10-recepcion-pedido:\$\{pedido\.id\}:/);
assert.match(recibir,/if \(!resultado\.replayed\) setPedidos/);

for (const [nombre,a,b,ref] of [
  ['Productos','function Productos({','function Proveedores(','submitBloqueadoProductoPM10'],
  ['Pedidos','function Pedidos({','function Recepcion(','submitBloqueadoPedidoPM10'],
  ['Personal','function Personal({','function Turnos({','submitBloqueadoPersonalPM10'],
  ['Encargos','function Encargos({','function Clientes(','submitBloqueadoEncargoPM10']
]) {
  const txt=block(a,b);
  assert.match(txt,new RegExp(`const ${ref} = import_react4\\.default\\.useRef\\(false\\)`),`${nombre}: ref`);
  assert.match(txt,new RegExp(`if \\(${ref}\\.current\\) return;`),`${nombre}: guard`);
  assert.match(txt,new RegExp(`${ref}\\.current = true;`),`${nombre}: lock`);
}

const recUI=block('function Recepcion({','function textoHojaConteo(',70000);
assert.match(recUI,/recepcionesEnCursoPM10/);
assert.match(recUI,/recepcionesEnCursoPM10\.current\.has\(pe2\.id\)/);
assert.match(recUI,/recepcionesEnCursoPM10\.current\.add\(pe2\.id\)/);

const diagStart=src.indexOf('function DiagnosticoSincronizacion()');
assert.ok(diagStart>=0,'DiagnosticoSincronizacion presente');
const diag=src.slice(diagStart,Math.min(src.length,diagStart+30000));
assert.match(diag,/window\.storage\.set\(key, valorLocal, false\)/);
assert.doesNotMatch(diag,/from\("almacen_kv"\)\.upsert/);

console.log('PM10 P11 robustez altas/recepción: contrato OK');
