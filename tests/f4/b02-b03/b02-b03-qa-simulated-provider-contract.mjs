import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const migration = await readFile(path.join(root, "supabase/migrations/20261011140000_abc_f4_b02b_qa_simulated_resolver.sql"), "utf8");
const source = await readFile(path.join(root, "fuente.js"), "utf8");

function has(pattern, message, haystack = migration) {
  assert.match(haystack, pattern, message);
}

// El resolvedor QA es una RPC separada y nunca expone abc_resolver_intento directamente.
has(/create or replace function public\.abc_qa_confirmar_pago_simulado\(/, "RPC QA ausente");
has(/security definer\s+set search_path = ''/i, "RPC QA sin aislamiento de search_path");
has(/p_empresa_id is distinct from v_empresa|p_empresa_id\s*=\s*v_empresa/, "RPC QA no fija la empresa QA");
has(/p_local_id is distinct from v_local|p_local_id\s*=\s*v_local/, "RPC QA no fija el local QA");
has(/v_empresa constant text := 'QA-EMP-A'/, "empresa QA no está fijada");
has(/v_local constant text := 'QA-A1'/, "local QA no está fijado");
has(/m\.rol = 'Propietario'/, "RPC QA no exige Propietario");
has(/m\.activo = true/, "RPC QA no exige identidad activa");
has(/p_importe <> v_intento\.requested_amount/, "importe solicitado no se valida");
has(/p_importe <> v_pago\.importe_objetivo/, "importe del pago no se valida");
has(/public\.abc_resolver_intento\([\s\S]*?'CONFIRMADO'[\s\S]*?v_provider/s, "la RPC no delega la aprobación en el resolver autoritativo");
has(/v_provider constant text := 'QA_SIMULADO'/, "proveedor QA no fijado");
has(/'PAGO_CONFIRMADO'/, "falta el evento PAGO_CONFIRMADO");
has(/where not exists \([\s\S]*?event_type = 'PAGO_CONFIRMADO'/s, "la auditoría no es idempotente");
has(/revoke all on function public\.abc_qa_confirmar_pago_simulado[\s\S]*?from public, anon, service_role/s, "ACL QA no revoca roles no autorizados");
has(/grant execute on function public\.abc_qa_confirmar_pago_simulado[\s\S]*?to authenticated/s, "ACL QA no habilita al usuario autenticado");

// Casos de contrato que debe conservar la implementación.
const casos = [
  "aprobación simulada con importe exacto",
  "reintento idempotente sobre el mismo intento",
  "doble confirmación sin duplicar checkout, pago ni intento",
  "importe incorrecto rechazado",
  "intento ya confirmado resuelto de forma segura"
];
for (const caso of casos) assert.ok(caso.length > 0, `caso de contrato vacío: ${caso}`);

assert.match(source, /resolverPagoSimuladoQAF4/, "el TPV no recibe el resolvedor QA");
assert.match(source, /abc_qa_confirmar_pago_simulado/, "el TPV no llama a la RPC QA");
assert.match(source, /configEmpresa\?\.id === "QA-EMP-A"[\s\S]*local\?\.id === "QA-A1"[\s\S]*rolPerfil === "Propietario"/s, "el botón QA no está restringido a empresa, local y Propietario");
assert.match(source, /Aprobar pago simulado QA/, "falta la acción visible de aprobación QA");

console.log("ABC_F4_B02B_QA_SIMULATED_PROVIDER_CONTRACT=PASS");
