import fs from "node:fs";
import assert from "node:assert/strict";

const src = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");
const a07 = fs.readFileSync("supabase/migrations/20260924050000_abc_f3_a07_tables_zones.sql", "utf8");

// Backend A07.1 already exists and is authoritative.
for (const required of [
  "create table public.tpv_zonas(",
  "create table public.tpv_mesas(",
  "create table public.cuenta_mesa_asignaciones(",
  "create function public.abc_listar_mapa_sala(",
  "create function public.abc_asignar_cuenta_mesa(",
  "'ocupacion_comensales'",
  "'sobre_capacidad'",
  "'responsable_actual',c.responsable_actual",
  "ABC_SALA_VER",
  "ABC_MESA_ASIGNAR",
  "mesa_version_conflict",
  "cuenta_version_conflict"
]) {
  assert.ok(a07.includes(required), `A07.1 backend incompleto: ${required}`);
}

// A07.1 reads the floor through RPC; it does not invent a local floor plan.
assert.ok(src.includes('supabase.rpc("abc_listar_mapa_sala"'), "A07.1 falta mapa real de sala");
assert.ok(src.includes('supabase.rpc("abc_asignar_cuenta_mesa"') || src.includes('"abc_asignar_cuenta_mesa"'), "A07.1 falta asignación real de mesa");
for (const forbidden of [
  '.from("tpv_zonas").insert',
  '.from("tpv_mesas").insert',
  '.from("cuenta_mesa_asignaciones").insert'
]) {
  assert.ok(!src.includes(forbidden), `A07.1 no debe hacer DML directo: ${forbidden}`);
}

// Assignment must use the actual recovered account and optimistic versions.
const assignIni = src.indexOf("async function asignarMesaCuentaA07(");
const assignFin = src.indexOf("\n  async function venderCarrito(", assignIni);
assert.ok(assignIni >= 0 && assignFin > assignIni, "A07.1 adaptador de asignación no localizable");
const assign = src.slice(assignIni, assignFin);
for (const required of [
  "leerContextoCuentaA02(empresaId, localActivoId)",
  "p_cuenta_id: contexto.cuentaId",
  "p_expected_cuenta_version: cuentaVersion",
  "p_expected_mesa_version: mesaVersion",
  "p_operating_day: contexto.operatingDay",
  "contextoTerminalA02(supabase, empresaId, localActivoId)",
  "await recuperarCuentaA06()",
  "await cargarMapaSalaA07()"
]) {
  assert.ok(assign.includes(required), `A07.1 asignación sin autoridad real: ${required}`);
}
for (const forbidden of [
  "abc_mover_cuenta_mesa",
  "abc_liberar_cuenta_mesa",
  "abc_cambiar_responsable_cuenta",
  "abc_crear_mesa",
  "abc_crear_zona"
]) {
  assert.ok(!assign.includes(forbidden), `A07.1 invadió A07.2/configuración: ${forbidden}`);
}

// A06 recovery now preserves A07 location and account responsibility.
const recoverIni = src.indexOf("async function recuperarCuentaA06()");
const recoverFin = src.indexOf("\n  function leerPedidoOperativoA05()", recoverIni);
const recover = src.slice(recoverIni, recoverFin);
assert.ok(recover.includes("responsableActual: data.cuenta.responsable_actual"), "A07.1 no conserva responsable real");
assert.ok(recover.includes('ubicacion: data.ubicacion && typeof data.ubicacion === "object" ? data.ubicacion : null'), "A07.1 no conserva ubicación real");
assert.ok(recover.includes("modalidad: String(data.cuenta.modalidad"), "A07.1 no conserva modalidad real");

// UI must expose zones, effective state, occupancy, capacity, diners and responsibility.
for (const required of [
  "Sala y mesas",
  "Ocupación y comensales vienen de cuentas reales del servidor.",
  "Responsable:",
  "mesa.estado_efectivo",
  "mesa.ocupacion_comensales",
  "mesa.capacidad",
  "mesa.sobre_capacidad",
  "Comensales",
  "Asignar esta cuenta",
  "No hay zonas ni mesas configuradas para este local.",
  "Traslado de mesa y relevo de responsable se validan en A07.2."
]) {
  assert.ok(src.includes(required), `A07.1 UI incompleta: ${required}`);
}

// A07.1 supports multiple active accounts per occupied table: OCUPADA is not disabled.
const renderIni = src.indexOf("function renderSalaA07()");
const renderFin = src.indexOf("\n  function renderPedidoOperativoA05()", renderIni);
const render = src.slice(renderIni, renderFin);
assert.ok(render.includes('["BLOQUEADA", "RESERVADA", "FUERA_SERVICIO"]'), "A07.1 estados no asignables incorrectos");
assert.ok(!render.includes('["OCUPADA"'), "A07.1 no debe bloquear una mesa ocupada: backend admite varias cuentas por mesa");

// Capacity is a visible warning, not a client-side denial.
assert.ok(render.includes("supera la capacidad configurada de la mesa"), "A07.1 falta aviso de capacidad");
assert.ok(assign.includes("nComensales > 999"), "A07.1 debe validar rango de comensales");
assert.ok(!assign.includes("nComensales > Number("), "A07.1 no debe convertir capacidad en bloqueo");

// Responsable is from server/account identity; no fabricated local employee mapping.
assert.ok(src.includes('return "Usuario …" + id.slice(-8);'), "A07.1 debe identificar responsable desconocido sin inventar nombre");
assert.ok(src.includes("mapaSalaA07?.currentUserId"), "A07.1 debe reconocer al usuario autenticado actual");

// Conflict on table version participates in visible optimistic locking.
assert.ok(src.includes('msg.includes("mesa_version_conflict")'), "A07.1 no tipa conflicto de mesa");
assert.ok(src.includes("if (resultado?.conflict) await refrescarSalaA07();"), "A07.1 conflicto no refresca sala");

// A07.1 is wired from factory to TPV.
assert.ok(
  src.includes("recuperarCuentaA06, cargarMapaSalaA07, asignarMesaCuentaA07 } = crearLogicaVenta"),
  "A07.1 adapters not destructured"
);
assert.ok(
  src.includes("recuperarCuentaA06, cargarMapaSalaA07, asignarMesaCuentaA07, nombreResponsableActualA07"),
  "A07.1 TPV props not wired"
);

console.log("A07_1_REAL_FLOOR_INTEGRATION=PASS");
console.log("A07_1_NO_FAKE_FLOOR=PASS");
console.log("A07_1_A07_2_SCOPE_SEPARATION=PASS");
