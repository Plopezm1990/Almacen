import fs from "node:fs";
import assert from "node:assert/strict";

const recovered = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");
const a05 = fs.readFileSync("supabase/migrations/20260924030000_abc_f3_a05_order_state_machine.sql", "utf8");

const adapterStart = recovered.indexOf("async function enviarPedidoA05()");
const adapterEnd = recovered.indexOf("\n  async function venderCarrito(lineas", adapterStart);
assert.ok(adapterStart >= 0 && adapterEnd > adapterStart, "A05.2: adaptador no localizable");
const adapter = recovered.slice(adapterStart, adapterEnd);

for (const rpc of [
  "abc_confirmar_linea_pedido",
  "abc_confirmar_linea_pedido_configurada",
  "abc_enviar_pedido"
]) {
  assert.ok(adapter.includes(`"${rpc}"`), `A05.2: falta RPC ${rpc}`);
}

assert.ok(
  adapter.indexOf('"abc_enviar_pedido"') > adapter.indexOf('"abc_confirmar_linea_pedido"'),
  "A05.2: el envío debe ocurrir después de confirmar líneas"
);
assert.ok(
  adapter.indexOf('"abc_enviar_pedido"') > adapter.indexOf('"abc_confirmar_linea_pedido_configurada"'),
  "A05.2: el envío debe ocurrir después de confirmar líneas configuradas"
);

for (const required of [
  "p_expected_linea_version",
  "p_expected_pedido_version",
  "p_expected_product_version",
  "p_selecciones",
  "p_terminal_id: contexto.terminalId",
  "p_session_id: contexto.sessionId",
  "p_operating_day: contexto.operatingDay",
  "guardarContextoCuentaA02(empresaId, localActivoId, contexto)",
  'contexto.pedidoEstado = String(enviado?.estado || "ENVIADO")',
  'estado: "ENVIADA"'
]) {
  assert.ok(adapter.includes(required), `A05.2: falta guarda/versión ${required}`);
}

for (const forbidden of [
  "abc_iniciar_checkout",
  "abc_confirmar_pago",
  "abc_emitir",
  "registrar_venta_stock_carrito_pm09",
  "venderLocal("
]) {
  assert.ok(!adapter.includes(forbidden), `A05.2: fuera de alcance detectado ${forbidden}`);
}

assert.ok(recovered.includes('pedidoEstado: "ABIERTO"'), "A05.2: contexto inicial sin estado ABIERTO");
assert.ok(recovered.includes('estado: String(l22.resultado?.estado || "BORRADOR")'), "A05.2: contexto de línea sin estado");
assert.ok(recovered.includes("configuracionA04: l22.configuracionA04 ?"), "A05.2: no conserva configuración A04 para confirmar");
assert.ok(recovered.includes("function VentaRapida({ productos, venderCarrito, enviarPedidoA05,"), "A05.2: prop no conectada");
assert.ok(recovered.includes("async function enviarPedidoGuardadoA05()"), "A05.2: UI sin acción de envío");
assert.ok(recovered.includes("Estado operativo:"), "A05.2: UI no muestra estado operativo");
assert.ok(recovered.includes('"Enviar pedido"'), "A05.2: CTA de envío ausente");
assert.ok(recovered.includes("Continúa su preparación, servido o cancelación desde el panel operativo del TPV."), "A05.2/A05.3: continuidad operativa no documentada");

assert.ok(a05.includes("create function public.abc_enviar_pedido("), "A05.2: backend A05 ausente");
assert.ok(a05.includes("if v_pedido.estado<>'ABIERTO' then raise exception 'pedido_no_enviable'"), "A05.2: backend no exige ABIERTO");
assert.ok(a05.includes("and estado<>'CONFIRMADA'"), "A05.2: backend no exige líneas confirmadas");
assert.ok(a05.includes("set estado='ENVIADO'"), "A05.2: backend no lleva pedido a ENVIADO");
assert.ok(a05.includes("set estado='ENVIADA'"), "A05.2: backend no lleva líneas a ENVIADA");

console.log("A05_2_TPV_STATE_INTEGRATION=PASS");
