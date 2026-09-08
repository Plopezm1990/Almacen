import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const estadosSource = fs.readFileSync(new URL('../../pm12-conteo-estados-v1.js', import.meta.url), 'utf8');
const p09Source = fs.readFileSync(new URL('../../pm12-p09-historial-informes-movil-v1.js', import.meta.url), 'utf8');

const sandbox = { console, Date, setTimeout, clearTimeout };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(estadosSource, sandbox, { filename: 'pm12-conteo-estados-v1.js' });
vm.runInContext(p09Source, sandbox, { filename: 'pm12-p09-historial-informes-movil-v1.js' });

const api = sandbox.__pm12HistorialInformesMovil;
assert.ok(api, 'P09 API no publicada');

const borrador = {
  id: 'b', empresaId: 'E', localId: 'L', estado: 'BORRADOR', ambito: 'total',
  items: [{ productoId: 'p1', conteo: '' }, { productoId: 'p2', conteo: '' }]
};
const enCurso = {
  id: 'e', empresaId: 'E', localId: 'L', ambito: 'total',
  items: [{ productoId: 'p1', conteo: 0 }, { productoId: 'p2', conteo: '' }]
};
const parcial = {
  id: 'p', empresaId: 'E', localId: 'L', estado: 'PARCIAL', ambito: 'almacen',
  fecha: '2026-09-07', cerradoEn: '2026-09-07T12:00:00Z', motivoParcial: 'Cámara pendiente',
  responsables: { contadoPor: 'Ana', revisor: 'Luis' },
  coberturaCierre: { total: 4, contados: 3, pendientes: 1, invalidos: 0, porcentaje: 75 },
  ajustesAplicados: true, ajustesCantidad: 2, ajustesAplicadosEn: '2026-09-07T12:05:00Z', ajustesActor: { nombre: 'Ana', rol: 'Encargado' }
};
const legadoCerrado = {
  id: 'l', empresaId: 'E', localId: 'L', completado: true, ambito: 'total', fecha: '2025-01-01',
  items: [{ productoId: 'p1', conteo: 1 }, { productoId: 'p2', conteo: 2 }],
  responsables: { contadoPor: 'Histórico' }
};
const cancelado = {
  id: 'c', empresaId: 'E', localId: 'L', estado: 'CANCELADO', cancelado: true, ambito: 'piso_venta',
  fecha: '2026-09-07', cerradoEn: '2026-09-07T11:00:00Z',
  coberturaCierre: { total: 2, contados: 2, pendientes: 0, invalidos: 0, porcentaje: 100 },
  ajustesAplicados: true, ajustesCantidad: 1,
  canceladoEn: '2026-09-07T12:30:00Z', motivoCancelacion: 'Conteo duplicado', responsableCancelacion: 'Laura',
  reversosCancelacion: [{ id: 'r1' }]
};

assert.equal(api.estadoCanonico(borrador), 'BORRADOR');
assert.equal(api.estadoCanonico(enCurso), 'EN_CURSO');
assert.equal(api.estadoCanonico(parcial), 'PARCIAL');
assert.equal(api.estadoCanonico(legadoCerrado), 'COMPLETADO');
assert.equal(api.estadoCanonico(cancelado), 'CANCELADO');
console.log('P09_ESTADOS_CANONICOS=PASS');

const coberturaCurso = api.coberturaHonesta(enCurso);
assert.equal(coberturaCurso.conocida, true);
assert.equal(coberturaCurso.valor.contados, 1);
assert.equal(coberturaCurso.valor.pendientes, 1);
const coberturaParcial = api.coberturaHonesta(parcial);
assert.equal(coberturaParcial.conocida, true);
assert.equal(coberturaParcial.congelada, true);
assert.equal(coberturaParcial.valor.porcentaje, 75);
const coberturaLegado = api.coberturaHonesta(legadoCerrado);
assert.equal(coberturaLegado.conocida, false, 'No reconstruir cobertura histórica cerrada');
console.log('P09_COBERTURA_HONESTA=PASS');

const rp = api.resumenConteo(parcial);
assert.equal(rp.responsable, 'Ana');
assert.equal(rp.revisor, 'Luis');
assert.equal(rp.motivoParcial, 'Cámara pendiente');
assert.equal(rp.ajustes.aplicados, true);
assert.equal(rp.ajustes.cantidad, 2);
const rc = api.resumenConteo(cancelado);
assert.equal(rc.cancelacion.motivo, 'Conteo duplicado');
assert.equal(rc.cancelacion.responsable, 'Laura');
assert.equal(rc.cancelacion.reversos, 1);
console.log('P09_TRAZABILIDAD_HISTORIAL=PASS');

const resumen = api.resumenColeccion([borrador, enCurso, parcial, legadoCerrado, cancelado], { empresaId: 'E', localId: 'L' });
assert.deepEqual(JSON.parse(JSON.stringify(resumen.porEstado)), {
  BORRADOR: 1, EN_CURSO: 1, PARCIAL: 1, COMPLETADO: 1, CANCELADO: 1
});
assert.equal(resumen.abiertos, 2);
assert.equal(resumen.cerrados, 3);
assert.equal(resumen.ajustadosHistoricos, 2);
assert.equal(resumen.cierresConCobertura, 2);
assert.equal(resumen.cierresSinCobertura, 1);
assert.equal(resumen.reversosCancelacion, 1);
assert.equal(api.filtrarScope([parcial, { ...parcial, id: 'otro', localId: 'X' }], { empresaId: 'E', localId: 'L' }).length, 1);
console.log('P09_INFORMES_SCOPE_ESTADOS=PASS');

assert.match(p09Source, /data-pm12-p09-history-list/);
assert.match(p09Source, /pm12-p09-report-grid/);
assert.match(p09Source, /@media\(max-width:640px\)/);
assert.match(p09Source, /pm12-p09-capture-grid/);
assert.match(p09Source, /No disponible \(histórico sin cobertura congelada\)/);
assert.doesNotMatch(p09Source, /supabase\.co|sb_publishable_|service_role|fetch\s*\(/i);
assert.doesNotMatch(p09Source, /localStorage\.setItem|\.insert\(|\.update\(|\.delete\(/i);
console.log('P09_SOLO_PRESENTACION_SIN_ESCRITURAS=PASS');
