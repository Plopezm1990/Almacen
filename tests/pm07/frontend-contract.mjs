import fs from 'node:fs';

const s = fs.readFileSync('source-recovery/fuente-recuperado.js', 'utf8');

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

const venta = functionBlock('venderCarrito');
const anular = functionBlock('anularVenta');
const interno = functionBlock('traspasarStock');
const interlocal = functionBlock('traspasarEntreLocales');
const contexto = functionBlock('sincronizarContextoPm07');

const checks = {
  sync_helper_unico: (s.match(/async function sincronizarStockPm07\(/g) || []).length === 1,
  contexto_cloud_helper_unico: (s.match(/async function sincronizarContextoPm07\(/g) || []).length === 1,
  contexto_cloud_lee_claves: contexto.includes('.from("almacen_kv")') && contexto.includes('"empresas", "locales", "localActivoId", "productos"'),
  contexto_cloud_hidrata_locales: contexto.includes('setLocales(localesNube.filter'),
  contexto_cloud_hidrata_local_activo: contexto.includes('setLocalActivoId(localActivoNube)'),
  contexto_cloud_se_ejecuta_tras_ready: s.includes('await sincronizarContextoPm07({ setEmpresas, setLocales, setLocalActivoId, setProductos });'),
  venta_rpc_pm07: venta.includes('supabase.rpc("registrar_venta_stock_carrito"'),
  venta_solo_un_fallback_offline: (venta.match(/return venderLocal\(lineas, medioPago, detallePago\);/g) || []).length === 1,
  venta_fallo_cloud_no_muta_local: venta.includes('No se ha descontado stock localmente.'),
  venta_sin_rpc_antigua: !venta.includes('descontar_stock_carrito'),
  reverso_rpc_pm07: anular.includes('supabase.rpc("revertir_venta_stock_carrito"'),
  reverso_sin_rpc_antigua: !anular.includes('anular_venta_tpv'),
  traslado_interno_rpc_pm07: interno.includes('supabase.rpc("trasladar_stock_interno"'),
  traslado_interlocal_rpc_pm07: interlocal.includes('supabase.rpc("trasladar_stock_entre_locales"'),
  traslado_interlocal_sin_mutacion_local_en_error_cloud: interlocal.includes('No se modific') && interlocal.includes('ning') && interlocal.includes('local'),
  venta_offline_sin_deficit: s.includes('documentoOrigenId: documentoOrigenId || ventaId,\n        afectaStockTotal: true,\n        afectaStockPisoVenta: true,\n        permitirDeficit: false,'),
  alertas_sin_precedencia_ambigua: !s.includes('tipo !== "elaborado" && p2._pm07Servidor ?'),
  alertas_pm07_parentesis: (s.match(/tipo !== "elaborado" && \(p2\._pm07Servidor \?/g) || []).length >= 2,
  tpv_precheck_autoritativo: s.includes('l2.producto._pm07Servidor ? Number(l2.producto.stock) || 0 : Number(l2.producto.stockPisoVenta) || 0'),
  tpv_vendibles_autoritativo: s.includes('p2._pm07Servidor ? Number(p2.stock) || 0 : Number(p2.stockPisoVenta) || 0'),
  submit_traspaso_async: s.includes('async function submit() {\n    const res = await traspasarStock('),
  submit_interlocal_async: s.includes('async function submitEntreLocales() {\n    const res = await traspasarEntreLocales('),
  envio_piso_async: s.includes('async function enviarAPisoDeVenta(orden)') && s.includes('await traspasarStock(productoId'),
};

for (const [k, ok] of Object.entries(checks)) {
  console.log(`PM07_${k.toUpperCase()}=${ok ? 1 : 0}`);
  if (!ok) process.exitCode = 1;
}
if (process.exitCode) throw new Error('PM07_FRONTEND_CONTRACT_FAIL');
console.log('PM07_FRONTEND_CONTRACT_OK=1');
