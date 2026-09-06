-- PM-07 · Carrito multílínea y traspaso interlocal atómicos.
alter table public.stock_ubicacion add column if not exists unidad text not null default 'ud';
update public.stock_ubicacion s
set unidad = coalesce(nullif(btrim(k.value->>'unidad'),''), s.unidad)
from public.almacen_kv k
where k.empresa_id=s.empresa_id
  and (k.value->>'id')=s.producto_id
  and k.key like 'qa_pm04:%:producto';

alter table public.stock_operaciones drop constraint if exists stock_operaciones_tipo_check;
alter table public.stock_operaciones add constraint stock_operaciones_tipo_check check (tipo in ('VENTA','REVERSO','TRASLADO_INTERNO','TRASLADO_ENTRE_LOCALES'));
alter table public.movimientos_stock drop constraint if exists movimientos_stock_tipo_check;
alter table public.movimientos_stock add constraint movimientos_stock_tipo_check check (tipo in ('VENTA','REVERSO','TRASLADO_INTERNO','TRASLADO_ENTRE_LOCALES'));

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
    select btrim(x.producto_id) producto_id, sum(x.cantidad)::numeric cantidad
    from jsonb_to_recordset(p_lineas) as x(producto_id text,cantidad numeric)
    where btrim(coalesce(x.producto_id,''))<>'' and coalesce(x.cantidad,0)>0
    group by btrim(x.producto_id)
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
      coalesce((select elem from jsonb_array_elements(p_lineas) elem where elem->>'producto_id'=rec.producto_id or elem->>'productoId'=rec.producto_id limit 1),'{}'::jsonb),auth.uid());
  end loop;
  select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) into movimientos_json from public.movimientos_stock m where m.operation_id=p_operation_id;
  select coalesce(jsonb_agg(jsonb_build_object('productoId',s2.producto_id,'almacen',s2.almacen,'piso',s2.piso,'total',round(s2.almacen+s2.piso,6)) order by s2.producto_id),'[]'::jsonb) into saldos_json
  from public.stock_ubicacion s2 where s2.empresa_id=p_empresa_id and s2.local_id=p_local_id and s2.producto_id in (select x->>'productoId' from jsonb_array_elements(lineas_norm) x);
  return jsonb_build_object('ok',true,'replayed',false,'movimientos',movimientos_json,'saldos',saldos_json);
end; $$;

create or replace function public.revertir_venta_stock_carrito(
  p_operation_id text,p_venta_operation_id text,p_motivo text default null
) returns jsonb language plpgsql security definer
set search_path='public','auth','private','pg_temp' as $$
declare
  original_op public.stock_operaciones%rowtype; op public.stock_operaciones%rowtype; rec record; payload_norm jsonb; movimientos_json jsonb;
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
  for rec in select distinct m.producto_id from public.movimientos_stock m where m.operation_id=p_venta_operation_id and m.tipo='VENTA' order by m.producto_id loop
    perform 1 from public.stock_ubicacion s where s.empresa_id=original_op.empresa_id and s.local_id=original_op.local_id and s.producto_id=rec.producto_id for update;
    if not found then raise exception 'stock_no_configurado:%',rec.producto_id; end if;
  end loop;
  insert into public.stock_operaciones(operation_id,tipo,empresa_id,local_id,producto_id,payload,actor_user_id,ref_operation_id)
  values(p_operation_id,'REVERSO',original_op.empresa_id,original_op.local_id,'__CARRITO__',payload_norm,auth.uid(),p_venta_operation_id);
  for rec in select m.* from public.movimientos_stock m where m.operation_id=p_venta_operation_id and m.tipo='VENTA' order by m.id loop
    if exists(select 1 from public.movimientos_stock where tipo='REVERSO' and movimiento_original_id=rec.id) then raise exception 'venta_stock_ya_revertida'; end if;
    update public.stock_ubicacion set almacen=almacen-rec.delta_almacen,piso=piso-rec.delta_piso,updated_at=now() where empresa_id=rec.empresa_id and local_id=rec.local_id and producto_id=rec.producto_id;
    insert into public.movimientos_stock(operation_id,tipo,empresa_id,local_id,producto_id,delta_almacen,delta_piso,delta_total,cantidad,movimiento_original_id,datos,actor_user_id)
    values(p_operation_id,'REVERSO',rec.empresa_id,rec.local_id,rec.producto_id,-rec.delta_almacen,-rec.delta_piso,-rec.delta_total,rec.cantidad,rec.id,jsonb_build_object('motivo',coalesce(p_motivo,'')),auth.uid());
  end loop;
  select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) into movimientos_json from public.movimientos_stock m where m.operation_id=p_operation_id;
  return jsonb_build_object('ok',true,'replayed',false,'movimientos',movimientos_json,'lineasAnuladas',jsonb_array_length(movimientos_json),'localId',original_op.local_id);
end; $$;

