import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const worker = fs.readFileSync(path.join(root, "supabase/functions/qa-card-worker/index.ts"), "utf8");
const fuente = fs.readFileSync(path.join(root, "fuente.js"), "utf8");
const recuperado = fs.readFileSync(path.join(root, "source-recovery/fuente-recuperado.js"), "utf8");

assert.match(worker, /qjqorixtkilwsndqayyx\.supabase\.co/, "el worker no queda limitado al proyecto QA");
assert.match(worker, /SUPABASE_SERVICE_ROLE_KEY/, "el worker no usa el cliente privilegiado en servidor");
assert.match(worker, /auth\.getUser\(\)/, "el worker no valida la sesión del operador");
assert.match(worker, /abc_estado_pago_mixto_cuenta/, "el worker no valida el estado visible de la cuenta");
assert.match(worker, /String\(payment\.medio \|\| ""\)\.toUpperCase\(\) !== "TARJETA"/, "el worker no limita la resolución a tarjetas");
assert.match(worker, /String\(attempt\.estado \|\| ""\)\.toUpperCase\(\) !== "PENDIENTE"/, "el worker permite resolver intentos no pendientes");
assert.match(worker, /abc_resolver_intento/, "el worker no delega la transición económica al servidor");
assert.match(worker, /f4\.qa\.card\.resolve\.\$\{intentoId\}/, "la recuperación no usa una operación idempotente");
assert.match(worker, /provider_code: "SIMULATOR"/, "falta la referencia de proveedor simulado");
assert.doesNotMatch(worker, /PAN|CVV|CVC|card_number/i, "el worker contiene datos de tarjeta prohibidos");

for (const source of [fuente, recuperado]) {
  assert.match(source, /functions\.invoke\("qa-card-worker"/, "la recuperación de tarjeta no está conectada al worker QA");
  assert.match(source, /pendiente\.medio === "TARJETA" && tarjetaQaSimuladaActiva\(\)/, "la recuperación QA no está aislada del flujo real");
  assert.match(source, /limpiarPendienteCobroF4\(empresaId, localActivoId, pendiente\.cuentaId\)/, "la recuperación no limpia el borrador local tras confirmación");
  assert.match(source, /Tarjeta simulada confirmada/, "la UI no comunica la confirmación simulada");
}

console.log("F4_B12_QA_CARD_WORKER_CONTRACT=PASS");
