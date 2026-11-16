import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

// PM19 P04: confirma, por inspección estática, que registrarSalida reenvía de verdad el
// movimientoId del llamador (en vez de generar siempre uno aleatorio) y que el punto real
// de "Registrar como merma" del lote/caducidad usa el id determinista -- no basta con que
// exista movimientoIdMermaLotePM19 si nadie la usa donde importa.
//
// La deduplicación por movimientoId del motor de stock (aplicarMovimientoStock) ya está
// probada extensamente en tests/pm12/p08-fallos-replay-concurrencia-contract.mjs -- este
// contrato no la reimplementa, solo prueba que la merma por lote ahora la aprovecha de
// verdad.

const src = fs.readFileSync('fuente.js', 'utf8');

// ---- registrarSalida: acepta movimientoId opcional, lo reenvía al motor; sin él, sigue
// generando uno aleatorio (compatibilidad total con ventas y demás motivos). ----
{
  const ini = src.indexOf('function registrarSalida(productoId, cantidad, opciones = {}) {');
  assert.ok(ini >= 0, 'registrarSalida no encontrada');
  const fin = src.indexOf('return { addProducto, updateProducto, deleteProducto, reactivarProducto, registrarSalida, ajustarProductoPorOtro };', ini);
  const cuerpo = src.slice(ini, fin);

  assert.match(cuerpo, /movimientoId, loteId = null \} = opciones;/, 'debe desestructurar el id y el lote de las opciones del llamador');
  assert.match(cuerpo, /registrarSalidaServidorPM19\(\{[^}]+movimientoId: movimientoId \|\| uid\(\), motivo, referencia, loteId/, 'la operación sincronizada debe conservar la identidad y el lote');
  assert.match(cuerpo, /aplicarMovimientoStock\(\{[^}]+movimientoId: movimientoId \|\| uid\(\),/, 'el modo local conserva la deduplicación anterior');
  console.log('P04_PM19_REGISTRAR_SALIDA_REENVIA_MOVIMIENTO_ID=PASS');
}

// ---- Punto real de "Registrar como merma" (lote/caducidad): pasa el id determinista. ----
{
  assert.match(src, /await registrarSalida\(confirmarMermaLote\.productoId, confirmarMermaLote\.unidades, \{[^\n]+movimientoId: movimientoIdMermaLotePM19\(confirmarMermaLote\), loteId: confirmarMermaLote.id \}\)/, 'la confirmación espera al servidor con identidad determinista y lote exacto');
  console.log('P04_PM19_CONFIRMAR_MERMA_LOTE_USA_ID_DETERMINISTA=PASS');
}

{
  const ini = src.indexOf('async function registrarSalidaServidorPM19(');
  const fin = src.indexOf('function usarEnvioSalidaPM19(', ini);
  assert.ok(ini >= 0 && fin > ini);
  const llamadas = [];
  let respuesta = { error: { message: 'stock_insuficiente' } };
  let refrescos = 0;
  const ctx = vm.createContext({
    window: { __nubeActiva: true, getSupabaseClient: async () => ({
      rpc: async (nombre, params) => { llamadas.push({ nombre, params }); return respuesta; }
    }) },
    todayISO: () => '2026-11-16',
    sincronizarStockPm07: async () => { refrescos += 1; }
  });
  vm.runInContext(src.slice(ini, fin), ctx);
  const opciones = { empresaId: 'QA-E', localActivoId: 'QA-L', productoId: 'P', cantidad: 6,
    movimientoId: 'mismo-intento', motivo: 'Merma / caducidad', referencia: 'lote Q', loteId: 'lote-Q', costo: 2 };
  const rechazo = await ctx.registrarSalidaServidorPM19(opciones);
  assert.equal(rechazo.ok, false);
  assert.equal(refrescos, 0);
  respuesta = { data: { ok: true, total: 6, replayed: true } };
  assert.equal((await ctx.registrarSalidaServidorPM19(opciones)).total, 6);
  assert.equal(refrescos, 1);
  assert.equal(llamadas[0].nombre, 'registrar_salida_stock');
  assert.deepEqual(llamadas[0].params, llamadas[1].params);
  assert.equal(llamadas[0].params.p_lote_id, 'lote-Q');
  await ctx.registrarSalidaServidorPM19({ ...opciones, motivo: 'Venta', ingresoUnitario: 1.5, iva: 10, medioPago: 'Efectivo' });
  assert.equal(llamadas[2].nombre, 'registrar_venta_stock_carrito_pm09');
  assert.equal(llamadas[2].params.p_lineas[0].ingresoUnitario, 1.5);
  console.log('P04_PM19_CONFIRMACION_SERVIDOR_REINTENTO_Y_VENTA=PASS');
}

console.log('PM19 P04 (wiring merma) — merma por lote protegida por deduplicación real: contrato OK');