create or replace function public.trasladar_stock_entre_locales(
  p_operation_id text,p_empresa_id text,p_origen_local_id text,p_destino_local_id text,p_producto_origen_id text,p_producto_destino_id text,p_cantidad numeric,p_datos jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer
set search_path='public','auth','private','pg_temp' as $$
declare
  so public.stock_ubicacion%rowtype; sd public.stock_ubicacion%rowtype; op public.stock_operaciones%rowtype; payload_norm jsonb; cant numeric; movs jsonb;
begin
  if auth.uid() is null or not private.pm07_puede_gestionar_stock() then raise exception 'traslado_no_autorizado'; end if;
  if p_operation_id is null or btrim(p_operation_id)='' then raise exception 'operation_id_requerido'; end if;
  if p_origen_local_id is null or p_destino_local_id is null or p_origen_local_id=p_destino_local_id then raise exception 'local_destino_invalido'; end if;
  if not private.la_tiene_local(p_empresa_id,p_origen_local_id) or not private.la_tiene_local(p_empresa_id,p_destino_local_id) then raise exception 'contexto_no_autorizado'; end if;
  payload_norm:=jsonb_build_object('empresaId',p_empresa_id,'origenLocalId',p_origen_local_id,'destinoLocalId',p_destino_local_id,'productoOrigenId',p_producto_origen_id,'productoDestinoId',p_producto_destino_id,'cantidad',p_cantidad,'datos',coalesce(p_datos,'{}'::jsonb));
  select * into op from public.stock_operaciones where operation_id=p_operation_id;
  if found then
    if op.tipo='TRASLADO_ENTRE_LOCALES' and op.payload=payload_norm then
      select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) into movs from public.movimientos_stock m where m.operation_id=p_operation_id;
      return jsonb_build_object('ok',true,'replayed',true,'movimientos',movs);
    end if;
    raise exception 'operation_id_conflict';
  end if;
  if (p_origen_local_id,p_producto_origen_id) <= (p_destino_local_id,p_producto_destino_id) then
    select * into so from public.stock_ubicacion where empresa_id=p_empresa_id and local_id=p_origen_local_id and producto_id=p_producto_origen_id for update;
    select * into sd from public.stock_ubicacion where empresa_id=p_empresa_id and local_id=p_destino_local_id and producto_id=p_producto_destino_id for update;
  else
    select * into sd from public.stock_ubicacion where empresa_id=p_empresa_id and local_id=p_destino_local_id and producto_id=p_producto_destino_id for update;
    select * into so from public.stock_ubicacion where empresa_id=p_empresa_id and local_id=p_origen_local_id and producto_id=p_producto_origen_id for update;
  end if;
  if so.producto_id is null or sd.producto_id is null then raise exception 'stock_no_configurado'; end if;
  if not so.local_operable or not sd.local_operable then raise exception 'local_inactivo'; end if;
  if lower(btrim(so.unidad))<>lower(btrim(sd.unidad)) then raise exception 'unidad_incompatible'; end if;
  cant:=private.pm07_validar_cantidad(p_cantidad,so.fraccionable,so.precision_cantidad);
  perform private.pm07_validar_cantidad(cant,sd.fraccionable,sd.precision_cantidad);
  if so.almacen<cant then raise exception 'stock_insuficiente_ubicacion'; end if;
  insert into public.stock_operaciones(operation_id,tipo,empresa_id,local_id,producto_id,payload,actor_user_id)
  values(p_operation_id,'TRASLADO_ENTRE_LOCALES',p_empresa_id,p_origen_local_id,p_producto_origen_id,payload_norm,auth.uid());
  update public.stock_ubicacion set almacen=almacen-cant,updated_at=now() where empresa_id=p_empresa_id and local_id=p_origen_local_id and producto_id=p_producto_origen_id;
  update public.stock_ubicacion set almacen=almacen+cant,updated_at=now() where empresa_id=p_empresa_id and local_id=p_destino_local_id and producto_id=p_producto_destino_id;
  insert into public.movimientos_stock(operation_id,tipo,empresa_id,local_id,producto_id,delta_almacen,delta_piso,delta_total,cantidad,datos,actor_user_id)
  values
    (p_operation_id,'TRASLADO_ENTRE_LOCALES',p_empresa_id,p_origen_local_id,p_producto_origen_id,-cant,0,-cant,cant,jsonb_build_object('direccion','SALIDA','destinoLocalId',p_destino_local_id,'productoDestinoId',p_producto_destino_id),auth.uid()),
    (p_operation_id,'TRASLADO_ENTRE_LOCALES',p_empresa_id,p_destino_local_id,p_producto_destino_id,cant,0,cant,cant,jsonb_build_object('direccion','ENTRADA','origenLocalId',p_origen_local_id,'productoOrigenId',p_producto_origen_id),auth.uid());
  select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) into movs from public.movimientos_stock m where m.operation_id=p_operation_id;
  return jsonb_build_object('ok',true,'replayed',false,'movimientos',movs,'efectoNetoEmpresa',0);
end; $$;

revoke all on function public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb) from public;
revoke all on function public.revertir_venta_stock_carrito(text,text,text) from public;
revoke all on function public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb) from public;
grant execute on function public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb) to authenticated;
grant execute on function public.revertir_venta_stock_carrito(text,text,text) to authenticated;
grant execute on function public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb) to authenticated;
