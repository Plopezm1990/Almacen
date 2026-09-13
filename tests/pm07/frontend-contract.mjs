import fs from 'node:fs';
import assert from 'node:assert/strict';

const s = fs.readFileSync('source-recovery/fuente-recuperado.js', 'utf8');

// PM07 (corrección aplicada en PM26 P03b): varias assertions dependían de
// nombres de variable locales elegidos por el bundler (p2/p22, l2/l22) o
// del nombre exacto -- ya retirado -- de dos RPC de venta/reverso. Se
// generalizan con backreferences (\1) que aceptan cualquier nombre de
// parámetro, y se exige explícitamente la RPC vigente (con sufijo
// "_pm09") verificando que está definida en su migración versionada, en
// vez de aceptar indistintamente la forma antigua o la nueva.

function functionBlock(name) {
  const re = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`, 'g');
  const matches = [...s.matchAll(re)];
  if (matches.length !== 1) throw new Error(`PM07_${name}_COUNT=${matches.length}`);
  const start = matches[0].index;
  const open = s.indexOf('{', start);
  let depth = 0, quote = null, esc = false, line = false, block = false;
  for (let i = open; i < s.length; i++) {
    const c = s[i], n = s[i + 1] || '';
    if (line) { if (c === '\n') line = false; continue; }
    if (block) { if (c === '*' && n === '/') { block = false; i++; } continue; }
    if (quote) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && n === '/') { line = true; i++; continue; }
    if (c === '/' && n === '*') { block = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return s.slice(start, i + 1);
  }
  throw new Error(`PM07_${name}_SIN_CIERRE`);
}

/** Comprueba que `nombreRpc` se llama en el bloque, que NO se llama
 * ninguno de los `nombresAntiguos`, y que `nombreRpc` está definida (no
 * solo mencionada) en al menos una migración versionada bajo
 * supabase/migrations -- nunca por comparación contra el contenido de
 * fuente.js. Devuelve {ok, motivo} en vez de lanzar, para poder usarla
 * también sobre copias mutadas en memoria en las pruebas negativas. */
function verificarRpcVigente(bloque, nombreRpc, nombresAntiguos, migracionesTexto) {
  if (!bloque.includes(`"${nombreRpc}"`)) return { ok: false, motivo: `no_llama_a_${nombreRpc}` };
  for (const antiguo of nombresAntiguos) {
    // Coincidencia exacta del nombre entre comillas (evita que el propio
    // nombreRpc, que contiene al antiguo como prefijo, dispare un falso
    // positivo).
    const re = new RegExp(`"${antiguo}"`);
    if (re.test(bloque)) return { ok: false, motivo: `todavia_llama_a_rpc_antigua_${antiguo}` };
  }
  const definida = migracionesTexto.some((m) => new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${nombreRpc}\\s*\\(`).test(m));
  if (!definida) return { ok: false, motivo: `${nombreRpc}_no_definida_en_migracion_versionada` };
  return { ok: true, motivo: null };
}

/** Comprueba, sin presuponer el nombre del parámetro/identificador local,
 * que la condición "tipo !== elaborado && (X._pm07Servidor ? A : B)"
 * aparece con la paréntesis correcta al menos `minimo` veces, y que la
 * forma AMBIGUA sin paréntesis ("tipo !== elaborado && X._pm07Servidor
 * ?", que por precedencia de operadores de JS cambiaría de significado)
 * nunca aparece. */
