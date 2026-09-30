-- ABC F4 B06 / subpunto 3 — saldo disponible e idempotencia del anticipo.
--
-- La RPC bloquea el anticipo antes de calcular el saldo consumido. Todas las
-- aplicaciones y devoluciones pasan por la misma suma, por lo que dos llamadas
-- concurrentes no pueden consumir el mismo saldo. abc_command_id conserva el
-- replay seguro de una misma operación y rechaza cambios de payload.

do $$
begin
  if to_regclass('public.abc_cobros_no_venta') is null
     or to_regclass('public.abc_anticipo_movimientos') is null
     or to_regclass('public.abc_operaciones') is null
     or to_regclass('public.ventas_fiscales') is null
     or to_regclass('public.caja_operaciones') is null then
    raise exception 'ABC_F4_B06_BALANCE_PREFLIGHT_FALLO: dependencias ausentes';
  end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null
     or to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null
     or to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then
    raise exception 'ABC_F4_B06_BALANCE_PREFLIGHT_FALLO: helpers ausentes';
  end if;
  if to_regprocedure('public.abc_registrar_movimiento_anticipo(text,text,text,uuid,text,numeric,text,uuid,text,text,date,uuid,jsonb)') is not null then
    raise exception 'ABC_F4_B06_BALANCE_PREFLIGHT_FALLO: RPC ya existe';
  end if;
end $$;

