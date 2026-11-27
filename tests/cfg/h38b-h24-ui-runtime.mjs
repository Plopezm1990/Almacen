// Prueba de ejecución de H-38b (botón «Emitir documento pendiente») y H-24 (esperado del arqueo desde el servidor).
// Carga el módulo REAL de la aplicación (source-recovery/fuente-recuperado.js) con React 18 en un navegador simulado (jsdom)
// y un servidor falso en memoria (tests/cfg/lib/servidor-caja-falso.mjs) al que aquí se le añaden las funciones de lectura y de
// emisión que usan estas dos pantallas. Complementa a los contratos de texto (h38b-…-contract y h24-…-contract): estos
// comprueban lo que SE VE y lo que SE ENVÍA al servidor.
//
// Necesita jsdom, react y react-dom en CFG6_UI_DEPS (o CFG6D_UI_DEPS), como cfg6d-ui-runtime.mjs.
//   CFG6_UI_DEPS=/tmp/cfg6deps node tests/cfg/h38b-h24-ui-runtime.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearServidorFalso } from './lib/servidor-caja-falso.mjs';

const depsDir = process.env.CFG6D_UI_DEPS || process.env.CFG6_UI_DEPS;
if (!depsDir) {
  console.error('CFG6_UI_DEPS no está definido: indica una carpeta con node_modules (react@18.3.1, react-dom@18.3.1 y jsdom).');
  process.exit(2);
}
const require = createRequire(join(resolve(depsDir), 'package.json'));
const { JSDOM } = require('jsdom');
// El emisor fiscal solo se activa en la vista previa de QA: se imita su dirección.
const dom = new JSDOM('<!doctype html><html><body><div id="raiz"></div></body></html>', { url: 'https://deploy-preview-225--chic-entremet-9107cf.netlify.app/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.matchMedia = dom.window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
dom.window.__modoPruebasQA = true;
const React = require('react');
const { createRoot } = require('react-dom/client');
const act = React.act;

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const origen = process.env.H38B_FUENTE || join(REPO, 'source-recovery/fuente-recuperado.js');

// ---------- carga del módulo real ----------
const lineas = readFileSync(origen, 'utf8').split('\n');
const ini = lineas.findIndex((l) => l.startsWith('import React'));
let fin = ini;
while (lineas[fin + 1].startsWith('import ')) fin += 1;
const iconos = lineas.slice(ini, fin + 1).find((l) => l.includes('lucide-react')).match(/\{([^}]*)\}/)[1].split(',').map((x) => x.trim().split(' as ').pop());
const stubs = { React, ReactNS: React, import_client2: { createRoot: () => ({ render() {}, unmount() {} }) }, createRoot: () => ({ render() {}, unmount() {} }), createClient: () => ({}), E: function () {}, autoTable: () => {}, XLSX: { utils: {}, writeFile() {}, writeFileSync() {} } };
const fabrica = new Function(...Object.keys(stubs), ...iconos, lineas.slice(fin + 1).join('\n') + '\nreturn { crearLogicaVenta, CocinaA10, ArqueoCaja };');
const mod = fabrica(...Object.values(stubs), ...iconos.map(() => () => null));

// ---------- utilidades ----------
const resultados = [];
const ok = (nombre, cond, det) => resultados.push({ nombre, ok: !!cond, det: cond ? undefined : det });
const esperar = async (ms = 0) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };
const texto = () => document.getElementById('raiz').textContent;
const botones = (t) => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === t);
const boton = (t) => botones(t)[0] || [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t));
async function clic(el) {
  if (!el) throw new Error('clic sobre un elemento que no existe; texto actual: ' + texto().slice(-500));
  await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  await esperar(20);
}

