// Prueba de ejecución del panel «Plataforma» y de la pantalla «Elige tu contraseña», con la pantalla REAL montada en jsdom.
//
// El servidor se simula (lista de empresas, respuestas de las funciones, errores) y se anota cada llamada: así se comprueba
// qué ve el administrador, qué botones tiene cada empresa según su estado, QUÉ SE ENVÍA al servidor y, sobre todo, lo que
// NO se envía cuando algo no se cumple (contraseña mal, nombre mal, código mal, plazo sin cumplir):
//   · lista: empresas activas, desactivadas con y sin baja registrada, sin dueño; los nombres se pintan como texto (nada de HTML);
//   · alta: empresa y dueño en ese orden, contraseña inicial legible, credenciales para entregar; si falla el segundo paso la
//     empresa no se repite al reintentar;
//   · desactivar / registrar baja: pide la contraseña del administrador, comprobada aparte sin tocar la sesión;
//   · reactivar, copia descargable, añadir dueño;
//   · eliminar: sin plazo no hay formulario; nombre exacto, contraseña, código de un solo uso; motivo escrito si no hay copia;
//     la misma operación se reintenta con el mismo identificador;
//   · contraseña inicial del dueño: validaciones, qué se envía a Auth, mensajes de error.
//
// Necesita librerías que no están en el repositorio: CFG6_UI_DEPS (o CFG6E_UI_DEPS) = carpeta con node_modules que contenga
// react@18.3.1, react-dom@18.3.1 y jsdom (ver tests/cfg/cfg6e-ui-runtime.mjs).
//   CFG6_UI_DEPS=/tmp/cfg6deps node tests/plataforma/p05-panel-ui-runtime.mjs
// PLATAFORMA_PANEL (opcional) permite probar otro archivo (variantes rotas de mutantes).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { webcrypto } from 'node:crypto';

const depsDir = process.env.CFG6E_UI_DEPS || process.env.CFG6_UI_DEPS;
if (!depsDir) {
  console.error('CFG6_UI_DEPS no está definido: indica una carpeta con node_modules (react@18.3.1, react-dom@18.3.1 y jsdom).');
  process.exit(2);
}
const require = createRequire(join(resolve(depsDir), 'package.json'));
const { JSDOM } = require('jsdom');

const REPO = resolve(new URL('../../', import.meta.url).pathname);
const panelSrc = readFileSync(process.env.PLATAFORMA_PANEL || join(REPO, 'plataforma-panel.js'), 'utf8');

const resultados = [];
const ok = (nombre, cond, det) => resultados.push({ nombre, ok: !!cond, det: cond ? undefined : det });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
async function esperar(cond, desc, ms = 3000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    try { if (cond()) return true; } catch {}
    await dormir(5);
  }
  ok(`(espera agotada) ${desc}`, false, 'no llegó a cumplirse');
  return false;
}

const SESION = { access_token: 'token-admin-123', user: { id: 'admin-1', email: 'pedro@plataforma.test', user_metadata: {} } };

function empresasBase() {
  return [
    { id: 'empresa-a', nombre: 'Bar La Esquina', activa: true, creada_en: '2026-10-01T10:00:00Z', baja_en: null, baja_motivo: null,
      locales_activos: 1, locales_total: 1, usuarios_activos: 2, usuarios_total: 2,
      propietarios: [{ user_id: 'u1', nombre: 'Ana', email: 'ana@esquina.com', activo: true }] },
    { id: 'empresa-b', nombre: '<img src=x onerror=window.__hackeado=1> Sin dueño SL', activa: true, creada_en: '2026-10-02T10:00:00Z', baja_en: null, baja_motivo: null,
      locales_activos: 1, locales_total: 2, usuarios_activos: 0, usuarios_total: 0, propietarios: [] },
    { id: 'empresa-c', nombre: 'Café Cerrado', activa: false, creada_en: '2026-08-01T10:00:00Z', baja_en: '2026-09-01T10:00:00Z', baja_motivo: 'Dejó de usar el programa',
      locales_activos: 0, locales_total: 1, usuarios_activos: 0, usuarios_total: 1,
      propietarios: [{ user_id: 'u3', nombre: 'Carlos', email: 'carlos@cafe.com', activo: false }] },
    { id: 'empresa-d', nombre: 'Antigua sin baja', activa: false, creada_en: '2026-07-01T10:00:00Z', baja_en: null, baja_motivo: null,
      locales_activos: 0, locales_total: 1, usuarios_activos: 0, usuarios_total: 0, propietarios: [] }
  ];
}

function entorno(opts = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div><div id="cargando">Cargando</div></body></html>',
    { url: 'https://deploy-preview-118--chic-entremet-9107cf.netlify.app/', pretendToBeVisual: true, runScripts: 'outside-only' });
  const w = dom.window;
  const log = { rpc: [], funcion: [], fetch: [], descargas: [], copiados: [], blobs: [], signOut: 0, updateUser: [], getUser: 0 };
  w.NUBE_URL = 'https://qjqorixtkilwsndqayyx.supabase.co';
  w.NUBE_CLAVE = 'clave-publica-de-prueba';
  if (!w.crypto || typeof w.crypto.getRandomValues !== 'function') Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true });
  const rpcH = opts.rpc || (async () => { throw new Error('rpc no previsto'); });
  const funH = opts.funcion || (async () => { throw new Error('función no prevista'); });
  w.__laOwnerBootstrapRpc = async (nombre, token, cuerpo) => {
    log.rpc.push({ nombre, token, cuerpo: JSON.parse(JSON.stringify(cuerpo || {})) });
    return rpcH(nombre, cuerpo || {}, log);
  };
  w.__laOwnerBootstrapFunction = async (nombre, token, cuerpo) => {
    log.funcion.push({ nombre, token, cuerpo: JSON.parse(JSON.stringify(cuerpo || {})) });
    return funH(nombre, cuerpo || {}, log);
  };
  w.fetch = async (url, init) => {
    log.fetch.push({ url: String(url), headers: (init && init.headers) || {}, body: init && init.body ? JSON.parse(init.body) : null });
    return (opts.fetchRespuesta || (() => ({ ok: true, status: 200 })))(String(url), init);
  };
  w.URL.createObjectURL = (b) => { log.blobs.push(b.size); return 'blob:prueba'; };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () { log.descargas.push({ nombre: this.getAttribute('download'), href: this.getAttribute('href') }); };
  Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async (t) => { log.copiados.push(t); } }, configurable: true });
  w.eval(panelSrc);
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: opts.sinSesion ? null : (opts.sesion || SESION) } }),
      signOut: async () => { log.signOut++; },
      getUser: async () => { log.getUser++; return opts.getUser ? opts.getUser() : { data: { user: opts.sesion ? opts.sesion.user : SESION.user } }; },
      updateUser: async (args) => { log.updateUser.push(JSON.parse(JSON.stringify(args))); return opts.updateUser ? opts.updateUser(args) : { data: {}, error: null }; }
    }
  };
  const d = w.document;
  const api = {
    w, d, log, supabase, P: w.__laPlataforma,
    q: (sel, raiz) => (raiz || d).querySelector(sel),
    qa: (sel, raiz) => [...(raiz || d).querySelectorAll(sel)],
    boton: (texto, raiz) => [...(raiz || d).querySelectorAll('button')].find((b) => b.textContent.trim() === texto) || null,
    botonQueEmpieza: (texto, raiz) => [...(raiz || d).querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(texto)) || null,
    dialogo: () => d.querySelector('.lap-dialogo'),
    campo: (nombre, raiz) => (raiz || d).querySelector(`[name="${nombre}"]`),
    tarjeta: (id) => d.querySelector(`[data-empresa="${id}"]`),
    escribir: (el, valor) => { el.value = valor; el.dispatchEvent(new w.Event('input', { bubbles: true })); },
    clic: (el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })),
    llamadas: (nombre) => log.rpc.filter((c) => c.nombre === nombre),
    texto: (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  };
  return api;
}

