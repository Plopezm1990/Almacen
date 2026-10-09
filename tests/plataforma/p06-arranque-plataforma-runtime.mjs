// Prueba de ejecución del ARRANQUE con la plataforma: candado previo + panel + flujo de instalación REALES (los tres archivos
// del programa) en jsdom, con una red simulada a nivel de fetch (así se prueba también que las llamadas salen por los canales
// estrechos del candado y llevan la sesión correcta).
//
//   · el administrador entra en su panel y NO se pregunta por la instalación (aunque no tenga ninguna empresa);
//   · un dueño cliente entra como siempre, y el programa sabe si la plataforma está activa (para no ofrecerle «Añadir empresa»);
//   · un servidor sin las funciones de plataforma (producción hoy) se comporta exactamente como antes;
//   · un error del servidor al preguntar NO se confunde con «no eres administrador»;
//   · el dueño con contraseña inicial pasa por «Elige tu contraseña» antes que nada y después sigue su camino normal;
//   · el administrador con empresa propia puede abrir su aplicación y volver al panel;
//   · una renovación de sesión no reconstruye un panel ni una pantalla de contraseña abiertos; cerrar sesión los quita;
//   · los canales del candado rechazan lo que no está en la lista blanca.
//
// Necesita jsdom: CFG6_UI_DEPS (o CFG6E_UI_DEPS) = carpeta con node_modules que contenga jsdom.
//   CFG6_UI_DEPS=/tmp/cfg6deps node tests/plataforma/p06-arranque-plataforma-runtime.mjs
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

const REPO = resolve(new URL('../../', import.meta.url).pathname);
const leer = (f) => readFileSync(resolve(REPO, f), 'utf8');
// Las variables de entorno permiten probar variantes rotas (mutantes) de cada archivo.
const PRELOCK = leer(process.env.PLATAFORMA_PRELOCK || 'owner-bootstrap-prelock.js');
const PANEL = leer(process.env.PLATAFORMA_PANEL || 'plataforma-panel.js');
const FLUJO = leer(process.env.PLATAFORMA_FLUJO || 'owner-bootstrap-post-reset.js');

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

const BASE = 'https://qjqorixtkilwsndqayyx.supabase.co';
const CONTEXTO_UI = { state: 'ready', generation: 'gen-1', local_id: 'l1', permite_todos_locales: true, empresas: [{ id: 'e1', razonSocial: 'Mi empresa', activo: true }], locales: [{ id: 'l1', empresaId: 'e1', nombre: 'Local 1', activo: true }] };

function usuario(extra = {}) {
  return { id: 'u-1', email: 'alguien@test.com', user_metadata: {}, ...extra };
}

