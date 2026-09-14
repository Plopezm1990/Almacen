import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const read = (p) => fs.readFileSync(p, 'utf8');
const c18 = read('supabase/migrations/20260914064500_pm27_c18_stock_sale_operation_id_hardening.sql');
const c19 = read('supabase/migrations/20260914071000_pm27_c19_transfer_operation_id_hardening.sql');
const c20 = read('supabase/migrations/20260914080000_pm27_c20_inventory_count_replay_hardening.sql');
const c21 = read('supabase/migrations/20260914090000_pm27_c21_encargos_authorization_hardening.sql');
const c22 = read('supabase/migrations/20260914103000_pm27_c22_pagos_reembolsos_operation_id_hardening.sql');
const c23 = read('supabase/migrations/20260914121000_pm27_c23_concurrency_replay_atomicity.sql');
const pm08 = read('supabase/migrations/20260904204500_pm08_caja_devolucion_indivisible.sql');
const pm09 = read('supabase/migrations/20260905120500_pm09_operation_id_global_hardening.sql');
const globalLedger = read('supabase/migrations/20260905185935_g1_p08_operation_id_finanzas_global.sql');
const fuente = read('fuente.js');
const index = read('index.html');
const storagePatch = read('pm27-c23-storage-concurrency-v1.js');
const loader = read('pm11-compra-mobile-loader.js');

