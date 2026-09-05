import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');
const ini = src.indexOf('function errorValidacionPM10');
const fin = src.indexOf('function crearLogicaProductos', ini);
assert.ok(ini >= 0 && fin > ini, 'helpers PM10 de producto presentes');
const helpers = src.slice(ini, fin);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(helpers, ctx);
const validar = ctx.validarProductoPM10;
assert.equal(typeof validar, 'function');

function ok(data, opts) { assert.equal(validar(data, opts).ok, true); }
function fail(data, campo, codigo, opts) {
  const r = validar(data, opts);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.campo, campo);
  assert.equal(r.codigo, codigo);
}

ok({ nombre:' Café ', costo:3, stockMinimo:0, stock:5, precioVenta:6, udsPorCaja:12, ivaCompra:10, ivaVenta:21 });
fail({ nombre:'', costo:3, stockMinimo:0 }, 'nombre', 'campo_obligatorio');
fail({ nombre:'X', costo:'abc', stockMinimo:0 }, 'costo', 'numero_no_finito');
fail({ nombre:'X', costo:-0.01, stockMinimo:0 }, 'costo', 'valor_fuera_rango');
fail({ nombre:'X', costo:1, stockMinimo:-1 }, 'stockMinimo', 'valor_fuera_rango');
fail({ nombre:'X', costo:1, stockMinimo:0, precioVenta:-1 }, 'precioVenta', 'valor_fuera_rango');
fail({ nombre:'X', costo:1, stockMinimo:0, udsPorCaja:0 }, 'udsPorCaja', 'valor_fuera_rango');
fail({ nombre:'X', costo:1, stockMinimo:0, stock:-1 }, 'stock', 'valor_fuera_rango');
fail({ nombre:'X', costo:1, stockMinimo:0, ivaCompra:101 }, 'ivaCompra', 'valor_fuera_rango');
fail({ nombre:'X', costo:1, stockMinimo:0, ivaVenta:-1 }, 'ivaVenta', 'valor_fuera_rango');
fail({ nombre:'X', costo:Infinity, stockMinimo:0 }, 'costo', 'numero_no_finito');
fail({ nombre:'X', costo:1, stockMinimo:0, udsPorCaja:'NaN' }, 'udsPorCaja', 'numero_no_finito');

ok({ precioVenta:0 }, { parcial:true });
fail({ precioVenta:-1 }, 'precioVenta', 'valor_fuera_rango', { parcial:true });
fail({ stock:-1 }, 'stock', 'valor_fuera_rango', { parcial:true });

assert.match(src, /function addProducto\(data\) \{\n    const validacion = validarProductoPM10\(data, \{ parcial: false \}\);/);
assert.match(src, /function updateProducto\(id, data\)[\s\S]{0,400}validarProductoPM10\(data, \{ parcial: true \}\)/);
assert.doesNotMatch(src, /const nuevo = \{ id: uid\(\), stock: Number\(data\.stock\) \|\| 0, \.\.\.data/);
assert.doesNotMatch(src, /costo: Number\(nuevoProd\.costo\) \|\| 0/);
assert.match(src, /if \(!creado \|\| creado\.ok === false\)/);
console.log('PM10 P04 LA-011 productos: contrato OK');
