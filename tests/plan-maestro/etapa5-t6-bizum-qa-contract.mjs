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

// T6 preparó Bizum en QA (handshake sin cobro) hasta la Hoja QA-8, que lo
// completó como medio operativo (ver etapa5-t6-bizum-operativo-contract.mjs).
// Esta prueba conserva las comprobaciones del handshake original y de que
// la migración histórica de abc_iniciar_cobro (ya aplicada, nunca editada)
// seguía sin admitir BIZUM en su momento.
for (const [nombre, contenido] of [["fuente", fuente], ["espejo de recuperación", espejo]]) {
  assert.match(contenido, /function prepararBizumF4\(\)/, `${nombre}: falta el preparador local de Bizum`);
  assert.match(contenido, /abc_preparar_bizum_qa/, `${nombre}: falta la llamada al handshake server-side`);
  assert.match(contenido, /Bizum QA preparado por el servidor/, `${nombre}: falta el mensaje de preparación server-side`);
}

assert.match(migracionCobro, /v_medio not in \('EFECTIVO','TARJETA','TRANSFERENCIA','OTRO'\)/, "La migración histórica (nunca editada) debe conservar su lista original");
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
