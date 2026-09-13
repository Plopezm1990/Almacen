import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const scriptPath = process.env.HOTFIX_SCRIPT || path.resolve('reset-pruebas-preview.js');
const source = fs.readFileSync(scriptPath, 'utf8');

function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    key(i) { return [...data.keys()][i] ?? null; },
    getItem(k) { return data.has(k) ? data.get(k) : null; },
    setItem(k, v) { data.set(String(k), String(v)); },
    removeItem(k) { data.delete(String(k)); },
    snapshot() { return Object.fromEntries(data); },
  };
}

function json(value) { return JSON.stringify(value); }

function ejecutar({ hostname = 'chic-entremet-9107cf.netlify.app', initial = {} } = {}) {
  const localStorage = storage(initial);
  const calls = [];
  const appended = [];
  const fetchBase = async (input, init = {}) => {
    calls.push({ input, init: { ...init } });
    return { ok: true, status: 201 };
  };
  const document = {
    head: { appendChild(node) { appended.push(node); } },
    documentElement: { appendChild(node) { appended.push(node); } },
    createElement(tag) {
      return {
        tag,
        setAttribute(name, value) { this[name] = value; },
      };
    },
  };
  const window = {
    localStorage,
    location: { hostname, href: `https://${hostname}/` },
    fetch: fetchBase,
  };
  const context = {
    window,
    document,
    localStorage,
    URL,
    Promise,
    JSON,
    Array,
    Object,
    String,
    console: { info() {}, warn() {}, error() {}, log() {} },
  };
  vm.runInNewContext(source, context, { filename: scriptPath });
  return { window, localStorage, calls, appended };
}

// 1) Contexto inequívoco: reconstruye empresa/local y completa el POST.
{
  const env = ejecutar({ initial: {
    'almacen:locales': json([{ id: 'LOCAL-1', empresaId: 'EMP-1', activo: true }]),
  }});
  assert.equal(env.window.__pm26PrefiltroHotfixVersion, 'pm26-prefiltro-context-hotfix-v1');
  assert.equal(env.localStorage.getItem('almacen:localActivoId'), json('LOCAL-1'));
  assert.deepEqual(JSON.parse(env.localStorage.getItem('almacen:empresas')), [
    { id: 'EMP-1', activo: true, recuperadaDeContextoPrefiltro: true },
  ]);
  assert.equal(env.appended.length, 0, 'reset-pruebas-preview no debe reinyectar el loader PM11 separado');

  await env.window.fetch('https://example.supabase.co/rest/v1/prefiltros_candidatos', {
    method: 'POST',
    body: json({ token: 'abc', candidato_nombre: 'PRUEBA PM27', estado: 'pendiente' }),
  });
  const body = JSON.parse(env.calls.at(-1).init.body);
  assert.equal(body.empresa_id, 'EMP-1');
  assert.equal(body.local_id, 'LOCAL-1');
}

// 2) Varios locales activos sin selección: no adivina tenant.
{
  const env = ejecutar({ initial: {
    'almacen:locales': json([
      { id: 'L1', empresaId: 'E1', activo: true },
      { id: 'L2', empresaId: 'E1', activo: true },
    ]),
  }});
  await env.window.fetch('https://example.supabase.co/rest/v1/prefiltros_candidatos', {
    method: 'POST', body: json({ token: 'x' }),
  });
  const body = JSON.parse(env.calls.at(-1).init.body);
  assert.equal(Object.hasOwn(body, 'empresa_id'), false);
  assert.equal(Object.hasOwn(body, 'local_id'), false);
}

// 3) IDs ya presentes: nunca los sustituye, incluso si no coinciden con la caché.
{
  const env = ejecutar({ initial: {
    'almacen:locales': json([{ id: 'L1', empresaId: 'E1', activo: true }]),
    'almacen:localActivoId': json('L1'),
  }});
  await env.window.fetch('https://example.supabase.co/rest/v1/prefiltros_candidatos', {
    method: 'POST', body: json({ token: 'x', empresa_id: 'OTRA-E', local_id: 'OTRO-L' }),
  });
  const body = JSON.parse(env.calls.at(-1).init.body);
  assert.equal(body.empresa_id, 'OTRA-E');
  assert.equal(body.local_id, 'OTRO-L');
}

