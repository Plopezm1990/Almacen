// Prueba de ejecución de la modalidad al abrir cuenta en el TPV (pieza 6e).
// Carga el módulo REAL de la aplicación (source-recovery/fuente-recuperado.js) con React 18 en un navegador simulado (jsdom) y un
// servidor falso en memoria (tests/cfg/lib/servidor-caja-falso.mjs) con la guarda de modalidades de la pieza 3:
//   Parte A · la lógica real (crearLogicaVenta): qué modalidad se abre, cómo se decide y qué pasa cuando el servidor la rechaza.
//   Parte B · el TPV real (VentaRapida): el selector «Tipo de cuenta» del carrito, lo que se envía y lo que se muestra.
//
// Necesita librerías que no están en el repositorio: CFG6_UI_DEPS (o CFG6E_UI_DEPS) = carpeta con node_modules que contenga
// react@18.3.1, react-dom@18.3.1 y jsdom. Por ejemplo:
//   mkdir /tmp/cfg6deps && cd /tmp/cfg6deps && npm init -y && npm i react@18.3.1 react-dom@18.3.1 jsdom
//   CFG6_UI_DEPS=/tmp/cfg6deps node tests/cfg/cfg6e-ui-runtime.mjs
// CFG6E_FUENTE (opcional) permite probar otro archivo (por ejemplo una variante rota en las comprobaciones de mutantes).
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
// React se carga DESPUÉS de crear el navegador simulado (si no, no detecta los eventos de escritura).
const React = require('react');
const { createRoot } = require('react-dom/client');
const act = React.act;

const REPO = resolve(new URL('../../', import.meta.url).pathname);
const origen = process.env.CFG6E_FUENTE || join(REPO, 'source-recovery/fuente-recuperado.js');

// ---------- carga del módulo real ----------
const lineas = readFileSync(origen, 'utf8').split('\n');
const ini = lineas.findIndex((l) => l.startsWith('import React'));
let fin = ini;
while (lineas[fin + 1].startsWith('import ')) fin += 1;
const iconos = lineas.slice(ini, fin + 1).find((l) => l.includes('lucide-react')).match(/\{([^}]*)\}/)[1].split(',').map((x) => x.trim().split(' as ').pop());
const stubs = { React, ReactNS: React, import_client2: { createRoot: () => ({ render() {}, unmount() {} }) }, createRoot: () => ({ render() {}, unmount() {} }), createClient: () => ({}), E: function () {}, autoTable: () => {}, XLSX: { utils: {}, writeFile() {}, writeFileSync() {} } };
// «X2» es el nombre con el que el bundle usa el icono X de lucide; el fuente recuperado lo usa sin importarlo con ese nombre.
const fabrica = new Function(...Object.keys(stubs), ...iconos, 'X2', lineas.slice(fin + 1).join('\n') + '\nreturn { crearLogicaVenta, VentaRapida };');
const mod = fabrica(...Object.values(stubs), ...iconos.map(() => () => null), () => null);

// ---------- utilidades ----------
const resultados = [];
const ok = (nombre, cond, det) => resultados.push({ nombre, ok: !!cond, det: cond ? undefined : det });
const esperar = async (ms = 0) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };
const texto = () => document.getElementById('raiz').textContent;
const boton = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t) || [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t));
async function clic(el) {
  if (!el) throw new Error('clic sobre un elemento que no existe; texto actual: ' + texto().slice(-600));
  await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  await esperar(40);
}
const OPERACION = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/;

function entorno(opciones = {}) {
  const srv = crearServidorFalso({ productos: [{ id: 'P1', precio: 1.5 }], ...opciones });
  dom.window.getSupabaseClient = async () => srv.cliente;
  dom.window.__nubeActiva = true;
  localStorage.clear();
  const { E, L } = srv.estado.ids;
  const productos = [{ id: 'P1', nombre: 'Agua 50 cl', activo: true, precioVenta: 1.5, stockPisoVenta: 10, categoria: 'Bebidas', empresaId: E, localId: L, tipo: 'reventa' }];
  const logica = mod.crearLogicaVenta({ productos, setProductos() {}, movimientos: [], setMovimientos() {}, arqueos: [], localActivoId: L, empresaDelLocalActivo: { id: E } });
  return { srv, s: srv.estado, logica, E, L, productos, llamadas: (n) => srv.estado.llamadas.filter((c) => c.nombre === n) };
}
const CARRITO = [{ productoId: 'P1', cantidad: 2 }];
const modalidadAbierta = (env) => env.llamadas('abc_abrir_cuenta').slice(-1)[0]?.params.p_modalidad;
const clavePendiente = (env) => Object.keys(localStorage).filter((k) => k.includes('pendiente') && k.includes(env.E) && k.includes(env.L));

