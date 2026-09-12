import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('source-recovery/fuente-recuperado.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const migPm08 = fs.readFileSync('supabase/migrations/20260904204500_pm08_caja_devolucion_indivisible.sql', 'utf8');
const migPm09Fecha = fs.readFileSync('supabase/migrations/20260905115000_pm09_fecha_operacion_economica.sql', 'utf8');
const migracionesTexto = [migPm08, migPm09Fecha];

// PM08 (corrección aplicada en PM26 P03b): tres assertions dependían de
// nombres de variable locales del bundler (a2/a22), del nombre exacto
// -- ya retirado -- de una RPC de devolución, o de una frase visible con
// un carácter acentuado cuya representación en el texto fuente cambió
// (literal "ó" vs escape "\xF3"). Se generalizan con backreferences, se
// exige la RPC vigente verificando su migración versionada, y el
// conflicto de idempotencia se comprueba por su rama/resultado funcional
// (comparación de payload + forma del objeto devuelto), no por la frase
// del mensaje de error.

function functionBlock(name) {
  const re = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`, 'g');
  const matches = [...source.matchAll(re)];
  if (matches.length !== 1) throw new Error(`PM08_${name}_COUNT=${matches.length}`);
  const start = matches[0].index;
  const parenOpen = source.indexOf('(', start);
  let parenDepth = 0, parameterQuote = null, parameterEscaped = false;
  let open = -1;
  for (let i = parenOpen; i < source.length; i++) {
    const char = source[i];
    if (parameterQuote) {
      if (parameterEscaped) parameterEscaped = false;
      else if (char === '\\') parameterEscaped = true;
      else if (char === parameterQuote) parameterQuote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { parameterQuote = char; continue; }
    if (char === '(') parenDepth++;
    if (char === ')' && --parenDepth === 0) {
      open = source.indexOf('{', i + 1);
      break;
    }
  }
  if (open < 0) throw new Error(`PM08_${name}_SIN_APERTURA`);
  let depth = 0, quote = null, escaped = false, lineComment = false, blockComment = false;
  for (let i = open; i < source.length; i++) {
    const char = source[i], next = source[i + 1] || '';
    if (lineComment) { if (char === '\n') lineComment = false; continue; }
    if (blockComment) { if (char === '*' && next === '/') { blockComment = false; i++; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '/') { lineComment = true; i++; continue; }
    if (char === '/' && next === '*') { blockComment = true; i++; continue; }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') depth++;
    if (char === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`PM08_${name}_SIN_CIERRE`);
}

/** Comprueba, sin presuponer el nombre del parámetro del callback de
 * .some(...), que el alta de movimiento de caja se bloquea cuando existe
 * un arqueo activo (no anulado) para el mismo local y fecha. */
function verificarBloqueoArqueoActivo(bloque) {
  const re = /\(arqueos \|\| \[\]\)\.some\s*\(\s*\(?(\w+)\)?\s*=>\s*\1\.localId\s*===\s*localActivoId\s*&&\s*\1\.fecha\s*===\s*fecha\s*&&\s*\1\.estado\s*!==\s*"ANULADO"/;
  if (!re.test(bloque)) return { ok: false, motivo: 'no_bloquea_por_arqueo_activo' };
  return { ok: true, motivo: null };
}

/** Igual que en PM07: exige la RPC vigente, rechaza explícitamente
 * cualquier nombre antiguo, y exige que la RPC vigente esté definida (no
 * solo mencionada) en una migración versionada. */
function verificarRpcVigente(bloque, nombreRpc, nombresAntiguos, migraciones) {
  if (!bloque.includes(`"${nombreRpc}"`)) return { ok: false, motivo: `no_llama_a_${nombreRpc}` };
  for (const antiguo of nombresAntiguos) {
    if (new RegExp(`"${antiguo}"`).test(bloque)) return { ok: false, motivo: `todavia_llama_a_rpc_antigua_${antiguo}` };
  }
  const definida = migraciones.some((m) => new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${nombreRpc}\\s*\\(`).test(m));
  if (!definida) return { ok: false, motivo: `${nombreRpc}_no_definida_en_migracion_versionada` };
  return { ok: true, motivo: null };
}

