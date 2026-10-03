// Trigger A02.1 isolated workflow after workflow installation.
import fs from "node:fs";
import assert from "node:assert/strict";

const readText = (path) => fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");

const recovered = readText("source-recovery/fuente-recuperado.js");
const runtime = readText("fuente.js");
const a03 = readText("supabase/migrations/20260924010000_abc_f3_a03_server_authority.sql");
const a04 = readText("supabase/migrations/20260924020000_abc_f3_a04_variants_modifiers.sql");
const a06 = readText("supabase/migrations/20260924040000_abc_f3_a06_account_recovery.sql");
const m01 = readText("supabase/migrations/20260923210000_abc_f2_m01_base_transaccional_caja.sql");
const m03a = readText("supabase/migrations/20260923233000_abc_f2_m03a_autoridad_transaccional.sql");
const m04a = readText("supabase/migrations/20260924001000_abc_f2_m04a_caja_sesiones.sql");
const a11 = readText("supabase/migrations/20260926203000_abc_f3_a02_operating_day_a11.sql");

const headerLines = 14;
const recoveredBody = recovered.split("\n").slice(headerLines).join("\n");
assert.ok(runtime.endsWith(recoveredBody), "A02.1: runtime y fuente recuperada perdieron paridad de cuerpo");

assert.ok(recovered.includes("A02.1 UI -> A03 server authority"), "A02.1: falta marcador del adaptador");
assert.ok(recovered.includes("venderCarrito: venderCarritoA02"), "A02.1: VentaRapida no usa el adaptador A03");
assert.ok(recovered.includes('rpcA02ConRecuperacion(supabase, "abc_abrir_cuenta"'), "A02.1: falta abc_abrir_cuenta mediante el wrapper idempotente");
assert.ok(recovered.includes('rpcA02ConRecuperacion(supabase, "abc_crear_pedido"'), "A02.1: falta abc_crear_pedido mediante el wrapper idempotente");
assert.ok(recovered.includes('rpcA02ConRecuperacion(supabase, "abc_agregar_linea_pedido"'), "A02.1: falta abc_agregar_linea_pedido mediante el wrapper idempotente");
assert.ok(recovered.includes('"abc_consultar_operacion"'), "A02.1: falta recuperación de operation_id");
assert.ok(recovered.includes('rpcA02ConRecuperacion(supabase, "abc_agregar_linea_pedido_configurada"'), "A04.2: falta ruta configurada A04");
assert.ok(recovered.includes('from("catalogo_tpv_producto_grupos")'), "A04.2: UI no consulta asignaciones producto/grupo");
assert.ok(recovered.includes('from("catalogo_tpv_grupos_opciones")'), "A04.2: UI no consulta grupos de opciones");
assert.ok(recovered.includes('from("catalogo_tpv_opciones")'), "A04.2: UI no consulta opciones configurables");
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
const a02EndA05 = recovered.indexOf("async function enviarPedidoA05()", a02Start);
const a02End = a02EndA05 > a02Start ? a02EndA05 : recovered.indexOf("async function venderCarrito(lineas", a02Start);
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
const endA05 = recovered.indexOf("async function enviarPedidoA05()", start);
const end = endA05 > start ? endA05 : recovered.indexOf("async function venderCarrito(lineas", start);
assert.ok(start >= 0 && end > start, "A02.1: no se pudo aislar el adaptador");
const adapter = recovered.slice(start, end);

const forbiddenPrimaryA02 = [
  "registrar_venta_stock_carrito_pm09",
  "venderLocal(",
  "abc_iniciar_checkout",
  "abc_confirmar_pago",
  "abc_emitir",
  "checkout_ventas"
];