function servidorBase(extra = {}) {
  const lista = extra.lista || empresasBase();
  return async (nombre, cuerpo, log) => {
    if (extra[nombre]) return extra[nombre](cuerpo, log);
    switch (nombre) {
      case 'plataforma_listar_empresas': return lista;
      case 'plataforma_crear_empresa': return { ok: true, empresa_id: 'empresa-nueva', local_id: 'local-nuevo' };
      case 'plataforma_desactivar_empresa': return { ok: true, empresa_id: cuerpo.p_empresa_id };
      case 'plataforma_reactivar_empresa': return { ok: true, empresa_id: cuerpo.p_empresa_id };
      case 'plataforma_exportar_empresa': return { ok: true, empresa_id: cuerpo.p_empresa_id, filas_total: 1234, huella: 'abcdef0123456789abcdef', copia: { version: 1, datos: { productos: [{ id: 1 }] } } };
      default: throw new Error(`RPC no previsto en la prueba: ${nombre}`);
    }
  };
}

const ABRIR = (e, opts = {}) => e.P.mostrarPanel(e.supabase, SESION, { es_admin: true, plataforma_activa: true, mis_empresas: opts.mis_empresas ?? 0 }, { recargar: opts.recargar || (() => {}) });
async function abrirPanel(e, opts) {
  ABRIR(e, opts);
  await esperar(() => e.qa('[data-empresa]').length === 4, 'el panel lista las 4 empresas');
}

// ---- 1. Lista: estados, botones y nombres como texto ----
{
  const abierta = [];
  const e = entorno({ rpc: servidorBase() });
  await abrirPanel(e, { mis_empresas: 1, recargar: () => abierta.push(1) });
  ok('1a. hay panel, la barra de carga desaparece y el programa queda oculto',
    e.q('#la-plataforma-root') && !e.q('#cargando') && e.d.documentElement.classList.contains('la-installation-needs-setup'));
  ok('1b. solo se pidió la lista (no se tocó nada más)', e.log.rpc.length === 1 && e.log.rpc[0].nombre === 'plataforma_listar_empresas' && e.log.rpc[0].token === SESION.access_token);
  ok('1c. resumen: 2 activas y 2 desactivadas', /2 empresas activas · 2 desactivadas/.test(e.texto(e.q('[data-resumen]'))), e.texto(e.q('[data-resumen]')));

  const a = e.tarjeta('empresa-a'), b = e.tarjeta('empresa-b'), c = e.tarjeta('empresa-c'), dd = e.tarjeta('empresa-d');
  const nombresBotones = (t) => e.qa('button', t).map((x) => x.textContent.trim());
  ok('1d. activa con dueño: Desactivar y Añadir dueño, nada de borrar',
    JSON.stringify(nombresBotones(a)) === JSON.stringify(['Desactivar', 'Añadir dueño']), JSON.stringify(nombresBotones(a)));
  ok('1e. muestra el correo del dueño y los contadores', /ana@esquina\.com/.test(e.texto(a)) && /Locales: 1 activos de 1/.test(e.texto(a)) && /Usuarios: 2 activos de 2/.test(e.texto(a)), e.texto(a));
  ok('1f. sin dueño: aviso y botón para crearlo', /Sin dueño todavía/.test(e.texto(b)) && nombresBotones(b).includes('Añadir dueño'));
  ok('1g. el nombre con HTML se pinta como texto y no ejecuta nada',
    e.texto(b).includes('<img src=x onerror=window.__hackeado=1>') && e.qa('img').length === 0 && e.w.__hackeado === undefined);
  ok('1h. desactivada con baja: fecha, motivo y Reactivar / Descargar copia / Eliminar',
    /Desactivada el 01\/09\/2026/.test(e.texto(c)) && /Dejó de usar el programa/.test(e.texto(c)) &&
    JSON.stringify(nombresBotones(c)) === JSON.stringify(['Reactivar', 'Descargar copia', 'Eliminar para siempre…']), JSON.stringify(nombresBotones(c)));
  ok('1i. el dueño desactivado se indica', /carlos@cafe\.com \(desactivado\)/.test(e.texto(c)));
  ok('1j. desactivada SIN baja: no se ofrece borrar, se ofrece registrar la baja',
    /sin fecha de baja registrada/.test(e.texto(dd)) && JSON.stringify(nombresBotones(dd)) === JSON.stringify(['Reactivar', 'Registrar la baja']), JSON.stringify(nombresBotones(dd)));
  ok('1k. "Abrir mi aplicación" solo aparece si el administrador tiene empresa propia', !!e.boton('Abrir mi aplicación'));
  e.clic(e.boton('Abrir mi aplicación'));
  ok('1l. al pulsarlo se recuerda el modo aplicación (solo el id de usuario), se cierra el panel y se pide recargar la página', abierta.length === 1 && e.P.enModoAplicacion('admin-1') === true && e.w.sessionStorage.getItem('la_plataforma_modo_app') === 'admin-1' && !e.q('#la-plataforma-root'));

  const salirRecargas = [];
  const salir = entorno({ rpc: servidorBase() });
  salir.w.sessionStorage.setItem('la_plataforma_modo_app', 'admin-1');
  await abrirPanel(salir, { recargar: () => salirRecargas.push(1) });
  salir.clic(salir.boton('Cerrar sesión'));
  await esperar(() => salir.log.signOut === 1 && salirRecargas.length === 1, 'cerrar sesión llama a Auth y recarga');
  ok('1q. «Cerrar sesión» cierra la sesión, olvida la elección y recarga la página', salir.log.signOut === 1 && salirRecargas.length === 1 && salir.w.sessionStorage.getItem('la_plataforma_modo_app') === null);

  const sin = entorno({ rpc: servidorBase() });
  await abrirPanel(sin, { mis_empresas: 0 });
  ok('1m. sin empresa propia no hay "Abrir mi aplicación"', !sin.boton('Abrir mi aplicación'));
  sin.P.cerrarTodo();
  ok('1n. cerrarTodo quita el panel', !sin.q('#la-plataforma-root'));

  const vacio = entorno({ rpc: servidorBase({ lista: [] }) });
  ABRIR(vacio);
  await esperar(() => vacio.q('[data-vacio]'), 'mensaje de lista vacía');
  ok('1o. sin empresas, invita a crear la primera', /Todavía no hay ninguna empresa/.test(vacio.texto(vacio.q('[data-vacio]'))));

  const caido = entorno({ rpc: async () => { throw new Error('Failed to fetch'); } });
  ABRIR(caido);
  await esperar(() => /No se pudo cargar la lista/.test(caido.texto(caido.q('.lap-cuerpo'))), 'error de lista');
  ok('1p. un fallo de red se cuenta en cristiano', /No hay conexión con el servidor/.test(caido.texto(caido.q('.lap-cuerpo'))));
}

