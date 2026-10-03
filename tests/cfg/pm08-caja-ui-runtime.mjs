// Prueba de ejecución del registro de movimientos manuales de caja (PM-08: entradas y retiradas), tras el arreglo del 3/10/2026.
//
// Fallo que corrige: después de guardar el movimiento, la línea que anota la auditoría llamaba a una función `money()` que no existe en la aplicación.
// En el navegador eso es «ReferenceError: money is not defined»: con la cuenta sincronizada (la nube) caía en el `catch` y la pantalla decía «No se
// pudo confirmar si el servidor recibió el movimiento. Reintenta…» AUNQUE el movimiento ya estaba guardado en el servidor (falso aviso; el reintento es
// idempotente, pero el usuario no lo sabe); en modo local el error se propagaba sin control. Ahora la anotación usa `fmt()`, el formateador de importes
// que ya usa el resto del módulo («ENTRADA de €12,50 · Cambio inicial»).
//
// Carga el módulo REAL de la aplicación (source-recovery/fuente-recuperado.js) con React 18 en un navegador simulado (jsdom) y ejecuta la lógica real
// (crearLogicaMovimientosCaja: registrarMovimientoCaja) contra un servidor falso, en la rama de la nube y en la local.
//
// Necesita librerías que no están en el repositorio: CFG6_UI_DEPS (o CFG6E_UI_DEPS) = carpeta con node_modules que contenga
// react@18.3.1, react-dom@18.3.1 y jsdom (ver tests/cfg/cfg6e-ui-runtime.mjs).
//   CFG6_UI_DEPS=/tmp/cfg6deps node tests/cfg/pm08-caja-ui-runtime.mjs
// CFG_PM08CAJA_FUENTE (opcional) permite probar otro archivo (la versión anterior, que debe fallar, o variantes rotas de mutantes).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const depsDir = process.env.CFG6E_UI_DEPS || process.env.CFG6_UI_DEPS;
if (!depsDir) {
  console.error('CFG6_UI_DEPS no está definido: indica una carpeta con node_modules (react@18.3.1, react-dom@18.3.1 y jsdom).');
  process.exit(2);
}
const require = createRequire(join(resolve(depsDir), 'package.json'));
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="raiz"></div></body></html>', { url: 'https://preview.test/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.matchMedia = dom.window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
const React = require('react');

const REPO = resolve(new URL('../../', import.meta.url).pathname);
const origen = process.env.CFG_PM08CAJA_FUENTE || join(REPO, 'source-recovery/fuente-recuperado.js');

// ---------- carga del módulo real ----------
const lineas = readFileSync(origen, 'utf8').split('\n');
const ini = lineas.findIndex((l) => l.startsWith('import React'));
let fin = ini;
while (lineas[fin + 1].startsWith('import ')) fin += 1;
const iconos = lineas.slice(ini, fin + 1).find((l) => l.includes('lucide-react')).match(/\{([^}]*)\}/)[1].split(',').map((x) => x.trim().split(' as ').pop());
const stubs = { React, ReactNS: React, import_client2: { createRoot: () => ({ render() {}, unmount() {} }) }, createRoot: () => ({ render() {}, unmount() {} }), createClient: () => ({}), E: function () {}, autoTable: () => {}, XLSX: { utils: {}, writeFile() {}, writeFileSync() {} } };
const fabrica = new Function(...Object.keys(stubs), ...iconos, 'X2', lineas.slice(fin + 1).join('\n') + '\nreturn { crearLogicaMovimientosCaja };');
const mod = fabrica(...Object.values(stubs), ...iconos.map(() => () => null), () => null);

// ---------- utilidades ----------
const resultados = [];
const ok = (nombre, cond, det) => resultados.push({ nombre, ok: !!cond, det: cond ? undefined : det });

const E = 'QA-EMP-A';
const L = 'QA-A1';
const CLAVE = `almacen:pm08:movimiento-caja:${E}:${L}`;
const FILA = (p) => ({ operation_id: p.p_operation_id, empresa_id: p.p_empresa_id, local_id: p.p_local_id, fecha: p.p_fecha, tipo: p.p_tipo, importe: p.p_importe, efecto_efectivo: p.p_tipo === 'ENTRADA' ? p.p_importe : -p.p_importe, medio_pago: 'EFECTIVO', concepto: p.p_concepto, origen_tipo: 'MANUAL', actor_user_id: 'u1', created_at: '2026-10-03T10:00:00+00:00' });

