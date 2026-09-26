// Trigger A02.1 isolated workflow after workflow installation.
import fs from "node:fs";
import assert from "node:assert/strict";

const recovered = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");
const runtime = fs.readFileSync("fuente.js", "utf8");
const a03 = fs.readFileSync("supabase/migrations/20260924010000_abc_f3_a03_server_authority.sql", "utf8");
const m01 = fs.readFileSync("supabase/migrations/20260923210000_abc_f2_m01_base_transaccional_caja.sql", "utf8");
const m03a = fs.readFileSync("supabase/migrations/20260923233000_abc_f2_m03a_autoridad_transaccional.sql", "utf8");
const m04a = fs.readFileSync("supabase/migrations/20260924001000_abc_f2_m04a_caja_sesiones.sql", "utf8");
const a11 = fs.readFileSync("supabase/migrations/20260926203000_abc_f3_a02_operating_day_a11.sql", "utf8");

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

const terminalStart = recovered.indexOf("async function contextoTerminalA02");
const terminalEnd = recovered.indexOf("function errorRpcA02", terminalStart);
assert.ok(terminalStart >= 0 && terminalEnd > terminalStart, "A02.1: no se pudo aislar el resolver de terminal");
const terminalResolver = recovered.slice(terminalStart, terminalEnd);
assert.ok(terminalResolver.includes("la_suite_abc_terminal_id_v1:"), "A02.1: falta binding persistente por empresa/local");
assert.ok(terminalResolver.includes('qTerminales = qTerminales.eq("id", terminalId)'), "A02.1: el terminal persistido no se revalida por id");
assert.ok(terminalResolver.includes("terminales.length === 0"), "A02.1: falta fail-closed cuando no hay terminales");
assert.ok(terminalResolver.includes("terminales.length > 1"), "A02.1: falta fail-closed cuando hay varios terminales");
assert.ok(terminalResolver.includes('throw new Error("persistencia_terminal_no_disponible")'), "A02.1: el binding puede continuar sin persistencia segura");
const uniqueCheck = terminalResolver.indexOf("terminales.length > 1");
const selectOnlyAfterUnique = terminalResolver.indexOf("terminalId = terminales[0].id");
assert.ok(uniqueCheck >= 0 && selectOnlyAfterUnique > uniqueCheck, "A02.1: se selecciona un terminal antes de demostrar unicidad");
assert.ok(m01.includes("create unique index abc_terminal_device_key_uq"), "A02.1: device_key no es único por scope");
assert.ok(m01.includes("revoke insert,update,delete on public.terminales_tpv from authenticated"), "A02.1: el navegador conserva escritura directa sobre terminales_tpv");

assert.ok(
  m04a.includes("create unique index abc_terminal_una_sesion_activa_uq") &&
  m04a.includes("on public.caja_sesion_terminales(terminal_id)") &&
  m04a.includes("where hasta is null;"),
  "A02.1: F2 M04A no garantiza una única sesión activa por terminal"
);
for (const required of [
  '.from("caja_sesion_terminales")',
  '.eq("empresa_id", empresaId)',
  '.eq("local_id", localId)',
  '.eq("terminal_id", terminalId)',
  '.is("hasta", null)',
  '.limit(2)'
]) {
  assert.ok(terminalResolver.includes(required), `A02.1: resolución de sesión incompleta: ${required}`);
}
assert.ok(terminalResolver.includes("vinculos.length !== 1"), "A02.1: falta cardinalidad exacta del vínculo activo");
assert.ok(terminalResolver.includes('"terminal_sesion_ambigua"'), "A02.1: falta fail-closed para múltiples vínculos activos");
assert.ok(terminalResolver.includes('"terminal_sin_sesion_abierta"'), "A02.1: falta fail-closed cuando no existe vínculo activo");
for (const required of [
  '.from("caja_sesiones")',
  '.eq("empresa_id", empresaId)',
  '.eq("local_id", localId)',
  '.eq("id", sessionId)',
  '.eq("estado", "ABIERTA")',
  '.maybeSingle()'
]) {
  assert.ok(terminalResolver.includes(required), `A02.1: validación de caja abierta incompleta: ${required}`);
}



