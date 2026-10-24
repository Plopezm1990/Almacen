import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fuente = fs.readFileSync(path.join(root, "fuente.js"), "utf8");
const espejo = fs.readFileSync(path.join(root, "source-recovery", "fuente-recuperado.js"), "utf8");
const migracion = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20261024090000_t6_factura_empresa_serie.sql"),
  "utf8"
);

// Hoja QA-5 (Etapa 5, T6, punto 3): «factura a empresa (NIF)», en modo
// simulador. Usa el sistema de documentos fiscales ya existente desde la
// Etapa 5 (C05 numeración, C06 clasificación, C07 puerta fiscal); la única
// pieza nueva de esta hoja es abc_configurar_serie_documental, porque antes
// no existía ninguna forma de crear una serie documental (solo de reservar
// un número de una ya existente).
for (const [nombre, contenido] of [["fuente", fuente], ["espejo de recuperación", espejo]]) {
  assert.match(contenido, /"Factura a empresa"/, `${nombre}: falta el título de la sección`);
  assert.match(
    contenido,
    /tieneCheckout && String\(estado\?\.estado\) === "PAGADO" \?/,
    `${nombre}: la sección de factura solo debe aparecer con la cuenta PAGADO`
  );
  assert.match(contenido, /async function emitirFacturaEmpresaF4\(/, `${nombre}: falta la función de orquestación`);
  assert.match(contenido, /async function emitirFacturaEmpresaF4UI\(/, `${nombre}: falta el envoltorio de UI`);
  // Hallazgo en prueba Cowork (24/10/2026): el botón quedaba deshabilitado si
  // el estado de React de los campos no coincidía con lo escrito en pantalla
  // (p. ej. por cómo el navegador/automatización rellena el campo), y un
  // botón deshabilitado no dispara ningún evento: sin red, sin error, sin
  // "procesando". La validación de campos vacíos ya la hace la propia
  // función con un mensaje claro, así que el botón solo debe depender de
  // que no haya otra emisión en curso.
  assert.match(
    contenido,
    /onClick: emitirFacturaEmpresaF4UI, disabled: procesandoFacturaF4 \}/,
    `${nombre}: el botón no debe deshabilitarse por el contenido de los campos (ver hallazgo Cowork 24/10/2026)`
  );
  // Segundo hallazgo Cowork (24/10/2026), más grave: emitirFacturaEmpresaF4
  // existía en crearLogicaVenta() pero nunca se conectó con VentaRapida (el
  // componente real que renderiza el botón) — faltaba en su `return`, en las
  // props pasadas a <VentaRapida .../> y en los parámetros de VentaRapida.
  // Sin los tres eslabones, typeof emitirFacturaEmpresaF4 es "undefined" en
  // tiempo de ejecución y el botón no hace nada, sin red ni error visible.
  assert.match(
    contenido,
    /resolverPagoSimuladoQAF4, emitirFacturaEmpresaF4, enviarTicketCorreoF4, reintentarCobroF4, leerEstadoCobroF4/g,
    `${nombre}: emitirFacturaEmpresaF4 debe viajar junto a resolverPagoSimuladoQAF4 en el return de crearLogicaVenta, en las props de <VentaRapida> y en los parámetros de VentaRapida (ver hallazgo Cowork 24/10/2026)`
  );
  const ocurrenciasConexion = contenido.match(/resolverPagoSimuladoQAF4, emitirFacturaEmpresaF4, enviarTicketCorreoF4, reintentarCobroF4, leerEstadoCobroF4/g) || [];
  assert.equal(
    ocurrenciasConexion.length,
    4,
    `${nombre}: deben existir exactamente 4 puntos de conexión (destructuring de crearLogicaVenta, su return, las props de <VentaRapida>, y los parámetros de VentaRapida); encontrados: ${ocurrenciasConexion.length}`
  );
  assert.match(
    contenido,
    /if \(String\(estado\.estado\) !== "PAGADO"\) return \{ ok: false, error: "Solo se puede emitir factura cuando la cuenta está pagada por completo\." \};/,
    `${nombre}: debe rechazar emitir factura si la cuenta no está pagada`
  );
  assert.match(contenido, /abc_configurar_serie_documental/, `${nombre}: falta la llamada para crear/activar la serie`);
  assert.match(contenido, /abc_configurar_modalidad_fiscal/, `${nombre}: falta la configuración de modalidad fiscal`);
  assert.match(contenido, /p_estado: "SIMULADOR"/, `${nombre}: la modalidad fiscal debe quedar en modo SIMULADOR, nunca ACTIVO`);
  assert.doesNotMatch(contenido, /p_estado:\s*"ACTIVO"/, `${nombre}: no debe activar nunca la modalidad fiscal real`);
  assert.match(contenido, /abc_reservar_numero_documental/, `${nombre}: falta reservar el número documental`);
  assert.match(contenido, /p_tipo_documental: "FACTURA_COMPLETA"/, `${nombre}: debe clasificar como factura completa`);
  assert.match(
    contenido,
    /p_datos_receptor: datosReceptor/,
    `${nombre}: debe enviar nombre e identificador_fiscal del receptor`
  );
  assert.match(contenido, /identificador_fiscal: nifReceptor/, `${nombre}: falta el NIF del receptor en los datos`);
  assert.match(contenido, /abc_evaluar_documento_fiscal/, `${nombre}: falta la evaluación fiscal (modo simulador)`);
  assert.match(contenido, /p_simular: true/, `${nombre}: la evaluación fiscal debe pedirse siempre en modo simulador`);
  assert.match(contenido, /abc_resolver_emision_documental/, `${nombre}: falta resolver la emisión del documento`);
  assert.match(contenido, /p_estado: "EMITIDO"/, `${nombre}: debe marcar el documento como EMITIDO al terminar bien`);
  // Orden: reservar -> clasificar -> evaluar -> resolver (emitir), nunca al revés.
  const idxReservar = contenido.indexOf('"abc_reservar_numero_documental"');
  const idxClasificar = contenido.indexOf('"abc_clasificar_documento"');
  const idxEvaluar = contenido.indexOf('"abc_evaluar_documento_fiscal"');
  const idxResolver = contenido.lastIndexOf('"abc_resolver_emision_documental"');
  assert.ok(
    idxReservar > 0 && idxClasificar > idxReservar && idxEvaluar > idxClasificar && idxResolver > idxEvaluar,
    `${nombre}: el orden debe ser reservar -> clasificar -> evaluar -> resolver`
  );
}

assert.match(migracion, /create or replace function public\.abc_configurar_serie_documental/, "Falta la función para crear/activar una serie documental");
assert.match(migracion, /security definer/, "Debe ser security definer");
assert.match(migracion, /abc_tiene_capacidad\(p_empresa_id,p_local_id,'ABC_EMISOR_CAMBIAR'\)/, "Debe exigir el mismo permiso que el resto de piezas C05/C06/C07");
assert.match(migracion, /v_tipo !~ '\^\[A-Z\]\[A-Z0-9_\]\{1,39\}\$'/, "Debe validar el formato del tipo de documento igual que la tabla");
assert.match(migracion, /v_codigo !~ '\^\[A-Z0-9\]\[A-Z0-9\.\_\/-\]\{0,19\}\$'/, "Debe validar el formato del código de serie igual que la tabla");
assert.match(migracion, /v_nueva:=not found/, "Debe distinguir crear de reactivar una serie existente");
assert.doesNotMatch(migracion, /siguiente_numero\s*=\s*1[^;]*where id=v_serie\.id/, "Reactivar una serie existente no debe reiniciar su numeración");
assert.match(migracion, /grant execute on function public\.abc_configurar_serie_documental[\s\S]*to authenticated/, "Debe limitarse a usuarios autenticados");
assert.match(migracion, /revoke all on function public\.abc_configurar_serie_documental[\s\S]*from public, anon, authenticated, service_role/, "Debe revocar antes de conceder, igual que el resto de RPC");

console.log("PLAN_MAESTRO_ETAPA5_T6_FACTURA_SECCION_UI=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_FACTURA_SOLO_PAGADO=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_FACTURA_MODO_SIMULADOR=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_FACTURA_ORDEN_LLAMADAS=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_FACTURA_MIGRACION_SERIE=PASS");
