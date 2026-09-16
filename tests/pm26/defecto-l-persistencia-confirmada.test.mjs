import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ownerPath = path.resolve('owner-bootstrap-prelock.js');
const ownerSource = fs.readFileSync(ownerPath, 'utf8');
const resetSource = fs.readFileSync(path.resolve('reset-pruebas-preview.js'), 'utf8');

class MockStorage {
  constructor(initial = {}) {
    this.data = new Map(Object.entries(initial));
  }
  get length() { return this.data.size; }
  key(i) { return [...this.data.keys()][i] ?? null; }
  getItem(k) { return this.data.has(String(k)) ? this.data.get(String(k)) : null; }
  setItem(k, v) { this.data.set(String(k), String(v)); }
  removeItem(k) { this.data.delete(String(k)); }
  clear() { this.data.clear(); }
}

const TOKEN = 'a'.repeat(64);
const FILA = {
  token: TOKEN,
  candidato_nombre: 'PRUEBA PM26',
  estado: 'pendiente',
  empresa_id: 'EMP-1',
  local_id: 'LOCAL-1',
};

function headersAObjeto(headers) {
  if (!headers) return {};
  if (typeof headers.forEach === 'function') {
    const out = {};
    headers.forEach((v, k) => { out[k] = v; });
    return out;
  }
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
}

