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
