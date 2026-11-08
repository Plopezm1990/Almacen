-- PM09: candidato local para reconciliar tres RPC ausentes en producción.
-- Nunca aplicar sin preflight actualizado, copia y autorización del paquete.
-- No altera tablas ni reemplaza funciones existentes.

-- La CLI de Supabase envuelve el archivo y su registro de historia en una
-- transacción. No añadir BEGIN/COMMIT aquí: cerrarían esa transacción antes
-- de que la CLI escriba la entrada de historia.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if to_regprocedure('public.revertir_venta_stock(text,text,text)') is not null
     or to_regprocedure('public.registrar_venta_stock_pm09(text,text,text,text,numeric,date,jsonb)') is not null
     or to_regprocedure('public.revertir_venta_stock_pm09(text,text,date,text)') is not null then
    raise exception 'PM09_BASELINE_PREFLIGHT_FALLO: alguna RPC objetivo ya existe';
  end if;
  if to_regprocedure('public.registrar_venta_stock(text,text,text,text,numeric,jsonb)') is null
     or to_regprocedure('private.pm09_bloquear_operation_id_stock(text)') is null
     or to_regprocedure('public.revertir_venta_stock_carrito(text,text,text)') is null then
    raise exception 'PM09_BASELINE_PREFLIGHT_FALLO: falta una dependencia';
  end if;
  if (select md5(replace(prosrc,E'\r','')) from pg_proc
      where oid=to_regprocedure('public.registrar_venta_stock(text,text,text,text,numeric,jsonb)'))
      <> '93a6ffa723d09ff741fc3444a0bb5d17'
     or (select md5(replace(prosrc,E'\r','')) from pg_proc
      where oid=to_regprocedure('private.pm09_bloquear_operation_id_stock(text)'))
      <> '51caae254c58ac1fb940afaef1c21f0a'
     or (select md5(replace(prosrc,E'\r','')) from pg_proc
      where oid=to_regprocedure('public.revertir_venta_stock_carrito(text,text,text)'))
      <> '59b8fc98799e5514d9c06bef23292a54' then
    raise exception 'PM09_BASELINE_PREFLIGHT_FALLO: cambió una dependencia';
  end if;
  if (select count(*) from public.stock_operaciones where tipo in ('VENTA','REVERSO')) <> 0
     or (select count(*) from public.movimientos_stock where tipo in ('VENTA','REVERSO')) <> 0 then
    raise exception 'PM09_BASELINE_PREFLIGHT_FALLO: hay ventas o reversos productivos';
  end if;
  if not exists(select 1 from pg_constraint
      where conrelid='public.stock_operaciones'::regclass and conname='stock_operaciones_actor_user_id_fkey')
     or not exists(select 1 from pg_constraint
      where conrelid='public.movimientos_stock'::regclass and conname='movimientos_stock_actor_user_id_fkey') then
    raise exception 'PM09_BASELINE_PREFLIGHT_FALLO: cambió el esquema de stock';
  end if;
end;
$preflight$;

