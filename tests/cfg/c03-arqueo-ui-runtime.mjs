// Ejecuta la lógica real del arqueo C03 contra un servidor en memoria.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const depsDir = process.env.CFG6E_UI_DEPS || process.env.CFG6_UI_DEPS;
if (!depsDir) {
  console.error('CFG6_UI_DEPS no está definido.');
  process.exit(2);
}
const require = createRequire(join(resolve(depsDir), 'package.json'));
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://preview.test/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
const React = require('react');

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const lineas = readFileSync(join(REPO, 'source-recovery/fuente-recuperado.js'), 'utf8').split('\n');
const ini = lineas.findIndex((l) => l.startsWith('import React'));
let fin = ini;
while (lineas[fin + 1].startsWith('import ')) fin += 1;
const iconos = lineas.slice(ini, fin + 1).find((l) => l.includes('lucide-react')).match(/\{([^}]*)\}/)[1].split(',').map((x) => x.trim().split(' as ').pop());
const stubs = { React, ReactNS: React, import_client2: { createRoot: () => ({ render() {}, unmount() {} }) }, createRoot: () => ({ render() {}, unmount() {} }), createClient: () => ({}), E: function () {}, autoTable: () => {}, XLSX: { utils: {}, writeFile() {}, writeFileSync() {} } };
const fabrica = new Function(...Object.keys(stubs), ...iconos, 'X2', lineas.slice(fin + 1).join('\n') + '\nreturn { crearLogicaCaja };');
const { crearLogicaCaja } = fabrica(...Object.values(stubs), ...iconos.map(() => () => null), () => null);

const E = 'QA-EMP-A';
const L = 'QA-A1';
const T = 'c0300000-0000-4000-8000-000000000003';
const S = 'c0300000-0000-4000-8000-000000000002';
const C = 'c0300000-0000-4000-8000-000000000001';
const U = '5003adca-2e30-477e-8afd-ffb3037b034e';
const DIA = '2026-10-09';
const CLAVE = `almacen:pm08:arqueo:${E}:${L}:${DIA}`;
const resultados = [];
const ok = (nombre, condicion, detalle) => resultados.push({ nombre, ok: !!condicion, det: condicion ? undefined : detalle });

function entorno({ dia = DIA, rpcPersonalizada = null, nube = true } = {}) {
  localStorage.clear();
  const llamadas = [];
  let arqueos = [];
  let filasArqueo = [];
  const datos = (tabla) => {
    if (tabla === 'terminales_tpv') return [{ id: T, nombre: 'TPV C03', device_key: 'c03' }];
    if (tabla === 'caja_sesion_terminales') return [{ session_id: S, terminal_id: T, desde: '2026-10-09T08:00:00Z' }];
    if (tabla === 'caja_sesiones') return [{ id: S, caja_id: C, estado: 'ABIERTA' }];
    if (tabla === 'arqueos_caja') return filasArqueo;
    return [];
  };
  const from = (tabla) => {
    const q = {
      select() { return q; }, eq() { return q; }, is() { return q; }, order() { return q; }, limit() { return q; },
      maybeSingle() { return Promise.resolve({ data: datos(tabla)[0] || null, error: null }); },
      then(resolveThen, rejectThen) { return Promise.resolve({ data: datos(tabla), error: null }).then(resolveThen, rejectThen); }
    };
    return q;
  };
  if (nube) {
    dom.window.NUBE_URL = 'https://qa.invalid';
    dom.window.__nubeActiva = true;
    dom.window.ESPERA_NUBE_MS = 200;
    dom.window.__nubeCliente = {
      auth: { async getSession() { return { data: { session: { user: { id: U } } }, error: null }; } },
      from,
      async rpc(nombre, params) {
        llamadas.push({ nombre, params });
        if (rpcPersonalizada) return rpcPersonalizada(nombre, params);
        if (nombre === 'abc_obtener_dia_operativo_local') return { data: { operating_day: dia }, error: null };
        if (nombre === 'abc_registrar_arqueo_caja') {
          const operationId = `abc.cash.count.${params.p_operation_id}`;
          const fila = {
            operation_id: operationId, empresa_id: E, local_id: L, fecha: DIA, alcance: 'DIA',
            efectivo_base: 100, efectivo_esperado: 120, efectivo_contado: params.p_efectivo_contado,
            diferencia: params.p_efectivo_contado - 120, notas: params.p_notas, estado: 'ACTIVO',
            abc_command_id: params.p_operation_id, caja_id: C, session_id: S, terminal_id: T,
            currency_code: 'EUR', operating_day: DIA, denominaciones: params.p_denominaciones,
            actor_user_id: U, created_at: '2026-10-09T10:00:00Z'
          };
          filasArqueo = [fila];
          return { data: { ok: true, replayed: false, arqueo: fila }, error: null };
        }
        return { data: [], error: null };
      }
    };
  } else {
    delete dom.window.NUBE_URL;
    delete dom.window.__nubeCliente;
    dom.window.__nubeActiva = false;
  }
  const logica = crearLogicaCaja({
    arqueos: [],
    setArqueos: (f) => { arqueos = typeof f === 'function' ? f(arqueos) : f; },
    movimientosCaja: [], setMovimientosCaja() {}, localActivoId: L, empresaId: E
  });
  return { logica, llamadas, arqueos: () => arqueos };
}

