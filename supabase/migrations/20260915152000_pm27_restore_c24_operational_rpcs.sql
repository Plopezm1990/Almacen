-- PM27 / post-reset — restaurar RPC operativas certificadas de C18/C19/C21/C23.
--
-- La reconciliacion productiva PRE-C24 creo deliberadamente cinco stubs fail-closed
-- con pm27_reconciliacion_pendiente_c24. Este parche sustituye solo esos cinco stubs
-- por las implementaciones finales ya certificadas, adaptadas al esquema vivo actual.
-- No toca datos de negocio, Auth, RLS de tablas ni el motor global operation_id.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if to_regprocedure('public.registrar_venta_stock(text,text,text,text,numeric,jsonb)') is null
     or to_regprocedure('public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb)') is null
     or to_regprocedure('public.trasladar_stock_interno(text,text,text,text,text,text,numeric,jsonb)') is null
     or to_regprocedure('public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb)') is null
     or to_regprocedure('public.registrar_encargo(text,text,text,text,numeric,text,jsonb)') is null then
    raise exception 'PM27_RPC_RESTORE_PREFLIGHT_FALLO: faltan RPC stub objetivo';
  end if;

  if strpos(pg_get_functiondef('public.registrar_venta_stock(text,text,text,text,numeric,jsonb)'::regprocedure), 'pm27_reconciliacion_pendiente_c24') = 0
     or strpos(pg_get_functiondef('public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb)'::regprocedure), 'pm27_reconciliacion_pendiente_c24') = 0
     or strpos(pg_get_functiondef('public.trasladar_stock_interno(text,text,text,text,text,text,numeric,jsonb)'::regprocedure), 'pm27_reconciliacion_pendiente_c24') = 0
     or strpos(pg_get_functiondef('public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb)'::regprocedure), 'pm27_reconciliacion_pendiente_c24') = 0
     or strpos(pg_get_functiondef('public.registrar_encargo(text,text,text,text,numeric,text,jsonb)'::regprocedure), 'pm27_reconciliacion_pendiente_c24') = 0 then
    raise exception 'PM27_RPC_RESTORE_PREFLIGHT_FALLO: RPC objetivo ya restauradas o drift parcial';
  end if;

  if to_regprocedure('private.pm09_bloquear_operation_id_stock(text)') is null
     or to_regprocedure('private.pm07_puede_vender()') is null
     or to_regprocedure('private.pm07_validar_cantidad(numeric,boolean,smallint)') is null
     or to_regprocedure('private.pm07_puede_gestionar_stock()') is null
     or to_regprocedure('private.la_tiene_empresa(text)') is null
     or to_regprocedure('private.la_tiene_local(text,text)') is null
     or to_regprocedure('private.pm08_puede_operar_caja()') is null
     or to_regprocedure('private.pm08_local_operable(text,text)') is null
     or to_regprocedure('private.pm08_validar_dinero(numeric,boolean,boolean)') is null then
    raise exception 'PM27_RPC_RESTORE_PREFLIGHT_FALLO: faltan helpers requeridos';
  end if;

  if to_regclass('public.stock_ubicacion') is null
     or to_regclass('public.stock_operaciones') is null
     or to_regclass('public.movimientos_stock') is null
     or to_regclass('public.encargos_empresa') is null
     or to_regclass('public.clientes_empresa') is null
     or to_regclass('public.pagos_encargo') is null then
    raise exception 'PM27_RPC_RESTORE_PREFLIGHT_FALLO: faltan tablas requeridas';
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='stock_ubicacion' and column_name='unidad')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='stock_ubicacion' and column_name='precision_cantidad')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='stock_ubicacion' and column_name='local_operable')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='stock_operaciones' and column_name='payload')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='movimientos_stock' and column_name='datos') then
    raise exception 'PM27_RPC_RESTORE_PREFLIGHT_FALLO: columnas requeridas ausentes';
  end if;

  if not has_function_privilege('authenticated','public.registrar_venta_stock(text,text,text,text,numeric,jsonb)','EXECUTE')
     or not has_function_privilege('authenticated','public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb)','EXECUTE')
     or not has_function_privilege('authenticated','public.trasladar_stock_interno(text,text,text,text,text,text,numeric,jsonb)','EXECUTE')
     or not has_function_privilege('authenticated','public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb)','EXECUTE')
     or not has_function_privilege('authenticated','public.registrar_encargo(text,text,text,text,numeric,text,jsonb)','EXECUTE') then
    raise exception 'PM27_RPC_RESTORE_PREFLIGHT_FALLO: superficie authenticated inesperada';
  end if;

  if has_function_privilege('anon','public.registrar_venta_stock(text,text,text,text,numeric,jsonb)','EXECUTE')
     or has_function_privilege('anon','public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb)','EXECUTE')
     or has_function_privilege('anon','public.trasladar_stock_interno(text,text,text,text,text,text,numeric,jsonb)','EXECUTE')
     or has_function_privilege('anon','public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb)','EXECUTE')
     or has_function_privilege('anon','public.registrar_encargo(text,text,text,text,numeric,text,jsonb)','EXECUTE') then
    raise exception 'PM27_RPC_RESTORE_PREFLIGHT_FALLO: anon ejecuta RPC objetivo';
  end if;

  if not has_table_privilege('authenticated','public.encargos_empresa','SELECT')
     or has_table_privilege('authenticated','public.encargos_empresa','INSERT')
     or has_table_privilege('authenticated','public.encargos_empresa','UPDATE')
     or has_table_privilege('authenticated','public.encargos_empresa','DELETE') then
    raise exception 'PM27_RPC_RESTORE_PREFLIGHT_FALLO: ACL encargos_empresa inesperada';
  end if;

  raise notice 'PM27_RPC_RESTORE_PREFLIGHT=PASS';
