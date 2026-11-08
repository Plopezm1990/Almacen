-- PM13-P05 — la lectura directa de empleados respeta PM13_PERSONAL_CONSULTAR.
-- La aplicación ya aplica el permiso en su adaptador de storage; esta política
-- mantiene el mismo límite en la tabla expuesta al Data API.

do $preflight$
begin
  if to_regclass('public.empleados') is null then
    raise exception 'PM13_P05_RLS_PREFLIGHT_FALLO:empleados';
  end if;
  if to_regprocedure('public.pm13_resolver_cargo_permiso(text,text,text,text,text,text)') is null then
    raise exception 'PM13_P05_RLS_PREFLIGHT_FALLO:resolver';
  end if;
end
$preflight$;

drop policy if exists pm11_empleados_select_gestion on public.empleados;
drop policy if exists pm13_empleados_select_consulta on public.empleados;

create policy pm13_empleados_select_consulta
on public.empleados
for select
to authenticated
using (
  (
    public.pm13_resolver_cargo_permiso(
      empresa_id,
      local_id,
      'PM13_PERSONAL_CONSULTAR',
      'CONSULTAR',
      'LOCAL',
      null
    )->>'permitido'
  ) = 'true'
);

comment on policy pm13_empleados_select_consulta on public.empleados is
  'La lectura directa exige PM13_PERSONAL_CONSULTAR para el contexto autenticado; denegación por defecto.';
