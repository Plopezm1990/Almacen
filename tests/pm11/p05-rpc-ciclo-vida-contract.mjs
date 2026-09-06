import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260906084500_pm11_rpc_ciclo_vida_empleados.sql';
const evidencePath = 'tests/pm11/P05_RPC_CICLO_VIDA_EMPLEADOS_EVIDENCIA.md';

for (const p of [migrationPath, evidencePath]) {
  assert.ok(fs.existsSync(p), `falta artefacto P05: ${p}`);
}

const sql = fs.readFileSync(migrationPath, 'utf8');
const evidencia = fs.readFileSync(evidencePath, 'utf8');

for (const marker of [
  'private.pm11_local_activo(',
  "upper(btrim(p_local_id)) not in ('TODOS', 'TODOS LOS LOCALES')",
  'private.pm11_puede_mutar_personal(',
  'from public.membresias_usuario m',
  "m.rol = 'Propietario'",
  "m.rol = 'Encargado'",
  'm.todos_locales = false',
  'private.pm11_validar_datos_laborales(',
  "'horasSemanales'",
  "'pagas'",
  "'salarioBrutoMensual'",
  "'costeEmpresaMensual'",
  "'diasVacacionesAnuales'",
  'private.pm11_auditar_empleado(',
  'public.pm11_alta_empleado(',
  'public.pm11_editar_empleado(',
  'public.pm11_baja_empleado(',
  'public.pm11_reactivar_empleado(',
  'security definer',
  'for update',
  "v_empleado.estado <> 'activo'",
  "set estado = 'inactivo'",
  'baja_at = now()',
  "v_empleado.estado <> 'inactivo'",
  "set estado = 'activo'",
  'reactivado_at = now()',
  "'Personal · alta empleado'",
  "'Personal · editar empleado'",
  "'Personal · baja empleado'",
  "'Personal · reactivar empleado'",
  'grant execute on function public.pm11_alta_empleado',
  'grant execute on function public.pm11_editar_empleado',
  'grant execute on function public.pm11_baja_empleado',
  'grant execute on function public.pm11_reactivar_empleado'
]) {
  assert.ok(sql.toLowerCase().includes(marker.toLowerCase()), `migración P05 incompleta: ${marker}`);
}

// Baja = baja lógica: no puede contener un DELETE de empleados.
const bajaIni = sql.indexOf('create or replace function public.pm11_baja_empleado(');
const bajaFin = sql.indexOf('create or replace function public.pm11_reactivar_empleado(', bajaIni);
assert.ok(bajaIni >= 0 && bajaFin > bajaIni, 'RPC de baja no localizable');
const baja = sql.slice(bajaIni, bajaFin).toLowerCase();
assert.ok(!baja.includes('delete from public.empleados'), 'la baja no puede borrar físicamente empleados');
assert.ok(baja.includes("set estado = 'inactivo'"), 'la baja debe ser lógica');

// Las RPC deben validar contexto antes de mutar y no abrir escritura directa de tabla.
for (const fn of ['pm11_alta_empleado', 'pm11_editar_empleado', 'pm11_baja_empleado', 'pm11_reactivar_empleado']) {
  const pos = sql.indexOf(`create or replace function public.${fn}(`);
  assert.ok(pos >= 0, `falta ${fn}`);
  const next = sql.indexOf('create or replace function public.', pos + 20);
  const body = sql.slice(pos, next >= 0 ? next : sql.length);
  assert.ok(body.includes('private.pm11_puede_mutar_personal'), `${fn} no valida contexto autoritativo`);
}

for (const marker of [
  'PM11_P05_RPC_CICLO_VIDA_EMPLEADOS=PASS',
  '20260906061626',
  'P05-QA-A1',
  '4 eventos de auditoría',
  'empleado_id_ya_existe',
  'empleado_contexto_no_coincide',
  'personal_contexto_no_autorizado',
  'empleados `P05-*` restantes: **0**',
  'auditoría `P05-*` restante: **0**',
  'SIGUIENTE=PM11_P06_PUENTE_FRONTEND_SQL_EMPLEADOS'
]) {
  assert.ok(evidencia.includes(marker), `evidencia P05 incompleta: ${marker}`);
}

assert.ok(fs.existsSync('tests/pm11/p04-empleados-rls-contract.mjs'), 'debe conservar regresión P04');
assert.ok(fs.existsSync('tests/pm10/p07-personal-contract.mjs'), 'debe conservar regresión LA-017');

console.log('PM11 P05 RPC ciclo de vida empleados: contrato OK');
