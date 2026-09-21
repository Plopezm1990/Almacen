import assert from 'node:assert/strict';
import fs from 'node:fs';

const statusPath = new URL('../../tests/pm12/supabase-full/supabase/.temp/status.env', import.meta.url);
const env = Object.fromEntries(
  fs.readFileSync(statusPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      const at = line.indexOf('=');
      return [line.slice(0, at), line.slice(at + 1).replace(/^"|"$/g, '')];
    })
);

const api = env.API_URL;
const anonKey = env.ANON_KEY;
assert.match(api || '', /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
assert.match(env.DB_URL || '', /@(127\.0\.0\.1|localhost):\d+\/postgres$/);

async function request(path, { token = anonKey, method = 'GET', body } = {}) {
  const response = await fetch(api + path, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: response.status, ok: response.ok, data };
}

async function signIn(email, password) {
  const r = await request('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email, password }
  });
  assert.equal(r.status, 200, JSON.stringify(r));
  assert.ok(r.data?.access_token);
  return r.data.access_token;
}

function decodeJwt(token) {
  const parts = token.split('.');
  assert.equal(parts.length, 3, 'JWT debe tener tres segmentos');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
}

const password = 'PM12-local-only-2026!';
const owner = await signIn('owner-p08@example.test', password);
const outsider = await signIn('outsider-p08@example.test', password);

const ownerClaims = decodeJwt(owner);
const outsiderClaims = decodeJwt(outsider);
assert.equal(ownerClaims.role, 'authenticated');
assert.equal(outsiderClaims.role, 'authenticated');
assert.match(ownerClaims.sub || '', /^[0-9a-f-]{36}$/i);
assert.match(outsiderClaims.sub || '', /^[0-9a-f-]{36}$/i);
assert.notEqual(ownerClaims.sub, outsiderClaims.sub);
console.log('PM25_P02_JWT_REAL_POST_RESTORE=PASS');

const ownerStock = await request(
  '/rest/v1/stock_ubicacion?select=empresa_id,local_id,producto_id,almacen,piso&empresa_id=eq.E&local_id=eq.L&producto_id=eq.p',
  { token: owner }
);
assert.equal(ownerStock.status, 200, JSON.stringify(ownerStock));
assert.equal(ownerStock.data.length, 1, JSON.stringify(ownerStock.data));
assert.equal(Number(ownerStock.data[0].almacen) + Number(ownerStock.data[0].piso), 10);

const outsiderStock = await request(
  '/rest/v1/stock_ubicacion?select=empresa_id,local_id,producto_id,almacen,piso',
  { token: outsider }
);
assert.equal(outsiderStock.status, 200, JSON.stringify(outsiderStock));
assert.deepEqual(outsiderStock.data, []);
console.log('PM25_P02_RLS_POST_RESTORE=PASS');

const anonStock = await request('/rest/v1/stock_ubicacion?select=empresa_id,local_id,producto_id');
assert.ok(
  [401, 403, 404].includes(anonStock.status) ||
  (anonStock.status === 200 && Array.isArray(anonStock.data) && anonStock.data.length === 0),
  JSON.stringify(anonStock)
);

const directWrite = await request(
  '/rest/v1/stock_ubicacion?empresa_id=eq.E&local_id=eq.L&producto_id=eq.p',
  { token: owner, method: 'PATCH', body: { almacen: 999 } }
);
assert.ok([401, 403].includes(directWrite.status), JSON.stringify(directWrite));
console.log('PM25_P02_POSTGREST_LEAST_PRIVILEGE_POST_RESTORE=PASS');

const reversos = await request(
  '/rest/v1/movimientos_stock?select=operation_id,tipo,delta_total&tipo=eq.REVERSO',
  { token: owner }
);
assert.equal(reversos.status, 200, JSON.stringify(reversos));
assert.equal(reversos.data.length, 1, JSON.stringify(reversos.data));
assert.equal(reversos.data[0].tipo, 'REVERSO');

const operaciones = await request(
  '/rest/v1/stock_operaciones?select=operation_id,tipo&empresa_id=eq.E&local_id=eq.L',
  { token: owner }
);
assert.equal(operaciones.status, 200, JSON.stringify(operaciones));
const ids = new Set(operaciones.data.map(x => x.operation_id));
assert.ok(ids.has('pm12-ajuste-conteo:c:2026-09-07'), JSON.stringify(operaciones.data));
assert.ok(ids.has('pm12-cancelar-conteo:c:2026-09-07'), JSON.stringify(operaciones.data));
console.log('PM25_P02_REVERSION_PERSISTE_TRAS_RESTORE=PASS');

console.log('PM25_P02_INTEGRAL_POST_RESTORE=PASS');
