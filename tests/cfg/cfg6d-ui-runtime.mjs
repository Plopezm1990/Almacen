// Prueba de ejecución del cierre de caja con diferencia (pieza 6d).
// Carga el módulo REAL de la aplicación (source-recovery/fuente-recuperado.js) con React 18 en un navegador simulado (jsdom) y un
// servidor falso en memoria (tests/cfg/lib/servidor-caja-falso.mjs) que reproduce las reglas de C04, de la pieza 2 y de la 6d:
//   Parte A · las funciones del cliente (crearLogicaVenta): contexto del cierre, día operativo del servidor, diferencia, aprobación.
//   Parte B · la pantalla de cierre de «Cocina A10» (CocinaA10) montada con esas funciones reales.
//
// Necesita librerías que no están en el repositorio: CFG6_UI_DEPS (o CFG6D_UI_DEPS) = carpeta con node_modules que contenga
// react@18.3.1, react-dom@18.3.1 y jsdom. Por ejemplo:
//   mkdir /tmp/cfg6deps && cd /tmp/cfg6deps && npm init -y && npm i react@18.3.1 react-dom@18.3.1 jsdom
//   CFG6_UI_DEPS=/tmp/cfg6deps node tests/cfg/cfg6d-ui-runtime.mjs
// CFG6D_FUENTE (opcional) permite probar otro archivo (por ejemplo una variante rota en las comprobaciones de mutantes).
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
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div><div id="raiz"></div></body></html>', { url: 'https://preview.test/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.matchMedia = dom.window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
// React se carga DESPUÉS de crear el navegador simulado (si no, no detecta los eventos de escritura).
const React = require('react');
const { createRoot } = require('react-dom/client');
const act = React.act;

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const origen = process.env.CFG6D_FUENTE || join(REPO, 'source-recovery/fuente-recuperado.js');

// ---------- carga del módulo real ----------
const lineas = readFileSync(origen, 'utf8').split('\n');
const ini = lineas.findIndex((l) => l.startsWith('import React'));
let fin = ini;
while (lineas[fin + 1].startsWith('import ')) fin += 1;
const iconos = lineas.slice(ini, fin + 1).find((l) => l.includes('lucide-react')).match(/\{([^}]*)\}/)[1].split(',').map((x) => x.trim().split(' as ').pop());
const stubs = { React, ReactNS: React, import_client2: { createRoot: () => ({ render() {}, unmount() {} }) }, createRoot: () => ({ render() {}, unmount() {} }), createClient: () => ({}), E: function () {}, autoTable: () => {}, XLSX: { utils: {}, writeFile() {}, writeFileSync() {} } };
const fabrica = new Function(...Object.keys(stubs), ...iconos, lineas.slice(fin + 1).join('\n') + '\nreturn { crearLogicaVenta, CocinaA10 };');
const mod = fabrica(...Object.values(stubs), ...iconos.map(() => () => null));

