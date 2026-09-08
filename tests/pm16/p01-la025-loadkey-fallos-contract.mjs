import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM16 P01 (LA-025): "Primera carga con colección opcional ausente muestra vacío, sin
// reintentos falsos. Corrupción/permiso/fallo real siguen detectándose y no se ocultan."
//
// Bug real encontrado por inspección de código: loadKey() capturaba en el MISMO catch un
// fallo de acceso real de window.storage.get (red, permiso, cuota) y un JSON.parse de un
// valor corrupto -- ambos acababan devolviendo el fallback en silencio, con solo un
// console.error (invisible para el usuario real). Una colección legítimamente ausente
// (primer arranque) y un dato realmente dañado eran indistinguibles desde fuera.
//
// Arreglo: se separan las dos fases (obtener vs. parsear) en try/catch distintos, se
// clasifica el motivo real (corrupcion/cuota/acceso) y se dispara un evento `fallo-carga`
// -- mismo patrón ya usado por saveKey() con `fallo-guardado` -- solo cuando hay un fallo
// real, nunca para el caso legítimo de "la clave no existe todavía".

const src = fs.readFileSync('fuente.js', 'utf8');
const ini = src.indexOf('function motivoFalloCargaPM16(');
assert.ok(ini >= 0, 'motivoFalloCargaPM16 no encontrada');
const fin = src.indexOf('async function sincronizarConteosPm12(', ini);
assert.ok(fin > ini, 'no se pudo acotar el bloque de loadKey');

function nuevoContexto() {
  const eventos = [];
  const ctx = {
    console,
    setTimeout,
    window: {
      storage: { get: null },
      dispatchEvent: (ev) => { eventos.push({ type: ev.type, detail: ev.detail }); },
      CustomEvent: class CustomEvent {
        constructor(type, opts) { this.type = type; this.detail = opts && opts.detail; }
      }
    },
    CustomEvent: class CustomEvent {
      constructor(type, opts) { this.type = type; this.detail = opts && opts.detail; }
    }
  };
  vm.createContext(ctx);
  vm.runInContext(src.slice(ini, fin), ctx);
  return { ctx, eventos };
}

// ---- motivoFalloCargaPM16: clasificación pura del motivo real. ----
{
  const { ctx } = nuevoContexto();
  assert.equal(ctx.motivoFalloCargaPM16({ name: 'QuotaExceededError' }), 'cuota');
  assert.equal(ctx.motivoFalloCargaPM16({ code: 22 }), 'cuota');
  assert.equal(ctx.motivoFalloCargaPM16({ name: 'NetworkError' }), 'acceso');
  assert.equal(ctx.motivoFalloCargaPM16(null), 'acceso');
  console.log('P01_LA025_MOTIVO_FALLO_CLASIFICA_CORRECTAMENTE=PASS');
}

// ---- Positivo: colección legítimamente ausente -- sin evento, sin reintentos falsos. ----
{
  const { ctx, eventos } = nuevoContexto();
  let llamadas = 0;
  ctx.window.storage.get = async () => { llamadas++; return { value: undefined }; };
  const resultado = await ctx.loadKey('coleccion_nueva', []);
  assert.deepEqual(resultado, []);
  assert.equal(llamadas, 1, 'una colección ausente no debe generar reintentos');
  assert.equal(eventos.length, 0, 'una colección ausente nunca debe disparar fallo-carga');
  console.log('P01_LA025_AUSENTE_SIN_REINTENTOS_NI_EVENTO=PASS');
}

// ---- Corrupción: el valor guardado no es JSON válido -- se detecta, no se reintenta (no
// tiene sentido reintentar un dato ya corrupto), y se dispara fallo-carga con ese motivo. ----
{
  const { ctx, eventos } = nuevoContexto();
  let llamadas = 0;
  ctx.window.storage.get = async () => { llamadas++; return { value: '{ esto no es json' }; };
  const resultado = await ctx.loadKey('productos', []);
  assert.deepEqual(resultado, [], 'ante corrupción, se usa el fallback, no se inventan datos');
  assert.equal(llamadas, 1, 'la corrupción no depende de reintentos: no se repite la lectura');
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].type, 'fallo-carga');
  assert.equal(eventos[0].detail.motivo, 'corrupcion');
  assert.equal(eventos[0].detail.key, 'productos');
  console.log('P01_LA025_CORRUPCION_DETECTADA_Y_NOTIFICADA=PASS');
}

// ---- Fallo de acceso transitorio: falla las primeras veces y se recupera antes de agotar
// los reintentos -- nunca se notifica un fallo si al final se pudo cargar bien. ----
{
  const { ctx, eventos } = nuevoContexto();
  let intento = 0;
  ctx.window.storage.get = async () => {
    intento++;
    if (intento < 2) throw new Error('fallo de red transitorio');
    return { value: JSON.stringify([{ id: 'p1' }]) };
  };
  const resultado = await ctx.loadKey('productos', []);
  // resultado se creó vía JSON.parse dentro del contexto vm (otro realm de V8): mismo
  // contenido, prototipo distinto al de este archivo. Se serializa antes de comparar.
  assert.deepEqual(JSON.parse(JSON.stringify(resultado)), [{ id: 'p1' }]);
  assert.equal(eventos.length, 0, 'si el reintento recupera los datos, no hay fallo real que notificar');
  console.log('P01_LA025_ACCESO_TRANSITORIO_SE_RECUPERA_SIN_AVISO=PASS');
}

// ---- Fallo de acceso persistente: agota todos los reintentos -- se detecta y se notifica,
// nunca se oculta detrás de un fallback silencioso. ----
{
  const { ctx, eventos } = nuevoContexto();
  let llamadas = 0;
  ctx.window.storage.get = async () => { llamadas++; throw new Error('permiso denegado'); };
  const resultado = await ctx.loadKey('encargos', [], 2);
  assert.deepEqual(resultado, []);
  assert.equal(llamadas, 3, 'debe agotar los 2 reintentos (3 intentos en total) antes de rendirse');
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].detail.motivo, 'acceso');
  assert.equal(eventos[0].detail.key, 'encargos');
  assert.match(eventos[0].detail.mensaje, /permiso denegado/);
  console.log('P01_LA025_ACCESO_PERSISTENTE_DETECTADO_Y_NOTIFICADO=PASS');
}

// ---- Cuota agotada: se clasifica correctamente como "cuota", no como "acceso" genérico. ----
{
  const { ctx, eventos } = nuevoContexto();
  ctx.window.storage.get = async () => {
    const err = new Error('quota exceeded');
    err.name = 'QuotaExceededError';
    throw err;
  };
  await ctx.loadKey('movimientos', [], 0);
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].detail.motivo, 'cuota');
  console.log('P01_LA025_CUOTA_CLASIFICADA_CORRECTAMENTE=PASS');
}

console.log('PM16 P01 (LA-025) — loadKey diferencia ausencia/corrupción/cuota/acceso: contrato OK');
