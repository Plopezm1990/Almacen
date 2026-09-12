// PM24 P01 — Integraciones controladas (correo, WhatsApp, push, IA).
//
// Ejecuta la app real (index.html + fuente.js) servida como archivos estáticos
// locales, con Chromium (Playwright). Todo el host de producción de Supabase
// (funciones Y REST, cualquier ruta) queda bloqueado por defecto en el propio
// harness de prueba: solo las funciones de integración conocidas
// (enviar-notificacion, entrevista-personal, prefiltro-candidato,
// importar-albaran, importar-nomina) se reenvían, desde este proceso Node
// -nunca desde el navegador-, al proyecto QA real, con una sesión real de
// owner.a. Cualquier otra petición al host de producción se aborta y se
// registra. Esta redirección existe únicamente en este arnés de prueba: no
// se modifica fuente.js ni la configuración de producción.
//
// El navegador de este entorno no tiene salida de red fiable hacia QA
// (verificado: 3/3 intentos directos fallaron) -- por eso la relación con QA
// para las funciones "de éxito real" la hace este proceso Node (que sí tiene
// salida de red fiable, usada en toda la sesión), nunca el propio navegador.

import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const BASE_URL = process.env.PM24_BASE_URL || 'http://127.0.0.1:4173/';
const EXECUTABLE_PATH = process.env.PM24_CHROMIUM_PATH || undefined;
const QA_URL = process.env.QA_API_URL;
const QA_ANON = process.env.QA_ANON_KEY;
const QA_PASSWORD = process.env.QA_P03_PASSWORD;
const PROD_HOST = 'flqercbgpgmmfaakrwkc.supabase.co';

const RUTAS_QA = {
  'importar-albaran': 'importar-albaran',
  'importar-nomina': 'importar-nomina',
  'entrevista-personal': 'entrevista-personal',
  'prefiltro-candidato': 'prefiltro-candidato',
  'enviar-notificacion': 'enviar-notificacion'
};

const resultados = [];
const bloqueadas = [];
const evidenciaDir = new URL('./evidencia/', import.meta.url);
fs.mkdirSync(evidenciaDir, { recursive: true });

function registrar(caso, ok, detalle) {
  resultados.push({ caso, ok, detalle });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${caso}${detalle ? ' — ' + JSON.stringify(detalle) : ''}`);
}

async function signIn(email, password) {
  const r = await fetch(`${QA_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: QA_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await r.json();
  if (r.status !== 200) throw new Error('login QA fallido: ' + JSON.stringify(data));
  return data.access_token;
}

const tokenQA = await signIn('owner.a@qa.invalid', QA_PASSWORD);

// modo mutable: qué debe hacer el interceptor con la PRÓXIMA petición a una
// función de integración conocida.
let modoActual = { tipo: 'relay-qa' };

async function nuevoContexto(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());

    if (['cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'esm.sh'].includes(url.hostname)) {
      return route.abort();
    }

    if (url.hostname === PROD_HOST) {
      const prefijoFunciones = '/functions/v1/';
      if (url.pathname.startsWith(prefijoFunciones)) {
        const slug = url.pathname.slice(prefijoFunciones.length).split('/')[0];
        const slugQA = RUTAS_QA[slug];
        if (slugQA) {
          return manejarFuncionConocida(route, slugQA, req);
        }
      }
      bloqueadas.push({ url: req.url(), method: req.method(), motivo: 'host de producción, ruta no autorizada' });
      return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Bloqueado por el arnés de prueba: ruta de producción no autorizada' }) });
    }

    return route.continue();
  });
  return context;
}