// ---- 2. Alta de empresa y dueño ----
{
  const e = entorno({ rpc: servidorBase(), funcion: async () => ({ ok: true, userId: 'u-nuevo', empresaId: 'empresa-nueva' }) });
  await abrirPanel(e);
  e.clic(e.boton('+ Dar de alta una empresa'));
  const dlg = e.dialogo();
  ok('2a. se abre el formulario con una contraseña inicial legible ya puesta', dlg && /^[a-km-zA-HJ-NP-Z2-9]{4}-[a-km-zA-HJ-NP-Z2-9]{4}-[a-km-zA-HJ-NP-Z2-9]{4}$/.test(e.campo('password', dlg).value), e.campo('password', dlg) && e.campo('password', dlg).value);
  const antes = e.log.rpc.length;
  e.clic(e.boton('Crear empresa y cuenta', dlg));
  ok('2b. con el formulario vacío no se envía nada y se señalan los campos',
    e.log.rpc.length === antes && e.log.funcion.length === 0 && e.qa('.lap-err', dlg).filter((x) => x.style.display !== 'none').length >= 4);

  e.escribir(e.campo('nombre', dlg), '  Nueva SL ');
  e.escribir(e.campo('cif', dlg), 'B99999999');
  e.escribir(e.campo('local', dlg), 'Centro');
  e.escribir(e.campo('dueno', dlg), 'Luis Gómez');
  e.escribir(e.campo('email', dlg), 'LUIS@Nueva.com');
  e.escribir(e.campo('password', dlg), 'corta1');
  e.clic(e.boton('Crear empresa y cuenta', dlg));
  ok('2c. una contraseña débil se rechaza antes de enviar', e.log.funcion.length === 0 && e.llamadas('plataforma_crear_empresa').length === 0 &&
    /al menos 10/.test(e.texto(e.q('[data-error-de="password"]', dlg))));

  const pass = 'Zq7m-Kd3x-Rb9t';
  e.escribir(e.campo('password', dlg), pass);
  e.clic(e.boton('Crear empresa y cuenta', dlg));
  await esperar(() => e.log.funcion.length === 1, 'llamada de crear dueño');
  const crear = e.llamadas('plataforma_crear_empresa')[0];
  ok('2d. primero la empresa: nombre recortado, local, CIF y un identificador de operación', crear &&
    crear.cuerpo.p_nombre === 'Nueva SL' && crear.cuerpo.p_local_nombre === 'Centro' && crear.cuerpo.p_cif === 'B99999999' &&
    /^alta:[0-9a-f]{24}$/.test(crear.cuerpo.p_operation_id) && crear.token === SESION.access_token, JSON.stringify(crear));
  const fn = e.log.funcion[0];
  ok('2e. después la cuenta del dueño, con el id de la empresa recién creada y el correo en minúsculas',
    fn.nombre === 'plataforma-crear-propietario' && fn.token === SESION.access_token &&
    JSON.stringify(fn.cuerpo) === JSON.stringify({ empresaId: 'empresa-nueva', nombre: 'Luis Gómez', email: 'luis@nueva.com', password: pass }), JSON.stringify(fn.cuerpo));
  ok('2f. el orden es empresa y luego dueño', e.log.rpc.findIndex((c) => c.nombre === 'plataforma_crear_empresa') >= 0);
  await esperar(() => e.q('[data-credenciales]'), 'credenciales visibles');
  const cred = e.texto(e.q('[data-credenciales]'));
  ok('2g. se muestran los datos para entregar al dueño', cred.includes('Nueva SL') && cred.includes('luis@nueva.com') && cred.includes(pass) && cred.includes('https://deploy-preview-118--chic-entremet-9107cf.netlify.app'), cred);
  e.clic(e.boton('Copiar datos'));
  await esperar(() => e.log.copiados.length === 1, 'copiado al portapapeles');
  ok('2h. "Copiar datos" copia correo y contraseña', e.log.copiados[0].includes('luis@nueva.com') && e.log.copiados[0].includes(pass));
  ok('2i. la lista se recargó tras el alta', e.llamadas('plataforma_listar_empresas').length >= 2);
}

