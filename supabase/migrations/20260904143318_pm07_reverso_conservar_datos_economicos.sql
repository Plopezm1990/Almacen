-- PM-07 · Conservar datos económicos originales en reversos de carrito.
create or replace function public.revertir_venta_stock_carrito(
  p_operation_id text,
  p_venta_operation_id text,
  p_motivo text default null
) returns jsonb
language plpgsql
security definer
set search_path='public','auth','private','pg_temp'
as $$
declare
  original_op public.stock_operaciones%rowtype;
  op public.stock_operaciones%rowtype;
  rec record;
  payload_norm jsonb;
  movimientos_json jsonb;
  datos_reverso jsonb;
begin
  if auth.uid() is null or not private.pm07_puede_gestionar_stock() then raise exception 'reverso_no_autorizado'; end if;
  if p_operation_id is null or btrim(p_operation_id)='' then raise exception 'operation_id_requerido'; end if;
  select * into original_op from public.stock_operaciones where operation_id=p_venta_operation_id and tipo='VENTA';
  if not found then raise exception 'venta_stock_no_encontrada'; end if;
  if not private.la_tiene_local(original_op.empresa_id,original_op.local_id) then raise exception 'contexto_no_autorizado'; end if;
  payload_norm:=jsonb_build_object('ventaOperationId',p_venta_operation_id,'motivo',coalesce(p_motivo,''),'modo','CARRITO');
  select * into op from public.stock_operaciones where operation_id=p_operation_id;
  if found then
    if op.tipo='REVERSO' and op.payload=payload_norm then
      select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) into movimientos_json from public.movimientos_stock m where m.operation_id=p_operation_id;
      return jsonb_build_object('ok',true,'replayed',true,'movimientos',movimientos_json,'lineasAnuladas',jsonb_array_length(movimientos_json));
    end if;
    raise exception 'operation_id_conflict';
  end if;
  if exists(select 1 from public.stock_operaciones where tipo='REVERSO' and ref_operation_id=p_venta_operation_id) then raise exception 'venta_stock_ya_revertida'; end if;
  for rec in
    select distinct m.producto_id from public.movimientos_stock m
    where m.operation_id=p_venta_operation_id and m.tipo='VENTA'
    order by m.producto_id
  loop
    perform 1 from public.stock_ubicacion s
      where s.empresa_id=original_op.empresa_id and s.local_id=original_op.local_id and s.producto_id=rec.producto_id
      for update;
    if not found then raise exception 'stock_no_configurado:%',rec.producto_id; end if;
  end loop;
  insert into public.stock_operaciones(operation_id,tipo,empresa_id,local_id,producto_id,payload,actor_user_id,ref_operation_id)
  values(p_operation_id,'REVERSO',original_op.empresa_id,original_op.local_id,'__CARRITO__',payload_norm,auth.uid(),p_venta_operation_id);
  for rec in
    select m.* from public.movimientos_stock m
    where m.operation_id=p_venta_operation_id and m.tipo='VENTA'
    order by m.id
  loop
    if exists(select 1 from public.movimientos_stock where tipo='REVERSO' and movimiento_original_id=rec.id) then raise exception 'venta_stock_ya_revertida'; end if;
    update public.stock_ubicacion
       set almacen=almacen-rec.delta_almacen,
           piso=piso-rec.delta_piso,
           updated_at=now()
     where empresa_id=rec.empresa_id and local_id=rec.local_id and producto_id=rec.producto_id;
    datos_reverso:=coalesce(rec.datos,'{}'::jsonb)
      || jsonb_build_object('motivo',coalesce(p_motivo,''),'anulaVentaId',p_venta_operation_id,'ventaId',p_venta_operation_id);
    if rec.datos ? 'ingresoUnitario' and nullif(rec.datos->>'ingresoUnitario','') is not null then
      datos_reverso:=datos_reverso || jsonb_build_object('ingresoUnitario',-abs((rec.datos->>'ingresoUnitario')::numeric));
    end if;
    insert into public.movimientos_stock(operation_id,tipo,empresa_id,local_id,producto_id,delta_almacen,delta_piso,delta_total,cantidad,movimiento_original_id,datos,actor_user_id)
    values(p_operation_id,'REVERSO',rec.empresa_id,rec.local_id,rec.producto_id,-rec.delta_almacen,-rec.delta_piso,-rec.delta_total,rec.cantidad,rec.id,datos_reverso,auth.uid());
  end loop;
  select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) into movimientos_json from public.movimientos_stock m where m.operation_id=p_operation_id;
  return jsonb_build_object('ok',true,'replayed',false,'movimientos',movimientos_json,'lineasAnuladas',jsonb_array_length(movimientos_json),'localId',original_op.local_id);
end;
$$;
