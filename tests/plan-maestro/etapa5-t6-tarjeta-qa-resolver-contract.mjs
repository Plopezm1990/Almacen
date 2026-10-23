import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fuente = fs.readFileSync(path.join(root, "fuente.js"), "utf8");
const espejo = fs.readFileSync(path.join(root, "source-recovery", "fuente-recuperado.js"), "utf8");
const migracion = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20261011140000_abc_f4_b02b_qa_simulated_resolver.sql"),
  "utf8"
);

// Hoja QA-3 (Etapa 5, T6, punto 1): cierra el intento de tarjeta simulada
// que quedaba colgado en "PENDIENTE" sin ningún botón para resolverlo. No
// crea cobro real ni proveedor; reutiliza una pieza de servidor ya aplicada
// en QA desde el 11/10 (abc_qa_confirmar_pago_simulado) que nunca llegó a
// conectarse en pantalla. Esta prueba evita que el botón se vuelva a perder
// de vista o que se amplíe fuera de QA-EMP-A/QA-A1.
for (const [nombre, contenido] of [["fuente", fuente], ["espejo de recuperación", espejo]]) {
  assert.match(contenido, /async function resolverPagoSimuladoQAF4\(\)/, `${nombre}: falta el adaptador resolverPagoSimuladoQAF4`);
  assert.match(contenido, /async function aprobarPagoSimuladoQAF4\(\)/, `${nombre}: falta el manejador de pantalla aprobarPagoSimuladoQAF4`);
  assert.match(
    contenido,
    /if \(empresaId !== "QA-EMP-A" \|\| localActivoId !== "QA-A1"\) return \{ ok: false, error: "El resolvedor simulado solo está disponible en QA\." \};/,
    `${nombre}: el adaptador debe rechazarse fuera de QA-EMP-A/QA-A1`
  );
  assert.match(contenido, /abc_qa_confirmar_pago_simulado/, `${nombre}: falta la llamada a la RPC ya aplicada en QA`);
  // El botón vive junto al aviso de "bloqueado" (gated por bloqueado, no por
  // !bloqueado): un intento de tarjeta pendiente es precisamente lo que
  // activa `bloqueado` y oculta el bloque normal de botones de cobro, así
  // que colocarlo ahí lo deja inalcanzable. Ver ETAPA5_T6_CIERRE_TARJETA.
  assert.match(
    contenido,
    /bloqueado && configEmpresa\?\.id === "QA-EMP-A" && local\?\.id === "QA-A1" && ultimoIntento\?\.medio === "TARJETA"/,
    `${nombre}: el botón debe aparecer junto al aviso de bloqueado, no dentro del bloque !bloqueado`
  );
  assert.doesNotMatch(
    contenido,
    /estadoCobroF4\?\.intentos\?\.\[0\]\?\.medio === "TARJETA" \? \/\* @__PURE__ \*\/ import_react4\.default\.createElement\(Btn, \{ small: true, variant: "ghost", onClick: aprobarPagoSimuladoQAF4/,
    `${nombre}: el botón no debe quedar dentro del bloque de botones normales (solo se ve ahí mientras no está bloqueado, y un intento TARJETA pendiente siempre bloquea)`
  );
  assert.match(contenido, /"Aprobar pago simulado \(solo QA\)"/, `${nombre}: falta el texto del botón`);
  assert.doesNotMatch(
    contenido,
    /abc_qa_confirmar_pago_simulado[\s\S]{0,400}iniciarCobroCuentaF4/,
    `${nombre}: el resolvedor no debe abrir un intento de cobro nuevo`
  );
}

// La RPC ya vive en QA (comprobado el 23/10/2026 leyendo su definición en el
// proyecto qjqorixtkilwsndqayyx: coincide letra por letra con este archivo).
// Esta migración solo documenta en git lo que ya estaba aplicado; no se
// ejecuta SQL nuevo al incorporarla.
assert.match(migracion, /create or replace function public\.abc_qa_confirmar_pago_simulado/, "Falta la función del resolvedor");
assert.match(migracion, /security definer/, "El resolvedor debe ser security definer para delegar en abc_resolver_intento");
assert.match(migracion, /v_empresa constant text := 'QA-EMP-A'/, "El resolvedor debe fijar la empresa a QA-EMP-A");
assert.match(migracion, /v_local constant text := 'QA-A1'/, "El resolvedor debe fijar el local a QA-A1");
assert.match(migracion, /rol = 'Propietario'/, "Solo el Propietario puede aprobar el pago simulado");
assert.match(migracion, /if v_pago\.medio <> 'TARJETA' then/, "El resolvedor solo debe aceptar intentos de TARJETA");
assert.match(migracion, /v_result := public\.abc_resolver_intento\(/, "Debe delegar la transición económica en abc_resolver_intento");
assert.match(migracion, /grant execute on function public\.abc_qa_confirmar_pago_simulado[\s\S]*to authenticated/, "Debe limitarse a usuarios autenticados");
assert.doesNotMatch(migracion, /security invoker/, "Esta pieza es security definer, no invoker: no confundir con el handshake de Bizum");

console.log("PLAN_MAESTRO_ETAPA5_T6_TARJETA_QA_ADAPTADOR=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_TARJETA_QA_SCOPE_GUARD=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_TARJETA_QA_BOTON_OCULTO_FUERA_DE_QA=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_TARJETA_QA_MIGRACION_YA_APLICADA=PASS");