try {
  // ================= Parte A · la lógica real =================
  {
    const env = entorno();
    const r = await env.logica.venderCarritoA02(CARRITO);
    ok('A1.1 con todo habilitado, la cuenta se abre en Barra (como hasta ahora)', r.ok === true && modalidadAbierta(env) === 'BARRA', r);
    ok('A1.2 el resultado dice en qué modalidad se abrió', r.modalidad === 'BARRA', r);
    ok('A1.3 la modalidad leída del servidor con los parámetros exactos', JSON.stringify(env.llamadas('abc_obtener_modalidades_local')[0]?.params) === JSON.stringify({ p_empresa_id: env.E, p_local_id: env.L }), env.llamadas('abc_obtener_modalidades_local'));
    const ab = env.llamadas('abc_abrir_cuenta')[0]?.params;
    ok('A1.4 la apertura envía exactamente los parámetros de siempre, con el día del servidor (null)', ab && ab.p_empresa_id === env.E && ab.p_local_id === env.L && ab.p_currency_code === 'EUR' && ab.p_operating_day === null && ab.p_terminal_id === env.s.ids.T && ab.p_session_id === env.s.ids.S && OPERACION.test(ab.p_operation_id) && Object.keys(ab).length === 10, ab);
    const ctx = JSON.parse(localStorage.getItem(`la_suite_a02_1_ultima_cuenta_v1:${env.E}:${env.L}`) || 'null');
    ok('A1.5 el contexto de la cuenta guarda la modalidad real', ctx?.modalidad === 'BARRA', ctx);
    ok('A1.6 la cuenta, el pedido y la línea quedan en el servidor', env.s.cuentas.length === 1 && env.s.cuentas[0].modalidad === 'BARRA' && env.s.pedidos.length === 1 && env.s.lineasPedido.length === 1, env.s.cuentas);
  }
  {
    // modalidad automática cuando Barra no está habilitada
    for (const [nombre, mods, esperada] of [
      ['A2.1 sin Barra, la primera habilitada es Mesa', { BARRA: false }, 'MESA'],
      ['A2.2 sin Barra ni Mesa, Terraza', { BARRA: false, MESA: false }, 'TERRAZA'],
      ['A2.3 sin Barra, Mesa ni Terraza, Para llevar', { BARRA: false, MESA: false, TERRAZA: false }, 'TAKEAWAY'],
      ['A2.4 solo Otro habilitada', { BARRA: false, MESA: false, TERRAZA: false, TAKEAWAY: false }, 'OTRO'],
      ['A2.5 solo Mesa habilitada (local solo de mesas)', { BARRA: false, TERRAZA: false, TAKEAWAY: false, OTRO: false }, 'MESA'],
      ['A2.6 Barra y Otro: gana Barra', { MESA: false, TERRAZA: false, TAKEAWAY: false }, 'BARRA']
    ]) {
      const env = entorno({ modalidades: mods });
      const r = await env.logica.venderCarritoA02(CARRITO);
      ok(nombre, r.ok === true && modalidadAbierta(env) === esperada && r.modalidad === esperada && env.s.cuentas[0]?.modalidad === esperada, { r, abierta: modalidadAbierta(env) });
    }
  }
  {
    // lista ilegible o vacía: como antes (Barra)
    let env = entorno({ modalidades: { BARRA: true } });
    env.s.fallos.abc_obtener_modalidades_local = 'abc_config_no_autorizado';
    let r = await env.logica.venderCarritoA02(CARRITO);
    ok('A3.1 si no se puede leer la lista, se abre en Barra como antes y decide el servidor', r.ok === true && modalidadAbierta(env) === 'BARRA', r);
    env = entorno();
    env.s.habilitadasForzadas = [];
    r = await env.logica.venderCarritoA02(CARRITO);
    ok('A3.2 una lista vacía se trata como ilegible', r.ok === true && modalidadAbierta(env) === 'BARRA', r);
    env = entorno();
    env.s.habilitadasForzadas = ['FREIDORA', 'TERRAZA'];
    r = await env.logica.venderCarritoA02(CARRITO);
    ok('A3.3 las modalidades desconocidas de la lista se ignoran', r.ok === true && modalidadAbierta(env) === 'TERRAZA', r);
    env = entorno({ modalidades: { BARRA: false } });
    env.s.fallos.abc_obtener_modalidades_local = 'error_de_red';
    r = await env.logica.venderCarritoA02(CARRITO);
    ok('A3.4 sin poder leer la lista y con Barra deshabilitada, el servidor rechaza y se explica en español', r.ok === false && /modalidad «Barra» no está habilitada/.test(r.error) && !/modalidad_no_habilitada/.test(r.error), r);
  }
  {
    // modalidad elegida
    let env = entorno();
    let r = await env.logica.venderCarritoA02(CARRITO, { modalidad: 'TAKEAWAY' });
    ok('A4.1 una modalidad habilitada elegida se respeta', r.ok === true && modalidadAbierta(env) === 'TAKEAWAY' && r.modalidad === 'TAKEAWAY', r);
    env = entorno({ modalidades: { MESA: false } });
    r = await env.logica.venderCarritoA02(CARRITO, { modalidad: 'MESA' });
    ok('A4.2 una modalidad deshabilitada elegida se rechaza sin llamar a abrir cuenta', r.ok === false && /modalidad «Mesa» no está habilitada/.test(r.error) && env.llamadas('abc_abrir_cuenta').length === 0 && env.s.cuentas.length === 0, r);
    ok('A4.3 y no deja un pedido pendiente atascado', clavePendiente(env).length === 0, clavePendiente(env));
    env = entorno();
    r = await env.logica.venderCarritoA02(CARRITO, { modalidad: 'FREIDORA' });
    ok('A4.4 una modalidad que no existe se ignora y se usa la automática', r.ok === true && modalidadAbierta(env) === 'BARRA', r);
    env = entorno();
    r = await env.logica.venderCarritoA02(CARRITO, 'Efectivo');
    ok('A4.5 una llamada con un segundo parámetro de otro tipo no rompe nada', r.ok === true && modalidadAbierta(env) === 'BARRA', r);
    env = entorno({ modalidades: { BARRA: false } });
    env.s.fallos.abc_obtener_modalidades_local = 'error_de_red';
    r = await env.logica.venderCarritoA02(CARRITO, { modalidad: 'OTRO' });
    ok('A4.6 sin poder leer la lista, la modalidad elegida se envía y decide el servidor', r.ok === true && modalidadAbierta(env) === 'OTRO', r);
  }
  {
    // el servidor rechaza una modalidad que la lista daba por habilitada (cambió entre la lectura y la apertura)
    const env = entorno({ modalidades: { MESA: false } });
    env.s.habilitadasForzadas = ['BARRA', 'MESA'];
    let r = await env.logica.venderCarritoA02(CARRITO, { modalidad: 'MESA' });
    ok('A5.1 el rechazo del servidor se explica con el nombre de la modalidad y se marca para recargar la lista', r.ok === false && r.modalidadNoHabilitada === true && /modalidad «Mesa» no está habilitada en este local/.test(r.error) && /Configuración/.test(r.error), r);
    ok('A5.2 no queda un pedido pendiente atascado y no se creó ninguna cuenta', clavePendiente(env).length === 0 && env.s.cuentas.length === 0, { claves: clavePendiente(env), cuentas: env.s.cuentas });
    env.s.habilitadasForzadas = null;
    r = await env.logica.venderCarritoA02(CARRITO, { modalidad: 'BARRA' });
    ok('A5.3 el reintento con otra modalidad abre la cuenta con identificadores nuevos', r.ok === true && modalidadAbierta(env) === 'BARRA' && env.s.cuentas.length === 1, r);
    const ids = env.llamadas('abc_abrir_cuenta').map((c) => c.params.p_operation_id);
    ok('A5.4 la segunda apertura usa otro identificador de operación', ids.length === 2 && ids[0] !== ids[1], ids);
    const env2 = entorno({ modalidades: { BARRA: false } });
    env2.s.fallos.abc_abrir_cuenta = 'modalidad_no_habilitada';
    const r2 = await env2.logica.venderCarritoA02(CARRITO);
    ok('A5.5 un rechazo sin nombre de modalidad también se explica', r2.ok === false && r2.error === 'Esa modalidad no está habilitada en este local.' && r2.modalidadNoHabilitada === true, r2);
  }
  {
    // un pedido pendiente conserva su modalidad
    const env = entorno();
    env.s.fallos.abc_abrir_cuenta = 'fallo_de_red_simulado';
    let r = await env.logica.venderCarritoA02(CARRITO, { modalidad: 'TERRAZA' });
    ok('A6.1 un fallo cualquiera deja el pedido pendiente para reintentar (con su modalidad)', r.ok === false && clavePendiente(env).length === 1 && JSON.parse(localStorage.getItem(clavePendiente(env)[0])).modalidad === 'TERRAZA', { r, claves: clavePendiente(env) });
    delete env.s.fallos.abc_abrir_cuenta;
    const lecturas = env.llamadas('abc_obtener_modalidades_local').length;
    r = await env.logica.venderCarritoA02(CARRITO, { modalidad: 'OTRO' });
    ok('A6.2 el reintento, aunque se pida otra modalidad, conserva la del pedido pendiente', r.ok === true && modalidadAbierta(env) === 'TERRAZA' && r.modalidad === 'TERRAZA', r);
    ok('A6.3 y no vuelve a leer la lista (no decide nada nuevo)', env.llamadas('abc_obtener_modalidades_local').length === lecturas, env.llamadas('abc_obtener_modalidades_local').length);
    const ids = env.llamadas('abc_abrir_cuenta').map((c) => c.params.p_operation_id);
    ok('A6.4 y reutiliza el mismo identificador de operación (no duplica la cuenta)', ids.length === 2 && ids[0] === ids[1] && env.s.cuentas.length === 1, ids);
  }
  {
    // lectura de la lista en situaciones raras: nunca rompe la apertura ni decide por su cuenta
    let env = entorno();
    env.s.lanzar.abc_obtener_modalidades_local = 'fallo_de_red_del_navegador';
    let r = await env.logica.venderCarritoA02(CARRITO);
    ok('A8.1 si leer la lista lanza una excepción, la apertura sigue y se abre en Barra', r.ok === true && modalidadAbierta(env) === 'BARRA', r);
    env = entorno();
    env.s.erroresConDatos.abc_obtener_modalidades_local = { data: { modalidades: [], habilitadas: ['MESA'] }, message: 'respuesta_a_medias' };
    r = await env.logica.venderCarritoA02(CARRITO);
    ok('A8.2 si el servidor contesta con error, se ignoran sus datos (no se decide con una respuesta a medias)', r.ok === true && modalidadAbierta(env) === 'BARRA', r);
    env = entorno();
    env.s.habilitadasForzadas = ['MESA', 'BARRA'];
    r = await env.logica.venderCarritoA02(CARRITO);
    ok('A8.3 Barra gana aunque la lista llegue en otro orden', r.ok === true && modalidadAbierta(env) === 'BARRA', r);
    env = entorno();
    env.s.habilitadasForzadas = ['TERRAZA', 'MESA', 'OTRO'];
    r = await env.logica.venderCarritoA02(CARRITO);
    ok('A8.4 sin Barra, gana la primera de la lista tal como la da el servidor', r.ok === true && modalidadAbierta(env) === 'TERRAZA', r);
  }
  {
    // el rechazo de modalidad solo se marca cuando es de modalidad, y no descarta un pedido cuya cuenta ya existe
    let env = entorno();
    env.s.fallos.abc_abrir_cuenta = 'fallo_de_red_simulado';
    let r = await env.logica.venderCarritoA02(CARRITO);
    ok('A9.1 un fallo que no es de modalidad no lleva la marca de recargar la lista', r.ok === false && !r.modalidadNoHabilitada, r);
    env = entorno();
    env.s.fallos.abc_crear_pedido = 'modalidad_no_habilitada:BARRA';
    r = await env.logica.venderCarritoA02(CARRITO);
    const claves = clavePendiente(env);
    const pend = claves.length === 1 ? JSON.parse(localStorage.getItem(claves[0])) : null;
    ok('A9.2 si el rechazo llega cuando la cuenta ya está abierta, el pedido pendiente NO se descarta (se perdería la cuenta)', r.ok === false && r.modalidadNoHabilitada === true && !!pend?.cuentaResultado && env.s.cuentas.length === 1, { r, claves, cuentas: env.s.cuentas });
  }
  {
    // lectura pública de las modalidades habilitadas
    let env = entorno({ modalidades: { MESA: false, OTRO: false } });
    let r = await env.logica.listarModalidadesA02();
    ok('A7.1 la lista pública devuelve las habilitadas en orden fijo', r.ok === true && JSON.stringify(r.habilitadas) === '["BARRA","TERRAZA","TAKEAWAY"]', r);
    env = entorno();
    dom.window.__nubeActiva = false;
    r = await env.logica.listarModalidadesA02();
    ok('A7.2 sin conexión: no es un error, simplemente no hay lista', r.ok === false && r.offline === true, r);
    env = entorno();
    env.s.fallos.abc_obtener_modalidades_local = 'abc_config_no_autorizado';
    r = await env.logica.listarModalidadesA02();
    ok('A7.3 si el servidor la rechaza, no hay lista', r.ok === false && !r.habilitadas, r);
  }

  // ================= Parte B · el TPV =================
  let raiz = null;
  async function montar(env, props = {}) {
    if (raiz) { await act(async () => { raiz.unmount(); }); raiz = null; }
    document.getElementById('raiz').innerHTML = '';
    raiz = createRoot(document.getElementById('raiz'));
    await act(async () => {
      raiz.render(React.createElement(mod.VentaRapida, {
        productos: env.productos, venderCarrito: env.logica.venderCarritoA02, listarModalidadesA02: env.logica.listarModalidadesA02,
        local: { id: env.L, nombre: 'Local A1' }, configEmpresa: { id: env.E }, movimientos: [], registrarAuditoria() {}, ...props
      }));
    });
    await esperar(80);
  }
  const selector = () => document.querySelector('[data-selector-modalidad]');
  const opciones = () => [...(selector()?.querySelectorAll('button') || [])].map((b) => ({ t: b.textContent, activa: b.getAttribute('aria-pressed') === 'true', desactivada: b.disabled }));
  async function anadirAgua(veces = 1) { for (let i = 0; i < veces; i++) await clic(boton('Agua 50 cl')); }

  {
    const env = entorno();
    await montar(env);
    ok('B1.1 con el carrito vacío no hay selector', !selector(), texto().slice(0, 300));
    await anadirAgua(2);
    ok('B1.2 con productos en el carrito y todo habilitado aparece «Tipo de cuenta» con las cinco modalidades', !!selector() && opciones().map((o) => o.t).join('|') === 'Barra|Mesa|Terraza|Para llevar|Otro', opciones());
    ok('B1.3 Barra viene elegida por defecto', opciones().filter((o) => o.activa).map((o) => o.t).join() === 'Barra', opciones());
    ok('B1.4 la lectura de modalidades usó los parámetros exactos', env.llamadas('abc_obtener_modalidades_local').some((c) => JSON.stringify(c.params) === JSON.stringify({ p_empresa_id: env.E, p_local_id: env.L })), env.llamadas('abc_obtener_modalidades_local'));
    await clic(boton('Para llevar'));
    ok('B1.5 elegir otra modalidad la marca y desmarca la anterior', opciones().filter((o) => o.activa).map((o) => o.t).join() === 'Para llevar', opciones());
    await clic(boton('Guardar pedido'));
    ok('B1.6 «Guardar pedido» abre la cuenta en la modalidad elegida', modalidadAbierta(env) === 'TAKEAWAY' && env.s.cuentas[0]?.modalidad === 'TAKEAWAY', { abierta: modalidadAbierta(env), cuentas: env.s.cuentas });
    ok('B1.7 la confirmación dice la modalidad', texto().includes('Pedido guardado') && texto().includes('Modalidad: Para llevar'), texto().slice(0, 700));
  }
  {
    // por defecto (sin tocar el selector): Barra
    const env = entorno();
    await montar(env);
    await anadirAgua(1);
    await clic(boton('Guardar pedido'));
    ok('B2.1 sin tocar el selector, la cuenta se abre en Barra', modalidadAbierta(env) === 'BARRA' && texto().includes('Modalidad: Barra'), { abierta: modalidadAbierta(env), t: texto().slice(0, 500) });
  }
  {
    // Barra deshabilitada: el selector ofrece las demás y la primera viene elegida
    const env = entorno({ modalidades: { BARRA: false } });
    await montar(env);
    await anadirAgua(1);
    ok('B3.1 sin Barra, el selector ofrece las otras cuatro', opciones().map((o) => o.t).join('|') === 'Mesa|Terraza|Para llevar|Otro', opciones());
    ok('B3.2 y viene elegida la primera (Mesa)', opciones().filter((o) => o.activa).map((o) => o.t).join() === 'Mesa', opciones());
    await clic(boton('Guardar pedido'));
    ok('B3.3 «Guardar pedido» funciona con Barra deshabilitada (antes: error y TPV bloqueado)', env.s.cuentas.length === 1 && env.s.cuentas[0].modalidad === 'MESA' && !/modalidad/i.test(texto().replace('Modalidad: Mesa', '')), { cuentas: env.s.cuentas, t: texto().slice(0, 500) });
  }
  {
    // una sola modalidad habilitada: no hay selector y se abre en ella
    const env = entorno({ modalidades: { BARRA: false, TERRAZA: false, TAKEAWAY: false, OTRO: false } });
    await montar(env);
    await anadirAgua(1);
    ok('B4.1 con una sola modalidad habilitada no se muestra el selector', !selector(), texto().slice(0, 400));
    await clic(boton('Guardar pedido'));
    ok('B4.2 y la cuenta se abre en esa modalidad', env.s.cuentas[0]?.modalidad === 'MESA' && texto().includes('Modalidad: Mesa'), { cuentas: env.s.cuentas });
  }
  {
    // la modalidad cambió mientras tanto: se explica, se recarga la lista y se puede elegir otra
    const env = entorno();
    await montar(env);
    await anadirAgua(1);
    await clic(boton('Mesa'));
    env.s.modalidades.MESA = false;
    env.s.habilitadasForzadas = null;
    await clic(boton('Guardar pedido'));
    ok('B5.1 si la modalidad elegida ya no está habilitada, se explica en la propia pantalla', texto().includes('La modalidad «Mesa» no está habilitada en este local') && env.s.cuentas.length === 0, texto().slice(0, 900));
    ok('B5.2 la lista del selector se recarga (ya no ofrece Mesa) y se puede elegir otra', !opciones().some((o) => o.t === 'Mesa') && opciones().length === 4, opciones());
    ok('B5.3 la modalidad elegida deja de estar marcada y se vuelve a la automática (Barra)', opciones().filter((o) => o.activa).map((o) => o.t).join() === 'Barra', opciones());
    await clic(boton('Guardar pedido'));
    ok('B5.4 reintentar abre la cuenta en Barra', env.s.cuentas.length === 1 && env.s.cuentas[0].modalidad === 'BARRA', { cuentas: env.s.cuentas, t: texto().slice(0, 500) });
  }
  {
    // los errores de «Guardar pedido» se ven en el carrito (antes solo se pintaban dentro de una ventana desactivada)
    const env = entorno();
    await montar(env);
    await anadirAgua(1);
    env.s.fallos.abc_abrir_cuenta = 'fallo_de_red_simulado';
    await clic(boton('Guardar pedido'));
    const alerta = document.querySelector('[data-error-venta]');
    ok('B9.1 un fallo al guardar el pedido se muestra en el carrito', !!alerta && alerta.textContent.includes('fallo_de_red_simulado') && alerta.getAttribute('role') === 'alert', texto().slice(0, 700));
    delete env.s.fallos.abc_abrir_cuenta;
    await clic(boton('Guardar pedido'));
    ok('B9.2 al reintentar con éxito el aviso desaparece', !document.querySelector('[data-error-venta]') && env.s.cuentas.length === 1, texto().slice(0, 500));
  }
  {
    // el selector no se puede tocar mientras se guarda y no aparece si no hay lista
    const env = entorno();
    env.s.fallos.abc_obtener_modalidades_local = 'abc_config_no_autorizado';
    await montar(env);
    await anadirAgua(1);
    ok('B6.1 si no se puede leer la lista no hay selector y el TPV funciona como antes', !selector() && !!boton('Guardar pedido'), texto().slice(0, 400));
    await clic(boton('Guardar pedido'));
    ok('B6.2 la cuenta se abre en Barra', env.s.cuentas[0]?.modalidad === 'BARRA', env.s.cuentas);
  }
  {
    // compatibilidad: una versión del TPV sin la función de modalidades sigue funcionando
    const env = entorno();
    await montar(env, { listarModalidadesA02: undefined });
    await anadirAgua(1);
    ok('B7.1 sin la función de modalidades no hay selector y se puede guardar', !selector() && !!boton('Guardar pedido'), texto().slice(0, 300));
    await clic(boton('Guardar pedido'));
    ok('B7.2 la cuenta se abre en Barra', env.s.cuentas[0]?.modalidad === 'BARRA', env.s.cuentas);
  }
  {
    // cambiar de local reinicia el selector
    const env = entorno();
    await montar(env);
    await anadirAgua(1);
    await clic(boton('Terraza'));
    await montar(env, { local: { id: env.L, nombre: 'Local A1' } });
    await anadirAgua(1);
    ok('B8.1 al volver a montar el TPV el selector vuelve a Barra (no recuerda la última elección)', opciones().filter((o) => o.activa).map((o) => o.t).join() === 'Barra', opciones());
  }
  {
    // tamaño táctil y orden del servidor
    const env = entorno();
    env.s.habilitadasForzadas = ['MESA', 'BARRA', 'OTRO'];
    await montar(env);
    await anadirAgua(1);
    ok('B10.1 el selector respeta el orden que da el servidor', opciones().map((o) => o.t).join('|') === 'Mesa|Barra|Otro', opciones());
    ok('B10.2 aunque Barra no sea la primera, viene elegida por defecto', opciones().filter((o) => o.activa).map((o) => o.t).join() === 'Barra', opciones());
    const botones = [...selector().querySelectorAll('button')];
    ok('B10.3 cada botón mide al menos 44 px de alto (uso con el dedo)', botones.length === 3 && botones.every((b) => b.style.minHeight === '44px'), botones.map((b) => b.style.minHeight));
    ok('B10.5 el selector lleva su título visible «Tipo de cuenta»', selector().textContent.startsWith('Tipo de cuenta'), selector().textContent.slice(0, 80));
    ok('B10.4 el grupo se llama «Tipo de cuenta» para lectores de pantalla', selector().getAttribute('aria-label') === 'Tipo de cuenta' || document.querySelector('[role="group"][aria-label="Tipo de cuenta"]'), selector()?.outerHTML.slice(0, 200));
  }
  {
    // mientras se guarda no se puede cambiar la modalidad
    const env = entorno();
    env.s.retardos.abc_abrir_cuenta = 500;
    await montar(env);
    await anadirAgua(1);
    await clic(boton('Para llevar'));
    await clic(boton('Guardar pedido'));
    ok('B11.1 mientras guarda, los botones de modalidad están desactivados', opciones().length === 5 && opciones().every((o) => o.desactivada), opciones());
    await esperar(1500);
    ok('B11.2 al terminar, la cuenta se abrió en la modalidad elegida antes de guardar', env.s.cuentas[0]?.modalidad === 'TAKEAWAY', env.s.cuentas);
  }
  {
    // si la recarga de la lista falla tras un rechazo, se conserva la lista que había
    const env = entorno();
    await montar(env);
    await anadirAgua(1);
    await clic(boton('Mesa'));
    env.s.modalidades.MESA = false;
    env.s.habilitadasForzadas = ['BARRA', 'MESA'];
    env.s.fallos.abc_abrir_cuenta = 'modalidad_no_habilitada:MESA';
    const lecturas = env.llamadas('abc_obtener_modalidades_local').length;
    env.s.fallos.abc_obtener_modalidades_local = 'error_de_red';
    await clic(boton('Guardar pedido'));
    ok('B12.1 se intentó recargar la lista', env.llamadas('abc_obtener_modalidades_local').length > lecturas, env.llamadas('abc_obtener_modalidades_local').length);
    ok('B12.2 si la recarga falla, el selector sigue ahí con la lista anterior (no desaparece)', opciones().length === 5 && texto().includes('La modalidad «Mesa» no está habilitada'), { o: opciones(), t: texto().slice(0, 600) });
  }
  {
    // cambiar de local (sin desmontar el TPV) reinicia la lista y la elección
    const env = entorno();
    await montar(env);
    await anadirAgua(1);
    await clic(boton('Terraza'));
    ok('B13.1 (antes) Terraza está elegida', opciones().filter((o) => o.activa).map((o) => o.t).join() === 'Terraza', opciones());
    const L2 = '00000000-0000-4000-8000-0000000000b2';
    env.s.catalogo.push({ ...env.s.catalogo[0], local_id: L2 });
    const logica2 = mod.crearLogicaVenta({ productos: env.productos, setProductos() {}, movimientos: [], setMovimientos() {}, arqueos: [], localActivoId: L2, empresaDelLocalActivo: { id: env.E } });
    await act(async () => {
      raiz.render(React.createElement(mod.VentaRapida, {
        productos: env.productos.map((p) => ({ ...p, localId: L2 })), venderCarrito: logica2.venderCarritoA02, listarModalidadesA02: logica2.listarModalidadesA02,
        local: { id: L2, nombre: 'Local A2' }, configEmpresa: { id: env.E }, movimientos: [], registrarAuditoria() {}
      }));
    });
    await esperar(120);
    ok('B13.2 al cambiar de local se vuelve a leer la lista del local nuevo', env.llamadas('abc_obtener_modalidades_local').some((c) => c.params.p_local_id === L2), env.llamadas('abc_obtener_modalidades_local').map((c) => c.params.p_local_id));
    if (!document.querySelector('[data-selector-modalidad]')) await anadirAgua(1); // el carrito se vacía al cambiar de local
    ok('B13.3 y la elección anterior no se arrastra: vuelve a Barra', opciones().filter((o) => o.activa).map((o) => o.t).join() === 'Barra', opciones());
    // el local nuevo no deja leer la lista: no se puede seguir mostrando la del local anterior
    env.s.fallos.abc_obtener_modalidades_local = 'abc_config_no_autorizado';
    const L3 = '00000000-0000-4000-8000-0000000000b3';
    env.s.catalogo.push({ ...env.s.catalogo[0], local_id: L3 });
    const logica3 = mod.crearLogicaVenta({ productos: env.productos, setProductos() {}, movimientos: [], setMovimientos() {}, arqueos: [], localActivoId: L3, empresaDelLocalActivo: { id: env.E } });
    await act(async () => {
      raiz.render(React.createElement(mod.VentaRapida, {
        productos: env.productos.map((p) => ({ ...p, localId: L3 })), venderCarrito: logica3.venderCarritoA02, listarModalidadesA02: logica3.listarModalidadesA02,
        local: { id: L3, nombre: 'Local A3' }, configEmpresa: { id: env.E }, movimientos: [], registrarAuditoria() {}
      }));
    });
    await esperar(120);
    if (!document.querySelector('[data-selector-modalidad]')) await anadirAgua(1);
    ok('B13.4 si no se puede leer la lista del local nuevo, desaparece la del anterior (no se ofrecen modalidades de otro local)', !selector(), texto().slice(0, 500));
  }
} catch (e) {
  resultados.push({ nombre: 'ERROR FATAL', ok: false, det: String(e.stack || e).slice(0, 1200) });
}
const fallos = resultados.filter((r) => !r.ok);
console.log(JSON.stringify({ total: resultados.length, fallos: fallos.length, detalle: fallos }, null, 1).slice(0, 9000));
if (fallos.length) process.exit(1);
console.log('cfg6e-ui-runtime: OK');