assert.ok(a11.includes("create table private.abc_operating_day_reglas"), "A02.1 P06: falta regla A11 versionada por local");
assert.ok(a11.includes("timezone_name text not null"), "A02.1 P06: falta zona horaria IANA por local");
assert.ok(a11.includes("cutoff_time time without time zone not null"), "A02.1 P06: falta hora de corte configurable");
assert.ok(a11.includes("vigente_desde timestamptz not null"), "A02.1 P06: falta vigencia versionada");
assert.ok(a11.includes("vigente_hasta timestamptz"), "A02.1 P06: falta cierre de vigencia");
assert.ok(a11.includes("abc_resolver_operating_day_contexto"), "A02.1 P06: falta resolver servidor de operating_day");
assert.ok(a11.includes("p_occurred_at at time zone v_rule.timezone_name"), "A02.1 P06: operating_day no usa zona del local");
assert.ok(a11.includes("v_cutoff_instant:=(v_local_date+v_rule.cutoff_time) at time zone v_rule.timezone_name"), "A02.1 P06: falta corte horario autoritativo");
assert.ok(a11.includes("operating_day_configuracion_ausente"), "A02.1 P06: falta fail-closed sin configuración A11");
assert.ok(a11.includes("operating_day_configuracion_ambigua"), "A02.1 P06: falta fail-closed ante reglas solapadas");
assert.ok(a11.includes("create or replace function public.abc_abrir_cuenta"), "A02.1 P06: A03 no consume autoridad A11");
assert.ok(a11.includes("'operating_day',v_operating_day"), "A02.1 P06: resultado servidor no devuelve operating_day");
assert.ok(a11.includes("'cutoff_rule_version'"), "A02.1 P06: falta versión de regla en auditoría/respuesta");
assert.ok(a11.includes("Deliberadamente no se insertan reglas reales"), "A02.1 P06: la migración no deja explícita la ausencia de datos reales");

assert.ok(terminalResolver.length > 0, "A02.1 P06: resolver de terminal no disponible");
const a02Start = recovered.indexOf("async function venderCarritoA02");
const a02End = recovered.indexOf("async function venderCarrito(lineas", a02Start);
const a02Adapter = recovered.slice(a02Start, a02End);
assert.ok(a02Adapter.includes("operatingDay: null"), "A02.1 P06: el cliente sigue fijando un día calendario");
assert.ok(a02Adapter.includes("p_operating_day: null"), "A02.1 P06: abc_abrir_cuenta sigue recibiendo una fecha autoritativa del cliente");
assert.ok(a02Adapter.includes("pending.cuentaResultado?.operating_day"), "A02.1 P06: el cliente no consume el operating_day devuelto por servidor");
assert.ok(a02Adapter.includes("pending.operatingDay = operatingDayServidor"), "A02.1 P06: no se propaga el día servidor a pedido/líneas");
assert.ok(!a02Adapter.includes("operatingDay: todayISO()"), "A02.1 P06: todayISO() sigue siendo autoridad de operating_day");
assert.ok(recovered.includes('msg.includes("operating_day_configuracion_ausente")'), "A02.1 P06: falta mensaje fail-closed sin regla A11");


function firmaA03(fn) {
  const startToken = `create function public.${fn}(`;
  const start = a03.indexOf(startToken);
  assert.ok(start >= 0, `A02.1: no existe firma A03 para ${fn}`);
  const end = a03.indexOf(")\nreturns jsonb", start);
  assert.ok(end > start, `A02.1: firma A03 incompleta para ${fn}`);
  return a03.slice(start + startToken.length, end)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/,$/, "").split(/\s+/)[0]);
}

function parametrosRpcA02(fn) {
  const token = `rpcA02ConRecuperacion(supabase, "${fn}", {`;
  const start = recovered.indexOf(token);
  assert.ok(start >= 0, `A02.1: no existe llamada frontend para ${fn}`);
  const bodyStart = recovered.indexOf("{", start);
  const bodyEnd = recovered.indexOf("}, empresaId, localActivoId", bodyStart);
  assert.ok(bodyEnd > bodyStart, `A02.1: llamada frontend incompleta para ${fn}`);
  return [...recovered.slice(bodyStart + 1, bodyEnd).matchAll(/\b(p_[a-z0-9_]+)\s*:/g)].map((m) => m[1]);
}

for (const fn of ["abc_abrir_cuenta", "abc_crear_pedido", "abc_agregar_linea_pedido"]) {
  assert.deepEqual(
    parametrosRpcA02(fn),
    firmaA03(fn),
    `A02.1: parámetros frontend/A03 no coinciden para ${fn}`
  );
}


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


// P07 — idempotencia formal: IDs estables en cliente + operation_id autoritativo en servidor.
const pendingRead = adapter.indexOf("let pending = leerJsonLocalA02(pendingKey)");
const pendingGuard = adapter.indexOf("if (pending && pending.fingerprint !== fingerprint)");
const pendingCreate = adapter.indexOf("if (!pending) {");
const firstRpc = adapter.indexOf('rpcA02ConRecuperacion(supabase, "abc_abrir_cuenta"');
assert.ok(pendingRead >= 0 && pendingGuard > pendingRead && pendingCreate > pendingGuard, "A02.1 P07: el estado pendiente no se recupera antes de generar IDs");
assert.ok(firstRpc > pendingCreate, "A02.1 P07: se llama al servidor antes de estabilizar el estado pendiente");

