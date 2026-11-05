import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder, TextEncoder } from 'node:util';
import { webcrypto } from 'node:crypto';

// Batería E2E de navegación sobre el bundle real, aislada de QA:
// nube desactivada, fetch bloqueado y un DOM nuevo por escenario. No crea
// cuentas, no escribe operaciones y no depende de datos personales reales.
const depsDir = process.env.CFG6E_UI_DEPS || process.env.CFG6_UI_DEPS;
if (!depsDir) {
  console.error('CFG6_UI_DEPS no está definido: indica una carpeta con react@18.3.1, react-dom@18.3.1 y jsdom.');
  process.exit(2);
}
const require = createRequire(join(resolve(depsDir), 'package.json'));
const { JSDOM } = require('jsdom');
const repo = fileURLToPath(new URL('../../', import.meta.url));
const almacenamiento = readFileSync(join(repo, 'index-storage-bootstrap.js'), 'utf8');
const bundle = readFileSync(join(repo, 'fuente.js'), 'utf8');

function montar(url) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
    url,
    pretendToBeVisual: true,
    runScripts: 'outside-only'
  });
  const { window } = dom;
  window.__modoPruebasLocal = true;
  window.TextEncoder = TextEncoder;
  window.TextDecoder = TextDecoder;
  window.crypto = window.crypto || webcrypto;
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  window.ResizeObserver = window.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
  window.IntersectionObserver = window.IntersectionObserver || class { observe() {} unobserve() {} disconnect() {} };
  window.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
  window.eval(almacenamiento);
  const bundleTest = bundle.replace('      setReady(true);', '      window.__readyReached = true; setReady(true);');
  window.eval(bundleTest);
  return dom;
}

const dormir = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
async function esperar(window, predicado, descripcion, limite = 5000) {
  const fin = Date.now() + limite;
  while (Date.now() < fin) {
    if (predicado()) return;
    await dormir(10);
  }
  throw new Error(`Tiempo agotado: ${descripcion}; hash=${window.location.hash}; texto=${window.document.body.textContent.slice(0, 500)}`);
}

const dom = montar('https://qa.test/?qa=pm20-e2e#/panel/dashboard');
const { window } = dom;
const { document } = window;
await esperar(window, () => window.__readyReached === true, 'carga local inicial');
await esperar(window, () => document.querySelector('button[aria-label="Panel general"]'), 'pintado visible del panel');

assert.equal(window.location.hash, '#/panel/dashboard', 'la ruta inicial del panel es estable');
assert.ok(document.querySelector('nav[aria-label="Navegación principal"], aside[aria-label="Navegación principal"]'), `existe navegación principal: ${document.body.textContent.slice(0, 400)}`);
assert.ok(document.querySelector('nav[aria-label="Navegación móvil"]'), 'existe navegación móvil');

const resultados = [...document.querySelectorAll('button[aria-label="Resultados"]')][0];
assert.ok(resultados, 'Resultados está disponible como destino');
resultados.click();
await esperar(window, () => window.location.hash === '#/panel/resultados', 'navegación a Resultados');
assert.ok(document.querySelector('button[aria-label="Resultados"][aria-current="page"]'), 'Resultados marca la pantalla activa');
assert.match(document.body.textContent, /Resultados/);

window.history.back();
await esperar(window, () => window.location.hash === '#/panel/dashboard', 'vuelta atrás al panel');
assert.ok(document.querySelector('button[aria-label="Panel general"][aria-current="page"]'), 'Panel general vuelve a marcarse como activo');

const mas = document.querySelector('button[aria-label="Más opciones de navegación"]');
assert.ok(mas, 'el menú móvil ofrece Más opciones de navegación');
mas.click();
await esperar(window, () => [...document.querySelectorAll('[role="dialog"]')].some((dialog) => /Más/.test(dialog.textContent || '')), 'apertura del menú Más');
assert.ok(document.querySelector('[role="dialog"] button[aria-label="Productos"]'), 'Más contiene el destino Productos');

const productos = document.querySelector('[role="dialog"] button[aria-label="Productos"]');
productos.click();
await esperar(window, () => window.location.hash === '#/panel/productos', 'navegación desde Más a Productos');
assert.ok(document.querySelector('button[aria-label="Productos"][aria-current="page"]'), 'Productos marca la pantalla activa');

window.close();

const recarga = montar('https://qa.test/?qa=pm20-e2e#/panel/resultados');
const windowRecarga = recarga.window;
await esperar(windowRecarga, () => windowRecarga.__readyReached === true, 'recarga con ruta profunda');
await esperar(windowRecarga, () => windowRecarga.document.querySelector('button[aria-label="Panel general"]'), 'pintado visible tras recarga');
assert.equal(windowRecarga.location.hash, '#/panel/resultados', 'la ruta profunda se conserva al cargar');
assert.match(windowRecarga.document.body.textContent, /Resultados/);
assert.ok(windowRecarga.document.querySelector('button[aria-label="Resultados"][aria-current="page"]'), 'la ruta profunda restaura el estado activo');

console.log('PM20 P11 navegación E2E runtime aislada: PASS');
windowRecarga.close();