// Servidor falso + las dos funciones nuevas (lista de ventas sin documento y emisión de documento).
function entorno(opciones = {}) {
  const srv = crearServidorFalso(opciones);
  const { E, L } = srv.estado.ids;
  const ventas = (opciones.ventasSinDocumento || []).map((v, i) => ({
    checkout_id: `00000000-0000-4000-8000-00000000c0${i}0`, cuenta_id: `00000000-0000-4000-8000-00000000a0${i}0`,
    venta_fiscal_id: `00000000-0000-4000-8000-00000000f0${i}0`, importe: v, completed_at: `2026-11-26T1${i}:30:00+00:00`
  }));
  const documentos = [];
  const descuentos = new Map();
  const base = srv.cliente.rpc.bind(srv.cliente);
  srv.cliente.rpc = async (nombre, params) => {
    if (nombre === 'abc_c04_listar_ventas_sin_documento') {
      srv.estado.llamadas.push({ nombre, params });
      if (opciones.listaFalla) return { data: null, error: { message: 'ventas_sin_documento_no_autorizado' } };
      return { data: ventas.filter((v) => !documentos.some((d) => d.venta_fiscal_id === v.venta_fiscal_id)), error: null };
    }
    if (nombre === 'abc_c07d_estado_configuracion_emision') {
      srv.estado.llamadas.push({ nombre, params });
      return { data: { ok: true, configurada: true, configuracion: { estado: 'ACTIVA' } }, error: null };
    }
    if (nombre === 'abc_c07d_emitir_checkout') {
      srv.estado.llamadas.push({ nombre, params });
      if (opciones.emisionFalla) return { data: null, error: { message: 'abc_documento_no_autorizado' } };
      const v = ventas.find((x) => x.cuenta_id === params.p_cuenta_id);
      if (!v) return { data: null, error: { message: 'cuenta_no_encontrada' } };
      if (!documentos.some((d) => d.venta_fiscal_id === v.venta_fiscal_id)) documentos.push({ venta_fiscal_id: v.venta_fiscal_id, operation_id: params.p_operation_id });
      return { data: { ok: true, documentos: [{ estado: 'EMITIDO', numero: 100 + documentos.length, codigo_serie: 'TPV', venta_fiscal_id: v.venta_fiscal_id }] }, error: null };
    }
    if (nombre === 'abc_cancelar_pedido') {
      srv.estado.llamadas.push({ nombre, params });
      return { data: { ok: true, pedido_id: params.p_pedido_id, estado: 'CANCELADO', pedido_version: 5, lineas_canceladas: 1, cuenta_cerrada: true }, error: null };
    }
    if (nombre === 'abc_completar_venta_rapida') {
      srv.estado.llamadas.push({ nombre, params });
      if (opciones.ventaRapidaFalla) return { data: null, error: { message: 'venta_rapida_no_autorizada' } };
      return { data: { ok: true, pedido_id: params.p_pedido_id, pedido_estado: 'SERVIDO', pedido_version: 9, lineas: (opciones.lineasVentaRapida || []).map((id, i) => ({ linea_id: id, estado: 'SERVIDA', linea_version: 20 + i })) }, error: null };
    }
    if (nombre === 'abc_aplicar_descuento_cuenta') {
      // Como el servidor real: una misma operación con el valor escrito con otra escala es otra petición.
      srv.estado.llamadas.push({ nombre, params });
      const previa = descuentos.get(params.p_operation_id);
      const huella = JSON.stringify({ ...params });
      if (previa && previa !== huella) return { data: null, error: { message: 'operation_id_conflict' } };
      descuentos.set(params.p_operation_id, huella);
      return { data: { status: 'PENDIENTE_AUTORIZACION', authorization_id: 'a1', snapshot_hash: 'h1', snapshot: { operation: {} } }, error: null };
    }
    return base(nombre, params);
  };
  dom.window.getSupabaseClient = async () => srv.cliente;
  dom.window.__nubeActiva = true;
  localStorage.clear();
  dom.window.sessionStorage.clear();
  const logica = mod.crearLogicaVenta({ productos: [], setProductos() {}, movimientos: [], setMovimientos() {}, arqueos: [], localActivoId: L, empresaDelLocalActivo: { id: E } });
  return { srv, s: srv.estado, logica, A: logica.listarEstacionesA10, E, L, documentos, ventas, llamadas: (n) => srv.estado.llamadas.filter((c) => c.nombre === n) };
}

