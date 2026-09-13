-- PM27 / C13 / Punto 5
-- Hardening puntual de helper SECURITY DEFINER usado por politicas RLS.
-- No cambia semantica ni firma: solo elimina search_path mutable y explicita ACL.

begin;

do $preflight$
begin
  if pg_catalog.to_regprocedure('private.es_propietario_activo()') is null then
    raise exception 'PM27_C13_PREFLIGHT: falta private.es_propietario_activo()';
  end if;
end
$preflight$;

-- La funcion ya usa referencias calificadas (public.perfiles, auth.uid()).
-- Con search_path vacio se elimina dependencia de esquemas mutables en un
-- SECURITY DEFINER sin alterar las politicas RLS que la invocan.
alter function private.es_propietario_activo() set search_path = '';

-- El helper es invocado por politicas RLS para sesiones authenticated.
-- Conservamos exactamente ese contrato y excluimos PUBLIC/anon.
revoke all on function private.es_propietario_activo() from public;
revoke all on function private.es_propietario_activo() from anon;
revoke all on function private.es_propietario_activo() from authenticated;
grant execute on function private.es_propietario_activo() to authenticated;

commit;
