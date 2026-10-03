// Prueba de ejecución del panel «Descuento / cortesía» del TPV (A09) montado de verdad: se abre la cuenta, se monta la pantalla real del TPV
// (VentaRapida) y se pulsa «Abrir» en la tarjeta de descuentos.
//
// Fallo que corrige (3/10/2026, descubierto con Cowork en el preview): al pulsar «Abrir», «Actualizando…» y «Cargando autorizaciones…» se quedaban fijos
// y no salía ningún dato. Causa: cinco cargadores del panel viven dentro de VentaRapida pero usaban dos ayudas (leerContextoCuentaA02 y
// respuestaErrorA06) que solo existen dentro de crearLogicaVenta; en el navegador daban «ReferenceError: … is not defined», el error escapaba y la
// carga del panel quedaba colgada. Ahora la lógica las entrega y la aplicación se las pasa al TPV.
// Esta prueba monta la pantalla con su alcance REAL (a diferencia de extraer las funciones sueltas, que ocultó el fallo).
//
// Necesita librerías que no están en el repositorio: CFG6_UI_DEPS (o CFG6E_UI_DEPS) = carpeta con node_modules que contenga
// react@18.3.1, react-dom@18.3.1 y jsdom (ver tests/cfg/cfg6e-ui-runtime.mjs).
//   CFG6_UI_DEPS=/tmp/cfg6deps node tests/cfg/a09-panel-ui-runtime.mjs
// CFG_A09PN_FUENTE (opcional) permite probar otro archivo (la versión anterior, que debe fallar, o variantes rotas de mutantes).
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
const { createRoot } = require('react-dom/client');
const act = React.act;

const REPO = resolve(new URL('../../', import.meta.url).pathname);
const origen = process.env.CFG_A09PN_FUENTE || join(REPO, 'source-recovery/fuente-recuperado.js');

// ---------- carga del módulo real ----------
const lineas = readFileSync(origen, 'utf8').split('\n');
const ini = lineas.findIndex((l) => l.startsWith('import React'));
let fin = ini;
while (lineas[fin + 1].startsWith('import ')) fin += 1;
const iconos = lineas.slice(ini, fin + 1).find((l) => l.includes('lucide-react')).match(/\{([^}]*)\}/)[1].split(',').map((x) => x.trim().split(' as ').pop());
const stubs = { React, ReactNS: React, import_client2: { createRoot: () => ({ render() {}, unmount() {} }) }, createRoot: () => ({ render() {}, unmount() {} }), createClient: () => ({}), E: function () {}, autoTable: () => {}, XLSX: { utils: {}, writeFile() {}, writeFileSync() {} } };
const fabrica = new Function(...Object.keys(stubs), ...iconos, 'X2', lineas.slice(fin + 1).join('\n') + '\nreturn { crearLogicaVenta, VentaRapida };');
const mod = fabrica(...Object.values(stubs), ...iconos.map(() => () => null), () => null);

// ---------- utilidades ----------
const resultados = [];
const ok = (nombre, cond, det) => resultados.push({ nombre, ok: !!cond, det: cond ? undefined : det });
// un rechazo que nadie recoge es justo lo que dejaba la carga del panel colgada en el navegador: cuenta como fallo
process.on('unhandledRejection', (e) => { resultados.push({ nombre: 'RECHAZO NO CONTROLADO (la carga del panel se queda colgada)', ok: false, det: String((e && e.stack) || e).slice(0, 400) }); });
const esperar = async (ms = 0) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };
const texto = () => document.getElementById('raiz').textContent;
async function clic(el) {
  if (!el) throw new Error('clic sobre un elemento que no existe; texto actual: ' + texto().slice(-600));
  await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  await esperar(150);
}

