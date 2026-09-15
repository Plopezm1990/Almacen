import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const index = fs.readFileSync('index.html', 'utf8');
const prelock = fs.readFileSync('owner-bootstrap-prelock.js', 'utf8');
const flow = fs.readFileSync('owner-bootstrap-post-reset.js', 'utf8');
const bridge = fs.readFileSync('ui-context-bridge.js', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260915043000_ui_context_bridge.sql', 'utf8');

const posEdge = index.indexOf('./edge-auth-patch.js');
const posBridge = index.indexOf('./ui-context-bridge.js');
const posFlow = index.indexOf('./owner-bootstrap-post-reset.js');
const posFuente = index.indexOf('./fuente.js');
assert.ok(posEdge >= 0 && posEdge < posBridge && posBridge < posFlow && posFlow < posFuente,
  'orden de scripts inválido: edge -> bridge -> owner flow -> fuente');

assert.match(prelock, /obtener_contexto_instalacion_ui:\s*true/);
assert.match(prelock, /almacen:empresas/);
assert.match(prelock, /almacen:locales/);
assert.match(prelock, /almacen:localActivoId/);
assert.match(prelock, /almacen:pinPropietario/);
assert.match(prelock, /permite_todos_locales/);

const posContextRpc = flow.indexOf('obtener_contexto_instalacion_ui');
const posSetReady = flow.indexOf('__laOwnerBootstrapSetReady', posContextRpc);
assert.ok(posContextRpc >= 0 && posSetReady > posContextRpc,
  'el contexto UI debe sembrarse antes de liberar la barrera');

assert.match(bridge, /key === "pinPropietario"/);
assert.match(bridge, /guardar_contexto_instalacion_ui/);
assert.match(bridge, /CLAVES_CONTEXTO/);
assert.doesNotMatch(
  migration,
  /\b(?:from|into|update|join|delete\s+from)\s+(?:public\.)?almacen_kv\b/i,
  'P5 no debe usar almacen_kv como autoridad para empresas/locales'
);
assert.match(migration, /security definer/gi);
assert.match(migration, /set search_path = pg_catalog, public, private/gi);
assert.match(migration, /revoke all on function public\.obtener_contexto_instalacion_ui\(\) from public, anon/i);
assert.match(migration, /revoke all on function public\.guardar_contexto_instalacion_ui\(text, jsonb\) from public, anon/i);
assert.match(migration, /p_valor is null or jsonb_typeof\(p_valor\) = 'null'/i);

// Simulación del wrapper: las cuatro claves compatibilidad no deben tocar el
// almacenamiento cloud legacy; PIN ausente es un estado normal, no excepción.
const local = new Map([
  ['la_suite_installation_generation_v1', 'gen-test'],
  ['almacen:empresas', JSON.stringify([{ id: 'e1', razonSocial: 'Empresa 1', activo: true }])],
  ['almacen:locales', JSON.stringify([{ id: 'l1', empresaId: 'e1', nombre: 'Local 1', activo: true }])],
  ['almacen:localActivoId', 'null']
]);
let delegadosGet = 0;
let delegadosSet = 0;
let rpcCalls = [];

const originalStorage = {
  async get(key) { delegadosGet++; return { key, value: JSON.stringify('legacy'), shared: false }; },
  async set(key, value) { delegadosSet++; return { key, value, shared: false }; },
  async delete(key) { return { key, shared: false }; }
};

const rpcResult = {
  state: 'ready',
  generation: 'gen-test',
  empresa_id: 'e1',
  local_id: 'l1',
  permite_todos_locales: true,
  empresas: [{ id: 'e1', razonSocial: 'Empresa 1', marca: 'Empresa 1', activo: true }],
  locales: [{ id: 'l1', empresaId: 'e1', nombre: 'Local 1', activo: true }]
};

const context = {
  console,
  setTimeout,
  Promise,
  JSON,
  Error,
  window: {
    storage: originalStorage,
    __instalacionSyncPermitida: true,
    localStorage: null,
    async getSupabaseClient() {
      return {
        auth: { async getSession() { return { data: { session: { user: { id: 'u1' } } } }; } },
        async rpc(name, args) { rpcCalls.push({ name, args }); return { data: rpcResult, error: null }; }
      };
    },
    __laOwnerBootstrapSeedUiContext(data) {
      local.set('almacen:empresas', JSON.stringify(data.empresas));
      local.set('almacen:locales', JSON.stringify(data.locales));
    }
  },
  localStorage: {
    getItem(k) { return local.has(k) ? local.get(k) : null; },
    setItem(k, v) { local.set(k, String(v)); },
    removeItem(k) { local.delete(k); }
  }
};
context.window.localStorage = context.localStorage;
vm.createContext(context);
vm.runInContext(bridge, context, { filename: 'ui-context-bridge.js' });

const pin = await context.window.storage.get('pinPropietario', false);
assert.equal(pin.value, '', 'PIN ausente debe resolverse como vacío sin lanzar');
assert.equal(delegadosGet, 0, 'PIN no debe consultar storage cloud legacy');

await context.window.storage.set('pinPropietario', JSON.stringify('1234'), false);
assert.equal(local.get('almacen:pinPropietario'), JSON.stringify('1234'));
assert.equal(delegadosSet, 0, 'PIN no debe intentar sincronizarse en almacen_kv');

const empresas = await context.window.storage.get('empresas', false);
assert.equal(JSON.parse(empresas.value)[0].id, 'e1');
assert.equal(delegadosGet, 0, 'empresas no debe consultar bloque cloud legacy');

await context.window.storage.set('empresas', JSON.stringify(rpcResult.empresas), false);
assert.equal(rpcCalls.at(-1).name, 'guardar_contexto_instalacion_ui');
assert.equal(rpcCalls.at(-1).args.p_clave, 'empresas');

await context.window.storage.set('localActivoId', 'null', false);
assert.equal(rpcCalls.at(-1).args.p_clave, 'localActivoId');
assert.equal(rpcCalls.at(-1).args.p_valor, null);
assert.equal(local.get('almacen:localActivoId'), 'null');

await context.window.storage.get('productos', false);
assert.equal(delegadosGet, 1, 'las demás claves deben conservar el wrapper anterior');

console.log('UI_CONTEXT_BRIDGE_PASS');
