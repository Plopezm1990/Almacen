-- C07-D.2.3: el TPV consulta el estado fiscal resuelto por servidor.
-- QA primero. No contiene credenciales ni transporte AEAT.

do $$
begin
  if to_regclass('private.abc_c07d_emision_config') is null
     or to_regclass('public.abc_c05_series_documentales') is null
     or to_regprocedure('private.abc_c05_entidad_para_local(text,text)') is null
     or to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then
    raise exception 'ABC_F7_C07D_D2_3_PREFLIGHT_FALLO';
  end if;
end
$$;

create or replace function public.abc_c07d_estado_configuracion_emision(
  p_empresa_id text,
  p_local_id text,
  p_tipo_documento text default 'FACTURA'
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_tipo text := upper(btrim(coalesce(p_tipo_documento, '')));
  v_entidad uuid;
  v_config private.abc_c07d_emision_config%rowtype;
  v_serie public.abc_c05_series_documentales%rowtype;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_EMISOR_CAMBIAR') then
    raise exception 'C07D_CONFIG_NO_AUTORIZADO' using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_empresa_id, '')), '') is null
     or nullif(btrim(coalesce(p_local_id, '')), '') is null
     or v_tipo !~ '^[A-Z0-9_:-]{1,40}$' then
    raise exception 'C07D_CONFIG_PARAMETROS_INVALIDOS' using errcode = '22023';
  end if;

  v_entidad := private.abc_c05_entidad_para_local(p_empresa_id, p_local_id);

  select *
    into v_config
    from private.abc_c07d_emision_config c
   where c.empresa_id = p_empresa_id
     and c.local_id = p_local_id
     and c.entidad_fiscal_id = v_entidad
     and c.tipo_documento = v_tipo;

  if not found then
    return jsonb_build_object(
      'ok', true,
      'configurada', false,
      'estado', 'NO_CONFIGURADA',
      'empresa_id', p_empresa_id,
      'local_id', p_local_id,
      'entidad_fiscal_id', v_entidad,
      'tipo_documento', v_tipo
    );
  end if;

  select *
    into v_serie
    from public.abc_c05_series_documentales s
   where s.id = v_config.serie_id
     and s.empresa_id = v_config.empresa_id
     and s.local_id = v_config.local_id
     and s.entidad_fiscal_id = v_config.entidad_fiscal_id
     and s.tipo_documento = v_config.tipo_documento
     and s.activa = true;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'configurada', true,
      'estado', 'INVALIDA',
      'error', 'C07D_CONFIG_SERIE_NO_DISPONIBLE',
      'empresa_id', p_empresa_id,
      'local_id', p_local_id,
      'entidad_fiscal_id', v_entidad,
      'tipo_documento', v_tipo,
      'version', v_config.version
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'configurada', true,
    'estado', upper(coalesce(v_config.estado, '')),
    'configuracion', jsonb_build_object(
      'empresa_id', v_config.empresa_id,
      'local_id', v_config.local_id,
      'entidad_fiscal_id', v_config.entidad_fiscal_id,
      'tipo_documento', v_config.tipo_documento,
      'serie_id', v_config.serie_id,
      'codigo_serie', v_serie.codigo_serie,
      'nombre_serie', v_serie.nombre,
      'adapter_code', v_config.adapter_code,
      'environment', v_config.environment,
      'estado', v_config.estado,
      'version', v_config.version,
      'credential_configured', v_config.credential_ref is not null,
      'updated_at', v_config.updated_at
    )
  );
end
$function$;

revoke all on function public.abc_c07d_estado_configuracion_emision(text, text, text) from public;
revoke all on function public.abc_c07d_estado_configuracion_emision(text, text, text) from anon;
revoke all on function public.abc_c07d_estado_configuracion_emision(text, text, text) from authenticated;
revoke all on function public.abc_c07d_estado_configuracion_emision(text, text, text) from service_role;
grant execute on function public.abc_c07d_estado_configuracion_emision(text, text, text) to authenticated;