// Pieza 6e (D02, 2/10/2026): la modalidad ya no es una constante «BARRA». La decide resolverModalidadAperturaA02 al crear el registro
// pendiente: la que elige el cajero y, si no elige, BARRA cuando el local la tiene habilitada (y, si no, la primera habilitada).
// Si no se puede leer la lista de modalidades, se mantiene el comportamiento anterior: BARRA.
assert.ok(adapter.includes("modalidad: modalidadApertura,"), "A02.1: el registro pendiente debe llevar la modalidad decidida al crearlo");
assert.ok(adapter.includes("resolverModalidadAperturaA02(supabase, empresaId, localActivoId, opciones?.modalidad)"), "A02.1: la modalidad se decide con resolverModalidadAperturaA02");
assert.ok(recovered.includes('if (!habilitadas) return pedida || "BARRA";'), "A02.1: sin lista de modalidades, VentaRapida abre en BARRA como antes");
assert.ok(recovered.includes('return habilitadas.includes("BARRA") ? "BARRA" : habilitadas[0];'), "A02.1: por defecto BARRA cuando está habilitada");
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

const finalPersist = adapter.lastIndexOf("guardarContextoCuentaA02(empresaId, localActivoId");
const pendingRemove = adapter.indexOf("localStorage.removeItem(pendingKey)", finalPersist);
assert.ok(finalPersist >= 0 && pendingRemove > finalPersist, "A02.1 P07: se borra el estado pendiente antes de persistir y releer el resultado final");

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


// P08 — recuperación formal tras timeout mediante abc_consultar_operacion.
assert.ok(a06.includes("create function public.abc_consultar_operacion("), "A02.1 P08: falta RPC de consulta de operación");
assert.ok(a06.includes("not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR')"), "A02.1 P08: consulta sin capacidad ABC_CUENTA_OPERAR");
assert.ok(a06.includes("and empresa_id=p_empresa_id"), "A02.1 P08: consulta no acota empresa");
assert.ok(a06.includes("and local_id=p_local_id"), "A02.1 P08: consulta no acota local");
assert.ok(a06.includes("and executor_kind='USER'"), "A02.1 P08: consulta no restringe operaciones de usuario");
assert.ok(a06.includes("and actor_user_id=auth.uid()"), "A02.1 P08: consulta puede exponer operación de otro usuario");
assert.ok(a06.includes("'status',v_row.status"), "A02.1 P08: consulta no devuelve estado");
assert.ok(a06.includes("'resultado',v_row.resultado"), "A02.1 P08: consulta no devuelve resultado");
assert.ok(a06.includes("'error',v_row.error"), "A02.1 P08: consulta no devuelve error");
assert.ok(a06.includes("grant execute on function public.abc_consultar_operacion("), "A02.1 P08: consulta no está expuesta al rol autenticado controlado");

assert.ok(recoveryAdapter.includes('supabase.rpc("abc_consultar_operacion"'), "A02.1 P08: timeout no consulta estado servidor");
assert.ok(recoveryAdapter.includes("p_operation_id: operationId"), "A02.1 P08: consulta usa otro operation_id");
assert.ok(recoveryAdapter.includes('estado === "COMPLETADA"'), "A02.1 P08: falta recuperación de COMPLETADA");
assert.ok(recoveryAdapter.includes("return estado.resultado"), "A02.1 P08: no reutiliza resultado ya completado");
assert.ok(recoveryAdapter.includes('estado === "PROCESANDO"'), "A02.1 P08: falta tratamiento PROCESANDO");
assert.ok(recoveryAdapter.includes('throw new Error("operacion_a02_en_curso")'), "A02.1 P08: PROCESANDO no falla cerrado");
assert.ok(recoveryAdapter.includes('estado === "FALLIDA"'), "A02.1 P08: falta tratamiento FALLIDA");
assert.ok(recoveryAdapter.includes('throw new Error("operacion_a02_fallida")'), "A02.1 P08: FALLIDA podría reintentarse");
assert.ok(recoveryAdapter.includes("recuperarTrasTimeout(true)"), "A02.1 P08: primer timeout no entra al flujo formal");
assert.ok(recoveryAdapter.includes("return recuperarTrasTimeout(false)"), "A02.1 P08: segundo timeout no reconsulta estado");
assert.ok(recoveryAdapter.includes("if (!estado.encontrada && permiteReintentoSeguro)"), "A02.1 P08: no limita el reintento al caso no encontrado");
assert.equal((recoveryAdapter.match(/return await ejecutar\(6500\)/g) || []).length, 2, "A02.1 P08: debe existir solo ejecución inicial + un reintento seguro");
assert.ok(recovered.includes('msg.includes("operacion_a02_fallida")'), "A02.1 P08: falta mensaje de operación FALLIDA");
assert.ok(recovered.includes('msg.includes("operacion_a02_estado_desconocido")'), "A02.1 P08: falta fail-closed de estado desconocido");


