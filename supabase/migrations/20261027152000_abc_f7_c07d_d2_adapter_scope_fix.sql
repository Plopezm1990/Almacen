-- ABC F7 C07-D.2.1 — el catálogo de adaptadores no depende de una entidad única.

create or replace function public.abc_c07d_listar_adaptadores_fiscales(
  p_empresa_id text,
  p_local_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_adaptadores jsonb;
begin
  if auth.uid() is null
     or not exists (
       select 1 from public.membresias_usuario m
        where m.user_id = auth.uid()
          and m.empresa_id = p_empresa_id
          and m.activo
          and m.rol = 'Propietario'
          and m.todos_locales
          and m.local_id is null
     )
     or not exists (select 1 from public.empresas e where e.id = p_empresa_id and e.activo)
     or not exists (select 1 from public.locales l where l.empresa_id = p_empresa_id and l.id = p_local_id and l.activo) then
    raise exception 'C07D_CONFIG_NO_AUTORIZADO' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'adapter_code', a.adapter_code,
    'display_name', a.display_name,
    'adapter_version', a.adapter_version,
    'environments', a.environments,
    'credential_required', a.credential_required,
    'capabilities', a.capabilities
  ) order by a.adapter_code), '[]'::jsonb)
    into v_adaptadores
    from private.abc_c07d_adaptadores_fiscales a
   where a.enabled;
  return jsonb_build_object(
    'ok', true,
    'empresa_id', p_empresa_id,
    'local_id', p_local_id,
    'adaptadores', v_adaptadores
  );
end $$;

revoke all on function public.abc_c07d_listar_adaptadores_fiscales(text,text) from public,anon,authenticated,service_role;
grant execute on function public.abc_c07d_listar_adaptadores_fiscales(text,text) to authenticated;
