-- F7 P3c · humo productivo preparado, NO AUTORIZADO.
-- Ejecutar solo tras P3, P3b, P3c y normalización de titularidad, en ventana
-- aprobada. La edición de 0,01 € vive únicamente dentro de BEGIN/ROLLBACK.
-- No devuelve identificadores ni contenido de productos/personas.

begin;

do $humo$
declare
  v_base jsonb;
  v_nuevo jsonb;
  v_item jsonb;
  v_empresa text;
  v_local text;
  v_id text;
  v_actor uuid;
  v_precio numeric;
  v_res jsonb;
begin
  select k.value into v_base
    from public.almacen_kv k
   where k.key='productos' and k.empresa_id is not null
   for update;
  if not found or jsonb_typeof(v_base)<>'array' then
    raise exception 'P3C_HUMO: falta lista normalizada';
  end if;

  select c.empresa_id,c.local_id,c.producto_id,e.item
    into v_empresa,v_local,v_id,v_item
    from public.catalogo_tpv_productos c
    cross join lateral jsonb_array_elements(v_base) e(item)
   where c.activo=true and e.item->>'id'=c.producto_id
     and coalesce(e.item->>'empresaId',
       (select empresa_id from public.almacen_kv where key='productos'))=c.empresa_id
     and e.item->>'localId'=c.local_id
     and jsonb_typeof(e.item->'precioVenta')='number'
   order by c.empresa_id,c.local_id,c.producto_id
   limit 1;
  if v_item is null then
    raise exception 'P3C_HUMO: no hay artículo vendible con precio numérico';
  end if;

  select p.user_id into v_actor
    from public.membresias_usuario m
    join public.perfiles p on p.user_id=m.user_id
   where m.empresa_id=v_empresa and (m.local_id is null or m.local_id=v_local)
     and m.activo=true and m.rol='Propietario'
     and p.activo=true and p.rol='Propietario'
   order by p.user_id limit 1;
  if v_actor is null then
    raise exception 'P3C_HUMO: no hay Propietario activo para el local';
  end if;

  v_precio:=(v_item->>'precioVenta')::numeric+0.01;
  select jsonb_agg(
    case when e->>'id'=v_id then e||jsonb_build_object('precioVenta',v_precio)
         else e end order by ord)
    into v_nuevo
    from jsonb_array_elements(v_base) with ordinality t(e,ord);

  perform set_config('request.jwt.claims',
    json_build_object('sub',v_actor,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  execute 'set local role authenticated';
  select public.abc_productos_guardar_lista(
    'p3c.prod.humo.rollback.20261005',v_base,v_nuevo,
    jsonb_build_array(v_item||jsonb_build_object('precioVenta',v_precio)))
    into v_res;
  execute 'reset role';

  if v_res->>'ok'<>'true'
     or coalesce((v_res->>'venta_cambiada')::integer,0)<>1
     or (select (e->>'precioVenta')::numeric
           from public.almacen_kv k,jsonb_array_elements(k.value) e
          where k.key='productos' and e->>'id'=v_id)<>v_precio
     or (select c.precio_con_impuesto
           from public.catalogo_tpv_productos c
          where c.empresa_id=v_empresa and c.local_id=v_local
            and c.producto_id=v_id)<>v_precio then
    raise exception 'P3C_HUMO: lista y catálogo no coinciden';
  end if;
  raise notice 'P3C_HUMO_TRANSACCIONAL_OK';
end
$humo$;

rollback;

-- Comparar estas huellas y recuentos con la foto tomada antes del humo.
select (select md5(value::text) from public.almacen_kv
         where key='productos') as lista_md5,
       (select count(*) from public.stock_ubicacion) as stock_filas,
       (select md5(coalesce(string_agg(to_jsonb(s)::text,'|'
         order by s.empresa_id,s.local_id,s.producto_id),''))
          from public.stock_ubicacion s) as stock_md5,
       (select count(*) from public.catalogo_tpv_productos) as catalogo_filas,
       (select md5(coalesce(string_agg(to_jsonb(c)::text,'|'
         order by c.empresa_id,c.local_id,c.producto_id),''))
          from public.catalogo_tpv_productos c) as catalogo_md5,
       (select count(*) from public.abc_operaciones) as operaciones_filas,
       (select md5(coalesce(string_agg(to_jsonb(o)::text,'|'
         order by o.operation_id,to_jsonb(o)::text),''))
          from public.abc_operaciones o) as operaciones_md5;
