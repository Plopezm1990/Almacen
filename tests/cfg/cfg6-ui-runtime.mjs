// Prueba de ejecución de la pantalla «Configuración» (pieza 6) y del botón «Reabrir» de la pantalla de cierre.
// Monta los componentes REALES (leídos del fuente recuperado) con React 18 en un navegador simulado (jsdom) y un servidor
// falso que registra cada llamada: comprueba carga, validaciones, qué se envía exactamente y cómo se muestran los errores.
//
// Necesita librerías que no están en el repositorio: CFG6_UI_DEPS = carpeta con node_modules que contenga
// react@18.3.1, react-dom@18.3.1 y jsdom. Por ejemplo:
//   mkdir /tmp/cfg6deps && cd /tmp/cfg6deps && npm init -y && npm i react@18.3.1 react-dom@18.3.1 jsdom
//   CFG6_UI_DEPS=/tmp/cfg6deps node tests/cfg/cfg6-ui-runtime.mjs
// CFG6_FUENTE (opcional) permite probar otro archivo (por ejemplo una variante rota en las comprobaciones de mutantes).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const depsDir = process.env.CFG6_UI_DEPS;
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

const REPO = resolve(new URL('../../', import.meta.url).pathname);
const origen = process.env.CFG6_FUENTE || join(REPO, 'source-recovery/fuente-recuperado.js');
const textoOrigen = readFileSync(origen, 'utf8');
const textoReal = readFileSync(join(REPO, 'source-recovery/fuente-recuperado.js'), 'utf8');

function extraerFuncion(texto, nombre) {
  const i = texto.indexOf('\nfunction ' + nombre + '(');
  if (i < 0) throw new Error('no se encuentra ' + nombre);
  const j = texto.indexOf('\n}\n', i);
  return texto.slice(i + 1, j + 3);
}
function extraerVar(texto, nombre) {
  const i = texto.indexOf('\nvar ' + nombre + ' = ');
  const j = texto.indexOf('\n};\n', i);
  return texto.slice(i + 1, j + 4);
}

