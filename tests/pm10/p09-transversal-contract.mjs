import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js','utf8');
const contrato = fs.readFileSync('tests/pm10/P03_CONTRATO_VALIDACION.md','utf8');

// 1) El contrato común sigue presente y contiene las invariantes congeladas.
for (const texto of [
  'parsear → validar → resolver contexto/referencias → mutar → persistir',
  'Toda operación cubierta por PM10 debe validar el objeto completo antes de la primera mutación.',
  'no se normalizarán masivamente datos históricos en silencio',
  '“Todos los locales” es consolidación de lectura, no contexto de escritura'
]) assert.ok(contrato.includes(texto), `falta contrato congelado: ${texto}`);

// 2) Las cinco barreras de dominio deben existir simultáneamente en la fuente actual.
for (const token of [
  'function validarProductoPM10(',
  'function validarPedidoPM10(',
  'function validarRecepcionPedidoPM10(',
  'function validarEmpleadoPM10(',
  'function validarEncargoPM10('
]) assert.ok(src.includes(token), `falta barrera: ${token}`);

function bloque(desde,hasta){
  const a=src.indexOf(desde); assert.ok(a>=0,`no encontrado ${desde}`);
  const b=src.indexOf(hasta,a+desde.length); assert.ok(b>a,`no encontrado fin ${hasta}`);
  return src.slice(a,b);
}

// 3) Las fronteras concretas mantienen validar -> mutar.
const productos = bloque('function crearLogicaProductos(', 'function fechaValidaPedidoPM10');
const pedidos = bloque('function crearLogicaPedidos(', 'function crearLogicaFichasCosto');
const personal = bloque('function crearLogicaPersonal({', 'function crearLogicaTurnos({');
const encargos = bloque('function crearLogicaEncargos({', 'function crearLogicaVenta({');
assert.match(productos,/function addProducto\(data\)[\s\S]{0,500}validarProductoPM10[\s\S]{0,900}setProductos/);
assert.match(productos,/function updateProducto\(id, data\)[\s\S]{0,650}validarProductoPM10/);
assert.match(pedidos,/function crearPedido\(data\)[\s\S]{0,850}validarPedidoPM10/);
assert.match(pedidos,/function recibirPedido\(pedidoId, lineas\)[\s\S]{0,900}validarRecepcionPedidoPM10[\s\S]{0,900}procesarRecepcion\(\{/);
assert.match(personal,/function addEmpleado\(data\)[\s\S]{0,450}validarEmpleadoPM10[\s\S]{0,700}setEmpleados/);
assert.match(encargos,/function addEncargo\(data\)[\s\S]{0,650}validarEncargoPM10[\s\S]{0,900}setEncargos/);

// 4) No reaparecen degradaciones numéricas que fueron causa raíz.
const uiPersonal = bloque('function Personal({','function Turnos({');
assert.doesNotMatch(uiPersonal,/horasSemanales:\s*Number\(form\.horasSemanales\)\s*\|\|\s*0/);
assert.doesNotMatch(uiPersonal,/pagas:\s*Number\(form\.pagas\)\s*\|\|\s*14/);
const uiEncIni=src.indexOf('function Encargos({');
const uiEncFin=src.indexOf('function Clientes(',uiEncIni);
const uiEnc=src.slice(uiEncIni,uiEncFin>uiEncIni?uiEncFin:uiEncIni+60000);
assert.doesNotMatch(uiEnc,/const validas = form\.lineas\.filter/);
assert.doesNotMatch(uiEnc,/se\\u00F1al:\s*form\.se\\u00F1al === "" \? 0 : Number\(form\.se\\u00F1al\)/);

// 5) Las pruebas de los cierres anteriores contienen explícitamente legados/atomicidad/contexto.
const tests = {
  p04: fs.readFileSync('tests/pm10/p04-productos-contract.mjs','utf8'),
  p05: fs.readFileSync('tests/pm10/p05-pedidos-contract.mjs','utf8'),
  p06: fs.readFileSync('tests/pm10/p06-recepcion-contract.mjs','utf8'),
  p07: fs.readFileSync('tests/pm10/p07-personal-contract.mjs','utf8'),
  p08: fs.readFileSync('tests/pm10/p08-encargos-contract.mjs','utf8')
};
assert.match(tests.p04,/validarProductoPM10/);
assert.match(tests.p05,/cantidadRecibida/);
assert.match(tests.p06,/Todo o nada|todo o nada|sobre-recepción no toca/);
assert.match(tests.p07,/legado/i);
assert.match(tests.p07,/otro local/i);
assert.match(tests.p08,/legado/i);
assert.match(tests.p08,/cero mutaciones|mutaciones\(\), 0/);
assert.match(tests.p08,/otra empresa|cliente de otra empresa|referencia_otro_contexto/i);

// 6) Evidencias de cierre presentes y cierres JSON marcados VALIDADO.
for (const path of [
  'tests/pm10/P04_LA011_PRODUCTOS_EVIDENCIA.md',
  'tests/pm10/P05_PEDIDOS_EVIDENCIA.json',
  'tests/pm10/P06_RECEPCION_EVIDENCIA.json',
  'tests/pm10/P07_PERSONAL_EVIDENCIA.json',
  'tests/pm10/P08_ENCARGOS_EVIDENCIA.json'
]) assert.ok(fs.existsSync(path),`falta evidencia ${path}`);
for (const path of ['tests/pm10/P05_PEDIDOS_EVIDENCIA.json','tests/pm10/P06_RECEPCION_EVIDENCIA.json','tests/pm10/P07_PERSONAL_EVIDENCIA.json','tests/pm10/P08_ENCARGOS_EVIDENCIA.json']) {
  const ev=JSON.parse(fs.readFileSync(path,'utf8'));
  assert.equal(ev.estado,'VALIDADO',`${path} no está VALIDADO`);
}
const evP04=fs.readFileSync('tests/pm10/P04_LA011_PRODUCTOS_EVIDENCIA.md','utf8');
assert.match(evP04,/VALIDADO|CERRADO/i);

console.log('PM10 P09 transversal: contrato común, atomicidad, legados y contexto OK');
