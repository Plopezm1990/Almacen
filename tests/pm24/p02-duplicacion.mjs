// PM24 P02 — Duplicación (IA y push).
//
// El texto literal del Plan Maestro para PM-24 pide probar, para cada
// integración, "acceso, límites y duplicación". P01 ya cubrió acceso
// (rechazo sin sesión) y límites (5xx, desconexión, timeout, JSON inválido)
// para las cuatro integraciones. Este punto cubre específicamente
// "duplicación": qué pasa si el usuario dispara la misma acción dos veces
// seguidas (doble clic, reenvío rápido) antes de que la primera termine.
//
// Misma arquitectura de red que P01: todo el host de producción de Supabase
// bloqueado salvo las funciones de integración conocidas, que se reenvían
// desde este proceso Node (nunca desde el navegador) al proyecto QA real.
// Esta redirección existe únicamente en este arnés de prueba.

import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const BASE_URL = process.env.PM24_BASE_URL || 'http://127.0.0.1:4173/';
const EXECUTABLE_PATH = process.env.PM24_CHROMIUM_PATH || undefined;
const QA_URL = process.env.QA_API_URL;
const QA_ANON = process.env.QA_ANON_KEY;
const QA_PASSWORD = process.env.QA_P03_PASSWORD;
const PROD_HOST = 'flqercbgpgmmfaakrwkc.supabase.co';

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

async function entrarModoLocal(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.getByText(/Trabajar solo en este equipo/i).click({ force: true, timeout: 10000 });
  await page.waitForTimeout(2000);
}

// ===================================================================
// A. Duplicación en la entrevista de IA: doble clic / reenvío rápido.
// ===================================================================
async function probarDuplicacionEntrevista(browser) {
  let solicitudesEntrevista = 0;
  // La primera llamada (al pulsar "Empezar entrevista") responde rápido y
  // con éxito, dejando una pregunta de tipo sí/no -- así aparece un botón
  // de un solo clic, ideal para forzar el doble clic. La segunda llamada en
  // adelante (al responder) se deja "colgada" a propósito: así el estado de
  // carga permanece activo el tiempo suficiente para intentar un segundo
  // envío antes de que la primera respuesta llegue -- el peor caso posible
  // para una condición de carrera de doble envío.
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (['cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'esm.sh'].includes(url.hostname)) {
      return route.abort();
    }
    if (url.hostname === PROD_HOST) {
      if (url.pathname === '/functions/v1/entrevista-personal') {
        solicitudesEntrevista += 1;
        if (solicitudesEntrevista === 1) {
          return route.fulfill({
            status: 200, contentType: 'application/json',
            body: JSON.stringify({ ok: true, terminado: false, siguiente_pregunta: '¿Tiene disponibilidad inmediata?', tipo_respuesta: 'si_no' })
          });
        }
        return new Promise(() => {}); // cuelgue deliberado desde la 2ª llamada en adelante
      }
      bloqueadas.push({ url: req.url(), method: req.method(), motivo: 'host de producción, ruta no autorizada' });
      return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ ok: false }) });
    }
    return route.continue();
  });

  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const erroresPagina = [];
  page.on('pageerror', (e) => erroresPagina.push(e.message));

  await entrarModoLocal(page);
  await page.locator('button, a, [role="button"]').filter({ hasText: 'Personal' }).first().click({ force: true });
  await page.waitForTimeout(600);
  await page.getByText('Selección de personal', { exact: true }).click({ force: true });
  await page.waitForTimeout(600);
  // El override se hace DESPUÉS de entrar en esta pantalla (no antes): al
  // montarse, SeleccionPersonal llama a listarPrefiltros(), que usa
  // window.getSupabaseClient() de verdad (hallazgo ya documentado en P01 --
  // el modo local no aísla esta llamada). Si se sustituye el cliente antes
  // de navegar aquí, ese listado se ejecuta contra un stub sin `.from()` y
  // lanza una excepción JS que no tiene nada que ver con esta prueba.
  await page.evaluate((token) => {
    window.getSupabaseClient = async () => ({ auth: { getSession: async () => ({ data: { session: { access_token: token } } }) } });
  }, tokenQA);

  // --- Prueba 1: doble clic rápido en "Empezar entrevista" ---
  await page.getByText('Nueva entrevista', { exact: true }).click({ force: true });
  await page.waitForTimeout(300);
  await page.getByPlaceholder('Nombre y apellido').fill('QA PM24 Candidato Duplicado');
  // Dos clics nativos disparados en el mismo tick (sin ida y vuelta de
  // Playwright entre uno y otro) para maximizar la posibilidad real de
  // duplicado -- un segundo clic() de Playwright ya tendría más margen para
  // que React re-renderizara entre medias y ocultara el problema.
  const dobleClicEmpezar = await page.evaluate(() => {
    const botones = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Empezar entrevista');
    if (botones.length === 0) return { encontrado: false };
    botones[0].click();
    botones[0].click();
    return { encontrado: true };
  });
  await page.waitForTimeout(1000);
  registrar('duplicación/IA: botón "Empezar entrevista" localizado para el doble clic', dobleClicEmpezar.encontrado, dobleClicEmpezar);
  registrar('duplicación/IA: el doble clic en "Empezar entrevista" no duplica la llamada', solicitudesEntrevista === 1, { solicitudesVistas: solicitudesEntrevista });

  // --- Prueba 2: doble envío rápido de la misma respuesta mientras la IA "piensa" ---
  await page.waitForTimeout(300);
  const dobleClicResponder = await page.evaluate(() => {
    const botones = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Sí');
    if (botones.length === 0) return { encontrado: false };
    botones[0].click();
    botones[0].click();
    return { encontrado: true };
  });
  await page.waitForTimeout(1000);
  registrar('duplicación/IA: botón de respuesta "Sí" localizado para el doble clic', dobleClicResponder.encontrado, dobleClicResponder);
  registrar('duplicación/IA: el doble clic al responder no duplica la llamada a la IA', solicitudesEntrevista === 2, { solicitudesVistas: solicitudesEntrevista });
  registrar('duplicación/IA: sin excepción JS no controlada durante las pruebas de doble clic', erroresPagina.length === 0, erroresPagina);

  await context.close();
  return { solicitudesEntrevista };
}

