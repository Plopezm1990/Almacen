-- PM10: una recepción confirmada debe crear producto (si procede) y stock
-- autoritativo en almacén. Esta migración se aplica primero en QA; producción
-- no se modifica hasta que el flujo se valide allí.

alter table public.stock_operaciones
  drop constraint if exists stock_operaciones_tipo_check;
alter table public.stock_operaciones
  add constraint stock_operaciones_tipo_check check (
    tipo = any (array[
      'VENTA','RECEPCION','REVERSO','TRASLADO_INTERNO',
      'TRASLADO_ENTRE_LOCALES','DEVOLUCION_CLIENTE',
      'DEVOLUCION_PROVEEDOR','INVENTARIO_PM12','MERMA_COMANDA'
    ]::text[])
  );

alter table public.movimientos_stock
  drop constraint if exists movimientos_stock_tipo_check;
alter table public.movimientos_stock
  add constraint movimientos_stock_tipo_check check (
    tipo = any (array[
      'VENTA','RECEPCION','REVERSO','TRASLADO_INTERNO',
      'TRASLADO_ENTRE_LOCALES','DEVOLUCION_CLIENTE',
      'DEVOLUCION_PROVEEDOR','INVENTARIO_PM12','MERMA_COMANDA'
    ]::text[])
  );

