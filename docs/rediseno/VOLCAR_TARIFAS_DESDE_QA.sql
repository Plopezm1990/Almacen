-- Volcado de las cuatro piezas de tarifas de org-33 que existen en QA y no en
-- este repositorio. Pégalo entero en el editor SQL de Supabase, en el proyecto
-- de QA, y copia el resultado.
--
-- Solo lee catálogos del sistema: no toca datos, no crea nada, no borra nada,
-- y no devuelve ni una fila de tarifas. Solo la forma.
--
-- Nota: aquí no se usa `::regclass` a propósito. Esa forma revienta si el
-- nombre no existe, y el autocompletado del editor en el móvil llegó a cambiar
-- un nombre de tabla por otro al pegar. Todo va por nombre de texto: si algo no
-- está, simplemente no sale en el resultado, y eso ya es una respuesta.

with t(nombre) as (
  values ('catalogo_tpv_tarifas_horario'), ('catalogo_tpv_tarifa_precios')
), f(nombre) as (
  values ('abc_guardar_tarifa_horario'), ('abc_guardar_tarifa_precio')
)
select '1 COLUMNAS · ' || c.table_name as seccion,
       c.column_name || ' · ' || c.data_type
         || coalesce('(' || c.character_maximum_length || ')', '')
         || case when c.is_nullable = 'NO' then ' · not null' else '' end
         || coalesce(' · default ' || c.column_default, '') as linea
from information_schema.columns c
where c.table_schema = 'public' and c.table_name in (select nombre from t)

union all
select '2 RESTRICCIONES · ' || cl.relname,
       con.conname || ' · ' || pg_get_constraintdef(con.oid)
from pg_constraint con
join pg_class cl on cl.oid = con.conrelid
join pg_namespace ns on ns.oid = cl.relnamespace
where ns.nspname = 'public' and cl.relname in (select nombre from t)

union all
select '3 INDICES · ' || i.tablename, i.indexdef
from pg_indexes i
where i.schemaname = 'public' and i.tablename in (select nombre from t)

union all
select '4 RLS · ' || cl.relname,
       'activada: ' || cl.relrowsecurity || ' · forzada: ' || cl.relforcerowsecurity
from pg_class cl
join pg_namespace ns on ns.oid = cl.relnamespace
where ns.nspname = 'public' and cl.relname in (select nombre from t)

union all
select '5 POLITICAS · ' || p.tablename,
       p.policyname || ' · ' || p.cmd || ' · para ' || array_to_string(p.roles, ',')
         || coalesce(' · using ' || p.qual, '')
         || coalesce(' · with check ' || p.with_check, '')
from pg_policies p
where p.schemaname = 'public' and p.tablename in (select nombre from t)

union all
select '6 PERMISOS DE TABLA · ' || g.table_name,
       g.grantee || ' · ' || g.privilege_type
from information_schema.role_table_grants g
where g.table_schema = 'public' and g.table_name in (select nombre from t)

union all
select '7 FUNCION · ' || pr.proname, pg_get_functiondef(pr.oid)
from pg_proc pr
join pg_namespace ns on ns.oid = pr.pronamespace
where ns.nspname in ('public', 'private') and pr.proname in (select nombre from f)

union all
select '8 PERMISOS DE FUNCION · ' || pr.proname,
       coalesce(pr.proacl::text, 'por defecto')
from pg_proc pr
join pg_namespace ns on ns.oid = pr.pronamespace
where ns.nspname in ('public', 'private') and pr.proname in (select nombre from f)

order by 1, 2;