// ===================================================================
// B. Duplicación en el push de caducidad: verificación del mecanismo real
//    de-duplicación (yaAvisados en localStorage), reproducido literalmente
//    a partir del código real de fuente.js -- no una reimplementación
//    propia. No se ejecuta vía UI: el efecto real solo se activa con
//    window.__nubeActiva === true (modo nube), y generar en este entorno un
//    lote de caducidad real requeriría además dar de alta un albarán con
//    fecha de caducidad a través de todo el flujo de Recepción, sin ganancia
//    real sobre verificar el algoritmo de-duplicador tal cual es.
// ===================================================================
function probarDeduplicacionPush() {
  const fuente = fs.readFileSync(new URL('../../fuente.js', import.meta.url), 'utf8');
  const inicio = fuente.indexOf('almacen__caducidades_avisadas');
  assert.ok(inicio > 0, 'no se encontró la clave de de-duplicación en fuente.js');
  // Extrae el bloque real del useEffect (delimitado por las líneas ya conocidas
  // del sitio de disparo) para ejecutar el ALGORITMO REAL, no uno reescrito.
  const bloqueInicio = fuente.lastIndexOf('let yaAvisados = [];', inicio + 200);
  const bloqueFin = fuente.indexOf('}, [ready, caducanPronto]);', bloqueInicio);
  assert.ok(bloqueInicio > 0 && bloqueFin > bloqueInicio, 'no se pudo delimitar el bloque real de de-duplicación en fuente.js');
  const bloqueReal = fuente.slice(bloqueInicio, bloqueFin);

  // Réplica del entorno mínimo que ese bloque necesita (localStorage y fetch),
  // ejecutando el CÓDIGO REAL extraído tal cual, no una copia manual.
  const almacen = {};
  const localStorage = {
    getItem: (k) => (k in almacen ? almacen[k] : null),
    setItem: (k, v) => { almacen[k] = v; }
  };
  const llamadasPush = [];
  const fetchSimulado = (url, opts) => {
    llamadasPush.push(JSON.parse(opts.body));
    return Promise.resolve({ ok: true, status: 200 }); // respuesta simulada exitosa
  };
  const registrarErrorSistema = () => {}; // no debería invocarse (fetch simulado siempre resuelve ok)

  function ejecutarRonda(urgentes) {
    const fn = new Function('urgentes', 'localStorage', 'fetch', 'productos', 'registrarErrorSistema', `
      ${bloqueReal}
    `);
    fn(urgentes, localStorage, fetchSimulado, [], registrarErrorSistema);
  }

  const loteA = { id: 'lote-A', dias: 3, nombre: 'Producto A', lote: 'L1' };
  const loteB = { id: 'lote-B', dias: 5, nombre: 'Producto B', lote: 'L2' };

  ejecutarRonda([loteA]);
  const trasPrimeraRonda = llamadasPush.length;
  ejecutarRonda([loteA]); // mismo lote otra vez -- NO debe reenviar
  const trasSegundaRonda = llamadasPush.length;
  ejecutarRonda([loteA, loteB]); // loteA repetido + loteB nuevo -- solo loteB debe enviarse
  const trasTerceraRonda = llamadasPush.length;

  registrar('duplicación/push: primera ronda envía exactamente 1 aviso (lote nuevo)', trasPrimeraRonda === 1, { llamadas: trasPrimeraRonda });
  registrar('duplicación/push: repetir el mismo lote NO genera un segundo envío', trasSegundaRonda === trasPrimeraRonda, { antes: trasPrimeraRonda, despues: trasSegundaRonda });
  registrar('duplicación/push: un lote nuevo junto al repetido SÍ se envía (no bloquea de más)', trasTerceraRonda === trasSegundaRonda + 1, { antes: trasSegundaRonda, despues: trasTerceraRonda });
  registrar('duplicación/push: el aviso repetido nunca llegó a intentarse enviar', !llamadasPush.some((c, i) => i > 0 && c.titulo === llamadasPush[0].titulo && c.cuerpo === llamadasPush[0].cuerpo) || llamadasPush.length === 2, { llamadas: llamadasPush.map((c) => c.titulo) });

  return { llamadasPush };
}

// ===================================================================
const browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE_PATH });
try {
  await probarDuplicacionEntrevista(browser);
  probarDeduplicacionPush();
} finally {
  await browser.close();
}

fs.writeFileSync(new URL('resultados-p02.json', evidenciaDir), JSON.stringify({ resultados, bloqueadas }, null, 2));

console.log('\nSolicitudes bloqueadas por destino no autorizado:');
console.log(JSON.stringify(bloqueadas, null, 2));

const fallos = resultados.filter((r) => !r.ok);
console.log(`\nTotal casos: ${resultados.length} · Fallos: ${fallos.length}`);
if (fallos.length > 0) {
  console.log('PM24_P02_DUPLICACION_EJECUTADO=FAIL');
  process.exit(1);
}
console.log('PM24_P02_DUPLICACION_EJECUTADO=PASS');
