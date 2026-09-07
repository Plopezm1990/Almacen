import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const resetSource = fs.readFileSync(new URL('../../reset-pruebas-preview.js', import.meta.url), 'utf8');
const indexSource = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

function createStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    get length() { return data.size; },
    key(i) { return [...data.keys()][i] ?? null; },
    getItem(k) { return data.has(k) ? data.get(k) : null; },
    setItem(k, v) { data.set(String(k), String(v)); },
    removeItem(k) { data.delete(k); },
    snapshot() { return Object.fromEntries(data); }
  };
}

function runReset(hostname) {
  const calls = [];
  const storage = createStorage({ 'almacen:conteos': JSON.stringify([{ id: 'viejo' }]) });
  const head = { appendChild() {} };
  const document = {
    head,
    documentElement: head,
    createElement() { return { src: '', async: true, setAttribute() {} }; }
  };
  const fakeFetch = async (input) => {
    calls.push(typeof input === 'string' ? input : input?.url || '');
    return { ok: true, status: 200, url: calls.at(-1) };
  };
  const window = {
    location: { hostname, href: `https://${hostname}/` },
    localStorage: storage,
    fetch: fakeFetch,
    console
  };
  const sandbox = { window, document, localStorage: storage, console, URL, Promise, Error };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(resetSource, sandbox, { filename: 'reset-pruebas-preview.js' });
  return { window, storage, calls };
}

const preview = runReset('deploy-preview-999--chic-entremet-9107cf.netlify.app');
assert.equal(preview.window.__modoPruebasQA, true);
assert.equal(preview.window.__modoPruebasLocal, false);
assert.equal(preview.window.__qaFetchProduccionBloqueado, true);
assert.equal(preview.window.__resetPruebasEjecutado, true);
assert.ok(JSON.parse(preview.storage.getItem('almacen:empresas')).length > 0);
assert.ok(JSON.parse(preview.storage.getItem('almacen:locales')).length > 0);
assert.ok(JSON.parse(preview.storage.getItem('almacen:productos')).length > 0);
assert.equal(JSON.parse(preview.storage.getItem('almacen:localActivoId')), 'QA-A1');
console.log('P10_PREVIEW_QA_BOOTSTRAP=PASS');

const prodHost = resetSource.match(/var SUPABASE_PROD_HOST = "([^"]+)";/)?.[1];
const qaHost = resetSource.match(/var SUPABASE_QA_HOST = "([^"]+)";/)?.[1];
assert.ok(prodHost && qaHost && prodHost !== qaHost);
await assert.rejects(
  preview.window.fetch(`https://${prodHost}/rest/v1/objeto-no-inventariado`),
  /QA_BLOCKED_PRODUCTION_SUPABASE/
);
assert.equal(preview.calls.length, 0, 'Una salida productiva desconocida no debe llegar al fetch original');
const known = await preview.window.fetch(`https://${prodHost}/functions/v1/importar-albaran`);
assert.equal(known.ok, true);
assert.equal(preview.calls.length, 1);
assert.equal(new URL(preview.calls[0]).hostname, qaHost);
assert.equal(new URL(preview.calls[0]).pathname, '/functions/v1/importar-albaran');
console.log('P10_PREVIEW_PRODUCCION_BLOQUEADA_Y_EDGE_QA=PASS');

const production = runReset('chic-entremet-9107cf.netlify.app');
assert.notEqual(production.window.__modoPruebasQA, true, 'El dominio productivo no puede activar el modo QA');
assert.equal(production.storage.getItem('almacen:conteos'), JSON.stringify([{ id: 'viejo' }]));
console.log('P10_PRODUCCION_NO_RESETEADA=PASS');

const localScripts = [...indexSource.matchAll(/<script[^>]+src="(\.\/?[^"?]+|pm[^"?]+\.js)(?:\?[^\"]*)?"/g)]
  .map(m => m[1].replace(/^\.\//, ''));
for (const rel of localScripts) {
  assert.equal(fs.existsSync(new URL('../../' + rel, import.meta.url)), true, `Asset local ausente: ${rel}`);
}
assert.equal((indexSource.match(/pm12-conteo-estados-v1\.js/g) || []).length, 1);
assert.equal((indexSource.match(/pm12-stock-atomico-v1\.js/g) || []).length, 1);
assert.equal((indexSource.match(/pm12-p09-historial-informes-movil-v1\.js/g) || []).length, 1);
console.log('P10_INDEX_ASSETS_PM12=PASS');
