import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js','utf8');

// saveKey debe seguir siendo una capa transparente: serializa y delega; no normaliza dominio.
const saveIni = src.indexOf('async function saveKey(key, value) {');
const saveFin = src.indexOf('async function sincronizarStockPm07', saveIni);
assert.ok(saveIni >= 0 && saveFin > saveIni, 'saveKey presente');
const save = src.slice(saveIni, saveFin);
assert.match(save, /window\.storage\.set\(key, JSON\.stringify\(value\), false\)/);
assert.doesNotMatch(save, /Number\([^)]*\)\s*\|\|/);

// El wrapper de storage mantiene la autoridad de permisos/contexto antes de setOriginal.
const wrapIni = src.indexOf('window.storage.set = async function(key, value, shared) {');
assert.ok(wrapIni >= 0, 'wrapper window.storage.set presente');
const wrap = src.slice(wrapIni, wrapIni + 2600);
assert.match(wrap, /CLAVES_CONTROLADAS/);
assert.match(wrap, /obtenerContexto\(false\)/);
assert.match(wrap, /puedeEscribir\(rol, key\)/);
assert.match(wrap, /setOriginal\(key, value, shared\)/);

// Los cinco dominios PM10 mantienen barrera reutilizable antes de sus mutaciones.
for (const token of [
  'function validarProductoPM10(',
  'function validarPedidoPM10(',
  'function validarRecepcionPedidoPM10(',
  'function validarEmpleadoPM10(',
  'function validarEncargoPM10('
]) assert.ok(src.includes(token), `falta ${token}`);

function bloque(desde,hasta){
  const a=src.indexOf(desde), b=src.indexOf(hasta,a+desde.length);
  assert.ok(a>=0 && b>a, `bloque no encontrado: ${desde}`);
  return src.slice(a,b);
}
const productos = bloque('function crearLogicaProductos(', 'function fechaValidaPedidoPM10');
assert.match(productos, /function addProducto\(data\)[\s\S]*?validarProductoPM10\(data/);
const pedidos = bloque('function crearLogicaPedidos(', 'function crearLogicaFichasCosto');
assert.match(pedidos, /function crearPedido\([\s\S]*?validarPedidoPM10/);
assert.match(pedidos, /function recibirPedido\([\s\S]*?validarRecepcionPedidoPM10[\s\S]*?procesarRecepcion\(\{/);
const personal = bloque('function crearLogicaPersonal({', 'function crearLogicaTurnos({');
assert.match(personal, /function addEmpleado\(data\)[\s\S]*?validarEmpleadoPM10/);
const encargos = bloque('function crearLogicaEncargos({', 'function crearLogicaVenta({');
assert.match(encargos, /function addEncargo\(data\)[\s\S]*?validarEncargoPM10/);

// PM10 P10: la utilidad de reintento NO puede escribir almacen_kv directamente.
const diagIni = src.indexOf('function DiagnosticoSincronizacion()');
assert.ok(diagIni >= 0, 'DiagnosticoSincronizacion presente');
const diagFin0 = src.indexOf('function ', diagIni + 'function DiagnosticoSincronizacion()'.length);
const diag = src.slice(diagIni, diagFin0 > diagIni ? diagFin0 : diagIni + 18000);
assert.match(diag, /await window\.storage\.set\(key, valorLocal, false\)/);
assert.doesNotMatch(diag, /from\("almacen_kv"\)\.upsert/);
assert.match(diag, /JSON\.parse\(valorLocal\)/, 'payload pendiente se parsea antes de delegar');

console.log('PM10 P10 autoridad persistencia: contrato OK');
