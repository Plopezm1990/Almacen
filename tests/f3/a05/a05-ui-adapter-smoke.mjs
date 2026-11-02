import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrls = [
  new URL('../../../fuente.js', import.meta.url),
  new URL('../../../source-recovery/fuente-recuperado.js', import.meta.url),
];

function extraerAccionEnviar(source) {
  const start = source.indexOf('async function enviarPedidoGuardadoA05()');
  // Release newer than the original QA branch inserts the separate
  // enviarPedidoOperativoA05 action immediately after this one. Stop at
  // that boundary so the harness evaluates exactly one function.
  const endOperativo = source.indexOf('\n  async function enviarPedidoOperativoA05(', start);
  const end = endOperativo >= 0
    ? endOperativo
    : source.indexOf('\n  async function ejecutarAccionA05(', start);
  assert.ok(start >= 0 && end > start, 'A05 UI: acción de envío no localizable');
  return source.slice(start, end).trim();
}

function crearHarness(source, { respuesta }) {
  const estado = {
    procesandoA05: false,
    confirmacion: {
      pedidoId: 'pedido-ui-fixture',
      pedidoEstado: 'ABIERTO',
      pedidoVersion: 1,
      lineas: [{ lineaId: 'linea-ui-fixture', estado: 'CONFIRMADA' }],
    },
    errorA05: '',
    conflicto: null,
    pedidoOperativo: null,
    confirmacionActualizaciones: 0,
    llamadas: 0,
  };

  const adaptador = async () => {
    estado.llamadas += 1;
    return typeof respuesta === 'function' ? respuesta(estado.llamadas) : respuesta;
  };
  const setConfirmacion = (updater) => {
    estado.confirmacion = typeof updater === 'function' ? updater(estado.confirmacion) : updater;
    estado.confirmacionActualizaciones += 1;
  };

  // Execute the production action with only its adapter and React state
  // setters mocked. No browser, network or persistent QA data is involved.
  return {
    estado,
    ejecutar: async () => {
      const runtime = new Function(
        'procesandoA05',
        'confirmacion',
        'enviarPedidoA05',
        'gestionarConflictoA06',
        'setProcesandoA05',
        'setErrorA05',
        'setConflictoA06',
        'setConfirmacion',
        'setPedidoOperativoA05',
        `return (${extraerAccionEnviar(source)});`,
      )(
        estado.procesandoA05,
        estado.confirmacion,
        adaptador,
        async () => false,
        (value) => { estado.procesandoA05 = value; },
        (value) => { estado.errorA05 = value; },
        (value) => { estado.conflicto = value; },
        setConfirmacion,
        (value) => { estado.pedidoOperativo = value; },
      );
      await runtime();
    },
  };
}

const fixtureEnviado = {
  ok: true,
  pedidoVersion: 2,
  pedidoEstado: 'ENVIADO',
  lineas: [{ lineaId: 'linea-ui-fixture', estado: 'ENVIADA' }],
};

test('A05 UI mock bloqueado conserva pedido guardado y muestra el error', async () => {
  const sources = await Promise.all(sourceUrls.map((url) => readFile(url, 'utf8')));
  for (const source of sources) {
    const harness = crearHarness(source, {
      respuesta: {
        ok: false,
        error: 'Hay un producto que requiere preparación pero no tiene una ruta activa a cocina. Configura la ruta y vuelve a intentarlo.',
      },
    });
    await harness.ejecutar();
    assert.equal(harness.estado.llamadas, 1);
    assert.equal(harness.estado.errorA05.includes('no tiene una ruta activa'), true);
    assert.equal(harness.estado.confirmacion.pedidoEstado, 'ABIERTO');
    assert.equal(harness.estado.confirmacionActualizaciones, 0);
    assert.equal(harness.estado.procesandoA05, false);
  }
});

test('A05 UI mock correcto cambia a ENVIADO sólo tras ok', async () => {
  const sources = await Promise.all(sourceUrls.map((url) => readFile(url, 'utf8')));
  for (const source of sources) {
    const harness = crearHarness(source, { respuesta: fixtureEnviado });
    await harness.ejecutar();
    assert.equal(harness.estado.errorA05, '');
    assert.equal(harness.estado.confirmacion.pedidoEstado, 'ENVIADO');
    assert.equal(harness.estado.confirmacion.pedidoVersion, 2);
    assert.equal(harness.estado.confirmacion.lineas[0].estado, 'ENVIADA');
    assert.equal(harness.estado.pedidoOperativo, fixtureEnviado);
    assert.equal(harness.estado.confirmacionActualizaciones, 1);
    assert.equal(harness.estado.procesandoA05, false);
  }
});

test('A05 UI mock permite reintentar sin crear un segundo identificador de operación', async () => {
  const sources = await Promise.all(sourceUrls.map((url) => readFile(url, 'utf8')));
  for (const source of sources) {
    const operationIds = [];
    const harness = crearHarness(source, {
      respuesta: (attempt) => {
        operationIds.push('a05.2.send.pedido-ui-fixture');
        return attempt === 1
          ? { ok: false, error: 'Error temporal de conexión.' }
          : fixtureEnviado;
      },
    });

    await harness.ejecutar();
    assert.equal(harness.estado.confirmacion.pedidoEstado, 'ABIERTO');
    assert.equal(harness.estado.errorA05, 'Error temporal de conexión.');
    await harness.ejecutar();
    assert.equal(harness.estado.confirmacion.pedidoEstado, 'ENVIADO');
    assert.deepEqual(operationIds, ['a05.2.send.pedido-ui-fixture', 'a05.2.send.pedido-ui-fixture']);
    assert.equal(harness.estado.llamadas, 2);
  }
});

console.log('ABC_F3_A05_UI_ADAPTER_SMOKE=PASS');
