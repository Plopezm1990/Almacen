-- PM27 / C24 — inventario pre-deploy para recuperación.
-- SOLO LECTURA. Exporta el estado previo de los objetos que C13-C23 sustituirán
-- o endurecerán. El resultado debe conservarse junto al SHA exacto del rollout.

begin;
set local transaction read only;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- 1) Definiciones de funciones afectadas.
select n.nspname as schema_name,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as identity_args,
       pg_get_functiondef(p.oid) as definition,
       p.proacl
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where (n.nspname, p.proname) in (
   ('public','obtener_contexto_operativo'),
   ('private','es_propietario_activo'),
   ('public','registrar_venta_stock'),
   ('public','registrar_venta_stock_carrito'),
   ('public','trasladar_stock_interno'),
   ('public','trasladar_stock_entre_locales'),
   ('private','pm12_confirmar_ajuste_stock'),
   ('private','pm12_cancelar_conteo_stock'),
   ('public','registrar_encargo'),
   ('private','pm27_c22_validar_pago_encargo_integridad')
 )
 order by n.nspname, p.proname, identity_args;

-- 2) RPC legacy cuyo EXECUTE C13 retira.
select p.oid::regprocedure::text as function_signature,
       p.proacl,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public'
   and p.proname in ('descontar_stock_carrito','anular_venta_tpv')
 order by function_signature;

-- 3) Grants directos de tablas afectadas por C21/C22.
select table_schema, table_name, grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema='public'
   and table_name in ('encargos_empresa','pagos_encargo')
 order by table_name, grantee, privilege_type;

-- 4) Constraints, índices y triggers previos de pagos_encargo.
select conname, contype, convalidated, pg_get_constraintdef(oid, true) as definition
  from pg_constraint
 where conrelid='public.pagos_encargo'::regclass
 order by conname;

select indexname, indexdef
  from pg_indexes
 where schemaname='public' and tablename='pagos_encargo'
 order by indexname;

select t.tgname,
       pg_get_triggerdef(t.oid, true) as definition,
       pn.nspname as function_schema,
       p.proname as function_name
  from pg_trigger t
  join pg_proc p on p.oid=t.tgfoid
  join pg_namespace pn on pn.oid=p.pronamespace
 where t.tgrelid='public.pagos_encargo'::regclass
   and not t.tgisinternal
 order by t.tgname;

-- 5) Migration history previa: necesaria para distinguir rollback de schema
-- frente a reparación de metadata del migrador.
select version, name, created_by
  from supabase_migrations.schema_migrations
 order by version desc;

rollback;
