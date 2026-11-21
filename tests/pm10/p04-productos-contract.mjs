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
ok({ nombre:'Materia prima', costo:0, stockMinimo:0, precioVenta:'', stock:'' });
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

assert.match(src, /function addProducto\(data\)\s*\{\s*const validacion = validarProductoPM10\(data, \{ parcial: false \}\);/);
assert.match(src, /function updateProducto\(id, data\)[\s\S]{0,500}validarProductoPM10\(data, \{ parcial: true \}\)/);
assert.doesNotMatch(src, /const nuevo = \{ id: uid\(\), stock: Number\(data\.stock\) \|\| 0, \.\.\.data/);
assert.doesNotMatch(src, /costo: Number\(nuevoProd\.costo\) \|\| 0/);
assert.doesNotMatch(src, /addProducto\(\{ \.\.\.form, costo: Number\(form\.costo\) \|\| 0/);
assert.doesNotMatch(src, /costo: Number\(editForm\.costo\) \|\| 0,[\s\S]{0,300}stockMinimo: Number\(editForm\.stockMinimo\) \|\| 0/);
assert.match(src, /const creado = addProducto\(form\);[\s\S]{0,180}setError\(creado\?\.error/);
assert.match(src, /const actualizado = updateProducto\(editFor, editForm\);[\s\S]{0,220}setEditError\(actualizado\?\.error/);
assert.match(src, /function guardarProductoNuevo\(\)[\s\S]{0,900}costo: nuevoProd\.costo/);
// ---- El aviso tiene que estar escrito para quien rellena el formulario. ----
//
// Hasta el 16/11/2026 el validador metía el nombre interno del campo en el texto:
// dejabas "Stock mínimo (reorden)" en blanco y la pantalla respondía
// "stockMinimo es obligatorio." — comprobado pulsando en QA. Eso es cómo lo
// llamamos nosotros, no cómo se llama la casilla que el usuario está mirando.
{
  const sinNombreInterno = (r) => {
    assert.equal(r.ok, false);
    assert.doesNotMatch(r.error, /stockMinimo|udsPorCaja|precioVenta|ivaCompra|ivaVenta|costoUnitario|precioBruto|ivaPct/,
      `el aviso no puede enseñar el nombre interno del campo: ${r.error}`);
    return r.error;
  };

  const vacio = sinNombreInterno(validar({ nombre: 'X', costo: 1 }));
  assert.match(vacio, /"Stock mínimo"/, 'tiene que nombrar la casilla como se ve en pantalla');

  const fuera = sinNombreInterno(validar({ nombre: 'X', costo: 1, stockMinimo: 0, udsPorCaja: 0 }));
  assert.match(fuera, /"Unidades por caja"/);

  const tope = sinNombreInterno(validar({ nombre: 'X', costo: 1, stockMinimo: 0, ivaCompra: 101 }));
  assert.match(tope, /"IVA de compra"/);
  assert.match(tope, /no puede ser mayor que 100/);

  // El código y el campo siguen siendo los de siempre: lo que cambia es el texto.
  const r = validar({ nombre: 'X', costo: 1 });
  assert.equal(r.campo, 'stockMinimo');
  assert.equal(r.codigo, 'campo_obligatorio');

  // Y en una lista de líneas, dice de cuál se trata.
  const etiqueta = ctx.etiquetaCampoPM10;
  assert.equal(typeof etiqueta, 'function');
  assert.equal(etiqueta('lineas.2.cantidad'), '"Cantidad" (línea 3)');
  assert.equal(etiqueta('stockMinimo'), '"Stock mínimo"');
  assert.equal(etiqueta('campoQueNadieHaBautizado'), '"campoQueNadieHaBautizado"');
  console.log('P04_AVISOS_CON_EL_NOMBRE_DE_LA_CASILLA=PASS');
}

console.log('PM10 P04 LA-011 productos: contrato OK');
