// PM33 P05 -- entorno aislado: valida el candidato con Auth (GoTrue) y
// PostgREST REALES contra PostgreSQL 17 real (Supabase CLI, servicios
// desechables), no con el stub de auth.uid() que usan las pruebas locales
// de tests/pm33/db/. Cubre en concreto el escenario 1 pedido por el
// propietario sobre 5dfdbca: identidad duplicada con estados distintos
// entre dos empresas, resuelta con JWT real y PostgREST real, no con
// set_config manual.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import pg from 'pg';

const env = Object.fromEntries(fs.readFileSync(new URL('./supabase/.temp/status.env', import.meta.url), 'utf8')
  .split(/\r?\n/).filter(Boolean).map(line => {
    const at = line.indexOf('=');
    return [line.slice(0, at), line.slice(at + 1).replace(/^"|"$/g, '')];
  }));
const api = env.API_URL;
const anonKey = env.ANON_KEY;
const serviceKey = env.SERVICE_ROLE_KEY;
assert.match(api || '', /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
assert.match(env.DB_URL || '', /@(127\.0\.0\.1|localhost):\d+\/postgres$/);

async function jsonRequest(path, { token = anonKey, key = anonKey, method = 'GET', body } = {}) {
  const response = await fetch(api + path, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: response.status, ok: response.ok, data };
}
async function createUser(email, password) {
  const made = await jsonRequest('/auth/v1/admin/users', {
    token: serviceKey, key: serviceKey, method: 'POST', body: { email, password, email_confirm: true }
  });
  assert.equal(made.status, 200, JSON.stringify(made));
  const signed = await jsonRequest('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email, password }
  });
  assert.equal(signed.status, 200, JSON.stringify(signed));
  return { id: made.data.id, token: signed.data.access_token };
}
function call(token, pLocalId) {
  const body = pLocalId === undefined ? {} : { p_local_id: pLocalId };
  return jsonRequest('/rest/v1/rpc/obtener_contexto_operativo', { token, method: 'POST', body });
}

const password = 'PM33-p05-local-only-2026!';
const db = new pg.Client({ connectionString: env.DB_URL });
await db.connect();

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detalle) {
  if (cond) { pass++; console.log(`[PASS] ${name}`); }
  else { fail++; failures.push(name); console.log(`[FAIL] ${name}${detalle ? ' -- ' + detalle : ''}`); }
}