end
$preflight$;

-- C18 final: venta unitaria con operation_id global.
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
as $function$
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
$function$;

-- C23 final: carrito con replay que incluye metadatos persistidos por linea.
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
as $function$
declare
  op public.stock_operaciones%rowtype;
  s public.stock_ubicacion%rowtype;
  rec record;
  cant numeric;
  tomar_piso numeric;
  tomar_almacen numeric;
  payload_norm jsonb;
  lineas_norm jsonb;
  lineas_datos_norm jsonb;
  movimientos_datos_norm jsonb;
  movimientos_json jsonb;
  saldos_json jsonb;
  v_operation_id text;
begin
  if auth.uid() is null or not private.pm07_puede_vender() then raise exception 'stock_no_autorizado'; end if;
  if not private.la_tiene_empresa(p_empresa_id) or not private.la_tiene_local(p_empresa_id,p_local_id) then raise exception 'contexto_no_autorizado'; end if;

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

  payload_norm:=jsonb_build_object(
    'modo','CARRITO','empresaId',p_empresa_id,'localId',p_local_id,
    'lineas',lineas_norm,'datos',coalesce(p_datos,'{}'::jsonb)
  );

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'productoId', x->>'productoId',
               'datos', coalesce((
                 select elem
                   from jsonb_array_elements(p_lineas) elem
                  where coalesce(elem->>'productoId',elem->>'producto_id')=x->>'productoId'
                  limit 1
               ), '{}'::jsonb)
             )
             order by x->>'productoId'
           ),
           '[]'::jsonb
         )
    into lineas_datos_norm
    from jsonb_array_elements(lineas_norm) x;

  select * into op from public.stock_operaciones where operation_id=v_operation_id;
  if found then
    select coalesce(
             jsonb_agg(
               jsonb_build_object('productoId',m.producto_id,'datos',m.datos)
               order by m.producto_id
             ),
             '[]'::jsonb
           )
      into movimientos_datos_norm
      from public.movimientos_stock m
     where m.operation_id=v_operation_id
       and m.tipo='VENTA';

    if op.tipo='VENTA'
       and op.payload=payload_norm
       and movimientos_datos_norm=lineas_datos_norm then
      select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb)
        into movimientos_json
        from public.movimientos_stock m
       where m.operation_id=v_operation_id;
      return jsonb_build_object('ok',true,'replayed',true,'movimientos',movimientos_json);
    end if;
    raise exception 'operation_id_conflict';
  end if;

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
    values(
      v_operation_id,'VENTA',p_empresa_id,p_local_id,rec.producto_id,
      -tomar_almacen,-tomar_piso,-cant,cant,
      coalesce((
        select elem
          from jsonb_array_elements(p_lineas) elem
         where coalesce(elem->>'productoId',elem->>'producto_id')=rec.producto_id
         limit 1
      ),'{}'::jsonb),
      auth.uid()
    );
  end loop;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb)
    into movimientos_json
    from public.movimientos_stock m
   where m.operation_id=v_operation_id;
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'productoId',s2.producto_id,'almacen',s2.almacen,'piso',s2.piso,
               'total',round(s2.almacen+s2.piso,6)
             ) order by s2.producto_id
           ),
           '[]'::jsonb
         )
    into saldos_json
    from public.stock_ubicacion s2
   where s2.empresa_id=p_empresa_id and s2.local_id=p_local_id
     and s2.producto_id in (
       select x->>'productoId' from jsonb_array_elements(lineas_norm) x
     );
  return jsonb_build_object(
    'ok',true,'replayed',false,'movimientos',movimientos_json,'saldos',saldos_json
  );
