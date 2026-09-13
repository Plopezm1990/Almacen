import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const loaderPath = process.env.HOTFIX_SCRIPT || path.resolve('pm11-compra-mobile-loader.js');
const source = fs.readFileSync(loaderPath, 'utf8');

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

function ejecutar({ hostname = 'chic-entremet-9107cf.netlify.app', initial = {}, nubeUrl } = {}) {
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
      return { tag, setAttribute(name, value) { this[name] = value; } };
    },
  };
  const window = {
    localStorage,
    location: { hostname, href: `https://${hostname}/` },
    fetch: fetchBase,
  };
  if (nubeUrl !== undefined) window.NUBE_URL = nubeUrl;
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
  vm.runInNewContext(source, context, { filename: loaderPath });
  return { window, localStorage, calls, appended, context };
}

// 1) Preflight funcional: contexto inequívoco repara cache y completa el POST.
{
  const env = ejecutar({ initial: {
    'almacen:locales': json([{ id: 'LOCAL-1', empresaId: 'EMP-1', activo: true }]),
  }});
  assert.equal(env.window.__pm26PrefiltroHotfixVersion, 'pm26-prefiltro-context-hotfix-v1');
  assert.equal(env.localStorage.getItem('almacen:localActivoId'), json('LOCAL-1'));
  assert.deepEqual(JSON.parse(env.localStorage.getItem('almacen:empresas')), [
    { id: 'EMP-1', activo: true, recuperadaDeContextoPrefiltro: true },
  ]);
  assert.equal(env.appended.length, 1, 'PM11 debe seguir cargándose exactamente una vez');
  assert.match(env.appended[0].src, /pm11-compra-mobile-layout-v1\.js/);

  await env.window.fetch('https://example.supabase.co/rest/v1/prefiltros_candidatos', {
    method: 'POST', body: json({ token: 'abc', estado: 'pendiente' }),
  });
  const body = JSON.parse(env.calls.at(-1).init.body);
  assert.equal(body.empresa_id, 'EMP-1');
  assert.equal(body.local_id, 'LOCAL-1');
}

// 2) Negativa: varios locales activos sin selección => nunca adivina tenant.
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

// 3) Seguridad: IDs presentes nunca se sustituyen, aunque contradigan la cache.
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

// 4) Seguridad: local explícito desconocido no permite inferir empresa de otro local.
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

// 5) Aislamiento: no toca POSTs de otras tablas.
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

// 6) Aislamiento por host: con NUBE_URL definido, otro host queda intacto.
{
  const env = ejecutar({
    nubeUrl: 'https://real.supabase.co',
    initial: { 'almacen:locales': json([{ id: 'L1', empresaId: 'E1', activo: true }]) },
  });
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

// 7) Cache corrupta/no-array: fail closed, sin excepción ni contexto inventado.
{
  const env = ejecutar({ initial: {
    'almacen:locales': '{no-es-json',
    'almacen:empresas': json({ id: 'NO-ARRAY' }),
  }});
  await env.window.fetch('https://example.supabase.co/rest/v1/prefiltros_candidatos', {
    method: 'POST', body: json({ token: 'x' }),
  });
  const body = JSON.parse(env.calls.at(-1).init.body);
  assert.equal(Object.hasOwn(body, 'empresa_id'), false);
  assert.equal(Object.hasOwn(body, 'local_id'), false);
}

// 8) Local inactivo/fusionado no es operable ni se usa para reconstruir contexto.
{
  const env = ejecutar({ initial: {
    'almacen:locales': json([
      { id: 'L-OFF', empresaId: 'E1', activo: false },
      { id: 'L-MERGE', empresaId: 'E1', activo: true, fusionadoEn: 'L2' },
    ]),
    'almacen:localActivoId': json('L-OFF'),
  }});
  const r = env.window.__resolverContextoPrefiltroPM26(null);
  assert.equal(r.ok, false);
}

// 9) Idempotencia del loader: segunda ejecución no duplica wrapper ni PM11.
{
  const env = ejecutar({ initial: {
    'almacen:locales': json([{ id: 'L1', empresaId: 'E1', activo: true }]),
  }});
  const fetchPrimero = env.window.fetch;
  vm.runInNewContext(source, env.context, { filename: loaderPath });
  assert.equal(env.window.fetch, fetchPrimero);
  assert.equal(env.appended.length, 1);
}

// 10) Regresión de arquitectura del repo: loader universal antes de QA y bundle;
// reset-pruebas-preview sigue sin contener el hotfix universal.
const indexPath = path.resolve('index.html');
const resetPath = path.resolve('reset-pruebas-preview.js');
if (fs.existsSync(indexPath)) {
  const index = fs.readFileSync(indexPath, 'utf8');
  const loaderPos = index.indexOf('pm11-compra-mobile-loader.js');
  const resetPos = index.indexOf('reset-pruebas-preview.js');
  const fuentePos = index.indexOf('src="./fuente.js"');
  assert.ok(loaderPos >= 0 && resetPos >= 0 && fuentePos >= 0);
  assert.ok(loaderPos < resetPos && resetPos < fuentePos,
    'el loader universal debe ejecutarse antes del reset QA y del bundle');
}
if (fs.existsSync(resetPath)) {
  const reset = fs.readFileSync(resetPath, 'utf8');
  assert.equal(reset.includes('__pm26PrefiltroHotfixVersion'), false,
    'el hotfix universal no debe volver a mezclarse con reset-pruebas-preview.js');
  assert.match(reset, /HOST_PREVIEW/,
    'reset-pruebas-preview.js debe conservar su guard exclusivo de Deploy Preview');
}

console.log('PM27_DEFECTO_L_CONTEXT_HOTFIX=PASS');
