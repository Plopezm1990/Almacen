import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fuente = fs.readFileSync(path.join(root, "fuente.js"), "utf8");
const espejo = fs.readFileSync(path.join(root, "source-recovery", "fuente-recuperado.js"), "utf8");
const migracion = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20261024070000_t6_propina_efectivo.sql"),
  "utf8"
);

// Hoja QA-4 (Etapa 5, T6, punto 2): «el cambio es propina». No toca
// abc_iniciar_cobro ni abc_confirmar_efectivo (ya probados): el efectivo se
// cobra exactamente igual que siempre, con su cambio real guardado en
// pagos.cambio_entregado. La propina es una llamada aparte, después, que
// registra ese mismo importe como abc_cobros_no_venta + caja_operaciones.
for (const [nombre, contenido] of [["fuente", fuente], ["espejo de recuperación", espejo]]) {
  assert.match(contenido, /"El cambio es propina"/, `${nombre}: falta el texto de la casilla`);
  assert.match(
    contenido,
    /cambioVisible !== null && cambioVisible > 0 \? \/\* @__PURE__ \*\/ import_react4\.default\.createElement\("label"/,
    `${nombre}: la casilla debe quedar oculta cuando no hay cambio a devolver`
  );
  assert.match(
    contenido,
    /propina: propinaCambioF4 && cambioVisible > 0/,
    `${nombre}: el botón "Cobrar efectivo" debe pasar el aviso de propina solo con cambio > 0`
  );
  assert.match(contenido, /propinaOperationId: "f4\.b02b03\.propina\." \+ intentoId/, `${nombre}: falta el operation_id idempotente de la propina`);
  assert.match(contenido, /abc_registrar_propina_efectivo/, `${nombre}: falta la llamada a la RPC de alta de propina`);
  assert.doesNotMatch(
    contenido,
    /cambioEntregado: cambioVisible == null \? 0 : cambioVisible,[\s\S]{0,5}propina: propinaCambioF4[\s\S]{0,400}cambioEntregado:\s*0\b/,
    `${nombre}: el cobro en efectivo no debe forzar cambioEntregado a 0; abc_confirmar_efectivo sigue recibiendo el cambio real`
  );
  // La llamada a abc_registrar_propina_efectivo debe ir después de que
  // abc_confirmar_efectivo ya se haya confirmado (no antes, no en su lugar).
  const idxConfirmar = contenido.indexOf('"abc_confirmar_efectivo"');
  const idxPropina = contenido.indexOf('"abc_registrar_propina_efectivo"');
  assert.ok(idxConfirmar > 0 && idxPropina > idxConfirmar, `${nombre}: la propina debe registrarse después de confirmar el efectivo`);
}

assert.match(migracion, /create or replace function public\.abc_registrar_propina_efectivo/, "Falta la función de alta de propina");
assert.match(migracion, /security definer/, "Debe ser security definer para insertar en abc_cobros_no_venta y caja_operaciones");
assert.match(migracion, /abc_tiene_capacidad\(p_empresa_id,p_local_id,'ABC_COBRO_INICIAR'\)/, "Debe exigir el mismo permiso que cobrar en efectivo");
assert.match(migracion, /if v_pago\.medio<>'EFECTIVO' then raise exception 'abc_propina_solo_efectivo'/, "Solo debe aceptar pagos en EFECTIVO");
assert.match(migracion, /if v_pago\.estado<>'CONFIRMADO'/, "El pago debe estar ya confirmado");
assert.match(migracion, /if v_importe<>round\(v_pago\.cambio_entregado,8\)/, "El importe de la propina debe coincidir exactamente con el cambio del pago");
assert.match(migracion, /abc_propina_ya_registrada/, "Debe impedir registrar dos veces la propina del mismo pago");
assert.match(migracion, /'ABC_COBRO_NO_VENTA',v_propina_id::text/, "El movimiento de caja debe declarar su origen como cobro no-venta");
assert.match(migracion, /now\(\),'PROPINA'/, "El movimiento de caja debe quedar en la categoría PROPINA");
assert.match(migracion, /'PROPINA',v_importe,/, "La fila de abc_cobros_no_venta debe clasificarse como concepto PROPINA");
assert.match(migracion, /grant execute on function public\.abc_registrar_propina_efectivo[\s\S]*to authenticated/, "Debe limitarse a usuarios autenticados");
assert.doesNotMatch(migracion, /tratamiento_fiscal\s*=|documento_requerido\s*=|cuenta_contable\s*=/, "No debe decidir tratamiento fiscal, documental ni contable (sigue PENDIENTE_ASESORIA)");

console.log("PLAN_MAESTRO_ETAPA5_T6_PROPINA_CASILLA=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_PROPINA_NO_TOCA_COBRO_EFECTIVO=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_PROPINA_ORDEN_LLAMADAS=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_PROPINA_MIGRACION=PASS");
