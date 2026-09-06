-- PM-08 · Endurecimiento de aislamiento en reintentos idempotentes
-- Destino autorizado: Supabase QA. No aplicar a producción sin autorización expresa.

create or replace function public.revertir_movimiento_caja(
  p_operation_id text,
  p_movimiento_operation_id text,
  p_motivo text,
  p_fecha date default current_date
) returns jsonb
language plpgsql
security definer
set search_path = 'public','auth','private','pg_temp'
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
  v_operation_id := private.pm08_validar_operation_id(p_operation_id);
  v_motivo := left(btrim(coalesce(p_motivo,'')),500);
  if v_motivo='' then raise exception 'motivo_requerido'; end if;
  v_fecha := coalesce(p_fecha,current_date);
  v_payload := jsonb_build_object('movimientoOperationId',p_movimiento_operation_id,'motivo',v_motivo,'fecha',v_fecha);

  perform private.pm08_bloquear_operation_id(v_operation_id);
  select * into v_existente from public.caja_operaciones where operation_id=v_operation_id;
  if found then
    if not private.la_tiene_local(v_existente.empresa_id,v_existente.local_id) then
      raise exception 'contexto_no_autorizado';
    end if;
    if v_existente.tipo in ('REVERSO_ENTRADA','REVERSO_RETIRADA') and v_existente.payload=v_payload then
      return jsonb_build_object('ok',true,'replayed',true,'movimiento',to_jsonb(v_existente));
    end if;
    raise exception 'operation_id_conflict';
  end if;
  if exists(select 1 from public.stock_operaciones where operation_id=v_operation_id)
     or exists(select 1 from public.arqueos_caja where operation_id=v_operation_id)
     or exists(select 1 from public.arqueos_caja_anulaciones where operation_id=v_operation_id) then
    raise exception 'operation_id_conflict';
  end if;

  select * into v_original
    from public.caja_operaciones
   where operation_id=p_movimiento_operation_id
     and tipo in ('ENTRADA','RETIRADA')
   for update;
  if not found then raise exception 'movimiento_caja_no_encontrado'; end if;
  if not private.la_tiene_local(v_original.empresa_id,v_original.local_id) then
    raise exception 'contexto_no_autorizado';
  end if;
  if not private.pm08_local_operable(v_original.empresa_id,v_original.local_id) then
    raise exception 'local_inactivo';
  end if;
  if exists(
    select 1 from public.arqueos_caja
     where empresa_id=v_original.empresa_id and local_id=v_original.local_id
       and fecha=v_fecha and estado='ACTIVO'
  ) then raise exception 'periodo_caja_cerrado'; end if;
  if exists(
    select 1 from public.caja_operaciones
     where ref_operation_id=v_original.operation_id
       and tipo in ('REVERSO_ENTRADA','REVERSO_RETIRADA')
  ) then raise exception 'movimiento_caja_ya_revertido'; end if;

  insert into public.caja_operaciones(
    operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,
    medio_pago,concepto,origen_tipo,origen_id,ref_operation_id,payload,actor_user_id
  ) values (
    v_operation_id,
    case when v_original.tipo='ENTRADA' then 'REVERSO_ENTRADA' else 'REVERSO_RETIRADA' end,
    v_original.empresa_id,v_original.local_id,v_fecha,v_original.importe,
    -v_original.efecto_efectivo,'EFECTIVO',
    left('Reverso: ' || v_motivo,500),'REVERSO_CAJA',v_original.operation_id,
    v_original.operation_id,v_payload,auth.uid()
  ) returning * into v_nuevo;

  return jsonb_build_object('ok',true,'replayed',false,'movimiento',to_jsonb(v_nuevo));
end;
$$;

create or replace function public.anular_arqueo_caja(
  p_operation_id text,
  p_arqueo_operation_id text,
  p_motivo text
) returns jsonb
language plpgsql
security definer
set search_path = 'public','auth','private','pg_temp'
as $$
declare
  v_operation_id text;
  v_motivo text;
  v_payload jsonb;
  v_original public.arqueos_caja%rowtype;
  v_existente public.arqueos_caja_anulaciones%rowtype;
  v_anulacion public.arqueos_caja_anulaciones%rowtype;
begin
  if auth.uid() is null or not private.pm08_puede_corregir_caja() then
    raise exception 'anulacion_arqueo_no_autorizada';
  end if;
  v_operation_id := private.pm08_validar_operation_id(p_operation_id);
  v_motivo := left(btrim(coalesce(p_motivo,'')),500);
  if v_motivo='' then raise exception 'motivo_requerido'; end if;
  v_payload := jsonb_build_object('arqueoOperationId',p_arqueo_operation_id,'motivo',v_motivo);

  perform private.pm08_bloquear_operation_id(v_operation_id);
  select * into v_existente from public.arqueos_caja_anulaciones where operation_id=v_operation_id;
  if found then
    if not private.la_tiene_local(v_existente.empresa_id,v_existente.local_id) then
      raise exception 'contexto_no_autorizado';
    end if;
    if v_existente.payload=v_payload then
      select * into v_original from public.arqueos_caja where operation_id=v_existente.arqueo_operation_id;
      return jsonb_build_object('ok',true,'replayed',true,'arqueo',to_jsonb(v_original),'anulacion',to_jsonb(v_existente));
    end if;
    raise exception 'operation_id_conflict';
  end if;
  if exists(select 1 from public.caja_operaciones where operation_id=v_operation_id)
     or exists(select 1 from public.stock_operaciones where operation_id=v_operation_id)
     or exists(select 1 from public.arqueos_caja where operation_id=v_operation_id) then
    raise exception 'operation_id_conflict';
  end if;

  select * into v_original from public.arqueos_caja
   where operation_id=p_arqueo_operation_id for update;
  if not found then raise exception 'arqueo_no_encontrado'; end if;
  if not private.la_tiene_local(v_original.empresa_id,v_original.local_id) then
    raise exception 'contexto_no_autorizado';
  end if;
  if v_original.estado <> 'ACTIVO' then raise exception 'arqueo_ya_anulado'; end if;

  insert into public.arqueos_caja_anulaciones(
    operation_id,arqueo_operation_id,empresa_id,local_id,motivo,payload,actor_user_id
  ) values (
    v_operation_id,v_original.operation_id,v_original.empresa_id,v_original.local_id,
    v_motivo,v_payload,auth.uid()
  ) returning * into v_anulacion;

  update public.arqueos_caja
     set estado='ANULADO',anulado_por_operation_id=v_operation_id,
         anulado_motivo=v_motivo,anulado_actor_user_id=auth.uid(),anulado_at=now()
   where operation_id=v_original.operation_id
   returning * into v_original;

  return jsonb_build_object('ok',true,'replayed',false,'arqueo',to_jsonb(v_original),'anulacion',to_jsonb(v_anulacion));
end;
$$;

revoke all on function public.revertir_movimiento_caja(text,text,text,date) from public, anon;
revoke all on function public.anular_arqueo_caja(text,text,text) from public, anon;
grant execute on function public.revertir_movimiento_caja(text,text,text,date) to authenticated;
grant execute on function public.anular_arqueo_caja(text,text,text) to authenticated;
