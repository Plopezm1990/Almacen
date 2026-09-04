-- PM-07 · El TPV actual envía productoId; aceptar también producto_id por compatibilidad.
create or replace function public.registrar_venta_stock_carrito(
  p_operation_id text,p_empresa_id text,p_local_id text,p_lineas jsonb,p_datos jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer
set search_path='public','auth','private','pg_temp' as $$
declare
  op public.stock_operaciones%rowtype; s public.stock_ubicacion%rowtype; rec record;
  cant numeric; tomar_piso numeric; tomar_almacen numeric; payload_norm jsonb; lineas_norm jsonb; movimientos_json jsonb; saldos_json jsonb;
begin
  if auth.uid() is null or not private.pm07_puede_vender() then raise exception 'stock_no_autorizado'; end if;
  if not private.la_tiene_empresa(p_empresa_id) or not private.la_tiene_local(p_empresa_id,p_local_id) then raise exception 'contexto_no_autorizado'; end if;
  if p_operation_id is null or btrim(p_operation_id)='' then raise exception 'operation_id_requerido'; end if;
  if p_lineas is null or jsonb_typeof(p_lineas)<>'array' or jsonb_array_length(p_lineas)=0 then raise exception 'carrito_vacio'; end if;
  select jsonb_agg(jsonb_build_object('productoId',producto_id,'cantidad',cantidad) order by producto_id)
  into lineas_norm from (
    select btrim(coalesce(elem->>'productoId',elem->>'producto_id')) producto_id,
           sum(coalesce((elem->>'cantidad')::numeric,0))::numeric cantidad
    from jsonb_array_elements(p_lineas) elem
    where btrim(coalesce(elem->>'productoId',elem->>'producto_id',''))<>''
      and coalesce((elem->>'cantidad')::numeric,0)>0
    group by btrim(coalesce(elem->>'productoId',elem->>'producto_id'))
  ) q;
  if lineas_norm is null or jsonb_array_length(lineas_norm)=0 then raise exception 'carrito_vacio'; end if;
  payload_norm:=jsonb_build_object('modo','CARRITO','empresaId',p_empresa_id,'localId',p_local_id,'lineas',lineas_norm,'datos',coalesce(p_datos,'{}'::jsonb));
  select * into op from public.stock_operaciones where operation_id=p_operation_id;
  if found then
    if op.tipo='VENTA' and op.payload=payload_norm then
      select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) into movimientos_json from public.movimientos_stock m where m.operation_id=p_operation_id;
      return jsonb_build_object('ok',true,'replayed',true,'movimientos',movimientos_json);
    end if;
    raise exception 'operation_id_conflict';
  end if;
  for rec in select x->>'productoId' producto_id,(x->>'cantidad')::numeric cantidad from jsonb_array_elements(lineas_norm) x order by x->>'productoId' loop
    select * into s from public.stock_ubicacion where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=rec.producto_id for update;
    if not found then raise exception 'stock_no_configurado:%',rec.producto_id; end if;
    if not s.local_operable then raise exception 'local_inactivo'; end if;
    cant:=private.pm07_validar_cantidad(rec.cantidad,s.fraccionable,s.precision_cantidad);
    if round(s.almacen+s.piso,6)<cant then raise exception 'stock_insuficiente:%',rec.producto_id; end if;
  end loop;
  insert into public.stock_operaciones(operation_id,tipo,empresa_id,local_id,producto_id,payload,actor_user_id)
  values(p_operation_id,'VENTA',p_empresa_id,p_local_id,'__CARRITO__',payload_norm,auth.uid());
  for rec in select x->>'productoId' producto_id,(x->>'cantidad')::numeric cantidad from jsonb_array_elements(lineas_norm) x order by x->>'productoId' loop
    select * into s from public.stock_ubicacion where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=rec.producto_id for update;
    cant:=private.pm07_validar_cantidad(rec.cantidad,s.fraccionable,s.precision_cantidad);
    tomar_piso:=least(s.piso,cant); tomar_almacen:=cant-tomar_piso;
    update public.stock_ubicacion set piso=piso-tomar_piso,almacen=almacen-tomar_almacen,updated_at=now() where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=rec.producto_id;
    insert into public.movimientos_stock(operation_id,tipo,empresa_id,local_id,producto_id,delta_almacen,delta_piso,delta_total,cantidad,datos,actor_user_id)
    values(p_operation_id,'VENTA',p_empresa_id,p_local_id,rec.producto_id,-tomar_almacen,-tomar_piso,-cant,cant,
      coalesce((select elem from jsonb_array_elements(p_lineas) elem where coalesce(elem->>'productoId',elem->>'producto_id')=rec.producto_id limit 1),'{}'::jsonb),auth.uid());
  end loop;
  select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) into movimientos_json from public.movimientos_stock m where m.operation_id=p_operation_id;
  select coalesce(jsonb_agg(jsonb_build_object('productoId',s2.producto_id,'almacen',s2.almacen,'piso',s2.piso,'total',round(s2.almacen+s2.piso,6)) order by s2.producto_id),'[]'::jsonb) into saldos_json
  from public.stock_ubicacion s2 where s2.empresa_id=p_empresa_id and s2.local_id=p_local_id and s2.producto_id in (select x->>'productoId' from jsonb_array_elements(lineas_norm) x);
  return jsonb_build_object('ok',true,'replayed',false,'movimientos',movimientos_json,'saldos',saldos_json);
end; $$;
