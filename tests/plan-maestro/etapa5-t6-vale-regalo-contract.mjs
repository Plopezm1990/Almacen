import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fuente = fs.readFileSync(path.join(root, "fuente.js"), "utf8");
const espejo = fs.readFileSync(path.join(root, "source-recovery", "fuente-recuperado.js"), "utf8");
const migracion = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20261024120000_t6_vale_regalo.sql"),
  "utf8"
);

// Hoja QA-7 (Etapa 5, T6, punto 5): «vale regalo». Importe libre, sin
// caducidad (decisión de Pedro, 24/10/2026). Dos flujos separados: vender
// (nueva sección, siempre visible, como "Factura a empresa") y canjear
// (dentro de Cobro·F4, como forma de pago). El canje reutiliza
// abc_iniciar_cobro con medio='OTRO' (ya admitido por el servidor sin
// cambios) y abc_resolver_intento (el mismo helper que ya usa el
// resolutor de tarjeta simulada de QA-3) — no se inventa un cobro aparte.
for (const [nombre, contenido] of [["fuente", fuente], ["espejo de recuperación", espejo]]) {
  // Sección "Vender vale regalo": debe ser siempre visible, no depender de
  // que haya una cuenta/pedido abierto (a diferencia de Factura/Ticket/
  // Canjear, todas dentro de Cobro·F4).
  assert.match(contenido, /function renderValeRegaloF4\(\)/, `${nombre}: falta la función de render siempre visible`);
  assert.match(contenido, /"Vender vale regalo"/, `${nombre}: falta el botón de venta`);
  assert.match(
    contenido,
    /renderValeRegaloF4\(\),\s*\n\s*renderSalaA07\(\)/,
    `${nombre}: renderValeRegaloF4 debe llamarse en el nivel superior del render, no dentro de Cobro·F4 (debe estar visible sin cuenta abierta)`
  );

  // Las 3 funciones de orquestación.
  assert.match(contenido, /async function emitirValeRegaloF4\(\{ importe \} = \{\}\)/, `${nombre}: falta emitirValeRegaloF4`);
  assert.match(contenido, /async function consultarValeRegaloF4\(codigo\)/, `${nombre}: falta consultarValeRegaloF4`);
  assert.match(contenido, /async function pagarConValeRegaloF4\(\{ codigo \} = \{\}\)/, `${nombre}: falta pagarConValeRegaloF4`);

  // Venta: solo efectivo en esta primera versión, usa el patrón de caja de
  // la propina (QA-4) y el día operativo real del servidor.
  assert.match(
    contenido,
    /rpcA02ConRecuperacion\(supabase, "abc_emitir_vale_regalo"/,
    `${nombre}: la venta debe llamar a abc_emitir_vale_regalo`
  );
  assert.match(
    contenido,
    /abc_obtener_dia_operativo_local/,
    `${nombre}: la venta debe pedir el día operativo real del servidor, nunca calcularlo en el cliente`
  );

  // Canje: reconciliación del checkout_id (patrón ya usado en
  // iniciarCobroCuentaF4), medio='OTRO', y el resolutor nuevo — nunca un
  // importe fabricado en el cliente.
  assert.match(
    contenido,
    /const checkoutIdReal = preparado\?\.checkout_id \|\| checkoutId;/,
    `${nombre}: el canje debe reconciliar el checkout_id devuelto por el servidor, no asumir el generado localmente`
  );
  assert.match(
    contenido,
    /p_medio: "OTRO"/,
    `${nombre}: el canje debe iniciar el cobro con medio OTRO (ya admitido por el servidor sin cambios)`
  );
  assert.match(
    contenido,
    /rpcA02ConRecuperacion\(supabase, "abc_confirmar_pago_vale_regalo"/,
    `${nombre}: el canje debe resolver el intento con abc_confirmar_pago_vale_regalo`
  );
  assert.match(
    contenido,
    /if \(estado\.cobroIncierto\) return \{ ok: false, error: "Hay un cobro pendiente o incierto\. Resuélvelo antes de aplicar un vale\." \};/,
    `${nombre}: el canje debe bloquearse si hay un cobro incierto, igual que el resto de medios de pago`
  );

  // UI de canje dentro de Cobro·F4.
  assert.match(contenido, /"Vale regalo \(código\)"/, `${nombre}: falta el campo de código en Cobro·F4`);
  assert.match(contenido, /onClick: pagarConValeRegaloF4UI, disabled: procesandoCanjeValeRegaloF4 \|\| !valeRegaloCodigoCanjeF4\.trim\(\) \}/, `${nombre}: el botón de canje debe depender solo de que haya un código y no haya otro canje en curso`);

  // Traducciones de error (deben existir en ambos archivos).
  for (const codigo of [
    "abc_vale_regalo_no_autorizado",
    "vale_regalo_importe_invalido",
    "vale_regalo_codigo_requerido",
    "vale_regalo_no_encontrado",
    "vale_regalo_no_activo",
    "vale_regalo_saldo_insuficiente",
  ]) {
    assert.match(
      contenido,
      new RegExp(`msg\\.includes\\("${codigo}"\\)`),
      `${nombre}: falta la traducción del error ${codigo}`
    );
  }

  // Los 4 puntos de conexión: destructuring de crearLogicaVenta, su
  // return, las props de <VentaRapida>, y los parámetros de VentaRapida.
  // Aprendido del hallazgo real de la Hoja QA-5 (24/10/2026): una función
  // bien escrita pero nunca conectada no hace nada, sin ningún aviso
  // visible.
  for (const funcName of ["emitirValeRegaloF4", "consultarValeRegaloF4", "pagarConValeRegaloF4"]) {
    const ocurrencias = contenido.match(new RegExp(`\\b${funcName}\\b`, "g")) || [];
    assert.ok(
      ocurrencias.length >= 4,
      `${nombre}: ${funcName} debe aparecer al menos en los 4 puntos de conexión; encontradas: ${ocurrencias.length}`
    );
  }
}

// Dual-file parity: las funciones de orquestación deben ser idénticas
// carácter a carácter entre fuente.js y el espejo de recuperación.
{
  const inicioFuente = fuente.indexOf("async function emitirValeRegaloF4(");
  const finFuente = fuente.indexOf("\n  // Modalidad de la cuenta al abrirla", inicioFuente);
  const inicioEspejo = espejo.indexOf("async function emitirValeRegaloF4(");
  const finEspejo = espejo.indexOf("\n  // Modalidad de la cuenta al abrirla", inicioEspejo);
  assert.ok(inicioFuente > 0 && finFuente > inicioFuente, "fuente: no se pudo delimitar el bloque de orquestación del vale regalo");
  assert.ok(inicioEspejo > 0 && finEspejo > inicioEspejo, "espejo: no se pudo delimitar el bloque de orquestación del vale regalo");
  assert.equal(
    fuente.slice(inicioFuente, finFuente),
    espejo.slice(inicioEspejo, finEspejo),
    "Las funciones emitirValeRegaloF4/consultarValeRegaloF4/pagarConValeRegaloF4 deben ser idénticas entre fuente.js y el espejo de recuperación"
  );
}

// Migración: permisos, idempotencia, y que el dinero nunca se invente.
assert.match(migracion, /create table public\.abc_vales_regalo/, "Falta la tabla de vales regalo");
assert.match(migracion, /revoke all on table public\.abc_vales_regalo from public, anon, authenticated, service_role;/, "La tabla debe estar cerrada: acceso solo vía RPC security definer");
assert.match(
  migracion,
  /not private\.abc_tiene_capacidad\(p_empresa_id,p_local_id,'ABC_COBRO_INICIAR'\)\s*\n\s*or not private\.abc_tiene_capacidad\(p_empresa_id,p_local_id,'ABC_COBRO_EFECTIVO'\)/,
  "Vender un vale debe exigir los mismos permisos que un cobro en efectivo"
);
assert.match(migracion, /constraint abc_vale_regalo_saldo check \(saldo_actual >= 0 and saldo_actual <= importe_inicial\)/, "El saldo debe estar siempre entre 0 y el importe inicial");
assert.match(migracion, /constraint abc_vale_regalo_codigo_uq unique \(empresa_id, codigo\)/, "El código debe ser único por empresa");
assert.match(
  migracion,
  /v_cmd:=private\.abc_operacion_iniciar\(p_operation_id,p_empresa_id,p_local_id,'ABC_EMITIR_VALE_REGALO',v_request,p_terminal_id\);/,
  "La venta debe seguir el patrón idempotente abc_operacion_iniciar/completar/fallar (abc_eventos exige una fila previa en abc_operaciones)"
);
assert.match(
  migracion,
  /v_cmd:=private\.abc_operacion_iniciar\(p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIRMAR_PAGO_VALE_REGALO',v_request,null\);/,
  "El canje también debe seguir el patrón idempotente"
);
assert.match(
  migracion,
  /if v_pago\.medio <> 'OTRO' then raise exception 'vale_regalo_medio_incorrecto'; end if;/,
  "El canje debe validar que el pago sea de medio OTRO antes de resolverlo"
);
assert.match(
  migracion,
  /if v_vale\.saldo_actual < v_pago\.importe_objetivo then raise exception 'vale_regalo_saldo_insuficiente'; end if;/,
  "El canje debe comprobar el saldo real del vale antes de descontar nada"
);
assert.match(
  migracion,
  /v_resolucion := public\.abc_resolver_intento\(\s*\n\s*'vale\.regalo\.resolver\.' \|\| replace\(p_intento_id::text,'-',''\),\s*\n\s*p_empresa_id, p_local_id, p_intento_id, 'CONFIRMADO',/,
  "El canje debe resolver el intento con abc_resolver_intento (el mismo helper ya usado por el simulador de tarjeta de QA-3), nunca con un cobro inventado aparte"
);
assert.doesNotMatch(
  migracion,
  /p_importe_aplicado|p_saldo_restante/,
  "El importe aplicado y el saldo restante no deben poder llegar como parámetros desde el cliente"
);
assert.match(migracion, /grant execute on function public\.abc_emitir_vale_regalo[\s\S]*to authenticated;/, "abc_emitir_vale_regalo debe limitarse a usuarios autenticados");
assert.match(migracion, /grant execute on function public\.abc_consultar_vale_regalo[\s\S]*to authenticated;/, "abc_consultar_vale_regalo debe limitarse a usuarios autenticados");
assert.match(migracion, /grant execute on function public\.abc_confirmar_pago_vale_regalo[\s\S]*to authenticated;/, "abc_confirmar_pago_vale_regalo debe limitarse a usuarios autenticados");

console.log("PLAN_MAESTRO_ETAPA5_T6_VALE_REGALO_SECCION_UI=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_VALE_REGALO_SIEMPRE_VISIBLE=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_VALE_REGALO_CONEXION_COMPONENTE=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_VALE_REGALO_PARIDAD_DUAL=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_VALE_REGALO_MIGRACION=PASS");
