import fs from "node:fs";
import assert from "node:assert/strict";

const src = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260924050000_abc_f3_a07_tables_zones.sql", "utf8");

for (const required of [
  "create function public.abc_crear_zona(",
  "create function public.abc_crear_mesa(",
  "create function public.abc_listar_mapa_sala(",
  "ABC_SALA_CONFIGURAR",
  "Zonas y mesas",
  "function ConfigSala(",
  '"abc_crear_zona"',
  '"abc_crear_mesa"',
  '"abc_listar_mapa_sala"',
  "p_terminal_id: contexto.terminal.terminalId",
  "p_session_id: contexto.terminal.sessionId",
  "p_operating_day: contexto.operatingDay",
  "registrarAuditoria(\"Configurar zona\"",
  "registrarAuditoria(\"Configurar mesa\""
]) {
  assert.ok(src.includes(required) || migration.includes(required), `A07.3 falta capacidad UI/RPC: ${required}`);
}

for (const forbidden of [
  '.from("tpv_zonas").insert',
  '.from("tpv_mesas").insert',
  '.from("tpv_zonas").update',
  '.from("tpv_mesas").update'
]) {
  assert.ok(!src.includes(forbidden), `A07.3 no debe hacer DML directo: ${forbidden}`);
}

console.log("A07_3_CONFIG_SALA_OWNER_RPC=PASS");
console.log("A07_3_CONFIG_SALA_AUDIT=PASS");
console.log("A07_3_CONFIG_SALA_NO_DIRECT_DML=PASS");
