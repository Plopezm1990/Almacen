-- ============================================================================
-- Verificacion posterior de la delegacion de apariencia (solo lectura).
-- Se ejecuta en el Editor SQL del proyecto QA qjqorixtkilwsndqayyx despues de
-- aplicar 20261113140000_rediseno_apariencia_delegaciones.sql.
--
-- Las nueve filas deben traer `valor` igual a `esperado`. La unica que sigue
-- en 0 justo despues del Editor SQL es "versiones en el historial": el
-- bookkeeping lo registra `supabase migration repair --status applied`, y
-- cuenta las dos migraciones de apariencia, la 090000 y la 140000.
--
-- No escribe nada. Antes de aplicar la migracion devuelve ceros y '-'.
-- ============================================================================
with t as (
  select c.relname, c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'apariencia_delegacion_eventos'
), f as (
  select p.proname, p.prosecdef, p.proconfig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('abc_apariencia_listar_delegaciones','abc_apariencia_delegar','abc_apariencia_retirar_delegacion')
), h as (
  select p.oid, p.proname, pg_catalog.oidvectortypes(p.proargtypes) as tipos
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('abc_apariencia_listar_delegaciones','abc_apariencia_delegar','abc_apariencia_retirar_delegacion')
)
select 'tabla de eventos creada' as comprobacion, (select count(*) from t)::text as valor, '1' as esperado
union all select 'tabla de eventos con RLS', (select count(*) from t where relrowsecurity)::text, '1'
union all select 'permisos de tabla a anon/authenticated', (select count(*) from information_schema.role_table_grants
  where table_schema='public' and table_name='apariencia_delegacion_eventos' and grantee in ('anon','authenticated'))::text, '0'
union all select 'RPC de delegacion creados', (select count(*) from f)::text, '3'
union all select 'RPC SECURITY DEFINER con search_path',
  (select count(*) from f where prosecdef and proconfig::text like '%search_path%')::text, '3'
union all select 'helpers privados nuevos', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname in ('abc_apariencia_es_propietario','abc_apariencia_rol_existe'))::text, '2'
union all select 'EXECUTE para authenticated', (select count(*) from h where has_function_privilege('authenticated', oid, 'EXECUTE'))::text, '3'
union all select 'EXECUTE para anon y public',
  (select count(*) from h where has_function_privilege('anon', oid, 'EXECUTE') or has_function_privilege('public', oid, 'EXECUTE'))::text, '0'
union all select 'tipos de los argumentos', coalesce((select string_agg(proname || '(' || tipos || ')', ' | ' order by proname) from h), '-'),
  'abc_apariencia_delegar(text, text) | abc_apariencia_listar_delegaciones(text) | abc_apariencia_retirar_delegacion(text, text)'
union all select 'versiones en el historial', (select count(*) from supabase_migrations.schema_migrations
  where version in ('20261113090000','20261113140000'))::text, '2'
order by 1;
