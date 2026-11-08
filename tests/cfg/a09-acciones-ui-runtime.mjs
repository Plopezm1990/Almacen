// Prueba de ejecución de «aplicar descuento» y «aprobar o rechazar una autorización» del TPV (A09), tras el arreglo del 3/10/2026.
//
// Fallo que corrige: estas dos funciones devolvían el error como un OBJETO ({ ok:false, error: { ok:false, error:"texto", conflict… } }) y la pantalla
// guarda ese valor y lo dibuja tal cual; dibujar un objeto en React lanza «Objects are not valid as a React child» y rompe la pantalla. Por ejemplo, un
// perfil sin permiso para aplicar un descuento veía la pantalla rota en lugar de «Tu perfil no tiene permiso…».
//
// Carga el módulo REAL de la aplicación (source-recovery/fuente-recuperado.js) con React 18 en un navegador simulado (jsdom) y ejecuta la lógica real
// (crearLogicaVenta: aplicarDescuentoCuentaA09 y resolverAutorizacionDescuentoA09) contra un servidor falso.
//
// Necesita librerías que no están en el repositorio: CFG6_UI_DEPS (o CFG6E_UI_DEPS) = carpeta con node_modules que contenga
// react@18.3.1, react-dom@18.3.1 y jsdom (ver tests/cfg/cfg6e-ui-runtime.mjs).
//   CFG6_UI_DEPS=/tmp/cfg6deps node tests/cfg/a09-acciones-ui-runtime.mjs
// CFG_A09AC_FUENTE (opcional) permite probar otro archivo (la versión anterior, que debe fallar, o variantes rotas de mutantes).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { crearServidorFalso } from './lib/servidor-caja-falso.mjs';

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
const origen = process.env.CFG_A09AC_FUENTE || join(REPO, 'source-recovery/fuente-recuperado.js');

// ---------- carga del módulo real ----------
const lineas = readFileSync(origen, 'utf8').split('\n');
const ini = lineas.findIndex((l) => l.startsWith('import React'));
let fin = ini;
while (lineas[fin + 1].startsWith('import ')) fin += 1;
const iconos = lineas.slice(ini, fin + 1).find((l) => l.includes('lucide-react')).match(/\{([^}]*)\}/)[1].split(',').map((x) => x.trim().split(' as ').pop());
const stubs = { React, ReactNS: React, import_client2: { createRoot: () => ({ render() {}, unmount() {} }) }, createRoot: () => ({ render() {}, unmount() {} }), createClient: () => ({}), E: function () {}, autoTable: () => {}, XLSX: { utils: {}, writeFile() {}, writeFileSync() {} } };
const fabrica = new Function(...Object.keys(stubs), ...iconos, 'X2', lineas.slice(fin + 1).join('\n') + '\nreturn { crearLogicaVenta };');
const mod = fabrica(...Object.values(stubs), ...iconos.map(() => () => null), () => null);

// ---------- utilidades ----------
const resultados = [];
const ok = (nombre, cond, det) => resultados.push({ nombre, ok: !!cond, det: cond ? undefined : det });

