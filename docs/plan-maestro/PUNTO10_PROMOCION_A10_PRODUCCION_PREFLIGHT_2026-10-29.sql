-- Punto 10 A10: preflight de producción.
-- SOLO LECTURA. No aplicar migraciones, no ejecutar DDL/DML.

-- 1. Línea de migraciones reciente.
select version, name
from supabase_migrations.schema_migrations
order by version desc
limit 15;

-- 2. Esquema del catálogo y estado de la columna nueva.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public'
  and table_name='catalogo_tpv_productos'
  and column_name in ('empresa_id','local_id','producto_id','requiere_preparacion','activo','version')
order by ordinal_position;

-- 3. Producto y comanda histórica identificados en el incidente.
select empresa_id, local_id, producto_id, nombre, activo, version,
       to_jsonb(catalogo_tpv_productos) as fila
from public.catalogo_tpv_productos
where empresa_id='empresa-034b3c08b4f4ae9b'
  and local_id='local-6d0e54564e774506'
  and producto_id='pm10-recepcion-albaran:factura-albaran:mv5tixkxej43iu:0:8550916306:producto-auto:0';

select c.id, c.empresa_id, c.local_id, c.pedido_id, c.operation_id,
       c.tipo, c.route_key, c.estado, c.created_at,
       cl.linea_id, cl.producto_id, cl.cantidad, cl.estado_objetivo
from public.comandas_preparacion c
left join public.comanda_lineas cl on cl.comanda_id=c.id
where c.id='20d1f90f-d461-4b99-b88d-d18d884bf38f';

-- 4. Dependencias A10.
select n.nspname as schema_name, p.proname,
       pg_get_function_identity_arguments(p.oid) as argumentos,
       p.prosecdef,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='private'
  and p.proname in ('abc_a10_requiere_preparacion','abc_a10_procesar_transiciones_linea')
order by p.proname, argumentos;

select n.nspname as schema_name, c.relname as table_name,
       t.tgname as trigger_name,
       pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal
  and c.relname='pedido_linea_transiciones'
  and t.tgname='a10_pedido_linea_transiciones_comandas';

-- 5. Conteos de control; no modifica nada.
select json_build_object(
  'bloqueadas_sin_ruta',(
    select count(*) from public.comandas_preparacion
    where estado='BLOQUEADA' and route_key='SIN_RUTA'
  ),
  'efectos_error',(
    select count(*) from public.efectos_pendientes where estado='ERROR'
  ),
  'productos_catalogo',(
    select count(*) from public.catalogo_tpv_productos
  )
) as preflight_counts;