// ================= Parte 1: la pantalla «Configuración» =================
async function parte1() {
  const ayudas = ['Card', 'SectionTitle', 'Btn', 'Input', 'Field'].map((n) => extraerFuncion(textoReal, n)).join('\n') + '\n' + extraerVar(textoReal, 'C2');
  const i0 = textoOrigen.indexOf('// ==== CONFIGURACION_LOCAL (pieza 6) ====');
  const i1 = textoOrigen.indexOf('// ==== FIN CONFIGURACION_LOCAL ====');
  if (i0 < 0 || i1 < 0) throw new Error('faltan las marcas del componente');
  const componente = textoOrigen.slice(i0, i1);

  const import_react4 = Object.assign({ default: React }, React);
  const fabrica = new Function('import_react4', 'window', ayudas + '\n' + componente + '\nreturn { ConfiguracionLocal, CONFIG_ERRORES, CONFIG_CAPACIDADES, CONFIG_MODALIDADES, CONFIG_TIPOS_EQUIPO, configMensajeError };');
  const { ConfiguracionLocal, CONFIG_ERRORES, CONFIG_CAPACIDADES, configMensajeError } = fabrica(import_react4, dom.window);

  // ---------- servidor falso ----------
  let llamadas = [];
  let respuestas = {};     // nombre -> función(params) | valor | {error}
  let terminales = [{ id: 'term-1', nombre: 'Terminal A' }, { id: 'term-2', nombre: 'Terminal B' }];
  let leerTablas = [];
    let filtrosLeidos = [];
  const cliente = {
    async rpc(nombre, params) {
      llamadas.push({ nombre, params });
      const r = respuestas[nombre];
      const v = typeof r === 'function' ? r(params) : r;
      if (v && v.__error) return { data: null, error: { message: v.__error } };
      return { data: v === undefined ? {} : v, error: null };
    },
    from(tabla) {
      leerTablas.push(tabla);
      const q = { _f: [], select() { return q; }, eq(c, v) { q._f.push([c, v]); return q; }, then(res) { filtrosLeidos.push({ tabla, filtros: q._f }); res({ data: terminales, error: null }); } };
      return q;
    }
  };
  dom.window.getSupabaseClient = async () => cliente;

  // ---------- utilidades ----------
  const resultados = [];
  function ok(nombre, cond, det) { resultados.push({ nombre, ok: !!cond, det: cond ? undefined : det }); }
  async function esperar(ms = 0) { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); }
  let raizActual = null;
  async function montar(props) {
    if (raizActual) { await act(async () => { raizActual.unmount(); }); raizActual = null; }
    document.getElementById('raiz').innerHTML = '';
    const raiz = createRoot(document.getElementById('raiz'));
    raizActual = raiz;
    await act(async () => { raiz.render(React.createElement(ConfiguracionLocal, props)); });
    await esperar(5);
    return raiz;
  }
  const texto = () => document.getElementById('raiz').textContent;
  function boton(txt) { return [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === txt || b.textContent.includes(txt)); }
  async function clic(el) { if (!el) throw new Error('clic sobre un elemento que no existe (' + (new Error().stack.split('\n')[2] || '') + ') texto actual: ' + texto().slice(0, 300)); await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); await esperar(5); }
  async function escribir(el, valor) {
    const proto = el.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
    const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
    await act(async () => { set.call(el, valor); el.dispatchEvent(new dom.window.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); });
  }
  async function marcar(el, valor) {
    if (el.checked !== valor) await clic(el);
  }
  function campoPorEtiqueta(etiqueta) {
    const lab = [...document.querySelectorAll('label')].find((l) => l.textContent.includes(etiqueta));
    return lab ? lab.querySelector('input,select') : null;
  }
  const reset = () => { llamadas = []; leerTablas = []; filtrosLeidos = []; };
  const escrituras = () => llamadas.filter((c) => /configurar/.test(c.nombre));

  const EMP = { id: 'EMP-1', razonSocial: 'Empresa de prueba' };
  const props = { empresa: EMP, localId: 'LOC-1', localNombre: 'Local Uno', esPropietario: true };

  // ---------- datos de ejemplo ----------
  const ajustes = () => ({
    cajas_abiertas_max: { valor: 10, origen: 'defecto', version: 0 },
    caja_diferencia_umbral: { valor: 0, origen: 'defecto', version: 0 },
    dia_operativo: { timezone_name: 'Europe/Madrid', cutoff_time: '04:00:00', vigente_desde: '2026-01-01T00:00:00Z', version: 1 }
  });
  const modalidades = (over = {}) => ({ modalidades: ['BARRA', 'MESA', 'TERRAZA', 'TAKEAWAY', 'OTRO'].map((m) => ({ modalidad: m, habilitada: over[m] !== false, origen: m in over ? 'local' : 'defecto', version: m in over ? 1 : 0 })), habilitadas: [] });
  const catalogoPlantilla = {
    // capacidad: [E, C, M] por defecto y techo
    ABC_CUENTA_OPERAR: [true, true, true, 'TODOS'], ABC_CUENTA_REASIGNAR: [true, false, false, 'TODOS'], ABC_PEDIDO_ENVIAR: [true, true, true, 'TODOS'], ABC_PEDIDO_SERVIR: [true, true, true, 'TODOS'],
    ABC_LINEA_CANCELAR: [true, true, true, 'TODOS'], ABC_CANCELACION_SENSIBLE: [true, false, false, 'ENCARGADO'], ABC_PEDIDO_CANCELAR: [true, false, false, 'TODOS'], ABC_PEDIDO_CERRAR: [true, true, false, 'TODOS'],
    ABC_CUENTA_REPARTIR: [true, true, true, 'TODOS'], ABC_CUENTA_UNIR: [true, true, true, 'TODOS'], ABC_REPARTO_REVERTIR: [true, false, false, 'TODOS'],
    ABC_COBRO_INICIAR: [true, true, true, 'TODOS'], ABC_COBRO_EFECTIVO: [true, true, false, 'TODOS'], ABC_COBRO_RESOLVER_INCIERTO: [true, false, false, 'ENCARGADO'], ABC_REEMBOLSO_SOLICITAR: [true, false, false, 'ENCARGADO'], ABC_REEMBOLSO_CONFIRMAR: [true, false, false, 'ENCARGADO'],
    ABC_CAJA_OPERAR: [true, true, false, 'TODOS'], ABC_CIERRE_REABRIR: [false, false, false, 'ENCARGADO'], ABC_EMISOR_CAMBIAR: [true, false, false, 'ENCARGADO'],
    ABC_PREPARACION_INICIAR: [true, false, true, 'TODOS'], ABC_PREPARACION_COMPLETAR: [true, false, true, 'TODOS'], ABC_COMANDA_VER: [true, true, true, 'TODOS'], ABC_COMANDA_REIMPRIMIR: [true, true, true, 'TODOS'], ABC_COMANDA_CAMBIAR: [true, false, true, 'TODOS'], ABC_COMANDA_CONFIGURAR: [true, false, false, 'TODOS'], ABC_COMANDA_MERMA_DECIDIR: [true, false, false, 'TODOS'],
    ABC_SALA_VER: [true, true, true, 'TODOS'], ABC_SALA_CONFIGURAR: [true, false, false, 'TODOS'], ABC_MESA_ASIGNAR: [true, true, true, 'TODOS'], ABC_MESA_RESERVAR: [true, false, false, 'TODOS'], ABC_MESA_BLOQUEAR: [true, false, false, 'TODOS']
  };
  const capacidades = (decisiones = {}, empresaPuede = true) => ({
    ok: true, puede_configurar_local: true, puede_configurar_empresa: empresaPuede,
    capacidades: Object.entries(catalogoPlantilla).map(([cap, [e, c, m, techo]]) => ({
      capacidad: cap, familia: cap.startsWith('ABC_COMANDA') ? 'COMANDA' : 'GENERAL', techo,
      roles: [
        { rol: 'Propietario', efectivo: true, plantilla: true, origen: 'fijo', decision_local: null, decision_empresa: null, puede_dar: false },
        ...[['Encargado', e], ['Cajero/a', c], ['Camarero/a', m]].map(([rol, pl]) => {
          const d = decisiones[rol + '|' + cap] || {};
          const dl = d.local ?? null, de = d.empresa ?? null;
          const techoOk = techo === 'TODOS' || (techo === 'ENCARGADO' && rol === 'Encargado');
          const ef = techoOk && (dl ?? de ?? pl);
          return { rol, efectivo: !!ef, plantilla: pl, origen: dl !== null ? 'local' : de !== null ? 'empresa' : 'plantilla', decision_local: dl, decision_empresa: de, puede_dar: techoOk };
        })
      ]
    }))
  });

  let errorFatal = null;
  try {
  // ====================== PRUEBAS ======================
  // S1 y S2: sin permiso o sin local no se llama al servidor
  reset(); respuestas = {};
  await montar({ ...props, esPropietario: false });
  ok('S1.1 sin perfil Propietario solo se muestra el aviso', texto().includes('Solo un usuario con rol Propietario') && llamadas.length === 0 && !boton('Modalidades'), { texto: texto().slice(0, 200), llamadas });
  reset();
  await montar({ ...props, localId: '' });
  ok('S2.1 sin local concreto se pide elegir uno y no se llama al servidor', texto().includes('Selecciona un local concreto') && llamadas.length === 0, texto().slice(0, 200));

  // S3: Día y cajas
  reset(); respuestas = { abc_obtener_ajustes: ajustes };
  await montar(props);
  ok('S3.1 carga los ajustes con los parámetros exactos', llamadas.length === 1 && llamadas[0].nombre === 'abc_obtener_ajustes' && llamadas[0].params.p_empresa_id === 'EMP-1' && llamadas[0].params.p_local_id === 'LOC-1', llamadas);
  ok('S3.2 muestra los valores actuales', texto().includes('04:00') && texto().includes('Europe/Madrid') && texto().includes('Ahora: 10') && texto().includes('valor por defecto'), texto().slice(0, 400));
  ok('S3.3 los campos se rellenan', campoPorEtiqueta('Hora de corte').value === '04:00' && campoPorEtiqueta('Cajas (1 a 10)').value === '10' && campoPorEtiqueta('Umbral (€)').value === '0', null);
  reset();
  await escribir(campoPorEtiqueta('Cajas (1 a 10)'), '4');
  await clic(boton('Guardar número de cajas'));
  ok('S3.4 sin motivo no se escribe nada y se avisa', escrituras().length === 0 && texto().includes('Escribe el motivo del cambio'), { e: escrituras(), t: texto().slice(0, 300) });
  await escribir(campoPorEtiqueta('Motivo del cambio'), 'Menos cajas en invierno');
  respuestas.abc_configurar_ajuste = { ok: true, cambio: true, version: 1 };
  respuestas.abc_obtener_ajustes = () => ({ ...ajustes(), cajas_abiertas_max: { valor: 4, origen: 'local', version: 1 } });
  reset();
  await clic(boton('Guardar número de cajas'));
  const w = escrituras();
  ok('S3.5 con motivo envía una sola operación con los parámetros exactos', w.length === 1 && w[0].nombre === 'abc_configurar_ajuste' && w[0].params.p_clave === 'cajas_abiertas_max' && w[0].params.p_valor === 4 && w[0].params.p_motivo === 'Menos cajas en invierno' && /^f6\.cfg\.ajuste\.[0-9a-f-]{36}$/.test(w[0].params.p_operation_id) && w[0].params.p_empresa_id === 'EMP-1' && w[0].params.p_local_id === 'LOC-1', w);
  ok('S3.6 confirma, recarga y muestra el nuevo valor', texto().includes('Guardado en el servidor') && llamadas.some((c) => c.nombre === 'abc_obtener_ajustes') && texto().includes('fijado en este local (versión 1)'), texto().slice(0, 500));
  reset();
  await escribir(campoPorEtiqueta('Cajas (1 a 10)'), '11');
  await clic(boton('Guardar número de cajas'));
  ok('S3.7 11 cajas se rechaza en la pantalla', escrituras().length === 0 && texto().includes('entre 1 y 10'), texto().slice(0, 300));
  await escribir(campoPorEtiqueta('Cajas (1 a 10)'), '2.5');
  await clic(boton('Guardar número de cajas'));
  ok('S3.8 2,5 cajas se rechaza', escrituras().length === 0 && texto().includes('entero'), texto().slice(0, 300));
  await escribir(campoPorEtiqueta('Hora de corte'), '13:00');
  await clic(boton('Guardar corte del día'));
  ok('S3.9 una hora de corte posterior a las 12:00 se rechaza', escrituras().length === 0 && texto().includes('entre las 00:00 y las 12:00'), texto().slice(0, 300));
  await escribir(campoPorEtiqueta('Hora de corte'), '03:30');
  respuestas.abc_configurar_dia_operativo = { ok: true, cambio: true, version: 2, vigente_desde: '2026-10-03T00:00:00Z' };
  reset();
  await clic(boton('Guardar corte del día'));
  const wd = escrituras();
  ok('S3.10 el corte válido envía hora con segundos, zona y vigencia vacía', wd.length === 1 && wd[0].nombre === 'abc_configurar_dia_operativo' && wd[0].params.p_cutoff_time === '03:30:00' && wd[0].params.p_timezone_name === 'Europe/Madrid' && wd[0].params.p_vigente_desde === null && wd[0].params.p_motivo === 'Menos cajas en invierno', wd);
    await escribir(campoPorEtiqueta('Zona horaria'), ' Atlantic/Canary ');
    respuestas.abc_configurar_dia_operativo = { ok: true, cambio: true, version: 3 };
    reset();
    await clic(boton('Guardar corte del día'));
    const wd2 = escrituras();
    ok('S3.10b la zona horaria escrita se envía recortada', wd2.length === 1 && wd2[0].params.p_timezone_name === 'Atlantic/Canary', wd2);
  await escribir(campoPorEtiqueta('Umbral (€)'), '12.345');
  reset();
  await clic(boton('Guardar umbral'));
  ok('S3.11 un umbral con tres decimales se rechaza', escrituras().length === 0 && texto().includes('dos decimales'), texto().slice(0, 300));
  await escribir(campoPorEtiqueta('Umbral (€)'), '5.5');
  respuestas.abc_configurar_ajuste = { ok: true, cambio: false };
  reset();
  await clic(boton('Guardar umbral'));
  const wu = escrituras();
  ok('S3.12 el umbral válido envía el número', wu.length === 1 && wu[0].params.p_clave === 'caja_diferencia_umbral' && wu[0].params.p_valor === 5.5, wu);
  ok('S3.13 sin cambio se avisa sin dar por guardado', texto().includes('No había nada que cambiar'), texto().slice(0, 300));
  respuestas.abc_configurar_ajuste = { __error: 'abc_config_no_autorizado' };
  reset();
  await clic(boton('Guardar umbral'));
  ok('S3.14 un rechazo del servidor se traduce', texto().includes('Solo el Propietario puede cambiar esta configuración'), texto().slice(0, 300));

  // S4: Modalidades
  reset(); respuestas = { abc_obtener_modalidades_local: () => modalidades() };
  await montar(props);
  await clic(boton('Modalidades'));
  ok('S4.1 carga las cinco modalidades con los parámetros exactos', llamadas.some((c) => c.nombre === 'abc_obtener_modalidades_local' && c.params.p_empresa_id === 'EMP-1' && c.params.p_local_id === 'LOC-1') && texto().includes('Para llevar') && texto().includes('Terraza'), texto().slice(0, 400));
  const casillas = () => Object.fromEntries([...document.querySelectorAll('label')].filter((l) => l.querySelector('input[type=checkbox]')).map((l) => [l.childNodes[1]?.textContent || l.textContent.split('(')[0].trim(), l.querySelector('input')]));
  ok('S4.2 Barra se puede deshabilitar y se explica qué hace el TPV', casillas()['Barra'].disabled === false && !texto().includes('siempre en Barra') && texto().includes('El TPV abre la cuenta en Barra si está habilitada y, si no, en la primera habilitada'), texto().slice(0, 700));
  await marcar(casillas()['Terraza'], false);
  reset();
  await clic(boton('Guardar modalidades'));
  ok('S4.3 sin motivo no se escribe', escrituras().length === 0 && texto().includes('Escribe el motivo'), texto().slice(0, 300));
  await escribir(campoPorEtiqueta('Motivo del cambio'), 'Sin terraza en invierno');
  respuestas.abc_configurar_modalidad_local = { ok: true, cambio: true };
  respuestas.abc_obtener_modalidades_local = () => modalidades({ TERRAZA: false });
  reset();
  await clic(boton('Guardar modalidades'));
  const wm = escrituras();
  ok('S4.4 deshabilitar Terraza envía solo ese cambio con los parámetros exactos', wm.length === 1 && wm[0].nombre === 'abc_configurar_modalidad_local' && wm[0].params.p_modalidad === 'TERRAZA' && wm[0].params.p_habilitada === false && wm[0].params.p_motivo === 'Sin terraza en invierno' && /^f6\.cfg\.modalidad\./.test(wm[0].params.p_operation_id), wm);
  ok('S4.5 confirma y recarga reflejando «decidido en este local»', texto().includes('Modalidades guardadas') && texto().includes('(decidido en este local)'), texto().slice(0, 500));
  // varios cambios: primero se habilita y luego se deshabilita (para no quedarse sin ninguna a medias)
  respuestas.abc_obtener_modalidades_local = () => modalidades({ TERRAZA: false });
  await marcar(casillas()['Terraza'], true);
  await marcar(casillas()['Mesa'], false);
  reset();
  await clic(boton('Guardar modalidades'));
  const orden = escrituras().map((c) => c.params.p_modalidad + ':' + c.params.p_habilitada);
  ok('S4.6 con varios cambios se habilita antes de deshabilitar', orden.join(',') === 'TERRAZA:true,MESA:false', orden);
  respuestas.abc_configurar_modalidad_local = { __error: 'modalidades_minimo_una' };
  await marcar(casillas()['Otro'], false);
  reset();
  await clic(boton('Guardar modalidades'));
  ok('S4.7 error del servidor traducido', texto().includes('al menos una modalidad habilitada'), texto().slice(0, 300));
    respuestas.abc_obtener_modalidades_local = () => modalidades({ BARRA: false, MESA: false, TERRAZA: false, TAKEAWAY: false });
    await montar(props);
    await clic(boton('Modalidades'));
    await marcar(casillas()['Otro'], false);
    await escribir(campoPorEtiqueta('Motivo del cambio'), 'Probar');
    reset();
    await clic(boton('Guardar modalidades'));
    ok('S4.8 si no quedara ninguna habilitada la pantalla lo impide sin llamar al servidor', escrituras().length === 0 && texto().includes('al menos una modalidad habilitada'), texto().slice(0, 300));

  // S5: Equipos
  reset();
  const equipo1 = { id: 'e1', tipo: 'DATAFONO', nombre: 'Datáfono barra', referencia: 'SN-1', terminal_id: 'term-1', terminal_nombre: 'Terminal A', activo: true, notas: 'Junto a la caja', version: 2 };
  const equipo2 = { id: 'e2', tipo: 'IMPRESORA_COCINA', nombre: 'Impresora cocina', referencia: null, terminal_id: 'term-gone', terminal_nombre: null, activo: true, notas: null, version: 1 };
  respuestas = { abc_listar_equipos_local: (p) => ({ equipos: p.p_incluir_inactivos ? [equipo1, equipo2, { ...equipo2, id: 'e3', nombre: 'Vieja', activo: false }] : [equipo1, equipo2] }) };
  await montar(props);
  await clic(boton('Equipos'));
  ok('S5.1 lista los equipos con tipo, referencia y terminal, y lee solo los terminales del local', texto().includes('Datáfono barra') && texto().includes('Impresora de tickets') === false && texto().includes('Datáfono · SN-1 · terminal Terminal A') && llamadas.some((c) => c.nombre === 'abc_listar_equipos_local' && c.params.p_incluir_inactivos === false) && leerTablas.every((t) => t === 'terminales_tpv'), { texto: texto().slice(0, 500), tablas: leerTablas });
    ok('S5.1b solo pide los terminales activos de este local', filtrosLeidos.length >= 1 && filtrosLeidos.every((f) => f.tabla === 'terminales_tpv' && JSON.stringify(f.filtros) === JSON.stringify([['empresa_id', 'EMP-1'], ['local_id', 'LOC-1'], ['activo', true]])), filtrosLeidos);
  ok('S5.2 avisa de que es solo un registro y de no escribir claves', texto().includes('Solo es un registro') && texto().includes('No escribas contraseñas'), texto().slice(0, 500));
  await clic(campoPorEtiqueta('Ver también los desactivados'));
  ok('S5.3 «ver desactivados» vuelve a pedir la lista incluyendo inactivos', llamadas.some((c) => c.nombre === 'abc_listar_equipos_local' && c.params.p_incluir_inactivos === true) && texto().includes('Vieja (desactivado)'), texto().slice(0, 500));
  await clic(campoPorEtiqueta('Ver también los desactivados'));
  await clic(boton('Añadir un equipo'));
  await escribir(campoPorEtiqueta('Nombre (hasta 80'), '  Cajón barra  ');
  const selTipo = campoPorEtiqueta('Tipo');
  await escribir(selTipo, 'CAJON_MONEDERO');
  await escribir(campoPorEtiqueta('Terminal del TPV asociado'), 'term-2');
  reset();
  await clic(boton('Guardar equipo'));
  ok('S5.4 sin motivo no se envía', escrituras().length === 0 && texto().includes('Escribe el motivo'), texto().slice(0, 300));
  await escribir(campoPorEtiqueta('Motivo del cambio'), 'Alta del cajón');
  respuestas.abc_configurar_equipo_local = { ok: true, cambio: true, creado: true, version: 1 };
  reset();
  await clic(boton('Guardar equipo'));
  const we = escrituras();
  ok('S5.5 el alta envía todos los parámetros con id nuevo, nombre recortado y nulos', we.length === 1 && we[0].nombre === 'abc_configurar_equipo_local' && we[0].params.p_tipo === 'CAJON_MONEDERO' && we[0].params.p_nombre === 'Cajón barra' && we[0].params.p_referencia === null && we[0].params.p_terminal_id === 'term-2' && we[0].params.p_activo === true && we[0].params.p_notas === null && we[0].params.p_motivo === 'Alta del cajón' && /^[0-9a-f-]{36}$/.test(we[0].params.p_equipo_id) && Object.keys(we[0].params).sort().join() === ['p_activo', 'p_empresa_id', 'p_equipo_id', 'p_local_id', 'p_motivo', 'p_nombre', 'p_notas', 'p_operation_id', 'p_referencia', 'p_terminal_id', 'p_tipo'].join(), we);
  ok('S5.6 confirma y cierra el formulario', texto().includes('Equipo añadido') && !boton('Guardar equipo'), texto().slice(0, 300));
  await clic([...document.querySelectorAll('button')].filter((b) => b.textContent === 'Editar')[1]);
  ok('S5.7 al editar el tipo no se puede cambiar y se avisa de un terminal desactivado', campoPorEtiqueta('Tipo').disabled === true && texto().includes('terminal que tenía asociado está desactivado'), texto().slice(0, 600));
  await escribir(campoPorEtiqueta('Nombre (hasta 80'), 'Impresora de cocina 2');
  reset();
  await clic(boton('Guardar equipo'));
  const we2 = escrituras();
  ok('S5.8 editar conserva el id y quita el terminal perdido', we2.length === 1 && we2[0].params.p_equipo_id === 'e2' && we2[0].params.p_terminal_id === null && we2[0].params.p_nombre === 'Impresora de cocina 2' && we2[0].params.p_tipo === 'IMPRESORA_COCINA', we2);
  reset();
  await clic([...document.querySelectorAll('button')].filter((b) => b.textContent === 'Desactivar')[0]);
  const wa = escrituras();
  ok('S5.9 desactivar reenvía el equipo con activo=false (no se borra)', wa.length === 1 && wa[0].params.p_equipo_id === 'e1' && wa[0].params.p_activo === false && wa[0].params.p_nombre === 'Datáfono barra' && wa[0].params.p_referencia === 'SN-1' && wa[0].params.p_terminal_id === 'term-1' && wa[0].params.p_notas === 'Junto a la caja', wa);
  ok('S5.10 no hay ningún botón de borrar', !boton('Borrar') && !boton('Eliminar'), null);
  respuestas.abc_configurar_equipo_local = { __error: 'equipo_nombre_duplicado' };
  await clic(boton('Añadir un equipo'));
  await escribir(campoPorEtiqueta('Nombre (hasta 80'), 'Datáfono barra');
  await clic(boton('Guardar equipo'));
  ok('S5.11 nombre duplicado traducido y el formulario sigue abierto', texto().includes('Ya hay un equipo con ese nombre') && !!boton('Guardar equipo'), texto().slice(0, 300));

  // S6: Permisos
  reset(); respuestas = { abc_obtener_capacidades_rol: () => capacidades(), abc_listar_roles_retirados: { personas: [] } };
  await montar(props);
  await clic(boton('Permisos'));
  ok('S6.1 carga la matriz con los parámetros exactos', llamadas.some((c) => c.nombre === 'abc_obtener_capacidades_rol' && c.params.p_empresa_id === 'EMP-1' && c.params.p_local_id === 'LOC-1'), llamadas);
  const filas = [...document.querySelectorAll('tbody tr')].filter((tr) => tr.querySelectorAll('input[type=checkbox]').length === 3);
  ok('S6.2 31 filas de permisos con 3 casillas cada una', filas.length === 31, filas.length);
  const casilla = (cap, rol) => document.querySelector(`input[aria-label="${cap} ${rol}"]`);
  ok('S6.3 refleja la plantilla (cajero cierra pedidos, camarero no)', casilla('ABC_PEDIDO_CERRAR', 'Cajero/a').checked === true && casilla('ABC_PEDIDO_CERRAR', 'Camarero/a').checked === false, null);
  ok('S6.4 lo delicado no se puede dar al cajero ni al camarero (bloqueado)', casilla('ABC_REEMBOLSO_SOLICITAR', 'Cajero/a').disabled === true && casilla('ABC_CIERRE_REABRIR', 'Camarero/a').disabled === true && casilla('ABC_REEMBOLSO_SOLICITAR', 'Encargado').disabled === false, null);
  ok('S6.5 «Toda la empresa» está disponible al Propietario de todos los locales', ![...document.querySelectorAll('option')].find((o) => o.value === 'EMPRESA').disabled, null);
  await clic(casilla('ABC_PEDIDO_CANCELAR', 'Cajero/a'));
  ok('S6.6 marcar una casilla solo prepara el cambio (no escribe todavía)', escrituras().length === 0 && boton('Guardar 1 cambio'), texto().slice(0, 200));
  await clic(casilla('ABC_PEDIDO_CANCELAR', 'Cajero/a'));
  ok('S6.7 volver a dejarla como estaba deshace el cambio pendiente', !!boton('Guardar 0 cambios') && boton('Guardar 0 cambios').disabled, null);
  await clic(casilla('ABC_PEDIDO_CANCELAR', 'Cajero/a'));
  await clic(casilla('ABC_CAJA_OPERAR', 'Encargado'));
  reset();
  await clic(boton('Guardar 2 cambios'));
  ok('S6.8 sin motivo no se escribe', escrituras().length === 0 && texto().includes('Escribe el motivo'), texto().slice(0, 300));
  await escribir(campoPorEtiqueta('Motivo del cambio'), 'Política de caja');
  respuestas.abc_configurar_capacidad_rol = { ok: true, cambio: true };
  respuestas.abc_obtener_capacidades_rol = () => capacidades({ 'Cajero/a|ABC_PEDIDO_CANCELAR': { local: true }, 'Encargado|ABC_CAJA_OPERAR': { local: false } });
  reset();
  await clic(boton('Guardar 2 cambios'));
  const wp = escrituras();
  const clavePar = (c) => c.params.p_rol + '|' + c.params.p_capacidad + '|' + c.params.p_permitido;
  ok('S6.9 guarda cada cambio con ámbito LOCAL, rol, capacidad, valor y motivo', wp.length === 2 && wp.every((c) => c.nombre === 'abc_configurar_capacidad_rol' && c.params.p_ambito === 'LOCAL' && c.params.p_motivo === 'Política de caja' && c.params.p_empresa_id === 'EMP-1' && c.params.p_local_id === 'LOC-1' && /^f6\.cfg\.permiso\./.test(c.params.p_operation_id)) && wp.map(clavePar).sort().join() === ['Cajero/a|ABC_PEDIDO_CANCELAR|true', 'Encargado|ABC_CAJA_OPERAR|false'].join(), wp);
  ok('S6.10 confirma, recarga y marca lo decidido en este local', texto().includes('2 cambios guardados') && texto().includes('decidido aquí') && casilla('ABC_PEDIDO_CANCELAR', 'Cajero/a').checked === true && casilla('ABC_CAJA_OPERAR', 'Encargado').checked === false, texto().slice(0, 200));
  // heredar
  await clic([...document.querySelectorAll('button')].find((b) => b.textContent === 'volver a lo normal'));
  ok('S6.11 «volver a lo normal» prepara un cambio pendiente a heredar', !!boton('Guardar 1 cambio') && texto().includes('volverá a lo normal'), texto().slice(0, 300));
  reset();
  await clic(boton('Guardar 1 cambio'));
  const wh = escrituras();
  ok('S6.12 se envía permitido nulo (heredar)', wh.length === 1 && wh[0].params.p_permitido === null, wh);
  // ámbito empresa
  await escribir([...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'EMPRESA')), 'EMPRESA');
  await clic(casilla('ABC_MESA_RESERVAR', 'Cajero/a'));
  reset();
  await clic(boton('Guardar 1 cambio'));
  const wemp = escrituras();
  ok('S6.13 con «Toda la empresa» el ámbito enviado es EMPRESA', wemp.length === 1 && wemp[0].params.p_ambito === 'EMPRESA' && wemp[0].params.p_capacidad === 'ABC_MESA_RESERVAR' && wemp[0].params.p_permitido === true, wemp);
  // error a mitad
  await clic(casilla('ABC_SALA_VER', 'Camarero/a'));
  await clic(casilla('ABC_MESA_BLOQUEAR', 'Cajero/a'));
  let n = 0;
  respuestas.abc_configurar_capacidad_rol = () => (++n === 2 ? { __error: 'capacidad_fuera_de_techo' } : { ok: true });
  reset();
  await clic(boton('Guardar 2 cambios'));
  ok('S6.14 si falla el segundo se explica cuántos se guardaron y se traduce el error', texto().includes('1 cambio ya guardado; el siguiente falló') && texto().includes('Por seguridad, ese permiso no se puede dar a ese rol'), texto().slice(0, 400));
  // Propietario de un solo local
  respuestas.abc_obtener_capacidades_rol = () => capacidades({}, false);
  await montar(props);
  await clic(boton('Permisos'));
  ok('S6.15 sin acceso a toda la empresa la opción queda desactivada con su explicación', [...document.querySelectorAll('option')].find((o) => o.value === 'EMPRESA').disabled === true && texto().includes('hace falta ser Propietario de todos los locales'), texto().slice(0, 300));
  // roles retirados
  respuestas.abc_listar_roles_retirados = { personas: [{ user_id: 'u1', nombre: 'Ana', rol: 'Churrero/a', activo: true, todos_locales: false, local_id: 'LOC-1' }, { user_id: 'u2', nombre: null, rol: 'Básico', activo: false, todos_locales: true, local_id: null }] };
  reset();
  await clic(boton('Ver quién tiene un rol retirado'));
  ok('S6.16 lista a las personas con roles retirados', llamadas.some((c) => c.nombre === 'abc_listar_roles_retirados' && c.params.p_local_id === 'LOC-1') && texto().includes('Ana · Churrero/a') && texto().includes('Sin nombre · Básico (inactivo) · todos los locales'), texto().slice(0, 800));
  respuestas.abc_listar_roles_retirados = { personas: [] };
  await clic(boton('Ver quién tiene un rol retirado'));
  ok('S6.17 si no hay nadie lo dice', texto().includes('Nadie tiene un rol retirado'), texto().slice(0, 300));

  // S7: errores de carga y mapa de errores
  respuestas = { abc_obtener_ajustes: { __error: 'abc_config_no_autorizado' } };
  await montar(props);
  ok('S7.1 un error al cargar se muestra traducido', texto().includes('Solo el Propietario puede cambiar esta configuración'), texto().slice(0, 300));
  ok('S7.2 un error desconocido se muestra con su texto', configMensajeError(new Error('boom')).includes('boom') && configMensajeError(null).startsWith('No se pudo completar'), null);
  const grupos = CONFIG_CAPACIDADES.flatMap((g3) => g3.items.map((i2) => i2[0]));
  ok('S7.3 las 31 capacidades de la pantalla coinciden con el catálogo de prueba', grupos.length === 31 && new Set(grupos).size === 31 && Object.keys(catalogoPlantilla).every((c) => grupos.includes(c)), grupos.length);


  } catch (e) { errorFatal = String(e.message).slice(0, 600); }

  if (errorFatal) resultados.push({ nombre: 'ERROR FATAL (parte 1)', ok: false, det: errorFatal });
  return resultados;
}

