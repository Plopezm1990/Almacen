import fs from "node:fs";
import assert from "node:assert/strict";

const src = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");
const a06 = fs.readFileSync("supabase/migrations/20260924040000_abc_f3_a06_account_recovery.sql", "utf8");
const a07 = fs.readFileSync("supabase/migrations/20260924050000_abc_f3_a07_tables_zones.sql", "utf8");
const a072 = fs.readFileSync("supabase/migrations/20260927150500_abc_f3_a07_2_list_responsables.sql", "utf8");

// Backend A07.2 primitives.
for (const required of [
  "create function public.abc_mover_cuenta_mesa(",
  "CUENTA_MESA_MOVIDA",
  "mesa_origen_version_conflict",
  "mesa_destino_version_conflict",
  "mesa_destino_no_asignable",
  "create function public.abc_cambiar_responsable_cuenta(",
  "CUENTA_RESPONSABLE_CAMBIADO",
  "nuevo_responsable_no_pertenece_local",
  "responsable_sin_cambio"
]) {
  assert.ok((a07 + a06).includes(required), `A07.2 backend incompleto: ${required}`);
}

// New read RPC: only authorized reassignment roles can list eligible users.
for (const required of [
  "create or replace function public.abc_listar_responsables_cuenta(",
  "ABC_CUENTA_REASIGNAR",
  "private.abc_terminal_sesion_operativa",
  "m.empresa_id=p_empresa_id",
  "(m.todos_locales=false and m.local_id=p_local_id)",
  "(m.todos_locales=true and m.local_id is null)",
  "'responsables',v_responsables",
  "grant execute on function public.abc_listar_responsables_cuenta("
]) {
  assert.ok(a072.includes(required), `A07.2 RPC responsables incompleta: ${required}`);
}
for (const forbidden of [
  "insert into",
  "update public.",
  "delete from"
]) {
  assert.ok(!a072.toLowerCase().includes(forbidden), `A07.2 listado de responsables no debe escribir: ${forbidden}`);
}

// Moving tables must not mutate economic/order data.
const moveIni = a07.indexOf("create function public.abc_mover_cuenta_mesa(");
const moveFin = a07.indexOf("\ncreate function public.abc_liberar_cuenta_mesa(", moveIni);
assert.ok(moveIni >= 0 && moveFin > moveIni, "A07.2 move function not found");
const move = a07.slice(moveIni, moveFin);
for (const forbidden of [
  "update public.pedidos_tpv",
  "update public.pedido_lineas",
  "update public.pagos",
  "update public.checkouts",
  "update public.reembolsos",
  "delete from public.pedidos_tpv",
  "delete from public.pedido_lineas",
  "delete from public.pagos"
]) {
  assert.ok(!move.includes(forbidden), `A07.2 traslado altera datos económicos/pedido: ${forbidden}`);
}
for (const required of [
  "update public.cuenta_mesa_asignaciones set hasta=now()",
  "insert into public.cuenta_mesa_asignaciones(",
  "update public.tpv_mesas set version=version+1",
  "update public.cuentas_comerciales set modalidad=v_modalidad,version=version+1",
  "'CUENTA_MESA_MOVIDA'"
]) {
  assert.ok(move.includes(required), `A07.2 traslado sin historial/versiones: ${required}`);
}

// Reassignment changes only account responsibility/version + audit event.
const respIni = a06.indexOf("create function public.abc_cambiar_responsable_cuenta(");
const respFin = a06.indexOf("\nrevoke all on function private.abc_ultima_actividad_cuenta", respIni);
assert.ok(respIni >= 0 && respFin > respIni, "A07.2 responsible function not found");
const resp = a06.slice(respIni, respFin);
assert.ok(resp.includes("set responsable_actual=p_nuevo_responsable"));
assert.ok(resp.includes("'CUENTA_RESPONSABLE_CAMBIADO'"));
for (const forbidden of ["pedido_lineas", "pedidos_tpv", "pagos", "checkouts", "reembolsos"]) {
  assert.ok(!resp.includes(forbidden), `A07.2 relevo no debe alterar ${forbidden}`);
}

