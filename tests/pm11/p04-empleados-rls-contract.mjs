import fs from 'node:fs';
import assert from 'node:assert/strict';

const entidadPath = 'supabase/migrations/20260906081500_pm11_empleados_entidad_rls.sql';
const guardPerfilPath = 'supabase/migrations/20260906082500_pm11_guard_perfiles_sensibles.sql';
const evidenciaPath = 'tests/pm11/P04_ENTIDAD_SQL_EMPLEADOS_RLS_EVIDENCIA.md';

for (const p of [entidadPath, guardPerfilPath, evidenciaPath]) {
  assert.ok(fs.existsSync(p), `falta artefacto P04: ${p}`);
}

const sql = fs.readFileSync(entidadPath, 'utf8');
const guard = fs.readFileSync(guardPerfilPath, 'utf8');
const evidencia = fs.readFileSync(evidenciaPath, 'utf8');

for (const marker of [
  'create table if not exists public.empleados',
  'id text primary key',
  'empresa_id text not null',
  'local_id text not null',
  "estado text not null default 'activo'",
  'datos jsonb not null',
  'baja_at timestamptz',
  'reactivado_at timestamptz',
  'anonimizado_at timestamptz',
  'pm11_empleado_local_concreto',
  "estado in ('activo', 'inactivo', 'anonimizado')",
  'private.pm11_empleados_guard()',
  'empleado_empresa_inmutable',
  'empleado_local_cambio_requiere_traslado',
  'empleado_anonimizado_terminal',
  'private.pm11_puede_ver_personal(',
  'from public.membresias_usuario m',
  "m.rol = 'Propietario'",
  "m.rol = 'Encargado'",
  'alter table public.empleados enable row level security',
  'create policy pm11_empleados_select_gestion',
  'revoke all on public.empleados from anon, authenticated',
  'grant select on public.empleados to authenticated'
]) {
  assert.ok(sql.includes(marker), `migración entidad/RLS incompleta: ${marker}`);
}

// El helper de autorización de Personal debe usar la membresía como autoridad
// del rol/ámbito; no debe depender de perfiles.rol mediante la_rol().
const helperIni = sql.indexOf('create or replace function private.pm11_puede_ver_personal(');
const helperFin = sql.indexOf('alter table public.empleados enable row level security', helperIni);
assert.ok(helperIni >= 0 && helperFin > helperIni, 'helper PM11 no localizable');
const helper = sql.slice(helperIni, helperFin);
assert.ok(helper.includes('public.membresias_usuario'));
assert.ok(!helper.includes('private.la_rol()'), 'RLS PM11 no debe confiar en perfiles.rol autogestionable');
assert.ok(helper.includes("m.rol = 'Encargado' and m.todos_locales = false"), 'Encargado no puede usar todos_locales');

for (const marker of [
  'private.pm11_perfiles_guard_sensible()',
  "current_user = 'authenticated'",
  'perfil_rol_no_autogestionable',
  'perfil_activo_no_autogestionable',
  'perfil_empleado_no_autogestionable',
  'before update on public.perfiles'
]) {
  assert.ok(guard.includes(marker), `hardening de perfiles incompleto: ${marker}`);
}

for (const marker of [
  'PM11_P04_ENTIDAD_SQL_EMPLEADOS_RLS=PASS',
  '20260906060647',
  '20260906060830',
  'Propietario A',
  'Encargado A2',
  'Cajero A1',
  'autoescalada',
  '**empleados restantes al cerrar P04: 0**',
  'SIGUIENTE=PM11_P05_RPC_ALTA_EDICION_BAJA_REACTIVACION'
]) {
  assert.ok(evidencia.includes(marker), `evidencia P04 incompleta: ${marker}`);
}

console.log('PM11 P04 entidad empleados + RLS: contrato OK');