// ---------- utilidades ----------
const resultados = [];
const ok = (nombre, cond, det) => resultados.push({ nombre, ok: !!cond, det: cond ? undefined : det });
const esperar = async (ms = 0) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };
const texto = () => document.getElementById('raiz').textContent;
const boton = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t) || [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t));
async function clic(el) {
  if (!el) throw new Error('clic sobre un elemento que no existe; texto actual: ' + texto().slice(-500));
  await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  await esperar(15);
}
async function escribir(el, valor) {
  if (!el) throw new Error('escribir sobre un campo que no existe; texto actual: ' + texto().slice(-400));
  const set = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
  await act(async () => { set.call(el, valor); el.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
}
function campo(etiqueta) {
  const lab = [...document.querySelectorAll('label')].find((l) => l.textContent.includes(etiqueta));
  return lab ? lab.querySelector('input,select') : null;
}
const OPERACION = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/;

function entorno(opciones = {}) {
  const srv = crearServidorFalso(opciones);
  dom.window.getSupabaseClient = async () => srv.cliente;
  dom.window.__nubeActiva = true;
  localStorage.clear();
  const { E, L } = srv.estado.ids;
  const logica = mod.crearLogicaVenta({ productos: [], setProductos() {}, movimientos: [], setMovimientos() {}, arqueos: [], localActivoId: L, empresaDelLocalActivo: { id: E } });
  const A = logica.listarEstacionesA10;
  return { srv, s: srv.estado, logica, A, E, L, llamadas: (n) => srv.estado.llamadas.filter((c) => c.nombre === n) };
}
async function preparar(env) { return env; }  // las funciones del cierre ya cuelgan de listarEstacionesA10 sin haberla llamado
async function hastaProvisional(env, contado) {
  const r1 = await env.A.iniciarCierreSesionCajaA10();
  const r2 = await env.A.confirmarCierreProvisionalA10({ efectivoContado: contado });
  return [r1, r2];
}

try {
  // ================= Parte A · funciones del cliente =================
  {
    // A1/A2: sin cuenta abierta en el navegador el cierre funciona de principio a fin (resuelve H1 y H2)
    const env = await preparar(entorno({ esperado: 0, diaServidor: '2031-01-15' }));
    const { A, s } = env;
    ok('A0 las funciones del cierre (también las nuevas) cuelgan de listarEstacionesA10 desde que se crea la lógica, sin esperar a su primera llamada',
      ['abrirSesionCajaA10', 'iniciarCierreSesionCajaA10', 'confirmarCierreProvisionalA10', 'finalizarCierreSesionCajaA10', 'reabrirCierreProvisionalA10', 'consultarCierreCajaA10', 'registrarDiferenciaCajaA10', 'decidirDiferenciaCajaA10'].every((n) => typeof A[n] === 'function'), Object.keys(A));
    const r1 = await A.iniciarCierreSesionCajaA10();
    ok('A1.1 iniciar el cierre funciona sin ninguna cuenta abierta en este navegador (antes: «Abre o recupera primero un pedido real»)', r1.ok === true && s.sesiones[0].estado === 'EN_CIERRE', r1);
    const inicio = env.llamadas('abc_iniciar_cierre_sesion_caja')[0];
    ok('A1.2 usa el día operativo que da el servidor, no el del navegador', inicio?.params.p_operating_day === '2031-01-15', inicio);
    ok('A1.3 pidió ese día con los parámetros exactos', JSON.stringify(env.llamadas('abc_obtener_dia_operativo_local')[0]?.params) === JSON.stringify({ p_empresa_id: env.E, p_local_id: env.L }), env.llamadas('abc_obtener_dia_operativo_local'));
    ok('A1.4 envía el terminal y la sesión de la caja', inicio?.params.p_terminal_id === s.ids.T && inicio?.params.p_session_id === s.ids.S && inicio?.params.p_empresa_id === env.E && inicio?.params.p_local_id === env.L, inicio);
    ok('A1.5 el identificador de operación es válido para el servidor y único', OPERACION.test(inicio?.params.p_operation_id) && inicio.params.p_operation_id.startsWith('f5.ui.cash.close.start.'), inicio?.params.p_operation_id);
    const r2 = await A.confirmarCierreProvisionalA10({ efectivoContado: 0 });
    ok('A2.1 con la sesión ya EN_CIERRE el siguiente paso funciona (antes: «Este terminal no tiene una sesión de caja abierta»)', r2.ok === true && s.sesiones[0].estado === 'CIERRE_PROVISIONAL', r2);
    const conf = env.llamadas('abc_confirmar_cierre_provisional')[0];
    ok('A2.2 el provisional lleva el contado, la moneda y el día del servidor', conf?.params.p_counted_amount === 0 && conf.params.p_currency_code === 'EUR' && conf.params.p_operating_day === '2031-01-15', conf);
    const r3 = await A.finalizarCierreSesionCajaA10();
    ok('A2.3 finalizar un cierre sin diferencia funciona', r3.ok === true && s.sesiones[0].estado === 'CERRADA_FINAL', r3);
    ok('A2.4 los cuatro pasos usan el mismo día del servidor', ['abc_iniciar_cierre_sesion_caja', 'abc_confirmar_cierre_provisional', 'abc_finalizar_cierre_sesion_caja'].every((n) => env.llamadas(n)[0]?.params.p_operating_day === '2031-01-15'), s.llamadas.map((c) => c.nombre));
    ok('A2.5 la pantalla no escribe en tablas: solo lee las del cierre', env.srv.estado.lecturas.every((l) => ['terminales_tpv', 'caja_sesion_terminales', 'caja_sesiones', 'tpv_estaciones_preparacion', 'tpv_producto_estaciones'].includes(l.tabla)), [...new Set(s.lecturas.map((l) => l.tabla))]);
  }
  {
    // A3: una cuenta guardada de otro día en el navegador no cambia el día del cierre
    const env = await preparar(entorno({ diaServidor: '2031-01-15' }));
    const u = () => globalThis.crypto.randomUUID();
    localStorage.setItem(`la_suite_a02_1_ultima_cuenta_v1:${env.E}:${env.L}`, JSON.stringify({ schemaVersion: 1, empresaId: env.E, localId: env.L, cuentaId: u(), cuentaVersion: 1, pedidoId: u(), pedidoVersion: 1, pedidoEstado: 'ABIERTO', terminalId: env.s.ids.T, sessionId: env.s.ids.S, operatingDay: '2020-02-02', currencyCode: 'EUR', lineas: [{ lineaId: u(), productoId: 'p1', lineaVersion: 1, estado: 'BORRADOR', cantidad: 1, total: 1 }] }));
    await env.A.iniciarCierreSesionCajaA10();
    ok('A3.1 una cuenta antigua guardada en el navegador no cambia el día del cierre', env.llamadas('abc_iniciar_cierre_sesion_caja')[0]?.params.p_operating_day === '2031-01-15', env.s.llamadas.map((c) => c.params));
  }
  {
    // A4: consultar el estado del cierre
    const env = await preparar(entorno({ esperado: 10 }));
    const { A, s } = env;
    let c = await A.consultarCierreCajaA10();
    ok('A4.1 con la caja abierta: sesión ABIERTA y no pide la diferencia', c.ok && c.sessionEstado === 'ABIERTA' && env.llamadas('abc_obtener_diferencia_caja').length === 0, c);
    ok('A4.1b consultar no pide el día operativo', env.llamadas('abc_obtener_dia_operativo_local').length === 0, s.llamadas.map((x) => x.nombre));
    await A.iniciarCierreSesionCajaA10();
    c = await A.consultarCierreCajaA10();
    ok('A4.2 con el cierre iniciado: EN_CIERRE', c.ok && c.sessionEstado === 'EN_CIERRE', c);
    await A.confirmarCierreProvisionalA10({ efectivoContado: 8 });
    c = await A.consultarCierreCajaA10();
    ok('A4.3 en cierre provisional trae la diferencia (contado 8, esperado 10 → -2)', c.ok && c.sessionEstado === 'CIERRE_PROVISIONAL' && c.difference === -2 && c.expected_amount === 10 && c.counted_amount === 8 && c.umbral === 0, c);
    ok('A4.4 y los bloqueos: falta el motivo', JSON.stringify(c.bloqueos) === '["DIFERENCIA_SIN_MOTIVO"]' && c.requiere_aprobacion === true && c.registro === null, c);
    const dif = env.llamadas('abc_obtener_diferencia_caja')[0];
    ok('A4.5 la consulta lleva los parámetros exactos', JSON.stringify(dif?.params) === JSON.stringify({ p_empresa_id: env.E, p_local_id: env.L, p_session_id: s.ids.S }), dif);
  }
  {
    // A5: motivo y aprobación (el Propietario aprueba)
    const env = await preparar(entorno({ esperado: 10, rol: 'Cajero/a' }));
    const { A, s } = env;
    await hastaProvisional(env, 8);
    let f = await A.finalizarCierreSesionCajaA10();
    ok('A5.1 finalizar con la diferencia sin tratar se rechaza con un texto claro en español', f.ok === false && /diferencia de caja está sin tratar/.test(f.error) && !/cierre_definitivo/.test(f.error), f);
    ok('A5.2 la sesión sigue en cierre provisional', s.sesiones[0].estado === 'CIERRE_PROVISIONAL', s.sesiones[0]);
    let r = await A.registrarDiferenciaCajaA10({ motivo: '   ' });
    ok('A5.3 el motivo en blanco ni siquiera se envía', r.ok === false && /motivo de la diferencia/.test(r.error) && env.llamadas('abc_registrar_diferencia_caja').length === 0, r);
    r = await A.registrarDiferenciaCajaA10({ motivo: '  Se dio mal un cambio  ' });
    const reg = env.llamadas('abc_registrar_diferencia_caja')[0];
    ok('A5.4 registrar el motivo (recortado) con los parámetros exactos', r.ok === true && reg?.params.p_motivo === 'Se dio mal un cambio' && reg.params.p_session_id === s.ids.S && reg.params.p_empresa_id === env.E && reg.params.p_local_id === env.L && Object.keys(reg.params).length === 5, reg);
    ok('A5.5 el identificador de operación es válido y es de la 6d', OPERACION.test(reg?.params.p_operation_id) && reg.params.p_operation_id.startsWith('f6.ui.cash.diff.register.'), reg?.params.p_operation_id);
    ok('A5.6 queda pendiente de la aprobación del Propietario', JSON.stringify(r.bloqueos) === '["DIFERENCIA_PENDIENTE_APROBACION"]' && r.requiere_aprobacion === true, r);
    f = await A.finalizarCierreSesionCajaA10();
    ok('A5.7 con la aprobación pendiente tampoco se puede finalizar', f.ok === false && s.sesiones[0].estado === 'CIERRE_PROVISIONAL', f);
    let d = await A.decidirDiferenciaCajaA10({ decision: 'APROBAR', motivo: 'Lo apruebo' });
    ok('A5.8 un Cajero/a no puede aprobar: mensaje en español', d.ok === false && /Solo el Propietario puede aprobar o rechazar/.test(d.error), d);
    s.rol = 'Propietario';
    d = await A.decidirDiferenciaCajaA10({ decision: 'aprobar', motivo: '  Visto  ' });
    const dec = env.llamadas('abc_decidir_diferencia_caja').slice(-1)[0];
    ok('A5.9 el Propietario aprueba (decisión en mayúsculas, motivo recortado) con los parámetros exactos', d.ok === true && dec?.params.p_decision === 'APROBAR' && dec.params.p_motivo === 'Visto' && dec.params.p_session_id === s.ids.S && Object.keys(dec.params).length === 6, dec);
    ok('A5.10 el identificador de operación de la decisión es válido y es de la 6d', OPERACION.test(dec?.params.p_operation_id) && dec.params.p_operation_id.startsWith('f6.ui.cash.diff.decide.'), dec?.params.p_operation_id);
    ok('A5.11 sin bloqueos tras aprobar', JSON.stringify(d.bloqueos) === '[]', d);
    f = await A.finalizarCierreSesionCajaA10();
    ok('A5.12 ahora sí se finaliza el cierre con diferencia', f.ok === true && s.sesiones[0].estado === 'CERRADA_FINAL', f);
    ok('A5.13 no se inventa ningún movimiento de caja: la pantalla solo llamó a funciones del cierre', s.llamadas.every((c) => /cierre|diferencia|dia_operativo|obtener_capacidades/.test(c.nombre)), s.llamadas.map((c) => c.nombre));
  }
  {
    // A6: el Propietario rechaza → hay que reabrir y recontar
    const env = await preparar(entorno({ esperado: 10, rol: 'Propietario' }));
    const { A, s } = env;
    await hastaProvisional(env, 12);
    await A.registrarDiferenciaCajaA10({ motivo: 'Sobran 2 €' });
    const d = await A.decidirDiferenciaCajaA10({ decision: 'RECHAZAR', motivo: 'Vuelve a contar' });
    ok('A6.1 rechazar deja el bloqueo DIFERENCIA_RECHAZADA', d.ok && JSON.stringify(d.bloqueos) === '["DIFERENCIA_RECHAZADA"]', d);
    const f = await A.finalizarCierreSesionCajaA10();
    ok('A6.2 no se puede finalizar', f.ok === false && s.sesiones[0].estado === 'CIERRE_PROVISIONAL', f);
    const r = await A.reabrirCierreProvisionalA10({ motivo: 'Recontar' });
    ok('A6.3 el Propietario reabre el cierre (y usa el día del servidor)', r.ok && s.sesiones[0].estado === 'ABIERTA' && env.llamadas('abc_reabrir_cierre_provisional')[0]?.params.p_operating_day === '2026-10-02', r);
    const r2 = await A.decidirDiferenciaCajaA10({ decision: 'APROBAR', motivo: 'x' });
    ok('A6.4 tras reabrir ya no hay cierre provisional que decidir: mensaje en español', r2.ok === false && /ya no está en estado provisional/.test(r2.error), r2);
  }
  {
    // A7: por debajo del umbral no hace falta aprobación
    const env = await preparar(entorno({ esperado: 10, umbral: 5, rol: 'Cajero/a' }));
    const { A, s } = env;
    await hastaProvisional(env, 8);
    const r = await A.registrarDiferenciaCajaA10({ motivo: 'Redondeo' });
    ok('A7.1 una diferencia dentro del umbral solo necesita el motivo', r.ok && r.requiere_aprobacion === false && JSON.stringify(r.bloqueos) === '[]', r);
    s.rol = 'Propietario';
    const d = await A.decidirDiferenciaCajaA10({ decision: 'APROBAR', motivo: 'x' });
    ok('A7.2 decidirla no procede: mensaje claro', d.ok === false && /no supera el umbral/.test(d.error), d);
    const f = await A.finalizarCierreSesionCajaA10();
    ok('A7.3 se finaliza', f.ok && s.sesiones[0].estado === 'CERRADA_FINAL', f);
  }
  {
    // A8: errores del contexto
    let env = await preparar(entorno({ rol: 'Camarero/a' }));
    let r = await env.A.iniciarCierreSesionCajaA10();
    ok('A8.1 quien no opera la caja: el servidor rechaza el día operativo y se explica', r.ok === false && /permiso/.test(r.error), r);
    env = await preparar(entorno());
    env.s.vinculos.push({ empresa_id: env.E, local_id: env.L, session_id: globalThis.crypto.randomUUID(), terminal_id: env.s.ids.T, desde: '2026-10-02T20:00:00Z', hasta: null });
    r = await env.A.consultarCierreCajaA10();
    ok('A8.2 dos sesiones vinculadas al terminal: se bloquea', r.ok === false && /más de una sesión activa/.test(r.error), r);
    env = await preparar(entorno());
    env.s.vinculos[0].hasta = '2026-10-02T21:00:00Z';
    r = await env.A.consultarCierreCajaA10();
    ok('A8.3 sin sesión vinculada: «no tiene una sesión de caja abierta»', r.ok === false && /no tiene una sesión de caja abierta/.test(r.error), r);
    env = await preparar(entorno());
    env.s.sesiones[0].estado = 'CERRADA_FINAL';
    r = await env.A.consultarCierreCajaA10();
    ok('A8.4 una sesión ya cerrada no se trata como activa', r.ok === false, r);
    env = await preparar(entorno());
    env.s.fallos.abc_obtener_dia_operativo_local = 'dia_operativo_local_no_disponible';
    r = await env.A.iniciarCierreSesionCajaA10();
    ok('A8.5 si el servidor no da el día, el cierre no empieza ni inventa uno', r.ok === false && env.s.sesiones[0].estado === 'ABIERTA' && env.llamadas('abc_iniciar_cierre_sesion_caja').length === 0 && /local no está disponible/.test(r.error), r);
    env = await preparar(entorno());
    env.s.diaServidor = 'no-es-una-fecha';
    r = await env.A.iniciarCierreSesionCajaA10();
    ok('A8.6 un día mal formado se rechaza antes de llamar al cierre', r.ok === false && env.llamadas('abc_iniciar_cierre_sesion_caja').length === 0, r);
    env = await preparar(entorno());
    r = await env.A.decidirDiferenciaCajaA10({ decision: 'QUIZAS', motivo: 'x' });
    ok('A8.7 una decisión que no es aprobar ni rechazar no se envía', r.ok === false && env.llamadas('abc_decidir_diferencia_caja').length === 0, r);
    r = await env.A.decidirDiferenciaCajaA10({ decision: 'APROBAR', motivo: ' ' });
    ok('A8.8 sin motivo la decisión no se envía', r.ok === false && env.llamadas('abc_decidir_diferencia_caja').length === 0, r);
  }

  // ================= Parte B · la pantalla de cierre =================
  let raiz = null;
  async function montar(env, props = {}) {
    if (raiz) { await act(async () => { raiz.unmount(); }); raiz = null; }
    document.getElementById('raiz').innerHTML = '';
    raiz = createRoot(document.getElementById('raiz'));
    const A = env.A;
    const p = {
      productos: [], local: { id: env.L }, configEmpresa: { id: env.E }, listarEstacionesA10: A, rolPerfil: env.s.rol,
      listarComandasA10: async () => ({ ok: true, comandas: [] }), crearEstacionA10: async () => ({ ok: true }), actualizarEstacionA10: async () => ({ ok: true }),
      asignarProductoEstacionA10: async () => ({ ok: true }), enviarCambioComandaA10: async () => ({ ok: true }), reimprimirComandaA10: async () => ({ ok: true }), resolverMermaComandaA10: async () => ({ ok: true }),
      ...props
    };
    await act(async () => { raiz.render(React.createElement(mod.CocinaA10, p)); });
    await esperar(30);
  }
  const contado = () => document.querySelector('input[type=number][step="0.01"]');
  async function cerrarHastaProvisional(env, valor) {
    await clic(boton('Iniciar cierre'));
    await escribir(contado(), String(valor));
    await clic(boton('Confirmar cierre provisional'));
  }

  {
    // B1: cierre sin diferencia, sin cuenta abierta en el navegador
    const env = entorno({ esperado: 0, rol: 'Cajero/a' });
    await montar(env);
    ok('B1.1 con la caja abierta se ve «Iniciar cierre» y no «Abrir sesión de caja»', !!boton('Iniciar cierre') && !texto().includes('Abrir sesión de caja'), texto().slice(0, 400));
    await clic(boton('Iniciar cierre'));
    ok('B1.2 iniciar el cierre ya no da el aviso del pedido real', !texto().includes('Abre o recupera primero un pedido real') && texto().includes('EN_CIERRE') && !!contado(), texto().slice(0, 500));
    await escribir(contado(), '0');
    await clic(boton('Confirmar cierre provisional'));
    ok('B1.3 el provisional se registra y no sale ningún aviso rojo', texto().includes('CIERRE_PROVISIONAL') && !document.querySelector('[role=alert]'), texto().slice(0, 600));
    ok('B1.4 sin diferencia no hay caja de diferencia y se puede finalizar', !document.querySelector('[data-diferencia-caja]') && boton('Finalizar cierre') && !boton('Finalizar cierre').disabled, texto().slice(0, 600));
    ok('B1.5 el texto dice que se puede finalizar o reabrir (sin diferencia)', texto().includes('Puedes finalizarlo o reabrirlo con motivo.'), texto().slice(0, 600));
    await clic(boton('Finalizar cierre'));
    ok('B1.6 finalizar cierra la sesión y pide abrir otra', env.s.sesiones[0].estado === 'CERRADA_FINAL' && texto().includes('Sesión cerrada definitivamente') && texto().includes('Abrir sesión de caja'), texto().slice(0, 700));
  }
  {
    // B2: diferencia, el Cajero/a registra el motivo y espera al Propietario; luego el Propietario aprueba
    const env = entorno({ esperado: 10, rol: 'Cajero/a' });
    await montar(env);
    await cerrarHastaProvisional(env, 8);
    ok('B2.1 aparece la diferencia con contado, esperado y diferencia', !!document.querySelector('[data-diferencia-caja]') && texto().includes('Diferencia de caja: €-2.00 (contado €8.00, esperado €10.00)'), texto().slice(0, 900));
    ok('B2.2 el mensaje pide registrar el motivo y explica el umbral', texto().includes('Hay una diferencia: registra su motivo antes de finalizar.') && texto().includes('supera el umbral de €0.00'), texto().slice(0, 900));
    ok('B2.3 «Finalizar cierre» está desactivado y «Registrar motivo» también hasta escribir', boton('Finalizar cierre').disabled && boton('Registrar motivo').disabled, texto().slice(0, 600));
    await escribir(campo('Motivo de la diferencia'), 'Cambio mal dado');
    ok('B2.4 al escribir el motivo se activa «Registrar motivo»', !boton('Registrar motivo').disabled, null);
    await clic(boton('Registrar motivo'));
    ok('B2.5 el motivo queda registrado en el servidor', env.s.registros.length === 1 && env.s.registros[0].motivo === 'Cambio mal dado' && texto().includes('Motivo registrado: «Cambio mal dado»'), texto().slice(0, 900));
    ok('B2.6 el Cajero/a ve «Pendiente de aprobación del Propietario» y no los botones de decidir', texto().includes('Pendiente de aprobación del Propietario') && !boton('Aprobar diferencia') && !boton('Rechazar diferencia'), texto().slice(0, 900));
    ok('B2.7 «Finalizar cierre» sigue desactivado', boton('Finalizar cierre').disabled, null);
    // el Propietario entra en el mismo terminal
    env.s.rol = 'Propietario';
    await montar(env, { rolPerfil: 'Propietario' });
    ok('B2.8 recargar la pantalla en cierre provisional recupera el estado del servidor (no vuelve a «ABIERTA»)', texto().includes('CIERRE_PROVISIONAL') && !boton('Iniciar cierre') && !texto().includes('Abrir sesión de caja') && texto().includes('Motivo registrado: «Cambio mal dado»'), texto().slice(0, 900));
    ok('B2.9 el Propietario ve «Aprobar diferencia» y «Rechazar diferencia», desactivados hasta escribir su motivo', !!boton('Aprobar diferencia') && !!boton('Rechazar diferencia') && boton('Aprobar diferencia').disabled && boton('Rechazar diferencia').disabled, texto().slice(0, 900));
    await escribir(campo('Motivo de tu decisión'), 'Visto bueno');
    await clic(boton('Aprobar diferencia'));
    ok('B2.10 aprobada: lo dice, se activa «Finalizar cierre» y desaparecen los botones de decidir', texto().includes('Aprobada por el Propietario: «Visto bueno»') && !boton('Aprobar diferencia') && !boton('Finalizar cierre').disabled, texto().slice(0, 900));
    await clic(boton('Finalizar cierre'));
    ok('B2.11 se finaliza el cierre con diferencia', env.s.sesiones[0].estado === 'CERRADA_FINAL' && texto().includes('Sesión cerrada definitivamente') && !document.querySelector('[data-diferencia-caja]'), texto().slice(0, 700));
  }
  {
    // B3: rechazo y reapertura
    const env = entorno({ esperado: 10, rol: 'Propietario' });
    await montar(env);
    await cerrarHastaProvisional(env, 12);
    await escribir(campo('Motivo de la diferencia'), 'Sobran 2 euros');
    await clic(boton('Registrar motivo'));
    await escribir(campo('Motivo de tu decisión'), 'Cuenta otra vez');
    await clic(boton('Rechazar diferencia'));
    ok('B3.1 rechazada: lo dice, «Finalizar cierre» sigue desactivado y no hay botones de decidir', texto().includes('Rechazada por el Propietario: «Cuenta otra vez»') && texto().includes('reabre el cierre y vuelve a contar') && boton('Finalizar cierre').disabled && !boton('Aprobar diferencia'), texto().slice(0, 900));
    ok('B3.2 el Propietario puede reabrir', !!boton('Reabrir cierre provisional'), texto().slice(-300));
    await escribir(document.querySelector('input[placeholder="Ajuste de arqueo…"]'), 'Recontar');
    await clic(boton('Reabrir cierre provisional'));
    ok('B3.3 reabrir devuelve la caja a ABIERTA y quita la caja de diferencia', env.s.sesiones[0].estado === 'ABIERTA' && !document.querySelector('[data-diferencia-caja]') && !!boton('Iniciar cierre'), texto().slice(0, 700));
    await cerrarHastaProvisional(env, 10);
    ok('B3.4 el segundo cierre (contado 10) no tiene diferencia y se puede finalizar', !document.querySelector('[data-diferencia-caja]') && !boton('Finalizar cierre').disabled, texto().slice(0, 700));
  }
  {
    // B4: recuperar el cierre iniciado tras recargar
    const env = entorno({ esperado: 0, rol: 'Cajero/a' });
    await env.A.iniciarCierreSesionCajaA10();
    await montar(env);
    ok('B4.1 con el cierre ya iniciado la pantalla muestra el efectivo contado (no «Iniciar cierre» ni «Abrir sesión»)', !!contado() && !boton('Iniciar cierre') && !texto().includes('Abrir sesión de caja') && texto().includes('EN_CIERRE'), texto().slice(0, 600));
    await escribir(contado(), '0');
    await clic(boton('Confirmar cierre provisional'));
    ok('B4.2 y se puede continuar hasta el provisional', texto().includes('CIERRE_PROVISIONAL'), texto().slice(0, 500));
  }
  {
    // B5: errores del servidor
    const env = entorno({ esperado: 10, rol: 'Cajero/a' });
    await montar(env);
    await cerrarHastaProvisional(env, 8);
    await clic(boton('Registrar motivo').disabled ? null : boton('Registrar motivo')).catch(() => {});
    ok('B5.1 con el motivo vacío el botón no hace nada (no hay llamada al servidor)', env.llamadas('abc_registrar_diferencia_caja').length === 0, null);
    env.s.fallos.abc_registrar_diferencia_caja = 'diferencia_caja_cambiada';
    await escribir(campo('Motivo de la diferencia'), 'Algo');
    await clic(boton('Registrar motivo'));
    ok('B5.2 un error del servidor se muestra traducido y no deja un motivo falso', !!document.querySelector('[role=alert]') && texto().includes('La diferencia cambió desde que se registró el motivo') && env.s.registros.length === 0, texto().slice(0, 900));
    ok('B5.3 el motivo escrito se conserva para reintentar', campo('Motivo de la diferencia').value === 'Algo', campo('Motivo de la diferencia')?.value);
    delete env.s.fallos.abc_registrar_diferencia_caja;
    await clic(boton('Registrar motivo'));
    ok('B5.4 reintentar funciona', env.s.registros.length === 1 && texto().includes('Motivo registrado: «Algo»'), texto().slice(0, 700));
  }
  {
    // B6: si la pantalla no sabía de la diferencia, el rechazo del servidor la enseña
    const env = entorno({ esperado: 10, rol: 'Cajero/a' });
    await montar(env);
    await clic(boton('Iniciar cierre'));
    env.s.fallos.abc_obtener_diferencia_caja = 'abc_caja_no_autorizado';
    await escribir(contado(), '8');
    await clic(boton('Confirmar cierre provisional'));
    ok('B6.1 si no se puede leer la diferencia, la pantalla funciona como antes (decide el servidor)', texto().includes('CIERRE_PROVISIONAL') && !document.querySelector('[data-diferencia-caja]') && !boton('Finalizar cierre').disabled, texto().slice(0, 700));
    delete env.s.fallos.abc_obtener_diferencia_caja;
    await clic(boton('Finalizar cierre'));
    ok('B6.2 al finalizar, el servidor la rechaza y se explica en español', !!document.querySelector('[role=alert]') && texto().includes('la diferencia de caja está sin tratar') && env.s.sesiones[0].estado === 'CIERRE_PROVISIONAL', texto().slice(0, 900));
    ok('B6.3 tras el rechazo la pantalla recupera sola la diferencia y pide el motivo (sin pulsar «Actualizar»)', !!document.querySelector('[data-diferencia-caja]') && !!campo('Motivo de la diferencia') && boton('Finalizar cierre').disabled, texto().slice(0, 900));
  }
  {
    // B7: reabrir respeta el permiso (6f) y los botones de diferencia no dependen de él
    const env = entorno({ esperado: 10, rol: 'Cajero/a', rolesReabrir: ['Propietario'] });
    await montar(env);
    await cerrarHastaProvisional(env, 8);
    ok('B7.1 el Cajero/a sin permiso de reabrir no ve «Reabrir» pero sí la diferencia', !boton('Reabrir cierre provisional') && !!document.querySelector('[data-diferencia-caja]'), texto().slice(0, 900));
  }
  {
    // B8: una diferencia dentro del umbral solo pide el motivo
    const env = entorno({ esperado: 10, umbral: 5, rol: 'Cajero/a' });
    await montar(env);
    await cerrarHastaProvisional(env, 8);
    ok('B8.1 se explica que no supera el umbral', texto().includes('no supera el umbral de €5.00') && texto().includes('no necesita aprobación'), texto().slice(0, 700));
    await escribir(campo('Motivo de la diferencia'), 'Redondeo');
    await clic(boton('Registrar motivo'));
    ok('B8.2 tras el motivo se puede finalizar sin aprobación', texto().includes('Motivo guardado. Ya se puede finalizar el cierre.') && !boton('Finalizar cierre').disabled && !boton('Aprobar diferencia'), texto().slice(0, 800));
    await clic(boton('Finalizar cierre'));
    ok('B8.3 finaliza', env.s.sesiones[0].estado === 'CERRADA_FINAL', env.s.sesiones[0]);
  }
  {
    // B9: compatibilidad: una pantalla sin las funciones nuevas (versión antigua de la lógica) sigue funcionando
    const env = entorno({ esperado: 0, rol: 'Cajero/a' });
    const antigua = async () => ({ ok: true, estaciones: [], rutas: [] });
    antigua.iniciarCierreSesionCajaA10 = env.A.iniciarCierreSesionCajaA10;
    antigua.confirmarCierreProvisionalA10 = env.A.confirmarCierreProvisionalA10;
    antigua.finalizarCierreSesionCajaA10 = env.A.finalizarCierreSesionCajaA10;
    antigua.reabrirCierreProvisionalA10 = env.A.reabrirCierreProvisionalA10;
    await montar(env, { listarEstacionesA10: antigua });
    await cerrarHastaProvisional(env, 0);
    ok('B9.1 sin las funciones de diferencia la pantalla actúa como antes (sin errores)', texto().includes('CIERRE_PROVISIONAL') && !document.querySelector('[role=alert]') && !!boton('Finalizar cierre'), texto().slice(0, 600));
  }
  {
    // B10: la diferencia cambia después de registrar el motivo: hay que registrarlo de nuevo
    const env = entorno({ esperado: 10, rol: 'Cajero/a' });
    await montar(env);
    await cerrarHastaProvisional(env, 8);
    await escribir(campo('Motivo de la diferencia'), 'Primer motivo');
    await clic(boton('Registrar motivo'));
    env.s.esperado = 11;
    await clic(boton('Actualizar'));
    ok('B10.1 si la diferencia cambió desde el motivo, se avisa y se pide registrarlo de nuevo', texto().includes('La diferencia cambió desde que se registró el motivo') && !!campo('Motivo de la diferencia') && boton('Finalizar cierre').disabled, texto().slice(0, 900));
    await escribir(campo('Motivo de la diferencia'), 'Segundo motivo');
    await clic(boton('Registrar motivo'));
    ok('B10.2 el nuevo motivo sustituye al anterior y vuelve a quedar pendiente de aprobación', env.s.registros[0].motivo === 'Segundo motivo' && texto().includes('Pendiente de aprobación del Propietario'), texto().slice(0, 900));
  }
  {
    // B11: recargar con la diferencia ya aprobada: se puede finalizar
    const env = entorno({ esperado: 10, rol: 'Propietario' });
    await montar(env);
    await cerrarHastaProvisional(env, 8);
    await escribir(campo('Motivo de la diferencia'), 'Cambio mal dado');
    await clic(boton('Registrar motivo'));
    await escribir(campo('Motivo de tu decisión'), 'Visto bueno');
    await clic(boton('Aprobar diferencia'));
    await montar(env);
    ok('B11.1 tras recargar, la diferencia aprobada se muestra y «Finalizar cierre» está activo', texto().includes('Aprobada por el Propietario: «Visto bueno»') && !boton('Finalizar cierre').disabled && !boton('Aprobar diferencia'), texto().slice(0, 900));
    await montar(env, { rolPerfil: 'Cajero/a' });
    ok('B11.2 el Cajero/a que recarga también ve que está aprobada y puede finalizar', texto().includes('Aprobada por el Propietario') && !boton('Finalizar cierre').disabled, texto().slice(0, 700));
  }
  {
    // B12: sin sesión vinculada se pide abrir sesión; si otro dispositivo deja un cierre en marcha, «Actualizar» lo recupera
    const env = entorno({ esperado: 0, rol: 'Cajero/a' });
    env.s.vinculos[0].hasta = '2026-10-02T21:00:00Z';
    await montar(env);
    ok('B12.1 sin sesión vinculada se pide abrir sesión', texto().includes('Abrir sesión de caja'), texto().slice(0, 500));
    const nueva = globalThis.crypto.randomUUID();
    env.s.sesiones.push({ id: nueva, empresa_id: env.E, local_id: env.L, estado: 'EN_CIERRE', version: 2, caja_id: env.s.ids.C });
    env.s.vinculos.push({ empresa_id: env.E, local_id: env.L, session_id: nueva, terminal_id: env.s.ids.T, desde: '2026-10-02T21:30:00Z', hasta: null });
    await clic(boton('Actualizar'));
    ok('B12.2 «Actualizar» recupera el cierre en marcha y deja de pedir abrir sesión', !texto().includes('Abrir sesión de caja') && texto().includes('EN_CIERRE') && !!contado(), texto().slice(0, 600));
  }
  {
    // B12b: lo escrito y no enviado no se arrastra al reabrir el cierre
    const env = entorno({ esperado: 10, rol: 'Propietario' });
    await montar(env);
    await cerrarHastaProvisional(env, 12);
    await escribir(campo('Motivo de la diferencia'), 'texto sin enviar');
    await escribir(document.querySelector('input[placeholder="Ajuste de arqueo…"]'), 'Recontar');
    await clic(boton('Reabrir cierre provisional'));
    await cerrarHastaProvisional(env, 13);
    ok('B12b.1 tras reabrir, el motivo escrito y no enviado no reaparece', campo('Motivo de la diferencia')?.value === '', campo('Motivo de la diferencia')?.value);
    await escribir(campo('Motivo de la diferencia'), 'segundo cierre');
    await clic(boton('Registrar motivo'));
    ok('B12b.2 y el campo de la decisión también está vacío', campo('Motivo de tu decisión')?.value === '', campo('Motivo de tu decisión')?.value);
  }
  {
    // B13: otro dispositivo ya decidió la diferencia: el error se explica y la pantalla se actualiza sola
    const env = entorno({ esperado: 10, rol: 'Cajero/a' });
    await montar(env);
    await cerrarHastaProvisional(env, 8);
    const cierre = env.s.cierres.find((c) => c.estado === 'PROVISIONAL');
    env.s.registros.push({ cierre_id: cierre.id, estado: 'APROBADA', difference: -2, motivo: 'Del otro dispositivo', requiere_aprobacion: true, decision_motivo: 'Ok' });
    await escribir(campo('Motivo de la diferencia'), 'Mi motivo');
    await clic(boton('Registrar motivo'));
    ok('B13.1 si otro dispositivo ya la decidió, se explica y la pantalla se actualiza sola', texto().includes('ya decidió esta diferencia') && texto().includes('Aprobada por el Propietario: «Ok»') && !boton('Finalizar cierre').disabled, texto().slice(0, 900));
  }
  {
    // B13b: el Propietario decide con datos viejos: se explica y se actualiza
    const env = entorno({ esperado: 10, rol: 'Propietario' });
    await montar(env);
    await cerrarHastaProvisional(env, 8);
    await escribir(campo('Motivo de la diferencia'), 'Cambio mal dado');
    await clic(boton('Registrar motivo'));
    env.s.registros[0].estado = 'RECHAZADA'; env.s.registros[0].decision_motivo = 'Otro dispositivo';
    await escribir(campo('Motivo de tu decisión'), 'Lo apruebo');
    await clic(boton('Aprobar diferencia'));
    ok('B13b.1 decidir con datos viejos: el error se explica y se muestra el estado real', texto().includes('ya decidió esta diferencia') && texto().includes('Rechazada por el Propietario: «Otro dispositivo»') && !boton('Aprobar diferencia') && boton('Finalizar cierre').disabled, texto().slice(0, 900));
  }
  {
    // B13c: otro dispositivo reabrió el cierre: la pantalla vuelve a ABIERTA al explicar el error
    const env = entorno({ esperado: 10, rol: 'Cajero/a' });
    await montar(env);
    await cerrarHastaProvisional(env, 8);
    env.s.sesiones[0].estado = 'ABIERTA';
    await escribir(campo('Motivo de la diferencia'), 'Motivo');
    await clic(boton('Registrar motivo'));
    ok('B13c.1 si el cierre ya no está en provisional, se explica y la pantalla vuelve al estado real (ABIERTA)', texto().includes('ya no está en estado provisional') && !!boton('Iniciar cierre') && !document.querySelector('[data-diferencia-caja]'), texto().slice(0, 700));
  }
  {
    // B14: si no se puede leer la diferencia al actualizar, no se pierde lo que ya se sabía
    const env = entorno({ esperado: 10, rol: 'Cajero/a' });
    await montar(env);
    await cerrarHastaProvisional(env, 8);
    env.s.fallos.abc_obtener_diferencia_caja = 'abc_caja_no_autorizado';
    await clic(boton('Actualizar'));
    ok('B14.1 si falla la lectura de la diferencia, la pantalla conserva la que ya mostraba y bloquea «Finalizar cierre»', !!document.querySelector('[data-diferencia-caja]') && boton('Finalizar cierre').disabled && texto().includes('CIERRE_PROVISIONAL'), texto().slice(0, 700));
  }
} catch (e) {
  resultados.push({ nombre: 'ERROR FATAL', ok: false, det: String(e.stack || e).slice(0, 1200) });
}
const fallos = resultados.filter((r) => !r.ok);
console.log(JSON.stringify({ total: resultados.length, fallos: fallos.length, detalle: fallos }, null, 1).slice(0, 9000));
if (fallos.length) process.exit(1);
console.log('cfg6d-ui-runtime: OK');