// Monta una "página": candado previo + panel + flujo de instalación, con servidor simulado.
async function arranque({ user = usuario(), estado, instalacion, rpcs = {}, cargarPanel = true, sinSesion = false, getUser } = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div><div id="cargando">Cargando</div></body></html>',
    { url: 'https://deploy-preview-118--chic-entremet-9107cf.netlify.app/', pretendToBeVisual: true, runScripts: 'outside-only' });
  const w = dom.window;
  const red = [];
  const llamadas = (n) => red.filter((r) => r.nombre === n);
  let sesion = { access_token: 'token-1', user };
  const respuesta = (status, datos) => ({ ok: status >= 200 && status < 300, status, text: async () => (datos === undefined ? '' : JSON.stringify(datos)) });

  w.NUBE_URL = BASE;
  w.NUBE_CLAVE = 'clave-publica-de-prueba';
  w.fetch = async (url, init) => {
    const u = new URL(String(url));
    const m = u.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
    const f = u.pathname.match(/^\/functions\/v1\/([a-z-]+)$/);
    const nombre = m ? m[1] : f ? 'fn:' + f[1] : u.pathname;
    const cuerpo = init && init.body ? JSON.parse(init.body) : null;
    red.push({ nombre, cuerpo, auth: init && init.headers && init.headers.Authorization, apikey: init && init.headers && init.headers.apikey, metodo: init && init.method, host: u.origin });
    const h = rpcs[nombre];
    if (h) {
      try { return respuesta(200, await h(cuerpo)); } catch (e) { return respuesta(e.status || 400, { message: e.message }); }
    }
    if (nombre === 'plataforma_estado') {
      if (estado instanceof Error) return respuesta(estado.status || 500, { message: estado.message });
      return respuesta(200, estado);
    }
    if (nombre === 'obtener_estado_instalacion') return respuesta(200, instalacion || { state: 'ready', generation: 'gen-1' });
    if (nombre === 'obtener_contexto_instalacion_ui') return respuesta(200, CONTEXTO_UI);
    if (nombre === 'plataforma_listar_empresas') return respuesta(200, []);
    return respuesta(404, { message: `no previsto en la prueba: ${nombre}` });
  };
  w.eval(PRELOCK); // el candado captura el fetch de arriba como «fetch nativo»
  w.localStorage.setItem('la_suite_installation_generation_v1', 'gen-1');
  w.__prepararSesionPostReset = async () => { w.__instalacionSyncPermitida = true; return { generacionCambiada: false }; };
  let subidas = 0;
  w.subirPendientes = async () => { subidas++; };
  const oyentes = [];
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: sinSesion ? null : sesion } }),
      onAuthStateChange: (cb) => { oyentes.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
      signOut: async () => { sesion = null; oyentes.forEach((cb) => cb('SIGNED_OUT', null)); },
      getUser: async () => (getUser ? getUser() : { data: { user: sesion && sesion.user } }),
      updateUser: async (args) => {
        sesion = { ...sesion, user: { ...sesion.user, user_metadata: { ...sesion.user.user_metadata, ...(args.data || {}) } } };
        return { data: { user: sesion.user }, error: null };
      }
    }
  };
  w.getSupabaseClient = async () => supabase;
  if (cargarPanel) w.eval(PANEL);
  w.eval(FLUJO);
  const d = w.document;
  const api = {
    w, d, red, llamadas, supabase, oyentes,
    subidas: () => subidas,
    sesion: () => sesion,
    q: (s) => d.querySelector(s),
    qa: (s, r) => [...(r || d).querySelectorAll(s)],
    boton: (t) => [...d.querySelectorAll('button')].find((b) => b.textContent.trim() === t) || null,
    texto: (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : ''),
    clic: (el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })),
    escribir: (el, v) => { el.value = v; },
    clases: () => [...d.documentElement.classList]
  };
  return api;
}

const ADMIN = usuario({ id: 'admin-1', email: 'pedro@plataforma.test' });

// ---- 1. Administrador sin empresa propia: panel, y nunca se pregunta por la instalación ----
{
  const a = await arranque({ user: ADMIN, estado: { es_admin: true, plataforma_activa: true, mis_empresas: 0, empresas_activas: 0, empresas_desactivadas: 0 } });
  await esperar(() => a.q('#la-plataforma-root'), 'el administrador ve el panel');
  ok('1a. aparece el panel de Plataforma', !!a.q('#la-plataforma-root') && /Administrador: pedro@plataforma\.test/.test(a.texto(a.q('.lap-barra'))));
  ok('1b. no se pregunta por la instalación ni por el contexto', a.llamadas('obtener_estado_instalacion').length === 0 && a.llamadas('obtener_contexto_instalacion_ui').length === 0);
  ok('1c. el programa queda cerrado a la sincronización', a.w.__laOwnerBootstrapSyncState().bootstrapListo === false && a.w.__instalacionSyncPermitida === false && a.subidas() === 0);
  ok('1d. el programa queda oculto y la pantalla de carga fuera', a.clases().includes('la-installation-needs-setup') && !a.q('#cargando'));
  ok('1e. la plataforma figura como activa', a.w.__laPlataformaActiva === true);
  await esperar(() => a.llamadas('plataforma_listar_empresas').length === 1, 'se pide la lista');
  const est = a.llamadas('plataforma_estado')[0];
  ok('1f. las llamadas salen contra el servidor correcto con la sesión del administrador', est && est.host === BASE && est.auth === 'Bearer token-1' && est.apikey === 'clave-publica-de-prueba' && est.metodo === 'POST');
  ok('1g. sin empresa propia no hay "Abrir mi aplicación"', !a.boton('Abrir mi aplicación'));
}

