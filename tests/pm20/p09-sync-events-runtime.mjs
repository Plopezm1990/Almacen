import assert from 'node:assert/strict';
import fs from 'node:fs';

// Runtime contract for the event boundary used by GestionAlmacen's visible
// synchronization banner. It does not touch a browser, Supabase or data: the
// storage adapter is a deterministic in-memory stub and every emitted event
// is captured locally.
const root = new URL('../../', import.meta.url);
const fuente = fs.readFileSync(new URL('fuente.js', root), 'utf8').replace(/\r\n/g, '\n');
const inicio = fuente.indexOf('async function saveKey(key, value)');
const fin = fuente.indexOf('\nfunction claveContextoPm07', inicio);
assert.ok(inicio >= 0 && fin > inicio, 'no se encontró saveKey');

class EventoPrueba {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail || {}; }
}

function entorno(respuesta) {
  const eventos = [];
  const llamadas = [];
  const window = {
    storage: {
      async set(...args) { llamadas.push(args); if (respuesta instanceof Error) throw respuesta; return respuesta; }
    },
    dispatchEvent(evento) { eventos.push(evento); return true; },
    __nubeActiva: false,
    __nubeCliente: null
  };
  const fabrica = new Function('window', 'CustomEvent', `${fuente.slice(inicio, fin)}\nreturn saveKey;`);
  return { saveKey: fabrica(window, EventoPrueba), window, eventos, llamadas };
}

// Un guardado local pendiente debe producir el evento que hace visible el
// estado pendiente, conservando la clave que se puede reintentar.
{
  const e = entorno({ pendienteSincronizacion: true });
  await e.saveKey('productos', [{ id: 'p-1' }]);
  assert.equal(e.llamadas.length, 1);
  assert.deepEqual(e.eventos.map((x) => [x.type, x.detail]), [[
    'fallo-guardado',
    { key: 'productos', pendiente: true, mensaje: 'Guardado en este equipo; pendiente de confirmación del servidor.' }
  ]]);
}

// La confirmación del servidor debe limpiar el aviso mediante el evento
// opuesto y no dejar un estado de error visible.
{
  const e = entorno({ confirmadoServidor: true });
  await e.saveKey('productos', [{ id: 'p-1' }]);
  assert.deepEqual(e.eventos.map((x) => [x.type, x.detail]), [[
    'guardado-confirmado', { key: 'productos' }
  ]]);
}

// Una cuota agotada se clasifica como cuota para que la UI use un alert
// accionable y no se presente como sincronización confirmada.
{
  const e = entorno(new Error('QuotaExceededError: storage full'));
  const errorOriginal = console.error;
  console.error = () => {};
  try {
    await e.saveKey('historialRespaldos', [{ id: 'r-1' }]);
  } finally {
    console.error = errorOriginal;
  }
  assert.equal(e.eventos.length, 1);
  assert.equal(e.eventos[0].type, 'fallo-guardado');
  assert.deepEqual(e.eventos[0].detail, {
    key: 'historialRespaldos',
    mensaje: 'QuotaExceededError: storage full',
    categoria: 'cuota'
  });
}

// Los ledgers ya confirmados por RPC no deben duplicarse en el almacenamiento
// local; aun así la UI recibe la confirmación para retirar avisos antiguos.
{
  const e = entorno({ pendienteSincronizacion: true });
  e.window.__nubeActiva = true;
  e.window.__nubeCliente = { id: 'cliente-qa' };
  await e.saveKey('devoluciones', [{ id: 'd-1' }]);
  assert.equal(e.llamadas.length, 0);
  assert.deepEqual(e.eventos.map((x) => [x.type, x.detail]), [[
    'guardado-confirmado', { key: 'devoluciones', cacheLocalOmitida: true, ledgerServidor: true }
  ]]);
}

console.log('PM20 P09 eventos de sincronización: 4/4 PASS');