create or replace function public.registrar_entrada_stock(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_lineas jsonb,
  p_datos jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, private, pg_temp
as $function$
declare
  op public.stock_operaciones%rowtype;
  s public.stock_ubicacion%rowtype;
  rec record;
  elem jsonb;
  lineas_norm jsonb;
  payload_norm jsonb;
  movimientos_json jsonb;
  saldos_json jsonb;
  cant numeric;
  minimo numeric;
  fraccionable boolean;
  precision_cantidad smallint;
  unidad text;
begin
  if auth.uid() is null or not private.pm07_puede_gestionar_stock() then
    raise exception 'recepcion_no_autorizada';
  end if;
  if not private.la_tiene_empresa(p_empresa_id)
     or not private.la_tiene_local(p_empresa_id, p_local_id) then
    raise exception 'contexto_no_autorizado';
  end if;
  if p_operation_id is null or btrim(p_operation_id) = '' then
    raise exception 'operation_id_requerido';
  end if;
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array'
     or jsonb_array_length(p_lineas) = 0 then
    raise exception 'recepcion_vacia';
  end if;

  select jsonb_agg(
           jsonb_build_object(
             'productoId', producto_id,
             'cantidad', cantidad,
             'minimo', minimo,
             'fraccionable', fraccionable,
             'precisionCantidad', precision_cantidad,
             'unidad', unidad
           ) order by producto_id
         )
    into lineas_norm
    from (
      select
        btrim(coalesce(elem->>'productoId', elem->>'producto_id')) as producto_id,
        sum(coalesce((elem->>'cantidad')::numeric, 0))::numeric as cantidad,
        greatest(0, max(coalesce((elem->>'minimo')::numeric, 0)))::numeric as minimo,
        bool_or(lower(coalesce(elem->>'fraccionable','false')) in ('true','t','1')) as fraccionable,
        least(6, greatest(0, max(coalesce((elem->>'precisionCantidad')::int, 0))))::smallint as precision_cantidad,
        coalesce(max(nullif(btrim(elem->>'unidad'), '')), 'ud') as unidad
      from jsonb_array_elements(p_lineas) elem
      where jsonb_typeof(elem) = 'object'
        and btrim(coalesce(elem->>'productoId', elem->>'producto_id', '')) <> ''
        and coalesce((elem->>'cantidad')::numeric, 0) > 0
      group by btrim(coalesce(elem->>'productoId', elem->>'producto_id'))
    ) normalizadas;

  if lineas_norm is null or jsonb_array_length(lineas_norm) = 0 then
    raise exception 'recepcion_vacia';
  end if;

  payload_norm := jsonb_build_object(
    'modo', 'RECEPCION',
    'empresaId', p_empresa_id,
    'localId', p_local_id,
    'lineas', lineas_norm,
    'datos', coalesce(p_datos, '{}'::jsonb)
  );

  select * into op from public.stock_operaciones where operation_id = p_operation_id;
  if found then
    if op.tipo = 'RECEPCION' and op.payload = payload_norm then
      select coalesce(jsonb_agg(to_jsonb(m) order by m.id), '[]'::jsonb)
        into movimientos_json
        from public.movimientos_stock m where m.operation_id = p_operation_id;
      return jsonb_build_object('ok', true, 'replayed', true, 'movimientos', movimientos_json);
    end if;
    raise exception 'operation_id_conflict';
  end if;

  for rec in
    select x->>'productoId' as producto_id,
           (x->>'cantidad')::numeric as cantidad,
           coalesce((x->>'minimo')::numeric,0) as minimo,
           coalesce((x->>'fraccionable')::boolean,false) as fraccionable,
           coalesce((x->>'precisionCantidad')::int,0)::smallint as precision_cantidad,
           coalesce(nullif(btrim(x->>'unidad'),''),'ud') as unidad
    from jsonb_array_elements(lineas_norm) x
    order by x->>'productoId'
  loop
    -- La recepción solo acepta productos que ya han sido confirmados en el
    -- catálogo segregado de la empresa/local por la RPC de productos.
    if not exists (
      select 1
      from public.almacen_kv k
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(k.value)='array' then k.value else '[]'::jsonb end
      ) p
      where k.key='productos'
        and k.empresa_id=p_empresa_id
        and p->>'id'=rec.producto_id
        and coalesce(nullif(btrim(p->>'empresaId'),''),p_empresa_id)=p_empresa_id
        and coalesce(nullif(btrim(p->>'localId'),''),p_local_id)=p_local_id
    ) then
      raise exception 'producto_no_confirmado:%', rec.producto_id;
    end if;

    cant := private.pm07_validar_cantidad(rec.cantidad, rec.fraccionable, rec.precision_cantidad);
    select * into s from public.stock_ubicacion
      where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=rec.producto_id
      for update;
    if not found then
      insert into public.stock_ubicacion(
        empresa_id,local_id,producto_id,almacen,piso,minimo,
        fraccionable,precision_cantidad,local_operable,unidad
      ) values (
        p_empresa_id,p_local_id,rec.producto_id,0,0,rec.minimo,
        rec.fraccionable,rec.precision_cantidad,true,rec.unidad
      );
    elsif not s.local_operable then
      raise exception 'local_inactivo';
    end if;
  end loop;

  insert into public.stock_operaciones(
    operation_id,tipo,empresa_id,local_id,producto_id,payload,actor_user_id
  ) values (
    p_operation_id,'RECEPCION',p_empresa_id,p_local_id,'__RECEPCION__',payload_norm,auth.uid()
  );

  for rec in
    select x->>'productoId' as producto_id,
           (x->>'cantidad')::numeric as cantidad
    from jsonb_array_elements(lineas_norm) x
    order by x->>'productoId'
  loop
    select * into s from public.stock_ubicacion
      where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=rec.producto_id
      for update;
    cant := private.pm07_validar_cantidad(rec.cantidad, s.fraccionable, s.precision_cantidad);
    update public.stock_ubicacion
       set almacen=almacen+cant, updated_at=now()
     where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=rec.producto_id;
    insert into public.movimientos_stock(
      operation_id,tipo,empresa_id,local_id,producto_id,
      delta_almacen,delta_piso,delta_total,cantidad,datos,actor_user_id
    ) values (
      p_operation_id,'RECEPCION',p_empresa_id,p_local_id,rec.producto_id,
      cant,0,cant,cant,coalesce(p_datos,'{}'::jsonb),auth.uid()
    );
  end loop;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.id), '[]'::jsonb)
    into movimientos_json
    from public.movimientos_stock m where m.operation_id=p_operation_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'productoId',s2.producto_id,'almacen',s2.almacen,'piso',s2.piso,
    'total',round(s2.almacen+s2.piso,6)
  ) order by s2.producto_id), '[]'::jsonb)
    into saldos_json
    from public.stock_ubicacion s2
   where s2.empresa_id=p_empresa_id and s2.local_id=p_local_id
     and s2.producto_id in (select x->>'productoId' from jsonb_array_elements(lineas_norm) x);

  return jsonb_build_object(
    'ok',true,'replayed',false,'movimientos',movimientos_json,'saldos',saldos_json
  );
end;
$function$;

grant execute on function public.registrar_entrada_stock(text,text,text,jsonb,jsonb) to authenticated;
