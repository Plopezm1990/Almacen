import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fuente = fs.readFileSync(path.join(root, "fuente.js"), "utf8");
const espejo = fs.readFileSync(path.join(root, "source-recovery", "fuente-recuperado.js"), "utf8");
const migracionCobro = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20260927203000_abc_f3_a08_2_payment_interlock.sql"),
  "utf8"
);
const migracionBizum = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20261023190144_t6_bizum_qa_simulated_adapter.sql"),
  "utf8"
);

// T6 únicamente prepara Bizum en QA hasta que exista un adaptador de pago
// explícito. Esta prueba evita que el botón local termine llamando a la RPC
// de cobro o que BIZUM se clasifique silenciosamente como otro medio.
for (const [nombre, contenido] of [["fuente", fuente], ["espejo de recuperación", espejo]]) {
  assert.match(contenido, /function prepararBizumF4\(\)/, `${nombre}: falta el preparador local de Bizum`);
  assert.match(contenido, /abc_preparar_bizum_qa/, `${nombre}: falta la llamada al handshake server-side`);
  assert.match(contenido, /Bizum QA preparado por el servidor/, `${nombre}: falta el mensaje de preparación server-side`);
  assert.doesNotMatch(contenido, /iniciarCobroCuentaF4\(["']BIZUM/, `${nombre}: Bizum no debe iniciar cobro todavía`);
}

assert.match(fuente, /\["EFECTIVO", "TARJETA"\]\.includes\(medio\)/, "La UI no debe ampliar el cobro sin contrato de servidor");
assert.match(migracionCobro, /v_medio not in \('EFECTIVO','TARJETA','TRANSFERENCIA','OTRO'\)/, "La RPC actual debe mantener su lista explícita");
assert.doesNotMatch(migracionCobro, /v_medio not in \([^)]*'BIZUM'/, "La RPC no debe aceptar BIZUM sin adaptador QA");
assert.match(migracionCobro, /if v_medio<>'EFECTIVO' then[\s\S]*?PROVIDER_COBRO/, "Los medios no efectivos deben quedar en la cola de proveedor existente");
assert.match(migracionBizum, /create or replace function public\.abc_preparar_bizum_qa/, "Falta el handshake server-side de Bizum QA");
assert.match(migracionBizum, /security invoker/, "El handshake Bizum QA no debe elevar privilegios");
assert.match(migracionBizum, /'provider_started', false/, "El handshake no debe iniciar proveedor");
assert.match(migracionBizum, /'cash_movement', false/, "El handshake no debe mover caja");
assert.match(migracionBizum, /'write_performed', false/, "El handshake no debe escribir pagos");
assert.match(migracionBizum, /grant execute on function public\.abc_preparar_bizum_qa[\s\S]*to authenticated/, "El handshake debe limitarse a usuarios autenticados");

console.log("PLAN_MAESTRO_ETAPA5_T6_BIZUM_PREPARACION=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_BIZUM_RPC_GUARD=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_BIZUM_QA_HANDSHAKE=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_BIZUM_PROVIDER_NOT_STARTED=PASS");