// P09 — optimistic locking y propagación estricta de versiones.
assert.ok(recovered.includes("function versionServidorA02(valor, campo)"), "A02.1 P09: falta validador estricto de versiones");
assert.ok(recovered.includes("Number.isSafeInteger(version)"), "A02.1 P09: versiones no se validan como enteros seguros");
assert.ok(recovered.includes('throw new Error(`version_servidor_invalida:${campo}`)'), "A02.1 P09: versión inválida no falla cerrado");

assert.ok(adapter.includes('p_expected_cuenta_version: versionServidorA02(pending.cuentaResultado?.version, "cuenta.version")'), "A02.1 P09: crear pedido no propaga versión autoritativa de cuenta");
assert.ok(adapter.includes('let pedidoVersion = versionServidorA02(pending.pedidoResultado?.version, "pedido.version")'), "A02.1 P09: cadena de líneas no inicia con versión autoritativa del pedido");
assert.ok(adapter.includes('pedidoVersion = versionServidorA02(linea.resultado?.pedido_version, "linea.pedido_version")'), "A02.1 P09: línea nueva no propaga pedido_version devuelto");
assert.ok(adapter.includes('pedidoVersion = versionServidorA02(linea.resultado.pedido_version, "linea.pedido_version")'), "A02.1 P09: replay de línea no reconstruye pedido_version desde resultado persistido");
assert.ok(adapter.includes('cuentaVersion: versionServidorA02(pending.pedidoResultado?.cuenta_version, "pedido.cuenta_version")'), "A02.1 P09: resultado agregado no conserva cuenta_version autoritativa");
assert.ok(adapter.includes('lineaVersion: versionServidorA02(l22.resultado?.linea_version, "linea.linea_version")'), "A02.1 P09: resultado agregado no conserva linea_version autoritativa");
assert.ok(!adapter.includes("Number(pending.cuentaResultado?.version) || 1"), "A02.1 P09: fallback local oculta cuenta.version inválida");
assert.ok(!adapter.includes("Number(pending.pedidoResultado?.version) || 1"), "A02.1 P09: fallback local oculta pedido.version inválida");
assert.ok(!adapter.includes("Number(linea.resultado?.pedido_version) || pedidoVersion"), "A02.1 P09: fallback local oculta pedido_version inválida");
assert.ok(!adapter.includes("Number(l22.resultado?.linea_version) || 1"), "A02.1 P09: fallback local oculta linea_version inválida");
assert.ok(recovered.includes('msg.includes("linea_version_conflict")'), "A02.1 P09: falta tratamiento de conflicto de versión de línea");
assert.ok(recovered.includes('msg.includes("version_servidor_invalida")'), "A02.1 P09: falta mensaje fail-closed de versión inválida");

function cuerpoFuncionA03(nombre, siguiente) {
  const inicio = a03.indexOf(`create function public.${nombre}(`);
  assert.ok(inicio >= 0, `A02.1 P09: falta ${nombre}`);
  const fin = siguiente ? a03.indexOf(`create function public.${siguiente}(`, inicio + 1) : a03.indexOf("\nrevoke all on", inicio + 1);
  return a03.slice(inicio, fin > inicio ? fin : a03.length);
}

const crearPedidoP09 = cuerpoFuncionA03("abc_crear_pedido", "abc_agregar_linea_pedido");
assert.ok(crearPedidoP09.includes("for update;"), "A02.1 P09: crear pedido no bloquea cuenta antes de comparar versión");
assert.ok(crearPedidoP09.includes("v_cuenta.version<>p_expected_cuenta_version"), "A02.1 P09: crear pedido no verifica expected cuenta version");
assert.ok(crearPedidoP09.includes("raise exception 'cuenta_version_conflict'"), "A02.1 P09: conflicto de cuenta no falla cerrado");
assert.ok(crearPedidoP09.includes("set version=version+1"), "A02.1 P09: crear pedido no incrementa cuenta version");
assert.ok(crearPedidoP09.includes("'cuenta_version',v_new_cuenta_version"), "A02.1 P09: crear pedido no devuelve nueva cuenta version");
assert.ok(crearPedidoP09.includes("'version',1"), "A02.1 P09: crear pedido no devuelve versión inicial del pedido");

