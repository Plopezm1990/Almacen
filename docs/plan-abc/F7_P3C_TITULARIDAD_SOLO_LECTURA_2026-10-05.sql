-- F7 P3c · lectura de la titularidad de almacen_kv.productos.
-- Solo SELECT: no devuelve identificadores, nombres ni contenido de artículos.
-- Repetir inmediatamente antes de la ventana de producción; parar si cambia
-- cualquier condición documentada en la hoja de autorización.

with fila as (
  select empresa_id, local_id, value
    from public.almacen_kv where key='productos'
), items as (
  select f.empresa_id as fila_empresa, f.local_id as fila_local, e.item,
         nullif(btrim(e.item->>'empresaId'),'') as item_empresa,
         nullif(btrim(e.item->>'localId'),'') as item_local
    from fila f
   cross join lateral jsonb_array_elements(
     case when jsonb_typeof(f.value)='array' then f.value else '[]'::jsonb end
   ) e(item)
), contextos as (
  select i.*, coalesce(i.item_empresa,i.fila_empresa) as empresa_efectiva,
         l.id is not null as local_existe, l.activo is true as local_activo
    from items i
    left join public.locales l
      on l.empresa_id=coalesce(i.item_empresa,i.fila_empresa)
     and l.id=i.item_local
)
select (select count(*) from fila) as filas,
       (select count(*) from fila
         where empresa_id is null or btrim(empresa_id)='') as filas_sin_empresa,
       (select count(*) from fila
         where jsonb_typeof(value)<>'array') as filas_no_array,
       (select count(*) from fila where local_id is not null) as filas_con_local_id,
       count(*) as productos,
       count(*) filter (where jsonb_typeof(item)<>'object'
                           or nullif(btrim(item->>'id'),'') is null) as productos_sin_id,
       count(*) filter (where item_empresa is null) as productos_sin_empresa_interna,
       count(*) filter (where item_empresa is not null
                           and fila_empresa is not null
                           and item_empresa is distinct from fila_empresa)
         as empresa_distinta_fila,
       count(*) filter (where item_local is null) as productos_sin_local,
       count(*) filter (where not local_existe) as local_inexistente,
       count(*) filter (where not local_activo) as local_inactivo,
       count(distinct empresa_efectiva) as empresas_efectivas,
       count(distinct item_local) as locales_distintos,
       count(distinct item->>'id') as ids_distintos
  from contextos;

-- El artículo TPV productivo debe corresponder a uno de la lista.
with items as (
  select coalesce(nullif(e->>'empresaId',''),k.empresa_id) as empresa_id,
         e->>'localId' as local_id, e->>'id' as producto_id
    from public.almacen_kv k
   cross join lateral jsonb_array_elements(k.value) e
   where k.key='productos'
)
select (select count(*) from public.catalogo_tpv_productos) as tpv_total,
       (select count(*) from public.catalogo_tpv_productos c
         where exists (select 1 from items i
           where i.empresa_id=c.empresa_id and i.local_id=c.local_id
             and i.producto_id=c.producto_id)) as tpv_en_lista,
       (select count(*) from items i
         where exists (select 1 from public.catalogo_tpv_productos c
           where c.empresa_id=i.empresa_id and c.local_id=i.local_id
             and c.producto_id=i.producto_id)) as lista_en_tpv;

-- Huellas sin contenido para comparar antes/después de la normalización.
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
