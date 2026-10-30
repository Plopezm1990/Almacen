import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../../../supabase/migrations/20261027150403_abc_f7_c07d_d3_pilot_sandbox.sql", import.meta.url), "utf8");

test("la migración C07-D.3 registra un expediente aislado por empresa y alcance", () => {
  assert.match(migration, /create table private\.abc_c07d_pilotos_sandbox/i);
  assert.match(migration, /unique \(empresa_id, local_id, entidad_fiscal_id\)/i);
  assert.match(migration, /references public\.entidad_fiscal_locales/i);
  assert.match(migration, /references public\.locales/i);
  assert.match(migration, /environment text not null default 'SANDBOX'/i);
  assert.match(migration, /environment = 'SANDBOX'/i);
});

test("la migración mantiene estados monotónicos y bloquea saltos a producción", () => {
  assert.match(migration, /PENDIENTE_EMPRESA/);
  assert.match(migration, /EXPEDIENTE_EN_REVISION/);
  assert.match(migration, /READY_FOR_SANDBOX/);
  assert.match(migration, /SANDBOX_EN_CURSO/);
  assert.match(migration, /SANDBOX_PASS/);
  assert.match(migration, /PILOTO_CERRADO/);
  assert.match(migration, /C07D_PILOT_TRANSICION_INVALIDA/);
  assert.doesNotMatch(migration, /['"]PRODUCTION_ENABLED['"]/);
  assert.doesNotMatch(migration, /environment.*PRODUCCION/i);
});

test("la migración exige evidencias antes de cada puerta del piloto", () => {
  for (const key of [
    "empresa_real",
    "identidad_verificada",
    "representacion_verificada",
    "adaptador_elegido",
    "sandbox_externo",
    "hardware_disponible",
    "sandbox_cotejado",
    "resultado_satisfactorio",
    "qr_cotejado",
    "hardware_probado",
    "revision_propietario",
    "revision_asesoria",
    "decision_salida",
  ]) assert.match(migration, new RegExp(key));
  assert.match(migration, /C07D_PILOT_EVIDENCIA_REQUERIDA/);
  assert.match(migration, /SIMULADOR_NO_ES_SANDBOX_EXTERNO/);
});

test("la migración evita secretos, expone solo RPC autenticadas y conserva historial", () => {
  assert.match(migration, /secret.*secrets.*password.*token/s);
  assert.match(migration, /C07D_PILOT_EVIDENCIAS_NO_ADMITE_SECRETOS/);
  assert.match(migration, /enable row level security/gi);
  assert.match(migration, /abc_c07d_pilotos_sandbox_revisiones/gi);
  assert.match(migration, /C07D_PILOT_HISTORIAL_INMUTABLE/);
  assert.match(migration, /abc_c07d_leer_piloto_sandbox/);
  assert.match(migration, /abc_c07d_guardar_piloto_sandbox/);
  assert.match(migration, /grant execute .* to authenticated/i);
  assert.match(migration, /revoke all on table[\s\S]*from public, anon, authenticated, service_role/i);
});

console.log("C07D_D3_PILOT_SANDBOX_MIGRATION=PASS");
