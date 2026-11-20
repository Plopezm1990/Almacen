-- Volcado de las cuatro piezas de tarifas de org-33 que existen en QA y no en
-- este repositorio. Pégalo entero en el editor SQL de Supabase, en el proyecto
-- de QA (qjqorixtkilwsndqayyx), y copia el resultado.
--
-- Solo lee catálogos del sistema. No toca datos, no crea nada y no borra nada.
--
-- Devuelve una sola columna de texto, en orden, lista para copiar de una vez.

with piezas as (
  select 'public.catalogo_tpv_tarifas_horario'::regclass as tabla
  union all
  select 'public.catalogo_tpv_tarifa_precios'::regclass
),
columnas as (
  select
    1 as bloque,
    format('%s.%s', c.table_schema, c.table_name) as agrupa,
    c.ordinal_position as orden,
    format(
      '  %s %s%s%s',
      quote_ident(c.column_name),
      case
        when c.data_type = 'character varying' and c.character_maximum_length is not null
          then format('varchar(%s)', c.character_maximum_length)
        when c.data_type = 'numeric' and c.numeric_precision is not null
          then format('numeric(%s,%s)', c.numeric_precision, coalesce(c.numeric_scale, 0))
        when c.data_type = 'ARRAY' then
          (select format('%s[]', substring(a.udt_name from 2))
           from information_schema.columns a
           where a.table_schema = c.table_schema and a.table_name = c.table_name
             and a.column_name = c.column_name)
        else c.data_type
      end,
      case when c.is_nullable = 'NO' then ' not null' else '' end,
      case when c.column_default is not null then ' default ' || c.column_default else '' end
    ) as linea
  from information_schema.columns c
  join piezas p on p.tabla = format('%s.%s', c.table_schema, c.table_name)::regclass
),
restricciones as (
  select 2 as bloque, con.conrelid::regclass::text as agrupa, con.oid::bigint as orden,
         format('  constraint %s %s', quote_ident(con.conname), pg_get_constraintdef(con.oid)) as linea
  from pg_constraint con
  join piezas p on p.tabla = con.conrelid
),
indices as (
  select 3 as bloque, i.tablename as agrupa, row_number() over (order by i.indexname) as orden,
         '  ' || i.indexdef || ';' as linea
  from pg_indexes i
  join piezas p on p.tabla = format('public.%s', i.tablename)::regclass
  where i.schemaname = 'public'
),
seguridad as (
  select 4 as bloque, c.relname as agrupa, 0::bigint as orden,
         format('  RLS activada: %s · forzada: %s', c.relrowsecurity, c.relforcerowsecurity) as linea
  from pg_class c
  join piezas p on p.tabla = c.oid
),
politicas as (
  select 5 as bloque, pol.tablename as agrupa, row_number() over (order by pol.policyname) as orden,
         format(
           '  create policy %s on public.%s as %s for %s to %s%s%s;',
           quote_ident(pol.policyname), quote_ident(pol.tablename), pol.permissive, pol.cmd,
           array_to_string(pol.roles, ', '),
           coalesce(' using (' || pol.qual || ')', ''),
           coalesce(' with check (' || pol.with_check || ')', '')
         ) as linea
  from pg_policies pol
  join piezas p on p.tabla = format('public.%s', pol.tablename)::regclass
  where pol.schemaname = 'public'
),
permisos as (
  select 6 as bloque, g.table_name as agrupa, row_number() over (order by g.grantee, g.privilege_type) as orden,
         format('  grant %s on public.%s to %s;', lower(g.privilege_type), quote_ident(g.table_name), quote_ident(g.grantee)) as linea
  from information_schema.role_table_grants g
  join piezas p on p.tabla = format('%s.%s', g.table_schema, g.table_name)::regclass
  where g.table_schema = 'public'
),
funciones as (
  select 7 as bloque, pr.proname as agrupa, row_number() over (order by pr.oid) as orden,
         pg_get_functiondef(pr.oid) || ';' as linea
  from pg_proc pr
  join pg_namespace n on n.oid = pr.pronamespace
  where n.nspname in ('public', 'private')
    and pr.proname in ('abc_guardar_tarifa_horario', 'abc_guardar_tarifa_precio')
),
permisos_funcion as (
  select 8 as bloque, pr.proname as agrupa, 0::bigint as orden,
         format('  permisos de %s: %s', pr.proname, coalesce(pr.proacl::text, 'por defecto')) as linea
  from pg_proc pr
  join pg_namespace n on n.oid = pr.pronamespace
  where n.nspname in ('public', 'private')
    and pr.proname in ('abc_guardar_tarifa_horario', 'abc_guardar_tarifa_precio')
),
todo as (
  select * from columnas
  union all select * from restricciones
  union all select * from indices
  union all select * from seguridad
  union all select * from politicas
  union all select * from permisos
  union all select * from funciones
  union all select * from permisos_funcion
)
select
  case
    when bloque = 1 then '-- COLUMNAS · ' || agrupa
    when bloque = 2 then '-- RESTRICCIONES · ' || agrupa
    when bloque = 3 then '-- INDICES · ' || agrupa
    when bloque = 4 then '-- SEGURIDAD A NIVEL DE FILA · ' || agrupa
    when bloque = 5 then '-- POLITICAS · ' || agrupa
    when bloque = 6 then '-- PERMISOS DE TABLA · ' || agrupa
    when bloque = 7 then '-- FUNCION · ' || agrupa
    else '-- PERMISOS DE FUNCION · ' || agrupa
  end as seccion,
  linea
from todo
order by bloque, agrupa, orden;
