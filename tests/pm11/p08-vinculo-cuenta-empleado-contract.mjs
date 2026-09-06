import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/20260906094500_pm11_vinculo_cuenta_empleado_integridad.sql', 'utf8');
const evidence = fs.readFileSync('tests/pm11/P08_VINCULO_CUENTA_EMPLEADO_INTEGRIDAD_EVIDENCIA.md', 'utf8');
const p03 = fs.readFileSync('tests/pm11/P03_CONTRATO_IDENTIDAD_CICLO_VIDA_PERSONAL.md', 'utf8');
const p07 = fs.readFileSync('tests/pm11/P07_MIGRACION_CONTROLADA_EMPLEADOS_LEGACY_EVIDENCIA.md', 'utf8');

function requireText(haystack, needle, label = needle) {
  if (!haystack.includes(needle)) {
    throw new Error(`PM11 P08 falta contrato: ${label}`);
  }
}

for (const [needle, label] of [
  ['constraint pm11_perfiles_empleado_fk', 'FK perfiles.empleado_id -> empleados'],
  ['references public.empleados(id)', 'referencia empleados'],
  ['on delete restrict', 'borrado restrictivo'],
  ['create unique index pm11_perfiles_empleado_unico', 'vínculo 1:1'],
  ['private.pm11_perfiles_vinculo_guard()', 'guard perfil'],
  ['private.pm11_membresias_vinculo_guard()', 'guard membresía'],
  ['create or replace function private.la_usuario_activo()', 'acceso condicionado por empleado'],
  ['e.estado = \'activo\'', 'empleado activo requerido para acceso'],
  ['private.pm11_propietario_puede_gestionar_vinculo', 'autoridad propietario'],
  ['public.pm11_vincular_cuenta_empleado(', 'RPC vincular'],
  ['public.pm11_desvincular_cuenta_empleado(', 'RPC desvincular'],
  ["m.rol = 'Propietario'", 'solo Propietario'],
  ['cuenta_sin_membresia_compatible_empleado', 'membresía compatible'],
  ['empleado_cuenta_ya_vinculada', 'anti duplicidad empleado'],
  ['cuenta_ya_vinculada_otro_empleado', 'anti duplicidad cuenta'],
  ['Personal · vincular cuenta empleado', 'auditoría vínculo'],
  ['Personal · desvincular cuenta empleado', 'auditoría desvínculo'],
  ['revoke all on function public.pm11_vincular_cuenta_empleado', 'anon/public revocado vínculo'],
  ['grant execute on function public.pm11_vincular_cuenta_empleado', 'authenticated vínculo'],
]) requireText(sql, needle, label);

for (const needle of [
  'PM11_P08_QA_TRANSACCIONAL=PASS',
  'PM11_P08_AUTOGESTION_BLOQUEADA=PASS',
  'residuos `P08-QA-*` en empleados: `0`',
  'producción `crear-cuenta-empleado`',
  'PM11_P08_VINCULO_CUENTA_EMPLEADO_INTEGRIDAD=PASS',
  'SIGUIENTE=PM11_P09_CREACION_CUENTA_EMPLEADO_SEGURA',
]) requireText(evidence, needle);

requireText(p03, 'Un empleado no puede estar vinculado a dos usuarios de acceso.', 'invariante P03 empleado único');
requireText(p03, 'Una baja lógica debe deshabilitar el acceso efectivo asociado', 'invariante P03 baja/acceso');
requireText(p07, 'PM11_P07_MIGRACION_CONTROLADA_EMPLEADOS_LEGACY=PASS', 'P07 cerrado');

console.log('PM11 P08 vínculo cuenta ↔ empleado: contrato OK');
