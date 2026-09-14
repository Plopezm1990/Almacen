import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const pm08 = fs.readFileSync('supabase/migrations/20260904204500_pm08_caja_devolucion_indivisible.sql', 'utf8');
const pm09 = fs.readFileSync('supabase/migrations/20260905105500_pm09_conciliacion_caja.sql', 'utf8');
const pm09Fecha = fs.readFileSync('supabase/migrations/20260905115000_pm09_fecha_operacion_economica.sql', 'utf8');
const pm09Global = fs.readFileSync('supabase/migrations/20260905120500_pm09_operation_id_global_hardening.sql', 'utf8');

function check(name, ok) {
  console.log(`PM27_C17_${name}=${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) process.exitCode = 1;
}

// 1) ARQUEOS: un único cierre activo diario y cálculo económico autoritativo en servidor.
check('ARQUEO_UNICO_DIA_LOCAL', pm08.includes('create unique index if not exists pm08_un_arqueo_activo_dia_local')
  && pm08.includes("where estado = 'ACTIVO'"));
check('ARQUEO_REPLAY_EXACTO', pm09.includes('if v_existente.payload=v_payload then')
  && pm09.includes("raise exception 'operation_id_conflict'"));
check('ARQUEO_BASE_SERVIDOR', pm09.includes('v_resumen_ventas := private.pm09_resumen_caja_ventas(p_empresa_id,p_local_id,p_fecha)')
  && pm09.includes('v_base := private.pm08_validar_dinero(v_ventas_efectivo+v_efectivo_otros,true,false)'));

// 2) CIERRES: un arqueo activo cierra el periodo para mutaciones económicas posteriores.
const cierreGuard = "where empresa_id=p_empresa_id and local_id=p_local_id and fecha=p_fecha and estado='ACTIVO'";
check('CIERRE_BLOQUEA_MOVIMIENTOS', pm08.includes(cierreGuard) && pm08.includes("raise exception 'periodo_caja_cerrado'"));
check('CIERRE_BLOQUEA_REEMBOLSO_EFECTIVO', pm08.includes("v_reembolso>0 and v_medio='EFECTIVO' and exists(")
  && pm08.includes("raise exception 'periodo_caja_cerrado'"));
check('ANULACION_TRAZABLE_NO_DELETE', pm08.includes('create table if not exists public.arqueos_caja_anulaciones')
  && pm08.includes("set estado='ANULADO',anulado_por_operation_id=v_operation_id"));

// 3) DUPLICADOS / REPLAY: un operation_id se serializa y es único entre ledgers.
check('OPERATION_ID_SERIALIZADO', pm08.includes("pg_advisory_xact_lock(hashtextextended('la-suite-pm08:' || p_operation_id, 0))"));
check('OPERATION_ID_GLOBAL_CAJA_ARQUEOS', pm09Global.includes('public.caja_operaciones where operation_id=v_operation_id')
  && pm09Global.includes('public.arqueos_caja where operation_id=v_operation_id')
  && pm09Global.includes('public.arqueos_caja_anulaciones where operation_id=v_operation_id'));
check('REPLAY_CONFLICTO_PAYLOAD', pm08.includes("return jsonb_build_object('ok',true,'replayed',true")
  && pm08.includes("raise exception 'operation_id_conflict'"));

// 4) PERMISOS: operar y corregir son permisos distintos y siempre acotados a empresa/local.
check('ROL_OPERAR_CAJA', pm08.includes("coalesce(private.la_rol(),'') in ('Propietario','Encargado','Cajero/a')"));
check('ROL_CORREGIR_CAJA', pm08.includes("coalesce(private.la_rol(),'') in ('Propietario','Encargado')"));
check('CONTEXTO_EMPRESA_LOCAL', pm08.includes('not private.la_tiene_empresa(p_empresa_id)')
  && pm08.includes('not private.la_tiene_local(p_empresa_id,p_local_id)'));
check('RLS_LECTURA_LOCAL', pm08.includes('create policy pm08_caja_select on public.caja_operaciones')
  && pm08.includes('using (private.la_tiene_local(empresa_id, local_id))'));

// 5) CONSISTENCIA: ventas/reversos por fecha económica, empresa/local y sin doble contar devoluciones.
check('RESUMEN_EMPRESA_LOCAL', pm09Fecha.includes('where m.empresa_id=p_empresa_id')
  && pm09Fecha.includes('and m.local_id=p_local_id'));
check('FECHA_ECONOMICA_EXPLICITA', pm09Fecha.includes("datos->>'fechaOperacion'")
  && pm09Fecha.includes("timezone('UTC',m.created_at)::date"));
check('SOLO_VENTA_REVERSO', pm09Fecha.includes("m.tipo in ('VENTA','REVERSO')"));
check('FORMULA_ESPERADO', pm09.includes('v_esperado := private.pm08_validar_dinero(v_base+v_reversos_efectivo+v_efectos,true,true)'));
check('DEVOLUCION_NO_DUPLICA', pm09.includes('sus reembolsos ya viven en caja_operaciones'));

if (process.exitCode) throw new Error('PM27_C17_STATIC_CONTRACT_FAIL');

// Reutilizar los contratos históricos que ya prueban frontend, migración, replay,
// aislamiento, conciliación numérica y robustez. Se ejecutan como procesos separados
// para que cualquier regresión cierre el gate con error real.
const regressions = [
  'tests/pm08/frontend-contract.mjs',
  'tests/pm08/migration-contract.mjs',
  'tests/pm08/replay-scope-contract.mjs',
  'tests/pm09/p10-caja-contract.mjs',
  'tests/pm09/p16-isolation-context-contract.mjs',
  'tests/pm09/p17-robustness-contract.mjs',
];
for (const test of regressions) {
  console.log(`PM27_C17_RUN=${test}`);
  execFileSync(process.execPath, [test], { stdio: 'inherit' });
}

console.log('PM27_C17_ARQUEOS=PASS');
console.log('PM27_C17_CIERRES=PASS');
console.log('PM27_C17_DUPLICADOS=PASS');
console.log('PM27_C17_PERMISOS=PASS');
console.log('PM27_C17_CONSISTENCIA=PASS');
console.log('PM27_C17_RESULTADO=PASS');
