import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM17 P01 (lote push nativo): Notificaciones.activar() creaba la suscripción push del
// navegador ANTES de dar de alta el endpoint en Supabase, y si ese alta fallaba
// (errInsert), simplemente hacía `throw` sin deshacer la suscripción ya creada -- dejaba
// un "activado" falso en el navegador (push suscrito) sin fila real en
// suscripciones_push. Hasta ahora esto sólo lo cubría seleccion-neutral-patch.js (un
// archivo externo, cargado por red en runtime, con ventana de carrera frente al montaje
// de React -- ver docs/plan-maestro/PM17_DIAGNOSTICO_PARCHES.md).
//
// Este contrato prueba, de forma aislada (sin depender del parche externo ni de la red
// real), que activarSuscripcionPushPM17 -- la nueva pieza nativa que envuelve
// suscribir/guardar/deshacer -- nunca deja una suscripción huérfana: si guardar falla,
// deshace; si deshacer también falla, no oculta el error original; si guardar funciona,
// nunca deshace nada.

const src = fs.readFileSync('fuente.js', 'utf8');
const ini = src.indexOf('async function activarSuscripcionPushPM17(');
assert.ok(ini >= 0, 'activarSuscripcionPushPM17 no encontrada');
const fin = src.indexOf('function Notificaciones(', ini);
assert.ok(fin > ini, 'no se pudo acotar el bloque de activarSuscripcionPushPM17');

function nuevoContexto() {
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(src.slice(ini, fin), ctx);
  return ctx;
}

// ---- Positivo: guardar funciona a la primera -- nunca se deshace la suscripción. ----
{
  const ctx = nuevoContexto();
  let deshecha = false;
  const suscripcionFake = { endpoint: 'https://push.example/abc' };
  const resultado = await ctx.activarSuscripcionPushPM17({
    suscribir: async () => suscripcionFake,
    guardarSuscripcion: async () => {},
    deshacerSuscripcion: async () => { deshecha = true; }
  });
  assert.equal(resultado, suscripcionFake);
  assert.equal(deshecha, false, 'un alta correcta nunca debe deshacer la suscripción');
  console.log('P01_PM17_POSITIVO_SIN_ROLLBACK_INNECESARIO=PASS');
}

// ---- Negativo: falla el alta en Supabase -- se deshace la suscripción del navegador y
// se propaga el error original (no se oculta detrás del rollback). ----
{
  const ctx = nuevoContexto();
  let deshechaCon = null;
  const suscripcionFake = { endpoint: 'https://push.example/def' };
  const errorAlta = new Error('fila duplicada en suscripciones_push');
  await assert.rejects(
    ctx.activarSuscripcionPushPM17({
      suscribir: async () => suscripcionFake,
      guardarSuscripcion: async () => { throw errorAlta; },
      deshacerSuscripcion: async (s) => { deshechaCon = s; }
    }),
    (e) => e === errorAlta
  );
  assert.equal(deshechaCon, suscripcionFake, 'debe deshacer exactamente la suscripción recién creada');
  console.log('P01_PM17_NEGATIVO_ROLLBACK_Y_ERROR_REAL_PROPAGADO=PASS');
}

// ---- Negativo/replay: el propio deshacer también falla (p.ej. red caída al hacer
// unsubscribe) -- el error que llega al usuario sigue siendo el del alta real, nunca el
// del rollback fallido, para no confundir el diagnóstico. ----
{
  const ctx = nuevoContexto();
  const suscripcionFake = { endpoint: 'https://push.example/ghi' };
  const errorAlta = new Error('sin conexión con Supabase');
  const errorDeshacer = new Error('el navegador no pudo desuscribir');
  await assert.rejects(
    ctx.activarSuscripcionPushPM17({
      suscribir: async () => suscripcionFake,
      guardarSuscripcion: async () => { throw errorAlta; },
      deshacerSuscripcion: async () => { throw errorDeshacer; }
    }),
    (e) => e === errorAlta
  );
  console.log('P01_PM17_ROLLBACK_FALLIDO_NO_OCULTA_ERROR_ORIGINAL=PASS');
}

// ---- Replay: dos activaciones seguidas -- la primera falla y deshace, la segunda
// funciona y no vuelve a deshacer nada (no hay estado compartido entre llamadas). ----
{
  const ctx = nuevoContexto();
  let deshechas = 0;
  const intento1 = { endpoint: 'https://push.example/intento1' };
  const intento2 = { endpoint: 'https://push.example/intento2' };
  await assert.rejects(ctx.activarSuscripcionPushPM17({
    suscribir: async () => intento1,
    guardarSuscripcion: async () => { throw new Error('fallo transitorio'); },
    deshacerSuscripcion: async () => { deshechas++; }
  }));
  const resultado2 = await ctx.activarSuscripcionPushPM17({
    suscribir: async () => intento2,
    guardarSuscripcion: async () => {},
    deshacerSuscripcion: async () => { deshechas++; }
  });
  assert.equal(resultado2, intento2);
  assert.equal(deshechas, 1, 'solo el intento fallido debe deshacerse; el segundo, correcto, no');
  console.log('P01_PM17_REPLAY_SIN_ESTADO_COMPARTIDO_ENTRE_INTENTOS=PASS');
}

console.log('PM17 P01 (rollback push nativo) — activarSuscripcionPushPM17: contrato OK');
