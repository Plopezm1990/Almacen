import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fuente = fs.readFileSync(path.join(root, "fuente.js"), "utf8");
const espejo = fs.readFileSync(path.join(root, "source-recovery", "fuente-recuperado.js"), "utf8");
const migracion = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20261024100000_t6_ticket_correo.sql"),
  "utf8"
);
const edgeFunction = fs.readFileSync(
  path.join(root, "supabase", "functions", "enviar-ticket-correo", "index.ts"),
  "utf8"
);

// Hoja QA-6 (Etapa 5, T6, punto 4): «ticket por correo». No es un documento
// fiscal (eso es la Hoja QA-5, aparte) ni sustituye el ticket impreso — es
// una copia informativa de la venta. El envío real lo hace la Edge Function
// "enviar-ticket-correo" (única pieza que toca RESEND_API_KEY).
//
// Aprendido del hallazgo real de la Hoja QA-5 (24/10/2026): una función
// bien escrita pero nunca conectada a crearLogicaVenta/GestionAlmacen/
// VentaRapida no hace nada, sin ningún aviso visible. Aquí se comprueban
// los 4 puntos de conexión desde el principio, no después de un fallo en
// vivo.
for (const [nombre, contenido] of [["fuente", fuente], ["espejo de recuperación", espejo]]) {
  assert.match(contenido, /"Ticket por correo"/, `${nombre}: falta el título de la sección`);
  assert.match(
    contenido,
    /async function enviarTicketCorreoF4\(/,
    `${nombre}: falta la función de orquestación`
  );
  assert.match(contenido, /async function enviarTicketCorreoF4UI\(/, `${nombre}: falta el envoltorio de UI`);
  assert.match(
    contenido,
    /if \(String\(estado\.estado\) !== "PAGADO"\) return \{ ok: false, error: "Solo se puede enviar el ticket cuando la cuenta está pagada por completo\." \};/,
    `${nombre}: debe rechazar enviar el ticket si la cuenta no está pagada`
  );
  assert.match(
    contenido,
    /supabase\.functions\.invoke\("enviar-ticket-correo"/,
    `${nombre}: debe invocar la Edge Function, no llamar a Resend directamente desde el navegador`
  );
  assert.doesNotMatch(
    contenido,
    /enviarTicketCorreoF4[\s\S]{0,2000}RESEND_API_KEY/,
    `${nombre}: la clave de Resend no debe aparecer nunca en el código de cliente`
  );
  assert.match(contenido, /onClick: enviarTicketCorreoF4UI, disabled: procesandoTicketCorreoF4 \}/, `${nombre}: el botón solo debe depender de que no haya otro envío en curso`);
  // Los 4 puntos de conexión: destructuring de crearLogicaVenta, su return,
  // las props de <VentaRapida>, y los parámetros de VentaRapida.
  const ocurrenciasConexion = contenido.match(/emitirFacturaEmpresaF4, enviarTicketCorreoF4, reintentarCobroF4, leerEstadoCobroF4/g) || [];
  assert.equal(
    ocurrenciasConexion.length,
    4,
    `${nombre}: deben existir exactamente 4 puntos de conexión para enviarTicketCorreoF4; encontrados: ${ocurrenciasConexion.length}`
  );
}

assert.match(migracion, /create or replace function public\.abc_datos_ticket_correo/, "Falta la función de lectura de datos auténticos del cobro");
assert.match(migracion, /create or replace function public\.abc_registrar_ticket_correo_enviado/, "Falta la función de registro de auditoría");
assert.match(migracion, /security definer/, "Deben ser security definer");
assert.match(migracion, /abc_tiene_capacidad\(p_empresa_id,p_local_id,'ABC_COBRO_INICIAR'\)/, "Debe exigir el mismo permiso que iniciar un cobro");
assert.match(migracion, /p_email !~ '\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\+\$'/, "Debe validar el formato del correo");
assert.match(migracion, /select coalesce\(sum\(p\.importe_objetivo\),0\) into v_total[\s\S]*estado='CONFIRMADO'/, "El total debe salir de los pagos confirmados, nunca de un dato enviado por el cliente");
assert.doesNotMatch(migracion, /p_total|p_importe/, "El importe no debe poder llegar como parámetro desde el cliente (siempre se calcula en servidor)");
assert.match(migracion, /grant execute on function public\.abc_datos_ticket_correo[\s\S]*to authenticated/, "abc_datos_ticket_correo debe limitarse a usuarios autenticados");
assert.match(migracion, /grant execute on function public\.abc_registrar_ticket_correo_enviado[\s\S]*to authenticated/, "abc_registrar_ticket_correo_enviado debe limitarse a usuarios autenticados");

assert.match(edgeFunction, /Deno\.env\.get\("RESEND_API_KEY"\)/, "La Edge Function debe leer la clave desde un secreto de entorno, nunca recibirla del cliente");
assert.doesNotMatch(edgeFunction, /req\.(json|body)[\s\S]{0,80}resendKey|resendKey[\s\S]{0,80}req\.(json|body)/, "La clave de Resend no debe poder venir del cuerpo de la petición");
assert.match(edgeFunction, /"Idempotency-Key":\s*operationId/, "El envío a Resend debe llevar la Idempotency-Key para no duplicar el correo en un reintento");
assert.match(edgeFunction, /supabase\.rpc\("abc_datos_ticket_correo"/, "Debe pedir los datos auténticos del cobro antes de construir el correo");
assert.match(edgeFunction, /escapeHtml/, "Debe escapar el contenido antes de insertarlo en el HTML del correo");
assert.match(edgeFunction, /global: \{ headers: \{ Authorization: authorization \} \}/, "Debe usar la sesión del propio usuario (no service role) para que auth.uid() se resuelva en las RPC");

console.log("PLAN_MAESTRO_ETAPA5_T6_TICKET_CORREO_SECCION_UI=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_TICKET_CORREO_SOLO_PAGADO=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_TICKET_CORREO_CONEXION_COMPONENTE=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_TICKET_CORREO_MIGRACION=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_TICKET_CORREO_EDGE_FUNCTION=PASS");
