import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM19 P04: "Merma descuenta una vez" (entrega verificable literal de PM19). No es un
// módulo aparte -- es un motivo del motor de stock compartido (aplicarMovimientoStock),
// que ya deduplica por movimientoId (probado extensamente en PM12). Lo que NO estaba
// probado, y resultó ser un hueco real: registrarSalida() generaba SIEMPRE un
// movimientoId aleatorio nuevo (uid()) para cada llamada, incluso para el mismo lote de
// merma por caducidad -- es decir, la protección de idempotencia del motor nunca llegaba
// a activarse para una merma, porque cada intento parecía "un movimiento distinto" aunque
// fuera literalmente la misma merma repetida.
//
// Arreglo: registrarSalida ahora acepta un movimientoId opcional del llamador (si no se
// da, sigue generando uno aleatorio -- no cambia nada para ventas u otros motivos). El
// punto de "Registrar como merma" del lote/caducidad ahora deriva un movimientoId
// determinista a partir de la identidad real del lote (producto + lote + caducidad), vía
// movimientoIdMermaLotePM19, así que un reintento de la MISMA merma sí queda protegido
// por la deduplicación ya existente del motor.

const src = fs.readFileSync('fuente.js', 'utf8');

// ---- movimientoIdMermaLotePM19: determinista (misma entrada -> mismo id siempre) y
// distingue por producto/lote/caducidad. ----
{
  const ini = src.indexOf('function movimientoIdMermaLotePM19(');
  assert.ok(ini >= 0, 'movimientoIdMermaLotePM19 no encontrada');
  const fin = src.indexOf('function crearMotorStock(', ini);
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(src.slice(ini, fin), ctx);

  const lote = { productoId: 'p1', lote: 'L20', caducidad: '2026-09-10' };

  // Positivo/replay: mismo lote, mismo id, siempre -- da igual cuántas veces se llame.
  const id1 = ctx.movimientoIdMermaLotePM19(lote);
  const id2 = ctx.movimientoIdMermaLotePM19({ ...lote });
  const id3 = ctx.movimientoIdMermaLotePM19(lote);
  assert.equal(id1, id2, 'el mismo lote debe producir siempre el mismo movimientoId, sin importar la instancia del objeto');
  assert.equal(id1, id3);

  // Negativo: cualquier diferencia real (producto, lote, caducidad) da un id distinto --
  // no deben fusionarse mermas que en realidad son operaciones distintas.
  assert.notEqual(ctx.movimientoIdMermaLotePM19({ ...lote, productoId: 'p2' }), id1);
  assert.notEqual(ctx.movimientoIdMermaLotePM19({ ...lote, lote: 'L21' }), id1);
  assert.notEqual(ctx.movimientoIdMermaLotePM19({ ...lote, caducidad: '2026-09-11' }), id1);

  // Un lote sin código o sin fecha (casos reales: mercancía sin lote declarado) sigue
  // produciendo un id válido y estable, no revienta ni se confunde con otro lote real.
  const sinLote = ctx.movimientoIdMermaLotePM19({ productoId: 'p1', caducidad: '2026-09-10' });
  assert.equal(sinLote, ctx.movimientoIdMermaLotePM19({ productoId: 'p1', caducidad: '2026-09-10' }));
  assert.notEqual(sinLote, id1);

  console.log('P04_PM19_MOVIMIENTO_ID_MERMA_DETERMINISTA=PASS');
}

console.log('PM19 P04 (merma descuenta una vez) — id determinista: contrato OK');