-- Reverso individual. El reverso de carrito existente conserva su propia RPC.
create function public.revertir_venta_stock(
  p_operation_id text,
  p_venta_operation_id text,
  p_motivo text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $reverso$
declare
  v_operation_id text;
  original_op public.stock_operaciones%rowtype;
  original public.movimientos_stock%rowtype;
  op public.stock_operaciones%rowtype;
  mov public.movimientos_stock%rowtype;
  payload_norm jsonb;
  datos_reverso jsonb;
begin
  if auth.uid() is null or not private.pm07_puede_gestionar_stock() then
    raise exception 'reverso_no_autorizado';
  end if;
  v_operation_id := private.pm09_bloquear_operation_id_stock(p_operation_id);
  select * into original_op from public.stock_operaciones
   where operation_id=p_venta_operation_id and tipo='VENTA' for update;
  if not found then raise exception 'venta_stock_no_encontrada'; end if;
  if not private.la_tiene_local(original_op.empresa_id,original_op.local_id) then
    raise exception 'contexto_no_autorizado';
  end if;
  if original_op.producto_id='__CARRITO__' then
    raise exception 'reverso_carrito_requiere_rpc_carrito';
  end if;
  select * into original from public.movimientos_stock
   where operation_id=p_venta_operation_id and tipo='VENTA' for update;
  if not found then raise exception 'venta_stock_no_encontrada'; end if;
  if (select count(*) from public.movimientos_stock
      where operation_id=p_venta_operation_id and tipo='VENTA') <> 1 then
    raise exception 'reverso_carrito_requiere_rpc_carrito';
  end if;
  if original.empresa_id<>original_op.empresa_id
     or original.local_id<>original_op.local_id
     or original.producto_id<>original_op.producto_id then
    raise exception 'venta_stock_inconsistente';
  end if;
  payload_norm := jsonb_build_object(
    'ventaOperationId',p_venta_operation_id,
    'motivo',coalesce(p_motivo,''),
    'modo','INDIVIDUAL'
  );
  select * into op from public.stock_operaciones where operation_id=v_operation_id;
  if found then
    if op.tipo='REVERSO' and op.payload=payload_norm
       and op.ref_operation_id=p_venta_operation_id then
      select * into mov from public.movimientos_stock
       where operation_id=v_operation_id and tipo='REVERSO' limit 1;
      if not found then raise exception 'reverso_incompleto'; end if;
      return jsonb_build_object('ok',true,'replayed',true,'movimiento',to_jsonb(mov));
    end if;
    raise exception 'operation_id_conflict';
  end if;
  if exists(select 1 from public.stock_operaciones
      where tipo='REVERSO' and ref_operation_id=p_venta_operation_id) then
    raise exception 'venta_stock_ya_revertida';
  end if;
  if exists(select 1 from public.devoluciones_venta
      where venta_operation_id=p_venta_operation_id) then
    raise exception 'venta_con_devoluciones';
  end if;
  perform 1 from public.stock_ubicacion
   where empresa_id=original.empresa_id and local_id=original.local_id
     and producto_id=original.producto_id for update;
  if not found then raise exception 'stock_no_configurado'; end if;

  insert into public.stock_operaciones(
    operation_id,tipo,empresa_id,local_id,producto_id,payload,actor_user_id,ref_operation_id
  ) values (
    v_operation_id,'REVERSO',original.empresa_id,original.local_id,
    original.producto_id,payload_norm,auth.uid(),p_venta_operation_id
  );
  update public.stock_ubicacion
     set almacen=almacen-original.delta_almacen,
         piso=piso-original.delta_piso,
         updated_at=now()
   where empresa_id=original.empresa_id and local_id=original.local_id
     and producto_id=original.producto_id;
  datos_reverso := coalesce(original.datos,'{}'::jsonb)
    || jsonb_build_object(
      'motivo',coalesce(p_motivo,''),
      'anulaVentaId',p_venta_operation_id,
      'ventaId',p_venta_operation_id
    );
  if coalesce(original.datos->>'ingresoUnitario','') ~ '^-?[0-9]+([.][0-9]+)?$' then
    datos_reverso := datos_reverso || jsonb_build_object(
      'ingresoUnitario',-abs((original.datos->>'ingresoUnitario')::numeric)
    );
  end if;
  insert into public.movimientos_stock(
    operation_id,tipo,empresa_id,local_id,producto_id,
    delta_almacen,delta_piso,delta_total,cantidad,
    movimiento_original_id,datos,actor_user_id
  ) values (
    v_operation_id,'REVERSO',original.empresa_id,original.local_id,
    original.producto_id,-original.delta_almacen,-original.delta_piso,
    -original.delta_total,original.cantidad,original.id,datos_reverso,auth.uid()
  ) returning * into mov;
  return jsonb_build_object(
    'ok',true,'replayed',false,'movimiento',to_jsonb(mov),'localId',original.local_id
  );
end;
$reverso$;

create function public.registrar_venta_stock_pm09(
  p_operation_id text,p_empresa_id text,p_local_id text,p_producto_id text,
  p_cantidad numeric,p_fecha date,p_datos jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $venta_pm09$
declare
  v_res jsonb;
  v_operation_id text;
begin
  if p_fecha is null then raise exception 'fecha_requerida'; end if;
  v_operation_id := private.pm09_bloquear_operation_id_stock(p_operation_id);
  v_res := public.registrar_venta_stock(
    v_operation_id,p_empresa_id,p_local_id,p_producto_id,p_cantidad,
    coalesce(p_datos,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha)
  );
  update public.movimientos_stock
     set datos=coalesce(datos,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha)
   where operation_id=v_operation_id and tipo='VENTA';
  return coalesce(v_res,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha);
end;
$venta_pm09$;

create function public.revertir_venta_stock_pm09(
  p_operation_id text,p_venta_operation_id text,p_fecha date,p_motivo text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $reverso_pm09$
declare
  v_res jsonb;
  v_fecha_existente date;
  v_operation_id text;
begin
  if p_fecha is null then raise exception 'fecha_requerida'; end if;
  v_operation_id := private.pm09_bloquear_operation_id_stock(p_operation_id);
  if exists(select 1 from public.stock_operaciones where operation_id=v_operation_id) then
    select min(case when coalesce(datos->>'fechaOperacion','') ~ '^\d{4}-\d{2}-\d{2}$'
      then (datos->>'fechaOperacion')::date end)
      into v_fecha_existente
      from public.movimientos_stock
     where operation_id=v_operation_id and tipo='REVERSO';
    if v_fecha_existente is null or v_fecha_existente<>p_fecha then
      raise exception 'operation_id_conflict';
    end if;
  end if;
  v_res := public.revertir_venta_stock(v_operation_id,p_venta_operation_id,p_motivo);
  update public.movimientos_stock
     set datos=coalesce(datos,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha)
   where operation_id=v_operation_id and tipo='REVERSO';
  return coalesce(v_res,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha);
end;
$reverso_pm09$;

revoke all on function public.revertir_venta_stock(text,text,text)
  from public,anon,authenticated,service_role;
revoke all on function public.registrar_venta_stock_pm09(text,text,text,text,numeric,date,jsonb)
  from public,anon,authenticated,service_role;
revoke all on function public.revertir_venta_stock_pm09(text,text,date,text)
  from public,anon,authenticated,service_role;
grant execute on function public.revertir_venta_stock(text,text,text) to authenticated;
grant execute on function public.registrar_venta_stock_pm09(text,text,text,text,numeric,date,jsonb) to authenticated;
grant execute on function public.revertir_venta_stock_pm09(text,text,date,text) to authenticated;

do $postflight$
declare
  v_signature text;
  v_oid oid;
begin
  foreach v_signature in array array[
    'public.revertir_venta_stock(text,text,text)',
    'public.registrar_venta_stock_pm09(text,text,text,text,numeric,date,jsonb)',
    'public.revertir_venta_stock_pm09(text,text,date,text)'
  ] loop
    v_oid := to_regprocedure(v_signature);
    if v_oid is null
       or not (select prosecdef from pg_proc where oid=v_oid)
       or (select array_to_string(proconfig,',') from pg_proc where oid=v_oid)<>'search_path=""'
       or not has_function_privilege('authenticated',v_oid,'EXECUTE')
       or has_function_privilege('anon',v_oid,'EXECUTE')
       or has_function_privilege('service_role',v_oid,'EXECUTE') then
      raise exception 'PM09_BASELINE_POSTFLIGHT_FALLO: %',v_signature;
    end if;
  end loop;
end;
$postflight$;
