import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const src = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");
const backend = fs.readFileSync("tests/f3/a06/a06-contract.sql", "utf8");

// ---- Backend: la concurrencia ya falla cerrado por versión obsoleta. ----
for (const required of [
  "Terminal con versión antigua falla.",
  "cuenta_version_conflict",
  "revision no cambió tras reasignación",
  "Terminal 2 recupera el agregado persistido."
]) {
  assert.ok(backend.includes(required), `A06.2 backend sin evidencia de concurrencia: ${required}`);
}
console.log("A06_2_BACKEND_OPTIMISTIC_LOCK=PASS");

// ---- Helpers puros de borrador: aislamiento por empresa/local + TTL 24h. ----
{
  const ini = src.indexOf("const A06_BORRADOR_TTL_MS =");
  const fin = src.indexOf("function VentaRapida(", ini);
  assert.ok(ini >= 0 && fin > ini, "A06.2 helpers de borrador no localizables");

  const store = new Map();
  const localStorage = {
    getItem: (k) => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  const ctx = { localStorage, Date, JSON, Number, String, Array, Object, Error };
  vm.createContext(ctx);
  vm.runInContext(src.slice(ini, fin) + "\nthis.__A06_TTL = A06_BORRADOR_TTL_MS;", ctx);

  assert.equal(ctx.__A06_TTL, 24 * 60 * 60 * 1000, "A06.2 TTL debe ser 24h");
  assert.notEqual(ctx.claveBorradorTpvA06("emp-1", "loc-1"), ctx.claveBorradorTpvA06("emp-1", "loc-2"));
  assert.notEqual(ctx.claveBorradorTpvA06("emp-1", "loc-1"), ctx.claveBorradorTpvA06("emp-2", "loc-1"));

  const t0 = 1_800_000_000_000;
  const guardado = ctx.guardarBorradorTpvA06("emp-1", "loc-1", [
    { productoId: "prod-1", cantidad: 2, claveCarrito: "prod-1" }
  ], t0);
  assert.equal(guardado.estado, "ACTIVO");
  assert.equal(guardado.expiresAtMs, t0 + 24 * 60 * 60 * 1000);

  const vivo = ctx.leerBorradorTpvA06("emp-1", "loc-1", t0 + 1000);
  assert.equal(vivo.estado, "ACTIVO");
  assert.equal(vivo.lineas.length, 1);
  assert.equal(vivo.lineas[0].productoId, "prod-1");
  assert.equal(vivo.lineas[0].cantidad, 2);

  assert.equal(ctx.leerBorradorTpvA06("emp-1", "loc-2", t0 + 1000).estado, "VACIO");

  const expirado = ctx.leerBorradorTpvA06("emp-1", "loc-1", t0 + 24 * 60 * 60 * 1000 + 1);
  assert.equal(expirado.estado, "CADUCADO");
  assert.equal(store.has(ctx.claveBorradorTpvA06("emp-1", "loc-1")), false, "borrador caducado debe eliminarse");

  ctx.guardarBorradorTpvA06("emp-1", "loc-1", [{ productoId: "prod-2", cantidad: 1 }], t0);
  const vacio = ctx.guardarBorradorTpvA06("emp-1", "loc-1", [], t0 + 2000);
  assert.equal(vacio.estado, "VACIO");
  assert.equal(store.has(ctx.claveBorradorTpvA06("emp-1", "loc-1")), false, "carrito vacío debe borrar borrador");

  console.log("A06_2_LOCAL_DRAFT_TTL_ISOLATION=PASS");
}

// ---- El borrador nunca persiste precio/total autoritativo del cliente. ----
{
  const ini = src.indexOf("function lineasBorradorTpvA06(");
  const fin = src.indexOf("function leerBorradorTpvA06(", ini);
  const block = src.slice(ini, fin);
  assert.ok(block.includes("productoId"));
  assert.ok(block.includes("cantidad"));
  assert.ok(block.includes("configuracionA04"));
  assert.ok(!block.includes("precioUnitario"));
  assert.ok(!block.includes("subtotal"));
  assert.ok(!block.includes("total:"));
  console.log("A06_2_DRAFT_NO_CLIENT_PRICE_AUTHORITY=PASS");
}

// ---- Conflicto tipado: las tres rutas de escritura propagan conflict=true. ----
{
  const helperIni = src.indexOf("function esConflictoVersionA06(");
  const helperFin = src.indexOf("function errorRpcA02(", helperIni);
  const helper = src.slice(helperIni, helperFin);
  for (const code of ["cuenta_version_conflict", "pedido_version_conflict", "linea_version_conflict"]) {
    assert.ok(helper.includes(code), `A06.2 no reconoce ${code}`);
  }
  assert.ok(helper.includes('conflictType: conflict ? "VERSION" : null'));

  for (const fn of ["async function venderCarritoA02(", "async function enviarPedidoA05()", "async function accionPedidoA05("]) {
    const ini = src.indexOf(fn);
    assert.ok(ini >= 0, `A06.2 falta ${fn}`);
    const next = src.indexOf("\n  async function ", ini + fn.length);
    const block = src.slice(ini, next > ini ? next : ini + 30000);
    assert.ok(block.includes("return respuestaErrorA06(error);"), `A06.2 ${fn} no propaga conflicto tipado`);
  }
  console.log("A06_2_CONFLICT_TYPED=PASS");
}

// ---- UX: el conflicto se reconcilia con servidor sin borrar el carrito local. ----
{
  const ini = src.indexOf("async function gestionarConflictoA06(");
  const fin = src.indexOf("\n  async function confirmarCobro()", ini);
  assert.ok(ini >= 0 && fin > ini, "A06.2 reconciliador visible no encontrado");
  const block = src.slice(ini, fin);
  assert.ok(block.includes("await recuperarCuentaA06()"));
  assert.ok(block.includes("setPedidoOperativoA05(recuperado)"));
  assert.ok(block.includes("setConflictoA06({"));
  assert.ok(!block.includes("setCarrito([])"), "A06.2 conflicto no debe borrar el borrador local");

  for (const marker of [
    "Conflicto de edición: otro terminal cambió esta cuenta.",
    "No se ha sobrescrito el servidor.",
    "Tu borrador local no se ha borrado",
    "Borrador local activo",
    "se conserva 24 h desde la última modificación",
    "Borrador local caducado"
  ]) {
    assert.ok(src.includes(marker), `A06.2 estado visible ausente: ${marker}`);
  }
  console.log("A06_2_VISIBLE_CONFLICT_AND_DRAFT=PASS");
}

// ---- Guardar con éxito sí limpia el carrito; el conflicto no. ----
{
  const ini = src.indexOf("async function confirmarCobro()");
  const fin = src.indexOf("\n  async function enviarPedidoGuardadoA05()", ini);
  const block = src.slice(ini, fin);
  assert.ok(block.includes('gestionarConflictoA06(resultado, "GUARDAR_PEDIDO")'));
  assert.ok(block.includes("setCarrito([])"), "A06.2 éxito debe limpiar borrador tras persistencia servidor");
  const conflictPos = block.indexOf('gestionarConflictoA06(resultado, "GUARDAR_PEDIDO")');
  const clearPos = block.indexOf("setCarrito([])");
  assert.ok(clearPos > conflictPos, "A06.2 no debe limpiar antes de resolver resultado");
}

console.log("A06_2_CONCURRENCY_LOCAL_DRAFTS=PASS");