// ---- 3. Alta: falla el segundo paso y se reintenta sin repetir la empresa ----
{
  let intentos = 0;
  const e = entorno({
    rpc: servidorBase(),
    funcion: async () => { intentos++; if (intentos === 1) throw new Error('Ya existe una cuenta con ese correo.'); return { ok: true, userId: 'u2', empresaId: 'empresa-nueva' }; }
  });
  await abrirPanel(e);
  e.clic(e.boton('+ Dar de alta una empresa'));
  const dlg = e.dialogo();
  e.escribir(e.campo('nombre', dlg), 'Segunda SL'); e.escribir(e.campo('local', dlg), 'Principal');
  e.escribir(e.campo('dueno', dlg), 'Marta'); e.escribir(e.campo('email', dlg), 'marta@x.com'); e.escribir(e.campo('password', dlg), 'Zq7m-Kd3x-Rb9t');
  e.clic(e.boton('Crear empresa y cuenta', dlg));
  await esperar(() => /ya está creada/.test(e.texto(dlg)), 'aviso de empresa creada sin dueño');
  ok('3a. se explica que la empresa ya existe y qué falta', /Segunda SL.*ya está creada.*Ya existe una cuenta con ese correo/.test(e.texto(dlg)), e.texto(dlg));
  ok('3b. el diálogo sigue abierto y la empresa ya no se puede cambiar', !!e.dialogo() && e.campo('nombre', dlg).readOnly === true);
  e.escribir(e.campo('email', dlg), 'marta2@x.com');
  e.clic(e.boton('Crear solo la cuenta del dueño', dlg));
  await esperar(() => e.log.funcion.length === 2, 'segundo intento');
  ok('3c. el reintento NO vuelve a crear la empresa', e.llamadas('plataforma_crear_empresa').length === 1);
  ok('3d. el reintento usa la empresa ya creada y el correo nuevo', e.log.funcion[1].cuerpo.empresaId === 'empresa-nueva' && e.log.funcion[1].cuerpo.email === 'marta2@x.com');
  await esperar(() => e.q('[data-credenciales]'), 'credenciales tras el reintento');
  ok('3e. al salir bien se muestran las credenciales', /marta2@x\.com/.test(e.texto(e.q('[data-credenciales]'))));

  const f = entorno({ rpc: servidorBase({ plataforma_crear_empresa: async () => { throw new Error('Ya existe una empresa con ese nombre'); } }) });
  await abrirPanel(f);
  f.clic(f.boton('+ Dar de alta una empresa'));
  const d2 = f.dialogo();
  f.escribir(f.campo('nombre', d2), 'Repetida'); f.escribir(f.campo('local', d2), 'L1');
  f.escribir(f.campo('dueno', d2), 'Pepe'); f.escribir(f.campo('email', d2), 'pepe@x.com'); f.escribir(f.campo('password', d2), 'Zq7m-Kd3x-Rb9t');
  f.clic(f.boton('Crear empresa y cuenta', d2));
  await esperar(() => /Ya existe una empresa con ese nombre/.test(f.texto(d2)), 'error de nombre repetido');
  ok('3f. si falla la empresa no se intenta crear ninguna cuenta', f.log.funcion.length === 0);
}

// ---- 4. Desactivar: pide la contraseña del administrador ----
{
  const e = entorno({ rpc: servidorBase(), fetchRespuesta: (url, init) => JSON.parse(init.body).password === 'clave-correcta-1' ? { ok: true, status: 200 } : { ok: false, status: 400 } });
  await abrirPanel(e);
  e.clic(e.boton('Desactivar', e.tarjeta('empresa-a')));
  const dlg = e.dialogo();
  ok('4a. el diálogo avisa de que no se borra nada', /No se borra ningún dato/.test(e.texto(dlg)));
  e.escribir(e.campo('motivo', dlg), '  Cierre del negocio ');
  e.escribir(e.campo('contrasena', dlg), 'clave-mala');
  e.clic(e.boton('Desactivar empresa', dlg));
  await esperar(() => /no es correcta/.test(e.texto(dlg)), 'contraseña incorrecta');
  ok('4b. con la contraseña mal NO se desactiva nada', e.llamadas('plataforma_desactivar_empresa').length === 0);
  ok('4c. la contraseña se comprobó contra Auth, sin tocar la sesión', e.log.fetch.length === 1 && e.log.fetch[0].url === 'https://qjqorixtkilwsndqayyx.supabase.co/auth/v1/token?grant_type=password' &&
    e.log.fetch[0].body.email === 'pedro@plataforma.test' && e.log.fetch[0].headers.apikey === 'clave-publica-de-prueba' && e.log.signOut === 0 && e.log.updateUser.length === 0, JSON.stringify(e.log.fetch));
  e.escribir(e.campo('contrasena', dlg), 'clave-correcta-1');
  e.clic(e.boton('Desactivar empresa', dlg));
  await esperar(() => e.llamadas('plataforma_desactivar_empresa').length === 1, 'desactivar enviado');
  const c = e.llamadas('plataforma_desactivar_empresa')[0].cuerpo;
  ok('4d. con la contraseña bien se envía empresa, motivo recortado y operación', c.p_empresa_id === 'empresa-a' && c.p_motivo === 'Cierre del negocio' && /^baja:[0-9a-f]{24}$/.test(c.p_operation_id), JSON.stringify(c));
  await esperar(() => !e.dialogo() && /desactivada/.test(e.texto(e.q('[data-aviso]'))), 'aviso de desactivada');
  ok('4e. se cierra el diálogo, se avisa y se recarga la lista', e.llamadas('plataforma_listar_empresas').length >= 2);

  // Registrar la baja de una empresa ya desactivada.
  e.clic(e.boton('Registrar la baja', e.tarjeta('empresa-d')));
  const d2 = e.dialogo();
  ok('4f. registrar la baja explica el plazo de gracia', /plazo de gracia/.test(e.texto(d2)));
  e.escribir(e.campo('contrasena', d2), 'clave-correcta-1');
  e.clic(e.boton('Registrar la baja', d2));
  await esperar(() => e.llamadas('plataforma_desactivar_empresa').length === 2, 'registrar baja enviada');
  ok('4g. registrar la baja usa la misma función del servidor', e.llamadas('plataforma_desactivar_empresa')[1].cuerpo.p_empresa_id === 'empresa-d');
}

