-- ABC F2 C02-M04B — autoridad transaccional de movimientos manuales de caja.
-- Aditiva salvo endurecimiento compatible de revertir_movimiento_caja().
-- Depende de C01-M04A + primitivas ABC M03A.
-- No modifica pagos, reembolsos, stock ni cierre fiscal.

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.caja_operaciones') is null then v_missing:=array_append(v_missing,'caja_operaciones'); end if;
  if to_regclass('public.caja_sesiones') is null then v_missing:=array_append(v_missing,'caja_sesiones'); end if;
  if to_regclass('public.caja_sesion_terminales') is null then v_missing:=array_append(v_missing,'caja_sesion_terminales'); end if;
  if to_regclass('public.terminales_tpv') is null then v_missing:=array_append(v_missing,'terminales_tpv'); end if;
  if to_regclass('public.abc_operaciones') is null then v_missing:=array_append(v_missing,'abc_operaciones'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_request_hash(jsonb)') is null then v_missing:=array_append(v_missing,'abc_request_hash'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.pm08_puede_corregir_caja()') is null then v_missing:=array_append(v_missing,'pm08_puede_corregir_caja'); end if;
  if to_regprocedure('private.pm08_validar_operation_id(text)') is null then v_missing:=array_append(v_missing,'pm08_validar_operation_id'); end if;
  if to_regprocedure('private.pm08_bloquear_operation_id(text)') is null then v_missing:=array_append(v_missing,'pm08_bloquear_operation_id'); end if;
  if to_regprocedure('private.pm08_local_operable(text,text)') is null then v_missing:=array_append(v_missing,'pm08_local_operable'); end if;
  if to_regprocedure('public.revertir_movimiento_caja(text,text,text,date)') is null then v_missing:=array_append(v_missing,'revertir_movimiento_caja'); end if;

  if cardinality(v_missing)>0 then
    raise exception 'ABC_F2_M04B_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  if to_regprocedure('public.abc_registrar_movimiento_caja(text,text,text,uuid,uuid,uuid,text,text,numeric,text,text,date)') is not null
     or to_regprocedure('public.abc_revertir_movimiento_caja(text,text,text,text,uuid,text,date)') is not null
     or exists(select 1 from pg_constraint where conname='abc_caja_manual_origen_semantica') then
    raise exception 'ABC_F2_M04B_PREFLIGHT_FALLO: objetos M04B ya existen';
  end if;
end $$;

alter table public.caja_operaciones
  add constraint abc_caja_manual_origen_semantica
  check (
    origen_tipo not in ('ABC_CAJA_MANUAL','ABC_CAJA_REVERSO_MANUAL')
    or (
      origen_tipo='ABC_CAJA_MANUAL'
      and abc_command_id is not null
      and ref_operation_id is null
      and medio_pago='EFECTIVO'
      and (
        (tipo='ENTRADA' and categoria in ('REPOSICION_CAJA','INGRESO_MANUAL'))
        or
        (tipo='RETIRADA' and categoria in ('RETIRADA_CAJA','GASTO_CAJA'))
      )
    )
    or (
      origen_tipo='ABC_CAJA_REVERSO_MANUAL'
      and abc_command_id is not null
      and ref_operation_id is not null
      and medio_pago='EFECTIVO'
      and tipo in ('REVERSO_ENTRADA','REVERSO_RETIRADA')
      and categoria='CORRECCION_CAJA'
    )
  );