end;
$function$;

-- C19 final: traslado interno.
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
as $function$
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

  v_operation_id := private.pm09_bloquear_operation_id_stock(p_operation_id);

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
$function$;

-- C19 final: traslado entre locales.
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
as $function$
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
$function$;

-- C21 final: encargos con frontera autoritativa y maquina de estados cerrada.
create or replace function public.registrar_encargo(
  p_id text,
  p_empresa_id text,
  p_local_id text,
  p_cliente_id text,
  p_total numeric,
  p_estado text default 'Pendiente',
  p_datos jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'private', 'pg_temp'
as $function$
declare
  v_total numeric;
  v_total_anterior numeric;
  v_estado text;
  v_estado_anterior text;
  v_cliente_empresa text;
  v_pagado numeric := 0;
  v_datos jsonb;
  v_actual public.encargos_empresa%rowtype;
  v_nuevo public.encargos_empresa%rowtype;
begin
  if auth.uid() is null or not private.pm08_puede_operar_caja() then
    raise exception 'encargo_no_autorizado';
  end if;
  if p_id is null or btrim(p_id) = '' then
    raise exception 'encargo_id_requerido';
  end if;
  if p_cliente_id is null or btrim(p_cliente_id) = '' then
    raise exception 'cliente_id_requerido';
  end if;
  if not private.la_tiene_empresa(p_empresa_id)
     or not private.la_tiene_local(p_empresa_id, p_local_id) then
    raise exception 'contexto_no_autorizado';
  end if;
  if not private.pm08_local_operable(p_empresa_id, p_local_id) then
    raise exception 'local_inactivo';
  end if;

  select c.empresa_id
    into v_cliente_empresa
    from public.clientes_empresa c
   where c.id = p_cliente_id;
  if found and v_cliente_empresa is distinct from p_empresa_id then
    raise exception 'cliente_otro_contexto';
  end if;

  v_total := private.pm08_validar_dinero(p_total, true, false);
  v_estado := coalesce(nullif(btrim(p_estado), ''), 'Pendiente');
  if v_estado not in ('Pendiente', 'Entregado', 'Cancelado', 'Devuelto') then
    raise exception 'estado_encargo_invalido';
  end if;

  select *
    into v_actual
    from public.encargos_empresa
   where id = p_id
   for update;

  if found then
    if v_actual.empresa_id is distinct from p_empresa_id
       or v_actual.local_id is distinct from p_local_id then
      raise exception 'encargo_referencia_otro_contexto';
    end if;

    v_estado_anterior := coalesce(nullif(v_actual.datos->>'estado', ''), 'Pendiente');
    v_total_anterior := round(coalesce(nullif(v_actual.datos->>'total', '')::numeric, 0), 2);

    if v_estado_anterior not in ('Pendiente', 'Entregado', 'Cancelado', 'Devuelto') then
      raise exception 'estado_encargo_historico_invalido';
    end if;

    if (v_estado_anterior = 'Pendiente' and v_estado not in ('Pendiente', 'Entregado', 'Cancelado'))
       or (v_estado_anterior = 'Entregado' and v_estado not in ('Entregado', 'Devuelto'))
       or (v_estado_anterior = 'Cancelado' and v_estado <> 'Cancelado')
       or (v_estado_anterior = 'Devuelto' and v_estado <> 'Devuelto') then
      raise exception 'transicion_encargo_invalida';
    end if;

    select round(coalesce(sum(
      case
        when p.estado = 'CONFIRMADO' then p.importe
        when p.estado = 'REVERSO' then -p.importe
        else 0
      end
    ), 0), 2)
      into v_pagado
      from public.pagos_encargo p
     where p.encargo_id = p_id
       and p.empresa_id = p_empresa_id
       and p.local_id = p_local_id;

    v_pagado := greatest(coalesce(v_pagado, 0), 0);
    if v_total < v_pagado then
      raise exception 'total_inferior_a_pagado';
    end if;

    if v_pagado > 0 and v_actual.cliente_id is distinct from p_cliente_id then
      raise exception 'encargo_con_cobros_cliente_inmutable';
    end if;

    if v_estado is distinct from v_estado_anterior
       and (v_total is distinct from v_total_anterior
            or v_actual.cliente_id is distinct from p_cliente_id) then
      raise exception 'cierre_encargo_identidad_conflict';
    end if;

    if v_estado_anterior in ('Entregado', 'Cancelado', 'Devuelto')
       and v_estado = v_estado_anterior then
      if v_total is distinct from v_total_anterior
         or v_actual.cliente_id is distinct from p_cliente_id then
        raise exception 'encargo_terminal_inmutable';
      end if;
      return jsonb_build_object('ok', true, 'replayed', true, 'encargo', to_jsonb(v_actual));
    end if;

    v_datos := coalesce(v_actual.datos, '{}'::jsonb)
      || coalesce(p_datos, '{}'::jsonb)
      || jsonb_build_object(
        'total', v_total,
        'estado', v_estado,
        'clienteId', p_cliente_id,
        'empresaId', p_empresa_id,
        'localId', p_local_id
      );

    update public.encargos_empresa
       set cliente_id = p_cliente_id,
           datos = v_datos,
           updated_at = now()
     where id = p_id
     returning * into v_nuevo;
  else
    v_datos := coalesce(p_datos, '{}'::jsonb)
      || jsonb_build_object(
        'total', v_total,
        'estado', v_estado,
        'clienteId', p_cliente_id,
        'empresaId', p_empresa_id,
        'localId', p_local_id
      );

    insert into public.encargos_empresa(
      id, empresa_id, local_id, cliente_id, datos, updated_at
    ) values (
      p_id, p_empresa_id, p_local_id, p_cliente_id, v_datos, now()
    )
    returning * into v_nuevo;
  end if;

  return jsonb_build_object('ok', true, 'replayed', false, 'encargo', to_jsonb(v_nuevo));
end;
$function$;

-- Minimo privilegio: solo authenticated invoca los cinco RPC; anon/PUBLIC no.
revoke all on function public.registrar_venta_stock(text,text,text,text,numeric,jsonb) from public, anon, authenticated;
revoke all on function public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.trasladar_stock_interno(text,text,text,text,text,text,numeric,jsonb) from public, anon, authenticated;
revoke all on function public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb) from public, anon, authenticated;
revoke all on function public.registrar_encargo(text,text,text,text,numeric,text,jsonb) from public, anon, authenticated;