async function manejarFuncionConocida(route, slugQA, req) {
  const modo = modoActual;
  if (modo.tipo === 'timeout') {
    // Nunca resuelve dentro de la ventana de espera del test -- simula un cuelgue de red.
    return new Promise(() => {});
  }
  if (modo.tipo === 'disconnect') {
    return route.abort('connectionreset');
  }
  if (modo.tipo === '5xx') {
    return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Error simulado por el arnés de prueba' }) });
  }
  if (modo.tipo === 'invalid-json') {
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{ esto no es json válido' });
  }
  // relay-qa: reenviar de verdad a la Edge Function real de QA, desde este proceso Node.
  const headers = { 'Content-Type': 'application/json', apikey: QA_ANON };
  const authOriginal = req.headers()['authorization'];
  headers['Authorization'] = authOriginal && modo.tipo !== 'relay-qa-sin-auth' ? `Bearer ${tokenQA}` : `Bearer ${tokenQA}`;
  if (modo.tipo === 'relay-qa-sin-auth') delete headers['Authorization'];
  const resp = await fetch(`${QA_URL}/functions/v1/${slugQA}`, {
    method: req.method(), headers, body: req.method() === 'POST' ? req.postData() : undefined
  });
  const body = await resp.text();
  return route.fulfill({ status: resp.status, contentType: resp.headers.get('content-type') || 'application/json', body });
}

async function entrarModoLocal(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.getByText(/Trabajar solo en este equipo/i).click({ force: true, timeout: 10000 });
  await page.waitForTimeout(2000);
}

// ===================================================================
// A. Enlaces manuales (correo/WhatsApp) — sin red, solo generación de enlace.
// ===================================================================
async function configurarEmpresaYLocal(page) {
  // Proveedores/pedidos exigen una empresa y un local activo concretos
  // (multiempresa/multilocal): sin esto, crearProveedor()/crearLocal()
  // devuelven error de validación en silencio para el flujo de la prueba
  // (el formulario se queda abierto sin avisar visualmente de forma obvia).
  await page.locator('button, a, [role="button"]').filter({ hasText: 'Locales' }).first().click({ force: true });
  await page.waitForTimeout(600);
  await page.getByText('+ Añadir empresa', { exact: true }).click({ force: true });
  await page.waitForTimeout(400);
  await page.getByLabel('Razón social', { exact: true }).fill('QA PM24 Empresa').catch(async () => {
    await page.locator('input').first().fill('QA PM24 Empresa');
  });
  await page.getByText('Crear empresa', { exact: true }).click({ force: true });
  await page.waitForTimeout(500);
  await page.getByText('+ Añadir local nuevo', { exact: true }).click({ force: true });
  await page.waitForTimeout(400);
  await page.getByPlaceholder('Ej: San Ginés Centro').fill('QA PM24 Local');
  await page.getByText('Crear local', { exact: true }).click({ force: true });
  await page.waitForTimeout(500);
  await page.getByText('Usar este', { exact: true }).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(400);
}

async function probarEnlacesManuales(browser) {
  const context = await nuevoContexto(browser);
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  await entrarModoLocal(page);
  await configurarEmpresaYLocal(page);

  async function crearProveedor(nombre, email, telefono) {
    await page.locator('button, a, [role="button"]').filter({ hasText: 'Proveedores' }).first().click({ force: true });
    await page.waitForTimeout(600);
    // El botón "Nuevo proveedor" a veces no registra el primer click (React
    // todavía montando el listado) — se reintenta hasta que el formulario
    // aparece de verdad.
    let abierto = false;
    for (let intento = 0; intento < 3 && !abierto; intento++) {
      await page.getByText(/Nuevo proveedor/i).first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(700);
      abierto = await page.getByText('Nombre del proveedor', { exact: true }).isVisible().catch(() => false);
    }
    if (!abierto) {
      await page.screenshot({ path: new URL('debug-proveedor-form.png', evidenciaDir).pathname }).catch(() => {});
      throw new Error('El formulario "Nuevo proveedor" no llegó a abrirse tras 3 intentos. Texto visible: ' + (await page.locator('body').innerText()).slice(-800));
    }
    // Estos campos no fijan un atributo "type" explícito (son texto por
    // defecto vía la propiedad DOM, pero el selector CSS [type="text"] o
    // [type="tel"] no los encuentra) — se usa el nombre accesible real
    // (la etiqueta <label> que ya envuelve cada campo) en su lugar.
    await page.getByLabel('Nombre del proveedor', { exact: true }).fill(nombre);
    if (email) {
      await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
    }
    if (telefono) {
      await page.getByLabel('Teléfono (WhatsApp)', { exact: true }).fill(telefono);
    }
    const guardar = page.locator('button').filter({ hasText: /^Guardar|Crear proveedor|Añadir proveedor/i }).first();
    if (await guardar.count()) await guardar.click({ force: true });
    await page.waitForTimeout(600);
  }

  await crearProveedor('QA PM24 Proveedor Completo', 'proveedor.pm24@qa.invalid', '+34600111222');
  await crearProveedor('QA PM24 Proveedor Sin Contacto', '', '');

  // El pedido exige al menos un producto en la lista (submit() rechaza
  // items.length === 0 con "Añade al menos un producto al pedido."), y
  // addItemRow() en sí no hace nada si el catálogo global está vacío
  // (if (!productos.length) return;) — así que hace falta al menos un
  // producto dado de alta desde el módulo Productos ANTES de intentar
  // crear ningún pedido (la opción "+ Es un producto nuevo…" dentro de la
  // fila del pedido solo sirve para añadir el segundo producto en adelante).
  await page.locator('button, a, [role="button"]').filter({ hasText: 'Productos' }).first().click({ force: true });
  await page.waitForTimeout(600);
  await page.getByText(/Nuevo producto/i).first().click({ force: true });
  await page.waitForTimeout(500);
  await page.locator('input').first().fill('QA PM24 Producto');
  await page.getByLabel('Costo UNIDAD sin IVA (€)', { exact: true }).fill('10');
  await page.getByLabel('Stock inicial', { exact: true }).fill('0');
  await page.getByLabel('Stock mínimo (reorden)', { exact: true }).fill('0');
  await page.getByText('Guardar producto', { exact: true }).click({ force: true });
  await page.waitForTimeout(700);

  // Crear un pedido para cada proveedor y revisar los enlaces generados.
  await page.locator('button, a, [role="button"]').filter({ hasText: 'Pedidos' }).first().click({ force: true });
  await page.waitForTimeout(600);

  for (const nombreProv of ['QA PM24 Proveedor Completo', 'QA PM24 Proveedor Sin Contacto']) {
    await page.getByText(/Nuevo pedido/i).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
    const selectProveedor = page.locator('select').first();
    if (await selectProveedor.count()) {
      await selectProveedor.selectOption({ label: nombreProv }).catch(() => {});
    }
    await page.waitForTimeout(300);
    // addItemRow() añade siempre productos[0] por defecto — con un solo
    // producto en el catálogo no hace falta elegirlo explícitamente en el
    // <select> de la fila.
    await page.getByText('+ Añadir producto al pedido', { exact: true }).click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
    const crear = page.locator('button').filter({ hasText: /^Crear pedido$/i }).first();
    if (await crear.count()) await crear.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    // Al crear el pedido se abre un modal "¿cómo quieres enviarlo?" que hay
    // que cerrar explícitamente (si no, tapa el botón "Nuevo pedido" de la
    // siguiente vuelta).
    const ahoraNo = page.getByText('Ahora no', { exact: true });
    if (await ahoraNo.isVisible().catch(() => false)) await ahoraNo.click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }

  const whatsappLinks = await page.locator('a', { hasText: /WhatsApp/i }).evaluateAll(els => els.map(e => e.getAttribute('href')));
  registrar('enlaces: se generó al menos un enlace de WhatsApp', whatsappLinks.length > 0, { total: whatsappLinks.length });

  const conNumero = whatsappLinks.filter(h => /wa\.me\/\d/.test(h || ''));
  const sinNumero = whatsappLinks.filter(h => /wa\.me\/(\?|$)/.test(h || ''));
  registrar('enlaces: WhatsApp con proveedor CON teléfono lleva el número codificado', conNumero.length > 0, { ejemplo: conNumero[0] });
  // Defecto real encontrado y corregido en esta misma tanda: el botón
  // "Enviar por WhatsApp" se generaba también para proveedores sin teléfono
  // (enlace sin destinatario, sin aviso ni bloqueo). Se corrigió para que
  // aparezca solo si el proveedor tiene teléfono, igual que ya hacía
  // "Llamar" — este caso verifica la corrección: exactamente un enlace de
  // WhatsApp (el del proveedor CON teléfono) y ninguno sin destinatario.
  registrar('CORREGIDO: WhatsApp ya no se genera para proveedores sin teléfono', sinNumero.length === 0 && whatsappLinks.length === 1, {
    total: whatsappLinks.length,
    sinNumero
  });

  // Correo: a diferencia de WhatsApp, "Enviar por correo" abre un modal con
  // los campos (incluido el destinatario) antes de hacer nada — se verifica
  // que el destinatario mostrado es el correo real del proveedor de ESE
  // pedido (sin mezclarlo con el del otro) y qué pasa cuando no hay correo.
  // Sin anclas ^$: el botón real lleva un icono antes del texto ("<Mail/> Enviar
  // por correo"), así que el textContent trae un espacio inicial que rompe un
  // regex anclado (ya visto antes con otros botones con icono).
  const botonesCorreo = page.locator('button').filter({ hasText: /Enviar por correo/i });
  const totalBotonesCorreo = await botonesCorreo.count();
  for (let i = 0; i < totalBotonesCorreo; i++) {
    const boton = botonesCorreo.nth(i);
    const proveedorDelBoton = await boton.evaluate(el => {
      let n = el;
      for (let subida = 0; subida < 6 && n; subida++) {
        n = n.parentElement;
        const m = n && n.textContent && n.textContent.match(/QA PM24 Proveedor (Completo|Sin Contacto)/);
        if (m) return m[0];
      }
      return null;
    });
    await boton.click({ force: true });
    await page.waitForTimeout(400);
    const destinatario = await page.locator('input[readonly]').first().inputValue().catch(() => null);
    const emailEsperado = proveedorDelBoton === 'QA PM24 Proveedor Completo' ? 'proveedor.pm24@qa.invalid' : '';
    registrar(`correo: destinatario mostrado corresponde al proveedor correcto (${proveedorDelBoton})`, destinatario === emailEsperado, { proveedorDelBoton, esperado: emailEsperado || '(vacío)', encontrado: destinatario });
    if (emailEsperado === '') {
      registrar('HALLAZGO: correo con proveedor SIN email abre el modal de envío igualmente (sin aviso ni bloqueo previo)', true, {
        nota: 'a diferencia de WhatsApp, aquí el destinatario vacío SÍ es visible en el campo "Destinatario" antes de que el usuario elija una app de correo — mitiga parcialmente el mismo problema, pero no impide llegar hasta ahí.'
      });
    }
    await page.getByText('Cerrar', { exact: true }).click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }

  await browser_close_context(context);
  return { whatsappLinks };

  async function browser_close_context(ctx) { await ctx.close(); }
}

// ===================================================================
// B. IA — entrevista-personal, recorrido real desde la interfaz.
// ===================================================================
async function probarEntrevistaPersonal(browser, modo, etiqueta) {
  modoActual = modo;
  const context = await nuevoContexto(browser);
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const erroresPagina = [];
  page.on('pageerror', (e) => erroresPagina.push(e.message));

  if (modo.tipo === 'auth-rejection') {
    // Sin sesión real de ningún tipo: edge-auth-patch debe rechazar en el propio navegador,
    // sin llegar siquiera a la red -- no hace falta preparar nada más.
  }

  await entrarModoLocal(page);
  await page.locator('button, a, [role="button"]').filter({ hasText: 'Personal' }).first().click({ force: true });
  await page.waitForTimeout(600);
  await page.getByText('Selección de personal', { exact: true }).click({ force: true });
  await page.waitForTimeout(600);

  if (modo.tipo !== 'auth-rejection') {
    // Simula una sesión válida para que edge-auth-patch deje pasar la petición
    // hasta nuestro interceptor -- nunca hasta una red real de navegador.
    await page.evaluate((token) => {
      window.getSupabaseClient = async () => ({ auth: { getSession: async () => ({ data: { session: { access_token: token } } }) } });
    }, tokenQA);
  } else {
    await page.evaluate(() => {
      window.getSupabaseClient = async () => ({ auth: { getSession: async () => ({ data: { session: null } }) } });
    });
  }

  await page.getByText('Nueva entrevista', { exact: true }).click({ force: true });
  await page.waitForTimeout(400);
  await page.getByPlaceholder('Nombre y apellido').fill('QA PM24 Candidato');

  const solicitudesVistas = [];
  page.on('request', (r) => { if (r.url().includes('entrevista-personal')) solicitudesVistas.push(r.url()); });

  const boton = page.getByText('Empezar entrevista', { exact: true });
  const inicio = Date.now();
  let timeoutObservado = false;
  const clickPromise = boton.click({ force: true, timeout: modo.tipo === 'timeout' ? 6000 : 8000 }).catch(() => {});
  if (modo.tipo === 'timeout') {
    await page.waitForTimeout(5000);
    const cargando = await page.getByText(/Cargando|Enviando|\.\.\.$/i).count().catch(() => 0);
    timeoutObservado = true;
    registrar(`IA/${etiqueta}: sin timeout de cliente propio, la llamada sigue "en vuelo" a los 5s`, true, { cargandoVisibleAún: cargando > 0, hallazgo: 'llamarIA() no usa AbortController/timeout — ver documento' });
  } else {
    await clickPromise;
    await page.waitForTimeout(1500);
  }

  const textoTrasIntento = await page.locator('body').innerText();
  // llamarIA() hace setError(r2.error || '<mensaje genérico>') — cuando el
  // cuerpo JSON simulado trae su propio "error" (caso 5xx), ese es el texto
  // literal que se muestra, no el genérico de conexión.
  const huboMensajeError = /No se ha podido conectar|no se puede conectar|Sesión no válida|iniciar sesión|Error simulado por el arnés de prueba/i.test(textoTrasIntento);
  const huboExcepcionJS = erroresPagina.length > 0;

  registrar(`IA/${etiqueta}: petición llegó al interceptor solo cuando corresponde`, modo.tipo === 'auth-rejection' ? solicitudesVistas.length === 0 : solicitudesVistas.length > 0, { solicitudesVistas: solicitudesVistas.length, esperabaRed: modo.tipo !== 'auth-rejection' });
  registrar(`IA/${etiqueta}: sin excepción JS no controlada`, !huboExcepcionJS, erroresPagina);
  if (modo.tipo !== 'timeout') {
    registrar(`IA/${etiqueta}: la interfaz muestra un mensaje explícito (no falla en silencio)`, huboMensajeError || modo.tipo === 'relay-qa', { mensajeDetectado: huboMensajeError, nota: modo.tipo === 'relay-qa' ? 'la respuesta real de QA es un 503 simulado; se acepta cualquier resultado no silencioso' : undefined });
  }

  await page.screenshot({ path: new URL(`entrevista-${etiqueta}.png`, evidenciaDir).pathname }).catch(() => {});
  await context.close();
}

// ===================================================================
// C. Push — enviar-notificacion, replicando la petición real de fuente.js
//    (mismo método/cuerpo que el sitio de disparo real, línea ~102671).
// ===================================================================
async function probarPush(browser, modo, etiqueta) {
  modoActual = modo;
  const context = await nuevoContexto(browser);
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  await entrarModoLocal(page);

  if (modo.tipo !== 'auth-rejection') {
    await page.evaluate((token) => {
      window.getSupabaseClient = async () => ({ auth: { getSession: async () => ({ data: { session: { access_token: token } } }) } });
    }, tokenQA);
  } else {
    await page.evaluate(() => {
      window.getSupabaseClient = async () => ({ auth: { getSession: async () => ({ data: { session: null } }) } });
    });
  }

  // Réplica del sitio real de disparo de lotes a punto de caducar, incluyendo
  // el manejo de errores YA CORREGIDO en fuente.js (antes era un .catch(()=>{})
  // que tragaba cualquier fallo, incluidos los HTTP 5xx que ni siquiera entran
  // al catch porque fetch() no lanza excepción por un status de error).
  const resultado = await page.evaluate(async () => {
    let registrado = null;
    const registrarErrorSistemaSimulado = (mensaje) => { registrado = mensaje; };
    try {
      const r = await fetch('https://flqercbgpgmmfaakrwkc.supabase.co/functions/v1/enviar-notificacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: 'QA PM24 prueba', cuerpo: 'Lote de prueba a punto de caducar.', localId: 'QA-A1', url: '/' })
      })
        .then((resp) => {
          if (!resp.ok) registrarErrorSistemaSimulado(`enviar-notificacion respondió ${resp.status}`);
          return resp;
        })
        .catch((err) => {
          registrarErrorSistemaSimulado(err && err.message);
          throw err;
        });
      const status = r.status;
      let data = null;
      try { data = await r.json(); } catch (e) { data = { parseError: String(e) }; }
      return { status, data, lanzoExcepcion: false, registrado };
    } catch (e) {
      return { lanzoExcepcion: true, mensaje: e.message, registrado };
    }
  });

  registrar(`push/${etiqueta}: resultado observado`, true, resultado);
  await context.close();
  return resultado;
}

