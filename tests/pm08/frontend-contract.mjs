import fs from 'node:fs';

const source = fs.readFileSync('source-recovery/fuente-recuperado.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

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

const sync = functionBlock('sincronizarCajaPm08');
const caja = functionBlock('crearLogicaCaja');
const movimientosCaja = functionBlock('crearLogicaMovimientosCaja');
const devoluciones = functionBlock('crearLogicaDevoluciones');
const uiDevoluciones = functionBlock('Devoluciones');
const uiMovimientos = functionBlock('BloqueEntradasSalidas');
const uiArqueo = functionBlock('ArqueoCaja');

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
  caja_sin_borrado_fisico: !caja.includes('setArqueos((s2) => s2.filter'),
  caja_anulacion_trazable_local: caja.includes('estado: "ANULADO"') && caja.includes('anuladoMotivo'),
  caja_efecto_cero_no_falseado: caja.includes('Number.isFinite(efecto) ? efecto : fallback'),

  movimiento_alta_rpc: movimientosCaja.includes('.rpc("registrar_movimiento_caja"'),
  movimiento_reverso_rpc: movimientosCaja.includes('.rpc("revertir_movimiento_caja"'),
  movimiento_tipo_canonico: movimientosCaja.includes('["ENTRADA", "RETIRADA"]'),
  movimiento_importe_positivo: movimientosCaja.includes('imp <= 0'),
  movimiento_bloquea_arqueo_activo: movimientosCaja.includes('a2.estado !== "ANULADO"'),
  movimiento_sin_borrado_fisico: !movimientosCaja.includes('setMovimientosCaja((s2) => s2.filter'),
  movimiento_reverso_con_motivo: movimientosCaja.includes('if (!motivoLimpio)'),

  devolucion_cliente_rpc_atomica: devoluciones.includes('.rpc("registrar_devolucion_venta"'),
  devolucion_proveedor_rpc_atomica: devoluciones.includes('.rpc("registrar_devolucion_proveedor"'),
  devolucion_exige_venta: devoluciones.includes('if (!ventaId)'),
  devolucion_cantidad_positiva: devoluciones.includes('cant <= 0'),
  devolucion_reembolso_no_negativo: devoluciones.includes('reembolsoNum < 0'),
  devolucion_limite_cantidad: devoluciones.includes('cantidadDevuelta + cant > cantidadOriginal'),
  devolucion_limite_reembolso: devoluciones.includes('reembolsado + reembolsoNum >'),
  devolucion_proveedor_sin_deficit: devoluciones.includes('tipo: "DEVOLUCION_PROVEEDOR"') && devoluciones.includes('permitirDeficit: false'),
  devolucion_contexto_local: devoluciones.includes('producto no pertenece al local activo') || devoluciones.includes('El producto no pertenece al local activo'),

  idempotencia_borrador_localstorage: source.includes('localStorage.setItem(clave, JSON.stringify(valor))'),
  idempotencia_conflicto_payload: source.includes('Hay una operación anterior pendiente en este local'),
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

if (process.exitCode) throw new Error('PM08_FRONTEND_CONTRACT_FAIL');
console.log(`PM08_FRONTEND_CHECKS=${Object.keys(checks).length}`);
console.log('PM08_FRONTEND_CONTRACT_OK=1');
