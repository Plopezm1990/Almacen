-- ABC F2 M03C — autoridad transaccional de reembolsos.
-- Aditiva. No toca stock: reembolso economico != retorno/merma.
-- Depende de M01/M01b + M02A + M02B + M03A + M03B.

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.reembolsos') is null then v_missing:=array_append(v_missing,'reembolsos'); end if;
  if to_regclass('public.reembolso_aplicaciones') is null then v_missing:=array_append(v_missing,'reembolso_aplicaciones'); end if;
  if to_regclass('public.pagos') is null then v_missing:=array_append(v_missing,'pagos'); end if;
  if to_regclass('public.pago_aplicaciones') is null then v_missing:=array_append(v_missing,'pago_aplicaciones'); end if;
  if to_regclass('public.caja_operaciones') is null then v_missing:=array_append(v_missing,'caja_operaciones'); end if;
  if to_regclass('public.caja_sesiones') is null then v_missing:=array_append(v_missing,'caja_sesiones'); end if;
  if to_regclass('public.caja_sesion_terminales') is null then v_missing:=array_append(v_missing,'caja_sesion_terminales'); end if;

  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_iniciar_sistema(text,text,text,text,jsonb,uuid,uuid,text)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar_sistema'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.abc_max_reembolsable_pago(text,text,uuid)') is null then v_missing:=array_append(v_missing,'abc_max_reembolsable_pago'); end if;
  if to_regprocedure('private.abc_max_reembolsable_venta(text,text,uuid)') is null then v_missing:=array_append(v_missing,'abc_max_reembolsable_venta'); end if;
  if to_regprocedure('private.abc_bloquear_aplicaciones(text,text,uuid[])') is null then v_missing:=array_append(v_missing,'abc_bloquear_aplicaciones'); end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then v_missing:=array_append(v_missing,'authenticated'); end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then v_missing:=array_append(v_missing,'service_role'); end if;

  if cardinality(v_missing)>0 then
    raise exception 'ABC_F2_M03C_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  if exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='reembolsos'
      and column_name='provider_snapshot'
  )
  or to_regprocedure('private.abc_actualizar_pago_reembolso_estado(text,text,uuid)') is not null
  or to_regprocedure('public.abc_solicitar_reembolso(text,text,text,uuid,uuid,numeric,text,uuid,date)') is not null
  or to_regprocedure('public.abc_cancelar_reembolso(text,text,text,uuid,text,uuid,date)') is not null
  or to_regprocedure('public.abc_confirmar_reembolso_efectivo(text,text,text,uuid,uuid,uuid,uuid,date)') is not null
  or to_regprocedure('public.abc_resolver_reembolso(text,text,text,uuid,text,text,text,jsonb,date)') is not null then
    raise exception 'ABC_F2_M03C_PREFLIGHT_FALLO: objetos M03C ya existen';
  end if;
end $$;

alter table public.reembolsos
  add column provider_snapshot jsonb not null default '{}'::jsonb;

create function private.abc_actualizar_pago_reembolso_estado(
  p_empresa_id text,
  p_local_id text,
  p_pago_id uuid
)
returns text
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_pago public.pagos%rowtype;
  v_original numeric(24,8);
  v_confirmado numeric(24,8);
begin
  select *
    into v_pago
    from public.pagos
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_pago_id
   for update;

  if not found then raise exception 'pago_no_encontrado'; end if;
  if v_pago.estado not in ('CONFIRMADO','REEMBOLSADO') then
    raise exception 'pago_no_reembolsable';
  end if;

  select coalesce(sum(a.payment_amount),0)::numeric(24,8)
    into v_original
    from public.pago_aplicaciones a
   where a.empresa_id=p_empresa_id
     and a.local_id=p_local_id
     and a.pago_id=p_pago_id;

  if v_original<=0 then raise exception 'pago_sin_aplicaciones_confirmadas'; end if;

  select coalesce(sum(ra.importe_pago),0)::numeric(24,8)
    into v_confirmado
    from public.reembolso_aplicaciones ra
    join public.reembolsos r
      on r.empresa_id=ra.empresa_id
     and r.local_id=ra.local_id
     and r.id=ra.reembolso_id
   where ra.empresa_id=p_empresa_id
     and ra.local_id=p_local_id
     and r.pago_id=p_pago_id
     and r.estado='CONFIRMADO';

  if v_confirmado>v_original then
    raise exception 'reembolso_confirmado_excede_pago';
  end if;

  if v_confirmado=v_original then
    if v_pago.estado<>'REEMBOLSADO' then
      update public.pagos
         set estado='REEMBOLSADO',
             resolved_at=now(),
             version=version+1
       where empresa_id=p_empresa_id
         and local_id=p_local_id
         and id=p_pago_id;
    end if;
    return 'REEMBOLSADO';
  end if;

  if v_pago.estado='REEMBOLSADO' then
    raise exception 'pago_reembolsado_inconsistente';
  end if;

  update public.pagos
     set version=version+1
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_pago_id;

  return 'CONFIRMADO';