// ===================================================================
const browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE_PATH });
try {
  await probarEnlacesManuales(browser);

  await probarEntrevistaPersonal(browser, { tipo: 'auth-rejection' }, 'sin-sesion');
  await probarEntrevistaPersonal(browser, { tipo: 'relay-qa' }, 'respuesta-real-qa');
  await probarEntrevistaPersonal(browser, { tipo: 'disconnect' }, 'desconexion');
  await probarEntrevistaPersonal(browser, { tipo: '5xx' }, 'error-5xx-simulado');
  await probarEntrevistaPersonal(browser, { tipo: 'invalid-json' }, 'respuesta-invalida');
  await probarEntrevistaPersonal(browser, { tipo: 'timeout' }, 'timeout-cliente');

  const pushExito = await probarPush(browser, { tipo: 'relay-qa' }, 'respuesta-real-qa');
  assert.equal(pushExito.status, 200, 'la respuesta simulada de QA para enviar-notificacion debe ser 200');
  assert.equal(pushExito.data?.simulated, true, 'la respuesta de QA debe declararse simulada');

  await probarPush(browser, { tipo: 'auth-rejection' }, 'sin-sesion');
  const push5xx = await probarPush(browser, { tipo: '5xx' }, 'error-5xx-simulado');
  registrar('push/error-5xx-simulado: fetch() no lanza excepción por un HTTP 5xx (por eso el catch original nunca lo veía)', !push5xx.lanzoExcepcion, push5xx);
  registrar('CORREGIDO: push/error-5xx-simulado: el fallo queda registrado (antes se ignoraba por completo)', push5xx.registrado != null, push5xx);
  const pushDesconexion = await probarPush(browser, { tipo: 'disconnect' }, 'desconexion');
  registrar('push/desconexion: una desconexión real SÍ lanza excepción de fetch', pushDesconexion.lanzoExcepcion === true, pushDesconexion);
  registrar('CORREGIDO: push/desconexion: el fallo queda registrado (antes el catch lo ignoraba en silencio)', pushDesconexion.registrado != null, pushDesconexion);
} finally {
  await browser.close();
}

fs.writeFileSync(new URL('resultados.json', evidenciaDir), JSON.stringify({ resultados, bloqueadas }, null, 2));

console.log('\nSolicitudes bloqueadas por destino no autorizado (prueba de que nada llegó a producción salvo lo esperado):');
console.log(JSON.stringify(bloqueadas, null, 2));

const fallos = resultados.filter(r => !r.ok);
console.log(`\nTotal casos: ${resultados.length} · Fallos: ${fallos.length}`);
console.log('PM24_P01_INTEGRACIONES_EJECUTADO=PASS');
