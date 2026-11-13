-- ============================================================================
-- Verificacion posterior del contrato de apariencia (solo lectura).
-- Se ejecuta en el Editor SQL del proyecto QA qjqorixtkilwsndqayyx despues de
-- aplicar 20261113090000_rediseno_apariencia_empresa.sql.
--
-- Las catorce filas deben traer `valor` igual a `esperado`. La unica que sigue
-- en 0 justo despues del Editor SQL es "version en el historial": el bookkeeping
-- lo registra `supabase migration repair 20261113090000 --status applied`.
--
-- No escribe nada. Antes de aplicar la migracion devuelve ceros y '-' en las
-- firmas, asi que sirve tambien como control previo.
-- ============================================================================
with t as (
  select c.relname, c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('apariencia_empresa','apariencia_revisiones','apariencia_delegaciones')
), f as (
  select p.proname, p.prosecdef, p.proconfig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('abc_apariencia_leer','abc_apariencia_guardar','abc_apariencia_restaurar')
), h as (
  -- Solo los tipos de los argumentos: oidvectortypes no arrastra los nombres
  -- de los parametros, asi que la comparacion no se rompe si se renombran.
  select p.oid, p.proname, pg_catalog.oidvectortypes(p.proargtypes) as tipos
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('abc_apariencia_leer','abc_apariencia_guardar','abc_apariencia_restaurar')
)
select 'tablas creadas' as comprobacion, (select count(*) from t)::text as valor, '3' as esperado
union all select 'tablas con RLS activada', (select count(*) from t where relrowsecurity)::text, '3'
union all select 'politicas RLS permisivas', (select count(*) from pg_policies where schemaname='public' and tablename in
  ('apariencia_empresa','apariencia_revisiones','apariencia_delegaciones'))::text, '0'
union all select 'permisos de tabla a anon/authenticated', (select count(*) from information_schema.role_table_grants
  where table_schema='public' and table_name in ('apariencia_empresa','apariencia_revisiones','apariencia_delegaciones')
    and grantee in ('anon','authenticated'))::text, '0'
union all select 'funciones publicas creadas', (select count(*) from f)::text, '3'
union all select 'funciones SECURITY DEFINER', (select count(*) from f where prosecdef)::text, '3'
union all select 'funciones con search_path fijado', (select count(*) from f where proconfig::text like '%search_path%')::text, '3'
union all select 'helpers privados', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname like 'abc_apariencia%')::text, '3'
union all select 'EXECUTE para authenticated', (select count(*) from h where has_function_privilege('authenticated', oid, 'EXECUTE'))::text, '3'
union all select 'EXECUTE para anon', (select count(*) from h where has_function_privilege('anon', oid, 'EXECUTE'))::text, '0'
union all select 'EXECUTE para public', (select count(*) from h where has_function_privilege('public', oid, 'EXECUTE'))::text, '0'
union all select 'EXECUTE para service_role', (select count(*) from h where has_function_privilege('service_role', oid, 'EXECUTE'))::text, '0'
union all select 'tipos de los argumentos', coalesce((select string_agg(proname || '(' || tipos || ')', ' | ' order by proname) from h), '-'),
  'abc_apariencia_guardar(text, bigint, text, text, jsonb) | abc_apariencia_leer(text) | abc_apariencia_restaurar(text, bigint)'
union all select 'version en el historial', (select count(*) from supabase_migrations.schema_migrations where version='20261113090000')::text, '1'
order by 1;