// ---- 2. Dueño cliente: entra como siempre ----
{
  const a = await arranque({ estado: { es_admin: false, plataforma_activa: true } });
  await esperar(() => a.w.__laOwnerBootstrapSyncState().bootstrapListo === true && a.subidas() === 1, 'el dueño entra a su aplicación');
  ok('2a. sin panel; se sigue el camino de siempre', !a.q('#la-plataforma-root') && a.llamadas('obtener_estado_instalacion').length === 1 && a.llamadas('obtener_contexto_instalacion_ui').length === 1);
  ok('2b. sabe que la plataforma está activa (la pantalla de Empresas no ofrece añadir)', a.w.__laPlataformaActiva === true);
  ok('2c. la vista queda libre', !a.clases().includes('la-installation-checking') && !a.clases().includes('la-installation-needs-setup'));
  ok('2d. se preguntó por la plataforma ANTES que por la instalación', a.red.findIndex((r) => r.nombre === 'plataforma_estado') < a.red.findIndex((r) => r.nombre === 'obtener_estado_instalacion'));
  ok('2e. no aparece el atajo del administrador', !a.q('#la-plataforma-atajo'));
}

// ---- 3. Servidor sin funciones de plataforma (producción hoy) ----
{
  const sinFuncion = Object.assign(new Error('Could not find the function public.plataforma_estado without parameters in the schema cache'), { status: 404 });
  const a = await arranque({ estado: sinFuncion });
  await esperar(() => a.w.__laOwnerBootstrapSyncState().bootstrapListo === true, 'entra como antes');
  ok('3a. entra como antes de existir la plataforma', !a.q('#la-plataforma-root') && a.llamadas('obtener_estado_instalacion').length === 1);
  ok('3b. la plataforma NO figura como activa (se sigue ofreciendo lo de siempre)', a.w.__laPlataformaActiva === false);

  const b = await arranque({ user: ADMIN, estado: sinFuncion, instalacion: { state: 'needs_setup', generation: 'gen-1' } });
  await esperar(() => b.q('#la-installation-setup-root'), 'asistente de primera instalación');
  ok('3c. sin las funciones, la cuenta del propietario sigue viendo su asistente de primera instalación', !!b.q('#la-installation-setup-root') && !b.q('#la-plataforma-root'));
}

// ---- 4. Error del servidor al preguntar: no se confunde con «no eres administrador» ----
{
  const a = await arranque({ user: ADMIN, estado: Object.assign(new Error('boom'), { status: 500 }) });
  await esperar(() => /Reintentar comprobación/.test(a.texto(a.q('#la-installation-setup-root'))), 'pantalla de bloqueo');
  ok('4a. se bloquea con reintento y el mensaje del servidor', /boom/.test(a.texto(a.q('#la-installation-setup-root'))));
  ok('4b. no se pasó a la instalación como si no fuera administrador', a.llamadas('obtener_estado_instalacion').length === 0 && !a.q('#la-plataforma-root') && a.w.__laOwnerBootstrapSyncState().bootstrapListo === false);
}