end $$;

create function public.abc_solicitar_reembolso(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_reembolso_id uuid,
  p_pago_id uuid,
  p_importe_solicitado numeric,
  p_motivo text,
  p_terminal_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_cmd jsonb;
  v_request jsonb;
  v_pago public.pagos%rowtype;
  v_importe numeric(24,8);
  v_motivo text:=btrim(coalesce(p_motivo,''));
  v_ids uuid[];
  v_total_disponible numeric(24,8):=0;
  v_restante numeric(24,8);
  v_disp_pago numeric(24,8);
  v_disp_venta numeric(24,8);
  v_asignado numeric(24,8);
  r record;
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(
       p_empresa_id,p_local_id,'ABC_REEMBOLSO_SOLICITAR'
     ) then
    raise exception 'abc_reembolso_no_autorizado';
  end if;

  if p_reembolso_id is null or p_pago_id is null or p_operating_day is null then
    raise exception 'reembolso_parametros_requeridos';
  end if;
  if p_importe_solicitado is null or p_importe_solicitado<=0 then
    raise exception 'importe_reembolso_invalido';
  end if;
  if p_importe_solicitado<>round(p_importe_solicitado,8) then
    raise exception 'importe_reembolso_precision_invalida';
  end if;
  if v_motivo='' then raise exception 'motivo_reembolso_requerido'; end if;

  v_importe:=p_importe_solicitado::numeric(24,8);
  v_request:=jsonb_build_object(
    'reembolso_id',p_reembolso_id,
    'pago_id',p_pago_id,
    'importe_solicitado',v_importe,
    'motivo',v_motivo,
    'terminal_id',p_terminal_id,
    'operating_day',p_operating_day
  );

  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,
    'ABC_SOLICITAR_REEMBOLSO',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select *
    into v_pago
    from public.pagos
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_pago_id
   for update;

  if not found then raise exception 'pago_no_encontrado'; end if;
  if v_pago.estado<>'CONFIRMADO' then raise exception 'pago_no_reembolsable'; end if;
  if v_pago.payment_currency_code<>v_pago.sale_currency_code then
    raise exception 'conversion_reembolso_no_habilitada';
  end if;

  select array_agg(a.id order by a.id)
    into v_ids
    from public.pago_aplicaciones a
   where a.empresa_id=p_empresa_id
     and a.local_id=p_local_id
     and a.pago_id=p_pago_id;

  if v_ids is null or cardinality(v_ids)=0 then
    raise exception 'pago_sin_aplicaciones_confirmadas';
  end if;

  perform private.abc_bloquear_aplicaciones(
    p_empresa_id,p_local_id,v_ids
  );

  for r in
    select a.*
      from public.pago_aplicaciones a
     where a.empresa_id=p_empresa_id
       and a.local_id=p_local_id
       and a.pago_id=p_pago_id
     order by a.confirmed_at,a.id
  loop
    if r.payment_currency_code<>r.sale_currency_code
       or r.payment_amount<>r.sale_amount then
      raise exception 'conversion_reembolso_no_habilitada';
    end if;
    v_disp_pago:=private.abc_max_reembolsable_pago(
      p_empresa_id,p_local_id,r.id
    );
    v_disp_venta:=private.abc_max_reembolsable_venta(
      p_empresa_id,p_local_id,r.id
    );
    v_total_disponible:=v_total_disponible+least(v_disp_pago,v_disp_venta);
  end loop;

  if v_importe>v_total_disponible then
    raise exception 'saldo_reembolsable_insuficiente';
  end if;

  insert into public.reembolsos(
    id,empresa_id,local_id,pago_id,abc_command_id,estado,
    payment_currency_code,importe_solicitado,motivo,created_by
  ) values (
    p_reembolso_id,p_empresa_id,p_local_id,p_pago_id,p_operation_id,'PENDIENTE',
    v_pago.payment_currency_code,v_importe,v_motivo,auth.uid()
  );

  v_restante:=v_importe;
  for r in
    select a.*
      from public.pago_aplicaciones a
     where a.empresa_id=p_empresa_id
       and a.local_id=p_local_id
       and a.pago_id=p_pago_id
     order by a.confirmed_at,a.id
  loop
    exit when v_restante<=0;

    v_disp_pago:=private.abc_max_reembolsable_pago(
      p_empresa_id,p_local_id,r.id
    );
    v_disp_venta:=private.abc_max_reembolsable_venta(
      p_empresa_id,p_local_id,r.id
    );
    v_asignado:=least(v_restante,v_disp_pago,v_disp_venta);

    if v_asignado>0 then
      insert into public.reembolso_aplicaciones(
        id,empresa_id,local_id,reembolso_id,pago_aplicacion_id,
        venta_fiscal_id,importe_venta,sale_currency_code,
        importe_pago,payment_currency_code
      ) values (
        gen_random_uuid(),p_empresa_id,p_local_id,p_reembolso_id,r.id,
        r.venta_fiscal_id,v_asignado,r.sale_currency_code,
        v_asignado,r.payment_currency_code
      );
      v_restante:=v_restante-v_asignado;
    end if;
  end loop;

  if v_restante<>0 then raise exception 'reembolso_reserva_incompleta'; end if;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'REEMBOLSO',p_reembolso_id::text,
    'REEMBOLSO_SOLICITADO',
    jsonb_build_object(
      'pago_id',p_pago_id,
      'importe',v_importe,
      'currency_code',v_pago.payment_currency_code,
      'motivo',v_motivo
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,
    'reembolso_id',p_reembolso_id,
    'pago_id',p_pago_id,
    'estado','PENDIENTE',
    'importe_comprometido',v_importe,
    'currency_code',v_pago.payment_currency_code
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_cancelar_reembolso(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_reembolso_id uuid,
  p_motivo_cancelacion text,
  p_terminal_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_cmd jsonb;
  v_request jsonb;
  v_reembolso public.reembolsos%rowtype;
  v_motivo text:=btrim(coalesce(p_motivo_cancelacion,''));
  v_ids uuid[];
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(
       p_empresa_id,p_local_id,'ABC_REEMBOLSO_CONFIRMAR'
     ) then
    raise exception 'abc_cancelar_reembolso_no_autorizado';
  end if;
  if p_reembolso_id is null or p_operating_day is null then
    raise exception 'cancelacion_reembolso_parametros_requeridos';
  end if;
  if v_motivo='' then raise exception 'motivo_cancelacion_requerido'; end if;

  v_request:=jsonb_build_object(
    'reembolso_id',p_reembolso_id,
    'motivo_cancelacion',v_motivo,
    'terminal_id',p_terminal_id,
    'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,
    'ABC_CANCELAR_REEMBOLSO',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select *
    into v_reembolso
    from public.reembolsos
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_reembolso_id
   for update;

  if not found then raise exception 'reembolso_no_encontrado'; end if;
  if v_reembolso.estado<>'PENDIENTE' then
    raise exception 'reembolso_no_cancelable';
  end if;
  if v_reembolso.provider_code is not null
     or v_reembolso.provider_reference is not null then
    raise exception 'reembolso_enviado_a_proveedor';
  end if;

  select array_agg(ra.pago_aplicacion_id order by ra.pago_aplicacion_id)
    into v_ids
    from public.reembolso_aplicaciones ra
   where ra.empresa_id=p_empresa_id
     and ra.local_id=p_local_id
     and ra.reembolso_id=p_reembolso_id;

  if v_ids is null then raise exception 'reembolso_sin_aplicaciones'; end if;
  perform private.abc_bloquear_aplicaciones(
    p_empresa_id,p_local_id,v_ids
  );

  update public.reembolsos
     set estado='CANCELADO',
         resolved_at=now()
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_reembolso_id;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'REEMBOLSO',p_reembolso_id::text,
    'REEMBOLSO_CANCELADO',
    jsonb_build_object(
      'pago_id',v_reembolso.pago_id,
      'importe',v_reembolso.importe_solicitado,
      'motivo_cancelacion',v_motivo
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'reembolso_id',p_reembolso_id,'estado','CANCELADO'
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_confirmar_reembolso_efectivo(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_reembolso_id uuid,
  p_caja_id uuid,
  p_session_id uuid,
  p_terminal_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_cmd jsonb;
  v_request jsonb;
  v_reembolso public.reembolsos%rowtype;
  v_pago public.pagos%rowtype;
  v_ids uuid[];
  v_cash_operation_id text;
  v_pago_estado text;
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(
       p_empresa_id,p_local_id,'ABC_REEMBOLSO_CONFIRMAR'
     ) then
    raise exception 'abc_confirmar_reembolso_no_autorizado';
  end if;
  if p_reembolso_id is null or p_caja_id is null or p_session_id is null
     or p_terminal_id is null or p_operating_day is null then
    raise exception 'reembolso_efectivo_parametros_requeridos';
  end if;

  v_request:=jsonb_build_object(
    'reembolso_id',p_reembolso_id,
    'caja_id',p_caja_id,
    'session_id',p_session_id,
    'terminal_id',p_terminal_id,
    'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,
    'ABC_CONFIRMAR_REEMBOLSO_EFECTIVO',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select r.*,p.*
    into v_reembolso,v_pago
    from public.reembolsos r
    join public.pagos p
      on p.empresa_id=r.empresa_id
     and p.local_id=r.local_id
     and p.id=r.pago_id
   where r.empresa_id=p_empresa_id
     and r.local_id=p_local_id
     and r.id=p_reembolso_id
   for update of r,p;

  if not found then raise exception 'reembolso_no_encontrado'; end if;
  if v_reembolso.estado<>'PENDIENTE' then
    raise exception 'reembolso_efectivo_no_confirmable';
  end if;
  if v_pago.medio<>'EFECTIVO' then raise exception 'reembolso_no_efectivo'; end if;
  if v_reembolso.provider_code is not null
     or v_reembolso.provider_reference is not null then
    raise exception 'reembolso_efectivo_con_proveedor';
  end if;

  perform 1
    from public.caja_sesiones s
   where s.empresa_id=p_empresa_id
     and s.local_id=p_local_id
     and s.id=p_session_id
     and s.caja_id=p_caja_id
     and s.estado='ABIERTA'
   for update;
  if not found then raise exception 'sesion_caja_no_abierta'; end if;

  if not exists(
    select 1
      from public.caja_sesion_terminales st
     where st.empresa_id=p_empresa_id
       and st.local_id=p_local_id
       and st.session_id=p_session_id
       and st.terminal_id=p_terminal_id
       and st.hasta is null
       and st.desde<=now()
  ) then
    raise exception 'terminal_no_vinculado_sesion';
  end if;

  select array_agg(ra.pago_aplicacion_id order by ra.pago_aplicacion_id)
    into v_ids
    from public.reembolso_aplicaciones ra
   where ra.empresa_id=p_empresa_id
     and ra.local_id=p_local_id
     and ra.reembolso_id=p_reembolso_id;

  if v_ids is null then raise exception 'reembolso_sin_aplicaciones'; end if;
  perform private.abc_bloquear_aplicaciones(
    p_empresa_id,p_local_id,v_ids
  );

  update public.reembolsos
     set estado='CONFIRMADO',
         resolved_at=now()
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_reembolso_id;

  v_cash_operation_id:='abc.refund.cash.'||
    private.abc_request_hash(
      jsonb_build_object(
        'command',p_operation_id,
        'reembolso_id',p_reembolso_id
      )
    );

  insert into public.caja_operaciones(
    operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,
    medio_pago,concepto,origen_tipo,origen_id,payload,actor_user_id,
    abc_command_id,caja_id,session_id,terminal_id,currency_code,
    operating_day,occurred_at,categoria
  ) values (
    v_cash_operation_id,'REEMBOLSO',p_empresa_id,p_local_id,p_operating_day,
    v_reembolso.importe_solicitado,-v_reembolso.importe_solicitado,
    'EFECTIVO','Reembolso ABC en efectivo','ABC_REEMBOLSO',
    p_reembolso_id::text,
    jsonb_build_object(
      'reembolso_id',p_reembolso_id,
      'pago_id',v_reembolso.pago_id,
      'motivo',v_reembolso.motivo
    ),
    auth.uid(),p_operation_id,p_caja_id,p_session_id,p_terminal_id,
    v_reembolso.payment_currency_code,p_operating_day,now(),
    'REEMBOLSO_VENTA'
  );

  v_pago_estado:=private.abc_actualizar_pago_reembolso_estado(
    p_empresa_id,p_local_id,v_reembolso.pago_id
  );

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'REEMBOLSO',p_reembolso_id::text,
    'REEMBOLSO_EFECTIVO_CONFIRMADO',
    jsonb_build_object(
      'pago_id',v_reembolso.pago_id,
      'importe',v_reembolso.importe_solicitado,
      'caja_operation_id',v_cash_operation_id,
      'pago_estado',v_pago_estado
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,
    'reembolso_id',p_reembolso_id,
    'estado','CONFIRMADO',
    'pago_estado',v_pago_estado,
    'caja_operation_id',v_cash_operation_id
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_resolver_reembolso(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_reembolso_id uuid,
  p_estado text,
  p_provider_code text,
  p_provider_reference text,
  p_provider_snapshot jsonb,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_estado text:=upper(btrim(coalesce(p_estado,'')));
  v_provider text:=nullif(btrim(coalesce(p_provider_code,'')),'');
  v_reference text:=nullif(btrim(coalesce(p_provider_reference,'')),'');
  v_snapshot jsonb:=coalesce(p_provider_snapshot,'{}'::jsonb);
  v_reembolso public.reembolsos%rowtype;
  v_pago public.pagos%rowtype;
  v_terminal_id uuid;
  v_request jsonb;
  v_cmd jsonb;
  v_ids uuid[];
  v_pago_estado text;
  v_result jsonb;
begin
  if p_reembolso_id is null or p_operating_day is null then
    raise exception 'resolucion_reembolso_parametros_requeridos';
  end if;
  if v_estado not in ('CONFIRMADO','RECHAZADO','CANCELADO','DESCONOCIDO') then
    raise exception 'estado_reembolso_invalido';
  end if;
  if v_provider is null or v_reference is null then
    raise exception 'provider_reembolso_requerido';
  end if;

  select *
    into v_reembolso
    from public.reembolsos
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_reembolso_id;
  if not found then raise exception 'reembolso_no_encontrado'; end if;

  select *
    into v_pago
    from public.pagos
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=v_reembolso.pago_id;
  if not found then raise exception 'pago_no_encontrado'; end if;
  if v_pago.medio='EFECTIVO' then
    raise exception 'reembolso_efectivo_usa_confirmacion_local';
  end if;

  select o.terminal_id
    into v_terminal_id
    from public.abc_operaciones o
   where o.operation_id=v_reembolso.abc_command_id;

  v_request:=jsonb_build_object(
    'reembolso_id',p_reembolso_id,
    'estado',v_estado,
    'provider_code',v_provider,
    'provider_reference',v_reference,
    'provider_snapshot',v_snapshot,
    'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar_sistema(
    p_operation_id,p_empresa_id,p_local_id,
    'ABC_RESOLVER_REEMBOLSO',v_request,
    v_reembolso.created_by,v_terminal_id,v_provider
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select r.*,p.*
    into v_reembolso,v_pago
    from public.reembolsos r
    join public.pagos p
      on p.empresa_id=r.empresa_id
     and p.local_id=r.local_id
     and p.id=r.pago_id
   where r.empresa_id=p_empresa_id
     and r.local_id=p_local_id
     and r.id=p_reembolso_id
   for update of r,p;

  if v_reembolso.estado in ('CONFIRMADO','RECHAZADO','CANCELADO') then
    if v_reembolso.estado=v_estado
       and v_reembolso.provider_code is not distinct from v_provider
       and v_reembolso.provider_reference is not distinct from v_reference then
      v_result:=jsonb_build_object(
        'ok',true,
        'already_resolved',true,
        'reembolso_id',p_reembolso_id,
        'estado',v_estado,
        'pago_estado',v_pago.estado
      );
      perform private.abc_operacion_completar(p_operation_id,v_result);
      return v_result;
    end if;
    raise exception 'reembolso_ya_resuelto';
  end if;

  if v_reembolso.provider_code is not null
     and (
       v_reembolso.provider_code<>v_provider
       or v_reembolso.provider_reference is distinct from v_reference
     ) then
    raise exception 'provider_reembolso_reference_conflict';
  end if;

  select array_agg(ra.pago_aplicacion_id order by ra.pago_aplicacion_id)
    into v_ids
    from public.reembolso_aplicaciones ra
   where ra.empresa_id=p_empresa_id
     and ra.local_id=p_local_id
     and ra.reembolso_id=p_reembolso_id;

  if v_ids is null then raise exception 'reembolso_sin_aplicaciones'; end if;
  perform private.abc_bloquear_aplicaciones(
    p_empresa_id,p_local_id,v_ids
  );

  if v_estado='DESCONOCIDO' then
    update public.reembolsos
       set estado='DESCONOCIDO',
           provider_code=v_provider,
           provider_reference=v_reference,
           provider_snapshot=v_snapshot,
           resolved_at=null
     where empresa_id=p_empresa_id
       and local_id=p_local_id
       and id=p_reembolso_id;
    v_pago_estado:=v_pago.estado;
  elsif v_estado in ('RECHAZADO','CANCELADO') then
    update public.reembolsos
       set estado=v_estado,
           provider_code=v_provider,
           provider_reference=v_reference,
           provider_snapshot=v_snapshot,
           resolved_at=now()
     where empresa_id=p_empresa_id
       and local_id=p_local_id
       and id=p_reembolso_id;
    v_pago_estado:=v_pago.estado;
  else
    update public.reembolsos
       set estado='CONFIRMADO',
           provider_code=v_provider,
           provider_reference=v_reference,
           provider_snapshot=v_snapshot,
           resolved_at=now()
     where empresa_id=p_empresa_id
       and local_id=p_local_id
       and id=p_reembolso_id;

    v_pago_estado:=private.abc_actualizar_pago_reembolso_estado(
      p_empresa_id,p_local_id,v_reembolso.pago_id
    );
  end if;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day,
    executor_kind,executor_ref
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'REEMBOLSO',p_reembolso_id::text,
    'REEMBOLSO_RESUELTO',
    jsonb_build_object(
      'pago_id',v_reembolso.pago_id,
      'estado',v_estado,
      'importe',v_reembolso.importe_solicitado,
      'provider_code',v_provider,
      'provider_reference',v_reference,
      'pago_estado',v_pago_estado
    ),
    v_reembolso.created_by,v_terminal_id,now(),p_operating_day,
    'SYSTEM_PROVIDER',v_provider
  );

  v_result:=jsonb_build_object(
    'ok',true,
    'reembolso_id',p_reembolso_id,
    'estado',v_estado,
    'pago_estado',v_pago_estado
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

revoke all on function private.abc_actualizar_pago_reembolso_estado(text,text,uuid)
  from public,anon,authenticated,service_role;

revoke all on function public.abc_solicitar_reembolso(
  text,text,text,uuid,uuid,numeric,text,uuid,date
) from public,anon,authenticated,service_role;
revoke all on function public.abc_cancelar_reembolso(
  text,text,text,uuid,text,uuid,date
) from public,anon,authenticated,service_role;
revoke all on function public.abc_confirmar_reembolso_efectivo(
  text,text,text,uuid,uuid,uuid,uuid,date
) from public,anon,authenticated,service_role;
revoke all on function public.abc_resolver_reembolso(
  text,text,text,uuid,text,text,text,jsonb,date
) from public,anon,authenticated,service_role;

grant execute on function public.abc_solicitar_reembolso(
  text,text,text,uuid,uuid,numeric,text,uuid,date
) to authenticated;
grant execute on function public.abc_cancelar_reembolso(
  text,text,text,uuid,text,uuid,date
) to authenticated;
grant execute on function public.abc_confirmar_reembolso_efectivo(
  text,text,text,uuid,uuid,uuid,uuid,date
) to authenticated;
grant execute on function public.abc_resolver_reembolso(
  text,text,text,uuid,text,text,text,jsonb,date
) to service_role;