// 3b) Local explícito desconocido con empresa ausente: no infiere otra empresa.
{
  const env = ejecutar({ initial: {
    'almacen:locales': json([{ id: 'L1', empresaId: 'E1', activo: true }]),
    'almacen:localActivoId': json('L1'),
  }});
  await env.window.fetch('https://example.supabase.co/rest/v1/prefiltros_candidatos', {
    method: 'POST', body: json({ token: 'x', local_id: 'OTRO-L' }),
  });
  const body = JSON.parse(env.calls.at(-1).init.body);
  assert.equal(body.local_id, 'OTRO-L');
  assert.equal(Object.hasOwn(body, 'empresa_id'), false);
}

// 4) No toca POSTs de otras tablas.
{
  const original = json({ token: 'x' });
  const env = ejecutar({ initial: {
    'almacen:locales': json([{ id: 'L1', empresaId: 'E1', activo: true }]),
  }});
  await env.window.fetch('https://example.supabase.co/rest/v1/clientes_empresa', {
    method: 'POST', body: original,
  });
  assert.equal(env.calls.at(-1).init.body, original);
}

// 4b) Si NUBE_URL ya está definido, solo modifica peticiones a ese host.
{
  const env = ejecutar({ initial: {
    'almacen:locales': json([{ id: 'L1', empresaId: 'E1', activo: true }]),
  }});
  env.window.NUBE_URL = 'https://real.supabase.co';
  const original = json({ token: 'x' });
  await env.window.fetch('https://otro.supabase.co/rest/v1/prefiltros_candidatos', {
    method: 'POST', body: original,
  });
  assert.equal(env.calls.at(-1).init.body, original);
  await env.window.fetch('https://real.supabase.co/rest/v1/prefiltros_candidatos', {
    method: 'POST', body: original,
  });
  const body = JSON.parse(env.calls.at(-1).init.body);
  assert.equal(body.empresa_id, 'E1');
  assert.equal(body.local_id, 'L1');
}

// 5) Deploy Preview conserva el comportamiento QA existente y no reinyecta loaders.
{
  const env = ejecutar({ hostname: 'deploy-preview-38--chic-entremet-9107cf.netlify.app' });
  assert.equal(env.window.__modoPruebasQA, true);
  assert.equal(env.window.__modoPruebasLocal, false);
  const qaLocales = JSON.parse(env.localStorage.getItem('almacen:locales'));
  assert.equal(Array.isArray(qaLocales), true);
  assert.equal(qaLocales.some((l) => l.id === 'QA-A1'), true);
  assert.equal(env.appended.length, 0, 'el loader PM11 vive en su propio archivo');
}

// 6) En el repo real: loader separado -> compatibilidad/reset -> bundle.
const indexPath = path.resolve('index.html');
if (fs.existsSync(indexPath)) {
  const index = fs.readFileSync(indexPath, 'utf8');
  const loaderPos = index.indexOf('pm11-compra-mobile-loader.js');
  const resetPos = index.indexOf('reset-pruebas-preview.js');
  const fuentePos = index.indexOf('src="./fuente.js"');
  assert.ok(loaderPos >= 0, 'index.html debe cargar pm11-compra-mobile-loader.js');
  assert.ok(resetPos >= 0, 'index.html debe cargar reset-pruebas-preview.js');
  assert.ok(fuentePos >= 0, 'index.html debe cargar fuente.js');
  assert.ok(loaderPos < resetPos, 'el loader PM11 separado debe cargar antes del reset/compatibilidad');
  assert.ok(resetPos < fuentePos, 'la compatibilidad de contexto debe instalarse antes de fuente.js');
}

console.log('PM27_P01_DEFECTO_L_CONTEXT_HOTFIX=PASS');