const agregarLineaP09 = cuerpoFuncionA03("abc_agregar_linea_pedido", "abc_actualizar_linea_pedido");
assert.ok(agregarLineaP09.includes("for update;"), "A02.1 P09: agregar línea no bloquea pedido");
assert.ok(agregarLineaP09.includes("v_pedido.version<>p_expected_pedido_version"), "A02.1 P09: agregar línea no verifica expected pedido version");
assert.ok(agregarLineaP09.includes("raise exception 'pedido_version_conflict'"), "A02.1 P09: conflicto de pedido no falla cerrado");
assert.ok(agregarLineaP09.includes("set estado=case when estado='BORRADOR' then 'ABIERTO' else estado end,\n         version=version+1"), "A02.1 P09: agregar línea no incrementa pedido version");
assert.ok(agregarLineaP09.includes("'pedido_version',v_new_pedido_version"), "A02.1 P09: agregar línea no devuelve nueva pedido version");
assert.ok(agregarLineaP09.includes("'linea_version',1"), "A02.1 P09: agregar línea no devuelve versión inicial de línea");

for (const [nombre,siguiente] of [
  ["abc_actualizar_linea_pedido","abc_confirmar_linea_pedido"],
  ["abc_confirmar_linea_pedido",null]
]) {
  const cuerpo = cuerpoFuncionA03(nombre,siguiente);
  assert.ok((cuerpo.match(/for update;/g) || []).length >= 2, `A02.1 P09: ${nombre} no bloquea pedido y línea`);
  assert.ok(cuerpo.includes("v_pedido.version<>p_expected_pedido_version"), `A02.1 P09: ${nombre} no verifica versión de pedido`);
  assert.ok(cuerpo.includes("v_linea.version<>p_expected_linea_version"), `A02.1 P09: ${nombre} no verifica versión de línea`);
  assert.ok(cuerpo.includes("raise exception 'pedido_version_conflict'"), `A02.1 P09: ${nombre} no falla ante pedido obsoleto`);
  assert.ok(cuerpo.includes("raise exception 'linea_version_conflict'"), `A02.1 P09: ${nombre} no falla ante línea obsoleta`);
  assert.ok(cuerpo.includes("returning version into v_new_linea_version"), `A02.1 P09: ${nombre} no devuelve nueva versión de línea`);
  assert.ok(cuerpo.includes("returning version into v_new_pedido_version"), `A02.1 P09: ${nombre} no devuelve nueva versión de pedido`);
}


// P10 — autoridad económica exclusiva del servidor.
const calcStart = a03.indexOf("create function private.abc_calcular_linea_tpv(");
const calcEnd = a03.indexOf("create function public.abc_abrir_cuenta(", calcStart);
assert.ok(calcStart >= 0 && calcEnd > calcStart, "A02.1 P10: no se pudo aislar el cálculo económico servidor");
const calcEconomico = a03.slice(calcStart, calcEnd);

for (const required of [
  "from public.catalogo_tpv_productos c",
  "join public.entidad_fiscal_local_monedas elm",
  "join public.entidades_fiscales ef",
  "and c.activo=true",
  "and elm.activa=true",
  "and ef.activa=true",
  "v_bruto:=round(v_cantidad*v_catalog.precio_unitario,8)",
  "v_base:=(v_bruto-v_descuento)::numeric(24,8)",
  "v_impuestos:=round(v_base*v_catalog.impuesto_pct/100,8)",
  "v_total:=round(v_base+v_impuestos,8)",
  "'precio_unitario',v_catalog.precio_unitario",
  "'impuesto_pct',v_catalog.impuesto_pct",
  "'base',v_base",
  "'impuestos',v_impuestos",
  "'total',v_total",
  "'modo','SERVER_AUTHORITY_A03'"
]) {
  assert.ok(calcEconomico.includes(required), `A02.1 P10: falta autoridad económica servidor: ${required}`);
}