grant execute on function public.registrar_venta_stock(text,text,text,text,numeric,jsonb) to authenticated;
grant execute on function public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb) to authenticated;
grant execute on function public.trasladar_stock_interno(text,text,text,text,text,text,numeric,jsonb) to authenticated;
grant execute on function public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb) to authenticated;
grant execute on function public.registrar_encargo(text,text,text,text,numeric,text,jsonb) to authenticated;

do $postflight$
declare
  r regprocedure;
begin
  foreach r in array array[
    'public.registrar_venta_stock(text,text,text,text,numeric,jsonb)'::regprocedure,
    'public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb)'::regprocedure,
    'public.trasladar_stock_interno(text,text,text,text,text,text,numeric,jsonb)'::regprocedure,
    'public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb)'::regprocedure,
    'public.registrar_encargo(text,text,text,text,numeric,text,jsonb)'::regprocedure
  ] loop
    if strpos(pg_get_functiondef(r), 'pm27_reconciliacion_pendiente_c24') > 0 then
      raise exception 'PM27_RPC_RESTORE_POSTFLIGHT_FALLO: stub persistente %', r;
    end if;
    if not exists (
      select 1 from pg_proc p
       where p.oid=r
         and p.prosecdef
         and coalesce(p.proconfig,'{}'::text[]) @> array['search_path=public, auth, private, pg_temp']::text[]
    ) then
      raise exception 'PM27_RPC_RESTORE_POSTFLIGHT_FALLO: contrato SECURITY DEFINER/search_path %', r;
    end if;
    if not has_function_privilege('authenticated',r,'EXECUTE')
       or has_function_privilege('anon',r,'EXECUTE') then
      raise exception 'PM27_RPC_RESTORE_POSTFLIGHT_FALLO: ACL %', r;
    end if;
  end loop;

  if strpos(pg_get_functiondef('public.registrar_venta_stock(text,text,text,text,numeric,jsonb)'::regprocedure), 'pm09_bloquear_operation_id_stock') = 0 then
    raise exception 'PM27_RPC_RESTORE_POSTFLIGHT_FALLO: venta sin ledger global';
  end if;
  if strpos(pg_get_functiondef('public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb)'::regprocedure), 'movimientos_datos_norm=lineas_datos_norm') = 0 then
    raise exception 'PM27_RPC_RESTORE_POSTFLIGHT_FALLO: carrito sin guard C23';
  end if;
  if strpos(pg_get_functiondef('public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb)'::regprocedure), 'unidad_incompatible') = 0 then
    raise exception 'PM27_RPC_RESTORE_POSTFLIGHT_FALLO: traslado interlocal incompleto';
  end if;
  if strpos(pg_get_functiondef('public.registrar_encargo(text,text,text,text,numeric,text,jsonb)'::regprocedure), 'cliente_otro_contexto') = 0
     or strpos(pg_get_functiondef('public.registrar_encargo(text,text,text,text,numeric,text,jsonb)'::regprocedure), 'transicion_encargo_invalida') = 0 then
    raise exception 'PM27_RPC_RESTORE_POSTFLIGHT_FALLO: guardas encargo incompletas';
  end if;

  if not has_table_privilege('authenticated','public.encargos_empresa','SELECT')
     or has_table_privilege('authenticated','public.encargos_empresa','INSERT')
     or has_table_privilege('authenticated','public.encargos_empresa','UPDATE')
     or has_table_privilege('authenticated','public.encargos_empresa','DELETE') then
    raise exception 'PM27_RPC_RESTORE_POSTFLIGHT_FALLO: ACL encargos_empresa alterada';
  end if;

  raise notice 'PM27_RPC_RESTORE_POSTFLIGHT=PASS';
end
$postflight$;

commit;
