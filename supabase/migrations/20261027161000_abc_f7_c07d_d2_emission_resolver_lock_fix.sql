-- Corrección C07-D.2.2: el resolver toma FOR SHARE para impedir que cambie
-- la configuración durante una emisión, por lo que debe ser VOLATILE.

create or replace function private.abc_c07d_resolver_emision_config(
  p_empresa_id text,
  p_local_id text,
  p_entidad_fiscal_id uuid,
  p_tipo_documento text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_config private.abc_c07d_emision_config%rowtype;
  v_adapter private.abc_c07d_adaptadores_fiscales%rowtype;
  v_serie public.abc_c05_series_documentales%rowtype;
begin
  select * into v_config
    from private.abc_c07d_emision_config c
   where c.empresa_id = p_empresa_id
     and c.local_id = p_local_id
     and c.entidad_fiscal_id = p_entidad_fiscal_id
     and c.tipo_documento = upper(btrim(coalesce(p_tipo_documento,'')))
   for share;
  if not found then
    raise exception 'C07D_CONFIG_EMISION_AUSENTE';
  end if;
  if v_config.estado not in ('VALIDADA','ACTIVA') then
    raise exception 'C07D_CONFIG_EMISION_NO_VALIDADA';
  end if;
  select * into v_adapter
    from private.abc_c07d_adaptadores_fiscales a
   where a.adapter_code = v_config.adapter_code
     and a.enabled;
  if not found or not (v_config.environment = any(v_adapter.environments)) then
    raise exception 'C07D_ADAPTADOR_NO_DISPONIBLE';
  end if;
  select * into v_serie
    from public.abc_c05_series_documentales s
   where s.id = v_config.serie_id
     and s.activa
     and s.empresa_id = v_config.empresa_id
     and s.local_id = v_config.local_id
     and s.entidad_fiscal_id = v_config.entidad_fiscal_id
     and s.tipo_documento = v_config.tipo_documento;
  if not found then
    raise exception 'C07D_CONFIG_SERIE_NO_DISPONIBLE';
  end if;
  return jsonb_build_object(
    'ok', true,
    'configuracion', private.abc_c07d_emision_resultado(v_config),
    'codigo_serie', v_serie.codigo_serie,
    'nombre_serie', v_serie.nombre,
    'adapter_version', v_adapter.adapter_version,
    'credential_ref', v_config.credential_ref,
    'capabilities', v_adapter.capabilities
  );
end $$;

revoke all on function private.abc_c07d_resolver_emision_config(text,text,uuid,text)
  from public, anon, authenticated, service_role;