try {
  {
    const env = entorno();
    const r = await env.logica.addArqueo({ fecha: DIA, efectivoBase: 999, efectivoContado: 120, denominaciones: { 50: 2, 20: 1 }, notas: 'Exacto' });
    const llamada = env.llamadas.find((x) => x.nombre === 'abc_registrar_arqueo_caja');
    ok('A1 usa la RPC C03 y acepta el resultado calculado por el servidor', r.ok && r.arqueo.efectivoBase === 100 && r.arqueo.efectivoEsperado === 120, r);
    ok('A2 envía sesión, caja, terminal, día y denominaciones', llamada?.params.p_session_id === S && llamada.params.p_caja_id === C && llamada.params.p_terminal_id === T && llamada.params.p_operating_day === DIA && llamada.params.p_denominaciones['50'] === 2, llamada);
    ok('A3 no envía efectivo base ni esperado desde el navegador', !('p_efectivo_base' in llamada.params) && !('p_efectivo_esperado' in llamada.params), llamada);
    ok('A4 sincroniza el arqueo con su contexto ABC', env.arqueos()[0]?.sessionId === S && env.arqueos()[0]?.abcCommandId && env.arqueos()[0]?.denominaciones['20'] === 1, env.arqueos());
  }
  {
    let intentos = 0;
    let operationId = null;
    const env = entorno({ rpcPersonalizada: async (nombre, params) => {
      if (nombre === 'abc_obtener_dia_operativo_local') return { data: { operating_day: DIA }, error: null };
      if (nombre !== 'abc_registrar_arqueo_caja') return { data: [], error: null };
      intentos += 1;
      if (!operationId) operationId = params.p_operation_id;
      if (intentos === 1) return { data: null, error: { message: 'timeout_pm08' } };
      return { data: { ok: true, arqueo: { operation_id: 'abc.cash.count.retry', empresa_id: E, local_id: L, fecha: DIA, efectivo_base: 0, efectivo_esperado: 0, efectivo_contado: 0, diferencia: 0, estado: 'ACTIVO', session_id: S, abc_command_id: operationId } }, error: null };
    } });
    let r = await env.logica.addArqueo({ fecha: DIA, efectivoContado: 0, denominaciones: {}, notas: '' });
    ok('B1 el timeout conserva el borrador', !r.ok && r.pendiente && localStorage.getItem(CLAVE), r);
    r = await env.logica.addArqueo({ fecha: DIA, efectivoContado: 0, denominaciones: {}, notas: '' });
    const altas = env.llamadas.filter((x) => x.nombre === 'abc_registrar_arqueo_caja');
    ok('B2 el reintento conserva el operation_id y se marca como replay', r.ok && r.replayed && altas.length === 2 && altas.every((x) => x.params.p_operation_id === operationId) && !localStorage.getItem(CLAVE), { r, altas });
  }
  {
    const env = entorno({ dia: '2026-10-10' });
    const r = await env.logica.addArqueo({ fecha: DIA, efectivoContado: 0 });
    ok('C1 rechaza una fecha distinta del día operativo sin registrar', !r.ok && /operativo actual/.test(r.error) && !env.llamadas.some((x) => x.nombre === 'abc_registrar_arqueo_caja'), { r, llamadas: env.llamadas });
  }
} catch (error) {
  resultados.push({ nombre: 'ERROR FATAL', ok: false, det: String(error.stack || error).slice(0, 2000) });
}

const fallos = resultados.filter((r) => !r.ok);
console.log(JSON.stringify({ total: resultados.length, fallos: fallos.length, detalle: fallos }, null, 1));
if (fallos.length) process.exit(1);
console.log('c03-arqueo-ui-runtime: OK');