/** Comprueba el conflicto de idempotencia por su RAMA/RESULTADO
 * FUNCIONAL -- no por el texto visible del mensaje de error, que puede
 * escribirse con el carácter acentuado literal o con un escape \xNN
 * equivalente. Exige: (a) el payload nuevo se compara contra el
 * pendiente ya guardado con JSON.stringify(...) !== JSON.stringify(...);
 * (b) esa rama de conflicto devuelve {ok:false, pendiente:<mismo
 * objeto>}; (c) la rama de payload idéntico devuelve {ok:true,
 * pendiente:<mismo objeto>, recuperada:true} (replay idempotente). */
function verificarConflictoIdempotenciaPorResultado(bloque) {
  const capturaExistente = bloque.match(/const\s+(\w+)\s*=\s*leerPendientePM08\(/);
  if (!capturaExistente) return { ok: false, motivo: 'no_se_encontro_lectura_de_pendiente' };
  const v = capturaExistente[1];

  const reConflicto = new RegExp(
    `JSON\\.stringify\\(${v}\\.payload\\)\\s*!==\\s*JSON\\.stringify\\(payload\\)\\s*\\)\\s*\\{\\s*return\\s*\\{\\s*ok:\\s*false,\\s*pendiente:\\s*${v},`
  );
  if (!reConflicto.test(bloque)) return { ok: false, motivo: 'conflicto_de_payload_no_devuelve_ok_false_con_pendiente' };

  const reReplay = new RegExp(`return\\s*\\{\\s*ok:\\s*true,\\s*pendiente:\\s*${v},\\s*recuperada:\\s*true\\s*\\}`);
  if (!reReplay.test(bloque)) return { ok: false, motivo: 'payload_identico_no_hace_replay_idempotente' };

  return { ok: true, motivo: null };
}

const sync = functionBlock('sincronizarCajaPm08');
const caja = functionBlock('crearLogicaCaja');
const movimientosCaja = functionBlock('crearLogicaMovimientosCaja');
const devoluciones = functionBlock('crearLogicaDevoluciones');
const uiDevoluciones = functionBlock('Devoluciones');
const uiMovimientos = functionBlock('BloqueEntradasSalidas');
const uiArqueo = functionBlock('ArqueoCaja');
const prepararPendiente = functionBlock('prepararPendientePM08');

const rBloqueoArqueo = verificarBloqueoArqueoActivo(movimientosCaja);
const rDevolucionVenta = verificarRpcVigente(devoluciones, 'registrar_devolucion_venta_pm09', ['registrar_devolucion_venta'], migracionesTexto);
const rConflictoIdempotencia = verificarConflictoIdempotenciaPorResultado(prepararPendiente);

const checks = {
  sintaxis_sin_nowtime_inexistente: !source.includes('nowTime('),
  sync_caja_rls: sync.includes('.from("caja_operaciones")'),
  sync_arqueos_rls: sync.includes('.from("arqueos_caja")'),
  sync_devoluciones_cliente_rls: sync.includes('.from("devoluciones_venta")'),
  sync_devoluciones_proveedor_rls: sync.includes('.from("devoluciones_proveedor")'),
  sync_tras_contexto: source.includes('await sincronizarCajaPm08({ setArqueos, setMovimientosCaja, setDevoluciones });'),

  caja_arqueo_async: caja.includes('async function addArqueo(data)'),
  caja_arqueo_rpc: caja.includes('.rpc("registrar_arqueo_caja"'),
  caja_anulacion_rpc: caja.includes('.rpc("anular_arqueo_caja"'),
  caja_cero_valido: caja.includes('efectivoContado < 0') && !caja.includes('efectivoContado <= 0'),
  caja_sin_borrado_fisico: !/\bsetArqueos\s*\(\s*\(?\w+\)?\s*=>\s*\w+\.filter/.test(caja),
  caja_anulacion_trazable_local: caja.includes('estado: "ANULADO"') && caja.includes('anuladoMotivo'),
  caja_efecto_cero_no_falseado: caja.includes('Number.isFinite(efecto) ? efecto : fallback'),

  movimiento_alta_rpc: movimientosCaja.includes('.rpc("registrar_movimiento_caja"'),
  movimiento_reverso_rpc: movimientosCaja.includes('.rpc("revertir_movimiento_caja"'),
  movimiento_tipo_canonico: movimientosCaja.includes('["ENTRADA", "RETIRADA"]'),
  movimiento_importe_positivo: movimientosCaja.includes('imp <= 0'),
  movimiento_bloquea_arqueo_activo: rBloqueoArqueo.ok,
  movimiento_sin_borrado_fisico: !/\bsetMovimientosCaja\s*\(\s*\(?\w+\)?\s*=>\s*\w+\.filter/.test(movimientosCaja),
  movimiento_reverso_con_motivo: movimientosCaja.includes('if (!motivoLimpio)'),

  devolucion_cliente_rpc_atomica: rDevolucionVenta.ok,
  devolucion_proveedor_rpc_atomica: devoluciones.includes('.rpc("registrar_devolucion_proveedor"'),
  devolucion_exige_venta: devoluciones.includes('if (!ventaId)'),
  devolucion_cantidad_positiva: devoluciones.includes('cant <= 0'),
  devolucion_reembolso_no_negativo: devoluciones.includes('reembolsoNum < 0'),
  devolucion_limite_cantidad: devoluciones.includes('cantidadDevuelta + cant > cantidadOriginal'),
  devolucion_limite_reembolso: devoluciones.includes('reembolsado + reembolsoNum >'),
  devolucion_proveedor_sin_deficit: devoluciones.includes('tipo: "DEVOLUCION_PROVEEDOR"') && devoluciones.includes('permitirDeficit: false'),
  devolucion_contexto_local: devoluciones.includes('producto no pertenece al local activo') || devoluciones.includes('El producto no pertenece al local activo'),

  idempotencia_borrador_localstorage: source.includes('localStorage.setItem(clave, JSON.stringify(valor))'),
  idempotencia_conflicto_payload: rConflictoIdempotencia.ok,
  idempotencia_doble_click_devolucion: uiDevoluciones.includes('if (enviando) return'),
  idempotencia_doble_click_movimiento: uiMovimientos.includes('if (enviando || periodoCerrado) return'),
  idempotencia_doble_click_arqueo: uiArqueo.includes('if (enviando || yaArqueado) return'),
  timeout_conserva_borrador: source.includes('function esErrorTransitorioPM08') && source.includes('pendiente: true'),

  ui_devolucion_elige_venta: uiDevoluciones.includes('Venta original y producto'),
  ui_devolucion_medio_reintegro: uiDevoluciones.includes('Medio de reintegro'),
  ui_devolucion_min_cantidad: uiDevoluciones.includes('min: "0.000001"'),
  ui_movimiento_min_importe: uiMovimientos.includes('min: "0.01"'),
  ui_arqueo_admite_cero: uiArqueo.includes('min: "0"') && uiArqueo.includes('contadoNumero < 0'),
  ui_reverso_no_eliminar: uiMovimientos.includes('Revertir con motivo') && !uiMovimientos.includes('aria-label": "Eliminar movimiento'),
  ui_arqueo_anular_no_borrar: uiArqueo.includes('Anular cierre con motivo') && !uiArqueo.includes('Borrar y repetir'),

  storage_ledgers_rpc: index.includes('var LEDGERS_RPC = {') && index.includes('arqueos: true') && index.includes('movimientosCaja: true') && index.includes('devoluciones: true'),
  storage_cache_por_usuario_pm08: index.includes('arqueos: true, movimientosCaja: true, devoluciones: true'),
  storage_get_no_lee_bloque_global: index.includes('if (esLedgerRpc && !esPagosFactura)'),
  storage_set_no_upsert_bloque_global: index.includes('if (esLedgerRpc) {') && index.includes('Los ledgers remotos solo se escriben mediante RPC transaccional'),
  storage_pendientes_no_resube_ledger: index.includes('if (LEDGERS_RPC[key])'),
};

for (const [name, passed] of Object.entries(checks)) {
  console.log(`PM08_FRONTEND_${name.toUpperCase()}=${passed ? 1 : 0}`);
  if (!passed) process.exitCode = 1;
}

if (process.exitCode) {
  console.error('motivos:', JSON.stringify({ rBloqueoArqueo, rDevolucionVenta, rConflictoIdempotencia }, null, 2));
  throw new Error('PM08_FRONTEND_CONTRACT_FAIL');
}
console.log(`PM08_FRONTEND_CHECKS=${Object.keys(checks).length}`);
console.log('PM08_FRONTEND_CONTRACT_OK=1');

// --- Pruebas negativas deliberadas sobre copias EN MEMORIA (nunca sobre
// la aplicación real): cada una elimina UNA garantía y comprueba que el
// verificador correspondiente la detecta. ---
{
  const sinBloqueo = movimientosCaja.replace(/\s*&&\s*\w+\.estado\s*!==\s*"ANULADO"/, '');
  assert.notEqual(sinBloqueo, movimientosCaja, 'mutación sintética sin efecto -- prueba negativa inválida');
  const r = verificarBloqueoArqueoActivo(sinBloqueo);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'no_bloquea_por_arqueo_activo');
  console.log('PM08_NEGATIVA_SIN_BLOQUEO_ARQUEO=PASS');
}
{
  const conRpcAntigua = devoluciones.replace(/registrar_devolucion_venta_pm09/g, 'registrar_devolucion_venta');
  assert.notEqual(conRpcAntigua, devoluciones, 'mutación sintética sin efecto -- prueba negativa inválida');
  const r = verificarRpcVigente(conRpcAntigua, 'registrar_devolucion_venta_pm09', ['registrar_devolucion_venta'], migracionesTexto);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'no_llama_a_registrar_devolucion_venta_pm09');
  console.log('PM08_NEGATIVA_RPC_DEVOLUCION_ANTIGUA=PASS');
}
{
  const r = verificarRpcVigente(devoluciones, 'registrar_devolucion_venta_pm09', ['registrar_devolucion_venta'], []);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'registrar_devolucion_venta_pm09_no_definida_en_migracion_versionada');
  console.log('PM08_NEGATIVA_RPC_SIN_MIGRACION=PASS');
}
{
  // Puentea el conflicto: ante payload distinto, ahora "recupera" en vez
  // de rechazar -- exactamente el defecto que rompería la idempotencia.
  const conflictoRoto = prepararPendiente.replace(
    /!==\s*JSON\.stringify\(payload\)\s*\)\s*\{\s*return\s*\{\s*ok:\s*false,\s*pendiente:\s*existente,/,
    '!== JSON.stringify(payload)) { return { ok: true, pendiente: existente,'
  );
  assert.notEqual(conflictoRoto, prepararPendiente, 'mutación sintética sin efecto -- prueba negativa inválida');
  const r = verificarConflictoIdempotenciaPorResultado(conflictoRoto);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'conflicto_de_payload_no_devuelve_ok_false_con_pendiente');
  console.log('PM08_NEGATIVA_CONFLICTO_IDEMPOTENCIA_PUENTEADO=PASS');
}

console.log('PM08_NEGATIVAS_4_4=1');
