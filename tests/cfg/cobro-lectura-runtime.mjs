// Prueba de ejecución de la lectura del estado del cobro del TPV (leerEstadoCobroF4), tras el arreglo del 3/10/2026.
//
// Fallo que corrige: tras cobrar en efectivo en QA, el TPV mostraba «permission denied for table pago_intentos». La lectura del estado consultaba
// la tabla pago_intentos directamente desde el navegador, pero desde la migración 20260924004000 (ACL parity) el navegador NO puede leer esa
// tabla; los intentos ya llegan dentro de abc_estado_pago_mixto_cuenta. Mientras la cuenta no tenía pagos esa consulta no se ejecutaba, por eso
// no se vio hasta el primer cobro real.
//
// Carga el módulo REAL de la aplicación (source-recovery/fuente-recuperado.js) con React 18 en un navegador simulado (jsdom) y un servidor falso
// que REPRODUCE los permisos de QA: las tablas que el navegador no puede leer (lista comprobada en QA el 3/10/2026) devuelven
// «permission denied for table X» y se anota quién las consulta.
//
// Necesita librerías que no están en el repositorio: CFG6_UI_DEPS (o CFG6E_UI_DEPS) = carpeta con node_modules que contenga
// react@18.3.1, react-dom@18.3.1 y jsdom (ver tests/cfg/cfg6e-ui-runtime.mjs).
//   CFG6_UI_DEPS=/tmp/cfg6deps node tests/cfg/cobro-lectura-runtime.mjs
// CFG_COBRO_FUENTE (opcional) permite probar otro archivo (por ejemplo la versión anterior, que debe fallar, o variantes rotas de mutantes).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { crearServidorFalso } from './lib/servidor-caja-falso.mjs';
import { SIN_ACCESO_QA } from './lib/tablas-sin-acceso-qa.mjs';

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
const origen = process.env.CFG_COBRO_FUENTE || join(REPO, 'source-recovery/fuente-recuperado.js');

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

// Tablas que el navegador (rol authenticated) NO puede leer en QA: tests/cfg/lib/tablas-sin-acceso-qa.mjs
const SIN_ACCESO = new Set(SIN_ACCESO_QA);

function consultaSobre(filas, error = null) {
  const q = {
    select() { return q; }, eq() { return q; }, in() { return q; }, is() { return q; }, order() { return q; }, limit() { return q; },
    maybeSingle() { return Promise.resolve(error ? { data: null, error } : { data: filas[0] || null, error: null }); },
    then(res, rej) { return Promise.resolve(error ? { data: null, error } : { data: filas, error: null }).then(res, rej); }
  };
  return q;
}

const CARRITO = [{ productoId: 'P1', cantidad: 2 }];
async function entorno(cobro = {}) {
  const srv = crearServidorFalso({ productos: [{ id: 'P1', precio: 1.5 }] });
  const { E, L } = srv.estado.ids;
  const c = {
    checkouts: [], pagos: [], intentos: [],
    resumen: { estado: 'PENDIENTE', total: 3, confirmado: 0, saldo: 3, reservado: 0, efectivo_recibido: 0, cambio_entregado: 0, cajas: [] },
    rpcMixtoSinIntentos: false, errorPagos: null, errorMixto: null, errorResumen: null, ...cobro
  };
  const prohibidas = [];
  const rpcLlamadas = [];
  const base = srv.cliente;
  const cliente = {
    auth: base.auth,
    from(nombre) {
      if (SIN_ACCESO.has(nombre)) { prohibidas.push(nombre); return consultaSobre([], { message: `permission denied for table ${nombre}` }); }
      if (nombre === 'checkouts') return consultaSobre(c.checkouts);
      if (nombre === 'pagos') return consultaSobre(c.pagos, c.errorPagos);
      return base.from(nombre);
    },
    async rpc(nombre, params) {
      rpcLlamadas.push({ nombre, params });
      // como el servidor real: el resumen trae estado, total, confirmado y saldo; la función de pago mixto añade lo reservado, el efectivo, las cajas, los pagos y los intentos
      if (nombre === 'abc_estado_cobro_cuenta') return c.errorResumen ? { data: null, error: { message: c.errorResumen } } : { data: { estado: c.resumen.estado, total: c.resumen.total, confirmado: c.resumen.confirmado, saldo: c.resumen.saldo }, error: null };
      if (nombre === 'abc_estado_pago_mixto_cuenta') {
        if (c.errorMixto) return { data: null, error: { message: c.errorMixto } };
        return { data: { ...c.resumen, pagos: c.pagos, ...(c.rpcMixtoSinIntentos ? {} : { intentos: c.intentos }) }, error: null };
      }
      if (nombre === 'abc_listar_incidencias_cobro') return { data: [], error: null };
      return base.rpc(nombre, params);
    }
  };
  dom.window.getSupabaseClient = async () => cliente;
  dom.window.__nubeActiva = true;
  localStorage.clear();
  const productos = [{ id: 'P1', nombre: 'Agua 50 cl', activo: true, precioVenta: 1.5, stockPisoVenta: 10, categoria: 'Bebidas', empresaId: E, localId: L, tipo: 'reventa' }];
  const logica = mod.crearLogicaVenta({ productos, setProductos() {}, movimientos: [], setMovimientos() {}, arqueos: [], localActivoId: L, empresaDelLocalActivo: { id: E } });
  const abierta = await logica.venderCarritoA02(CARRITO);   // abre una cuenta y deja guardado su contexto en el navegador
  return { srv, logica, cobro: c, prohibidas, rpcLlamadas, abierta, E, L };
}
const PAGO_EFECTIVO = { id: 'p-efe', checkout_id: 'c-1', medio: 'EFECTIVO', estado: 'CONFIRMADO', importe_objetivo: 3, importe_recibido: 3, cambio_entregado: 0, payment_currency_code: 'EUR', created_at: '2026-10-03T08:46:57Z', resolved_at: '2026-10-03T08:46:57Z' };
const INTENTO = (extra = {}) => ({ id: 'i-1', pago_id: 'p-efe', estado: 'CONFIRMADO', provider_code: null, provider_reference: null, requested_amount: 3, authorized_amount: 3, captured_amount: 3, settled_amount: null, authorization_status: 'AUTORIZADO', capture_status: 'CAPTURADO', settlement_status: 'PENDIENTE', started_at: '2026-10-03T08:46:57Z', resolved_at: '2026-10-03T08:46:57Z', ...extra });
const CHECKOUT = { id: 'c-1', estado: 'COMPLETADO', currency_code: 'EUR', version: 2, created_at: '2026-10-03T08:46:57Z', completed_at: '2026-10-03T08:46:57Z', cancelled_at: null };
const RESUMEN_PAGADO = { estado: 'PAGADA', total: 3, confirmado: 3, saldo: 0, reservado: 0.5, efectivo_recibido: 5, cambio_entregado: 2, cajas: [{ pago_id: 'p-efe', importe: 3 }] };

