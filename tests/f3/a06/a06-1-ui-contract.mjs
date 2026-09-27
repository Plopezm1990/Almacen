// A06.1 final materialized-head validation trigger.
import fs from "node:fs";
import assert from "node:assert/strict";

const recovered = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");
const a06 = fs.readFileSync("supabase/migrations/20260924040000_abc_f3_a06_account_recovery.sql", "utf8");
const a06a11 = fs.readFileSync("supabase/migrations/20260927113403_abc_f3_a06_recovery_server_operating_day.sql", "utf8");

// A06.1: el backend autoritativo ya existe.
for (const required of [
  "create function public.abc_recuperar_cuenta(",
  "create function public.abc_listar_cuentas_recuperables(",
  "create function public.abc_consultar_operacion(",
  "'requires_operating_day_resolution'",
  "'revision',v_revision",
  "'pedidos',v_pedidos",
  "'estado_cobro',v_cobro"
]) {
  assert.ok(a06.includes(required), `A06.1: backend incompleto: ${required}`);
}

// El preflight detectó un fallo real de scope en A02/A05. A06.1 lo deja
// cubierto para impedir ReferenceError en runtime.
assert.ok(
  recovered.includes("function crearLogicaVenta({ productos, setProductos, movimientos, setMovimientos, arqueos, localActivoId, empresaDelLocalActivo = null })"),
  "A06.1: empresaDelLocalActivo no se inyecta en crearLogicaVenta"
);
assert.ok(
  recovered.includes("crearLogicaVenta({ productos, setProductos, movimientos, setMovimientos, arqueos, localActivoId, empresaDelLocalActivo });"),
  "A06.1: GestionAlmacen no pasa empresaDelLocalActivo"
);
assert.ok(
  recovered.includes("venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06 } = crearLogicaVenta"),
  "A06.1: los adaptadores A02/A05/A06 no salen del factory"
);
assert.ok(
  recovered.includes("return { venderCarrito, venderLocal, anularVenta, venderLineas, venderLote, devolverLote, venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06 };"),
  "A06.1: crearLogicaVenta no devuelve los adaptadores operativos"
);

const start = recovered.indexOf("async function recuperarCuentaA06()");
const end = recovered.indexOf("\n  function leerPedidoOperativoA05()", start);
assert.ok(start >= 0 && end > start, "A06.1: adaptador de recuperación no localizable");
const adapter = recovered.slice(start, end);

// Recupera el MISMO agregado; no crea cuenta/pedido/línea ni nuevos IDs.
assert.ok(adapter.includes('supabase.rpc("abc_recuperar_cuenta"'), "A06.1: falta RPC abc_recuperar_cuenta");
for (const required of [
  "p_cuenta_id: contextoLocal.cuentaId",
  "p_terminal_id: terminal.terminalId",
  "p_session_id: terminal.sessionId",
  "p_operating_day: contextoLocal.operatingDay",
  'String(data.cuenta.id || "") !== String(contextoLocal.cuentaId)',
  "cuentaId: data.cuenta.id",
  "pedidoId: pedido.id",
  'lineaId: linea.id',
  'lineaVersion: versionServidorA02(linea.version, "a06.linea_version")',
  'pedidoVersion: versionServidorA02(pedido.version, "a06.pedido_version")',
  'cuentaVersion: versionServidorA02(data.cuenta.version, "a06.cuenta_version")',
  "guardarContextoCuentaA02(empresaId, localActivoId",
  "data.requires_operating_day_resolution || data.reanudable === false"
]) {
  assert.ok(adapter.includes(required), `A06.1: falta identidad/versión autoritativa: ${required}`);
}

for (const forbidden of [
  "uuidA02(",
  '"abc_abrir_cuenta"',
  '"abc_crear_pedido"',
  '"abc_agregar_linea_pedido"',
  '"abc_agregar_linea_pedido_configurada"'
]) {
  assert.ok(!adapter.includes(forbidden), `A06.1: recuperación podría duplicar datos: ${forbidden}`);
}

// Un único pedido operativo: si el agregado es ambiguo se bloquea.
assert.ok(
  adapter.includes('const activos = pedidos.filter((p22) => !["CERRADO", "CANCELADO"].includes'),
  "A06.1: no filtra pedidos terminales"
);
assert.ok(
  adapter.includes('if (activos.length !== 1) throw new Error("cuenta_recuperacion_pedidos_ambigua")'),
  "A06.1: no falla cerrado ante múltiples pedidos activos"
);

// La recuperación reconstruye modificadores A04 sin inventar versiones.
for (const required of [
  "snapshot_comercial?.catalog_version",
  "expected_group_version: Number(opcion.catalog_group_version)",
  "expected_product_group_version: Number(opcion.catalog_product_group_version)",
  "expected_option_version: Number(opcion.catalog_option_version)",
  "configuradaA04: opciones.length > 0"
]) {
  assert.ok(adapter.includes(required), `A06.1: falta reconstrucción A04: ${required}`);
}

// Corte de red: conserva el snapshot local; al volver la red se reconcilia con servidor.
assert.ok(adapter.includes("offline: true"), "A06.1: no conserva contexto durante corte de red");
assert.ok(adapter.includes("...contextoLocal"), "A06.1: fallback offline no reutiliza la misma identidad");

assert.ok(
  recovered.includes("function VentaRapida({ productos, venderCarrito, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06,"),
  "A06.1: VentaRapida no recibe la recuperación"
);
assert.ok(
  recovered.includes("venderCarrito: venderCarritoA02, enviarPedidoA05, leerPedidoOperativoA05, accionPedidoA05, recuperarCuentaA06, anularVenta"),
  "A06.1: recuperación no está cableada al TPV"
);
assert.ok(
  recovered.includes('Promise.resolve(recuperarCuentaA06()).then((resultado) =>'),
  "A06.1: recarga del TPV no intenta recuperar desde servidor"
);
assert.ok(
  recovered.includes("const localPersistido = typeof leerPedidoOperativoA05"),
  "A06.1: no pinta primero el snapshot local durante corte/reinicio"
);

// A06.1 no habilita pagos, facturación, stock ni reapertura de cuentas cerradas.
for (const forbidden of [
  "abc_iniciar_checkout",
  "abc_confirmar_pago",
  "abc_emitir",
  "registrar_venta_stock_carrito_pm09",
  "abc_reabrir_cuenta"
]) {
  assert.ok(!adapter.includes(forbidden), `A06.1: efecto fuera de alcance: ${forbidden}`);
}

assert.ok(
  a06a11.includes("private.abc_resolver_operating_day_contexto("),
  "A06.1/A11: la recuperación no usa el resolver autoritativo de día operativo"
);
assert.ok(
  a06a11.includes("v_cuenta.opened_operating_day<>v_current_operating_day"),
  "A06.1/A11: la recuperación no compara contra el día calculado por servidor"
);
assert.ok(
  !a06a11.includes("v_cuenta.opened_operating_day<>p_operating_day"),
  "A06.1/A11: el cliente sigue siendo autoridad del día operativo"
);
assert.ok(
  a06a11.includes("SECURITY DEFINER") && a06a11.includes("SET search_path TO ''"),
  "A06.1/A11: se degradó el hardening de la RPC"
);

console.log("A06_1_SAME_ACCOUNT_RECOVERY=PASS");
console.log("A06_1_DUPLICATE_CREATION_WRITES=0");
console.log("A06_1_SCOPE_WIRING=PASS");
