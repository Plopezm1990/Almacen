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
const password = 'PM12-local-only-2026!';
const [owner, cashier, outsider] = await Promise.all([
  createUser('owner-p08@example.test', password),
  createUser('cashier-p08@example.test', password),
  createUser('outsider-p08@example.test', password)
]);
const db = new pg.Client({ connectionString: env.DB_URL });
await db.connect();
try {
  await db.query(`insert into public.membresias_usuario(user_id,empresa_id,local_id,rol) values
    ($1,'E','L','Propietario'),($2,'E','L','Cajero/a'),($3,'OTHER','X','Propietario')`, [owner.id, cashier.id, outsider.id]);
  await db.query("insert into public.stock_ubicacion(empresa_id,local_id,producto_id,almacen,piso) values('E','L','p',10,0)");
  const operationId = 'pm12-ajuste-conteo:c:2026-09-07';
  const intent = { id: 'c', empresaId: 'E', localId: 'L', estado: 'COMPLETADO', cerradoEn: '2026-09-07', ambito: 'total', items: [{ productoId: 'p', conteo: 8 }] };
  const movement = { productoId: 'p', movimientoId: operationId + ':producto:p:inventario-total', operationId, cantidad: -2, tipo: 'INVENTARIO', origen: 'aplicarAjustes', documentoOrigenId: 'c', afectaStockTotal: true, afectaStockPisoVenta: false, camposExtra: { pm12PlanLeg: 'inventario-total' } };
  const args = { p_operation_id: operationId, p_empresa_id: 'E', p_local_id: 'L', p_intencion: intent, p_plan: [movement], p_bases: [{ productoId: 'p', conteo: 8, stock: 10, stockPisoVenta: 0, deficitPendiente: 0 }] };
  const call = token => jsonRequest('/rest/v1/rpc/pm12_confirmar_ajuste_stock', { token, method: 'POST', body: args });

  const anonymous = await call(anonKey);
  assert.ok([401, 403, 404].includes(anonymous.status), JSON.stringify(anonymous));
  const deniedRole = await call(cashier.token);
  assert.equal(deniedRole.ok, false); assert.match(JSON.stringify(deniedRole.data), /ajuste_no_autorizado/);
  const deniedScope = await call(outsider.token);
  assert.equal(deniedScope.ok, false); assert.match(JSON.stringify(deniedScope.data), /contexto_no_autorizado/);

  const results = await Promise.all([call(owner.token), call(owner.token)]);
  assert.ok(results.every(x => x.status === 200), JSON.stringify(results));
  assert.deepEqual(results.map(x => x.data.replayed).sort(), [false, true]);
  const state = await db.query("select s.almacen+s.piso total,(select count(*) from public.movimientos_stock) movements,o.actor_user_id from public.stock_ubicacion s cross join public.stock_operaciones o where s.producto_id='p' and o.operation_id=$1", [operationId]);
  assert.equal(Number(state.rows[0].total), 8); assert.equal(Number(state.rows[0].movements), 1); assert.equal(state.rows[0].actor_user_id, owner.id);
  console.log('P08_SUPABASE_AUTH_POSTGREST_CONCURRENT_REPLAY=PASS');

  const ownerRows = await jsonRequest('/rest/v1/stock_operaciones?select=operation_id&operation_id=eq.' + encodeURIComponent(operationId), { token: owner.token });
  const outsiderRows = await jsonRequest('/rest/v1/stock_operaciones?select=operation_id', { token: outsider.token });
  assert.equal(ownerRows.status, 200); assert.equal(ownerRows.data.length, 1);
  assert.equal(outsiderRows.status, 200); assert.equal(outsiderRows.data.length, 0);
  const patch = await jsonRequest("/rest/v1/stock_ubicacion?empresa_id=eq.E&local_id=eq.L&producto_id=eq.p", { token: owner.token, method: 'PATCH', body: { almacen: 99 } });
  assert.ok([401, 403].includes(patch.status), JSON.stringify(patch));
  console.log('P08_SUPABASE_RLS_SCOPE_AND_DIRECT_WRITE_DENIED=PASS');

  const cancelId = 'pm12-cancelar-conteo:c:2026-09-07';
  const cancelArgs = { p_empresa_id: 'E', p_local_id: 'L', p_conteo: results[0].data.conteo, p_cancelacion: { operationId: cancelId, motivo: 'Anular', responsable: 'A' } };
  const cancel = () => jsonRequest('/rest/v1/rpc/pm12_cancelar_conteo_stock', { token: owner.token, method: 'POST', body: cancelArgs });
  const cancelled = await Promise.all([cancel(), cancel()]);
  assert.ok(cancelled.every(x => x.status === 200), JSON.stringify(cancelled));
  assert.deepEqual(cancelled.map(x => x.data.replayed).sort(), [false, true]);
  const after = await db.query("select almacen+piso total,(select count(*) from public.movimientos_stock where tipo='REVERSO') reversals from public.stock_ubicacion where producto_id='p'");
  assert.equal(Number(after.rows[0].total), 10); assert.equal(Number(after.rows[0].reversals), 1);
  console.log('P08_SUPABASE_AUTH_POSTGREST_CONCURRENT_CANCEL=PASS');
  console.log('PM12_P08_SUPABASE_FULL_STACK=PASS');
} finally {
  await db.end();
}