const createEnd = adapter.indexOf("\n      if (!pending.cuentaResultado)", pendingCreate);
assert.ok(createEnd > pendingCreate, "A02.1 P07: no se pudo aislar la creación idempotente");
const idCreation = adapter.slice(pendingCreate, createEnd);
assert.ok(idCreation.includes("const cuentaId = uuidA02();"), "A02.1 P07: falta cuenta_id estable");
assert.ok(idCreation.includes("const pedidoId = uuidA02();"), "A02.1 P07: falta pedido_id estable");
assert.ok(idCreation.includes("const lineaId = uuidA02();"), "A02.1 P07: falta linea_id estable");
assert.ok(idCreation.includes("openOperationId: `a02.1.open.${cuentaId}`"), "A02.1 P07: operation_id de cuenta no deriva del ID estable");
assert.ok(idCreation.includes("orderOperationId: `a02.1.order.${pedidoId}`"), "A02.1 P07: operation_id de pedido no deriva del ID estable");
assert.ok(idCreation.includes("operationId: `a02.1.line.${lineaId}`"), "A02.1 P07: operation_id de línea no deriva del ID estable");
assert.equal((adapter.match(/uuidA02\(\)/g) || []).length, 3, "A02.1 P07: se generan IDs nuevos fuera del bloque de creación inicial");

const persistInitial = adapter.indexOf('guardarJsonLocalA02(pendingKey, pending)', pendingCreate);
assert.ok(persistInitial > pendingCreate && persistInitial < firstRpc, "A02.1 P07: los IDs no se persisten antes del primer RPC");

for (const required of [
  "p_operation_id: pending.openOperationId",
  "p_cuenta_id: pending.cuentaId",
  "p_operation_id: pending.orderOperationId",
  "p_pedido_id: pending.pedidoId",
  "p_cuenta_id: pending.cuentaId",
  "p_operation_id: linea.operationId",
  "p_linea_id: linea.lineaId",
  "p_pedido_id: pending.pedidoId"
]) {
  assert.ok(adapter.includes(required), `A02.1 P07: RPC no reutiliza identificador estable: ${required}`);
}
assert.ok(adapter.includes("if (linea.resultado)"), "A02.1 P07: las líneas ya completadas no se saltan en replay");
assert.ok(adapter.includes("if (!pending.cuentaResultado)"), "A02.1 P07: la cuenta completada puede repetirse");
assert.ok(adapter.includes("if (!pending.pedidoResultado)"), "A02.1 P07: el pedido completado puede repetirse");

const finalPersist = adapter.lastIndexOf("guardarJsonLocalA02(claveUltimaCuentaA02");
const pendingRemove = adapter.indexOf("localStorage.removeItem(pendingKey)", finalPersist);
assert.ok(finalPersist >= 0 && pendingRemove > finalPersist, "A02.1 P07: se borra el estado pendiente antes de persistir el resultado final");

assert.ok(m01.includes("operation_id text primary key"), "A02.1 P07: operation_id no es único en abc_operaciones");
assert.ok(m03a.includes("pg_catalog.pg_advisory_xact_lock"), "A02.1 P07: falta exclusión concurrente por operation_id");
assert.ok(m03a.includes("v_hash:=private.abc_request_hash(v_request)"), "A02.1 P07: falta hash estable del request");
assert.ok(m03a.includes("where operation_id=p_operation_id"), "A02.1 P07: replay no busca por operation_id");
assert.ok(m03a.includes("raise exception 'operation_id_conflict'"), "A02.1 P07: reutilizar operation_id con request distinto no falla cerrado");
assert.ok(m03a.includes("'replayed',true"), "A02.1 P07: servidor no identifica replay");
assert.ok(m03a.includes("'resultado',v_existente.resultado"), "A02.1 P07: replay no devuelve el resultado original");

for (const fn of ["abc_abrir_cuenta", "abc_crear_pedido", "abc_agregar_linea_pedido"]) {
  const fnStart = a03.indexOf(`create function public.${fn}(`);
  assert.ok(fnStart >= 0, `A02.1 P07: no existe ${fn}`);
  const fnEnd = a03.indexOf("\ncreate function ", fnStart + 1);
  const fnBody = a03.slice(fnStart, fnEnd > fnStart ? fnEnd : a03.length);
  assert.ok(fnBody.includes("private.abc_operacion_iniciar("), `A02.1 P07: ${fn} no entra por la barrera idempotente`);
  assert.ok(fnBody.includes("if (v_cmd->>'replayed')::boolean then"), `A02.1 P07: ${fn} no corta la escritura en replay`);
  assert.ok(fnBody.includes("private.abc_operacion_completar(p_operation_id,v_result)"), `A02.1 P07: ${fn} no persiste resultado idempotente`);
}

console.log("A02_1_IDEMPOTENCY_STABLE_IDS=PASS");
console.log("A02_1_CONTRACT=PASS");
console.log("A02_1_PRIMARY_PATH=A03");
console.log("A02_1_PAYMENT_WRITES=0");
console.log("A02_1_LEGACY_PM09_PRIMARY=0");
