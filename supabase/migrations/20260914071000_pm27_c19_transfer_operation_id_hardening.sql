-- PM27 / C19 — Traspasos
-- Endurece operation_id global en traslados internos/interlocales y mueve el
-- replay del traslado interno antes de depender del estado mutable del stock.
-- Candidato aislado: NO aplicar a QA/producción sin autorización específica.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if to_regprocedure('private.pm09_bloquear_operation_id_stock(text)') is null then
    raise exception 'pm27_c19_preflight_fallo: falta private.pm09_bloquear_operation_id_stock(text)';
  end if;
end;
$$;

create or replace function public.trasladar_stock_interno(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_producto_id text,
  p_origen text,
  p_destino text,
  p_cantidad numeric,
  p_datos jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path='public','auth','private','pg_temp'
as $$
declare
  s public.stock_ubicacion%rowtype;
  op public.stock_operaciones%rowtype;
  mov public.movimientos_stock%rowtype;
  payload_norm jsonb;
  cant numeric;
  da numeric:=0;
  dp numeric:=0;
  v_operation_id text;
begin
  if auth.uid() is null or not private.pm07_puede_gestionar_stock() then raise exception 'traslado_no_autorizado'; end if;
  if not private.la_tiene_local(p_empresa_id,p_local_id) then raise exception 'contexto_no_autorizado'; end if;
  if p_origen not in ('almacen','piso') or p_destino not in ('almacen','piso') or p_origen=p_destino then raise exception 'ubicacion_invalida'; end if;
  if p_operation_id is null or btrim(p_operation_id)='' then raise exception 'operation_id_requerido'; end if;

  -- Ledger global compartido con ventas, reversos, Caja y arqueos.
  v_operation_id := private.pm09_bloquear_operation_id_stock(p_operation_id);

  -- Para un replay ya comprometido no se exige que el stock siga en el mismo
  -- estado operativo actual. Sí se vuelve a exigir identidad/contexto válidos.
  payload_norm:=jsonb_build_object(
    'empresaId',p_empresa_id,'localId',p_local_id,'productoId',p_producto_id,
    'origen',p_origen,'destino',p_destino,'cantidad',p_cantidad,
    'datos',coalesce(p_datos,'{}'::jsonb)
  );
  select * into op from public.stock_operaciones where operation_id=v_operation_id;
  if found then
    if op.tipo='TRASLADO_INTERNO' and op.payload=payload_norm then
      select * into mov from public.movimientos_stock where operation_id=v_operation_id limit 1;
      return jsonb_build_object('ok',true,'replayed',true,'movimiento',to_jsonb(mov));
    end if;
    raise exception 'operation_id_conflict';
  end if;

  select * into s from public.stock_ubicacion
   where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=p_producto_id
   for update;
  if not found then raise exception 'stock_no_configurado'; end if;
  if not s.local_operable then raise exception 'local_inactivo'; end if;

  cant:=private.pm07_validar_cantidad(p_cantidad,s.fraccionable,s.precision_cantidad);
  payload_norm:=jsonb_build_object(
    'empresaId',p_empresa_id,'localId',p_local_id,'productoId',p_producto_id,
    'origen',p_origen,'destino',p_destino,'cantidad',cant,
    'datos',coalesce(p_datos,'{}'::jsonb)
  );

  if p_origen='almacen' then
    if s.almacen<cant then raise exception 'stock_insuficiente_ubicacion'; end if;
    da:=-cant;
    dp:=cant;
  else
    if s.piso<cant then raise exception 'stock_insuficiente_ubicacion'; end if;
    dp:=-cant;
    da:=cant;
  end if;

  update public.stock_ubicacion
     set almacen=almacen+da,piso=piso+dp,updated_at=now()
   where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=p_producto_id;

  insert into public.stock_operaciones(operation_id,tipo,empresa_id,local_id,producto_id,payload,actor_user_id)
  values(v_operation_id,'TRASLADO_INTERNO',p_empresa_id,p_local_id,p_producto_id,payload_norm,auth.uid());

  insert into public.movimientos_stock(operation_id,tipo,empresa_id,local_id,producto_id,delta_almacen,delta_piso,delta_total,cantidad,datos,actor_user_id)
  values(v_operation_id,'TRASLADO_INTERNO',p_empresa_id,p_local_id,p_producto_id,da,dp,0,cant,coalesce(p_datos,'{}'::jsonb),auth.uid())
  returning * into mov;

  return jsonb_build_object(
    'ok',true,'replayed',false,'movimiento',to_jsonb(mov),
    'saldo',jsonb_build_object('almacen',s.almacen+da,'piso',s.piso+dp,'total',s.almacen+s.piso)
  );
end;
$$;

create or replace function public.trasladar_stock_entre_locales(
  p_operation_id text,
  p_empresa_id text,
  p_origen_local_id text,
  p_destino_local_id text,
  p_producto_origen_id text,
  p_producto_destino_id text,
  p_cantidad numeric,
  p_datos jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path='public','auth','private','pg_temp'
as $$
declare
  so public.stock_ubicacion%rowtype;
  sd public.stock_ubicacion%rowtype;
  op public.stock_operaciones%rowtype;
  payload_norm jsonb;
  cant numeric;
  movs jsonb;
  v_operation_id text;
begin
  if auth.uid() is null or not private.pm07_puede_gestionar_stock() then raise exception 'traslado_no_autorizado'; end if;
  if p_operation_id is null or btrim(p_operation_id)='' then raise exception 'operation_id_requerido'; end if;
  if p_origen_local_id is null or p_destino_local_id is null or p_origen_local_id=p_destino_local_id then raise exception 'local_destino_invalido'; end if;
  if not private.la_tiene_local(p_empresa_id,p_origen_local_id) or not private.la_tiene_local(p_empresa_id,p_destino_local_id) then raise exception 'contexto_no_autorizado'; end if;

  v_operation_id := private.pm09_bloquear_operation_id_stock(p_operation_id);

  payload_norm:=jsonb_build_object(
    'empresaId',p_empresa_id,'origenLocalId',p_origen_local_id,'destinoLocalId',p_destino_local_id,
    'productoOrigenId',p_producto_origen_id,'productoDestinoId',p_producto_destino_id,
    'cantidad',p_cantidad,'datos',coalesce(p_datos,'{}'::jsonb)
  );
  select * into op from public.stock_operaciones where operation_id=v_operation_id;
  if found then
    if op.tipo='TRASLADO_ENTRE_LOCALES' and op.payload=payload_norm then
      select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb)
        into movs from public.movimientos_stock m where m.operation_id=v_operation_id;
      return jsonb_build_object('ok',true,'replayed',true,'movimientos',movs);
    end if;
    raise exception 'operation_id_conflict';
  end if;

  -- Lock determinista de origen/destino: misma frontera transaccional para
  -- evitar carreras y deadlocks antes de cualquier efecto económico.
  if (p_origen_local_id,p_producto_origen_id) <= (p_destino_local_id,p_producto_destino_id) then
    select * into so from public.stock_ubicacion
      where empresa_id=p_empresa_id and local_id=p_origen_local_id and producto_id=p_producto_origen_id for update;
    select * into sd from public.stock_ubicacion
      where empresa_id=p_empresa_id and local_id=p_destino_local_id and producto_id=p_producto_destino_id for update;
  else
    select * into sd from public.stock_ubicacion
      where empresa_id=p_empresa_id and local_id=p_destino_local_id and producto_id=p_producto_destino_id for update;
    select * into so from public.stock_ubicacion
      where empresa_id=p_empresa_id and local_id=p_origen_local_id and producto_id=p_producto_origen_id for update;
  end if;

  if so.producto_id is null or sd.producto_id is null then raise exception 'stock_no_configurado'; end if;
  if not so.local_operable or not sd.local_operable then raise exception 'local_inactivo'; end if;
  if lower(btrim(so.unidad))<>lower(btrim(sd.unidad)) then raise exception 'unidad_incompatible'; end if;
  cant:=private.pm07_validar_cantidad(p_cantidad,so.fraccionable,so.precision_cantidad);
  perform private.pm07_validar_cantidad(cant,sd.fraccionable,sd.precision_cantidad);
  if so.almacen<cant then raise exception 'stock_insuficiente_ubicacion'; end if;

  -- Recalcular el payload con la cantidad semánticamente validada antes de persistir.
  payload_norm:=jsonb_build_object(
    'empresaId',p_empresa_id,'origenLocalId',p_origen_local_id,'destinoLocalId',p_destino_local_id,
    'productoOrigenId',p_producto_origen_id,'productoDestinoId',p_producto_destino_id,
    'cantidad',cant,'datos',coalesce(p_datos,'{}'::jsonb)
  );

  insert into public.stock_operaciones(operation_id,tipo,empresa_id,local_id,producto_id,payload,actor_user_id)
  values(v_operation_id,'TRASLADO_ENTRE_LOCALES',p_empresa_id,p_origen_local_id,p_producto_origen_id,payload_norm,auth.uid());

  update public.stock_ubicacion
     set almacen=almacen-cant,updated_at=now()
   where empresa_id=p_empresa_id and local_id=p_origen_local_id and producto_id=p_producto_origen_id;
  update public.stock_ubicacion
     set almacen=almacen+cant,updated_at=now()
   where empresa_id=p_empresa_id and local_id=p_destino_local_id and producto_id=p_producto_destino_id;

  insert into public.movimientos_stock(operation_id,tipo,empresa_id,local_id,producto_id,delta_almacen,delta_piso,delta_total,cantidad,datos,actor_user_id)
  values
    (v_operation_id,'TRASLADO_ENTRE_LOCALES',p_empresa_id,p_origen_local_id,p_producto_origen_id,-cant,0,-cant,cant,jsonb_build_object('direccion','SALIDA','destinoLocalId',p_destino_local_id,'productoDestinoId',p_producto_destino_id),auth.uid()),
    (v_operation_id,'TRASLADO_ENTRE_LOCALES',p_empresa_id,p_destino_local_id,p_producto_destino_id,cant,0,cant,cant,jsonb_build_object('direccion','ENTRADA','origenLocalId',p_origen_local_id,'productoOrigenId',p_producto_origen_id),auth.uid());

  select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb)
    into movs from public.movimientos_stock m where m.operation_id=v_operation_id;
  return jsonb_build_object('ok',true,'replayed',false,'movimientos',movs,'efectoNetoEmpresa',0);
end;
$$;

revoke all on function public.trasladar_stock_interno(text,text,text,text,text,text,numeric,jsonb) from public, anon;
revoke all on function public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb) from public, anon;
grant execute on function public.trasladar_stock_interno(text,text,text,text,text,text,numeric,jsonb) to authenticated;
grant execute on function public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb) to authenticated;

commit;