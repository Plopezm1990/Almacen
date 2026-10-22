-- P2 · PM13 · corrección RLS de autoservicio post-reset
-- La rama de autoservicio debe evaluarse fuera del EXISTS sobre empleados,
-- porque empleados tiene su propio RLS de gestión y un trabajador no gestor
-- no debe necesitar visibilidad de la ficha de personal para leer sus fichajes.

begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $preflight$
begin
  if to_regclass('public.fichajes_registro') is null
     or to_regclass('public.empleados') is null
     or to_regprocedure('private.pm13_fichaje_actor_es_empleado(text)') is null
     or to_regprocedure('private.pm11_puede_ver_personal(text,text)') is null then
    raise exception 'P2_PM13_RLS_FIX_PREFLIGHT_FALLO';
  end if;
end $preflight$;

drop policy if exists pm13_fichajes_select_scope on public.fichajes_registro;

create policy pm13_fichajes_select_scope
on public.fichajes_registro
for select
to authenticated
using (
  private.pm13_fichaje_actor_es_empleado(fichajes_registro.datos->>'empleadoId')
  or exists (
    select 1
      from public.empleados e
     where e.id=fichajes_registro.datos->>'empleadoId'
       and e.local_id=fichajes_registro.datos->>'localId'
       and private.pm11_puede_ver_personal(e.empresa_id,e.local_id)
  )
);

commit;
