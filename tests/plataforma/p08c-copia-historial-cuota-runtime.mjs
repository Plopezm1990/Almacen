// Regresión del traslado de copias por cuenta cuando una copia grande no
// cabe duplicada en localStorage. Se carga el candado previo real, sin la
// siembra de QA ni la barrera posterior, para aislar la operación de cuota.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

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
const contenido = JSON.stringify([{ id: 'copia-grande', data: 'ñ'.repeat(1200) }]);
const claveDueno = 'la_suite_copia_cuenta_dueno_v1';

function conCuota(base, margen, comprobar) {
  const total = Object.entries(base).reduce((n, [k, v]) => n + k.length + v.length, 0);
  const { window } = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    url: 'https://deploy-preview-147--chic-entremet-9107cf.netlify.app/',
    runScripts: 'outside-only',
    storageQuota: total + margen
  });
  try {
    const getNativo = window.Storage.prototype.getItem.bind(window.localStorage);
    for (const [k, v] of Object.entries(base)) window.localStorage.setItem(k, v);
    window.eval(PRELOCK);
    comprobar(window.__laOwnerBootstrapSepararCopiaLocal, getNativo);
  } finally {
    window.close();
  }
}

for (const clave of ['almacen:historialRespaldos', 'almacen:auditoria', `almacen:auditoria::usuario:${A}`]) {
  const apartada = `la_suite_copia_cuenta_v1:${A}:${clave}`;
  conCuota({ [clave]: contenido, [claveDueno]: A }, 100, (separar, leer) => {
    assert.equal(separar(B).movidas, 1, clave);
    assert.equal(leer(apartada), contenido);
    assert.equal(leer(clave), null);
    assert.equal(leer(claveDueno), B);
    assert.equal(separar(A).restauradas, 1, clave);
    assert.equal(leer(clave), contenido);
    assert.equal(leer(apartada), null);
    assert.equal(leer(claveDueno), A);
  });
  conCuota({ [clave]: contenido, [claveDueno]: A }, 0, (separar, leer) => {
    assert.throws(() => separar(B), { name: 'QuotaExceededError' });
    assert.equal(leer(clave), contenido);
    assert.equal(leer(apartada), null);
    assert.equal(leer(claveDueno), A);
  });
}

console.log('PLATAFORMA_P08C_COPIA_HISTORIAL_CUOTA_RUNTIME=PASS');