// ---- 5. Contraseña inicial: primero eso, después el camino normal ----
{
  const user = usuario({ id: 'dueno-1', email: 'maria@cliente.com', user_metadata: { debe_cambiar_contrasena: true } });
  const a = await arranque({ user, estado: { es_admin: false, plataforma_activa: true } });
  await esperar(() => a.q('#la-plataforma-cambio-root'), 'pantalla de contraseña');
  ok('5a. aparece "Elige tu contraseña" antes que cualquier otra cosa', !!a.q('#la-plataforma-cambio-root') && /Elige tu contraseña/.test(a.texto(a.q('#la-plataforma-cambio-root'))));
  ok('5b. no se pregunta ni por la plataforma ni por la instalación', a.llamadas('plataforma_estado').length === 0 && a.llamadas('obtener_estado_instalacion').length === 0 && a.w.__laOwnerBootstrapSyncState().bootstrapListo === false);
  const nueva = a.q('[name="nueva"]'), repite = a.q('[name="repite"]');
  a.escribir(nueva, 'Clave-nueva-2026'); a.escribir(repite, 'Clave-nueva-2026');
  a.clic(a.boton('Guardar contraseña y entrar'));
  await esperar(() => a.w.__laOwnerBootstrapSyncState().bootstrapListo === true && a.subidas() === 1, 'entra tras cambiar la contraseña');
  ok('5c. tras guardarla desaparece la pantalla y sigue el camino normal', !a.q('#la-plataforma-cambio-root') && a.llamadas('plataforma_estado').length === 1 && a.llamadas('obtener_estado_instalacion').length === 1);
  ok('5d. la marca queda quitada en la cuenta', a.sesion().user.user_metadata.debe_cambiar_contrasena === false);
}

// ---- 6. Administrador con empresa propia: abrir su aplicación y volver al panel ----
{
  const a = await arranque({ user: ADMIN, estado: { es_admin: true, plataforma_activa: true, mis_empresas: 1 } });
  await esperar(() => a.boton('Abrir mi aplicación'), 'botón de abrir la aplicación');
  a.clic(a.boton('Abrir mi aplicación'));
  await esperar(() => a.w.__laOwnerBootstrapSyncState().bootstrapListo === true && a.q('#la-plataforma-atajo'), 'aplicación abierta con atajo');
  ok('6a. se abre la aplicación y el panel desaparece', !a.q('#la-plataforma-root') && a.llamadas('obtener_estado_instalacion').length === 1);
  ok('6b. queda el atajo para volver', !!a.q('#la-plataforma-atajo') && a.subidas() === 1);
  a.clic(a.boton('← Plataforma'));
  await esperar(() => a.q('#la-plataforma-root'), 'vuelta al panel');
  ok('6c. el atajo devuelve al panel y cierra la sincronización', !a.q('#la-plataforma-atajo') && a.w.__laOwnerBootstrapSyncState().bootstrapListo === false && a.llamadas('obtener_estado_instalacion').length === 1);
}

// ---- 7. Renovación de sesión y cierre de sesión ----
{
  const a = await arranque({ user: ADMIN, estado: { es_admin: true, plataforma_activa: true, mis_empresas: 0 } });
  await esperar(() => a.q('#la-plataforma-root'), 'panel');
  await esperar(() => a.llamadas('plataforma_listar_empresas').length === 1, 'lista pedida');
  const nodo = a.q('#la-plataforma-root');
  a.oyentes.forEach((cb) => cb('TOKEN_REFRESHED', a.sesion()));
  a.oyentes.forEach((cb) => cb('SIGNED_IN', a.sesion()));
  await dormir(60);
  ok('7a. una renovación de sesión no reconstruye el panel ni vuelve a preguntar', a.q('#la-plataforma-root') === nodo && a.llamadas('plataforma_estado').length === 1 && a.llamadas('plataforma_listar_empresas').length === 1);
  a.oyentes.forEach((cb) => cb('SIGNED_OUT', null));
  await esperar(() => !a.q('#la-plataforma-root'), 'panel cerrado al salir');
  ok('7b. al cerrar sesión desaparece el panel y la vista queda libre para el acceso', !a.q('#la-plataforma-root') && !a.clases().includes('la-installation-needs-setup') && !a.clases().includes('la-installation-checking'));

  const user = usuario({ id: 'dueno-2', email: 'x@cliente.com', user_metadata: { debe_cambiar_contrasena: true } });
  const b = await arranque({ user, estado: { es_admin: false, plataforma_activa: true } });
  await esperar(() => b.q('#la-plataforma-cambio-root'), 'pantalla de contraseña');
  const nodo2 = b.q('#la-plataforma-cambio-root');
  b.escribir(b.q('[name="nueva"]'), 'a medias');
  b.oyentes.forEach((cb) => cb('TOKEN_REFRESHED', b.sesion()));
  await dormir(60);
  ok('7c. una renovación de sesión no borra lo que se está escribiendo', b.q('#la-plataforma-cambio-root') === nodo2 && b.q('[name="nueva"]').value === 'a medias');
  b.oyentes.forEach((cb) => cb('SIGNED_OUT', null));
  await esperar(() => !b.q('#la-plataforma-cambio-root'), 'pantalla cerrada al salir');
  ok('7d. al cerrar sesión desaparece también la pantalla de contraseña', !b.q('#la-plataforma-cambio-root'));
}