const agregarLineaP10 = cuerpoFuncionA03("abc_agregar_linea_pedido", "abc_actualizar_linea_pedido");
assert.ok(agregarLineaP10.includes("v_calc:=private.abc_calcular_linea_tpv("), "A02.1 P10: agregar línea no delega cálculo económico al servidor");
for (const forbiddenParam of [
  "p_precio_unitario",
  "p_precio",
  "p_impuesto_pct",
  "p_iva",
  "p_base",
  "p_impuestos",
  "p_total",
  "p_descuento_total"
]) {
  assert.ok(!agregarLineaP10.includes(forbiddenParam), `A02.1 P10: RPC acepta autoridad económica del cliente: ${forbiddenParam}`);
}
for (const persisted of [
  "(v_calc->>'precio_unitario')::numeric",
  "(v_calc->>'descuento_total')::numeric",
  "(v_calc->>'base')::numeric",
  "(v_calc->>'impuestos')::numeric",
  "(v_calc->>'total')::numeric",
  "v_calc->'snapshot_comercial'",
  "v_calc->'snapshot_calculo'"
]) {
  assert.ok(agregarLineaP10.includes(persisted), `A02.1 P10: línea no persiste valor/snapshot calculado por servidor: ${persisted}`);
}

const rpcLineaStart = adapter.indexOf('rpcA02ConRecuperacion(supabase, "abc_agregar_linea_pedido"');
const rpcLineaEnd = adapter.indexOf("}, empresaId, localActivoId, linea.operationId)", rpcLineaStart);
assert.ok(rpcLineaStart >= 0 && rpcLineaEnd > rpcLineaStart, "A02.1 P10: no se pudo aislar RPC de línea");
const rpcLineaCliente = adapter.slice(rpcLineaStart, rpcLineaEnd);
for (const required of ["p_producto_id: linea.productoId", "p_cantidad: linea.cantidad"]) {
  assert.ok(rpcLineaCliente.includes(required), `A02.1 P10: falta dato comercial permitido: ${required}`);
}
for (const forbidden of [
  "p_precio",
  "p_impuesto",
  "p_iva",
  "p_base",
  "p_total",
  "p_descuento",
  "precioNeto(",
  "ivaDe(",
  "costoUnitario",
  "ingresoUnitario",
  "ivaVentaAplicado"
]) {
  assert.ok(!rpcLineaCliente.includes(forbidden), `A02.1 P10: cliente intenta imponer cálculo económico: ${forbidden}`);
}

assert.ok(recovered.includes("function importeServidorA02(valor, campo)"), "A02.1 P10: falta validador de importes del servidor");
assert.ok(recovered.includes("Number.isFinite(importe)"), "A02.1 P10: importe servidor no se valida como finito");
assert.ok(recovered.includes("importe < 0"), "A02.1 P10: importe servidor negativo no falla cerrado");
assert.ok(adapter.includes('importeServidorA02(l22.resultado?.total, "linea.total")'), "A02.1 P10: total UI no proviene estrictamente del resultado servidor");
assert.ok(!adapter.includes("Number(l22.resultado?.total) || 0"), "A02.1 P10: fallback 0 puede ocultar respuesta económica inválida");
assert.ok(!adapter.includes("precioNeto("), "A02.1 P10: adaptador A02 calcula precio local");
assert.ok(!adapter.includes("ivaDe("), "A02.1 P10: adaptador A02 calcula IVA local");
assert.ok(recovered.includes('msg.includes("importe_servidor_invalido")'), "A02.1 P10: falta fail-closed ante importe servidor inválido");

assert.ok(a03.includes("revoke all on table public.catalogo_tpv_productos"), "A02.1 P10: catálogo económico no revoca DML genérico");
assert.ok(a03.includes("grant select on table public.catalogo_tpv_productos to authenticated"), "A02.1 P10: frontend no tiene contrato de solo lectura sobre catálogo");
assert.ok(!a03.includes("grant insert on table public.catalogo_tpv_productos to authenticated"), "A02.1 P10: frontend autenticado puede insertar precios");
assert.ok(!a03.includes("grant update on table public.catalogo_tpv_productos to authenticated"), "A02.1 P10: frontend autenticado puede modificar precios");