const CARRITO = [{ productoId: 'P1', cantidad: 2 }];
const HASH = 'a'.repeat(64);
async function entorno(rpcs = {}) {
  const srv = crearServidorFalso({ productos: [{ id: 'P1', precio: 1.5 }] });
  const { E, L } = srv.estado.ids;
  const llamadas = [];
  const base = srv.cliente;
  const cliente = {
    auth: base.auth,
    from: (n) => base.from(n),
    async rpc(nombre, params) {
      llamadas.push({ nombre, params });
      if (rpcs[nombre]) return rpcs[nombre](params);
      return base.rpc(nombre, params);
    }
  };
  dom.window.getSupabaseClient = async () => cliente;
  dom.window.__nubeActiva = true;
  localStorage.clear();
  const productos = [{ id: 'P1', nombre: 'Agua 50 cl', activo: true, precioVenta: 1.5, stockPisoVenta: 10, categoria: 'Bebidas', empresaId: E, localId: L, tipo: 'reventa' }];
  const logica = mod.crearLogicaVenta({ productos, setProductos() {}, movimientos: [], setMovimientos() {}, arqueos: [], localActivoId: L, empresaDelLocalActivo: { id: E } });
  const abierta = await logica.venderCarritoA02(CARRITO);
  const ctx = JSON.parse(localStorage.getItem(`la_suite_a02_1_ultima_cuenta_v1:${E}:${L}`) || 'null');
  return { srv, logica, llamadas, abierta, ctx, E, L };
}
const SOLICITUD = (env, extra = {}) => ({ tipo: 'PERCENT', valor: '10', motivo: 'cliente habitual', solicitud: { operationId: 'a09.1.7.descuento:' + 'b'.repeat(64), cuentaId: env.ctx.cuentaId, tipo: 'PERCENT', valor: '10', motivo: 'cliente habitual', expectedCuentaVersion: 1, terminalId: env.srv.estado.ids.T, sessionId: env.srv.estado.ids.S, operatingDay: '2026-10-03', ...extra } });
const esTexto = (r) => r.ok === false && typeof r.error === 'string' && r.error.length > 0;