// ---- 8. Lista blanca de los canales del candado ----
{
  const a = await arranque({ user: ADMIN, estado: { es_admin: true, plataforma_activa: true, mis_empresas: 0 }, rpcs: { fn: null } });
  const rpc = a.w.__laOwnerBootstrapRpc, fun = a.w.__laOwnerBootstrapFunction;
  const falla = async (p) => { try { await p; return null; } catch (e) { return e.message; } };
  ok('8a. asignar dueño no se puede llamar desde el navegador', /no permitido/.test(await falla(rpc('plataforma_asignar_propietario', 't', {}))));
  ok('8b. ni funciones arbitrarias ni otras Edge Functions', /no permitida/.test(await falla(fun('crear-cuenta-empleado', 't', {}))) && /no permitida/.test(await falla(fun('../rest/v1/rpc/plataforma_estado', 't', {}))));
  ok('8c. sin credenciales no sale ninguna llamada', /Credenciales/.test(await falla(fun('plataforma-crear-propietario', '', {}))));

  const antes = a.red.length;
  a.w.NUBE_URL = 'https://evil.example.com';
  ok('8d. solo contra un backend Supabase', /Backend Supabase no válido/.test(await falla(fun('plataforma-crear-propietario', 't', {}))) && a.red.length === antes);
  a.w.NUBE_URL = BASE;

  const b = await arranque({ user: ADMIN, estado: { es_admin: true, plataforma_activa: true, mis_empresas: 0 }, rpcs: { 'fn:plataforma-crear-propietario': async (cuerpo) => { if (cuerpo.email === 'dup@x.com') { const e = new Error(''); e.status = 409; throw Object.assign(e, { message: 'x' }); } return { ok: true, userId: 'nuevo' }; } } });
  const r = await b.w.__laOwnerBootstrapFunction('plataforma-crear-propietario', 'token-xyz', { empresaId: 'empresa-1', nombre: 'Ana', email: 'ana@x.com', password: 'abcd-efgh-2345' });
  const envio = b.llamadas('fn:plataforma-crear-propietario')[0];
  ok('8e. la función permitida sale por POST con sesión y clave', r && r.ok === true && envio.metodo === 'POST' && envio.auth === 'Bearer token-xyz' && envio.apikey === 'clave-publica-de-prueba' && envio.host === BASE && envio.cuerpo.empresaId === 'empresa-1');
  ok('8f. un error del servidor llega con su mensaje', /x/.test(await falla(b.w.__laOwnerBootstrapFunction('plataforma-crear-propietario', 't', { email: 'dup@x.com' }))));
}

// ---- Resultado ----
const fallos = resultados.filter((r) => !r.ok);
for (const r of resultados) console.log(`${r.ok ? 'OK ' : 'FALLO'} ${r.nombre}${r.ok ? '' : ' → ' + (typeof r.det === 'string' ? r.det : JSON.stringify(r.det))}`);
console.log(`PLATAFORMA_P06_ARRANQUE: ${resultados.length - fallos.length}/${resultados.length}`);
if (fallos.length) process.exit(1);
console.log('PLATAFORMA_P06_ARRANQUE_RUNTIME=PASS');
