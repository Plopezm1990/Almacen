import fs from 'node:fs';

const migration = fs.readFileSync(
  'supabase/migrations/20261001230000_abc_f5_pm09_security_hardening.sql',
  'utf8',
);

const wrappers = [
  'public.registrar_devolucion_venta_pm09',
  'public.registrar_venta_stock_pm09',
  'public.registrar_venta_stock_carrito_pm09',
  'public.revertir_venta_stock_pm09',
  'public.revertir_venta_stock_carrito_pm09',
];

function check(name, ok) {
  console.log(`PM09_SECURITY_${name}=${ok ? 1 : 0}`);
  if (!ok) process.exitCode = 1;
}

check('CANDIDATE_ONLY_MARKER', migration.includes('Local candidate only'));
check('PRIVATE_GLOBAL_GUARD_EMPTY_PATH', /function private\.pm09_bloquear_operation_id_stock[\s\S]*?set search_path = ''/i.test(migration));

for (const wrapper of wrappers) {
  const functionName = wrapper.replace('.', '\\.')
  check(`${wrapper.replaceAll('.', '_')}_SECURITY_DEFINER`, new RegExp(`function ${functionName}[\\s\\S]*?security definer`, 'i').test(migration));
  check(`${wrapper.replaceAll('.', '_')}_EMPTY_PATH`, new RegExp(`function ${functionName}[\\s\\S]*?set search_path = ''`, 'i').test(migration));
  check(`${wrapper.replaceAll('.', '_')}_AUTHENTICATED_GRANT`, migration.includes(`grant execute on function ${wrapper}`) && migration.includes('to authenticated'));
  check(`${wrapper.replaceAll('.', '_')}_SERVICE_ROLE_REVOKE`, migration.includes(`revoke all on function ${wrapper}`) && migration.includes('from public, anon, service_role'));
}

check('NO_ANON_GRANT', !/grant execute[\s\S]*?to anon/i.test(migration));
check('GLOBAL_CONFLICT_GUARD', migration.includes("raise exception 'operation_id_conflict'") && migration.includes('private.pm08_bloquear_operation_id'));
check('DATE_REQUIRED_GUARD', (migration.match(/raise exception 'fecha_requerida'/g) || []).length === 5);
check('BASE_DELEGATES_KEPT', [
  'public.registrar_devolucion_venta(',
  'public.registrar_venta_stock(',
  'public.registrar_venta_stock_carrito(',
  'public.revertir_venta_stock(',
  'public.revertir_venta_stock_carrito(',
].every((call) => migration.includes(call)));
check('ECONOMIC_DATE_PRESERVED', (migration.match(/jsonb_build_object\('fechaOperacion',p_fecha\)/g) || []).length >= 10);
check('QUALIFIED_BUSINESS_REFERENCES', !migration.includes('update movimientos_stock') && !migration.includes('from movimientos_stock'));

if (process.exitCode) throw new Error('PM09_SECURITY_HARDENING_CONTRACT_FAIL');
console.log('PM09_SECURITY_HARDENING_CONTRACT_OK=1');