function consultaSobre(filas, error = null) {
  const q = {
    select() { return q; }, eq() { return q; }, in() { return q; }, is() { return q; }, order() { return q; }, limit() { return q; },
    maybeSingle() { return Promise.resolve(error ? { data: null, error } : { data: filas[0] || null, error: null }); },
    then(res, rej) { return Promise.resolve(error ? { data: null, error } : { data: filas, error: null }).then(res, rej); }
  };
  return q;
}
const SIN_ACCESO = new Set(SIN_ACCESO_QA);
const CARRITO = [{ productoId: 'P1', cantidad: 2 }];
let raiz = null;
async function entorno(op = {}) {
  const srv = crearServidorFalso({ productos: [{ id: 'P1', precio: 1.5 }] });
  const { E, L } = srv.estado.ids;
  const base = srv.cliente;
  const prohibidas = [];
  const llamadas = [];
  const datos = {
    autorizaciones: [], intentos: [], descuentos: [], checkouts: [{ id: 'c-1', estado: 'COMPLETADO', currency_code: 'EUR', operating_day: '2026-10-03', created_at: '2026-10-03T08:46:57Z', completed_at: '2026-10-03T08:46:57Z' }],
    pagos: [{ id: 'p-efe', checkout_id: 'c-1', medio: 'EFECTIVO', estado: 'CONFIRMADO', importe_objetivo: 3, importe_recibido: 3, cambio_entregado: 0, payment_currency_code: 'EUR', created_at: '2026-10-03T08:46:57Z', resolved_at: '2026-10-03T08:46:57Z' }],
    caja: [{ operation_id: 'abc.cash.1', origen_id: 'p-efe', tipo: 'ENTRADA', importe: 3, efecto_efectivo: 3, medio_pago: 'EFECTIVO', concepto: 'Cobro', fecha: '2026-10-03', currency_code: 'EUR', operating_day: '2026-10-03', abc_command_id: null, created_at: '2026-10-03T08:46:57Z' }],
    eventos: [{ operation_id: 'f3.a09.disc.1', event_type: 'CUENTA_DESCUENTO_APLICADO', payload: { tipo: 'PERCENT', valor: 10, importe: 0.3, motivo: 'cliente habitual' }, actor_user_id: '16c79749-a206-47d9-8d56-fbc7a4a49eb7', occurred_at: '2026-10-03T10:00:00+00:00', operating_day: '2026-10-03' }],
    errorEventos: null, errorDescuentos: null, ...op
  };
  const cliente = {
    auth: base.auth,
    from(nombre) {
      if (SIN_ACCESO.has(nombre)) { prohibidas.push(nombre); return consultaSobre([], { message: `permission denied for table ${nombre}` }); }
      switch (nombre) {
        case 'abc_descuento_autorizaciones': return consultaSobre(datos.autorizaciones);
        case 'abc_descuento_aprobacion_intentos': return consultaSobre(datos.intentos);
        case 'abc_descuentos_aplicados': return consultaSobre(datos.descuentos, datos.errorDescuentos);
        case 'checkouts': return consultaSobre(datos.checkouts);
        case 'pagos': return consultaSobre(datos.pagos);
        case 'caja_operaciones': return consultaSobre(datos.caja.map((c) => ({ ...c, origen_tipo: 'ABC_PAGO' })));
        case 'pedidos_tpv': case 'pedido_lineas': case 'ventas_fiscales': case 'venta_fiscal_lineas': return consultaSobre([]);
        default: return base.from(nombre);
      }
    },
    async rpc(nombre, params) {
      llamadas.push({ nombre, params });
      if (nombre === 'abc_listar_eventos_descuento_cuenta') return datos.errorEventos ? { data: null, error: { message: datos.errorEventos } } : { data: datos.eventos, error: null };
      if (nombre === 'abc_estado_cobro_cuenta') return { data: { estado: 'PAGADO', total: 3, confirmado: 3, saldo: 0 }, error: null };
      if (nombre === 'abc_estado_pago_mixto_cuenta') return { data: { estado: 'PAGADO', total: 3, confirmado: 3, saldo: 0, reservado: 0, efectivo_recibido: 3, cambio_entregado: 0, cajas: [], pagos: datos.pagos, intentos: [] }, error: null };
      if (nombre === 'abc_listar_incidencias_cobro') return { data: [], error: null };
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
  return { srv, logica, llamadas, prohibidas, abierta, ctx, E, L, productos, datos };
}
// las propiedades que la aplicación le pasa al TPV (ver la línea del TPV en la aplicación): todo lo que entrega la lógica, con los mismos nombres
async function montar(env, props = {}) {
  if (raiz) { await act(async () => { raiz.unmount(); }); raiz = null; }
  document.getElementById('raiz').innerHTML = '';
  raiz = createRoot(document.getElementById('raiz'));
  const l = env.logica;
  await act(async () => {
    raiz.render(React.createElement(mod.VentaRapida, {
      productos: env.productos, venderCarrito: l.venderCarritoA02, enviarPedidoA05: l.enviarPedidoA05, leerPedidoOperativoA05: l.leerPedidoOperativoA05, accionPedidoA05: l.accionPedidoA05,
      recuperarCuentaA06: l.recuperarCuentaA06, cargarMapaSalaA07: l.cargarMapaSalaA07, asignarMesaCuentaA07: l.asignarMesaCuentaA07, listarResponsablesCuentaA07: l.listarResponsablesCuentaA07,
      moverMesaCuentaA07: l.moverMesaCuentaA07, cambiarResponsableCuentaA07: l.cambiarResponsableCuentaA07, anularVenta: l.anularVenta, movimientos: [], listarCuentasRepartoA08: l.listarCuentasRepartoA08,
      moverCantidadLineaCuentaA08: l.moverCantidadLineaCuentaA08, registrarAuditoria() {}, iniciarCobroCuentaF4: l.iniciarCobroCuentaF4, reintentarCobroF4: l.reintentarCobroF4,
      leerEstadoCobroF4: l.leerEstadoCobroF4, abrirIncidenciaCobroF4: l.abrirIncidenciaCobroF4, resolverIncidenciaCobroF4: l.resolverIncidenciaCobroF4, aplicarDescuentoCuentaA09: l.aplicarDescuentoCuentaA09,
      listarAutorizacionesDescuentoA09: l.listarAutorizacionesDescuentoA09, resolverAutorizacionDescuentoA09: l.resolverAutorizacionDescuentoA09,
      local: { id: env.L, nombre: 'Local A1' }, configEmpresa: { id: env.E }, listarModalidadesA02: l.listarModalidadesA02,
      leerContextoCuentaA02: l.leerContextoCuentaA02, respuestaErrorA06: l.respuestaErrorA06, ...props
    }));
  });
  await esperar(250);
}
function tarjetaDescuento() {
  const titulo = [...document.querySelectorAll('div')].find((d) => d.children.length === 0 && d.textContent.trim() === 'Descuento / cortesía');
  return titulo ? titulo.parentElement.parentElement : null;
}
const botonDe = (tarjeta, t) => [...(tarjeta?.querySelectorAll('button') || [])].find((b) => b.textContent.trim() === t);

try {
  {
    const env = await entorno();
    ok('A0 el entorno abre una cuenta y deja su contexto', env.abierta?.ok === true && !!env.ctx?.cuentaId, env.abierta);
    await montar(env);
    ok('A1 el TPV muestra la tarjeta «Descuento / cortesía» con su botón «Abrir»', !!botonDe(tarjetaDescuento(), 'Abrir'), texto().slice(0, 500));
    await clic(botonDe(tarjetaDescuento(), 'Abrir'));
    await esperar(250);
    const t = texto();
    const tarjeta = tarjetaDescuento();
    ok('B1 el panel termina de cargar: ya no dice «Cargando autorizaciones…» (antes: se quedaba fijo)', !t.includes('Cargando autorizaciones…') && !!tarjeta, t.slice(-900));
    ok('B2 el botón de actualizar vuelve a «Actualizar» (antes: se quedaba en «Actualizando…»)', !!botonDe(tarjeta, 'Actualizar') && !botonDe(tarjeta, 'Actualizando…'), [...tarjeta.querySelectorAll('button')].map((b) => b.textContent));
    ok('B3 sale el historial con su título', t.includes('Auditoría A09 · historial'), t.slice(-900));
    ok('B4 sin cartel rojo de error', !tarjeta.querySelector('[role="alert"]'), tarjeta.querySelector('[role="alert"]')?.textContent);
    ok('B5 salen los eventos de descuento que da el servidor', t.includes('Eventos server-side · 1') && t.includes('CUENTA_DESCUENTO_APLICADO'), t.slice(-900));
    ok('B6 salen los efectos de caja del cobro (no «Sin movimientos de caja asociados»)', !t.includes('Sin movimientos de caja asociados'), t.slice(-900));
    ok('B7 con datos no sale «No hay registros de auditoría para esta cuenta.»', !t.includes('No hay registros de auditoría para esta cuenta.'), t.slice(-600));
    const c = env.llamadas.filter((x) => x.nombre === 'abc_listar_eventos_descuento_cuenta');
    ok('B8 los eventos se piden a la función del servidor, una vez y con los parámetros exactos', c.length === 1 && Object.keys(c[0].params).join() === 'p_empresa_id,p_local_id,p_cuenta_id' && c[0].params.p_cuenta_id === env.ctx.cuentaId && c[0].params.p_empresa_id === env.E && c[0].params.p_local_id === env.L, env.llamadas);
    ok('B9 el navegador no consulta ninguna tabla sin permiso', env.prohibidas.length === 0, env.prohibidas);
    await clic(botonDe(tarjeta, 'Cerrar'));
    ok('B10 «Cerrar» devuelve la tarjeta a su estado inicial', !!botonDe(tarjetaDescuento(), 'Abrir'), texto().slice(-300));
  }
  {
    // sin descuentos: el historial lo dice
    const env = await entorno({ eventos: [], caja: [] });
    await montar(env);
    await clic(botonDe(tarjetaDescuento(), 'Abrir'));
    await esperar(250);
    const t = texto();
    ok('C1 sin descuentos ni movimientos: «No hay descuentos aplicados en esta cuenta.» y «No hay registros de auditoría para esta cuenta.»', t.includes('No hay descuentos aplicados en esta cuenta.') && t.includes('No hay registros de auditoría para esta cuenta.') && !t.includes('Cargando autorizaciones…'), t.slice(-700));
  }
  {
    // errores: salen como TEXTO y la carga termina (antes: la pantalla se rompía o se quedaba colgada)
    let env = await entorno({ errorEventos: 'descuento_eventos_no_autorizado' });
    await montar(env);
    await clic(botonDe(tarjetaDescuento(), 'Abrir'));
    await esperar(250);
    let alerta = tarjetaDescuento()?.querySelector('[role="alert"]');
    ok('D1 sin permiso para ver el historial: aviso rojo en español, la carga termina y la pantalla sigue viva', !!alerta && alerta.textContent.includes('Tu perfil no tiene permiso para ver el historial de descuentos de esta cuenta.') && !alerta.textContent.includes('[object Object]') && !!botonDe(tarjetaDescuento(), 'Actualizar'), alerta?.textContent);
    env = await entorno({ errorDescuentos: { message: 'fallo_de_red_inesperado' } });
    await montar(env);
    await clic(botonDe(tarjetaDescuento(), 'Abrir'));
    await esperar(250);
    alerta = tarjetaDescuento()?.querySelector('[role="alert"]');
    ok('D2 un error al leer los descuentos aplicados sale como texto (no «[object Object]») y la carga termina', !!alerta && !alerta.textContent.includes('[object Object]') && alerta.textContent.includes('fallo_de_red_inesperado') && !!botonDe(tarjetaDescuento(), 'Actualizar'), alerta?.textContent);
  }
  {
    // la propia carga se puede repetir con «Actualizar»
    const env = await entorno();
    await montar(env);
    await clic(botonDe(tarjetaDescuento(), 'Abrir'));
    await esperar(250);
    await clic(botonDe(tarjetaDescuento(), 'Actualizar'));
    await esperar(250);
    const n = env.llamadas.filter((x) => x.nombre === 'abc_listar_eventos_descuento_cuenta').length;
    ok('E1 «Actualizar» vuelve a cargar y termina otra vez', n === 2 && !texto().includes('Cargando autorizaciones…') && !!botonDe(tarjetaDescuento(), 'Actualizar'), { n });
  }
} catch (e) {
  resultados.push({ nombre: 'ERROR FATAL', ok: false, det: String(e.stack || e).slice(0, 1500) });
}
const fallos = resultados.filter((r) => !r.ok);
console.log(JSON.stringify({ total: resultados.length, fallos: fallos.length, detalle: fallos }, null, 1).slice(0, 9000));
if (fallos.length) process.exit(1);
console.log('a09-panel-ui-runtime: OK');
process.exit(0);
