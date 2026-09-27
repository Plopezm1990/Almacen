import fs from "node:fs";
import assert from "node:assert/strict";

const src = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260924060000_abc_f3_a08_account_split_merge.sql", "utf8");

for (const required of [
  "async function listarCuentasRepartoA08()",
  "async function moverCantidadLineaCuentaA08({",
  'supabase.rpc("abc_consultar_reparto_cuenta"',
  'supabase.rpc("abc_listar_cuentas_recuperables"',
  'rpcA02ConRecuperacion(supabase, "abc_mover_cantidad_linea_cuenta"',
  "p_expected_origen_version: origenVersion",
  "p_expected_destino_version: destinoVersion",
  "p_expected_linea_version: lineaVersion",
  "p_cuenta_origen_id: contexto.cuentaId",
  "p_cuenta_destino_id: destinoId",
  "p_comensal_ref: comensal || null",
  "await recuperarCuentaA06()",
  "await listarCuentasRepartoA08()"
]) assert.ok(src.includes(required), `A08.1 adapter incompleto: ${required}`);

for (const required of [
  "Repartir productos",
  "Producto / línea",
  "Cuenta destino",
  "Comensal (opcional)",
  "Mover producto",
  "No hay otra cuenta abierta compatible en este local.",
  "cantidad_fiscalizada",
  "reanudable_mismo_dia",
  "currency_code"
]) assert.ok(src.includes(required), `A08.1 UI incompleta: ${required}`);

assert.ok(!src.includes('placeholder: "UUID'), "A08.1 no debe pedir UUID manual");
assert.ok(src.includes('String(cuenta?.cuenta_id || "")'), "A08.1 debe seleccionar cuentas por datos del servidor");

const adapterIni = src.indexOf("async function listarCuentasRepartoA08()");
const adapterFin = src.indexOf("async function venderCarrito(", adapterIni);
assert.ok(adapterIni >= 0 && adapterFin > adapterIni, "A08.1 adapter range missing");
const adapter = src.slice(adapterIni, adapterFin);
for (const forbidden of [
  "abc_asignar_cuota_importe",
  "abc_revertir_cuota_importe",
  "abc_unir_cuentas",
  "insert into",
  "update public.",
  "delete from"
]) assert.ok(!adapter.toLowerCase().includes(forbidden.toLowerCase()), `A08.1 fuera de alcance: ${forbidden}`);

for (const required of [
  "create function public.abc_mover_cantidad_linea_cuenta(",
  "reparto_parte_fiscalizada_inmovil",
  "reparto_cantidad_no_fraccionable",
  "reparto_cantidad_precision_invalida",
  "cuenta_origen_version_conflict",
  "cuenta_destino_version_conflict",
  "linea_version_conflict",
  "CUENTA_REPARTO_LINEA_MOVIDO"
]) assert.ok(migration.includes(required), `A08 backend faltante: ${required}`);

console.log("A08_1_LINE_SPLIT_UI=PASS");
console.log("A08_1_NO_MANUAL_UUID=PASS");
console.log("A08_1_SCOPE_LINE_ONLY=PASS");
