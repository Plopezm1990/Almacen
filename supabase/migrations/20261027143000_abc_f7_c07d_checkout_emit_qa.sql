-- ABC F7 C07-D.1 — enlaza checkout COMPLETADO con C05 y la cola C07-D.
-- QA-only en esta etapa: no llama a AEAT, no recibe certificados y no
-- almacena secretos. La serie se recibe desde la configuración del emisor.

do $$
begin
  if to_regprocedure('public.abc_reservar_numero_documental(text,text,text,text,text,text,jsonb)') is null
     or to_regprocedure('public.abc_resolver_emision_documental(text,text,text,uuid,text,jsonb)') is null
     or to_regprocedure('public.abc_c07d_registrar_documento_fiscal(text,text,text,uuid,jsonb)') is null then
    raise exception 'ABC_F7_C07D_D1_PREFLIGHT_FALLO:dependencias_c05_c07d_no_disponibles';
  end if;
end $$;

create or replace function public.abc_c07d_emitir_checkout(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid,
  p_tipo_documento text default 'FACTURA',
  p_codigo_serie text default 'TPV'
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
  v_documentos jsonb := '[]'::jsonb;
  v_tipo text := upper(btrim(coalesce(p_tipo_documento, '')));
  v_serie text := upper(btrim(coalesce(p_codigo_serie, '')));
  v_entidad uuid;
  v_numero_documentos integer := 0;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_EMISOR_CAMBIAR') then
    raise exception 'abc_documento_no_autorizado';
  end if;
  if p_operation_id is null or nullif(btrim(p_operation_id), '') is null
     or p_empresa_id is null or p_local_id is null or p_cuenta_id is null
     or v_tipo !~ '^[A-Z][A-Z0-9_]{1,39}$'
     or v_serie !~ '^[A-Z0-9][A-Z0-9._/-]{0,19}$' then
    raise exception 'c07d_checkout_parametros_invalidos';
  end if;

  v_entidad := private.abc_c05_entidad_para_local(p_empresa_id, p_local_id);
  v_request := jsonb_build_object(
    'cuenta_id', p_cuenta_id,
    'tipo_documento', v_tipo,
    'codigo_serie', v_serie,
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

  if not exists (
    select 1 from public.checkout_ventas cv
     where cv.empresa_id = p_empresa_id
       and cv.local_id = p_local_id
       and cv.checkout_id = v_checkout.id
  ) then
    raise exception 'c07d_checkout_sin_ventas';
  end if;

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
       and d.entidad_fiscal_id = v_entidad
       and d.documento_origen_id = v_venta.venta_fiscal_id::text
       and d.tipo_documento = v_tipo
       and d.codigo_serie = v_serie
     order by d.created_at desc
     limit 1
     for update;

    if not found then
      v_reserva := public.abc_reservar_numero_documental(
        p_operation_id || ':reserve:' || v_venta.venta_fiscal_id::text,
        p_empresa_id,
        p_local_id,
        v_tipo,
        v_serie,
        v_venta.venta_fiscal_id::text,
        jsonb_build_object(
          'checkout_id', v_checkout.id,
          'venta_fiscal_id', v_venta.venta_fiscal_id,
          'entidad_fiscal_id', v_entidad,
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
          'qa_only', true,
          'aeat_transport', 'DISABLED',
          'checkout_id', v_checkout.id,
          'venta_fiscal_id', v_venta.venta_fiscal_id,
          'cobro_confirmado', true
        )
      );
    end if;

    v_registro := public.abc_c07d_registrar_documento_fiscal(
      p_operation_id || ':c07d:' || v_documento.id::text,
      p_empresa_id,
      p_local_id,
      v_documento.id,
      jsonb_build_object(
        'qa_only', true,
        'aeat_transport', 'DISABLED',
        'checkout_id', v_checkout.id,
        'venta_fiscal_id', v_venta.venta_fiscal_id,
        'importe', v_venta.importe_objetivo,
        'currency_code', v_venta.currency_code,
        'cobro_confirmado', true
      )
    );

    v_numero_documentos := v_numero_documentos + 1;
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
    'codigo_serie', v_serie,
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

create or replace function public.abc_c07d_estado_cuenta(
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_entidad uuid;
  v_documentos jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_COBRO_INICIAR') then
    raise exception 'abc_documento_no_autorizado';
  end if;
  if p_empresa_id is null or p_local_id is null or p_cuenta_id is null then
    raise exception 'c07d_estado_parametros_invalidos';
  end if;
  v_entidad := private.abc_c05_entidad_para_local(p_empresa_id, p_local_id);
  select coalesce(jsonb_agg(jsonb_build_object(
    'venta_fiscal_id', vf.id,
    'documento_id', d.id,
    'tipo_documento', d.tipo_documento,
    'codigo_serie', d.codigo_serie,
    'numero', d.numero,
    'estado', d.estado,
    'registro_id', r.id,
    'secuencia', r.secuencia,
    'hash_sha256', r.hash_sha256,
    'cola_id', q.id,
    'cola_estado', q.estado,
    'created_at', d.created_at,
    'qa_only', true,
    'aeat_transport', 'DISABLED'
  ) order by d.created_at), '[]'::jsonb)
    into v_documentos
    from public.abc_c05_documentos_emitidos d
    join public.ventas_fiscales vf
      on vf.empresa_id = d.empresa_id
     and vf.local_id = d.local_id
     and vf.id::text = d.documento_origen_id
    left join public.abc_c07d_registros_fiscales r
      on r.empresa_id = d.empresa_id
     and r.entidad_fiscal_id = d.entidad_fiscal_id
     and r.documento_id = d.id
    left join public.abc_c07d_cola_fiscal q
      on q.empresa_id = r.empresa_id
     and q.entidad_fiscal_id = r.entidad_fiscal_id
     and q.registro_id = r.id
   where d.empresa_id = p_empresa_id
     and d.local_id = p_local_id
     and d.entidad_fiscal_id = v_entidad
     and vf.cuenta_id = p_cuenta_id;

  return jsonb_build_object(
    'ok', true,
    'cuenta_id', p_cuenta_id,
    'entidad_fiscal_id', v_entidad,
    'documentos', v_documentos,
    'qa_only', true,
    'aeat_transport', 'DISABLED'
  );
end $$;

revoke all on function public.abc_c07d_emitir_checkout(text,text,text,uuid,text,text)
  from public, anon, authenticated, service_role;
revoke all on function public.abc_c07d_estado_cuenta(text,text,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.abc_c07d_emitir_checkout(text,text,text,uuid,text,text)
  to authenticated;
grant execute on function public.abc_c07d_estado_cuenta(text,text,uuid)
  to authenticated;