// ================= Parte 2: el botón «Reabrir» de la pantalla de cierre (módulo completo de la app) =================
async function parte2() {
  const ruta = process.env.CFG6_FUENTE || join(REPO, 'source-recovery/fuente-recuperado.js');
  let texto = readFileSync(ruta, 'utf8');
  const lineas = texto.split('\n');
  const iniImports = lineas.findIndex((l) => l.startsWith('import React'));
  let finImports = iniImports;
  while (lineas[finImports + 1].startsWith('import ')) finImports += 1;
  const lineaIconos = lineas.slice(iniImports, finImports + 1).find((l) => l.includes('lucide-react'));
  const nombres = lineaIconos.match(/\{([^}]*)\}/)[1].split(',').map((x) => x.trim()).map((x) => x.split(' as ').pop());
  const cuerpo = lineas.slice(finImports + 1).join('\n');
  const icono = () => null;
  const stubs = { React, ReactNS: React, import_client2: { createRoot: () => ({ render() {}, unmount() {} }) }, createRoot: () => ({ render() {}, unmount() {} }), createClient: () => ({}), E: function () {}, autoTable: () => {}, XLSX: { utils: {}, writeFile() {}, writeFileSync() {} } };
  const iconos = Object.fromEntries(nombres.map((n) => [n, icono]));
  const exportar = '\nreturn { CocinaA10, ConfiguracionLocal, NOMBRES_ROLES_ALTA, ROLES_RETIRADOS, NOMBRES_ROLES };';
  const fabrica = new Function(...Object.keys(stubs), ...Object.keys(iconos), cuerpo + exportar);
  const mod = fabrica(...Object.values(stubs), ...Object.values(iconos));

  // ---------- servidor falso ----------
  let llamadas = [];
  let respuestaCaps = null;
  dom.window.getSupabaseClient = async () => ({
    async rpc(nombre, params) {
      llamadas.push({ nombre, params });
      if (nombre === 'abc_obtener_capacidades_rol') {
        if (respuestaCaps && respuestaCaps.__error) return { data: null, error: { message: respuestaCaps.__error } };
        return { data: respuestaCaps, error: null };
      }
      return { data: {}, error: null };
    }
  });
  const caps = (efectivoPorRol) => ({ capacidades: [{ capacidad: 'ABC_CAJA_OPERAR', roles: [] }, { capacidad: 'ABC_CIERRE_REABRIR', roles: Object.entries(efectivoPorRol).map(([rol, efectivo]) => ({ rol, efectivo })) }] });

  const resultados = [];
  const ok = (nombre, cond, det) => resultados.push({ nombre, ok: !!cond, det: cond ? undefined : det });
  const esperar = async (ms = 5) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };
  let contenedor = null;
    const nuevoContenedor = () => { contenedor = document.createElement('div'); document.body.appendChild(contenedor); return contenedor; };
    const textoPantalla = () => (contenedor || document.getElementById('raiz')).textContent;
  const boton = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t));
  async function clic(el) { if (!el) throw new Error('no existe el botón; texto: ' + textoPantalla().slice(0, 400)); await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); await esperar(); }
  async function escribir(el, valor) {
    const set = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
    await act(async () => { set.call(el, valor); el.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
  }
  let raiz = null;
  const reabrirLlamadas = [];
  async function montarCocina(rolPerfil, local = { id: 'LOC-1' }, empresa = { id: 'EMP-1' }) {
    if (raiz) { await act(async () => { raiz.unmount(); }); }
    raiz = createRoot(nuevoContenedor());
    const listar = async () => ({ ok: true, estaciones: [], rutas: [] });
    listar.iniciarCierreSesionCajaA10 = async () => ({ ok: true });
    listar.confirmarCierreProvisionalA10 = async ({ efectivoContado }) => ({ ok: true, counted_amount: efectivoContado, expected_amount: efectivoContado, difference: 0, blockers: [] });
    listar.finalizarCierreSesionCajaA10 = async () => ({ ok: true });
    listar.reabrirCierreProvisionalA10 = async ({ motivo }) => { reabrirLlamadas.push(motivo); return { ok: true }; };
    listar.abrirSesionCajaA10 = async () => ({ ok: true });
    const props = { productos: [], local, configEmpresa: empresa, listarEstacionesA10: listar, listarComandasA10: async () => ({ ok: true, comandas: [] }), crearEstacionA10: async () => ({ ok: true }), actualizarEstacionA10: async () => ({ ok: true }), asignarProductoEstacionA10: async () => ({ ok: true }), enviarCambioComandaA10: async () => ({ ok: true }), reimprimirComandaA10: async () => ({ ok: true }), resolverMermaComandaA10: async () => ({ ok: true }), rolPerfil };
    await act(async () => { raiz.render(React.createElement(mod.CocinaA10, props)); });
    await esperar(20);
    await clic(boton('Iniciar cierre'));
    await escribir(document.querySelector('input[type=number][step="0.01"]'), '10');
    await clic(boton('Confirmar cierre provisional'));
  }

  try {
    // roles retirados
    ok('R1 los tres roles retirados no están en la lista de alta', mod.NOMBRES_ROLES_ALTA.join('|') === 'Camarero/a|Cajero/a|Encargado' && mod.ROLES_RETIRADOS.length === 3 && mod.NOMBRES_ROLES.includes('Churrero/a'), mod.NOMBRES_ROLES_ALTA);

    llamadas = []; respuestaCaps = caps({ Propietario: true, Encargado: false, 'Cajero/a': false, 'Camarero/a': false });
    await montarCocina('Propietario');
    ok('C1 el Propietario ve el motivo y el botón de reabrir', !!boton('Reabrir cierre provisional') && textoPantalla().includes('Motivo de reapertura') && !textoPantalla().includes('Solo el Propietario (o quien'), textoPantalla().slice(-500));
    ok('C2 consulta el permiso real con los parámetros exactos', llamadas.some((c) => c.nombre === 'abc_obtener_capacidades_rol' && c.params.p_empresa_id === 'EMP-1' && c.params.p_local_id === 'LOC-1'), llamadas);
    await escribir(document.querySelector('input[placeholder="Ajuste de arqueo…"]'), 'Corregir el arqueo');
    await clic(boton('Reabrir cierre provisional'));
    ok('C3 reabrir sigue funcionando con el motivo', reabrirLlamadas.join() === 'Corregir el arqueo', reabrirLlamadas);

    llamadas = []; await montarCocina('Cajero/a');
    ok('C4 el Cajero/a no ve el botón ni el motivo y se le explica', !boton('Reabrir cierre provisional') && !textoPantalla().includes('Motivo de reapertura') && textoPantalla().includes('Solo el Propietario (o quien él autorice en Configuración) puede reabrir un cierre provisional.'), textoPantalla().slice(-500));
    ok('C5 el resto de la pantalla de cierre sigue (finalizar)', !!boton('Finalizar cierre'), null);

    respuestaCaps = caps({ Propietario: true, Encargado: true, 'Cajero/a': false, 'Camarero/a': false });
    await montarCocina('Encargado');
    ok('C6 si el Propietario autoriza al Encargado, lo ve', !!boton('Reabrir cierre provisional'), textoPantalla().slice(-400));

    respuestaCaps = { __error: 'boom' };
    await montarCocina('Cajero/a');
    ok('C7 si no se puede consultar el permiso, se muestra y decide el servidor', !!boton('Reabrir cierre provisional'), textoPantalla().slice(-400));

    respuestaCaps = caps({ Propietario: true, Encargado: false, 'Cajero/a': false, 'Camarero/a': false });
    llamadas = []; await montarCocina('');
    ok('C8 sin rol conocido no consulta nada y se muestra', llamadas.filter((c) => c.nombre === 'abc_obtener_capacidades_rol').length === 0 && !!boton('Reabrir cierre provisional'), llamadas);

    llamadas = []; await montarCocina('Estándar');
    ok('C9 un rol que no está en la matriz (retirado) no puede reabrir', !boton('Reabrir cierre provisional') && textoPantalla().includes('Solo el Propietario (o quien'), textoPantalla().slice(-400));

    llamadas = [];
    if (raiz) { await act(async () => { raiz.unmount(); }); }
    raiz = createRoot(nuevoContenedor());
    await act(async () => { raiz.render(React.createElement(mod.CocinaA10, { productos: [], local: null, configEmpresa: { id: 'EMP-1' }, rolPerfil: 'Propietario', listarEstacionesA10: async () => ({ ok: true }) })); });
    await esperar(20);
    ok('C10 sin local concreto no consulta el permiso y la pantalla pide elegir local', llamadas.filter((c) => c.nombre === 'abc_obtener_capacidades_rol').length === 0 && textoPantalla().includes('Selecciona un local concreto'), llamadas);
  } catch (e) {
    resultados.push({ nombre: 'ERROR FATAL', ok: false, det: String(e.stack || e).slice(0, 900) });
  }

  return resultados;
}

const todos = [];
try {
  todos.push(...await parte1());
  todos.push(...await parte2());
} catch (e) {
  todos.push({ nombre: 'ERROR FATAL', ok: false, det: String(e.stack || e).slice(0, 900) });
}
const fallos = todos.filter((r) => !r.ok);
console.log(JSON.stringify({ total: todos.length, fallos: fallos.length, detalle: fallos }, null, 1).slice(0, 8000));
if (!fallos.length) console.log('cfg6-ui-runtime: OK');
process.exit(fallos.length ? 1 : 0);
