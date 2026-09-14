-- PM27 / C18 — Stock y ventas
-- Corrige el hueco de idempotencia global de las RPC BASE de venta.
-- El flujo PM09 ya serializa operation_id contra Caja/arqueos, pero las RPC
-- public.registrar_venta_stock* seguían ejecutables por authenticated sin ese guard.
-- Candidato aislado: NO aplicar a QA/producción sin autorización específica.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if to_regprocedure('private.pm09_bloquear_operation_id_stock(text)') is null then
    raise exception 'pm27_c18_preflight_fallo: falta private.pm09_bloquear_operation_id_stock(text)';
  end if;
end;
$$;

create or replace function public.registrar_venta_stock(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_producto_id text,
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
  payload_norm jsonb;
  cant numeric;
  tomar_piso numeric;
  tomar_almacen numeric;
  mov public.movimientos_stock%rowtype;
  v_operation_id text;
begin
  if auth.uid() is null or not private.pm07_puede_vender() then raise exception 'stock_no_autorizado'; end if;
  if not private.la_tiene_empresa(p_empresa_id) or not private.la_tiene_local(p_empresa_id,p_local_id) then raise exception 'contexto_no_autorizado'; end if;

  -- PM27 C18: una venta BASE participa en el mismo ledger lógico global que
  -- Caja, arqueos, anulaciones y los wrappers PM09. El helper valida el ID,
  -- toma el advisory xact lock compartido y rechaza colisiones cross-ledger.
  v_operation_id := private.pm09_bloquear_operation_id_stock(p_operation_id);

  select * into s from public.stock_ubicacion
   where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=p_producto_id
   for update;
  if not found then raise exception 'stock_no_configurado'; end if;
  if not s.local_operable then raise exception 'local_inactivo'; end if;

  cant:=private.pm07_validar_cantidad(p_cantidad,s.fraccionable,s.precision_cantidad);
  payload_norm:=jsonb_build_object('empresaId',p_empresa_id,'localId',p_local_id,'productoId',p_producto_id,'cantidad',cant,'datos',coalesce(p_datos,'{}'::jsonb));

  select * into op from public.stock_operaciones where operation_id=v_operation_id;
  if found then
    if op.tipo='VENTA' and op.payload=payload_norm then
      select * into mov from public.movimientos_stock where operation_id=v_operation_id limit 1;
      return jsonb_build_object('ok',true,'replayed',true,'movimiento',to_jsonb(mov));
    end if;
    raise exception 'operation_id_conflict';
  end if;

  if round(s.almacen+s.piso,6)<cant then raise exception 'stock_insuficiente'; end if;
  tomar_piso:=least(s.piso,cant);
  tomar_almacen:=cant-tomar_piso;

  update public.stock_ubicacion
     set piso=piso-tomar_piso, almacen=almacen-tomar_almacen, updated_at=now()
   where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=p_producto_id;

  insert into public.stock_operaciones(operation_id,tipo,empresa_id,local_id,producto_id,payload,actor_user_id)
  values(v_operation_id,'VENTA',p_empresa_id,p_local_id,p_producto_id,payload_norm,auth.uid());

  insert into public.movimientos_stock(operation_id,tipo,empresa_id,local_id,producto_id,delta_almacen,delta_piso,delta_total,cantidad,datos,actor_user_id)
  values(v_operation_id,'VENTA',p_empresa_id,p_local_id,p_producto_id,-tomar_almacen,-tomar_piso,-cant,cant,coalesce(p_datos,'{}'::jsonb),auth.uid())
  returning * into mov;

  return jsonb_build_object('ok',true,'replayed',false,'movimiento',to_jsonb(mov),'saldo',jsonb_build_object('almacen',s.almacen-tomar_almacen,'piso',s.piso-tomar_piso,'total',s.almacen+s.piso-cant));
end;
$$;

create or replace function public.registrar_venta_stock_carrito(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_lineas jsonb,
  p_datos jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path='public','auth','private','pg_temp'
as $$
declare
  op public.stock_operaciones%rowtype;
  s public.stock_ubicacion%rowtype;
  rec record;
  cant numeric;
  tomar_piso numeric;
  tomar_almacen numeric;
  payload_norm jsonb;
  lineas_norm jsonb;
  movimientos_json jsonb;
  saldos_json jsonb;
  v_operation_id text;
begin
  if auth.uid() is null or not private.pm07_puede_vender() then raise exception 'stock_no_autorizado'; end if;
  if not private.la_tiene_empresa(p_empresa_id) or not private.la_tiene_local(p_empresa_id,p_local_id) then raise exception 'contexto_no_autorizado'; end if;

  -- Mismo lock/namespace global que la venta unitaria y los wrappers PM09.
  v_operation_id := private.pm09_bloquear_operation_id_stock(p_operation_id);

  if p_lineas is null or jsonb_typeof(p_lineas)<>'array' or jsonb_array_length(p_lineas)=0 then raise exception 'carrito_vacio'; end if;

  select jsonb_agg(jsonb_build_object('productoId',producto_id,'cantidad',cantidad) order by producto_id)
    into lineas_norm
    from (
      select btrim(coalesce(elem->>'productoId',elem->>'producto_id')) producto_id,
             sum(coalesce((elem->>'cantidad')::numeric,0))::numeric cantidad
      from jsonb_array_elements(p_lineas) elem
      where btrim(coalesce(elem->>'productoId',elem->>'producto_id',''))<>''
        and coalesce((elem->>'cantidad')::numeric,0)>0
      group by btrim(coalesce(elem->>'productoId',elem->>'producto_id'))
    ) q;
  if lineas_norm is null or jsonb_array_length(lineas_norm)=0 then raise exception 'carrito_vacio'; end if;

  payload_norm:=jsonb_build_object('modo','CARRITO','empresaId',p_empresa_id,'localId',p_local_id,'lineas',lineas_norm,'datos',coalesce(p_datos,'{}'::jsonb));
  select * into op from public.stock_operaciones where operation_id=v_operation_id;
  if found then
    if op.tipo='VENTA' and op.payload=payload_norm then
      select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb)
        into movimientos_json
        from public.movimientos_stock m
       where m.operation_id=v_operation_id;
      return jsonb_build_object('ok',true,'replayed',true,'movimientos',movimientos_json);
    end if;
    raise exception 'operation_id_conflict';
  end if;

  -- Preflight completo: bloquear/validar todas las líneas antes de escribir.
  for rec in
    select x->>'productoId' producto_id, (x->>'cantidad')::numeric cantidad
    from jsonb_array_elements(lineas_norm) x
    order by x->>'productoId'
  loop
    select * into s from public.stock_ubicacion
      where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=rec.producto_id
      for update;
    if not found then raise exception 'stock_no_configurado:%',rec.producto_id; end if;
    if not s.local_operable then raise exception 'local_inactivo'; end if;
    cant:=private.pm07_validar_cantidad(rec.cantidad,s.fraccionable,s.precision_cantidad);
    if round(s.almacen+s.piso,6)<cant then raise exception 'stock_insuficiente:%',rec.producto_id; end if;
  end loop;

  insert into public.stock_operaciones(operation_id,tipo,empresa_id,local_id,producto_id,payload,actor_user_id)
  values(v_operation_id,'VENTA',p_empresa_id,p_local_id,'__CARRITO__',payload_norm,auth.uid());

  for rec in
    select x->>'productoId' producto_id, (x->>'cantidad')::numeric cantidad
    from jsonb_array_elements(lineas_norm) x
    order by x->>'productoId'
  loop
    select * into s from public.stock_ubicacion
      where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=rec.producto_id
      for update;
    cant:=private.pm07_validar_cantidad(rec.cantidad,s.fraccionable,s.precision_cantidad);
    tomar_piso:=least(s.piso,cant);
    tomar_almacen:=cant-tomar_piso;
    update public.stock_ubicacion
       set piso=piso-tomar_piso, almacen=almacen-tomar_almacen, updated_at=now()
     where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=rec.producto_id;
    insert into public.movimientos_stock(operation_id,tipo,empresa_id,local_id,producto_id,delta_almacen,delta_piso,delta_total,cantidad,datos,actor_user_id)
    values(v_operation_id,'VENTA',p_empresa_id,p_local_id,rec.producto_id,-tomar_almacen,-tomar_piso,-cant,cant,
      coalesce((select elem from jsonb_array_elements(p_lineas) elem where coalesce(elem->>'productoId',elem->>'producto_id')=rec.producto_id limit 1),'{}'::jsonb),auth.uid());
  end loop;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb)
    into movimientos_json
    from public.movimientos_stock m
   where m.operation_id=v_operation_id;
  select coalesce(jsonb_agg(jsonb_build_object('productoId',s2.producto_id,'almacen',s2.almacen,'piso',s2.piso,'total',round(s2.almacen+s2.piso,6)) order by s2.producto_id),'[]'::jsonb)
    into saldos_json
    from public.stock_ubicacion s2
   where s2.empresa_id=p_empresa_id and s2.local_id=p_local_id
     and s2.producto_id in (select x->>'productoId' from jsonb_array_elements(lineas_norm) x);
  return jsonb_build_object('ok',true,'replayed',false,'movimientos',movimientos_json,'saldos',saldos_json);
end;
$$;

-- Mantener la misma superficie pública autenticada que ya existe; no se
-- abre ejecución a anon/public y no se altera service_role.
revoke all on function public.registrar_venta_stock(text,text,text,text,numeric,jsonb) from public, anon;
revoke all on function public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb) from public, anon;
grant execute on function public.registrar_venta_stock(text,text,text,text,numeric,jsonb) to authenticated;
grant execute on function public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb) to authenticated;

commit;