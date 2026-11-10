-- M-03: la barrera MFA no puede depender solo del cliente.
--
-- Esta migración extrae la definición vigente de
-- `private.la_usuario_activo()` desde
-- `20261108193000_n02_reconcile_deployed_db_functions.sql` y añade una sola
-- condición: las membresías activas de Propietario, Encargado y Cajero/a
-- necesitan un JWT con `aal2`. Los demás roles mantienen la guarda existente.
-- Producción queda fuera de esta auditoría: esta migración se versiona para
-- una promoción posterior y se aplica solo en QA durante la verificación.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure('private.la_usuario_activo()') is null then
    raise exception 'M03 requiere private.la_usuario_activo()';
  end if;
end
$preflight$;

create or replace function private.la_usuario_activo()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select (select auth.uid()) is not null
     and exists(
       select 1 from public.membresias_usuario m
        where m.user_id=(select auth.uid()) and m.activo=true
     )
     and not exists(
       select 1 from public.perfiles p
        where p.user_id=(select auth.uid()) and p.activo=false
     )
     and not exists(
       select 1
         from public.perfiles p
         join public.empleados e on e.id = p.empleado_id
        where p.user_id=(select auth.uid()) and e.estado is distinct from 'activo'
     )
     and (
       not exists(
         select 1
           from public.membresias_usuario m
          where m.user_id=(select auth.uid())
            and m.activo=true
            and m.rol in ('Propietario', 'Encargado', 'Cajero/a')
       )
       or coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
     );
$function$;

revoke all on function private.la_usuario_activo() from public, anon, authenticated;

commit;
