-- Salidas manuales contra el mismo saldo y libro mayor que recepciones y TPV.
alter table public.stock_operaciones drop constraint stock_operaciones_tipo_check;
alter table public.stock_operaciones add constraint stock_operaciones_tipo_check check (tipo in (
  'VENTA','RECEPCION','REVERSO','TRASLADO_INTERNO','TRASLADO_ENTRE_LOCALES',
  'DEVOLUCION_CLIENTE','DEVOLUCION_PROVEEDOR','INVENTARIO_PM12','MERMA_COMANDA','SALIDA_MANUAL'
));
alter table public.movimientos_stock drop constraint movimientos_stock_tipo_check;
alter table public.movimientos_stock add constraint movimientos_stock_tipo_check check (tipo in (
  'VENTA','RECEPCION','REVERSO','TRASLADO_INTERNO','TRASLADO_ENTRE_LOCALES',
  'DEVOLUCION_CLIENTE','DEVOLUCION_PROVEEDOR','INVENTARIO_PM12','MERMA_COMANDA','SALIDA_MANUAL'
));

create function private.registrar_salida_stock(
  p_empresa_id text, p_local_id text, p_producto_id text, p_movimiento_id text,
  p_cantidad numeric, p_motivo text, p_referencia text, p_costo numeric, p_lote_id text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  salida_id text := 'salida-manual:' || md5(jsonb_build_array(p_empresa_id,p_local_id,p_movimiento_id)::text);
  saldo public.stock_ubicacion%rowtype;
  anterior public.stock_operaciones%rowtype;
  movimiento public.movimientos_stock%rowtype;
  solicitud jsonb;
  reservadas numeric;
  del_almacen numeric;
  del_piso numeric;
begin
  if actor is null or not coalesce(private.pm07_puede_gestionar_stock(),false)
     or not coalesce(private.la_tiene_local(p_empresa_id,p_local_id),false) then
    raise exception 'salida_no_autorizada';
  end if;
  if nullif(btrim(p_producto_id),'') is null or nullif(btrim(p_movimiento_id),'') is null
     or length(p_movimiento_id)>1000 or length(coalesce(p_referencia,''))>1000
     or length(coalesce(p_lote_id,''))>1000
     or p_cantidad is null or p_cantidad::text in ('NaN','Infinity','-Infinity') or p_cantidad<=0
     or p_costo is null or p_costo::text in ('NaN','Infinity','-Infinity') or p_costo<0
     or p_motivo is null or p_motivo not in (
       'Merma','Autoconsumo','Rotura','Producción','Caducidad','Merma / caducidad','Deterioro',
       'Robo o pérdida','Error de registro','Devolución no registrada','Consumo interno',
       'Degustación','Producto defectuoso','Otro'
     ) or (p_lote_id is not null and p_motivo <> 'Merma / caducidad') then
    raise exception 'salida_datos_invalidos';
  end if;
  solicitud := jsonb_build_object('cantidad',p_cantidad,'motivo',p_motivo,
    'referencia',nullif(btrim(p_referencia),''),'loteId',p_lote_id);
  perform private.pm09_bloquear_operation_id_stock(salida_id);
  select * into anterior from public.stock_operaciones where operation_id=salida_id;
  if found then
    if anterior.tipo<>'SALIDA_MANUAL' or anterior.empresa_id<>p_empresa_id
       or anterior.local_id<>p_local_id or anterior.producto_id<>p_producto_id
       or anterior.payload is distinct from solicitud then
      raise exception 'operation_id_conflict';
    end if;
    select * into strict movimiento from public.movimientos_stock where operation_id=salida_id;
    select * into strict saldo from public.stock_ubicacion
     where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=p_producto_id;
    return jsonb_build_object('ok',true,'replayed',true,'total',saldo.almacen+saldo.piso,'movimiento',to_jsonb(movimiento));
  end if;

  select * into saldo from public.stock_ubicacion
   where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=p_producto_id for update;
  if not found then raise exception 'stock_no_configurado'; end if;
  if not saldo.local_operable then raise exception 'local_inactivo'; end if;
  perform private.pm07_validar_cantidad(p_cantidad,saldo.fraccionable,saldo.precision_cantidad);
  select coalesce(sum(cantidad),0) into reservadas from public.abc_stock_lineas
   where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=p_producto_id and estado='RESERVADA';
  if saldo.almacen+saldo.piso-reservadas<p_cantidad then raise exception 'stock_insuficiente'; end if;
  del_almacen := least(saldo.almacen,p_cantidad);
  del_piso := p_cantidad-del_almacen;

  insert into public.stock_operaciones(operation_id,tipo,empresa_id,local_id,producto_id,payload,actor_user_id)
    values (salida_id,'SALIDA_MANUAL',p_empresa_id,p_local_id,p_producto_id,solicitud,actor);
  update public.stock_ubicacion set almacen=almacen-del_almacen,piso=piso-del_piso,updated_at=now()
    where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=p_producto_id returning * into saldo;
  insert into public.movimientos_stock(operation_id,tipo,empresa_id,local_id,producto_id,
    delta_almacen,delta_piso,delta_total,cantidad,datos,actor_user_id)
    values (salida_id,'SALIDA_MANUAL',p_empresa_id,p_local_id,p_producto_id,-del_almacen,-del_piso,-p_cantidad,p_cantidad,
      solicitud || jsonb_build_object('movimientoId',p_movimiento_id,'costoUnitario',p_costo,
        'tipoAplicacion',case when p_motivo='Otro' then 'OTRO' else 'MERMA' end),actor)
    returning * into movimiento;
  return jsonb_build_object('ok',true,'replayed',false,'total',saldo.almacen+saldo.piso,'movimiento',to_jsonb(movimiento));
end;
$$;

create function public.registrar_salida_stock(
  p_empresa_id text, p_local_id text, p_producto_id text, p_movimiento_id text,
  p_cantidad numeric, p_motivo text, p_referencia text, p_costo numeric, p_lote_id text
) returns jsonb language sql security invoker set search_path = '' as $$
  select private.registrar_salida_stock(p_empresa_id,p_local_id,p_producto_id,p_movimiento_id,
    p_cantidad,p_motivo,p_referencia,p_costo,p_lote_id);
$$;

revoke all on function private.registrar_salida_stock(text,text,text,text,numeric,text,text,numeric,text) from public,anon,authenticated,service_role;
revoke all on function public.registrar_salida_stock(text,text,text,text,numeric,text,text,numeric,text) from public,anon,authenticated,service_role;
grant execute on function private.registrar_salida_stock(text,text,text,text,numeric,text,text,numeric,text) to authenticated;
grant execute on function public.registrar_salida_stock(text,text,text,text,numeric,text,text,numeric,text) to authenticated;
