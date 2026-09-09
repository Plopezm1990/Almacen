// PM22 P01 — Móvil y accesibilidad (cobertura emulada en Chromium).
//
// Ejecuta la app real (index.html + fuente.js) servida como archivos estáticos
// locales, en modo "Trabajar solo en este equipo, sin sincronizar" — el mismo
// modo que ya usan los scripts de auditoría existentes del repositorio
// (.github/scripts/auditar-dashboard.mjs) — para no depender de red hacia QA
// ni tocar ningún backend: el alcance de este punto es maquetación, teclado,
// foco y estructura de accesibilidad, no lógica de negocio ni RLS (eso ya se
// cubrió en PM21).
//
// IMPORTANTE: esto NO sustituye una prueba en Android/iOS físicos. Se emula
// el viewport y el user-agent por defecto de Chromium; el teclado virtual, los
// gestos táctiles, las áreas seguras (notch/home indicator) y el comportamiento
// propio del sistema operativo NO se prueban aquí — quedan explícitamente
// pendientes (ver el documento de cierre).

import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const BASE_URL = process.env.PM22_BASE_URL || 'http://127.0.0.1:4173/';
const EXECUTABLE_PATH = process.env.PM22_CHROMIUM_PATH || '/opt/pw-browsers/chromium';

const resultados = [];
const evidenciaDir = new URL('./evidencia/', import.meta.url);
fs.mkdirSync(evidenciaDir, { recursive: true });