// Existing SQL contract already proves movement history, replay and cross-local denial.
for (const required of [
  "histórico movimiento incorrecto",
  "replay duplicó evento movimiento",
  "mapa cross-local aceptado",
  "efectos económicos inesperados"
]) {
  assert.ok(a07.includes(required), `A07.2 falta evidencia backend: ${required}`);
}

// UI adapters: same account, same local context, server versions and mandatory reason.
const moveUiIni = src.indexOf("async function moverMesaCuentaA07(");
const moveUiFin = src.indexOf("\n  async function cambiarResponsableCuentaA07(", moveUiIni);
assert.ok(moveUiIni >= 0 && moveUiFin > moveUiIni, "A07.2 move adapter missing");
const moveUi = src.slice(moveUiIni, moveUiFin);
for (const required of [
  "leerContextoCuentaA02(empresaId, localActivoId)",
  "contexto.ubicacion.mesa_id",
  "p_cuenta_id: contexto.cuentaId",
  "p_expected_cuenta_version: cuentaVersion",
  "p_expected_mesa_origen_version: mesaOrigenVersion",
  "p_expected_mesa_destino_version: mesaDestinoVersion",
  "p_motivo: motivoLimpio",
  "p_local_id: localActivoId",
  'rpcA02ConRecuperacion(supabase, "abc_mover_cuenta_mesa"',
  "await recuperarCuentaA06()",
  "await cargarMapaSalaA07()"
]) assert.ok(moveUi.includes(required), `A07.2 move UI missing: ${required}`);

const respUiIni = src.indexOf("async function cambiarResponsableCuentaA07(");
const respUiFin = src.indexOf("\n  async function venderCarrito(", respUiIni);
assert.ok(respUiIni >= 0 && respUiFin > respUiIni, "A07.2 responsible adapter missing");
const respUi = src.slice(respUiIni, respUiFin);
for (const required of [
  "leerContextoCuentaA02(empresaId, localActivoId)",
  "p_cuenta_id: contexto.cuentaId",
  "p_nuevo_responsable: responsableId",
  "p_motivo: motivoLimpio",
  "p_expected_cuenta_version: cuentaVersion",
  "p_local_id: localActivoId",
  'rpcA02ConRecuperacion(supabase, "abc_cambiar_responsable_cuenta"',
  "await recuperarCuentaA06()",
  "await cargarMapaSalaA07()"
]) assert.ok(respUi.includes(required), `A07.2 responsible UI missing: ${required}`);

// The recovery path reconstructs orders and payment state after move/reassignment.
const recoveryIni = a06.indexOf("create function public.abc_recuperar_cuenta(");
const recoveryFin = a06.indexOf("\ncreate function public.abc_listar_cuentas_recuperables(", recoveryIni);
const recovery = a06.slice(recoveryIni, recoveryFin);
assert.ok(recovery.includes("'pedidos',v_pedidos"), "A07.2 recovery must preserve/reload lines");
assert.ok(recovery.includes("'estado_cobro',v_cobro"), "A07.2 recovery must preserve/reload payment state");

// Visible UX and no manual UUID entry.
for (const required of [
  "Trasladar cuenta",
  "Motivo del traslado",
  "Cambiar responsable",
  "Nuevo responsable",
  "Motivo del relevo",
  "Confirmar relevo",
  'supabase.rpc("abc_listar_responsables_cuenta"'
]) assert.ok(src.includes(required), `A07.2 UI missing: ${required}`);
assert.ok(!src.includes('placeholder: "UUID'), "A07.2 must not ask operator for raw UUID");

// Conflict classes must include both origin/destination versions.
assert.ok(src.includes('msg.includes("mesa_origen_version_conflict")'));
assert.ok(src.includes('msg.includes("mesa_destino_version_conflict")'));

console.log("A07_2_MOVE_REASSIGN=PASS");
console.log("A07_2_LINES_PAYMENTS_PRESERVED_BY_SCOPE=PASS");
console.log("A07_2_LOCAL_ISOLATION_HISTORY=PASS");