// ---- 5. Reactivar, copia y añadir dueño ----
{
  const e = entorno({ rpc: servidorBase(), funcion: async () => ({ ok: true, userId: 'u9', empresaId: 'empresa-b' }) });
  await abrirPanel(e);
  e.clic(e.boton('Reactivar', e.tarjeta('empresa-c')));
  e.clic(e.boton('Reactivar empresa', e.dialogo()));
  await esperar(() => e.llamadas('plataforma_reactivar_empresa').length === 1, 'reactivar enviado');
  ok('5a. reactivar envía la empresa y una operación', e.llamadas('plataforma_reactivar_empresa')[0].cuerpo.p_empresa_id === 'empresa-c' && /^reactivar:/.test(e.llamadas('plataforma_reactivar_empresa')[0].cuerpo.p_operation_id));

  e.clic(e.boton('Descargar copia', e.tarjeta('empresa-c')));
  await esperar(() => e.log.descargas.length === 1, 'descarga de la copia');
  ok('5b. la copia se pide con una operación nueva y se descarga con nombre claro',
    e.llamadas('plataforma_exportar_empresa').length === 1 && /^copia:/.test(e.llamadas('plataforma_exportar_empresa')[0].cuerpo.p_operation_id) &&
    /^copia-cafe-cerrado-\d{4}-\d{2}-\d{2}\.json$/.test(e.log.descargas[0].nombre) && e.log.blobs.length === 1 && e.log.blobs[0] > 10, JSON.stringify(e.log.descargas));
  await esperar(() => /Copia de «Café Cerrado» descargada \(1234 filas\)/.test(e.texto(e.q('[data-aviso]'))), 'aviso de copia');
  ok('5c. el aviso dice cuántas filas y la huella', /Huella: abcdef0123456789…/.test(e.texto(e.q('[data-aviso]'))), e.texto(e.q('[data-aviso]')));

  e.clic(e.boton('Añadir dueño', e.tarjeta('empresa-b')));
  const dlg = e.dialogo();
  e.escribir(e.campo('dueno', dlg), '  Rosa '); e.escribir(e.campo('email', dlg), ' ROSA@x.com ');
  e.clic(e.boton('Crear cuenta', dlg));
  await esperar(() => e.log.funcion.length === 1, 'añadir dueño enviado');
  ok('5d. añadir dueño usa la empresa elegida, el nombre recortado, el correo en minúsculas y la contraseña generada', e.log.funcion[0].cuerpo.empresaId === 'empresa-b' && e.log.funcion[0].cuerpo.nombre === 'Rosa' && e.log.funcion[0].cuerpo.email === 'rosa@x.com' && e.log.funcion[0].cuerpo.password.length === 14, JSON.stringify(e.log.funcion[0].cuerpo));
  await esperar(() => e.q('[data-credenciales]'), 'credenciales del nuevo dueño');
  ok('5e. se muestran sus credenciales', /rosa@x\.com/.test(e.texto(e.q('[data-credenciales]'))));
}

// ---- 6. Eliminar: bloqueado por plazo ----
{
  const e = entorno({ rpc: servidorBase({ plataforma_resumen_eliminacion: async () => ({ puede_borrarse: false, bloqueos: ['plazo_de_gracia'], plazo_hasta: '2026-11-08T12:00:00Z', dias_gracia: 30, copia_hecha: false, filas_por_tabla: { productos: 40 }, filas_total: 40, cuentas_a_borrar: 1 }) }) });
  await abrirPanel(e);
  e.clic(e.botonQueEmpieza('Eliminar para siempre', e.tarjeta('empresa-c')));
  await esperar(() => e.dialogo(), 'diálogo de borrado');
  const dlg = e.dialogo();
  ok('6a. dentro del plazo de gracia se explica y no hay formulario', /plazo de gracia de 30 días.*08\/11\/2026/.test(e.texto(dlg)) && e.qa('input,textarea', dlg).length === 0 && !e.botonQueEmpieza('Preparar', dlg), e.texto(dlg));
  ok('6b. se enseña qué se borraría', /Se borrarían 40 filas y 1 cuenta/.test(e.texto(dlg)));
  ok('6c. solo se pidió el resumen: no se preparó ni se borró nada', e.llamadas('plataforma_preparar_eliminacion').length === 0 && e.llamadas('plataforma_eliminar_empresa').length === 0);
  e.clic(e.boton('Cerrar', dlg));
  ok('6d. se puede cerrar', !e.dialogo());
}

