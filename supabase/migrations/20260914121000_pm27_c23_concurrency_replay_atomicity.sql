-- PM27 / C23 — concurrencia, replay y atomicidad transversal.
--
-- Defecto reproducido C23-D1:
-- registrar_venta_stock_carrito (C18) construia la identidad de replay solo con
-- productoId/cantidad + p_datos. Sin embargo cada movimientos_stock.datos conserva
-- el elemento original de p_lineas. Un reintento con el mismo operation_id y la
-- misma cantidad, pero metadatos de linea distintos, era aceptado como replay y el
-- payload divergente se descartaba silenciosamente.
--
-- Remediacion minima:
-- mantener el mismo motor global operation_id, mismos locks y misma semantica de
-- stock. En un replay de carrito se contrasta tambien el efecto ya persistido en
-- movimientos_stock.datos contra los datos de linea que la peticion volveria a
-- persistir. No se crea tabla, ledger ni mecanismo de idempotencia paralelo.
--
-- Candidato aislado: NO aplicar a QA/produccion sin autorizacion especifica.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if to_regprocedure('public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb)') is null then
    raise exception 'pm27_c23_preflight_fallo: falta registrar_venta_stock_carrito';
  end if;
  if to_regprocedure('private.pm09_bloquear_operation_id_stock(text)') is null then
    raise exception 'pm27_c23_preflight_fallo: falta pm09_bloquear_operation_id_stock';
  end if;
  if to_regclass('public.stock_operaciones') is null
     or to_regclass('public.movimientos_stock') is null
     or to_regclass('public.stock_ubicacion') is null then
    raise exception 'pm27_c23_preflight_fallo: faltan tablas de stock';
  end if;
end
$preflight$;

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
  lineas_datos_norm jsonb;
  movimientos_datos_norm jsonb;
  movimientos_json jsonb;
  saldos_json jsonb;
  v_operation_id text;
begin
  if auth.uid() is null or not private.pm07_puede_vender() then raise exception 'stock_no_autorizado'; end if;
  if not private.la_tiene_empresa(p_empresa_id) or not private.la_tiene_local(p_empresa_id,p_local_id) then raise exception 'contexto_no_autorizado'; end if;

  -- Reutiliza exactamente el namespace/lock global existente.
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

  -- Canoniza exactamente la parte de p_lineas que el motor persiste en
  -- movimientos_stock.datos: un registro por producto agregado, usando el primer
  -- elemento de entrada para ese producto, igual que el INSERT historico C18.
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
    -- C23-D1: el mismo operation_id solo es replay si coincide tanto el payload
    -- agregado como los metadatos de linea que ya quedaron comprometidos.
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

  -- Preflight completo y locks deterministas antes de cualquier escritura.
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
$$;

-- Mantener la superficie publica existente; no abrir anon/public.
revoke all on function public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb)
  from public, anon;
grant execute on function public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb)
  to authenticated;

commit;