function verificarPrecedenciaAlertas(texto, minimo) {
  const ambigua = /(\w+)\.tipo\s*!==\s*"elaborado"\s*&&\s*\1\._pm07Servidor\s*\?/;
  if (ambigua.test(texto)) return { ok: false, motivo: 'forma_ambigua_sin_parentesis_presente' };
  const correcta = /(\w+)\.tipo\s*!==\s*"elaborado"\s*&&\s*\(\s*\1\._pm07Servidor\s*\?/g;
  const cuenta = [...texto.matchAll(correcta)].length;
  if (cuenta < minimo) return { ok: false, motivo: `solo_${cuenta}_ocurrencias_correctas_de_${minimo}_esperadas` };
  return { ok: true, motivo: null };
}

/** Comprueba que el stock "vendible" mostrado en TPV usa el stock
 * autoritativo de servidor cuando el producto es _pm07Servidor, sin
 * presuponer el nombre del identificador local (usa \1 para exigir que
 * TODAS las referencias dentro de la expresión sean al mismo objeto). */
function verificarStockAutoritativoTpv(texto, patronPrefijo) {
  const re = new RegExp(`(\\w+)${patronPrefijo}\\._pm07Servidor\\s*\\?\\s*Number\\(\\1${patronPrefijo}\\.stock\\)\\s*\\|\\|\\s*0\\s*:\\s*Number\\(\\1${patronPrefijo}\\.stockPisoVenta\\)\\s*\\|\\|\\s*0`);
  return re.test(texto);
}

/** Comprueba, sin presuponer el nombre del parámetro del callback de
 * productos.map(...), que el diagnóstico de reconciliación usa el stock
 * de servidor (teoricoCache) como teórico autoritativo cuando el
 * producto es _pm07Servidor, y el histórico de movimientos en caso
 * contrario. */
function verificarTeoricoAutoritativo(bloque) {
  const cb = bloque.match(/productos\.map\s*\(\s*\(?(\w+)\)?\s*=>/);
  if (!cb) return { ok: false, motivo: 'no_se_encontro_callback_diagnostico' };
  const p = cb[1];
  const re = new RegExp(`teoricoReal\\s*=\\s*${p}\\._pm07Servidor\\s*\\?\\s*teoricoCache\\s*:\\s*teoricoHistorico`);
  if (!re.test(bloque)) return { ok: false, motivo: 'servidor_no_determina_teorico_autoritativo' };
  return { ok: true, motivo: null };
}

/** Comprueba, sin presuponer el nombre del parámetro, que
 * corregirProducto no muta stock localmente cuando el producto es
 * _pm07Servidor: debe devolver {sinCambios:true, autoritativoServidor:
 * true} ANTES de llegar a cualquier mutación real (aplicarMovimientoStock). */
function verificarRetornoSinMutacionLocal(bloque) {
  const cap = bloque.match(/const\s+(\w+)\s*=\s*productos\.find\(/);
  if (!cap) return { ok: false, motivo: 'no_se_encontro_parametro_producto' };
  const p = cap[1];
  const re = new RegExp(`if\\s*\\(\\s*${p}\\._pm07Servidor\\s*\\)\\s*return\\s*\\{\\s*ok:\\s*true,\\s*sinCambios:\\s*true,\\s*autoritativoServidor:\\s*true\\s*\\}`);
  const guardia = bloque.match(re);
  if (!guardia) return { ok: false, motivo: 'no_retorna_sin_mutacion_cuando_es_autoritativo' };
  const idxMutacion = bloque.search(/aplicarMovimientoStock\s*\(/);
  if (idxMutacion !== -1 && !(guardia.index < idxMutacion)) {
    return { ok: false, motivo: 'la_guardia_no_precede_a_la_mutacion' };
  }
  return { ok: true, motivo: null };
}

const venta = functionBlock('venderCarrito');
const anular = functionBlock('anularVenta');
const interno = functionBlock('traspasarStock');
const interlocal = functionBlock('traspasarEntreLocales');
const contexto = functionBlock('sincronizarContextoPm07');
const diagnostico = functionBlock('diagnosticarStock');
const correccion = functionBlock('corregirProducto');

const migPm07 = fs.readFileSync('supabase/migrations/20260904135838_pm07_stock_ubicacion_y_reversos.sql', 'utf8');
const migPm09Fecha = fs.readFileSync('supabase/migrations/20260905115000_pm09_fecha_operacion_economica.sql', 'utf8');
const migPm09Hardening = fs.readFileSync('supabase/migrations/20260905120500_pm09_operation_id_global_hardening.sql', 'utf8');
const migracionesTexto = [migPm07, migPm09Fecha, migPm09Hardening];

const rVenta = verificarRpcVigente(venta, 'registrar_venta_stock_carrito_pm09', ['registrar_venta_stock_carrito', 'descontar_stock_carrito'], migracionesTexto);
const rReverso = verificarRpcVigente(anular, 'revertir_venta_stock_carrito_pm09', ['revertir_venta_stock_carrito', 'anular_venta_tpv'], migracionesTexto);
const rPrecedencia = verificarPrecedenciaAlertas(s, 2);
const rTeorico = verificarTeoricoAutoritativo(diagnostico);
const rSinMutacion = verificarRetornoSinMutacionLocal(correccion);

const checks = {
  sync_helper_unico: (s.match(/async function sincronizarStockPm07\(/g) || []).length === 1,
  contexto_cloud_helper_unico: (s.match(/async function sincronizarContextoPm07\(/g) || []).length === 1,
  contexto_cloud_lee_claves: contexto.includes('.from("almacen_kv")') && contexto.includes('"empresas", "locales", "localActivoId", "productos"'),
  contexto_cloud_hidrata_locales: contexto.includes('setLocales(localesNube.filter'),
  contexto_cloud_hidrata_local_activo: contexto.includes('setLocalActivoId(localActivoNube)'),
  contexto_cloud_se_ejecuta_tras_ready: s.includes('await sincronizarContextoPm07({ setEmpresas, setLocales, setLocalActivoId, setProductos });'),
  venta_rpc_vigente: rVenta.ok,
  venta_solo_un_fallback_offline: (venta.match(/return venderLocal\(lineas, medioPago, detallePago\);/g) || []).length === 1,
  venta_fallo_cloud_no_muta_local: venta.includes('No se ha descontado stock localmente.'),
  reverso_rpc_vigente: rReverso.ok,
  traslado_interno_rpc_pm07: interno.includes('supabase.rpc("trasladar_stock_interno"'),
  traslado_interlocal_rpc_pm07: interlocal.includes('supabase.rpc("trasladar_stock_entre_locales"'),
  traslado_interlocal_sin_mutacion_local_en_error_cloud: interlocal.includes('No se modific') && interlocal.includes('ning') && interlocal.includes('local'),
  venta_offline_sin_deficit: s.includes('documentoOrigenId: documentoOrigenId || ventaId,\n        afectaStockTotal: true,\n        afectaStockPisoVenta: true,\n        permitirDeficit: false,'),
  alertas_precedencia_correcta: rPrecedencia.ok,
  tpv_precheck_autoritativo: verificarStockAutoritativoTpv(s, '\\.producto'),
  tpv_vendibles_autoritativo: verificarStockAutoritativoTpv(s, ''),
  reconciliacion_cloud_autoritativa: rTeorico.ok,
  reconciliacion_cloud_no_muta_local: rSinMutacion.ok,
};

for (const [k, ok] of Object.entries(checks)) {
  console.log(`PM07_${k.toUpperCase()}=${ok ? 1 : 0}`);
  if (!ok) process.exitCode = 1;
}
if (process.exitCode) {
  console.error('motivos:', JSON.stringify({ rVenta, rReverso, rPrecedencia, rTeorico, rSinMutacion }, null, 2));
  throw new Error('PM07_FRONTEND_CONTRACT_FAIL');
}
console.log('PM07_FRONTEND_CONTRACT_OK=1');

// --- Pruebas negativas deliberadas sobre copias EN MEMORIA (nunca sobre
// la aplicación real): cada una elimina UNA garantía y comprueba que el
// verificador correspondiente la detecta. ---
{
  const sinRpcVigente = venta.replace(/registrar_venta_stock_carrito_pm09/g, 'registrar_venta_stock_carrito');
  assert.notEqual(sinRpcVigente, venta, 'mutación sintética sin efecto -- prueba negativa inválida');
  const r = verificarRpcVigente(sinRpcVigente, 'registrar_venta_stock_carrito_pm09', ['registrar_venta_stock_carrito', 'descontar_stock_carrito'], migracionesTexto);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'no_llama_a_registrar_venta_stock_carrito_pm09');
  console.log('PM07_NEGATIVA_RPC_VENTA_ANTIGUA=PASS');
}
{
  // Simula una migración que NUNCA definió la RPC vigente.
  const r = verificarRpcVigente(venta, 'registrar_venta_stock_carrito_pm09', ['registrar_venta_stock_carrito', 'descontar_stock_carrito'], []);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'registrar_venta_stock_carrito_pm09_no_definida_en_migracion_versionada');
  console.log('PM07_NEGATIVA_RPC_SIN_MIGRACION=PASS');
}
{
  const conAmbiguedad = s.replace(
    /tipo !== "elaborado" && \(p22\._pm07Servidor \?/,
    'tipo !== "elaborado" && p22._pm07Servidor ?'
  );
  assert.notEqual(conAmbiguedad, s, 'mutación sintética sin efecto -- prueba negativa inválida');
  const r = verificarPrecedenciaAlertas(conAmbiguedad, 2);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'forma_ambigua_sin_parentesis_presente');
  console.log('PM07_NEGATIVA_PRECEDENCIA_AMBIGUA=PASS');
}
{
  const sinGuardiaServidor = correccion.replace(/if\s*\([^)]*_pm07Servidor\)\s*return\s*\{\s*ok:\s*true,\s*sinCambios:\s*true,\s*autoritativoServidor:\s*true\s*\};?/, '');
  assert.notEqual(sinGuardiaServidor, correccion, 'mutación sintética sin efecto -- prueba negativa inválida');
  const r = verificarRetornoSinMutacionLocal(sinGuardiaServidor);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'no_retorna_sin_mutacion_cuando_es_autoritativo');
  console.log('PM07_NEGATIVA_SIN_GUARDIA_SERVIDOR=PASS');
}
{
  const sinTeoricoAutoritativo = diagnostico.replace(/teoricoReal\s*=\s*(\w+)\._pm07Servidor\s*\?\s*teoricoCache\s*:\s*teoricoHistorico/, 'teoricoReal = teoricoHistorico');
  assert.notEqual(sinTeoricoAutoritativo, diagnostico, 'mutación sintética sin efecto -- prueba negativa inválida');
  const r = verificarTeoricoAutoritativo(sinTeoricoAutoritativo);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'servidor_no_determina_teorico_autoritativo');
  console.log('PM07_NEGATIVA_SIN_TEORICO_AUTORITATIVO=PASS');
}

console.log('PM07_NEGATIVAS_5_5=1');
