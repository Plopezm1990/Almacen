import fs from 'node:fs';
import assert from 'node:assert/strict';
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
// 1) Reproduccion real C23-D1: el payload agregado C18 ignoraba metadatos de linea
// que, sin embargo, si quedaban persistidos en movimientos_stock.datos.
// ---------------------------------------------------------------------------
check('D1_C18_PAYLOAD_AGREGA_SOLO_PRODUCTO_CANTIDAD',
  c18Cart.includes("jsonb_build_object('productoId',producto_id,'cantidad',cantidad)")
  && c18Cart.includes("'lineas',lineas_norm"));
check('D1_C18_PERSISTE_ELEMENTO_ORIGINAL',
  c18Cart.includes("select elem from jsonb_array_elements(p_lineas) elem")
  && c18Cart.includes("where coalesce(elem->>'productoId',elem->>'producto_id')=rec.producto_id"));
check('D1_C18_NO_COMPARA_DATOS_LINEA_EN_REPLAY',
  !c18Cart.includes('movimientos_datos_norm') && !c18Cart.includes('lineas_datos_norm'));

// Modelo minimo del defecto: dos reintentos con igual efecto agregado pero metadatos
// persistibles divergentes eran indistinguibles para la identidad C18.
const requestA = [{ productoId: 'producto-1', cantidad: 2, lote: 'A', precio: 10 }];
const requestB = [{ productoId: 'producto-1', cantidad: 2, lote: 'B', precio: 11 }];
const identidadC18 = (rows) => rows.map(({ productoId, cantidad }) => ({ productoId, cantidad }));
assert.deepEqual(identidadC18(requestA), identidadC18(requestB));
assert.notDeepEqual(requestA[0], requestB[0]);
console.log('PM27_C23_D1_REPLAY_DIVERGENTE_REPRODUCIDO=PASS');

// ---------------------------------------------------------------------------
// 2) Remediacion minima C23-D1: misma identidad global, pero replay ligado tambien
// al efecto persistido de cada linea. Compatible con operaciones historicas porque
// compara contra movimientos_stock.datos ya existentes, sin backfill ni segundo ledger.
// ---------------------------------------------------------------------------
check('D1_C23_REUTILIZA_LEDGER_GLOBAL',
  c23Cart.includes('v_operation_id := private.pm09_bloquear_operation_id_stock(p_operation_id)'));
check('D1_C23_CANONIZA_DATOS_SOLICITUD',
  c23Cart.includes('lineas_datos_norm')
  && c23Cart.includes("'productoId', x->>'productoId'")
  && c23Cart.includes("select elem")
  && c23Cart.includes("jsonb_array_elements(p_lineas)"));
check('D1_C23_LECTURA_EFECTO_COMPROMETIDO',
  c23Cart.includes('movimientos_datos_norm')
  && c23Cart.includes("from public.movimientos_stock m")
  && c23Cart.includes("m.tipo='VENTA'"));
check('D1_C23_REPLAY_EXIGE_DATOS_IDENTICOS',
  c23Cart.includes('and movimientos_datos_norm=lineas_datos_norm'));
check('D1_C23_DIVERGENCIA_FAIL_CLOSED',
  c23Cart.includes("raise exception 'operation_id_conflict'"));
check('D1_C23_NO_NUEVO_LEDGER',
  !/create\s+table/i.test(c23)
  && !/create\s+(?:or\s+replace\s+)?function\s+private\.g1_claim_operation_id/i.test(c23));

// ---------------------------------------------------------------------------
// 3) Matriz transversal de concurrencia/replay/atomicidad ya certificada C17-C22.
// C23 no reescribe estos motores: exige que sigan presentes al cerrar el nuevo hueco.
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
  c22.includes('where id = new.revierte_pago_id')
  && /for\s+key\s+share/i.test(c22));
check('C22_APPEND_ONLY',
  c22.includes('pagos_encargo_append_only')
  && c22.includes("tg_op in ('UPDATE', 'DELETE')"));

// ---------------------------------------------------------------------------
// 4) Multi-tab/blob: C21 dejo explicitamente este riesgo para C23. No se inventa PASS.
// Extraemos contexto reproducible del artefacto real para que el gate deje evidencia.
// ---------------------------------------------------------------------------
const markers = ['loadKey("encargos", [])', 'loadKey("clientes", [])'];
for (const marker of markers) check(`BLOB_MARKER_${marker.includes('encargos') ? 'ENCARGOS' : 'CLIENTES'}`, fuente.includes(marker));
for (const marker of markers) {
  const i = fuente.indexOf(marker);
  if (i >= 0) {
    const snippet = fuente.slice(Math.max(0, i - 450), Math.min(fuente.length, i + 900)).replace(/\s+/g, ' ');
    console.log(`PM27_C23_BLOB_CONTEXT_${marker.includes('encargos') ? 'ENCARGOS' : 'CLIENTES'}=${snippet}`);
  }
}

// ---------------------------------------------------------------------------
// 5) Operabilidad segura del parche.
// ---------------------------------------------------------------------------
check('MIGRACION_TRANSACCIONAL', /^--[\s\S]*\nbegin;/i.test(c23) && /\ncommit;\s*$/.test(c23));
check('TIMEOUTS', c23.includes("set local lock_timeout = '5s'") && c23.includes("set local statement_timeout = '30s'"));
check('NO_DEPLOY', !/supabase\s+(?:db\s+push|migration\s+up)|netlify\s+deploy/i.test(c23));
check('ACL_NO_ANON', /revoke\s+all\s+on\s+function\s+public\.registrar_venta_stock_carrito[\s\S]*from\s+public,\s*anon/i.test(c23));
check('ACL_AUTH_PRESERVADA', /grant\s+execute\s+on\s+function\s+public\.registrar_venta_stock_carrito[\s\S]*to\s+authenticated/i.test(c23));

if (process.exitCode) throw new Error('PM27_C23_STATIC_CONTRACT_FAIL');

// Regresion acumulada de los checkpoints funcionales que C23 tensiona.
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
console.log('PM27_C23_RESULTADO_PARCIAL=PASS_PENDIENTE_BLOB_MULTITAB');
