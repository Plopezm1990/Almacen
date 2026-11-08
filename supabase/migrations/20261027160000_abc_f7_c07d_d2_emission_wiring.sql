-- ABC F7 C07-D.2.2 — emisión gobernada por configuración fiscal persistente.
-- QA-only en esta etapa: no llama a AEAT, no transporta certificados ni secretos.
-- La serie enviada por el cliente queda como referencia de auditoría; la serie
-- efectiva siempre se resuelve en servidor desde private.abc_c07d_emision_config.

do $$
begin
  if to_regprocedure('private.abc_c07d_resolver_emision_config(text,text,uuid,text)') is null
     or to_regprocedure('public.abc_c07d_registrar_documento_fiscal(text,text,text,uuid,jsonb)') is null
     or to_regprocedure('public.abc_reservar_numero_documental(text,text,text,text,text,text,jsonb)') is null
     or to_regprocedure('public.abc_resolver_emision_documental(text,text,text,uuid,text,jsonb)') is null then
    raise exception 'ABC_F7_C07D_D2_2_PREFLIGHT_FALLO:dependencias_emision_no_disponibles';
  end if;
end $$;

create or replace function public.abc_c07d_emitir_checkout(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid,
  p_tipo_documento text default 'FACTURA',
  p_codigo_serie text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cmd jsonb;
  v_request jsonb;
  v_result jsonb;
  v_checkout public.checkouts%rowtype;
  v_venta record;
  v_documento public.abc_c05_documentos_emitidos%rowtype;
  v_reserva jsonb;
  v_emision jsonb;
  v_registro jsonb;
  v_config jsonb;
  v_documentos jsonb := '[]'::jsonb;
  v_tipo text := upper(btrim(coalesce(p_tipo_documento, '')));
  v_serie_resuelta text;
  v_serie_solicitada text := nullif(upper(btrim(coalesce(p_codigo_serie, ''))), '');
  v_entidad_local uuid;
  v_numero_documentos integer := 0;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_EMISOR_CAMBIAR') then
    raise exception 'abc_documento_no_autorizado';
  end if;
  if p_operation_id is null or nullif(btrim(p_operation_id), '') is null
     or p_empresa_id is null or p_local_id is null or p_cuenta_id is null
     or v_tipo !~ '^[A-Z][A-Z0-9_]{1,39}$' then
    raise exception 'c07d_checkout_parametros_invalidos';
  end if;

  v_request := jsonb_build_object(
    'cuenta_id', p_cuenta_id,
    'tipo_documento', v_tipo,
    'serie_solicitada_cliente', v_serie_solicitada,
    'qa_only', true,
    'aeat_transport', 'DISABLED'
  );
  v_cmd := private.abc_operacion_iniciar(
    p_operation_id, p_empresa_id, p_local_id,
    'ABC_C07D_EMITIR_CHECKOUT', v_request, null
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado', v_cmd);
  end if;

  select c.* into v_checkout
    from public.checkouts c
   where c.empresa_id = p_empresa_id
     and c.local_id = p_local_id
     and c.cuenta_id = p_cuenta_id
     and c.estado = 'COMPLETADO'
   order by c.completed_at desc nulls last, c.created_at desc
   limit 1
   for update;
  if not found then
    raise exception 'c07d_checkout_no_completado';
  end if;

  select count(*)::integer into v_numero_documentos
    from public.checkout_ventas cv
   where cv.empresa_id = p_empresa_id
     and cv.local_id = p_local_id
     and cv.checkout_id = v_checkout.id;
  if v_numero_documentos = 0 then
    raise exception 'c07d_checkout_sin_ventas';
  end if;

  -- La cadena C05/C07-D existente trabaja con una única entidad activa por
  -- local. Se comprueba antes de cualquier reserva para evitar emisiones
  -- parciales si el checkout contiene una venta de otra entidad.
  v_entidad_local := private.abc_c05_entidad_para_local(p_empresa_id, p_local_id);

  -- Preflight completo: resolver toda la configuración antes de mutar C05/C07-D.
  for v_venta in
    select cv.venta_fiscal_id, cv.importe_objetivo,
           vf.entidad_fiscal_id, vf.currency_code
      from public.checkout_ventas cv
      join public.ventas_fiscales vf
        on vf.empresa_id = cv.empresa_id
       and vf.local_id = cv.local_id
       and vf.id = cv.venta_fiscal_id
     where cv.empresa_id = p_empresa_id
       and cv.local_id = p_local_id
       and cv.checkout_id = v_checkout.id
     order by cv.venta_fiscal_id
  loop
    if v_venta.entidad_fiscal_id <> v_entidad_local then
      raise exception 'C07D_VENTA_ENTIDAD_NO_CORRESPONDE';
    end if;
    v_config := private.abc_c07d_resolver_emision_config(
      p_empresa_id,
      p_local_id,
      v_venta.entidad_fiscal_id,
      v_tipo
    );
    if v_serie_resuelta is null then
      v_serie_resuelta := upper(btrim(v_config->>'codigo_serie'));
    elsif v_serie_resuelta <> upper(btrim(v_config->>'codigo_serie')) then
      raise exception 'C07D_CHECKOUT_CONFIG_INCONSISTENTE';
    end if;
  end loop;

  for v_venta in
    select cv.venta_fiscal_id, cv.importe_objetivo,
           vf.entidad_fiscal_id, vf.currency_code
      from public.checkout_ventas cv
      join public.ventas_fiscales vf
        on vf.empresa_id = cv.empresa_id
       and vf.local_id = cv.local_id
       and vf.id = cv.venta_fiscal_id
     where cv.empresa_id = p_empresa_id
       and cv.local_id = p_local_id
       and cv.checkout_id = v_checkout.id
     order by cv.venta_fiscal_id
  loop
    select d.* into v_documento
      from public.abc_c05_documentos_emitidos d
     where d.empresa_id = p_empresa_id
       and d.local_id = p_local_id
       and d.entidad_fiscal_id = v_entidad_local
       and d.documento_origen_id = v_venta.venta_fiscal_id::text
       and d.tipo_documento = v_tipo
       and d.codigo_serie = v_serie_resuelta
     order by d.created_at desc
     limit 1
     for update;

    if not found then
      v_reserva := public.abc_reservar_numero_documental(
        p_operation_id || ':reserve:' || v_venta.venta_fiscal_id::text,
        p_empresa_id,
        p_local_id,
        v_tipo,
        v_serie_resuelta,
        v_venta.venta_fiscal_id::text,
        jsonb_build_object(
          'checkout_id', v_checkout.id,
          'venta_fiscal_id', v_venta.venta_fiscal_id,
          'entidad_fiscal_id', v_entidad_local,
          'serie_resuelta_en_servidor', v_serie_resuelta,
          'serie_solicitada_cliente', v_serie_solicitada,
          'qa_only', true,
          'aeat_transport', 'DISABLED'
        )
      );
      select d.* into v_documento
        from public.abc_c05_documentos_emitidos d
       where d.id = (v_reserva->>'documento_id')::uuid
       for update;
    end if;

    if v_documento.estado = 'RESERVADO' then
      v_emision := public.abc_resolver_emision_documental(
        p_operation_id || ':emit:' || v_documento.id::text,
        p_empresa_id,
        p_local_id,
        v_documento.id,
        'EMITIDO',
        jsonb_build_object(
          'checkout_id', v_checkout.id,
          'venta_fiscal_id', v_venta.venta_fiscal_id,
          'serie_resuelta_en_servidor', v_serie_resuelta,
          'serie_solicitada_cliente', v_serie_solicitada,
          'configuracion_fiscal', jsonb_build_object(
            'serie_id', v_config->'configuracion'->>'serie_id',
            'adapter_code', v_config->'configuracion'->>'adapter_code',
            'environment', v_config->'configuracion'->>'environment',
            'version', v_config->'configuracion'->>'version'
          ),
          'cobro_confirmado', true,
          'qa_only', true,
          'aeat_transport', 'DISABLED'
        )
      );
    end if;

    v_registro := public.abc_c07d_registrar_documento_fiscal(
      p_operation_id || ':c07d:' || v_documento.id::text,
      p_empresa_id,
      p_local_id,
      v_documento.id,
      jsonb_build_object(
        'checkout_id', v_checkout.id,
        'venta_fiscal_id', v_venta.venta_fiscal_id,
        'importe', v_venta.importe_objetivo,
        'currency_code', v_venta.currency_code,
        'serie_resuelta_en_servidor', v_serie_resuelta,
        'serie_solicitada_cliente', v_serie_solicitada,
        'configuracion_fiscal', jsonb_build_object(
          'serie_id', v_config->'configuracion'->>'serie_id',
          'adapter_code', v_config->'configuracion'->>'adapter_code',
          'environment', v_config->'configuracion'->>'environment',
          'version', v_config->'configuracion'->>'version'
        ),
        'cobro_confirmado', true,
        'qa_only', true,
        'aeat_transport', 'DISABLED'
      )
    );

    v_documentos := v_documentos || jsonb_build_array(jsonb_build_object(
      'venta_fiscal_id', v_venta.venta_fiscal_id,
      'documento_id', v_documento.id,
      'tipo_documento', v_documento.tipo_documento,
      'codigo_serie', v_documento.codigo_serie,
      'numero', v_documento.numero,
      'estado', 'EMITIDO',
      'registro_id', v_registro->'registro_id',
      'secuencia', v_registro->'secuencia',
      'hash_sha256', v_registro->'hash_sha256',
      'cola_estado', v_registro->'cola_estado',
      'qa_only', true,
      'aeat_transport', 'DISABLED'
    ));
  end loop;

  v_result := jsonb_build_object(
    'ok', true,
    'replayed', false,
    'checkout_id', v_checkout.id,
    'cuenta_id', p_cuenta_id,
    'tipo_documento', v_tipo,
    'codigo_serie', v_serie_resuelta,
    'serie_solicitada_cliente', v_serie_solicitada,
    'serie_resuelta_en_servidor', v_serie_resuelta,
    'configuracion_fiscal', jsonb_build_object(
      'serie_id', v_config->'configuracion'->>'serie_id',
      'adapter_code', v_config->'configuracion'->>'adapter_code',
      'environment', v_config->'configuracion'->>'environment',
      'version', v_config->'configuracion'->>'version'
    ),
    'documentos', v_documentos,
    'numero_documentos', v_numero_documentos,
    'cola_estado', 'PENDIENTE',
    'qa_only', true,
    'aeat_transport', 'DISABLED'
  );
  perform private.abc_operacion_completar(p_operation_id, v_result);
  return v_result;
exception when others then
  begin
    perform private.abc_operacion_fallar(
      p_operation_id,
      jsonb_build_object('sqlstate', sqlstate, 'message', sqlerrm)
    );
  exception when others then null;
  end;
  raise;
end $$;

revoke all on function public.abc_c07d_emitir_checkout(text,text,text,uuid,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.abc_c07d_emitir_checkout(text,text,text,uuid,text,text)
  to authenticated;