// nube = true: cuenta sincronizada (hay NUBE_URL y conexión); nube = false: modo local
function entorno({ nube = true, rpc = null, auditoriaFalla = false } = {}) {
  localStorage.clear();
  const llamadas = [];
  const auditoria = [];
  let movimientos = [];
  if (nube) {
    dom.window.NUBE_URL = 'https://qa.invalid';
    dom.window.__nubeActiva = true;
    dom.window.ESPERA_NUBE_MS = 200;
    dom.window.__nubeCliente = {
      async rpc(nombre, params) {
        llamadas.push({ nombre, params });
        if (rpc) return rpc(nombre, params);
        return { data: { movimiento: FILA(params), replayed: false }, error: null };
      }
    };
  } else {
    delete dom.window.NUBE_URL;
    delete dom.window.__nubeCliente;
    dom.window.__nubeActiva = false;
  }
  const logica = mod.crearLogicaMovimientosCaja({
    movimientosCaja: [], setMovimientosCaja: (f) => { movimientos = typeof f === 'function' ? f(movimientos) : f; },
    arqueos: [], setArqueos() {},
    registrarAuditoria: (accion, detalle) => { if (auditoriaFalla) throw new Error('auditoria_rota'); auditoria.push({ accion, detalle }); },
    localActivoId: L, empresaId: E
  });
  return { logica, llamadas, auditoria, movimientos: () => movimientos };
}
const esTexto = (r) => r.ok === false && typeof r.error === 'string' && r.error.length > 0;