try {
  await db.query(`insert into public.empresas (id, nombre, activo) values
    ('emp-A','Empresa A',true), ('emp-B','Empresa B',true)`);
  await db.query(`insert into public.locales (id, empresa_id, nombre, activo) values
    ('loc-A','emp-A','Local A',true), ('loc-B','emp-B','Local B',true)`);

  console.log('\n=== Escenario 1 (pedido explícitamente por el propietario): identidad duplicada con estados distintos ===');
  {
    // dup-9 existe en emp-A/loc-A (INACTIVO) y en emp-B/loc-B (activo).
    // Perfil Cajero/a, membresía únicamente en A.
    await db.query(`insert into public.almacen_kv (empresa_id, local_id, key, value) values
      ('emp-A','loc-A','empleados','[{"id":"dup-9","nombre":"DUP-A","rol":"Cajero/a","activo":false}]'::jsonb),
      ('emp-B','loc-B','empleados','[{"id":"dup-9","nombre":"DUP-B","rol":"Cajero/a","activo":true}]'::jsonb)`);
    const u = await createUser('e1-cajero-dup9@pm33.test', password);
    await db.query(`insert into public.perfiles (user_id, rol, empleado_id, activo) values ($1,'Cajero/a','dup-9',true)`, [u.id]);
    await db.query(`insert into public.membresias_usuario (id,user_id,empresa_id,local_id,todos_locales,rol,activo) values
      (1,$1,'emp-A','loc-A',false,'Cajero/a',true)`, [u.id]);

    const sinLocal = await call(u.token);
    check('E1 sin p_local_id: resuelve a A vía membresía', sinLocal.ok && sinLocal.data.empresaId === 'emp-A', JSON.stringify(sinLocal));

    const pidiendoB = await call(u.token, 'loc-B');
    check('E1 pidiendo loc-B explícito: RECHAZADO (nunca datos de B)',
      !pidiendoB.ok || pidiendoB.data?.empresaId !== 'emp-B',
      JSON.stringify(pidiendoB));

    const pidiendoA = await call(u.token, 'loc-A');
    check('E1 pidiendo su propio loc-A: resuelve a A vía membresía (no penaliza al usuario legítimo)',
      pidiendoA.ok && pidiendoA.data.empresaId === 'emp-A', JSON.stringify(pidiendoA));
  }

  console.log('\n=== Aislamiento básico Cajero/a A vs B (JWT real) ===');
  {
    await db.query(`insert into public.almacen_kv (empresa_id, local_id, key, value) values
      ('emp-A','loc-A','proveedores','[]'::jsonb), ('emp-B','loc-B','proveedores','[]'::jsonb)`);
    const a = await createUser('cajero-a@pm33.test', password);
    const b = await createUser('cajero-b@pm33.test', password);
    await db.query(`insert into public.perfiles (user_id, rol, activo) values ($1,'Cajero/a',true),($2,'Cajero/a',true)`, [a.id, b.id]);
    await db.query(`insert into public.membresias_usuario (id,user_id,empresa_id,local_id,todos_locales,rol,activo) values
      (2,$1,'emp-A','loc-A',false,'Cajero/a',true), (3,$2,'emp-B','loc-B',false,'Cajero/a',true)`, [a.id, b.id]);
    const ra = await call(a.token);
    const rb = await call(b.token);
    check('cajero-a acotado a emp-A', ra.ok && ra.data.empresaId === 'emp-A', JSON.stringify(ra));
    check('cajero-b acotado a emp-B', rb.ok && rb.data.empresaId === 'emp-B', JSON.stringify(rb));
  }

  console.log('\n=== Revocación de membresía bloquea la vía heredada (JWT real) ===');
  {
    // Se añade a la fila emp-A/loc-A/'empleados' ya creada en el escenario 1
    // (junto a dup-9), sin tocarlo.
    await db.query(`update public.almacen_kv set value = value || '[{"id":"rev-1","nombre":"Revocado","rol":"Camarero/a","activo":true}]'::jsonb
      where empresa_id='emp-A' and local_id='loc-A' and key='empleados'`);
    const u = await createUser('camarero-revocado@pm33.test', password);
    await db.query(`insert into public.perfiles (user_id, rol, empleado_id, activo) values ($1,'Camarero/a','rev-1',true)`, [u.id]);
    await db.query(`insert into public.membresias_usuario (id,user_id,empresa_id,local_id,todos_locales,rol,activo) values
      (4,$1,'emp-A','loc-A',false,'Camarero/a',false)`, [u.id]);
    const r = await call(u.token);
    check('membresía explícitamente inactiva bloquea la vía heredada: empleado null',
      r.ok && r.data.empleado === null, JSON.stringify(r));
  }

  console.log('\n=== Heredado legítimo sin membresía sigue funcionando (JWT real) ===');
  {
    await db.query(`update public.almacen_kv set value = value || '[{"id":"heredado-1","nombre":"Heredado","rol":"Camarero/a","activo":true}]'::jsonb
      where empresa_id='emp-A' and local_id='loc-A' and key='empleados'`);
    const u = await createUser('camarero-heredado@pm33.test', password);
    await db.query(`insert into public.perfiles (user_id, rol, empleado_id, activo) values ($1,'Camarero/a','heredado-1',true)`, [u.id]);
    const r = await call(u.token);
    check('sin fila de membresía (legado puro) sigue resolviendo por almacen_kv',
      r.ok && r.data.empleado && r.data.empleado.id === 'heredado-1', JSON.stringify(r));
  }

  console.log('\n=== Control: acceso directo a las tablas base sigue denegado vía PostgREST ===');
  {
    const anon = await jsonRequest('/rest/v1/almacen_kv?select=*');
    check('anon no puede leer almacen_kv directamente', [401, 403, 404].includes(anon.status) || (Array.isArray(anon.data) && anon.data.length === 0), JSON.stringify(anon));
  }

  console.log(`\nPM33_P05_ENTORNO_AISLADO_CHECKS=${pass + fail}`);
  console.log(`TOTAL PASS=${pass} FAIL=${fail}`);
  if (fail > 0) { console.log('Fallos:', failures.join(', ')); process.exitCode = 1; }
  else console.log('PM33_P05_ENTORNO_AISLADO_OK=1');
} finally {
  await db.end();
}