// P11 — ciclo completo de persistencia cuenta/pedido en dispositivo.
assert.ok(recovered.includes('la_suite_a02_1_ultima_cuenta_v1:${empresaId}:${localId}'), "A02.1 P11: contexto final no está aislado por empresa/local");
assert.ok(recovered.includes("function validarContextoCuentaA02(contexto, empresaId, localId)"), "A02.1 P11: falta validación estructural del contexto persistido");
assert.ok(recovered.includes("function leerContextoCuentaA02(empresaId, localId)"), "A02.1 P11: falta ruta de lectura del contexto persistido");
assert.ok(recovered.includes("function guardarContextoCuentaA02(empresaId, localId, contexto)"), "A02.1 P11: falta ruta de escritura + readback del contexto persistido");
assert.ok(recovered.includes("const releido = leerContextoCuentaA02(empresaId, localId);"), "A02.1 P11: contexto no se relee después de guardar");
assert.ok(recovered.includes('throw new Error("persistencia_contexto_cuenta_no_disponible")'), "A02.1 P11: almacenamiento final no falla cerrado");
assert.ok(recovered.includes('throw new Error("contexto_cuenta_persistido_invalido")'), "A02.1 P11: contexto final inválido no falla cerrado");

for (const required of [
  "contexto.schemaVersion !== 1",
  "contexto.empresaId !== empresaId || contexto.localId !== localId",
  "uuidPersistidoA02(contexto.cuentaId)",
  "uuidPersistidoA02(contexto.pedidoId)",
  'versionServidorA02(contexto.cuentaVersion, "contexto.cuenta_version")',
  'versionServidorA02(contexto.pedidoVersion, "contexto.pedido_version")',
  "uuidPersistidoA02(contexto.terminalId)",
  "uuidPersistidoA02(contexto.sessionId)",
  "contexto.operatingDay",
  "contexto.currencyCode",
  "Array.isArray(contexto.lineas)",
  'versionServidorA02(linea.lineaVersion, "contexto.linea_version")',
  'importeServidorA02(linea.total, "contexto.linea_total")'
]) {
  assert.ok(recovered.includes(required), `A02.1 P11: falta validar campo persistido: ${required}`);
}

const contextoFinalStart = adapter.indexOf("const agregado = guardarContextoCuentaA02(");
assert.ok(contextoFinalStart >= 0, "A02.1 P11: resultado final no usa persistencia validada");
const removePendingP11 = adapter.indexOf("localStorage.removeItem(pendingKey)", contextoFinalStart);
assert.ok(removePendingP11 > contextoFinalStart, "A02.1 P11: estado pendiente se elimina antes de persistir contexto final");
const contextoFinal = adapter.slice(contextoFinalStart, removePendingP11);
for (const required of [
  "schemaVersion: 1",
  "empresaId",
  "localId: localActivoId",
  "cuentaId: pending.cuentaId",
  "cuentaVersion:",
  "pedidoId: pending.pedidoId",
  "pedidoVersion",
  "lineas: pending.lineas.map",
  "terminalId: contexto.terminalId",
  "sessionId: contexto.sessionId",
  "operatingDay: pending.operatingDay",
  "currencyCode: pending.currencyCode"
]) {
  assert.ok(contextoFinal.includes(required), `A02.1 P11: contexto final incompleto: ${required}`);
}

assert.ok(!adapter.includes("leerContextoCuentaA02("), "A02.1 P11: una venta nueva no debe reutilizar automáticamente el último pedido completado");

