// Trigger A02.1 isolated workflow after workflow installation.
import fs from "node:fs";
import assert from "node:assert/strict";

const recovered = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");
const runtime = fs.readFileSync("fuente.js", "utf8");

const headerLines = 14;
const recoveredBody = recovered.split("\n").slice(headerLines).join("\n");
assert.ok(runtime.endsWith(recoveredBody), "A02.1: runtime y fuente recuperada perdieron paridad de cuerpo");

assert.ok(recovered.includes("A02.1 UI -> A03 server authority"), "A02.1: falta marcador del adaptador");
assert.ok(recovered.includes("venderCarrito: venderCarritoA02"), "A02.1: VentaRapida no usa el adaptador A03");
assert.ok(recovered.includes('rpcA02ConRecuperacion(supabase, "abc_abrir_cuenta"'), "A02.1: falta abc_abrir_cuenta mediante el wrapper idempotente");
assert.ok(recovered.includes('rpcA02ConRecuperacion(supabase, "abc_crear_pedido"'), "A02.1: falta abc_crear_pedido mediante el wrapper idempotente");
assert.ok(recovered.includes('rpcA02ConRecuperacion(supabase, "abc_agregar_linea_pedido"'), "A02.1: falta abc_agregar_linea_pedido mediante el wrapper idempotente");
assert.ok(recovered.includes('"abc_consultar_operacion"'), "A02.1: falta recuperación de operation_id");
assert.ok(recovered.includes("p_expected_cuenta_version"), "A02.1: falta optimistic locking de cuenta");
assert.ok(recovered.includes("p_expected_pedido_version"), "A02.1: falta optimistic locking de pedido");
assert.ok(recovered.includes("p_terminal_id"), "A02.1: falta terminal_id");
assert.ok(recovered.includes("p_session_id"), "A02.1: falta session_id");
assert.ok(recovered.includes("p_operating_day"), "A02.1: falta operating_day");
assert.ok(recovered.includes("la_suite_a02_1_pendiente_v1"), "A02.1: falta persistencia de replay");
assert.ok(recovered.includes('from("catalogo_tpv_productos")'), "A02.1: catálogo servidor no es autoridad");
assert.ok(recovered.includes('from("terminales_tpv")'), "A02.1: falta resolución segura de terminal");
assert.ok(recovered.includes('from("caja_sesion_terminales")'), "A02.1: falta vínculo terminal/sesión");
assert.ok(recovered.includes('from("caja_sesiones")'), "A02.1: falta validación de sesión ABIERTA");
assert.ok(recovered.includes("false && showCobro"), "A02.1: UI de cobro heredada sigue activa");
assert.ok(recovered.includes("Guardar pedido"), "A02.1: el CTA aún presenta un cobro");
assert.ok(recovered.includes("registrar_venta_stock_carrito_pm09"), "A02.1: el legado PM09 fue eliminado bruscamente");

const start = recovered.indexOf("async function venderCarritoA02");
const end = recovered.indexOf("async function venderCarrito(lineas", start);
assert.ok(start >= 0 && end > start, "A02.1: no se pudo aislar el adaptador");
const adapter = recovered.slice(start, end);

for (const forbidden of [
  "registrar_venta_stock_carrito_pm09",
  "venderLocal(",
  "abc_iniciar_checkout",
  "abc_confirmar_pago",
  "abc_emitir",
  "checkout_ventas"
]) {
  assert.ok(!adapter.includes(forbidden), `A02.1: escritura fuera de alcance detectada: ${forbidden}`);
}

assert.ok(adapter.includes('modalidad: "BARRA"'), "A02.1: VentaRapida debe mapearse explícitamente a BARRA");
assert.ok(adapter.includes("totalServidor"), "A02.1: la confirmación debe usar total devuelto por servidor");
assert.ok(adapter.includes("pedido_a02_pendiente_distinto"), "A02.1: falta fail-closed ante carrito distinto con operación pendiente");
const recoveryStart = recovered.indexOf("async function rpcA02ConRecuperacion");
const recoveryEnd = recovered.indexOf("async function venderCarritoA02", recoveryStart);
assert.ok(recoveryStart >= 0 && recoveryEnd > recoveryStart, "A02.1: no se pudo aislar el wrapper de recuperación");
const recoveryAdapter = recovered.slice(recoveryStart, recoveryEnd);
assert.ok(recoveryAdapter.includes("operacion_a02_en_curso"), "A02.1: falta fail-closed tras timeout en curso");

console.log("A02_1_CONTRACT=PASS");
console.log("A02_1_PRIMARY_PATH=A03");
console.log("A02_1_PAYMENT_WRITES=0");
console.log("A02_1_LEGACY_PM09_PRIMARY=0");