function crearEntorno({ mode = 'match', nubeUrl = 'https://real.supabase.co' } = {}) {
  const calls = [];
  const localStorage = new MockStorage();
  const sessionStorage = new MockStorage();

  const fetchBase = async (input, init = {}) => {
    const url = String(input);
    const copied = {
      ...init,
      headers: headersAObjeto(init.headers),
    };
    calls.push({ url, init: copied });

    if (mode === 'server-error') {
      return new Response(JSON.stringify({ code: '42501', message: 'forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body = null;
    try { body = typeof init.body === 'string' ? JSON.parse(init.body) : null; } catch {}
    let rows = [];
    if (mode === 'match' && body) {
      rows = [{
        token: body.token,
        empresa_id: body.empresa_id,
        local_id: body.local_id,
        estado: body.estado,
      }];
    } else if (mode === 'wrong-tenant' && body) {
      rows = [{
        token: body.token,
        empresa_id: body.empresa_id,
        local_id: 'OTRO-LOCAL',
        estado: body.estado,
      }];
    } else if (mode === 'wrong-token' && body) {
      rows = [{
        token: 'b'.repeat(64),
        empresa_id: body.empresa_id,
        local_id: body.local_id,
        estado: body.estado,
      }];
    } else if (mode === 'wrong-state' && body) {
      rows = [{
        token: body.token,
        empresa_id: body.empresa_id,
        local_id: body.local_id,
        estado: 'completado',
      }];
    }

    return new Response(JSON.stringify(rows), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const appended = [];
  const documentElement = {
    classList: { add() {}, remove() {} },
    appendChild(node) { appended.push(node); },
  };
  const document = {
    head: { appendChild(node) { appended.push(node); } },
    documentElement,
    createElement(tag) { return { tag, id: '', textContent: '', style: {}, setAttribute() {} }; },
  };

  const window = {
    fetch: fetchBase,
    localStorage,
    sessionStorage,
    location: { hostname: 'chic-entremet-9107cf.netlify.app', href: 'https://chic-entremet-9107cf.netlify.app/' },
    NUBE_URL: nubeUrl,
    NUBE_CLAVE: 'public-test-key',
  };

  const context = {
    window,
    document,
    Storage: MockStorage,
    URL,
    Response,
    Headers,
    Promise,
    JSON,
    Array,
    Object,
    String,
    Date,
    console: { info() {}, warn() {}, error() {}, log() {} },
  };
  vm.runInNewContext(ownerSource, context, { filename: ownerPath });
  return { window, calls, appended };
}

async function insertar(env, fila = FILA, url = 'https://real.supabase.co/rest/v1/prefiltros_candidatos') {
  return env.window.fetch(url, {
    method: 'POST',
    headers: {
      apikey: 'public-test-key',
      Authorization: 'Bearer test-jwt',
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(fila),
  });
}

// 1) Un único POST con representación coincidente confirma el alta.
{
  const env = crearEntorno({ mode: 'match' });
  assert.equal(env.window.__pm26PrefiltroPersistenciaVersion, 'pm26-prefiltro-persistencia-confirmada-v2');
  const response = await insertar(env);
  assert.equal(response.status, 201);
  assert.equal(response.ok, true);
  assert.equal(env.calls.length, 1, 'la confirmación debe usar el mismo POST, sin segunda lectura');

  const llamada = env.calls[0];
  const url = new URL(llamada.url);
  assert.equal(url.searchParams.get('select'), 'token,empresa_id,local_id,estado');
  const prefer = Object.entries(llamada.init.headers).find(([k]) => k.toLowerCase() === 'prefer')?.[1] || '';
  assert.match(String(prefer), /return=representation/i);
  assert.doesNotMatch(String(prefer), /return=minimal/i);
  assert.match(String(prefer), /resolution=merge-duplicates/i);
  assert.deepEqual(JSON.parse(llamada.init.body), FILA);
}

// 2) HTTP 201 sin fila representada no se acepta como éxito funcional.
{
  const env = crearEntorno({ mode: 'empty' });
  const response = await insertar(env);
  assert.equal(response.status, 409);
  assert.equal(response.ok, false);
  assert.equal((await response.json()).code, 'PREFILTRO_PERSISTENCIA_NO_CONFIRMADA');
  assert.equal(env.calls.length, 1);
}

// 3) Tenant, token o estado distintos se rechazan fail-closed.
for (const mode of ['wrong-tenant', 'wrong-token', 'wrong-state']) {
  const env = crearEntorno({ mode });
  const response = await insertar(env);
  assert.equal(response.status, 409, `debe rechazar ${mode}`);
  assert.equal(response.ok, false);
  assert.equal(env.calls.length, 1);
}

// 4) Un error real de RLS/servidor se conserva; no se disfraza como 409 local.
{
  const env = crearEntorno({ mode: 'server-error' });
  const response = await insertar(env);
  assert.equal(response.status, 403);
  assert.equal(response.ok, false);
  assert.equal(env.calls.length, 1);
}

// 5) Solicitud no verificable (token inválido / tenant incompleto) no sale a red.
{
  const env = crearEntorno({ mode: 'match' });
  const response = await insertar(env, { ...FILA, token: 'corto' });
  assert.equal(response.status, 409);
  assert.equal(env.calls.length, 0);
}
{
  const env = crearEntorno({ mode: 'match' });
  const { local_id, ...sinLocal } = FILA;
  const response = await insertar(env, sinLocal);
  assert.equal(response.status, 409);
  assert.equal(env.calls.length, 0);
}

// 6) No toca POSTs de otras tablas ni hosts ajenos al backend configurado.
{
  const env = crearEntorno({ mode: 'match' });
  const response = await env.window.fetch('https://real.supabase.co/rest/v1/clientes_empresa', {
    method: 'POST',
    body: JSON.stringify({ id: 'C-1' }),
  });
  assert.equal(response.status, 201);
  assert.equal(env.calls.length, 1);
  assert.equal(new URL(env.calls[0].url).searchParams.has('select'), false);
}
{
  const env = crearEntorno({ mode: 'match', nubeUrl: 'https://real.supabase.co' });
  const response = await insertar(env, FILA, 'https://otro.supabase.co/rest/v1/prefiltros_candidatos');
  assert.equal(response.status, 201);
  assert.equal(env.calls.length, 1);
  assert.equal(new URL(env.calls[0].url).searchParams.has('select'), false);
}

// 7) Contrato de orden: prelock instala el guard antes de reset; reset captura
// ese fetch y su hotfix de contexto queda por fuera; ambos cargan antes del bundle.
{
  const index = fs.readFileSync(path.resolve('index.html'), 'utf8');
  const ownerPos = index.indexOf('owner-bootstrap-prelock.js');
  const resetPos = index.indexOf('reset-pruebas-preview.js');
  const fuentePos = index.indexOf('src="./fuente.js"');
  assert.ok(ownerPos >= 0 && resetPos >= 0 && fuentePos >= 0);
  assert.ok(ownerPos < resetPos, 'owner-bootstrap-prelock debe cargar antes del hotfix de contexto');
  assert.ok(resetPos < fuentePos, 'reset-pruebas-preview debe cargar antes del bundle');
  assert.match(resetSource, /var fetchOriginalPM26 = window\.fetch\.bind\(window\)/);
  assert.match(resetSource, /window\.fetch = fetchProtegidoPM26/);
}

console.log('PM26_DEFECTO_L_PERSISTENCIA_CONFIRMADA=PASS');