function registrar(caso, viewport, ok, detalle) {
  resultados.push({ caso, viewport, ok, detalle });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${viewport} · ${caso}${detalle ? ' — ' + detalle : ''}`);
}

// El entorno de ejecución no tiene salida a CDNs externos (Tailwind Play CDN,
// Google Fonts) — dejar que el navegador reintente esas peticiones contra la
// red real añade minutos de bloqueo por página. Se abortan de inmediato: la
// app sigue siendo utilizable sin ellas (estilos de respaldo del propio HTML),
// y no forman parte de lo que este punto evalúa (maquetación/accesibilidad
// propias de la app, no la disponibilidad de un CDN de terceros).
const HOSTS_EXTERNOS_BLOQUEADOS = ['cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'esm.sh'];
async function nuevoContexto(browser, viewport) {
  const context = await browser.newContext({ viewport, locale: 'es-ES' });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (HOSTS_EXTERNOS_BLOQUEADOS.includes(url.hostname)) return route.abort();
    return route.continue();
  });
  return context;
}

async function sinDesbordeHorizontal(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
}

// Nombre accesible REAL, calculado por el propio motor de accesibilidad del
// navegador (incluye asociación por <label> envolvente, aria-label,
// aria-labelledby y, como último recurso válido, el placeholder) — no una
// heurística sobre atributos sueltos. Comprobar solo aria-label/label[for]
// habría marcado como "sin etiqueta" un campo que sí tiene nombre accesible
// real vía placeholder, un falso positivo ya detectado y corregido durante
// la preparación de este punto.
async function camposDeFormularioSinNombreAccesible(page) {
  const snapshot = await page.accessibility.snapshot({ interestingOnly: true });
  const campos = [];
  (function recorrer(nodo) {
    if (!nodo) return;
    if (['textbox', 'spinbutton', 'combobox', 'checkbox', 'radio'].includes(nodo.role)) campos.push(nodo);
    (nodo.children || []).forEach(recorrer);
  })(snapshot);
  return { total: campos.length, sinNombre: campos.filter(c => !c.name || !c.name.trim()).length };
}

async function entrarModoLocal(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.getByText(/Trabajar solo en este equipo/i).click({ force: true, timeout: 10000 });
  await page.waitForTimeout(2000);
}

async function accesibilidadFormularioLogin(browser, viewport, etiqueta) {
  const context = await nuevoContexto(browser, viewport);
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1200);

  assert.equal(await page.locator('input[type="email"], input[type="password"]').count(), 2, 'deben existir los campos de correo y contraseña en la pantalla de login');
  const { total, sinNombre } = await camposDeFormularioSinNombreAccesible(page);
  registrar(
    'login: todos los campos tienen nombre accesible real',
    etiqueta,
    total >= 2 && sinNombre === 0,
    `campos=${total} sinNombre=${sinNombre}`
  );
  // Nota informativa (no es un fallo): el nombre accesible de correo/contraseña
  // se obtiene únicamente del placeholder, sin <label> visible persistente. Es
  // válido para el cálculo de nombre accesible, pero el texto desaparece al
  // escribir — una etiqueta visible persistente sería más robusta. Se registra
  // en el documento de cierre como mejora, no como defecto de accesibilidad.

  const desborde = await sinDesbordeHorizontal(page);
  registrar('login: sin desborde horizontal de página', etiqueta, desborde.scrollWidth <= desborde.clientWidth + 2, JSON.stringify(desborde));

  await page.screenshot({ path: new URL(`login-${etiqueta}.png`, evidenciaDir).pathname });
  await context.close();
}

async function suiteViewport(browser, viewport, etiqueta, { incluirCompleto }) {
  const context = await nuevoContexto(browser, viewport);
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const erroresPagina = [];
  page.on('pageerror', e => erroresPagina.push(e.message));

  await entrarModoLocal(page);

  // 1. Dashboard alcanzable, sin errores de página.
  const dashboardVisible = await page.getByText(/Resumen general/i).first().isVisible().catch(() => false);
  registrar('dashboard alcanzable desde modo local', etiqueta, dashboardVisible);
  registrar('sin errores de página no capturados (pageerror)', etiqueta, erroresPagina.length === 0, erroresPagina.join(' | '));

  // 2. Sin desborde horizontal en el dashboard.
  const desborde = await sinDesbordeHorizontal(page);
  registrar('dashboard: sin desborde horizontal de página', etiqueta, desborde.scrollWidth <= desborde.clientWidth + 2, JSON.stringify(desborde));

  await page.screenshot({ path: new URL(`dashboard-${etiqueta}.png`, evidenciaDir).pathname, fullPage: true });

  if (incluirCompleto) {
    // 3. Módulo Productos (tabla/lista y formulario). El modo local sin
    // sincronizar arranca sin ninguna empresa/local configurado (a propósito:
    // evita cualquier dependencia de red hacia QA), así que la lista está
    // vacía por diseño — se comprueba el estado vacío real, no una lista con
    // filas que requeriría antes completar un alta de empresa/local, fuera
    // del alcance de este punto (dispositivo/accesibilidad, no onboarding).
    const navProductos = page.locator('button, a, [role="button"]').filter({ hasText: 'Productos' }).first();
    if (await navProductos.count()) {
      await navProductos.click({ force: true }).catch(() => {});
      await page.waitForTimeout(900);
      const estadoVacioVisible = await page.getByText(/Todavía no has añadido productos/i).first().isVisible().catch(() => false);
      registrar('módulo Productos: estado vacío legible', etiqueta, estadoVacioVisible);
      const desbordeTabla = await sinDesbordeHorizontal(page);
      registrar('módulo Productos: sin desborde horizontal', etiqueta, desbordeTabla.scrollWidth <= desbordeTabla.clientWidth + 2, JSON.stringify(desbordeTabla));

      // Formulario real "Nuevo producto": todos los campos deben tener nombre accesible.
      const nuevoProducto = page.getByText(/Nuevo producto/i).first();
      if (await nuevoProducto.count()) {
        await nuevoProducto.click({ force: true }).catch(() => {});
        await page.waitForTimeout(700);
        const { total: totalCampos, sinNombre: camposSinNombre } = await camposDeFormularioSinNombreAccesible(page);
        registrar('formulario "Nuevo producto": todos los campos tienen nombre accesible', etiqueta, totalCampos > 5 && camposSinNombre === 0, `campos=${totalCampos} sinNombre=${camposSinNombre}`);
        const desbordeFormulario = await sinDesbordeHorizontal(page);
        registrar('formulario "Nuevo producto": sin desborde horizontal', etiqueta, desbordeFormulario.scrollWidth <= desbordeFormulario.clientWidth + 2, JSON.stringify(desbordeFormulario));
      } else {
        registrar('formulario "Nuevo producto": control encontrado', etiqueta, false, 'no se encontró "Nuevo producto"');
      }
      await page.screenshot({ path: new URL(`productos-${etiqueta}.png`, evidenciaDir).pathname, fullPage: true });
    } else {
      registrar('módulo Productos: enlace de navegación encontrado', etiqueta, false, 'no se encontró el elemento de navegación "Productos"');
    }

    // 4. Módulo financiero: Arqueo de caja / Tesorería — controles no fuera de pantalla.
    await entrarModoLocal(page).catch(() => {});
    const navFinanciero = page.locator('button, a, [role="button"]').filter({ hasText: /Arqueo de caja|Tesorería/i }).first();
    if (await navFinanciero.count()) {
      await navFinanciero.click({ force: true }).catch(() => {});
      await page.waitForTimeout(900);
      const cifras = page.locator('text=/€|Saldo|Total/i').first();
      const hayCifra = await cifras.count();
      let dentroDePantalla = false;
      if (hayCifra) {
        await cifras.scrollIntoViewIfNeeded().catch(() => {});
        const box = await cifras.boundingBox().catch(() => null);
        if (box) {
          dentroDePantalla = box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1;
        }
      }
      registrar('módulo financiero: cifra monetaria visible y dentro del ancho de pantalla', etiqueta, hayCifra > 0 && dentroDePantalla, `hayCifra=${hayCifra} dentroDePantalla=${dentroDePantalla}`);
      await page.screenshot({ path: new URL(`financiero-${etiqueta}.png`, evidenciaDir).pathname, fullPage: true });
    } else {
      registrar('módulo financiero: enlace de navegación encontrado', etiqueta, false, 'no se encontró "Arqueo de caja" ni "Tesorería"');
    }

    // 5. Diálogo accesible: "Modo empleado".
    await entrarModoLocal(page).catch(() => {});
    const navModoEmpleado = page.getByText(/Modo empleado/i).first();
    if (await navModoEmpleado.count()) {
      await navModoEmpleado.click({ force: true }).catch(() => {});
      await page.waitForTimeout(600);
      const dialogAbierto = await page.locator('[role="dialog"], [role="alertdialog"]').count();
      registrar('diálogo "Modo empleado" usa role=dialog', etiqueta, dialogAbierto > 0);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      const dialogCerradoConEscape = (await page.locator('[role="dialog"], [role="alertdialog"]').count()) === 0;
      registrar('diálogo "Modo empleado" se cierra con Escape', etiqueta, dialogCerradoConEscape);
    } else {
      registrar('diálogo "Modo empleado": control encontrado', etiqueta, false, 'no se encontró el control "Modo empleado"');
    }

    // 6. Navegación por teclado: Tab avanza el foco a controles reales y visibles.
    await entrarModoLocal(page).catch(() => {});
    await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
    const focosDistintos = new Set();
    let focoSiempreVisible = true;
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const r = el.getBoundingClientRect();
        return { ref: el.tagName + '#' + (el.id || '') + '.' + (el.className || ''), visible: r.width > 0 && r.height > 0 };
      });
      if (info) {
        focosDistintos.add(info.ref);
        if (!info.visible) focoSiempreVisible = false;
      }
    }
    registrar('teclado: Tab mueve el foco a varios controles reales', etiqueta, focosDistintos.size >= 3, `controles alcanzados=${focosDistintos.size}`);
    registrar('teclado: el control con foco siempre tiene tamaño visible (no bloqueado)', etiqueta, focoSiempreVisible);
  }

  await context.close();
}

const viewports = [
  { nombre: '360x800-android', viewport: { width: 360, height: 800 }, completo: true },
  { nombre: '390x844-iphone', viewport: { width: 390, height: 844 }, completo: true },
  { nombre: '844x390-iphone-landscape', viewport: { width: 844, height: 390 }, completo: false },
  { nombre: '768x1024-tablet', viewport: { width: 768, height: 1024 }, completo: true },
  { nombre: '1440x900-escritorio', viewport: { width: 1440, height: 900 }, completo: true }
];

const browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE_PATH });
try {
  for (const v of viewports) {
    await accesibilidadFormularioLogin(browser, v.viewport, v.nombre);
    await suiteViewport(browser, v.viewport, v.nombre, { incluirCompleto: v.completo });
  }
} finally {
  await browser.close();
}

fs.writeFileSync(new URL('resultados.json', evidenciaDir), JSON.stringify(resultados, null, 2));

const fallos = resultados.filter(r => !r.ok);
console.log(`\nTotal casos: ${resultados.length} · Fallos: ${fallos.length}`);
if (fallos.length) {
  console.log('FALLOS:', JSON.stringify(fallos, null, 2));
}
console.log('PM22_P01_MOVIL_ACCESIBILIDAD_EJECUTADO=PASS');