let raiz = null;
async function montar(elemento) {
  if (raiz) { await act(async () => { raiz.unmount(); }); raiz = null; }
  // Lo que dejó pendiente la pantalla anterior puede escribir en el navegador tras desmontarse: se espera y se limpia
  // DESPUÉS, para que el terminal guardado de otro servidor falso no contamine este.
  await esperar(60);
  localStorage.clear();
  dom.window.sessionStorage.clear();   // en la vista previa de QA el terminal se guarda aquí
  document.getElementById('raiz').innerHTML = '';
  raiz = createRoot(document.getElementById('raiz'));
  await act(async () => { raiz.render(elemento); });
  await esperar(40);
}
const montarCierre = (env, props = {}) => montar(React.createElement(mod.CocinaA10, {
  productos: [], local: { id: env.L }, configEmpresa: { id: env.E }, listarEstacionesA10: env.A, rolPerfil: env.s.rol,
  listarComandasA10: async () => ({ ok: true, comandas: [] }), crearEstacionA10: async () => ({ ok: true }), actualizarEstacionA10: async () => ({ ok: true }),
  asignarProductoEstacionA10: async () => ({ ok: true }), enviarCambioComandaA10: async () => ({ ok: true }), reimprimirComandaA10: async () => ({ ok: true }), resolverMermaComandaA10: async () => ({ ok: true }),
  ...props
}));

