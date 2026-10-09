// Prueba de ejecución de la pantalla «Empresas» del programa (componente REAL GestorEmpresas, leído del fuente recuperado):
// cuando la plataforma está activa, las empresas las da de alta el administrador de la plataforma y el dueño de una empresa
// cliente NO ve «+ Añadir empresa». Si la plataforma no está activa (producción hoy), todo sigue exactamente como antes.
//
// Necesita librerías que no están en el repositorio: CFG6_UI_DEPS (o CFG6E_UI_DEPS) = carpeta con node_modules que contenga
// react@18.3.1, react-dom@18.3.1 y jsdom (ver tests/cfg/cfg6e-ui-runtime.mjs).
//   CFG6_UI_DEPS=/tmp/cfg6deps node tests/plataforma/p07-empresas-sin-alta-runtime.mjs
// PLATAFORMA_P07_FUENTE (opcional) permite probar otro archivo (la versión anterior o variantes rotas de mutantes).
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
const dom = new JSDOM('<!doctype html><html><body><div id="raiz"></div></body></html>', { url: 'https://preview.test/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.localStorage = dom.window.localStorage;
globalThis.FileReader = dom.window.FileReader;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.matchMedia = dom.window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
const React = require('react');
const { createRoot } = require('react-dom/client');
const act = React.act;

const REPO = resolve(new URL('../../', import.meta.url).pathname);
const origen = process.env.PLATAFORMA_P07_FUENTE || join(REPO, 'source-recovery/fuente-recuperado.js');

// ---------- carga del módulo real ----------
const lineas = readFileSync(origen, 'utf8').split('\n');
const ini = lineas.findIndex((l) => l.startsWith('import React'));
let fin = ini;
while (lineas[fin + 1].startsWith('import ')) fin += 1;
const iconos = lineas.slice(ini, fin + 1).find((l) => l.includes('lucide-react')).match(/\{([^}]*)\}/)[1].split(',').map((x) => x.trim().split(' as ').pop());
const stubs = { React, ReactNS: React, import_client2: { createRoot: () => ({ render() {}, unmount() {} }) }, createRoot: () => ({ render() {}, unmount() {} }), createClient: () => ({}), E: function () {}, autoTable: () => {}, XLSX: { utils: {}, writeFile() {}, writeFileSync() {} } };
const fabrica = new Function(...Object.keys(stubs), ...iconos, 'X2', lineas.slice(fin + 1).join('\n') + '\nreturn { GestorEmpresas };');
const mod = fabrica(...Object.values(stubs), ...iconos.map(() => () => null), () => null);

const resultados = [];
const ok = (nombre, cond, det) => resultados.push({ nombre, ok: !!cond, det: cond ? undefined : det });
process.on('unhandledRejection', (e) => { resultados.push({ nombre: 'RECHAZO NO CONTROLADO', ok: false, det: String((e && e.stack) || e).slice(0, 400) }); });
const botones = () => Array.from(document.querySelectorAll('button')).map((b) => b.textContent.trim());
const texto = () => document.getElementById('raiz').textContent;

const EMPRESAS = [
  { id: 'e1', razonSocial: 'Bar La Esquina S.L.', marca: 'La Esquina', nif: 'B12345617', activo: true },
  { id: 'e2', razonSocial: 'Cafetería Sol S.L.', marca: 'Sol', nif: '', activo: true }
];

let raiz = null;
async function montar(plataformaActiva) {
  if (raiz) { await act(async () => { raiz.unmount(); }); raiz = null; }
  document.getElementById('raiz').innerHTML = '';
  if (plataformaActiva === undefined) delete dom.window.__laPlataformaActiva; else dom.window.__laPlataformaActiva = plataformaActiva;
  raiz = createRoot(document.getElementById('raiz'));
  await act(async () => {
    raiz.render(React.createElement(mod.GestorEmpresas, { empresas: EMPRESAS, setEmpresas: () => {}, locales: [], esPropietario: true, registrarAuditoria: () => {} }));
  });
}

// Plataforma activa: no se ofrece añadir empresas.
await montar(true);
ok('1a. con la plataforma activa NO hay «+ Añadir empresa»', !botones().some((t) => /Añadir empresa/.test(t)), botones());
ok('1b. se explica quién da de alta las empresas', /Las empresas las da de alta el administrador de la plataforma\./.test(texto()));
ok('1c. se siguen viendo las empresas y sus botones de siempre', /Bar La Esquina S\.L\./.test(texto()) && /Cafetería Sol S\.L\./.test(texto()) && botones().filter((t) => t === 'Desactivar').length === 2, botones());

// Producción hoy / servidor sin plataforma: como siempre.
for (const [etiqueta, valor] of [['false', false], ['sin definir', undefined], ['"true" como texto', 'true'], ['1', 1]]) {
  await montar(valor);
  ok(`2. plataforma ${etiqueta}: se ofrece «+ Añadir empresa» como siempre`, botones().includes('+ Añadir empresa') && !/administrador de la plataforma/.test(texto()), botones());
}

// Con el botón visible, sigue abriendo el formulario de alta.
await montar(false);
const botonAnadir = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '+ Añadir empresa');
await act(async () => { botonAnadir.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
ok('3. «+ Añadir empresa» sigue abriendo el formulario de alta cuando no hay plataforma', /Razón social/.test(document.body.textContent), document.body.textContent.slice(-300));

if (raiz) await act(async () => { raiz.unmount(); });
const fallos = resultados.filter((r) => !r.ok);
for (const r of resultados) console.log(`${r.ok ? 'OK ' : 'FALLO'} ${r.nombre}${r.ok ? '' : ' → ' + (typeof r.det === 'string' ? r.det : JSON.stringify(r.det))}`);
console.log(`PLATAFORMA_P07_EMPRESAS_SIN_ALTA: ${resultados.length - fallos.length}/${resultados.length}`);
if (fallos.length) process.exit(1);
console.log('PLATAFORMA_P07_EMPRESAS_SIN_ALTA_RUNTIME=PASS');
