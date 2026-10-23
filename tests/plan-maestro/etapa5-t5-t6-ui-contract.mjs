import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fuente = fs.readFileSync(path.join(root, "fuente.js"), "utf8");

// Contrato exclusivamente del Plan Maestro L&A Suite. No reutiliza ni valida
// las suites ABC_F5_* del otro plan.
const baseT5T6 = [
  ["historial de ventas", /function renderHistorialVentas\(\)/],
  ["abrir el ticket desde el historial", /Ver ticket \/ reimprimir/],
  ["vista imprimible del ticket", /Imprimir \/ Guardar PDF/],
  ["cobro en efectivo", /Cobrar efectivo/],
  ["tarjeta simulada QA", /Iniciar tarjeta simulada/],
  ["billetes rápidos", /Billetes rápidos/],
  ["cobro server-side", /iniciarCobroCuentaF4\(medioSolicitado = "EFECTIVO"/],
  ["recuperación server-side de cuenta", /abc_recuperar_cuenta/],
  ["listado server-side de cuentas recuperables", /abc_listar_cuentas_recuperables/],
  ["sección visible de cuentas recuperables", /Cuentas aparcadas \/ recuperables/],
  ["acción visible para aparcar", /Aparcar cuenta/],
  ["desvinculación local segura al aparcar", /function aparcarCuentaA06\(\)/],
  ["acceso TPV a entradas y retiradas", /Caja · entradas y retiradas/],
  ["día operativo de caja resuelto en servidor", /function abrirMovimientosCajaDesdeTpv\(\)/],
  ["flujo trazable de caja reutilizado desde TPV", /createElement\(BloqueEntradasSalidas/],
  ["acción visible de recuperación", /Recuperar cuenta/],
  ["mapa server-side de sala", /cargarMapaSalaA07/],
  ["asignación de mesa", /Asignar esta cuenta/],
  ["traslado de cuenta", /Trasladar cuenta/],
  ["borrador local con TTL", /A06_BORRADOR_TTL_MS/]
];

for (const [nombre, patron] of baseT5T6) {
  assert.match(fuente, patron, `Falta el contrato base de Etapa 5: ${nombre}`);
}

const ausenciasConocidas = [
  ["Bizum", /Bizum/],
  ["propina", /propina/i],
  ["vale regalo", /vale regalo/i],
  ["billetes rápidos", /billetes rápidos/i],
  ["factura a empresa con NIF", /factura a empresa con NIF/i],
  ["envío por email", /enviar por email/i],
  ["artículo varios", /artículo varios/i],
  ["unir mesas", /unir mesas/i]
];

const pendientes = ausenciasConocidas
  .filter(([, patron]) => !patron.test(fuente))
  .map(([nombre]) => nombre);

console.log("PLAN_MAESTRO_ETAPA5_T5_T6_BASE_OK=1");
console.log("PLAN_MAESTRO_ETAPA5_T5_TICKET_REIMPRESION=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T5_CUENTA_SALA_BASE=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T5_RECUPERACION_CRUZADA=QA_PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_COBRO_BASE=PASS");
console.log(`PLAN_MAESTRO_ETAPA5_PENDIENTES=${pendientes.join(",") || "ninguno"}`);