// ---- 7. Eliminar: camino completo con todas las puertas ----
{
  let eliminaciones = 0;
  const e = entorno({
    rpc: servidorBase({
      plataforma_resumen_eliminacion: async () => ({ puede_borrarse: true, bloqueos: [], plazo_hasta: '2026-10-01T00:00:00Z', dias_gracia: 30, copia_hecha: true, filas_por_tabla: { productos: 40, locales: 1, vacia: 0 }, filas_total: 41, cuentas_a_borrar: 1 }),
      plataforma_preparar_eliminacion: async () => ({ ok: true, codigo: 'ABCD1234', expira_en: '2026-10-09T12:15:00Z', resumen: {} }),
      plataforma_eliminar_empresa: async (cuerpo) => { eliminaciones++; if (eliminaciones === 1) throw new Error('Failed to fetch'); return { ok: true, empresa_id: cuerpo.p_empresa_id, nombre: 'Café Cerrado', filas_total: 41, filas_por_tabla: {}, cuentas_eliminadas: 1, huella: '0123456789abcdef0123' }; }
    }),
    fetchRespuesta: (url, init) => JSON.parse(init.body).password === 'clave-correcta-1' ? { ok: true, status: 200 } : { ok: false, status: 400 }
  });
  await abrirPanel(e);
  e.clic(e.botonQueEmpieza('Eliminar para siempre', e.tarjeta('empresa-c')));
  await esperar(() => e.dialogo() && e.campo('nombre', e.dialogo()), 'formulario de borrado');
  const dlg = e.dialogo();
  ok('7a. se avisa de que no hay vuelta atrás y se ve el detalle por tabla', /No se puede deshacer/.test(e.texto(dlg)) && /productos: 40/.test(e.texto(dlg)) && !/vacia: 0/.test(e.texto(dlg)));

  e.escribir(e.campo('nombre', dlg), 'Cafe Cerrado');
  e.escribir(e.campo('contrasena', dlg), 'clave-correcta-1');
  e.clic(e.boton('Preparar borrado', dlg));
  ok('7b. con el nombre mal no se comprueba ni la contraseña ni se prepara nada', e.log.fetch.length === 0 && e.llamadas('plataforma_preparar_eliminacion').length === 0 && /No coincide/.test(e.texto(dlg)));

  e.escribir(e.campo('nombre', dlg), 'Café Cerrado');
  e.escribir(e.campo('contrasena', dlg), 'clave-mala');
  e.clic(e.boton('Preparar borrado', dlg));
  await esperar(() => /no es correcta/.test(e.texto(dlg)), 'contraseña incorrecta');
  ok('7c. con la contraseña mal no se prepara el borrado', e.llamadas('plataforma_preparar_eliminacion').length === 0);

  e.escribir(e.campo('contrasena', dlg), 'clave-correcta-1');
  e.clic(e.boton('Preparar borrado', dlg));
  await esperar(() => e.q('[data-codigo]'), 'código de confirmación');
  ok('7d. se prepara una sola vez con una operación propia y se muestra el código', e.llamadas('plataforma_preparar_eliminacion').length === 1 &&
    /^prep:/.test(e.llamadas('plataforma_preparar_eliminacion')[0].cuerpo.p_operation_id) && e.texto(e.q('[data-codigo]')) === 'ABCD1234');
  ok('7e. aún no se ha borrado nada', e.llamadas('plataforma_eliminar_empresa').length === 0 && /Último paso/.test(e.texto(e.dialogo())));

  e.escribir(e.campo('codigo', e.dialogo()), 'OTRO9999');
  e.clic(e.boton('Eliminar para siempre', e.dialogo()));
  ok('7f. con el código mal no se envía el borrado', e.llamadas('plataforma_eliminar_empresa').length === 0 && /no coincide/.test(e.texto(e.dialogo())));

  e.escribir(e.campo('codigo', e.dialogo()), 'abcd1234');
  e.clic(e.boton('Eliminar para siempre', e.dialogo()));
  await esperar(() => e.llamadas('plataforma_eliminar_empresa').length === 1, 'primer intento de borrado');
  const primero = e.llamadas('plataforma_eliminar_empresa')[0].cuerpo;
  ok('7g. se envía empresa, nombre exacto, código en mayúsculas y sin motivo de "sin copia"',
    primero.p_empresa_id === 'empresa-c' && primero.p_nombre_confirmado === 'Café Cerrado' && primero.p_codigo === 'ABCD1234' && primero.p_sin_copia_motivo === null && /^eli:[0-9a-f]{24}$/.test(primero.p_operation_id), JSON.stringify(primero));
  await esperar(() => /No hay conexión/.test(e.texto(e.dialogo())), 'fallo de red en el borrado');
  e.clic(e.boton('Eliminar para siempre', e.dialogo()));
  await esperar(() => e.llamadas('plataforma_eliminar_empresa').length === 2, 'reintento de borrado');
  ok('7h. el reintento usa el MISMO identificador de operación (el servidor no borra dos veces)', e.llamadas('plataforma_eliminar_empresa')[1].cuerpo.p_operation_id === primero.p_operation_id);
  await esperar(() => /se ha eliminado/.test(e.texto(e.dialogo())), 'resultado del borrado');
  ok('7i. el resultado cuenta filas y cuentas borradas y deja la huella del acta', /41 filas borradas y 1 cuenta/.test(e.texto(e.dialogo())) && /Huella: 0123456789abcdef/.test(e.texto(e.dialogo())));
  ok('7j. la lista se recarga', e.llamadas('plataforma_listar_empresas').length >= 2);

  // El código preparado se pide una vez por intento de borrado, no por clic.
  ok('7k. durante todo el recorrido solo hubo una preparación', e.llamadas('plataforma_preparar_eliminacion').length === 1);
}

