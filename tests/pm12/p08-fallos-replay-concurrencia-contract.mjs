import assert from "node:assert/strict";
import fs from "node:fs";

const fuentes = [
  ["runtime", fs.readFileSync("fuente.js", "utf8")],
  ["fuente recuperada", fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8")]
];

function extraerMotor(codigo) {
  const inicio = codigo.indexOf("function crearMotorStock(");
  const fin = codigo.indexOf("\nfunction crearLogicaReconciliacion", inicio);
  assert.ok(inicio >= 0 && fin > inicio, "motor extraíble");
  const bloque = codigo.slice(inicio, fin);
  return new Function("todayISO", "fmt", "window", "fetch", "uid", "esMovimientoNuevo", "cantidadConSigno", `${bloque}; return crearMotorStock;`)(
    () => "2026-09-07", (x) => String(x), undefined, () => Promise.resolve(), () => "uid-no-usar", () => true, (m) => Number(m.cantidad) || 0
  );
}

for (const [nombre, codigo] of fuentes) {
  assert.match(codigo, /function aplicarLoteMovimientosStock\(operaciones = \[\]\)/, `${nombre}: lote atómico local`);
  assert.match(codigo, /codigo: "replay_parcial_inconsistente"/, `${nombre}: replay parcial bloqueado`);
  assert.match(codigo, /codigo: "conflicto_movimiento_existente"/, `${nombre}: conflicto no sobrescribe`);
  assert.match(codigo, /const simulados = .*new Map\(\)/, `${nombre}: preflight simulado`);
  const ai = codigo.indexOf("  function aplicarAjustes(conteoId, motivos = {}) {");
  const af = codigo.indexOf("\n  return { crearProductoEnConteo, iniciarConteo", ai);
  const aplicar = codigo.slice(ai, af);
  assert.doesNotMatch(aplicar, /movimientoId:\s*uid\(\)/, `${nombre}: P08 no usa ids aleatorios`);
  assert.match(aplicar, /const planAjustes = \[\]/, `${nombre}: plan completo previo`);
  assert.match(aplicar, /pm12PlanVersion: 1/, `${nombre}: plan versionado`);
  assert.match(aplicar, /aplicarLoteMovimientosStock\(planAjustes\)/, `${nombre}: una frontera de mutación`);
  assert.ok(aplicar.indexOf("autorizarMutacionAjustes(conteo)") < aplicar.indexOf("aplicarLoteMovimientosStock(planAjustes)"), `${nombre}: P07 antes de mutar`);
  assert.match(aplicar, /origen: "aplicarAjustes"/, `${nombre}: P06 conserva origen reversible`);
  assert.match(aplicar, /operationId: operationIdDeEsteAjuste/, `${nombre}: P05 conserva lote trazable`);

  const crearMotorStock = extraerMotor(codigo);
  const base = [{ id: "p1", nombre: "P1", localId: "L1", stock: 10, stockPisoVenta: 2, deficitPendiente: 0, stockMinimo: 0 }];
  let productos = structuredClone(base), movimientos = [], wp = 0, wm = 0;
  const motor = crearMotorStock({
    productos,
    movimientos,
    setProductos(fn) { wp += 1; productos = fn(productos); },
    setMovimientos(fn) { wm += 1; movimientos = fn(movimientos); },
    registrarAuditoria() {}
  });
  const lote = [
    { productoId: "p1", cantidad: -2, tipo: "INVENTARIO", operationId: "op1", movimientoId: "op1:a", origen: "aplicarAjustes", documentoOrigenId: "c1", afectaStockTotal: true, afectaStockPisoVenta: false, permitirDeficit: true },
    { productoId: "p1", cantidad: -1, tipo: "INVENTARIO", operationId: "op1", movimientoId: "op1:b", origen: "aplicarAjustes", documentoOrigenId: "c1", afectaStockTotal: false, afectaStockPisoVenta: true, permitirDeficit: true }
  ];
  const primera = motor.aplicarLoteMovimientosStock(lote);
  assert.equal(primera.ok, true, `${nombre}: primera aplicación`);
  assert.equal(movimientos.length, 2, `${nombre}: dos movimientos exactos`);
  assert.equal(productos[0].stock, 8, `${nombre}: stock total`);
  assert.equal(productos[0].stockPisoVenta, 1, `${nombre}: stock piso`);
  const replay = motor.aplicarLoteMovimientosStock(lote);
  assert.equal(replay.ok, true, `${nombre}: replay OK`);
  assert.equal(replay.replayed, true, `${nombre}: replay identificado`);
  assert.equal(movimientos.length, 2, `${nombre}: replay sin duplicar`);
  assert.equal(wp, 1, `${nombre}: replay sin reescribir productos`);
  assert.equal(wm, 1, `${nombre}: replay sin reescribir movimientos`);

  let pFail = structuredClone(base), mFail = [], wpFail = 0, wmFail = 0;
  const motorFail = crearMotorStock({ productos: pFail, movimientos: mFail, setProductos(fn) { wpFail++; pFail = fn(pFail); }, setMovimientos(fn) { wmFail++; mFail = fn(mFail); }, registrarAuditoria() {} });
  const fallo = motorFail.aplicarLoteMovimientosStock([lote[0], { ...lote[1], productoId: "no-existe", movimientoId: "op1:missing" }]);
  assert.equal(fallo.ok, false, `${nombre}: fallo de preflight`);
  assert.equal(wpFail, 0, `${nombre}: fallo sin mutación producto`);
  assert.equal(wmFail, 0, `${nombre}: fallo sin mutación movimientos`);
  assert.equal(pFail[0].stock, 10, `${nombre}: fallo conserva stock`);

  const existente = [{ id: "op1:a", operationId: "op1", productoId: "p1", localId: "L1", cantidad: -2, tipo: "INVENTARIO", origen: "aplicarAjustes", documentoOrigenId: "c1", afectaStockTotal: true, afectaStockPisoVenta: false }];
  let pParcial = structuredClone(base), mParcial = structuredClone(existente), wpp = 0, wmp = 0;
  const motorParcial = crearMotorStock({ productos: pParcial, movimientos: mParcial, setProductos(fn) { wpp++; pParcial = fn(pParcial); }, setMovimientos(fn) { wmp++; mParcial = fn(mParcial); }, registrarAuditoria() {} });
  const parcial = motorParcial.aplicarLoteMovimientosStock(lote);
  assert.equal(parcial.ok, false, `${nombre}: replay parcial rechazado`);
  assert.equal(parcial.codigo, "replay_parcial_inconsistente", `${nombre}: código replay parcial`);
  assert.equal(wpp, 0, `${nombre}: replay parcial no toca producto`);
  assert.equal(wmp, 0, `${nombre}: replay parcial no añade movimientos`);

  const conflicto = motorParcial.aplicarLoteMovimientosStock([{ ...lote[0], cantidad: -3 }]);
  assert.equal(conflicto.ok, false, `${nombre}: conflicto rechazado`);
  assert.equal(conflicto.codigo, "conflicto_movimiento_existente", `${nombre}: código conflicto`);
}

const evidencia = fs.readFileSync("tests/pm12/P08_FALLOS_REPLAY_CONCURRENCIA.md", "utf8");
assert.match(evidencia, /PM12_P08_FALLOS_REPLAY_CONCURRENCIA=PASS/);
console.log("PM12_P08_FALLOS_REPLAY_CONCURRENCIA=PASS");
console.log("OFF1_FALLO_PREVIO_SIN_MUTACION=1");
console.log("RW1_REPLAY_DETERMINISTA=1");
console.log("C1_SIN_DUPLICADOS=1");
console.log("REPLAY_PARCIAL_FAIL_CLOSED=1");