create function public.abc_registrar_movimiento_caja(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_caja_id uuid,
  p_session_id uuid,
  p_terminal_id uuid,
  p_currency_code text,
  p_categoria text,
  p_importe numeric,
  p_concepto text,
  p_motivo text,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_request jsonb;
  v_cmd jsonb;
  v_currency text:=upper(btrim(coalesce(p_currency_code,'')));
  v_categoria text:=upper(btrim(coalesce(p_categoria,'')));
  v_tipo text;
  v_importe numeric(14,2);
  v_concepto text:=left(btrim(coalesce(p_concepto,'')),500);
  v_motivo text:=left(btrim(coalesce(p_motivo,'')),500);
  v_cash_operation_id text;
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR') then
    raise exception 'abc_movimiento_caja_no_autorizado';
  end if;

  if p_caja_id is null or p_session_id is null or p_terminal_id is null
     or p_operating_day is null then
    raise exception 'movimiento_caja_parametros_requeridos';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'moneda_caja_invalida'; end if;
  if v_concepto='' then raise exception 'concepto_caja_requerido'; end if;
  if v_motivo='' then raise exception 'motivo_caja_requerido'; end if;
  if p_importe is null
     or p_importe::text in ('NaN','Infinity','-Infinity')
     or p_importe<=0
     or p_importe>999999999999.99 then
    raise exception 'importe_caja_invalido';
  end if;
  if p_importe<>round(p_importe,2) then raise exception 'importe_caja_precision_invalida'; end if;
  v_importe:=p_importe::numeric(14,2);

  v_tipo:=case v_categoria
    when 'REPOSICION_CAJA' then 'ENTRADA'
    when 'INGRESO_MANUAL' then 'ENTRADA'
    when 'RETIRADA_CAJA' then 'RETIRADA'
    when 'GASTO_CAJA' then 'RETIRADA'
    else null
  end;
  if v_tipo is null then raise exception 'categoria_movimiento_caja_invalida'; end if;

  v_request:=jsonb_build_object(
    'caja_id',p_caja_id,
    'session_id',p_session_id,
    'terminal_id',p_terminal_id,
    'currency_code',v_currency,
    'categoria',v_categoria,
    'tipo',v_tipo,
    'importe',v_importe,
    'concepto',v_concepto,
    'motivo',v_motivo,
    'operating_day',p_operating_day
  );

  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,
    'ABC_REGISTRAR_MOVIMIENTO_CAJA',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
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

  perform 1
    from public.terminales_tpv t
   where t.empresa_id=p_empresa_id
     and t.local_id=p_local_id
     and t.id=p_terminal_id
     and t.activo=true
   for update;
  if not found then raise exception 'terminal_no_disponible'; end if;

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

  v_cash_operation_id:='abc.cash.manual.'||
    private.abc_request_hash(
      jsonb_build_object(
        'command',p_operation_id,
        'session_id',p_session_id,
        'categoria',v_categoria
      )
    );

  insert into public.caja_operaciones(
    operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,
    medio_pago,concepto,origen_tipo,origen_id,ref_operation_id,payload,
    actor_user_id,abc_command_id,caja_id,session_id,terminal_id,
    currency_code,operating_day,occurred_at,categoria
  ) values (
    v_cash_operation_id,v_tipo,p_empresa_id,p_local_id,p_operating_day,
    v_importe,
    case when v_tipo='ENTRADA' then v_importe else -v_importe end,
    'EFECTIVO',v_concepto,'ABC_CAJA_MANUAL',p_session_id::text,null,
    jsonb_build_object(
      'motivo',v_motivo,
      'categoria',v_categoria,
      'session_id',p_session_id,
      'caja_id',p_caja_id,
      'terminal_id',p_terminal_id,
      'currency_code',v_currency
    ),
    auth.uid(),p_operation_id,p_caja_id,p_session_id,p_terminal_id,
    v_currency,p_operating_day,now(),v_categoria
  );

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'CAJA_SESION',p_session_id::text,
    'CAJA_MOVIMIENTO_MANUAL_REGISTRADO',
    jsonb_build_object(
      'caja_operation_id',v_cash_operation_id,
      'tipo',v_tipo,
      'categoria',v_categoria,
      'importe',v_importe,
      'currency_code',v_currency,
      'motivo',v_motivo
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,
    'caja_operation_id',v_cash_operation_id,
    'tipo',v_tipo,
    'categoria',v_categoria,
    'importe',v_importe,
    'efecto_efectivo',case when v_tipo='ENTRADA' then v_importe else -v_importe end,
    'currency_code',v_currency,
    'session_id',p_session_id
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_revertir_movimiento_caja(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_movimiento_operation_id text,
  p_terminal_id uuid,
  p_motivo text,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_request jsonb;
  v_cmd jsonb;
  v_original public.caja_operaciones%rowtype;
  v_tipo text;
  v_motivo text:=left(btrim(coalesce(p_motivo,'')),500);
  v_cash_operation_id text;
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR')
     or not private.pm08_puede_corregir_caja() then
    raise exception 'abc_reverso_caja_no_autorizado';
  end if;

  if nullif(btrim(coalesce(p_movimiento_operation_id,'')),'') is null
     or p_terminal_id is null or p_operating_day is null then
    raise exception 'reverso_caja_parametros_requeridos';
  end if;
  if v_motivo='' then raise exception 'motivo_reverso_caja_requerido'; end if;

  v_request:=jsonb_build_object(
    'movimiento_operation_id',p_movimiento_operation_id,
    'terminal_id',p_terminal_id,
    'motivo',v_motivo,
    'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,
    'ABC_REVERTIR_MOVIMIENTO_CAJA',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select *
    into v_original
    from public.caja_operaciones
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and operation_id=p_movimiento_operation_id
   for update;
  if not found then raise exception 'movimiento_caja_no_encontrado'; end if;

  if v_original.origen_tipo<>'ABC_CAJA_MANUAL'
     or v_original.abc_command_id is null
     or v_original.session_id is null
     or v_original.caja_id is null
     or v_original.currency_code is null
     or v_original.tipo not in ('ENTRADA','RETIRADA')
     or v_original.categoria not in (
       'REPOSICION_CAJA','INGRESO_MANUAL','RETIRADA_CAJA','GASTO_CAJA'
     ) then
    raise exception 'movimiento_caja_no_reversible_por_abc';
  end if;

  perform 1
    from public.caja_sesiones s
   where s.empresa_id=p_empresa_id
     and s.local_id=p_local_id
     and s.id=v_original.session_id
     and s.caja_id=v_original.caja_id
     and s.estado='ABIERTA'
   for update;
  if not found then raise exception 'sesion_caja_no_abierta'; end if;

  perform 1
    from public.terminales_tpv t
   where t.empresa_id=p_empresa_id
     and t.local_id=p_local_id
     and t.id=p_terminal_id
     and t.activo=true
   for update;
  if not found then raise exception 'terminal_no_disponible'; end if;

  if not exists(
    select 1
      from public.caja_sesion_terminales st
     where st.empresa_id=p_empresa_id
       and st.local_id=p_local_id
       and st.session_id=v_original.session_id
       and st.terminal_id=p_terminal_id
       and st.hasta is null
       and st.desde<=now()
  ) then
    raise exception 'terminal_no_vinculado_sesion';
  end if;

  if exists(
    select 1
      from public.caja_operaciones c
     where c.ref_operation_id=v_original.operation_id
       and c.tipo in ('REVERSO_ENTRADA','REVERSO_RETIRADA')
  ) then
    raise exception 'movimiento_caja_ya_revertido';
  end if;

  v_tipo:=case
    when v_original.tipo='ENTRADA' then 'REVERSO_ENTRADA'
    else 'REVERSO_RETIRADA'
  end;

  v_cash_operation_id:='abc.cash.manual.reverse.'||
    private.abc_request_hash(
      jsonb_build_object(
        'command',p_operation_id,
        'original',v_original.operation_id
      )
    );

  insert into public.caja_operaciones(
    operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,
    medio_pago,concepto,origen_tipo,origen_id,ref_operation_id,payload,
    actor_user_id,abc_command_id,caja_id,session_id,terminal_id,
    currency_code,operating_day,occurred_at,categoria
  ) values (
    v_cash_operation_id,v_tipo,p_empresa_id,p_local_id,p_operating_day,
    v_original.importe,-v_original.efecto_efectivo,
    'EFECTIVO',left('Correccion: '||v_motivo,500),
    'ABC_CAJA_REVERSO_MANUAL',v_original.operation_id,v_original.operation_id,
    jsonb_build_object(
      'motivo',v_motivo,
      'movimiento_original_operation_id',v_original.operation_id,
      'categoria_original',v_original.categoria,
      'abc_command_original',v_original.abc_command_id
    ),
    auth.uid(),p_operation_id,v_original.caja_id,v_original.session_id,
    p_terminal_id,v_original.currency_code,p_operating_day,now(),
    'CORRECCION_CAJA'
  );

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'CAJA_SESION',v_original.session_id::text,
    'CAJA_MOVIMIENTO_MANUAL_REVERTIDO',
    jsonb_build_object(
      'caja_operation_id',v_cash_operation_id,
      'movimiento_original_operation_id',v_original.operation_id,
      'tipo',v_tipo,
      'importe',v_original.importe,
      'categoria_original',v_original.categoria,
      'motivo',v_motivo
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,
    'caja_operation_id',v_cash_operation_id,
    'movimiento_original_operation_id',v_original.operation_id,
    'tipo',v_tipo,
    'importe',v_original.importe,
    'efecto_efectivo',-v_original.efecto_efectivo,
    'session_id',v_original.session_id
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

-- Endurecimiento compatible: el reversor legacy conserva filas legacy,
-- pero no puede corregir movimientos bajo autoridad ABC.
create or replace function public.revertir_movimiento_caja(
  p_operation_id text,
  p_movimiento_operation_id text,
  p_motivo text,
  p_fecha date default current_date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_operation_id text;
  v_motivo text;
  v_fecha date;
  v_payload jsonb;
  v_existente public.caja_operaciones%rowtype;
  v_original public.caja_operaciones%rowtype;
  v_nuevo public.caja_operaciones%rowtype;
begin
  if auth.uid() is null or not private.pm08_puede_corregir_caja() then
    raise exception 'reverso_caja_no_autorizado';
  end if;

  v_operation_id:=private.pm08_validar_operation_id(p_operation_id);
  v_motivo:=left(btrim(coalesce(p_motivo,'')),500);
  if v_motivo='' then raise exception 'motivo_requerido'; end if;
  v_fecha:=coalesce(p_fecha,current_date);
  v_payload:=jsonb_build_object(
    'movimientoOperationId',p_movimiento_operation_id,
    'motivo',v_motivo,
    'fecha',v_fecha
  );

  perform private.pm08_bloquear_operation_id(v_operation_id);

  select *
    into v_existente
    from public.caja_operaciones
   where operation_id=v_operation_id;
  if found then
    if not private.la_tiene_local(v_existente.empresa_id,v_existente.local_id) then
      raise exception 'contexto_no_autorizado';
    end if;
    if v_existente.tipo in ('REVERSO_ENTRADA','REVERSO_RETIRADA')
       and v_existente.payload=v_payload then
      return jsonb_build_object(
        'ok',true,'replayed',true,'movimiento',to_jsonb(v_existente)
      );
    end if;
    raise exception 'operation_id_conflict';
  end if;

  select *
    into v_original
    from public.caja_operaciones
   where operation_id=p_movimiento_operation_id
     and tipo in ('ENTRADA','RETIRADA')
   for update;
  if not found then raise exception 'movimiento_caja_no_encontrado'; end if;

  if not private.la_tiene_local(v_original.empresa_id,v_original.local_id) then
    raise exception 'contexto_no_autorizado';
  end if;

  if v_original.abc_command_id is not null
     or v_original.session_id is not null
     or v_original.origen_tipo like 'ABC_%' then
    raise exception 'movimiento_abc_requiere_reverso_abc';
  end if;

  if not private.pm08_local_operable(v_original.empresa_id,v_original.local_id) then
    raise exception 'local_inactivo';
  end if;

  if exists(
    select 1
      from public.arqueos_caja
     where empresa_id=v_original.empresa_id
       and local_id=v_original.local_id
       and fecha=v_fecha
       and estado='ACTIVO'
  ) then
    raise exception 'periodo_caja_cerrado';
  end if;

  if exists(
    select 1
      from public.caja_operaciones
     where ref_operation_id=v_original.operation_id
       and tipo in ('REVERSO_ENTRADA','REVERSO_RETIRADA')
  ) then
    raise exception 'movimiento_caja_ya_revertido';
  end if;

  insert into public.caja_operaciones(
    operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,
    medio_pago,concepto,origen_tipo,origen_id,ref_operation_id,payload,
    actor_user_id
  ) values (
    v_operation_id,
    case when v_original.tipo='ENTRADA' then 'REVERSO_ENTRADA' else 'REVERSO_RETIRADA' end,
    v_original.empresa_id,v_original.local_id,v_fecha,v_original.importe,
    -v_original.efecto_efectivo,'EFECTIVO',
    left('Reverso: '||v_motivo,500),'REVERSO_CAJA',
    v_original.operation_id,v_original.operation_id,v_payload,auth.uid()
  ) returning * into v_nuevo;

  return jsonb_build_object(
    'ok',true,'replayed',false,'movimiento',to_jsonb(v_nuevo)
  );
end $$;

revoke all on function public.abc_registrar_movimiento_caja(
  text,text,text,uuid,uuid,uuid,text,text,numeric,text,text,date
) from public,anon,authenticated,service_role;
revoke all on function public.abc_revertir_movimiento_caja(
  text,text,text,text,uuid,text,date
) from public,anon,authenticated,service_role;

grant execute on function public.abc_registrar_movimiento_caja(
  text,text,text,uuid,uuid,uuid,text,text,numeric,text,text,date
) to authenticated;
grant execute on function public.abc_revertir_movimiento_caja(
  text,text,text,text,uuid,text,date
) to authenticated;

revoke execute on function public.revertir_movimiento_caja(
  text,text,text,date
) from public,anon;
grant execute on function public.revertir_movimiento_caja(
  text,text,text,date
) to authenticated,service_role;