try {
  {
    const env = await entorno();
    ok('A0 el entorno de prueba abre una cuenta y deja su contexto', env.abierta?.ok === true, env.abierta);
    localStorage.clear();
    const r = await env.logica.leerEstadoCobroF4();
    ok('A1 sin cuenta guardada en el navegador, no hay nada que leer (y no es un error)', r.ok === true && r.disponible === false && r.estado === 'SIN_CUENTA', r);
  }
  {
    // cuenta sin pagos: antes ya funcionaba y debe seguir igual
    const env = await entorno();
    const r = await env.logica.leerEstadoCobroF4();
    ok('B1 una cuenta sin pagos se lee bien: sin pagos, sin intentos y saldo del servidor', r.ok === true && r.pagos?.length === 0 && r.intentos?.length === 0 && r.saldo === 3 && r.cobroIncierto === false, r);
    ok('B2 no consulta ninguna tabla que el navegador no puede leer', env.prohibidas.length === 0, env.prohibidas);
  }
  {
    // la situación que falló en QA: cobro en efectivo ya confirmado
    const env = await entorno({ checkouts: [CHECKOUT], pagos: [PAGO_EFECTIVO], intentos: [INTENTO()], resumen: RESUMEN_PAGADO });
    const r = await env.logica.leerEstadoCobroF4();
    ok('C1 tras un cobro en efectivo confirmado, leer el estado funciona (antes: «permission denied for table pago_intentos»)', r.ok === true, r);
    ok('C2 el estado dice lo que dice el servidor: pagada, cobrado 3 y saldo 0', r.estado === 'PAGADA' && r.total === 3 && r.confirmado === 3 && r.saldo === 0, r);
    ok('C3 el pago y el intento llegan con todos sus datos', r.pagos?.length === 1 && r.pagos?.[0].id === 'p-efe' && r.intentos?.length === 1 && r.intentos?.[0].id === 'i-1' && r.intentos?.[0].estado === 'CONFIRMADO' && r.intentos?.[0].captured_amount === 3, r);
    ok('C4 un intento confirmado no es un cobro incierto', r.cobroIncierto === false, r);
    ok('C4b el efectivo recibido, el cambio, lo reservado y las cajas salen de la función de pago mixto del servidor', r.efectivoRecibido === 5 && r.cambioEntregado === 2 && r.reservado === 0.5 && r.cajas?.length === 1, r);
    ok('C5 el navegador no consulta ninguna tabla sin permiso (en concreto, nunca pago_intentos)', env.prohibidas.length === 0 && !env.prohibidas.includes('pago_intentos'), env.prohibidas);
    ok('C6 los intentos se piden al servidor con abc_estado_pago_mixto_cuenta y los parámetros exactos', env.rpcLlamadas.filter((c) => c.nombre === 'abc_estado_pago_mixto_cuenta').some((c) => Object.keys(c.params).join() === 'p_empresa_id,p_local_id,p_cuenta_id' && c.params.p_empresa_id === env.E && c.params.p_local_id === env.L), env.rpcLlamadas);
    ok('C7 los cobros y pagos se siguen leyendo con las tablas permitidas (no se pierde el detalle)', r.checkouts?.length === 1 && r.checkouts?.[0].id === 'c-1', r);
  }
  {
    // tarjeta pendiente: es un cobro incierto y la pantalla tiene que enterarse
    const pago = { ...PAGO_EFECTIVO, id: 'p-tar', medio: 'TARJETA', estado: 'PENDIENTE', importe_recibido: null, resolved_at: null };
    const env = await entorno({ checkouts: [{ ...CHECKOUT, estado: 'ABIERTO', completed_at: null }], pagos: [pago], intentos: [INTENTO({ id: 'i-t', pago_id: 'p-tar', estado: 'PENDIENTE', captured_amount: null, resolved_at: null })], resumen: { ...RESUMEN_PAGADO, estado: 'PENDIENTE', confirmado: 0, saldo: 3, reservado: 3 } });
    const r = await env.logica.leerEstadoCobroF4();
    ok('D1 un intento pendiente de tarjeta se ve como cobro incierto', r.ok === true && r.intentos?.length === 1 && r.intentos?.[0].estado === 'PENDIENTE' && r.cobroIncierto === true, r);
  }
  {
    // cada estado dudoso cuenta como incierto y los resueltos no
    for (const [estado, incierto] of [['PENDIENTE', true], ['AUTORIZADO', true], ['DESCONOCIDO', true], ['CONFIRMADO', false], ['RECHAZADO', false], ['CANCELADO', false]]) {
      const env = await entorno({ checkouts: [CHECKOUT], pagos: [PAGO_EFECTIVO], intentos: [INTENTO({ estado })], resumen: RESUMEN_PAGADO });
      const r = await env.logica.leerEstadoCobroF4();
      ok(`D2 intento ${estado}: cobro incierto = ${incierto}`, r.ok === true && r.cobroIncierto === incierto, r);
    }
  }
  {
    // varios intentos: se conservan todos y en el orden del servidor
    const env = await entorno({ checkouts: [CHECKOUT], pagos: [PAGO_EFECTIVO], intentos: [INTENTO({ id: 'i-2', estado: 'CONFIRMADO' }), INTENTO({ id: 'i-1', estado: 'RECHAZADO' })], resumen: RESUMEN_PAGADO });
    const r = await env.logica.leerEstadoCobroF4();
    ok('E1 varios intentos llegan todos y en el orden que da el servidor', r.ok === true && r.intentos?.map((i) => i.id).join() === 'i-2,i-1', r);
  }
  {
    // servidor sin la lista de intentos (versión anterior): no se rompe
    const env = await entorno({ checkouts: [CHECKOUT], pagos: [PAGO_EFECTIVO], intentos: [INTENTO()], resumen: RESUMEN_PAGADO, rpcMixtoSinIntentos: true });
    const r = await env.logica.leerEstadoCobroF4();
    ok('F1 si el servidor no manda la lista de intentos, el estado se lee igual, con la lista vacía', r.ok === true && Array.isArray(r.intentos) && r.intentos?.length === 0 && r.cobroIncierto === false && env.prohibidas.length === 0, { r, prohibidas: env.prohibidas });
  }
  {
    // errores reales se siguen explicando
    let env = await entorno({ errorMixto: 'estado_cobro_no_autorizado' });
    let r = await env.logica.leerEstadoCobroF4();
    ok('G1 si el servidor rechaza la lectura del estado, se devuelve un error y no un estado a medias', r.ok === false && typeof r.error === 'string' && r.error.length > 0 && r.pagos === undefined, r);
    env = await entorno({ checkouts: [CHECKOUT], errorPagos: { message: 'fallo_de_red' } });
    r = await env.logica.leerEstadoCobroF4();
    ok('G2 si falla la lectura de los pagos, se devuelve un error', r.ok === false && typeof r.error === 'string' && r.error.length > 0, r);
    env = await entorno({ errorResumen: 'estado_cobro_no_autorizado' });
    r = await env.logica.leerEstadoCobroF4();
    ok('G3 si falla el resumen del cobro, se devuelve un error', r.ok === false && typeof r.error === 'string' && r.error.length > 0, r);
  }
  {
    // sin conexión
    const env = await entorno();
    dom.window.__nubeActiva = false;
    const r = await env.logica.leerEstadoCobroF4();
    ok('H1 sin conexión con el servidor, lo dice y no consulta nada', r.ok === false && /conexión/.test(r.error) && env.prohibidas.length === 0, r);
    dom.window.__nubeActiva = true;
  }
} catch (e) {
  resultados.push({ nombre: 'ERROR FATAL', ok: false, det: String(e.stack || e).slice(0, 1500) });
}
const fallos = resultados.filter((r) => !r.ok);
console.log(JSON.stringify({ total: resultados.length, fallos: fallos.length, detalle: fallos }, null, 1).slice(0, 9000));
if (fallos.length) process.exit(1);
console.log('cobro-lectura-runtime: OK');