try {
  // ================= H-38b · pantalla de cierre =================
  {
    const env = entorno({ rol: 'Cajero/a', ventasSinDocumento: [5, 7.5] });
    await montarCierre(env);
    await clic(boton('Mostrar gestión avanzada'));
    await esperar(40);
    ok('B1 con dos ventas sin documento aparece el panel con su recuento', texto().includes('Ventas cobradas sin documento fiscal (2)'), texto().slice(0, 600));
    ok('B2 cada venta tiene su botón «Emitir documento pendiente» y se ve su importe', botones('Emitir documento pendiente').length === 2 && texto().includes('€5.00') && texto().includes('€7.50'), texto().slice(0, 800));
    ok('B3 la pantalla pidió la lista al servidor con la sesión y el terminal reales',
      (() => { const l = env.llamadas('abc_c04_listar_ventas_sin_documento')[0]; return l && l.params.p_session_id === env.s.ids.S && l.params.p_empresa_id === env.E && l.params.p_local_id === env.L; })(), env.llamadas('abc_c04_listar_ventas_sin_documento'));
    ok('B4 el panel explica que el cierre definitivo no se completa hasta emitirlos', texto().includes('El cierre definitivo no se puede completar hasta emitir el documento de cada una.'));

    await clic(botones('Emitir documento pendiente')[0]);
    const emision = env.llamadas('abc_c07d_emitir_checkout')[0];
    ok('B5 pulsar el botón emite el documento de ESA venta (cuenta y operación del checkout)',
      emision && emision.params.p_cuenta_id === env.ventas[0].cuenta_id && emision.params.p_operation_id === `f7.c07d.checkout.emit:${env.ventas[0].cuenta_id}:${env.ventas[0].checkout_id}`
      && emision.params.p_empresa_id === env.E && emision.params.p_local_id === env.L && emision.params.p_tipo_documento === 'FACTURA', emision);
    ok('B6 la venta emitida sale del panel (queda 1) y se confirma el número', texto().includes('Ventas cobradas sin documento fiscal (1)') && botones('Emitir documento pendiente').length === 1 && texto().includes('Documento emitido: TPV n.º 101'), texto().slice(0, 900));
    ok('B7 el servidor recibió una sola emisión', env.llamadas('abc_c07d_emitir_checkout').length === 1);

    await clic(botones('Emitir documento pendiente')[0]);
    ok('B8 al emitir la última, el panel desaparece', !texto().includes('Ventas cobradas sin documento fiscal') && botones('Emitir documento pendiente').length === 0, texto().slice(0, 700));
    ok('B9 las dos emisiones fueron operaciones distintas (una por venta)', new Set(env.llamadas('abc_c07d_emitir_checkout').map((c) => c.params.p_operation_id)).size === 2);
  }
  {
    // Sin ventas pendientes no hay panel.
    const env = entorno({ rol: 'Cajero/a', ventasSinDocumento: [] });
    await montarCierre(env);
    await clic(boton('Mostrar gestión avanzada'));
    await esperar(40);
    ok('B10 sin ventas pendientes no se ve el panel ni el botón', !texto().includes('Ventas cobradas sin documento') && botones('Emitir documento pendiente').length === 0, texto().slice(0, 500));
  }
  {
    // La emisión falla: se dice por qué y la venta sigue en la lista (no se da por emitida).
    const env = entorno({ rol: 'Cajero/a', ventasSinDocumento: [3], emisionFalla: true });
    await montarCierre(env);
    await clic(boton('Mostrar gestión avanzada'));
    await esperar(40);
    await clic(botones('Emitir documento pendiente')[0]);
    ok('B11 si el servidor rechaza la emisión, la venta sigue pendiente y no aparece «Documento emitido»',
      texto().includes('Ventas cobradas sin documento fiscal (1)') && !texto().includes('Documento emitido') && botones('Emitir documento pendiente').length === 1, texto().slice(0, 900));
    ok('B12 y se muestra un error (no un silencio)', /no|autoriz|emitir|permiso/i.test(texto().replace(/Emitir documento pendiente/g, '')), texto().slice(0, 900));
  }
  {
    // La lista no se puede leer: no se inventa nada.
    const env = entorno({ rol: 'Cajero/a', ventasSinDocumento: [4], listaFalla: true });
    await montarCierre(env);
    await clic(boton('Mostrar gestión avanzada'));
    await esperar(40);
    ok('B13 si no se puede leer la lista no se pinta un panel inventado', !texto().includes('Ventas cobradas sin documento fiscal') && botones('Emitir documento pendiente').length === 0, texto().slice(0, 500));
  }

  // ================= H-24 · esperado del arqueo =================
  // Movimientos locales que, sumados en el cliente, dan un efectivo distinto del que tiene el servidor (el caso de la auditoría).
  const hoy = new Date().toISOString().slice(0, 10);
  const movimientosLocales = [
    { id: 'm1', fecha: hoy, tipo: 'salida', medioPago: 'Efectivo', cantidad: 1, ingresoUnitario: 2.65, ivaVentaAplicado: 0, ventaId: 'v1', operationId: 'v1' }
  ];
  const propsArqueo = (env, extra = {}) => ({
    movimientos: movimientosLocales, arqueos: [], addArqueo: async () => ({ ok: true }), deleteArqueo: async () => ({ ok: true }), encargos: [], movimientosCaja: [],
    registrarMovimientoCaja: async () => ({ ok: true }), eliminarMovimientoCaja: async () => ({ ok: true }), leerBorradorArqueo: () => null, leerBorradorMovimientoCaja: () => null, ...extra
  });
  {
    const env = entorno({ rol: 'Cajero/a', esperado: 0 });
    await montar(React.createElement(mod.ArqueoCaja, propsArqueo(env, { consultarEsperadoServidor: env.logica.consultarEsperadoCajaA24 })));
    ok('A1 con el servidor esperando 0,00 € la pantalla muestra 0,00 € (no la cifra local)', document.querySelector('[data-arqueo-esperado="ok"]')?.textContent === '€0,00', document.querySelector('[data-arqueo-esperado]')?.outerHTML);
    ok('A2 explica que la cifra es del servidor, con fondo, entradas y salidas', texto().includes('Calculado por el servidor para la sesión de caja abierta: fondo inicial €0,00 · entradas €0,00 · salidas €0,00.'), texto().slice(0, 800));
    const preview = env.llamadas('abc_previsualizar_arqueo_caja')[0];
    ok('A3 pidió la vista previa con la sesión y el terminal reales, en euros', preview && preview.params.p_session_id === env.s.ids.S && preview.params.p_terminal_id === env.s.ids.T && preview.params.p_currency_code === 'EUR', preview);
    ok('A4 no muestra ni la base ni el ajuste calculados en el cliente', !texto().includes('Base efectivo') && !texto().includes('2,65') && !texto().includes('2.65'), texto().slice(0, 800));
  }
  {
    const env = entorno({ rol: 'Cajero/a', esperado: 12.5 });
    await montar(React.createElement(mod.ArqueoCaja, propsArqueo(env, { consultarEsperadoServidor: env.logica.consultarEsperadoCajaA24 })));
    ok('A5 con otro esperado del servidor muestra ese (12,50 €)', document.querySelector('[data-arqueo-esperado="ok"]')?.textContent === '€12,50', document.querySelector('[data-arqueo-esperado]')?.outerHTML);
    const entrada = document.querySelector('input[type=number][step="0.01"]');
    const set = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
    await act(async () => { set.call(entrada, '10'); entrada.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
    ok('A6 la diferencia se calcula contra el esperado del servidor (contado 10 → faltan 2,50 €)', texto().includes('Faltan €2,50'), texto().slice(0, 900));
  }
  {
    const env = entorno({ rol: 'Cajero/a', esperado: 4 });
    env.s.fallos.abc_previsualizar_arqueo_caja = 'terminal_no_vinculado_sesion';
    await montar(React.createElement(mod.ArqueoCaja, propsArqueo(env, { consultarEsperadoServidor: env.logica.consultarEsperadoCajaA24 })));
    ok('A7 si el servidor no responde no se enseña ninguna cifra («No disponible»)', document.querySelector('[data-arqueo-esperado="error"]')?.textContent === 'No disponible', document.querySelector('[data-arqueo-esperado]')?.outerHTML);
    ok('A8 y se dice que no hay cifra estimada', texto().includes('No se muestra ninguna cifra estimada'), texto().slice(0, 800));
    const entrada = document.querySelector('input[type=number][step="0.01"]');
    const set = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
    await act(async () => { set.call(entrada, '10'); entrada.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
    ok('A9 sin esperado no se calcula ninguna diferencia', !texto().includes('Sobran') && !texto().includes('Faltan') && !texto().includes('Cuadra'), texto().slice(0, 900));
  }
  {
    // Modo local sin servidor: se conserva el cálculo local.
    const env = entorno({ rol: 'Cajero/a', esperado: 0 });
    await montar(React.createElement(mod.ArqueoCaja, propsArqueo(env, {})));
    ok('A10 sin servidor (modo local) se conserva el cálculo local y nunca se llama al servidor', document.querySelector('[data-arqueo-esperado="local"]') !== null && env.llamadas('abc_previsualizar_arqueo_caja').length === 0, document.querySelector('[data-arqueo-esperado]')?.outerHTML);
  }
  {
    // Al abrir la sesión de caja desde esta pantalla, el esperado se vuelve a pedir solo (visto en QA: quedaba «No disponible» hasta pulsar «Actualizar»).
    const env = entorno({ rol: 'Cajero/a', esperado: 0 });
    env.s.fallos.abc_previsualizar_arqueo_caja = 'terminal_no_vinculado_sesion';
    await montar(React.createElement(mod.ArqueoCaja, propsArqueo(env, {
      consultarEsperadoServidor: env.logica.consultarEsperadoCajaA24,
      abrirSesionCajaA10: async () => { delete env.s.fallos.abc_previsualizar_arqueo_caja; return { ok: true, caja_nombre: 'Caja A1' }; }
    })));
    ok('A11 sin sesión abierta el esperado está «No disponible»', document.querySelector('[data-arqueo-esperado="error"]') !== null, document.querySelector('[data-arqueo-esperado]')?.outerHTML);
    await clic(boton('Abrir sesión de caja'));
    await esperar(40);
    ok('A12 al abrir la sesión desde la pantalla, el esperado se pide de nuevo y aparece sin pulsar «Actualizar»', document.querySelector('[data-arqueo-esperado="ok"]')?.textContent === '€0,00', document.querySelector('[data-arqueo-esperado]')?.outerHTML);
  }

  // ================= H-26 · los bloqueos del cierre se explican =================
  {
    const env = entorno({ rol: 'Propietario', esperado: 0, bloqueosProvisional: ['EFECTOS_PENDIENTES', 'PAGOS_PENDIENTES', 'VENTAS_SIN_DOCUMENTO'], ensayoBloqueos: ['EFECTOS_PENDIENTES', 'VENTAS_SIN_DOCUMENTO'] });
    await montarCierre(env);
    await clic(boton('Mostrar gestión avanzada'));
    await clic(boton('Iniciar cierre'));
    const contado = document.querySelector('input[type=number][step="0.01"]');
    const set = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
    await act(async () => { set.call(contado, '0'); contado.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
    await clic(boton('Confirmar cierre provisional'));
    await esperar(40);
    ok('C1 el cierre provisional explica cada bloqueo con una frase', texto().includes('Hay efectos pendientes del proveedor (por ejemplo, un reembolso de tarjeta sin resolver).') && texto().includes('Hay pagos pendientes de resolver') && texto().includes('Hay ventas cobradas sin documento fiscal. Emite los documentos pendientes.'), texto().slice(-900));
    ok('C2 y ya no dice «Pendiente operativo»', !texto().includes('Pendiente operativo'), texto().slice(-900));
    await clic(boton('Ensayar cierre C12'));
    await esperar(40);
    ok('C3 el ensayo C12 usa las mismas frases', (texto().match(/Hay efectos pendientes del proveedor/g) || []).length >= 2 && (texto().match(/Hay ventas cobradas sin documento fiscal/g) || []).length >= 2, texto().slice(-1200));
  }

  // ================= H-44 · «Reintentar aplicación» de un descuento =================
  {
    const env = entorno({ rol: 'Encargado' });
    const u = (n) => `00000000-0000-4000-8000-00000000d0${n}0`;
    const cuentaGuardada = JSON.stringify({ schemaVersion: 1, empresaId: env.E, localId: env.L, cuentaId: u(1), cuentaVersion: 2, pedidoId: u(2), pedidoVersion: 1, pedidoEstado: 'ENVIADO', terminalId: env.s.ids.T, sessionId: env.s.ids.S, operatingDay: '2026-11-26', currencyCode: 'EUR', lineas: [{ lineaId: u(3), productoId: 'p1', lineaVersion: 1, estado: 'ENVIADA', cantidad: 1, total: 1 }] });
    localStorage.setItem(`la_suite_a02_1_ultima_cuenta_v1:${env.E}:${env.L}`, cuentaGuardada);
    const base = { operationId: 'a09.1.7.descuento:' + 'f'.repeat(64), cuentaId: u(1), tipo: 'PERCENT', motivo: 'Prueba', expectedCuentaVersion: '2', terminalId: env.s.ids.T, sessionId: env.s.ids.S, operatingDay: '2026-11-26', requiereEscalado: true, requiereDobleAprobacion: false, approvalHash: '' };
    // Petición original: el valor tal como se escribió ("10"); reintento: el valor que guarda la autorización ("10.00000000").
    const r1 = await env.logica.aplicarDescuentoCuentaA09({ tipo: 'PERCENT', motivo: 'Prueba', solicitud: { ...base, valor: '10' } });
    const r2 = await env.logica.aplicarDescuentoCuentaA09({ tipo: 'PERCENT', motivo: 'Prueba', solicitud: { ...base, valor: '10.00000000' } });
    const llamadas = env.llamadas('abc_aplicar_descuento_cuenta');
    ok('D1 el reintento envía el mismo valor que la petición original (antes «10» y «10.00000000»)', llamadas.length === 2 && llamadas[0].params.p_valor === llamadas[1].params.p_valor && llamadas[1].params.p_valor === '10', llamadas.map((c) => c.params.p_valor));
    ok('D2 el servidor no responde operation_id_conflict al reintentar', !String(r2?.error || '').includes('operation_id_conflict') && !String(r2?.error || '').includes('conflict'), r2);
    const casos = [['5.50000000', '5.5'], ['10.50', '10.5'], ['007', '7'], ['0.25000000', '0.25'], ['100.00000000', '100'], ['0.00000001', '0.00000001']];
    for (const [entrada, esperado] of casos) {
      const e2 = entorno({ rol: 'Encargado' });
      localStorage.setItem(`la_suite_a02_1_ultima_cuenta_v1:${e2.E}:${e2.L}`, cuentaGuardada);
      await e2.logica.aplicarDescuentoCuentaA09({ tipo: 'AMOUNT', motivo: 'Prueba', solicitud: { ...base, tipo: 'AMOUNT', valor: entrada, terminalId: e2.s.ids.T, sessionId: e2.s.ids.S } });
      ok(`D3 el valor «${entrada}» se envía como «${esperado}»`, e2.llamadas('abc_aplicar_descuento_cuenta')[0]?.params.p_valor === esperado, e2.llamadas('abc_aplicar_descuento_cuenta')[0]?.params);
    }
    const e3 = entorno({ rol: 'Encargado' });
    localStorage.setItem(`la_suite_a02_1_ultima_cuenta_v1:${e3.E}:${e3.L}`, cuentaGuardada);
    const malo = await e3.logica.aplicarDescuentoCuentaA09({ tipo: 'PERCENT', motivo: 'Prueba', solicitud: { ...base, valor: '10.123456789', terminalId: e3.s.ids.T, sessionId: e3.s.ids.S } });
    ok('D4 un valor con más de 8 decimales sigue rechazándose antes de llegar al servidor', malo?.ok === false && e3.llamadas('abc_aplicar_descuento_cuenta').length === 0, malo);
  }

  // ================= H-37 · venta rápida del Cajero/a =================
  {
    const u = (n) => `00000000-0000-4000-8000-00000000e0${n}0`;
    const env = entorno({ rol: 'Cajero/a', lineasVentaRapida: [u(3), u(4)] });
    localStorage.setItem(`la_suite_a02_1_ultima_cuenta_v1:${env.E}:${env.L}`, JSON.stringify({ schemaVersion: 1, empresaId: env.E, localId: env.L, cuentaId: u(1), cuentaVersion: 2, pedidoId: u(2), pedidoVersion: 4, pedidoEstado: 'ENVIADO', terminalId: env.s.ids.T, sessionId: env.s.ids.S, operatingDay: '2026-11-27', currencyCode: 'EUR', lineas: [{ lineaId: u(3), productoId: 'p1', lineaVersion: 3, estado: 'ENVIADA', cantidad: 1, total: 1 }, { lineaId: u(4), productoId: 'p2', lineaVersion: 3, estado: 'ENVIADA', cantidad: 1, total: 1 }] }));
    const r = await env.logica.accionPedidoA05('COMPLETAR_VENTA_RAPIDA');
    const llamadas = env.llamadas('abc_completar_venta_rapida');
    ok('E1 completar la venta rápida es UNA sola llamada al servidor', llamadas.length === 1, llamadas.length);
    const q = llamadas[0]?.params || {};
    ok('E2 envía el pedido, su versión, el terminal, la sesión y el día del contexto', q.p_pedido_id === u(2) && q.p_expected_pedido_version === 4 && q.p_terminal_id === env.s.ids.T && q.p_session_id === env.s.ids.S && q.p_operating_day === '2026-11-27' && q.p_empresa_id === env.E && q.p_local_id === env.L, q);
    ok('E3 la operación tiene un identificador recuperable y propio de ese pedido y versión', /^a05\.3\.venta_rapida\./.test(q.p_operation_id || '') && q.p_operation_id.includes(u(2)) && /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(q.p_operation_id), q.p_operation_id);
    ok('E4 NO encadena los pasos de cocina uno a uno (ninguna transición de línea desde el cliente)', ['abc_iniciar_preparacion_linea', 'abc_marcar_linea_preparada', 'abc_servir_linea'].every((n) => env.llamadas(n).length === 0));
    ok('E5 el contexto guardado deja las líneas SERVIDAS con las versiones del servidor y el pedido SERVIDO', r.ok === true && r.pedidoEstado === 'SERVIDO' && r.pedidoVersion === 9 && r.lineas.every((l) => l.estado === 'SERVIDA') && r.lineas.map((l) => l.lineaVersion).join() === '20,21', JSON.stringify(r));
    const e2 = entorno({ rol: 'Cajero/a', ventaRapidaFalla: true });
    localStorage.setItem(`la_suite_a02_1_ultima_cuenta_v1:${e2.E}:${e2.L}`, JSON.stringify({ schemaVersion: 1, empresaId: e2.E, localId: e2.L, cuentaId: u(1), cuentaVersion: 2, pedidoId: u(2), pedidoVersion: 4, pedidoEstado: 'ENVIADO', terminalId: e2.s.ids.T, sessionId: e2.s.ids.S, operatingDay: '2026-11-27', currencyCode: 'EUR', lineas: [{ lineaId: u(3), productoId: 'p1', lineaVersion: 3, estado: 'ENVIADA', cantidad: 1, total: 1 }] }));
    const r2 = await e2.logica.accionPedidoA05('COMPLETAR_VENTA_RAPIDA');
    ok('E6 si el servidor rechaza, se dice con una frase comprensible y el contexto no cambia', r2.ok === false && /permiso para cobrar ventas rápidas/.test(r2.error || ''), r2);
    // H-20: si el envío falla, la venta rápida cancela el pedido y libera el terminal.
    const e3 = entorno({ rol: 'Cajero/a' });
    localStorage.setItem(`la_suite_a02_1_ultima_cuenta_v1:${e3.E}:${e3.L}`, JSON.stringify({ schemaVersion: 1, empresaId: e3.E, localId: e3.L, cuentaId: u(1), cuentaVersion: 2, pedidoId: u(2), pedidoVersion: 2, pedidoEstado: 'ABIERTO', terminalId: e3.s.ids.T, sessionId: e3.s.ids.S, operatingDay: '2026-11-27', currencyCode: 'EUR', lineas: [{ lineaId: u(3), productoId: 'p1', lineaVersion: 1, estado: 'BORRADOR', cantidad: 1, total: 1 }] }));
    const c = await e3.logica.accionPedidoA05('CANCELAR_PEDIDO', null, 'Venta rápida no enviada: sin ruta');
    ok('E8 cancelar el pedido de una venta rápida que no se pudo enviar deja el pedido CANCELADO y el contexto liberado', c.ok === true && c.pedidoEstado === 'CANCELADO' && e3.llamadas('abc_cancelar_pedido').length === 1 && e3.llamadas('abc_cancelar_pedido')[0].params.p_motivo.startsWith('Venta rápida no enviada'), JSON.stringify(c));
    // La pantalla ya no recorre las líneas con las tres acciones de cocina.
    const fuenteTexto = readFileSync(origen, 'utf8');
    const iniVR = fuenteTexto.indexOf('function VentaRapida(');
    const cuerpoVR = fuenteTexto.slice(iniVR);
    ok('E9 si falla el envío, la pantalla cancela el pedido (H-20) y conserva el carrito para reintentar', cuerpoVR.includes('accionPedidoA05("CANCELAR_PEDIDO", null, "Venta rápida no enviada: "') && cuerpoVR.includes('su cuenta se ha cancelado: puedes volver a intentarlo.'));
    ok('E7 la venta rápida de la pantalla usa la operación única y ya no recorre INICIAR_PREPARACION / MARCAR_PREPARADA / SERVIR', cuerpoVR.includes('accionPedidoA05("COMPLETAR_VENTA_RAPIDA"') && !cuerpoVR.includes('["INICIAR_PREPARACION", "MARCAR_PREPARADA", "SERVIR"]'));
  }

  // ================= H-39 · la pantalla de políticas de descuento avisa de las combinaciones que no funcionan =================
  {
    const fuenteTexto = readFileSync(origen, 'utf8');
    const ini = fuenteTexto.indexOf('const avisosPolitica = (p3) => {');
    const cuerpo = ini > 0 ? fuenteTexto.slice(ini, fuenteTexto.indexOf('const anadirRol', ini)) : '';
    // Se evalúa la función REAL de avisos con las combinaciones de la auditoría.
    const avisos = new Function('C2', cuerpo.replace('const avisosPolitica =', 'return') + '')(null);
    const sinDescuentos = avisos({ max_percent: '0', puede_solicitar: true, puede_aplicar: false, permite_escalado: true });
    const sinAplicar = avisos({ max_percent: '5', puede_solicitar: true, puede_aplicar: false, permite_escalado: true });
    const completa = avisos({ max_percent: '5', puede_solicitar: true, puede_aplicar: true, permite_escalado: true });
    const apagada = avisos({ max_percent: '0', puede_solicitar: false, puede_aplicar: false, permite_escalado: false });
    ok('F1 el caso del Encargado de QA (máximo 0 %, solicitar y escalar) avisa de que no puede dar descuentos', sinDescuentos.length === 1 && /máximo de 0 %.*no puede dar descuentos/.test(sinDescuentos[0]), sinDescuentos);
    ok('F2 con máximo mayor que 0 pero sin «Puede aplicar» avisa de que el servidor rechaza antes de crear la solicitud', sinAplicar.length === 1 && /sin «Puede aplicar»/.test(sinAplicar[0]), sinAplicar);
    ok('F3 la combinación que sí funciona (máximo, solicitar, aplicar y escalado) no avisa', completa.length === 0, completa);
    ok('F4 un cargo sin descuentos y con todo apagado tampoco avisa', apagada.length === 0, apagada);
    ok('F5 los avisos se pintan bajo las casillas de cada cargo', fuenteTexto.includes('"data-h39-aviso": "1"') && fuenteTexto.includes('avisosPolitica(p3).map('));
  }
} finally {
  if (raiz) { try { await act(async () => { raiz.unmount(); }); } catch {} }
}

const fallos = resultados.filter((r) => !r.ok);
for (const r of resultados) console.log(`${r.ok ? 'OK ' : 'FALLO'} ${r.nombre}${r.ok ? '' : ' → ' + (typeof r.det === 'string' ? r.det : JSON.stringify(r.det))}`);
console.log(`H38B_H24_UI_RUNTIME: ${resultados.length - fallos.length}/${resultados.length}`);
try { dom.window.close(); } catch {}
if (fallos.length) process.exit(1);
console.log('H38B_H24_UI_RUNTIME=PASS');
process.exit(0);