create or replace function public.abc_registrar_movimiento_anticipo(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_anticipo_id uuid,
  p_movimiento text,
  p_importe numeric,
  p_currency_code text,
  p_venta_fiscal_id uuid default null,
  p_caja_operation_id text default null,
  p_motivo text default null,
  p_operating_day date default null,
  p_terminal_id uuid default null,
  p_datos jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_movimiento text := upper(btrim(coalesce(p_movimiento,'')));
  v_currency text := upper(btrim(coalesce(p_currency_code,'')));
  v_importe numeric(24,8);
  v_motivo text := btrim(coalesce(p_motivo,''));
  v_request jsonb;
  v_cmd jsonb;
  v_anticipo public.abc_cobros_no_venta%rowtype;
  v_mov public.abc_anticipo_movimientos%rowtype;
  v_consumido numeric(24,8);
  v_disponible numeric(24,8);
  v_resultado jsonb;
begin
  if auth.uid() is null then raise exception 'abc_no_autenticado'; end if;
  if p_anticipo_id is null or p_operating_day is null then
    raise exception 'b06_parametros_requeridos';
  end if;
  if v_movimiento not in ('APLICACION','DEVOLUCION') then
    raise exception 'b06_movimiento_invalido';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'b06_moneda_invalida';
  end if;
  if p_importe is null or p_importe <= 0 or p_importe <> round(p_importe,8) then
    raise exception 'b06_importe_invalido';
  end if;
  v_importe := p_importe::numeric(24,8);

  if v_movimiento='APLICACION' then
    if not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COBRO_INICIAR') then
      raise exception 'b06_aplicacion_no_autorizada';
    end if;
    if p_venta_fiscal_id is null or p_caja_operation_id is not null then
      raise exception 'b06_destino_aplicacion_invalido';
    end if;
  else
    if not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_REEMBOLSO_SOLICITAR') then
      raise exception 'b06_devolucion_no_autorizada';
    end if;
    if p_venta_fiscal_id is not null
       or nullif(btrim(coalesce(p_caja_operation_id,'')),'') is null
       or v_motivo='' then
      raise exception 'b06_destino_devolucion_invalido';
    end if;
  end if;

  v_request := jsonb_build_object(
    'anticipo_id',p_anticipo_id,
    'movimiento',v_movimiento,
    'importe',v_importe,
    'currency_code',v_currency,
    'venta_fiscal_id',p_venta_fiscal_id,
    'caja_operation_id',p_caja_operation_id,
    'motivo',v_motivo,
    'operating_day',p_operating_day,
    'terminal_id',p_terminal_id,
    'datos',coalesce(p_datos,'{}'::jsonb)
  );

  v_cmd := private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,
    case when v_movimiento='APLICACION' then 'ABC_APLICAR_ANTICIPO' else 'ABC_DEVOLVER_ANTICIPO' end,
    v_request,p_terminal_id
  );
  if coalesce((v_cmd->>'replayed')::boolean,false) then
    v_resultado := coalesce(v_cmd->'resultado',v_cmd);
    return jsonb_set(v_resultado,'{replayed}','true'::jsonb,true);
  end if;

  -- La unicidad de abc_command_id es la última barrera de replay del ledger.
  -- Se consulta después del lock de operación para devolver el resultado
  -- existente incluso si una operación anterior ya materializó el movimiento.
  select * into v_mov
    from public.abc_anticipo_movimientos
   where abc_command_id=p_operation_id
   for update;
  if found then
    select * into v_anticipo
      from public.abc_cobros_no_venta
     where empresa_id=p_empresa_id
       and local_id=p_local_id
       and id=p_anticipo_id
     for update;
    select coalesce(sum(m.importe),0)::numeric(24,8)
      into v_consumido
      from public.abc_anticipo_movimientos m
     where m.empresa_id=p_empresa_id
       and m.local_id=p_local_id
       and m.anticipo_id=p_anticipo_id;
    return jsonb_build_object(
      'ok',true,
      'replayed',true,
      'movimiento',to_jsonb(v_mov),
      'importe_anticipo',v_anticipo.importe,
      'importe_consumido',v_consumido,
      'saldo_disponible',round(v_anticipo.importe-v_consumido,8)
    );
  end if;

  select * into v_anticipo
    from public.abc_cobros_no_venta
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_anticipo_id
   for update;
  if not found then raise exception 'b06_anticipo_no_encontrado'; end if;
  if v_anticipo.concepto<>'ANTICIPO' then
    raise exception 'b06_fuente_no_es_anticipo';
  end if;
  if v_anticipo.currency_code<>v_currency then
    raise exception 'b06_moneda_anticipo_incompatible';
  end if;

  if v_movimiento='APLICACION'
     and not exists (
       select 1 from public.ventas_fiscales v
        where v.empresa_id=p_empresa_id
          and v.local_id=p_local_id
          and v.id=p_venta_fiscal_id
          and v.currency_code=v_currency
          and v.estado<>'CANCELADA'
     ) then
    raise exception 'b06_venta_destino_no_encontrada';
  end if;

  if v_movimiento='DEVOLUCION'
     and not exists (
       select 1 from public.caja_operaciones c
        where c.operation_id=p_caja_operation_id
          and c.empresa_id=p_empresa_id
          and c.local_id=p_local_id
     ) then
    raise exception 'b06_caja_devolucion_no_encontrada';
  end if;

  select coalesce(sum(m.importe),0)::numeric(24,8)
    into v_consumido
    from public.abc_anticipo_movimientos m
   where m.empresa_id=p_empresa_id
     and m.local_id=p_local_id
     and m.anticipo_id=p_anticipo_id;

  v_disponible := round(v_anticipo.importe-v_consumido,8);
  if v_disponible < v_importe then
    raise exception 'b06_saldo_insuficiente';
  end if;

  insert into public.abc_anticipo_movimientos(
    empresa_id,local_id,abc_command_id,anticipo_id,movimiento,importe,
    currency_code,venta_fiscal_id,caja_operation_id,motivo,responsable_user_id,
    datos,operating_day,created_by
  ) values (
    p_empresa_id,p_local_id,p_operation_id,p_anticipo_id,v_movimiento,v_importe,
    v_currency,p_venta_fiscal_id,p_caja_operation_id,nullif(v_motivo,''),auth.uid(),
    coalesce(p_datos,'{}'::jsonb),p_operating_day,auth.uid()
  )
  on conflict (abc_command_id) do nothing
  returning * into v_mov;

  if not found then
    select * into v_mov
      from public.abc_anticipo_movimientos
     where abc_command_id=p_operation_id
     for update;
    if not found then
      raise exception 'b06_replay_movimiento_no_encontrado';
    end if;
    if v_mov.empresa_id is distinct from p_empresa_id
       or v_mov.local_id is distinct from p_local_id
       or v_mov.anticipo_id is distinct from p_anticipo_id
       or v_mov.movimiento is distinct from v_movimiento
       or v_mov.importe is distinct from v_importe
       or v_mov.currency_code is distinct from v_currency
       or v_mov.venta_fiscal_id is distinct from p_venta_fiscal_id
       or v_mov.caja_operation_id is distinct from p_caja_operation_id
       or v_mov.motivo is distinct from nullif(v_motivo,'')
       or v_mov.operating_day is distinct from p_operating_day then
      raise exception 'operation_id_conflict';
    end if;
    select coalesce(sum(m.importe),0)::numeric(24,8)
      into v_consumido
      from public.abc_anticipo_movimientos m
     where m.empresa_id=p_empresa_id
       and m.local_id=p_local_id
       and m.anticipo_id=p_anticipo_id;
    return jsonb_build_object(
      'ok',true,
      'replayed',true,
      'movimiento',to_jsonb(v_mov),
      'importe_anticipo',v_anticipo.importe,
      'importe_consumido',v_consumido,
      'saldo_disponible',round(v_anticipo.importe-v_consumido,8)
    );
  end if;

  v_resultado := jsonb_build_object(
    'ok',true,
    'replayed',false,
    'movimiento',to_jsonb(v_mov),
    'importe_anticipo',v_anticipo.importe,
    'importe_consumido',round(v_consumido+v_importe,8),
    'saldo_disponible',round(v_disponible-v_importe,8)
  );
  perform private.abc_operacion_completar(p_operation_id,v_resultado);
  return v_resultado;
end;
$$;

revoke all on function public.abc_registrar_movimiento_anticipo(
  text,text,text,uuid,text,numeric,text,uuid,text,text,date,uuid,jsonb
) from public,anon,authenticated,service_role;
grant execute on function public.abc_registrar_movimiento_anticipo(
  text,text,text,uuid,text,numeric,text,uuid,text,text,date,uuid,jsonb
) to authenticated;

comment on function public.abc_registrar_movimiento_anticipo(
  text,text,text,uuid,text,numeric,text,uuid,text,text,date,uuid,jsonb
) is
  'B06: aplica o devuelve saldo de un anticipo con bloqueo, idempotencia y límite acumulado.';
