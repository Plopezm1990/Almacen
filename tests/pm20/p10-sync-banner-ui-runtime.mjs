import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder, TextEncoder } from 'node:util';
import { webcrypto } from 'node:crypto';

// Monta el bundle real, pero con la nube desactivada y sin datos persistentes.
// La única entrada de fallo es un CustomEvent sintético: no se escribe en
// Supabase, no se genera una operación y no se altera el QA compartido.
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

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
  url: 'https://qa.test/?qa=pm20-sync-banner#/panel/dashboard',
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

const dormir = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
async function esperar(predicado, descripcion, limite = 5000) {
  const fin = Date.now() + limite;
  while (Date.now() < fin) {
    if (predicado()) return;
    await dormir(10);
  }
  throw new Error(`Tiempo agotado: ${descripcion}; ready=${window.__readyReached}; nube=${window.__nubeActiva}; texto=${window.document.body.textContent.slice(0, 500)}`);
}

await esperar(() => window.__readyReached === true, 'la carga inicial local termina');

const reintentos = [];
window.reintentarSincronizacion = async (key) => { reintentos.push(key); };
window.dispatchEvent(new window.CustomEvent('fallo-guardado', {
  detail: {
    key: 'historialRespaldos',
    categoria: 'cuota',
    mensaje: 'fallo sintético de prueba'
  }
}));
await esperar(() => window.document.querySelector('[role="alert"]'), 'aparece el aviso de cuota');

const alerta = window.document.querySelector('[role="alert"]');
assert.equal(alerta.getAttribute('aria-live'), 'assertive');
assert.match(alerta.textContent, /No hay espacio suficiente en el navegador/);
const botones = [...alerta.querySelectorAll('button')];
const reintentar = botones.find((b) => b.textContent.trim() === 'Reintentar');
assert.ok(reintentar, 'el aviso ofrece reintentar');
reintentar.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await esperar(() => reintentos.length === 1, 'se invoca el reintento');
assert.equal(reintentos[0], 'historialRespaldos');

window.dispatchEvent(new window.CustomEvent('guardado-confirmado', { detail: { key: 'historialRespaldos' } }));
await esperar(() => !window.document.querySelector('[role="alert"]'), 'se retira el aviso al confirmar');

console.log('PM20 P10 aviso de sincronización UI: PASS');
window.close();
