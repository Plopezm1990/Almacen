import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('pm12-conteo-estados-v1.js', 'utf8');
const context = { globalThis: {} };
vm.createContext(context);
vm.runInContext(source, context);

const estados = context.globalThis.__pm12ConteoEstados;
const docs = context.globalThis.__pm12DocumentoConteo;
assert.ok(estados && docs, 'APIs PM12 disponibles');

const clockValues = [
  '2026-09-07T10:00:00.000Z',
  '2026-09-07T10:01:00.000Z',
  '2026-09-07T10:02:00.000Z',
  '2026-09-07T10:03:00.000Z'
];
const reloj = () => clockValues.shift();

assert.equal(docs.crearDocumento({}).error, 'id_obligatorio');
assert.equal(docs.crearDocumento({ id: 'C1' }).error, 'empresa_obligatoria');
assert.equal(docs.crearDocumento({ id: 'C1', empresaId: 'A', localId: 'todos', actorId: 'U1' }).error, 'local_obligatorio');
assert.equal(docs.crearDocumento({ id: 'C1', empresaId: 'A', localId: 'A1', actorId: 'U1', ambito: 'otro' }).error, 'ambito_invalido');
assert.equal(docs.crearDocumento({ id: 'C1', empresaId: 'A', localId: 'A1', actorId: 'U1', productos: [{ id: 'P1' }, { id: 'P1' }] }).error, 'producto_duplicado');

const creado = docs.crearDocumento({
  id: 'C1',
  empresaId: 'A',
  localId: 'A1',
  ambito: 'total',
  actorId: 'U1',
  actorNombre: 'Dailyn',
  productos: [{ id: 'P1' }, { id: 'P2' }],
  reloj
});
assert.equal(creado.ok, true);
assert.equal(creado.documento.estado, estados.ESTADOS.BORRADOR);
assert.equal(creado.documento.items.length, 2);
assert.equal(creado.documento.items[0].conteo, '');
assert.equal(creado.documento.iniciadoEn, '2026-09-07T10:00:00.000Z');

assert.equal(docs.validarContexto(creado.documento, { empresaId: 'B', localId: 'A1' }).error, 'empresa_no_coincide');
assert.equal(docs.validarContexto(creado.documento, { empresaId: 'A', localId: 'A2' }).error, 'local_no_coincide');
assert.equal(docs.validarContexto(creado.documento, { empresaId: 'A', localId: 'todos' }).error, 'todos_no_es_destino');

const captura = docs.actualizarCaptura(
  creado.documento,
  { productoId: 'P1', valor: 0 },
  { contexto: { empresaId: 'A', localId: 'A1' }, reloj }
);
assert.equal(captura.ok, true);
assert.equal(captura.documento.estado, estados.ESTADOS.EN_CURSO);
assert.equal(captura.documento.items[0].conteo, 0);
assert.equal(captura.documento.items[1].conteo, '');
assert.equal(captura.cobertura.contados, 1);
assert.equal(captura.cobertura.pendientes, 1);
assert.equal(creado.documento.items[0].conteo, '', 'actualización no muta el original');

assert.equal(
  docs.actualizarCaptura(captura.documento, { productoId: 'PX', valor: 1 }, { contexto: { empresaId: 'A', localId: 'A1' } }).error,
  'producto_fuera_del_corte'
);

const conResponsable = docs.actualizarResponsables(
  captura.documento,
  { contadoPor: 'Dailyn', revisor: 'Responsable QA' },
  { contexto: { empresaId: 'A', localId: 'A1' }, reloj }
);
assert.equal(conResponsable.ok, true);
assert.equal(conResponsable.documento.responsables.contadoPor, 'Dailyn');

assert.equal(
  docs.cerrarDocumento(conResponsable.documento, {
    contexto: { empresaId: 'A', localId: 'A1' },
    confirmarParcial: true,
    motivoParcial: 'Zona temporalmente cerrada',
    reloj
  }).error,
  'actor_cierre_obligatorio'
);

const cerrado = docs.cerrarDocumento(conResponsable.documento, {
  contexto: { empresaId: 'A', localId: 'A1' },
  confirmarParcial: true,
  motivoParcial: 'Zona temporalmente cerrada',
  actorId: 'U2',
  actorNombre: 'Revisor QA',
  reloj: () => '2026-09-07T10:04:00.000Z'
});
assert.equal(cerrado.ok, true);
assert.equal(cerrado.documento.estado, estados.ESTADOS.PARCIAL);
assert.equal(cerrado.documento.corte.empresaId, 'A');
assert.equal(cerrado.documento.corte.localId, 'A1');
assert.equal(cerrado.documento.corte.productosContados, 1);
assert.equal(cerrado.documento.corte.productosPendientes, 1);
assert.equal(cerrado.documento.corte.porcentajeCobertura, 50);
assert.equal(cerrado.documento.corte.actorCierre.id, 'U2');
assert.equal(cerrado.documento.cerradoEn, '2026-09-07T10:04:00.000Z');

assert.equal(
  docs.actualizarCaptura(cerrado.documento, { productoId: 'P2', valor: 2 }, { contexto: { empresaId: 'A', localId: 'A1' } }).error,
  'documento_cerrado'
);
assert.equal(
  docs.actualizarResponsables(cerrado.documento, { contadoPor: 'Otro' }, { contexto: { empresaId: 'A', localId: 'A1' } }).error,
  'documento_cerrado'
);
assert.equal(
  docs.cerrarDocumento(cerrado.documento, { contexto: { empresaId: 'A', localId: 'A1' } }).error,
  'documento_ya_cerrado'
);

console.log('PM12_P03_DOCUMENTO_CORTE=PASS');
