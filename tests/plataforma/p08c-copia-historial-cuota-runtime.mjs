// Regresión del traslado de copias por cuenta cuando historialRespaldos no
// cabe duplicado en localStorage. Se carga el candado previo real, sin la
// siembra de QA ni la barrera posterior, para aislar la operación de cuota.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const depsDir = process.env.CFG6E_UI_DEPS || process.env.CFG6_UI_DEPS;
if (!depsDir) {
  console.error('CFG6_UI_DEPS no está definido: indica una carpeta con node_modules que contenga jsdom.');
  process.exit(2);
}
const require = createRequire(join(resolve(depsDir), 'package.json'));
const { JSDOM } = require('jsdom');
const PRELOCK = readFileSync(new URL('../../owner-bootstrap-prelock.js', import.meta.url), 'utf8');

const A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const B = 'bbbbbbbb-0000-4000-8000-00000000000b';
const historial = JSON.stringify([{ id: 'respaldo-grande', data: 'h'.repeat(1200) }]);
const base = {
  'almacen:historialRespaldos': historial,
  la_suite_copia_cuenta_dueno_v1: A
};
const total = Object.entries(base).reduce((n, [k, v]) => n + k.length + v.length, 0);
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
  url: 'https://deploy-preview-147--chic-entremet-9107cf.netlify.app/',
  runScripts: 'outside-only',
  storageQuota: total + 100
});
const { window } = dom;
const getNativo = window.Storage.prototype.getItem;
for (const [k, v] of Object.entries(base)) getNativo.call(window.localStorage, k) === null && window.Storage.prototype.setItem.call(window.localStorage, k, v);
window.eval(PRELOCK);

const resultado = window.__laOwnerBootstrapSepararCopiaLocal(B);
const apartado = getNativo.call(window.localStorage, `la_suite_copia_cuenta_v1:${A}:almacen:historialRespaldos`);
const vivo = getNativo.call(window.localStorage, 'almacen:historialRespaldos');
if (resultado.cambio !== true || apartado !== historial || vivo !== null) {
  throw new Error(`El traslado con cuota no conservó la copia: ${JSON.stringify({ resultado, apartadoLength: apartado && apartado.length, vivo: vivo && vivo.length })}`);
}
console.log('PLATAFORMA_P08C_COPIA_HISTORIAL_CUOTA_RUNTIME=PASS');
window.close();
