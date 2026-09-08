import fs from 'node:fs';
import assert from 'node:assert/strict';

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

  assert.match(cuerpo, /const \{ motivo = "Venta", precioVentaUnitario = null, referencia = "", medioPago = "Efectivo", movimientoId \} = opciones;/, 'debe desestructurar movimientoId de las opciones del llamador');
  assert.match(cuerpo, /movimientoId: movimientoId \|\| uid\(\),/, 'debe usar el movimientoId del llamador cuando existe, y solo generar uno nuevo si no lo dan');
  console.log('P04_PM19_REGISTRAR_SALIDA_REENVIA_MOVIMIENTO_ID=PASS');
}

// ---- Punto real de "Registrar como merma" (lote/caducidad): pasa el id determinista. ----
{
  assert.match(src, /registrarSalida\(confirmarMermaLote\.productoId, confirmarMermaLote\.unidades, \{ motivo: "Merma \/ caducidad", referencia: confirmarMermaLote\.lote \? `lote \$\{confirmarMermaLote\.lote\}` : "", movimientoId: movimientoIdMermaLotePM19\(confirmarMermaLote\) \}\)/, 'la confirmación real de merma por lote debe pasar el movimientoId determinista');
  console.log('P04_PM19_CONFIRMAR_MERMA_LOTE_USA_ID_DETERMINISTA=PASS');
}

console.log('PM19 P04 (wiring merma) — merma por lote protegida por deduplicación real: contrato OK');