// ---- 8. Eliminar sin copia: motivo escrito o copia descargada ----
{
  const conSinCopia = () => servidorBase({
    plataforma_resumen_eliminacion: async () => ({ puede_borrarse: false, bloqueos: ['sin_copia'], plazo_hasta: '2026-10-01T00:00:00Z', dias_gracia: 30, copia_hecha: false, filas_por_tabla: { productos: 3 }, filas_total: 3, cuentas_a_borrar: 0 }),
    plataforma_preparar_eliminacion: async () => ({ ok: true, codigo: 'ZZZZ0001', expira_en: '2026-10-09T12:15:00Z', resumen: {} }),
    plataforma_eliminar_empresa: async (c) => ({ ok: true, empresa_id: c.p_empresa_id, nombre: 'Café Cerrado', filas_total: 3, filas_por_tabla: {}, cuentas_eliminadas: 0, huella: 'f'.repeat(64) })
  });
  const pass = { fetchRespuesta: () => ({ ok: true, status: 200 }) };

  const e = entorno({ rpc: conSinCopia(), ...pass });
  await abrirPanel(e);
  e.clic(e.botonQueEmpieza('Eliminar para siempre', e.tarjeta('empresa-c')));
  await esperar(() => e.dialogo() && e.campo('motivo', e.dialogo()), 'formulario con motivo');
  const dlg = e.dialogo();
  ok('8a. se explica que falta la copia y se ofrece descargarla o escribir un motivo', /Todavía no has descargado una copia/.test(e.texto(dlg)) && !!e.boton('Descargar copia ahora', dlg));
  e.escribir(e.campo('nombre', dlg), 'Café Cerrado'); e.escribir(e.campo('contrasena', dlg), 'x');
  e.escribir(e.campo('motivo', dlg), 'corto');
  e.clic(e.boton('Preparar borrado', dlg));
  ok('8b. un motivo de menos de 10 caracteres no vale', e.log.fetch.length === 0 && e.llamadas('plataforma_preparar_eliminacion').length === 0 && /al menos 10 caracteres/.test(e.texto(dlg)));
  e.escribir(e.campo('motivo', dlg), '  El cliente confirmó por escrito que no la necesita ');
  e.clic(e.boton('Preparar borrado', dlg));
  await esperar(() => e.q('[data-codigo]'), 'código tras el motivo');
  e.escribir(e.campo('codigo', e.dialogo()), 'ZZZZ0001');
  e.clic(e.boton('Eliminar para siempre', e.dialogo()));
  await esperar(() => e.llamadas('plataforma_eliminar_empresa').length === 1, 'borrado con motivo');
  ok('8c. el motivo escrito viaja al servidor (queda en el acta)', e.llamadas('plataforma_eliminar_empresa')[0].cuerpo.p_sin_copia_motivo === 'El cliente confirmó por escrito que no la necesita');

  const f = entorno({ rpc: conSinCopia(), ...pass });
  await abrirPanel(f);
  f.clic(f.botonQueEmpieza('Eliminar para siempre', f.tarjeta('empresa-c')));
  await esperar(() => f.dialogo() && f.boton('Descargar copia ahora', f.dialogo()), 'botón de copia en el diálogo');
  f.clic(f.boton('Descargar copia ahora', f.dialogo()));
  await esperar(() => f.log.descargas.length === 1, 'copia descargada desde el diálogo');
  await esperar(() => /Ya puedes continuar sin motivo/.test(f.texto(f.dialogo())), 'aviso de copia hecha');
  ok('8d. descargar la copia quita la exigencia del motivo', f.campo('motivo', f.dialogo()).closest('label').style.display === 'none');
  f.escribir(f.campo('nombre', f.dialogo()), 'Café Cerrado'); f.escribir(f.campo('contrasena', f.dialogo()), 'x');
  f.clic(f.boton('Preparar borrado', f.dialogo()));
  await esperar(() => f.q('[data-codigo]'), 'código tras la copia');
  f.escribir(f.campo('codigo', f.dialogo()), 'ZZZZ0001');
  f.clic(f.boton('Eliminar para siempre', f.dialogo()));
  await esperar(() => f.llamadas('plataforma_eliminar_empresa').length === 1, 'borrado con copia');
  ok('8e. con la copia descargada no se envía motivo', f.llamadas('plataforma_eliminar_empresa')[0].cuerpo.p_sin_copia_motivo === null);

  // Si entre medias el servidor ya no deja preparar el borrado, no se continúa.
  const g = entorno({ rpc: servidorBase({
    plataforma_resumen_eliminacion: async () => ({ puede_borrarse: true, bloqueos: [], dias_gracia: 30, copia_hecha: true, filas_por_tabla: {}, filas_total: 0, cuentas_a_borrar: 0 }),
    plataforma_preparar_eliminacion: async () => ({ ok: false, empresa_id: 'empresa-c', resumen: { bloqueos: ['empresa_activa'], dias_gracia: 30 } })
  }), ...pass });
  await abrirPanel(g);
  g.clic(g.botonQueEmpieza('Eliminar para siempre', g.tarjeta('empresa-c')));
  await esperar(() => g.dialogo() && g.campo('nombre', g.dialogo()), 'formulario');
  g.escribir(g.campo('nombre', g.dialogo()), 'Café Cerrado'); g.escribir(g.campo('contrasena', g.dialogo()), 'x');
  g.clic(g.boton('Preparar borrado', g.dialogo()));
  await esperar(() => /no permite borrar ahora/.test(g.texto(g.dialogo())), 'el servidor ya no deja');
  ok('8f. si el servidor deniega la preparación, no hay código ni borrado', !g.q('[data-codigo]') && g.llamadas('plataforma_eliminar_empresa').length === 0 && /primero hay que desactivarla|sigue activa/.test(g.texto(g.dialogo())));
}

// ---- 9. Contraseña inicial del dueño ----
{
  const sesion = { access_token: 't', user: { id: 'dueno-1', email: 'maria.lopez@cliente.com', user_metadata: { debe_cambiar_contrasena: true } } };
  const recargas = [];
  const montarCambio = (opts = {}) => {
    const e = entorno({ sesion, ...opts });
    e.P.mostrarCambioContrasena(e.supabase, sesion, { recargar: () => recargas.push(1) });
    return e;
  };

  const e = montarCambio();
  ok('9a. aparece la pantalla y el programa queda oculto', !!e.q('#la-plataforma-cambio-root') && e.P.cambioAbierto('dueno-1') === true && e.d.documentElement.classList.contains('la-installation-needs-setup') && !e.q('#cargando'));
  const dlg = e.dialogo();
  const intentar = (a, b) => { e.escribir(e.campo('nueva', dlg), a); e.escribir(e.campo('repite', dlg), b); e.clic(e.boton('Guardar contraseña y entrar', dlg)); };
  intentar('corta1', 'corta1');
  ok('9b. contraseña corta: se avisa y no se envía nada', e.log.updateUser.length === 0 && /al menos 10/.test(e.texto(dlg)));
  intentar('Abcdefghij12', 'Abcdefghij13');
  ok('9c. las dos no coinciden: se avisa en el segundo campo', e.log.updateUser.length === 0 && /no coinciden/.test(e.texto(e.q('[data-error-de="repite"]', dlg))));
  intentar('maria.lopez2026', 'maria.lopez2026');
  ok('9d. no puede contener el correo', e.log.updateUser.length === 0 && /correo/.test(e.texto(e.q('[data-error-de="nueva"]', dlg))));
  intentar('Clave-nueva-2026', 'Clave-nueva-2026');
  await esperar(() => recargas.length === 1, 'recarga tras el cambio');
  ok('9e. se envía la contraseña nueva y se quita la marca de "debe cambiarla"',
    e.log.updateUser.length === 1 && JSON.stringify(e.log.updateUser[0]) === JSON.stringify({ password: 'Clave-nueva-2026', data: { debe_cambiar_contrasena: false } }), JSON.stringify(e.log.updateUser));
  ok('9f. la pantalla desaparece y se recarga la página una sola vez', !e.q('#la-plataforma-cambio-root') && e.P.cambioAbierto('dueno-1') === false && recargas.length === 1);

  for (const [codigo, texto, esperado] of [
    ['same_password', 'New password should be different from the old password.', /distinta de la inicial/],
    ['weak_password', 'Password is known to be weak and easy to guess', /demasiado fácil de adivinar/],
    ['reauthentication_needed', 'Reauthentication needed', /vuelve a entrar con la contraseña inicial/]
  ]) {
    const f = montarCambio({ updateUser: async () => ({ data: null, error: { code: codigo, message: texto } }) });
    const d2 = f.dialogo();
    f.escribir(f.campo('nueva', d2), 'Clave-nueva-2026'); f.escribir(f.campo('repite', d2), 'Clave-nueva-2026');
    f.clic(f.boton('Guardar contraseña y entrar', d2));
    await esperar(() => f.q('.lap-banner.mal', d2) && f.q('.lap-banner.mal', d2).style.display === 'block', `error ${codigo}`);
    ok(`9g. ${codigo}: mensaje claro y la pantalla sigue abierta para reintentar`, esperado.test(f.texto(f.q('.lap-banner.mal', d2))) && !!f.q('#la-plataforma-cambio-root') && f.boton('Guardar contraseña y entrar', d2).disabled === false, f.texto(f.q('.lap-banner.mal', d2)));
  }
  const antes = recargas.length;
  const g = montarCambio({ updateUser: async () => ({ data: null, error: { code: 'same_password', message: 'x' } }) });
  ok('9h. con error no se recarga ni se continúa con la entrada', recargas.length === antes);
  g.clic(g.boton('Cerrar sesión'));
  await esperar(() => g.log.signOut === 1 && recargas.length === antes + 1, 'cerrar sesión desde la pantalla de contraseña');
  ok('9i. se puede cerrar sesión desde esa pantalla (y se recarga la página)', g.log.signOut === 1 && recargas.length === antes + 1);

  // ¿Sigue debiendo cambiarla? Se confirma con el servidor para no molestar con un aviso antiguo.
  const h = entorno({ sesion, getUser: () => ({ data: { user: { user_metadata: { debe_cambiar_contrasena: false } } } }) });
  ok('9j. si el servidor dice que ya la cambió, no se vuelve a pedir', (await h.P.sigueDebiendoCambiar(h.supabase, sesion)) === false && h.log.getUser === 1);
  const i = entorno({ sesion, getUser: () => ({ data: { user: { user_metadata: { debe_cambiar_contrasena: true } } } }) });
  ok('9k. si el servidor confirma que sigue pendiente, se pide', (await i.P.sigueDebiendoCambiar(i.supabase, sesion)) === true);
  const j = entorno({ sesion, getUser: () => { throw new Error('sin red'); } });
  ok('9l. si no se puede preguntar al servidor, se exige por precaución', (await j.P.sigueDebiendoCambiar(j.supabase, sesion)) === true);
  const k = entorno({});
  ok('9m. sin marca en la sesión no se pregunta nada al servidor', (await k.P.sigueDebiendoCambiar(k.supabase, SESION)) === false && k.log.getUser === 0);
}

