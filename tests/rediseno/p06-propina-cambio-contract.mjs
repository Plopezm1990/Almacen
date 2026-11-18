import assert from 'node:assert/strict';
import fs from 'node:fs';

const fuente = fs.readFileSync('fuente.js', 'utf8');
const espejo = fs.readFileSync('source-recovery/fuente-recuperado.js', 'utf8');
const migracion = fs.readFileSync('supabase/migrations/20261024070000_t6_propina_efectivo.sql', 'utf8');

for (const [nombre, contenido] of [['fuente', fuente], ['espejo', espejo]]) {
  assert.match(contenido, /"El cambio es propina"/, `${nombre}: falta la casilla de propina`);
  assert.match(contenido, /propinaCambioF4 && cambioVisible > 0/, `${nombre}: la propina debe depender de un cambio positivo`);
  assert.match(contenido, /propinaOperationId: "f4\.b02b03\.propina\." \+ intentoId/, `${nombre}: falta el operation id idempotente`);
  assert.match(contenido, /"abc_registrar_propina_efectivo"/, `${nombre}: falta la RPC de propina`);
  const confirmar = contenido.indexOf('"abc_confirmar_efectivo"');
  const propina = contenido.indexOf('"abc_registrar_propina_efectivo"');
  assert.ok(confirmar > 0 && propina > confirmar, `${nombre}: la propina debe registrarse después del efectivo confirmado`);
  assert.match(contenido, /El cambio sigue pendiente de devolver/, `${nombre}: falta el camino honesto de error`);
  assert.match(contenido, /estadoCerrado\.mensaje = `Efectivo confirmado, pero la cuenta sigue abierta:/, `${nombre}: el cierre fallido debe explicar por qué la cuenta sigue abierta`);
  assert.match(contenido, /const errorCobro = resultado\?\.error \|\| "No se pudo iniciar el cobro\.";[\s\S]*await refrescarCobroF4\(\);[\s\S]*setErrorCobroF4\(errorCobro\)/, `${nombre}: la recarga no debe borrar el error del cobro`);
  assert.match(contenido, /function limpiarContextoCuentaA02\(empresaId, localId\)/, `${nombre}: falta limpiar el puntero local de una cuenta de día cerrado`);
  assert.match(contenido, /limpiarContextoCuentaA02\(empresaId, localActivoId\);[\s\S]*cuenta_recuperacion_otro_dia/, `${nombre}: una cuenta de día cerrado no debe quedar activa en el TPV`);
  assert.match(contenido, /String\(resultado\.error\)\.includes\("otro día operativo"\)[\s\S]*setPedidoOperativoA05\(null\)/, `${nombre}: el TPV debe retirar los controles de cobro de una cuenta obsoleta`);
}

assert.match(migracion, /create or replace function public\.abc_registrar_propina_efectivo/);
assert.match(migracion, /security definer/);
assert.match(migracion, /abc_tiene_capacidad\(p_empresa_id,p_local_id,'ABC_COBRO_INICIAR'\)/);
assert.match(migracion, /if v_pago\.medio<>'EFECTIVO' then raise exception 'abc_propina_solo_efectivo'/);
assert.match(migracion, /if v_pago\.estado<>'CONFIRMADO'/);
assert.match(migracion, /if v_importe<>round\(v_pago\.cambio_entregado,8\)/);
assert.match(migracion, /abc_propina_ya_registrada/);
assert.match(migracion, /'ABC_COBRO_NO_VENTA',v_propina_id::text/);
assert.match(migracion, /now\(\),'PROPINA'/);
assert.match(migracion, /grant execute on function public\.abc_registrar_propina_efectivo[\s\S]*to authenticated/);
assert.doesNotMatch(migracion, /tratamiento_fiscal\s*=|documento_requerido\s*=|cuenta_contable\s*=/);

console.log('REDISENO_P06_PROPINA_CONTRACT=PASS');
