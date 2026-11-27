/**
 * Contrato de ejecución de H-22 (auditoría del TPV, 25/11/2026; reproducido en el navegador de QA el 27/11/2026):
 * tras «Guardar pedido» y «Enviar pedido» no aparecía el cobro.
 *
 *   node tests/rediseno/h22-enviar-pedido-conserva-la-cuenta-contract.mjs
 *   H22_FUENTE=/ruta/a/otra/fuente.js node tests/rediseno/h22-...   (para comprobar que el código anterior falla)
 *
 * Causa: `enviarPedidoA05` devolvía `{ ok, pedidoId, pedidoVersion, pedidoEstado, lineas, lineasEnviadas }` SIN `cuentaId`, y
 * «Enviar pedido» del modal lo guarda con `setPedidoOperativoA05(resultado)`. `renderCobroF4` pinta «Caja del TPV» cuando el
 * pedido operativo no tiene `cuentaId`, así que el cobro desaparecía (y con él, las mesas) hasta recargar la página.
 *
 * Qué se fija, ejecutando el código REAL (las funciones se extraen de fuente.js y se evalúan con stubs):
 *   A. `enviarPedidoA05` devuelve el contexto completo, con la cuenta, tanto al enviar como si el pedido ya estaba enviado.
 *   B. El resultado sirve como pedido operativo: contiene todo lo que guarda el contexto persistido.
 *   C. «Enviar pedido» desde venta rápida lleva a la vista de Sala (donde está el cobro); desde Sala no cambia de modo;
 *      si el envío falla, no cambia de modo.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const FUENTE = process.env.H22_FUENTE || path.join(raiz, 'fuente.js');
const src = await readFile(FUENTE, 'utf8');

let fallos = 0;
function check(nombre, ok, detalle = '') {
  if (!ok) fallos++;
  console.log(`${ok ? '[OK]  ' : '[FAIL]'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}

// Extrae `async function nombre(...) { ... }` por balanceo de llaves, saltando cadenas y plantillas.
function extraerFuncion(texto, nombre) {
  const inicio = texto.indexOf(`async function ${nombre}(`);
  if (inicio < 0) throw new Error(`No se encontró ${nombre}`);
  let i = texto.indexOf('{', texto.indexOf(')', inicio));
  let prof = 0;
  for (; i < texto.length; i++) {
    const c = texto[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      for (i++; i < texto.length && texto[i] !== q; i++) if (texto[i] === '\\') i++;
      continue;
    }
    if (c === '/' && texto[i + 1] === '/') { while (i < texto.length && texto[i] !== '\n') i++; continue; }
    if (c === '{') prof++;
    else if (c === '}') { prof--; if (prof === 0) return texto.slice(inicio, i + 1); }
  }
  throw new Error(`Llaves sin cerrar en ${nombre}`);
}

const textoEnviar = extraerFuncion(src, 'enviarPedidoA05');
const textoGuardado = extraerFuncion(src, 'enviarPedidoGuardadoA05');

// ---------- A y B: enviarPedidoA05 ----------
function contextoBase(estado = 'ABIERTO') {
  return {
    schemaVersion: 1, empresaId: 'E1', localId: 'L1',
    cuentaId: 'cuenta-1', cuentaVersion: 3,
    pedidoId: 'pedido-1', pedidoVersion: 4, pedidoEstado: estado,
    lineas: [{ lineaId: 'linea-1', lineaVersion: 2, estado: 'CONFIRMADA', productoId: 'p1', cantidad: 1, total: 1.32, opciones: [] }],
    terminalId: 'term-1', sessionId: 'ses-1', operatingDay: '2026-11-27', currencyCode: 'EUR',
    modalidad: 'BARRA', responsableActual: 'user-1', ubicacion: null, updatedAt: '2026-11-27T08:00:00.000Z'
  };
}
function construirEnviar(contexto) {
  const llamadas = [];
  const stubs = {
    localActivoId: 'L1',
    empresaDelLocalActivo: { id: 'E1' },
    window: { __nubeActiva: true, getSupabaseClient: async () => ({}) },
    leerContextoCuentaA02: () => JSON.parse(JSON.stringify(contexto)),
    guardarContextoCuentaA02: (e, l, c) => JSON.parse(JSON.stringify(c)),
    versionServidorA02: (v) => Number(v),
    rpcA02ConRecuperacion: async (_s, nombre) => { llamadas.push(nombre); return { pedido_version: 5, estado: 'ENVIADO', lineas_enviadas: 1 }; },
    respuestaErrorA06: (e) => ({ ok: false, error: String(e?.message || e) })
  };
  const nombres = Object.keys(stubs);
  const fn = new Function(...nombres, `return (${textoEnviar});`)(...nombres.map((n) => stubs[n]));
  return { fn, llamadas };
}

{
  const ctx = contextoBase('ABIERTO');
  const { fn, llamadas } = construirEnviar(ctx);
  const r = await fn();
  check('A1 enviar un pedido abierto: ok y estado ENVIADO', r.ok === true && r.pedidoEstado === 'ENVIADO' && llamadas.includes('abc_enviar_pedido'), JSON.stringify({ ok: r.ok, estado: r.pedidoEstado, llamadas }));
  check('A2 el resultado conserva la cuenta (cuentaId y su versión) — sin ella el cobro desaparece', r.cuentaId === 'cuenta-1' && r.cuentaVersion === 3, JSON.stringify({ cuentaId: r.cuentaId, cuentaVersion: r.cuentaVersion }));
  check('A3 las líneas quedan ENVIADAS y se cuentan', Array.isArray(r.lineas) && r.lineas.every((l) => l.estado === 'ENVIADA') && r.lineasEnviadas === 1, JSON.stringify({ n: r.lineasEnviadas }));
  const faltan = Object.keys(contextoBase()).filter((k) => !(k in r));
  check('B1 el resultado trae todo el contexto persistido (sirve como pedido operativo)', faltan.length === 0, 'faltan: ' + faltan.join(','));
  check('B2 conserva terminal, sesión, día operativo y modalidad', r.terminalId === 'term-1' && r.sessionId === 'ses-1' && r.operatingDay === '2026-11-27' && r.modalidad === 'BARRA');
}
{
  const ctx = contextoBase('ENVIADO');
  ctx.lineas[0].estado = 'ENVIADA';
  const { fn, llamadas } = construirEnviar(ctx);
  const r = await fn();
  check('A4 si el pedido ya estaba enviado no vuelve a llamar al servidor', r.ok === true && llamadas.length === 0, JSON.stringify(llamadas));
  check('A5 ...y también devuelve la cuenta', r.cuentaId === 'cuenta-1' && r.cuentaVersion === 3 && r.pedidoEstado === 'ENVIADO', JSON.stringify({ cuentaId: r.cuentaId }));
  const faltan = Object.keys(contextoBase()).filter((k) => !(k in r));
  check('B3 ...con el contexto completo', faltan.length === 0, 'faltan: ' + faltan.join(','));
}

// ---------- C: enviarPedidoGuardadoA05 ----------
async function ejecutarGuardado({ modoTPV, resultadoEnvio }) {
  const modos = [];
  const operativos = [];
  const stubs = {
    procesandoA05: false,
    confirmacion: { pedidoId: 'pedido-1', lineas: [] },
    enviarPedidoA05: async () => resultadoEnvio,
    gestionarConflictoA06: async () => false,
    setProcesandoA05: () => {},
    setErrorA05: () => {},
    setConflictoA06: () => {},
    setConfirmacion: () => {},
    setPedidoOperativoA05: (v) => operativos.push(v),
    setModoTPV: (m) => modos.push(m),
    modoTPV
  };
  const nombres = Object.keys(stubs);
  const fn = new Function(...nombres, `return (${textoGuardado});`)(...nombres.map((n) => stubs[n]));
  await fn();
  return { modos, operativos };
}
const envioOk = { ok: true, cuentaId: 'cuenta-1', pedidoId: 'pedido-1', pedidoVersion: 5, pedidoEstado: 'ENVIADO', lineas: [] };
{
  const r = await ejecutarGuardado({ modoTPV: 'RAPIDA', resultadoEnvio: envioOk });
  check('C1 «Enviar pedido» desde venta rápida lleva a la vista de Sala (donde está el cobro)', r.modos.length === 1 && r.modos[0] === 'SALA', JSON.stringify(r.modos));
  check('C2 ...y deja la cuenta como pedido operativo', r.operativos.length === 1 && r.operativos[0].cuentaId === 'cuenta-1');
}
{
  const r = await ejecutarGuardado({ modoTPV: 'SALA', resultadoEnvio: envioOk });
  check('C3 desde Sala no cambia de modo', r.modos.length === 0, JSON.stringify(r.modos));
}
{
  const r = await ejecutarGuardado({ modoTPV: 'RAPIDA', resultadoEnvio: { ok: false, error: 'No se pudo enviar el pedido.' } });
  check('C4 si el envío falla, no cambia de modo ni toca el pedido operativo', r.modos.length === 0 && r.operativos.length === 0);
}

console.log(fallos === 0 ? 'H22_ENVIAR_PEDIDO_CONSERVA_LA_CUENTA_CONTRACT=PASS' : `H22_ENVIAR_PEDIDO_CONSERVA_LA_CUENTA_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
