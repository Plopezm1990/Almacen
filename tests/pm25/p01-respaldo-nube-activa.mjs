// PM25 P01 — Respaldo local mientras hay sesión de nube activa.
//
// Verifica en vivo, contra el proyecto QA real, el defecto encontrado por
// lectura de código y la corrección aplicada en fuente.js: restaurar un
// respaldo antiguo mientras el dispositivo está sincronizado con la nube
// podía borrar en el servidor filas de proveedores/clientes/albaranes/
// facturas/gastos que no estuvieran en ese respaldo antiguo
// (sincronizarColeccionEmpresa/sincronizarColeccionEmpresaLocal en
// index.html hacen upsert + DELETE de lo que "sobra"). Ahora el modal de
// restaurar se bloquea con un diagnóstico en vez de aplicar el respaldo.
//
// Metodología: el navegador de este entorno no tiene salida de red fiable
// hacia QA (verificado con una sonda directa), así que toda petición al
// host de QA se reenvía tal cual desde este proceso Node (que sí tiene red
// fiable) mediante un proxy "tonto": ni interpreta ni reescribe la
// petición, solo hace de puente. La app se conecta a QA usando el propio
// mecanismo de Deploy Preview ya existente en index.html
// (window.__modoPruebasQA / __qaNubeUrl / __qaNubeClave), con una sesión
// real (owner.a@qa.invalid) — nunca service_role. Todo lo creado es un
// proveedor sintético con prefijo "QA PM25", limpiado al final de la
// prueba; no se toca el proveedor de fixture preexistente "QA-PROV-A".

import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const BASE_URL = process.env.PM25_BASE_URL || 'http://127.0.0.1:4173/';
const EXECUTABLE_PATH = process.env.PM25_CHROMIUM_PATH || undefined;
const QA_URL = process.env.QA_API_URL;
const QA_ANON = process.env.QA_ANON_KEY;
const QA_PASSWORD = process.env.QA_P03_PASSWORD;
const QA_HOST = new URL(QA_URL).hostname;
const PROD_HOST = 'flqercbgpgmmfaakrwkc.supabase.co';
const EMPRESA_ID = 'QA-EMP-A'; // empresa real de la identidad owner.a@qa.invalid ya usada en PM04+

const resultados = [];
const bloqueadasProduccion = [];
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

async function restQA(path, token, init = {}) {
  const r = await fetch(`${QA_URL}${path}`, {
    ...init,
    headers: { apikey: QA_ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) }
  });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, data };
}

// Token propio de este proceso Node (fiable), usado tanto para el relé
// como para las comprobaciones directas antes/después de la prueba.
const tokenQA = await signIn('owner.a@qa.invalid', QA_PASSWORD);

const nombreProveedorPersistente = 'QA PM25 Proveedor Persistente';
const nombreProveedorFuera = 'QA PM25 Proveedor Fuera Del Backup';

async function limpiarFixtures() {
  const r = await restQA(`/rest/v1/proveedores_empresa?select=id,datos&datos->>nombre=in.(${encodeURIComponent(`"${nombreProveedorPersistente}","${nombreProveedorFuera}"`)})`, tokenQA);
  // Fallback simple: traer todos y filtrar en el cliente (evita depender de la sintaxis exacta de "in" sobre JSON).
  const todos = await restQA(`/rest/v1/proveedores_empresa?select=id,datos`, tokenQA);
  const idsAeliminar = (Array.isArray(todos.data) ? todos.data : [])
    .filter((f) => f.datos && (f.datos.nombre === nombreProveedorPersistente || f.datos.nombre === nombreProveedorFuera))
    .map((f) => f.id);
  for (const id of idsAeliminar) {
    await restQA(`/rest/v1/proveedores_empresa?id=eq.${id}`, tokenQA, { method: 'DELETE' });
  }
  return idsAeliminar;
}

// Limpieza previa por si una ejecución anterior dejó residuos.
await limpiarFixtures();

async function nuevoContexto(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (['cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'esm.sh'].includes(url.hostname)) {
      return route.abort();
    }
    if (url.hostname === QA_HOST) {
      // Proxy "tonto": reenvía la petición tal cual a QA desde Node (fiable)
      // porque el navegador de este entorno no puede hablar con QA
      // directamente. No interpreta la semántica de PostgREST/Auth.
      try {
        const headers = { ...req.headers() };
        delete headers['host'];
        delete headers['content-length'];
        const resp = await fetch(req.url(), {
          method: req.method(),
          headers,
          body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postData()
        });
        const body = await resp.arrayBuffer();
        const respHeaders = {};
        resp.headers.forEach((v, k) => {
          if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k.toLowerCase())) respHeaders[k] = v;
        });
        return route.fulfill({ status: resp.status, headers: respHeaders, body: Buffer.from(body) });
      } catch (e) {
        return route.abort();
      }
    }
    if (url.hostname === PROD_HOST) {
      bloqueadasProduccion.push({ url: req.url(), method: req.method() });
      return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ ok: false }) });
    }
    return route.continue();
  });
  return context;
}

const browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE_PATH });
try {
  const context = await nuevoContexto(browser);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const erroresPagina = [];
  page.on('pageerror', (e) => erroresPagina.push(e.message));

  await page.addInitScript(({ url, key }) => {
    window.__modoPruebasQA = true;
    window.__qaNubeUrl = url;
    window.__qaNubeClave = key;
  }, { url: QA_URL, key: QA_ANON });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.locator('input[type="email"]').fill('owner.a@qa.invalid');
  await page.locator('input[type="password"]').fill(QA_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(4000);

  const dentro = await page.getByText('Proveedores', { exact: true }).first().isVisible().catch(() => false);
  registrar('login real contra QA (nube activa) llega a la aplicación', dentro, {});

  // Crea, con sesión de nube activa de verdad, un proveedor que quedará
  // "fuera" del respaldo antiguo que se intentará restaurar después --
  // simula el caso real: alguien lo dio de alta después de la fecha del
  // backup.
  async function crearProveedor(nombre) {
    await page.locator('button, a, [role="button"]').filter({ hasText: 'Proveedores' }).first().click({ force: true });
    await page.waitForTimeout(600);
    let abierto = false;
    for (let i = 0; i < 3 && !abierto; i++) {
      await page.getByText(/Nuevo proveedor/i).first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(700);
      abierto = await page.getByText('Nombre del proveedor', { exact: true }).isVisible().catch(() => false);
    }
    if (!abierto) throw new Error(`El formulario de proveedor no se abrió para "${nombre}"`);
    await page.getByLabel('Nombre del proveedor', { exact: true }).fill(nombre);
    await page.locator('button').filter({ hasText: /^Guardar|Crear proveedor|Añadir proveedor/i }).first().click({ force: true });
    await page.waitForTimeout(2000);
  }

  await crearProveedor(nombreProveedorFuera);

  // Confirma en QA (consulta directa, no vía UI) que el proveedor "fuera del
  // backup" existe de verdad antes de intentar el restore.
  const antes = await restQA(`/rest/v1/proveedores_empresa?select=id,datos`, tokenQA);
  const existeAntes = Array.isArray(antes.data) && antes.data.some((f) => f.datos?.nombre === nombreProveedorFuera);
  registrar('el proveedor creado con nube activa existe de verdad en QA antes del intento de restauración', existeAntes, { total: Array.isArray(antes.data) ? antes.data.length : null });

  // Respaldo sintético "antiguo": solo contiene un proveedor DISTINTO
  // (nombreProveedorPersistente), simulando un backup tomado antes de que
  // existiera "nombreProveedorFuera". Si el restore se aplicara de verdad,
  // sincronizarColeccionEmpresa borraría en QA cualquier fila de
  // proveedores_empresa que no esté en esta lista -- incluidos
  // "QA-PROV-A" (fixture preexistente de otro punto) y el que se acaba de
  // crear.
  const backupAntiguo = JSON.stringify({
    version: 2,
    backupVersion: 3,
    exportadoEl: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    proveedores: [
      { id: 'qa-pm25-persistente-fixture', nombre: nombreProveedorPersistente, empresaId: EMPRESA_ID, email: '', contacto: '', telefono: '', condiciones: '', diasPago: '', leadTime: '', diasReparto: [] }
    ]
  });

  await page.locator('button, a, [role="button"]').filter({ hasText: 'Respaldos' }).first().click({ force: true });
  await page.waitForTimeout(800);
  await page.getByText('Restaurar desde texto', { exact: true }).click({ force: true });
  await page.waitForTimeout(500);
  await page.locator('textarea').first().fill(backupAntiguo);
  await page.getByText('Continuar', { exact: true }).click({ force: true });
  await page.waitForTimeout(800);

  const textoTrasContinuar = await page.locator('body').innerText();
  const modalBloqueado = /No se puede restaurar mientras la nube est.{1,2} activa/i.test(textoTrasContinuar);
  const botonRestaurarVisible = await page.getByText('Restaurar respaldo', { exact: true }).last().isVisible().catch(() => false);
  registrar('CORREGIDO: el modal de restauración se bloquea con diagnóstico cuando hay nube activa', modalBloqueado, { textoEncontrado: modalBloqueado });
  registrar('CORREGIDO: no se ofrece el botón "Restaurar respaldo" mientras hay nube activa', !botonRestaurarVisible, { botonRestaurarVisible });

  // Cierra el diagnóstico y confirma que en QA no se borró ni se sobrescribió nada.
  await page.getByText('Cerrar', { exact: true }).click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);

  const despues = await restQA(`/rest/v1/proveedores_empresa?select=id,datos`, tokenQA);
  const existeFixtureOriginal = Array.isArray(despues.data) && despues.data.some((f) => f.id === 'QA-PROV-A');
  const existeCreadoConNube = Array.isArray(despues.data) && despues.data.some((f) => f.datos?.nombre === nombreProveedorFuera);
  const existePersistenteInventado = Array.isArray(despues.data) && despues.data.some((f) => f.id === 'qa-pm25-persistente-fixture');
  registrar('el fixture preexistente "QA-PROV-A" sigue intacto en QA (no se borró)', existeFixtureOriginal, {});
  registrar('el proveedor creado con nube activa sigue intacto en QA (no se borró)', existeCreadoConNube, {});
  registrar('el proveedor inventado del backup antiguo NO se insertó en QA (el restore nunca se aplicó)', !existePersistenteInventado, {});
  registrar('sin excepción JS no controlada', erroresPagina.length === 0, erroresPagina);

  await context.close();
} finally {
  const idsLimpiados = await limpiarFixtures();
  registrar('limpieza: fixtures QA-PM25 eliminados al finalizar', true, { idsLimpiados });
  await browser.close();
}

fs.writeFileSync(new URL('resultados.json', evidenciaDir), JSON.stringify({ resultados, bloqueadasProduccion }, null, 2));

console.log('\nSolicitudes bloqueadas por destino no autorizado (producción):');
console.log(JSON.stringify(bloqueadasProduccion, null, 2));

const fallos = resultados.filter((r) => !r.ok);
console.log(`\nTotal casos: ${resultados.length} · Fallos: ${fallos.length}`);
if (fallos.length > 0) {
  console.log('PM25_P01_RESPALDO_NUBE_ACTIVA_EJECUTADO=FAIL');
  process.exit(1);
}
console.log('PM25_P01_RESPALDO_NUBE_ACTIVA_EJECUTADO=PASS');