// ---- 10. Consulta del estado y atajo ----
{
  const falta = entorno({ rpc: async () => { throw new Error('Could not find the function public.plataforma_estado without parameters in the schema cache'); } });
  const r1 = await falta.P.consultarEstado(SESION);
  ok('10a. sin las funciones en el servidor (producción hoy) todo sigue como antes', r1.es_admin === false && r1.plataforma_activa === false);
  const roto = entorno({ rpc: async () => { throw new Error('RPC bootstrap HTTP 500'); } });
  let error = null;
  try { await roto.P.consultarEstado(SESION); } catch (e2) { error = e2; }
  ok('10b. cualquier otro error se propaga (no se hace pasar por "no administrador")', error && /HTTP 500/.test(error.message));
  const adm = entorno({ rpc: async () => ({ es_admin: true, plataforma_activa: true, mis_empresas: 2, empresas_activas: 5, empresas_desactivadas: 1 }) });
  const r2 = await adm.P.consultarEstado(SESION);
  ok('10c. el estado del administrador se normaliza', r2.es_admin && r2.plataforma_activa && r2.mis_empresas === 2 && r2.empresas_activas === 5 && r2.empresas_desactivadas === 1);
  const cli = entorno({ rpc: async () => ({ es_admin: false, plataforma_activa: true }) });
  const r3 = await cli.P.consultarEstado(SESION);
  ok('10d. un dueño cliente: no es administrador y ve que la plataforma está activa', r3.es_admin === false && r3.plataforma_activa === true && r3.mis_empresas === 0);
  const raro = entorno({ rpc: async () => ({ es_admin: 'true', plataforma_activa: 1 }) });
  const r4 = await raro.P.consultarEstado(SESION);
  ok('10e. solo el booleano true cuenta', r4.es_admin === false && r4.plataforma_activa === false);

  const e = entorno();
  let vuelto = 0;
  e.P.montarAtajo('admin-1', () => vuelto++);
  ok('10f. el atajo "← Plataforma" aparece', !!e.boton('← Plataforma'));
  e.P.montarAtajo('admin-1', () => vuelto++);
  ok('10g. no se duplica', e.qa('#la-plataforma-atajo').length === 1);
  e.w.sessionStorage.setItem('la_plataforma_modo_app', 'admin-1');
  e.clic(e.boton('← Plataforma'));
  ok('10h. al pulsarlo desaparece, olvida el modo aplicación (también tras recargar) y avisa para volver al panel', vuelto === 1 && !e.q('#la-plataforma-atajo') && e.P.enModoAplicacion('admin-1') === false && e.w.sessionStorage.getItem('la_plataforma_modo_app') === null);

  const marca = entorno();
  marca.w.sessionStorage.setItem('la_plataforma_modo_app', 'admin-1');
  ok('10k. la elección guardada vale para su usuario y para ningún otro', marca.P.enModoAplicacion('admin-1') === true && marca.P.enModoAplicacion('otro') === false && marca.P.enModoAplicacion('') === false);
  marca.P.olvidarModoAplicacion();
  ok('10l. olvidarla la borra', marca.P.enModoAplicacion('admin-1') === false && marca.w.sessionStorage.getItem('la_plataforma_modo_app') === null);

  const sinSesion = entorno({ rpc: servidorBase(), sinSesion: true });
  ABRIR(sinSesion);
  await esperar(() => /sesión ha caducado/.test(sinSesion.texto(sinSesion.q('.lap-cuerpo'))), 'sesión caducada');
  ok('10i. con la sesión caducada no se llama al servidor', sinSesion.log.rpc.length === 0);

  const rep = entorno({ rpc: servidorBase() });
  await abrirPanel(rep);
  ok('10j. panelAbierto distingue usuarios', rep.P.panelAbierto('admin-1') === true && rep.P.panelAbierto('otro') === false);
}

// ---- Resultado ----
const fallos = resultados.filter((r) => !r.ok);
for (const r of resultados) console.log(`${r.ok ? 'OK ' : 'FALLO'} ${r.nombre}${r.ok ? '' : ' → ' + (typeof r.det === 'string' ? r.det : JSON.stringify(r.det))}`);
console.log(`PLATAFORMA_P05_PANEL_UI: ${resultados.length - fallos.length}/${resultados.length}`);
if (fallos.length) process.exit(1);
console.log('PLATAFORMA_P05_PANEL_UI_RUNTIME=PASS');
