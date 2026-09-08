import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('pm12-conteo-estados-v1.js', 'utf8');
const context = { globalThis: {} };
vm.createContext(context);
vm.runInContext(source, context);
const api = context.globalThis.__pm12ConteoEstados;
assert.ok(api, 'API PM12 disponible');

const { ESTADOS, normalizarCantidad, resumenCobertura, estadoDerivado, validarCierre } = api;
assert.deepEqual(Object.values(ESTADOS), ['BORRADOR', 'EN_CURSO', 'PARCIAL', 'COMPLETADO', 'CANCELADO']);

for (const valor of ['', '   ', null, undefined]) {
  const r = normalizarCantidad(valor);
  assert.equal(r.estado, 'VACIO');
  assert.equal(r.contado, false);
}
for (const valor of [0, '0', '0.00', '0,00']) {
  const r = normalizarCantidad(valor);
  assert.equal(r.estado, 'VALIDO');
  assert.equal(r.contado, true);
  assert.equal(r.valor, 0);
}

assert.equal(normalizarCantidad(-1).error, 'cantidad_negativa');
assert.equal(normalizarCantidad('abc').error, 'cantidad_no_finita');
assert.equal(normalizarCantidad(Infinity).error, 'cantidad_no_finita');
assert.equal(normalizarCantidad(1.5, { indivisible: true }).error, 'unidad_indivisible');
assert.equal(normalizarCantidad('1.25', { precision: 2 }).valor, 1.25);
assert.equal(normalizarCantidad('1.234', { precision: 2 }).error, 'precision_excedida');

const items = [
  { productoId: 'A', conteo: 0 },
  { productoId: 'B', conteo: '' },
  { productoId: 'C', conteo: '2' }
];
const cobertura = resumenCobertura(items);
assert.equal(cobertura.total, 3);
assert.equal(cobertura.contados, 2);
assert.equal(cobertura.pendientes, 1);
assert.equal(cobertura.invalidos, 0);
assert.equal(cobertura.porcentaje, 66.67);

assert.equal(estadoDerivado({ items: [] }), ESTADOS.BORRADOR);
assert.equal(estadoDerivado({ items }), ESTADOS.EN_CURSO);
assert.equal(estadoDerivado({ completado: true, items }), ESTADOS.COMPLETADO);
assert.equal(estadoDerivado({ cancelado: true, items }), ESTADOS.CANCELADO);
assert.equal(estadoDerivado({ estado: 'PARCIAL', items }), ESTADOS.PARCIAL);

assert.equal(validarCierre({ items: [] }).error, 'sin_productos');
assert.equal(validarCierre({ items: [{ productoId: 'A', conteo: '' }] }).error, 'conteo_vacio');
assert.equal(validarCierre({ items: [{ productoId: 'A', conteo: -1 }] }).error, 'cantidades_invalidas');
assert.equal(validarCierre({ items: [{ productoId: 'A', conteo: 0 }] }).error, 'responsable_obligatorio');
assert.equal(validarCierre({ items, responsables: { contadoPor: 'Dailyn' } }).error, 'cobertura_incompleta');
assert.equal(validarCierre({ items, responsables: { contadoPor: 'Dailyn' } }, { confirmarParcial: true }).error, 'motivo_parcial_obligatorio');

const parcial = validarCierre(
  { items, responsables: { contadoPor: 'Dailyn' } },
  { confirmarParcial: true, motivoParcial: 'Zona cerrada' }
);
assert.equal(parcial.ok, true);
assert.equal(parcial.estado, ESTADOS.PARCIAL);

const completo = validarCierre({
  items: [{ productoId: 'A', conteo: 0 }, { productoId: 'B', conteo: 2 }],
  responsables: { contadoPor: 'Dailyn' }
});
assert.equal(completo.ok, true);
assert.equal(completo.estado, ESTADOS.COMPLETADO);
assert.equal(completo.cobertura.porcentaje, 100);

console.log('PM12_P02_ESTADOS_NORMALIZACION=PASS');