function check(name, ok) {
  console.log(`PM27_C23_${name}=${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) process.exitCode = 1;
}

function extractFunction(sql, schema, name) {
  const rx = new RegExp(`create\\s+or\\s+replace\\s+function\\s+${schema}\\.${name}\\s*\\(`, 'i');
  const start = sql.search(rx);
  if (start < 0) throw new Error(`C23_FUNCION_AUSENTE=${schema}.${name}`);
  const tagMatch = sql.slice(start).match(/as\s+(\$[A-Za-z0-9_]*\$)/i);
  if (!tagMatch) throw new Error(`C23_DOLLAR_TAG_AUSENTE=${schema}.${name}`);
  const tag = tagMatch[1];
  const bodyStart = start + tagMatch.index + tagMatch[0].length;
  const end = sql.indexOf(tag, bodyStart);
  if (end < 0) throw new Error(`C23_FUNCION_INCOMPLETA=${schema}.${name}`);
  return sql.slice(start, end + tag.length + 1);
}

const c18Cart = extractFunction(c18, 'public', 'registrar_venta_stock_carrito');
const c23Cart = extractFunction(c23, 'public', 'registrar_venta_stock_carrito');

// ---------------------------------------------------------------------------
// C23-D1 — replay de venta carrito aceptaba metadatos de linea divergentes.
// ---------------------------------------------------------------------------
check('D1_C18_PAYLOAD_AGREGA_SOLO_PRODUCTO_CANTIDAD',
  c18Cart.includes("jsonb_build_object('productoId',producto_id,'cantidad',cantidad)")
  && c18Cart.includes("'lineas',lineas_norm"));
check('D1_C18_PERSISTE_ELEMENTO_ORIGINAL',
  c18Cart.includes('select elem from jsonb_array_elements(p_lineas) elem')
  && c18Cart.includes("where coalesce(elem->>'productoId',elem->>'producto_id')=rec.producto_id"));
check('D1_C18_NO_COMPARA_DATOS_LINEA_EN_REPLAY',
  !c18Cart.includes('movimientos_datos_norm') && !c18Cart.includes('lineas_datos_norm'));

const requestA = [{ productoId: 'producto-1', cantidad: 2, lote: 'A', precio: 10 }];
const requestB = [{ productoId: 'producto-1', cantidad: 2, lote: 'B', precio: 11 }];
const identidadC18 = (rows) => rows.map(({ productoId, cantidad }) => ({ productoId, cantidad }));
assert.deepEqual(identidadC18(requestA), identidadC18(requestB));
assert.notDeepEqual(requestA[0], requestB[0]);
console.log('PM27_C23_D1_REPLAY_DIVERGENTE_REPRODUCIDO=PASS');

check('D1_C23_REUTILIZA_LEDGER_GLOBAL',
  c23Cart.includes('v_operation_id := private.pm09_bloquear_operation_id_stock(p_operation_id)'));
check('D1_C23_CANONIZA_DATOS_SOLICITUD',
  c23Cart.includes('lineas_datos_norm') && c23Cart.includes("'productoId', x->>'productoId'"));
check('D1_C23_LECTURA_EFECTO_COMPROMETIDO',
  c23Cart.includes('movimientos_datos_norm') && c23Cart.includes('from public.movimientos_stock m'));
check('D1_C23_REPLAY_EXIGE_DATOS_IDENTICOS',
  c23Cart.includes('and movimientos_datos_norm=lineas_datos_norm'));
check('D1_C23_DIVERGENCIA_FAIL_CLOSED',
  c23Cart.includes("raise exception 'operation_id_conflict'"));
check('D1_C23_NO_NUEVO_LEDGER',
  !/create\s+table/i.test(c23)
  && !/create\s+(?:or\s+replace\s+)?function\s+private\.g1_claim_operation_id/i.test(c23));

// ---------------------------------------------------------------------------
// C23-D2 — lost-update multi-tab en clientes/encargos.
// El storage historico toma `anterior` de localStorage compartido entre pestanas.
// Cuando A guarda un alta y B, con estado React obsoleto, guarda otra, B puede
// interpretar el alta de A como un borrado propio. Clientes tenia ademas un delete
// de todo remoto ausente de la lista local.
// ---------------------------------------------------------------------------
check('D2_HISTORICO_ANTERIOR_DESDE_LOCALSTORAGE_COMPARTIDO',
  index.includes('anterior = LOCAL.get(cacheKey)'));
check('D2_CLIENTES_SYNC_HISTORICO_DESTRUCTIVO',
  index.includes('var borrar = remotos.filter(function (r) { return !vivos[r.id]; }).map(function (r) { return r.id; });'));
check('D2_ENCARGOS_SIGUE_BLOB_HISTORICO',
  /var\s+TABLAS_EMPRESA\s*=\s*\{[\s\S]*clientes:\s*"clientes_empresa"[\s\S]*\}/.test(index)
  && !/TABLAS_EMPRESA[\s\S]{0,220}encargos:\s*"encargos_empresa"/.test(index));
check('D2_FRONTEND_CARGA_AMBAS_COLECCIONES',
  fuente.includes('loadKey("clientes", [])') && fuente.includes('loadKey("encargos", [])'));

function historicoFusionarListas(enNube, antes, ahora) {
  const mapaAntes = Object.fromEntries(antes.filter(x => x?.id).map(x => [x.id, x]));
  const mapaNube = Object.fromEntries(enNube.filter(x => x?.id).map(x => [x.id, x]));
  const resultado = [];
  const colocados = {};
  ahora.forEach((x) => {
    if (!x?.id) return resultado.push(x);
    colocados[x.id] = true;
    const previo = mapaAntes[x.id];
    const remoto = mapaNube[x.id];
    if (!previo || JSON.stringify(previo) !== JSON.stringify(x)) resultado.push(x);
    else if (Object.prototype.hasOwnProperty.call(mapaNube, x.id)) resultado.push(remoto);
  });
  enNube.forEach((x) => {
    if (!x?.id || colocados[x.id]) return;
    if (Object.prototype.hasOwnProperty.call(mapaAntes, x.id)) return;
    resultado.push(x);
  });
  return resultado;
}

const base0 = [{ id: 'base', nombre: 'Base' }];
const tabA = [...base0, { id: 'alta-A', nombre: 'A' }];
const nubeTrasA = tabA;
const localStorageCompartidoTrasA = tabA;
const tabBObsoleto = [...base0, { id: 'alta-B', nombre: 'B' }];
const historicoTrasB = historicoFusionarListas(nubeTrasA, localStorageCompartidoTrasA, tabBObsoleto);
assert.equal(historicoTrasB.some(x => x.id === 'alta-A'), false);
assert.equal(historicoTrasB.some(x => x.id === 'alta-B'), true);
console.log('PM27_C23_D2_ENCARGOS_LOST_UPDATE_REPRODUCIDO=PASS');

const clientesRemotosTrasA = [...base0, { id: 'cliente-A', empresaId: 'empresa-1' }];
const clientesB = [...base0, { id: 'cliente-B', empresaId: 'empresa-1' }];
const vivosB = new Set(clientesB.map(x => x.id));
const borradosHistoricos = clientesRemotosTrasA.filter(x => !vivosB.has(x.id)).map(x => x.id);
assert.deepEqual(borradosHistoricos, ['cliente-A']);
console.log('PM27_C23_D2_CLIENTES_DELETE_REMOTO_REPRODUCIDO=PASS');

// Ejecuta el helper puro del parche C23 en VM, sin red ni navegador real.
function storageLike() {
  const m = new Map();
  return {
    getItem: (k) => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); }
  };
}
const context = {
  window: {
    setInterval: () => 1,
    clearInterval: () => {},
    dispatchEvent: () => {}
  },
  localStorage: storageLike(),
  sessionStorage: storageLike(),
  CustomEvent: function CustomEvent(name, init) { this.type = name; this.detail = init?.detail; },
  console,
  JSON,
  Object,
  Array,
  Error,
  Promise,
  Date,
  Set,
  Map
};
context.window.window = context.window;
vm.runInNewContext(storagePatch, context, { filename: 'pm27-c23-storage-concurrency-v1.js' });
const helper = context.window.__pm27C23StorageConcurrencyTest;
assert.ok(helper, 'helper C23 no exportado para contrato');
const nuevoMerge = helper.fusionarListaConBase(nubeTrasA, base0, tabBObsoleto);
assert.equal(nuevoMerge.conflictos.length, 0);
assert.equal(nuevoMerge.resultado.some(x => x.id === 'alta-A'), true);
assert.equal(nuevoMerge.resultado.some(x => x.id === 'alta-B'), true);
console.log('PM27_C23_D2_ENCARGOS_ALTAS_CONCURRENTES_PRESERVADAS=PASS');

const conflicto = helper.fusionarListaConBase(
  [{ id: 'x', nombre: 'remoto' }],
  [{ id: 'x', nombre: 'base' }],
  [{ id: 'x', nombre: 'mio' }]
);
assert.equal(conflicto.conflictos.length, 1);
console.log('PM27_C23_D2_MISMO_REGISTRO_CONFLICTO_FAIL_CLOSED=PASS');

check('D2_PATCH_BASE_POR_PESTANA', storagePatch.includes('sessionStorage.setItem(await baseKey(key)'));
check('D2_PATCH_TARGET_CLIENTES_ENCARGOS', storagePatch.includes('var TARGETS = { clientes: true, encargos: true }'));
check('D2_PATCH_CLIENTES_DELTA_NO_DELETE_GLOBAL',
  storagePatch.includes('base.forEach(function (previo)')
  && storagePatch.includes('borrar.push(previo.id)')
  && !storagePatch.includes('remotos.filter(function (r) { return !vivos[r.id]; })'));
check('D2_PATCH_ENCARGOS_FUSION_BASE_REMOTA',
  storagePatch.includes('fusionarListaConBase(remoto, base, ahora)'));
check('D2_PATCH_CONFLICTOS_BLOQUEADOS',
  storagePatch.includes('c23_conflicto_concurrente:encargos')
  && storagePatch.includes('c23_conflicto_concurrente:clientes'));
check('D2_PATCH_PENDING_NO_PASA_AL_LEGACY',
  storagePatch.includes('var sinTargets = pendientes().filter(function (k) { return !TARGETS[k]; })'));
check('D2_LOADER_UNIVERSAL',
  loader.includes('pm27-c23-storage-concurrency-v1.js?v=pm27-c23-storage-concurrency-v1')
  && loader.includes('data-pm27-c23-storage-concurrency'));

// ---------------------------------------------------------------------------
// Matriz transversal C17-C22: locks, replay, reversos y atomicidad siguen vigentes.
// ---------------------------------------------------------------------------
check('GLOBAL_ADVISORY_XACT_LOCK',
  pm08.includes("pg_advisory_xact_lock(hashtextextended('la-suite-pm08:' || p_operation_id, 0))"));
check('GLOBAL_LEDGER_UNICO',
  globalLedger.includes('private.g1_operation_ids_global')
  && globalLedger.includes('create or replace function private.g1_claim_operation_id()')
  && globalLedger.includes("raise exception 'operation_id_conflict'"));
check('STOCK_CROSS_LEDGER_GUARD',
  pm09.includes('private.pm09_bloquear_operation_id_stock')
  && pm09.includes('perform private.pm08_bloquear_operation_id(v_operation_id)'));
check('C19_LOCK_ORDEN_DETERMINISTA',
  c19.includes('(p_origen_local_id,p_producto_origen_id) <= (p_destino_local_id,p_producto_destino_id)')
  && c19.includes('for update'));
check('C19_REPLAY_PAYLOAD_EXACTO',
  c19.includes("op.tipo='TRASLADO_ENTRE_LOCALES' and op.payload=payload_norm")
  && c19.includes("raise exception 'operation_id_conflict'"));
check('C20_LOCK_DOCUMENTO_Y_OPERATION_ID',
  c20.includes("private.pm08_bloquear_operation_id('pm12-conteo:'")
  && c20.includes('private.pm09_bloquear_operation_id_stock(p_operation_id)'));
check('C20_REPLAY_INTENCION_PLAN_BASES',
  c20.includes("op.payload->'intencion' is distinct from intent")
  && c20.includes("op.payload->'plan' is distinct from p_plan")
  && c20.includes("op.payload->'bases' is distinct from p_bases"));
check('C21_DOCUMENTO_SERIALIZADO',
  /from\s+public\.encargos_empresa[\s\S]*where\s+id\s*=\s*p_id[\s\S]*for\s+update/i.test(c21));
check('C21_SALDO_Y_TERMINALES',
  c21.includes("raise exception 'total_inferior_a_pagado'")
  && c21.includes("raise exception 'encargo_terminal_inmutable'"));
check('C22_UN_SOLO_REVERSO',
  /create\s+unique\s+index\s+pm27_c22_pagos_encargo_un_reverso_por_pago/i.test(c22));
check('C22_REVERSO_LIGADO_ORIGINAL',
  c22.includes('where id = new.revierte_pago_id') && /for\s+key\s+share/i.test(c22));
check('C22_APPEND_ONLY',
  c22.includes('pagos_encargo_append_only') && c22.includes("tg_op in ('UPDATE', 'DELETE')"));

// ---------------------------------------------------------------------------
// Operabilidad segura: preparación de código solamente.
// ---------------------------------------------------------------------------
check('MIGRACION_TRANSACCIONAL', /^--[\s\S]*\nbegin;/i.test(c23) && /\ncommit;\s*$/.test(c23));
check('TIMEOUTS', c23.includes("set local lock_timeout = '5s'") && c23.includes("set local statement_timeout = '30s'"));
check('NO_DEPLOY_SQL', !/supabase\s+(?:db\s+push|migration\s+up)|netlify\s+deploy/i.test(c23));
check('NO_DEPLOY_FRONTEND_PATCH', !/supabase\s+(?:db\s+push|migration\s+up)|netlify\s+deploy/i.test(storagePatch));
check('ACL_NO_ANON', /revoke\s+all\s+on\s+function\s+public\.registrar_venta_stock_carrito[\s\S]*from\s+public,\s*anon/i.test(c23));
check('ACL_AUTH_PRESERVADA', /grant\s+execute\s+on\s+function\s+public\.registrar_venta_stock_carrito[\s\S]*to\s+authenticated/i.test(c23));

if (process.exitCode) throw new Error('PM27_C23_STATIC_CONTRACT_FAIL');

const regressions = [
  'tests/pm27/c17-caja-conciliacion.mjs',
  'tests/pm27/c18-stock-ventas.mjs',
  'tests/pm27/c19-traspasos.mjs',
  'tests/pm27/c20-inventarios-conteos.mjs',
  'tests/pm27/c21-encargos-anticipos-clientes.mjs',
  'tests/pm27/c22-pagos-reembolsos-operation-id.mjs',
  'tests/pm12/p08-fallos-replay-concurrencia-contract.mjs',
];
for (const test of regressions) {
  console.log(`PM27_C23_RUN=${test}`);
  execFileSync(process.execPath, [test], { stdio: 'inherit' });
}

console.log('PM27_C23_DOBLE_CLIC_REPLAY=PASS');
console.log('PM27_C23_CARRERAS_LOCKS=PASS');
console.log('PM27_C23_ATOMICIDAD_TRANSVERSAL=PASS');
console.log('PM27_C23_D1_REMEDIADO=PASS');
console.log('PM27_C23_D2_MULTITAB_REMEDIADO=PASS');
console.log('PM27_C23_RESULTADO=PASS');