assert.ok(recovered.includes('throw new Error("persistencia_idempotencia_no_disponible")'), "A02.1 P11: fallo de lectura del pendiente no se bloquea");
assert.ok(recovered.includes('throw new Error("persistencia_idempotencia_corrupta")'), "A02.1 P11: JSON pendiente corrupto puede crear IDs nuevos");
assert.ok(recovered.includes('msg.includes("persistencia_idempotencia_corrupta")'), "A02.1 P11: falta mensaje de pendiente corrupto");
assert.ok(recovered.includes('msg.includes("persistencia_contexto_cuenta_no_disponible")'), "A02.1 P11: falta mensaje de persistencia final");
assert.ok(recovered.includes('msg.includes("contexto_cuenta_persistido_invalido")'), "A02.1 P11: falta mensaje de contexto final inválido");


// P12 — Guardar pedido termina en A03 sin iniciar cobro.
const guardarPedidoStart = recovered.indexOf("async function confirmarCobro()");
const guardarPedidoEnd = recovered.indexOf("\n  return /* @__PURE__ */", guardarPedidoStart);
assert.ok(guardarPedidoStart >= 0 && guardarPedidoEnd > guardarPedidoStart, "A02.1 P12: no se pudo aislar el handler de Guardar pedido");
const guardarPedidoHandler = recovered.slice(guardarPedidoStart, guardarPedidoEnd);

assert.ok(
  recovered.includes("lineasCarrito.length > 0 && /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: confirmarCobro, disabled: enviandoVenta || cargandoA04 }"),
  "A02.1 P12: el CTA visible no guarda el pedido directamente"
);
assert.ok(recovered.includes("Guardar pedido"), "A02.1 P12: falta el CTA Guardar pedido");
assert.ok(recovered.includes("Guardando pedido"), "A02.1 P12: falta estado de guardado del pedido");
assert.ok(recovered.includes("false && showCobro"), "A02.1 P12: el modal heredado de cobro volvió a estar activo");
assert.ok(
  !recovered.includes('import_react4.default.createElement(Btn, { onClick: abrirCobro }, "Cobrar'),
  "A02.1 P12: el CTA visible volvió a abrir cobro"
);

assert.ok(guardarPedidoHandler.includes("await venderCarrito("), "A02.1 P12: Guardar pedido no delega en el adaptador A02/A03");
for (const forbidden of [
  "medioPago",
  "detallePago",
  "importeTarjetaMixto",
  "restoEfectivoMixto",
  "abc_iniciar_checkout",
  "abc_confirmar_pago",
  "abc_emitir",
  "registrar_venta_stock_carrito_pm09",
  "venderLocal("
]) {
  assert.ok(!guardarPedidoHandler.includes(forbidden), `A02.1 P12: Guardar pedido inicia lógica fuera de alcance: ${forbidden}`);
}

assert.ok(
  adapter.includes("const agregado = guardarContextoCuentaA02(") &&
  adapter.includes("localStorage.removeItem(pendingKey)") &&
  adapter.includes('modo: pending.lineas.some((l22) => !!l22.configuracionA04) ? "a02-a03-a04-pedido" : "a02-a03-pedido"'),
  "A02.1 P12: el camino de Guardar pedido no termina tras persistir el contexto A03"
);

// P13 — guardas explícitas de fuera de alcance del camino primario A02.1.
for (const forbidden of forbiddenPrimaryA02) {
  assert.ok(!adapter.includes(forbidden), `A02.1 P13: escritura fuera de alcance detectada: ${forbidden}`);
}
assert.ok(!guardarPedidoHandler.includes("setShowCobro(true)"), "A02.1 P13: Guardar pedido vuelve a abrir el flujo de cobro");


