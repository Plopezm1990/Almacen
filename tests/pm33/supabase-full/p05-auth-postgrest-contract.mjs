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
// El propietario pidió explícitamente exigir el rechazo esperado y SU
// CÓDIGO, no solo "la llamada no tuvo éxito": un HTTP 500 (fallo de
// infraestructura -- PostgREST caído, la RPC no existe, un error de
// sintaxis en el propio SQL...) también hace que `.ok` sea false, y eso
// NUNCA demuestra aislamiento correcto -- demuestra que la petición no
// llegó a evaluarse. Este helper exige las tres cosas a la vez: nunca un
// 500, un HTTP de rechazo real (4xx), y el código de error explícito
// 42501 (insufficient_privilege) que el propio candidato P05 usa en
// TODOS sus `raise exception ... using errcode = '42501'` -- nunca solo
// "cualquier error". No se fija un único status HTTP exacto (la
// asignación status<->código de Postgres es cosa de PostgREST, no del
// candidato), pero SÍ se exige que sea un 4xx explícito, nunca un 5xx.
function checkRechazo(nombre, respuesta, patronMensaje) {
  const detalle = JSON.stringify(respuesta);
  check(`${nombre}: nunca un HTTP 500 (un fallo de infraestructura no es aislamiento correcto)`, respuesta.status !== 500, detalle);
  check(`${nombre}: HTTP de rechazo real (4xx explícito, no 2xx ni 5xx)`, respuesta.status >= 400 && respuesta.status < 500, detalle);
  check(`${nombre}: código de error explícito 42501 (insufficient_privilege) en el cuerpo, no un mensaje genérico`, !!(respuesta.data && respuesta.data.code === '42501'), detalle);
  if (patronMensaje) {
    check(`${nombre}: mensaje reconocible (${patronMensaje})`, !!(respuesta.data && typeof respuesta.data.message === 'string' && patronMensaje.test(respuesta.data.message)), detalle);
  }
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
    check('E1 sin p_local_id: resuelve a A vía membresía', sinLocal.ok && sinLocal.status === 200 && sinLocal.data.empresaId === 'emp-A', JSON.stringify(sinLocal));

    const pidiendoB = await call(u.token, 'loc-B');
    checkRechazo('E1 pidiendo loc-B explícito', pidiendoB, /no autorizad/i);

    const pidiendoA = await call(u.token, 'loc-A');
    check('E1 pidiendo su propio loc-A: resuelve a A vía membresía (no penaliza al usuario legítimo)',
      pidiendoA.ok && pidiendoA.status === 200 && pidiendoA.data.empresaId === 'emp-A', JSON.stringify(pidiendoA));
  }

  console.log('\n=== Control: sin autenticar (sin JWT de usuario real) también se rechaza por código, no a ciegas ===');
  {
    const sinAutenticar = await call(anonKey);
    checkRechazo('llamada con la clave anon (auth.uid() nulo)', sinAutenticar, /no autenticad/i);
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
    check('cajero-a acotado a emp-A', ra.ok && ra.status === 200 && ra.data.empresaId === 'emp-A', JSON.stringify(ra));
    check('cajero-b acotado a emp-B', rb.ok && rb.status === 200 && rb.data.empresaId === 'emp-B', JSON.stringify(rb));
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
      r.ok && r.status === 200 && r.data.empleado === null, JSON.stringify(r));
  }

  console.log('\n=== Heredado legítimo sin membresía sigue funcionando (JWT real) ===');
  {
    await db.query(`update public.almacen_kv set value = value || '[{"id":"heredado-1","nombre":"Heredado","rol":"Camarero/a","activo":true}]'::jsonb
      where empresa_id='emp-A' and local_id='loc-A' and key='empleados'`);
    const u = await createUser('camarero-heredado@pm33.test', password);
    await db.query(`insert into public.perfiles (user_id, rol, empleado_id, activo) values ($1,'Camarero/a','heredado-1',true)`, [u.id]);
    const r = await call(u.token);
    check('sin fila de membresía (legado puro) sigue resolviendo por almacen_kv',
      r.ok && r.status === 200 && r.data.empleado && r.data.empleado.id === 'heredado-1', JSON.stringify(r));
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
