-- PM27 / C13 / Punto 5
-- Hardening puntual de helper SECURITY DEFINER usado por politicas RLS.
-- No cambia semantica ni firma cuando el helper existe: solo elimina search_path
-- mutable y explicita ACL. Si el helper ya fue retirado en un baseline posterior,
-- C24 solo permite continuar cuando no quedan dependencias textuales activas.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $hardening$
declare
  v_helper regprocedure := pg_catalog.to_regprocedure('private.es_propietario_activo()');
begin
  if v_helper is null then
    if exists (
      select 1
        from pg_catalog.pg_policies p
       where coalesce(p.qual, '') ilike '%es_propietario_activo%'
          or coalesce(p.with_check, '') ilike '%es_propietario_activo%'
    ) or exists (
      select 1
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       where coalesce(p.prosrc, '') ilike '%es_propietario_activo%'
         and not (n.nspname = 'private' and p.proname = 'es_propietario_activo')
    ) then
      raise exception 'PM27_C13_PREFLIGHT: helper es_propietario_activo ausente pero aun referenciado';
    end if;

    raise notice 'PM27_C13_PREFLIGHT: helper es_propietario_activo ya ausente y sin dependencias; hardening no aplicable';
  else
    -- La funcion ya usa referencias calificadas (public.perfiles, auth.uid()).
    -- Con search_path vacio se elimina dependencia de esquemas mutables en un
    -- SECURITY DEFINER sin alterar las politicas RLS que la invocan.
    execute $ddl$alter function private.es_propietario_activo() set search_path = ''$ddl$;

    -- El helper es invocado por politicas RLS para sesiones authenticated.
    -- Conservamos exactamente ese contrato y excluimos PUBLIC/anon.
    execute $ddl$revoke all on function private.es_propietario_activo() from public$ddl$;
    execute $ddl$revoke all on function private.es_propietario_activo() from anon$ddl$;
    execute $ddl$revoke all on function private.es_propietario_activo() from authenticated$ddl$;
    execute $ddl$grant execute on function private.es_propietario_activo() to authenticated$ddl$;
  end if;
end
$hardening$;

commit;