// P14 — contrato A02.1 consolidado P1–P13 con allowlist del camino primario.
const rpcPrimariosA02 = [...adapter.matchAll(/rpcA02ConRecuperacion\(supabase, "([^"]+)"/g)].map((m) => m[1]);
assert.deepEqual(
  rpcPrimariosA02,
  ["abc_abrir_cuenta", "abc_crear_pedido", "abc_agregar_linea_pedido", "abc_agregar_linea_pedido_configurada"],
  "A02.1/A04.2 P14: el adaptador contiene RPCs adicionales, ausentes o fuera de orden"
);

const abrirCuentaP14 = adapter.indexOf('"abc_abrir_cuenta"');
const crearPedidoP14 = adapter.indexOf('"abc_crear_pedido"');
const agregarLineaP14 = adapter.indexOf('"abc_agregar_linea_pedido"');
const agregarLineaConfiguradaP14 = adapter.indexOf('"abc_agregar_linea_pedido_configurada"');
assert.ok(
  abrirCuentaP14 >= 0 && crearPedidoP14 > abrirCuentaP14 && agregarLineaP14 > crearPedidoP14 && agregarLineaConfiguradaP14 > agregarLineaP14,
  "A02.1/A04.2 P14: secuencia A03/A04 inválida"
);

assert.equal(
  (guardarPedidoHandler.match(/await venderCarrito\(/g) || []).length,
  1,
  "A02.1 P14: Guardar pedido debe tener una única delegación al adaptador primario"
);

const rpcA04Start = adapter.indexOf('rpcA02ConRecuperacion(supabase, "abc_agregar_linea_pedido_configurada"');
const rpcA04End = adapter.indexOf("}, empresaId, localActivoId, linea.operationId)", rpcA04Start);
assert.ok(rpcA04Start >= 0 && rpcA04End > rpcA04Start, "A04.2: no se pudo aislar RPC configurada");
const rpcA04Cliente = adapter.slice(rpcA04Start, rpcA04End);
for (const required of [
  "p_expected_product_version: linea.configuracionA04.expectedProductVersion",
  "p_selecciones: linea.configuracionA04.selecciones",
  "p_expected_pedido_version: pedidoVersion"
]) {
  assert.ok(rpcA04Cliente.includes(required), `A04.2: RPC configurada incompleta: ${required}`);
}
for (const forbidden of ["p_precio", "p_impuesto", "p_iva", "p_base", "p_total", "p_descuento"]) {
  assert.ok(!rpcA04Cliente.includes(forbidden), `A04.2: cliente intenta imponer economía: ${forbidden}`);
}
assert.ok(a04.includes("create function public.abc_agregar_linea_pedido_configurada("), "A04.2: backend A04 no versionado");
assert.ok(a04.includes("p_expected_product_version bigint"), "A04.2: backend no exige versión de producto");
assert.ok(a04.includes("p_selecciones jsonb"), "A04.2: backend no recibe selecciones estructuradas");
assert.ok(recovered.includes("function renderConfiguradorA04()"), "A04.2: falta configurador visible");
assert.ok(recovered.includes("grupo.minSelecciones"), "A04.2: UI no valida mínimos");
assert.ok(recovered.includes("grupo.maxSelecciones"), "A04.2: UI no valida máximos");
assert.ok(recovered.includes("opcion.maxCantidad"), "A04.2: UI no respeta máximo por opción");
assert.ok(recovered.includes("precio e IVA definitivos se recalculan y validan en el servidor"), "A04.2: UI no deja clara autoridad económica");
assert.ok(recovered.includes("configuracionA04: l22.configuracionA04 || null"), "A04.2: carrito no entrega configuración al adaptador");
assert.ok(recovered.includes("configuradaA04: !!l22.configuracionA04"), "A04.2: contexto final no identifica línea configurada");
assert.ok(recovered.includes('modo: pending.lineas.some((l22) => !!l22.configuracionA04) ? "a02-a03-a04-pedido"'), "A04.2: resultado no distingue uso A04");
console.log("A04_2_UI_INTEGRATION=PASS");

console.log("A02_1_OUT_OF_SCOPE_GUARDS=PASS");
console.log("A02_1_P1_P13_CONSOLIDATED=PASS");

console.log("A02_1_SAVE_ORDER_NO_PAYMENT=PASS");

console.log("A02_1_DEVICE_CONTEXT_PERSISTENCE=PASS");
console.log("A02_1_SERVER_ECONOMIC_AUTHORITY=PASS");
console.log("A02_1_OPTIMISTIC_LOCKING=PASS");
console.log("A02_1_TIMEOUT_RECOVERY=PASS");
console.log("A02_1_IDEMPOTENCY_STABLE_IDS=PASS");
console.log("A02_1_CONTRACT=PASS");
console.log("A02_1_PRIMARY_PATH=A03");
console.log("A02_1_PAYMENT_WRITES=0");
console.log("A02_1_LEGACY_PM09_PRIMARY=0");