try {
  {
    const env = await entorno({ abc_aplicar_descuento_cuenta: async () => ({ data: null, error: { message: 'descuento_aplicar_no_autorizado' } }) });
    ok('A0 el entorno abre una cuenta y deja su contexto', env.abierta?.ok === true && !!env.ctx?.cuentaId, env.abierta);
    const r = await env.logica.aplicarDescuentoCuentaA09(SOLICITUD(env));
    ok('A1 sin permiso para aplicar el descuento: el error es el TEXTO en español (antes: un objeto que rompía la pantalla)', esTexto(r) && r.error === 'Tu perfil no tiene permiso para solicitar o aplicar este descuento.', r);
    const c = env.llamadas.filter((x) => x.nombre === 'abc_aplicar_descuento_cuenta');
    ok('A2 la llamada al servidor lleva los parámetros exactos', c.length === 1 && Object.keys(c[0].params).join() === 'p_operation_id,p_empresa_id,p_local_id,p_cuenta_id,p_tipo,p_valor,p_motivo,p_expected_cuenta_version,p_terminal_id,p_session_id,p_operating_day'
      && c[0].params.p_tipo === 'PERCENT' && c[0].params.p_valor === '10' && c[0].params.p_cuenta_id === env.ctx.cuentaId, c);
  }
  {
    // el servidor contesta con un código de error dentro de los datos
    const env = await entorno({ abc_aplicar_descuento_cuenta: async () => ({ data: { ok: false, error: 'descuento_cortesia_requerida' }, error: null }) });
    const r = await env.logica.aplicarDescuentoCuentaA09(SOLICITUD(env));
    ok('B1 un código de error dentro de la respuesta se traduce y se devuelve como texto', esTexto(r) && r.error === 'Para dejar el importe al 100 % debes usar la opción Cortesía.' && r.resultado?.error === 'descuento_cortesia_requerida', r);
  }
  {
    // error cualquiera: texto, y el aviso de conflicto de versión se conserva fuera del texto
    const env = await entorno({ abc_aplicar_descuento_cuenta: async () => ({ data: null, error: { message: 'fallo_de_red_inesperado' } }) });
    const r = await env.logica.aplicarDescuentoCuentaA09(SOLICITUD(env));
    ok('C1 un error cualquiera del servidor se devuelve como texto', esTexto(r) && r.conflict === false, r);
    const env2 = await entorno({ abc_aplicar_descuento_cuenta: async () => ({ data: null, error: { message: 'cuenta_version_conflict' } }) });
    const r2 = await env2.logica.aplicarDescuentoCuentaA09(SOLICITUD(env2));
    ok('C2 un conflicto de versión sigue marcándose (conflict: true) y el error sigue siendo un texto', esTexto(r2) && r2.conflict === true, r2);
  }
  {
    // lo que ya funcionaba sigue igual
    const env = await entorno({ abc_aplicar_descuento_cuenta: async () => ({ data: { ok: true, status: 'APLICADA', descuento: 0.3 }, error: null }) });
    const r = await env.logica.aplicarDescuentoCuentaA09(SOLICITUD(env));
    ok('D1 un descuento aplicado devuelve ok:true y applied:true', r.ok === true && r.applied === true && r.resultado?.status === 'APLICADA', r);
    const env2 = await entorno({ abc_aplicar_descuento_cuenta: async () => ({ data: { ok: true, status: 'PENDIENTE_AUTORIZACION', snapshot: { operation: {} }, approval_hash: HASH }, error: null }) });
    const r2 = await env2.logica.aplicarDescuentoCuentaA09(SOLICITUD(env2));
    ok('D2 una solicitud pendiente de autorización devuelve ok:true y pending:true', r2.ok === true && r2.pending === true, r2);
    const env3 = await entorno();
    const r3 = await env3.logica.aplicarDescuentoCuentaA09({ tipo: 'PERCENT', valor: '150', motivo: 'x' });
    ok('D3 un porcentaje de más de 100 se rechaza antes de llamar al servidor, con texto', esTexto(r3) && env3.llamadas.filter((x) => x.nombre === 'abc_aplicar_descuento_cuenta').length === 0, r3);
  }
  {
    // aprobar o rechazar una autorización
    const solicitud = { operation_id: 'a09.1.7.descuento:' + 'b'.repeat(64), snapshot_hash: HASH };
    let env = await entorno({ abc_aprobar_descuento_cuenta: async () => ({ data: null, error: { message: 'descuento_no_autorizado' } }) });
    let r = await env.logica.resolverAutorizacionDescuentoA09(solicitud, 'APROBAR', 'visto bueno');
    ok('E1 sin permiso para autorizar: el error es el TEXTO en español (antes: un objeto)', esTexto(r) && r.error === 'Tu perfil no tiene permiso para solicitar o aplicar este descuento.', r);
    const c = env.llamadas.filter((x) => x.nombre === 'abc_aprobar_descuento_cuenta');
    ok('E2 la llamada al servidor lleva los parámetros exactos', c.length === 1 && Object.keys(c[0].params).join() === 'p_operation_id,p_empresa_id,p_local_id,p_snapshot_hash,p_attempt_id,p_decision,p_motivo' && c[0].params.p_decision === 'APROBAR' && c[0].params.p_snapshot_hash === HASH, c);
    env = await entorno({ abc_aprobar_descuento_cuenta: async () => ({ data: { error: 'descuento_cortesia_requerida' }, error: null }) });
    r = await env.logica.resolverAutorizacionDescuentoA09(solicitud, 'APROBAR', 'visto bueno');
    ok('E3 un código de error dentro de la respuesta se devuelve como texto', esTexto(r) && r.error === 'Para dejar el importe al 100 % debes usar la opción Cortesía.', r);
    env = await entorno({ abc_aprobar_descuento_cuenta: async () => ({ data: null, error: { message: 'fallo_de_red_inesperado' } }) });
    r = await env.logica.resolverAutorizacionDescuentoA09(solicitud, 'RECHAZAR', 'no procede');
    ok('E4 un error cualquiera del servidor se devuelve como texto', esTexto(r), r);
    env = await entorno({ abc_aprobar_descuento_cuenta: async () => ({ data: { status: 'APROBADA' }, error: null }) });
    r = await env.logica.resolverAutorizacionDescuentoA09(solicitud, 'APROBAR', 'visto bueno');
    ok('E5 aprobar bien devuelve ok:true y el estado de siempre', r.ok === true && r.estado === 'APROBADA', r);
    r = await env.logica.resolverAutorizacionDescuentoA09(solicitud, 'APROBAR', '');
    ok('E6 sin motivo se rechaza antes de llamar al servidor, con texto', esTexto(r), r);
  }
} catch (e) {
  resultados.push({ nombre: 'ERROR FATAL', ok: false, det: String(e.stack || e).slice(0, 1500) });
}
const fallos = resultados.filter((r) => !r.ok);
console.log(JSON.stringify({ total: resultados.length, fallos: fallos.length, detalle: fallos }, null, 1).slice(0, 9000));
if (fallos.length) process.exit(1);
console.log('a09-acciones-ui-runtime: OK');