try {
  {
    // nube: el servidor guarda el movimiento
    const env = entorno();
    const r = await env.logica.registrarMovimientoCaja('ENTRADA', 12.5, 'Cambio inicial', '2026-10-03');
    ok('A1 en la nube, guardar una entrada devuelve ok:true (antes: falso aviso «No se pudo confirmar si el servidor recibió el movimiento»)', r.ok === true && !r.pendiente && r.replayed === false, r);
    ok('A2 la llamada al servidor lleva los parámetros exactos, una sola vez', env.llamadas.length === 1 && env.llamadas[0].nombre === 'registrar_movimiento_caja'
      && Object.keys(env.llamadas[0].params).join() === 'p_operation_id,p_empresa_id,p_local_id,p_fecha,p_tipo,p_importe,p_concepto,p_datos'
      && env.llamadas[0].params.p_tipo === 'ENTRADA' && env.llamadas[0].params.p_importe === 12.5 && env.llamadas[0].params.p_empresa_id === E && env.llamadas[0].params.p_local_id === L, env.llamadas);
    ok('A3 el movimiento queda en la lista y el borrador del dispositivo se limpia', env.movimientos().length === 1 && env.movimientos()[0].importe === 12.5 && localStorage.getItem(CLAVE) === null, { m: env.movimientos(), b: localStorage.getItem(CLAVE) });
    ok('A4 la auditoría se anota una vez, con el importe en euros formateado', env.auditoria.length === 1 && env.auditoria[0].accion === 'MOVIMIENTO_CAJA' && env.auditoria[0].detalle === 'ENTRADA de €12,50 \xB7 Cambio inicial', env.auditoria);
  }
  {
    const env = entorno();
    const r = await env.logica.registrarMovimientoCaja('SALIDA', 0.05, '', '2026-10-03');
    ok('B1 una «salida» se guarda como RETIRADA, con el concepto por defecto y los céntimos bien escritos', r.ok === true && env.llamadas[0].params.p_tipo === 'RETIRADA'
      && env.auditoria.length === 1 && env.auditoria[0].detalle === 'RETIRADA de €0,05 \xB7 Retirada manual', { r, a: env.auditoria });
  }
  {
    // la auditoría escribe el importe que realmente se envía (ya redondeado a céntimos), no el que se tecleó
    const env = entorno();
    const r = await env.logica.registrarMovimientoCaja('ENTRADA', 2.135, 'Redondeo', '2026-10-03');
    ok('B2 el importe de la auditoría es el que se envía al servidor (2,135 se envía como 2,13 y se anota «€2,13»; escribir el importe tecleado daría «€2,14»)', r.ok === true && env.llamadas[0].params.p_importe === 2.13
      && env.auditoria[0].detalle === 'ENTRADA de \u20AC2,13 \xB7 Redondeo', { r, l: env.llamadas, a: env.auditoria });
  }
  {
    // nube: el servidor ya tenía ese movimiento (reintento): no se anota otra vez
    const env = entorno({ rpc: async (n, p) => ({ data: { movimiento: FILA(p), replayed: true }, error: null }) });
    const r = await env.logica.registrarMovimientoCaja('ENTRADA', 20, 'Reintento', '2026-10-03');
    ok('C1 un reintento ya registrado devuelve ok:true con replayed:true y no repite la auditoría', r.ok === true && r.replayed === true && env.auditoria.length === 0, { r, a: env.auditoria });
  }
  {
    // nube: errores del servidor (siguen tratándose como antes)
    let env = entorno({ rpc: async () => ({ data: null, error: { message: 'timeout_pm08' } }) });
    let r = await env.logica.registrarMovimientoCaja('ENTRADA', 5, 'x', '2026-10-03');
    ok('D1 un fallo transitorio del servidor sigue dando «No se pudo confirmar…», conserva el borrador y no anota auditoría', r.ok === false && r.pendiente === true && /No se pudo confirmar/.test(r.error) && localStorage.getItem(CLAVE) !== null && env.auditoria.length === 0, { r, b: localStorage.getItem(CLAVE) });
    env = entorno({ rpc: async () => ({ data: null, error: { message: 'movimiento_caja_no_autorizado' } }) });
    r = await env.logica.registrarMovimientoCaja('ENTRADA', 5, 'x', '2026-10-03');
    ok('D2 un rechazo del servidor devuelve el error como texto, limpia el borrador y no anota auditoría', esTexto(r) && localStorage.getItem(CLAVE) === null && env.auditoria.length === 0, { r, b: localStorage.getItem(CLAVE) });
    env = entorno({ rpc: async () => { throw new Error('red_caida'); } });
    r = await env.logica.registrarMovimientoCaja('ENTRADA', 5, 'x', '2026-10-03');
    ok('D3 una caída de la conexión da «No se pudo confirmar…» y conserva el borrador', r.ok === false && r.pendiente === true && localStorage.getItem(CLAVE) !== null, { r });
  }
  {
    // modo local (sin cuenta sincronizada)
    const env = entorno({ nube: false });
    let r;
    let lanzo = null;
    try { r = await env.logica.registrarMovimientoCaja('RETIRADA', 7, 'Pago proveedor', '2026-10-03'); } catch (e) { lanzo = String(e && e.message || e); }
    ok('E1 en modo local, guardar una retirada no lanza error (antes: «money is not defined»)', lanzo === null && r && r.ok === true && r.local === true, { lanzo, r });
    ok('E2 en modo local el movimiento queda con efecto negativo en efectivo, el borrador se limpia y se anota la auditoría', env.movimientos().length === 1 && env.movimientos()[0].efectoEfectivo === -7 && env.movimientos()[0].tipo === 'RETIRADA'
      && localStorage.getItem(CLAVE) === null && env.auditoria.length === 1 && env.auditoria[0].detalle === 'RETIRADA de €7,00 \xB7 Pago proveedor', { m: env.movimientos(), a: env.auditoria });
  }
  {
    // validaciones previas (no cambian)
    const env = entorno();
    ok('F1 importe cero o negativo: se rechaza con texto y no llama al servidor', esTexto(await env.logica.registrarMovimientoCaja('ENTRADA', 0, 'x', '2026-10-03')) && esTexto(await env.logica.registrarMovimientoCaja('ENTRADA', -3, 'x', '2026-10-03')) && env.llamadas.length === 0, env.llamadas);
    ok('F2 tipo no válido: se rechaza con texto y no llama al servidor', esTexto(await env.logica.registrarMovimientoCaja('OTRO', 5, 'x', '2026-10-03')) && env.llamadas.length === 0, env.llamadas);
  }
} catch (e) {
  resultados.push({ nombre: 'ERROR FATAL', ok: false, det: String(e.stack || e).slice(0, 1500) });
}
const fallos = resultados.filter((r) => !r.ok);
console.log(JSON.stringify({ total: resultados.length, fallos: fallos.length, detalle: fallos }, null, 1).slice(0, 9000));
if (fallos.length) process.exit(1);
console.log('pm08-caja-ui-runtime: OK');
