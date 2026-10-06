-- PM09 / preflight exclusivo de producción. Solo lectura.
-- Foto tomada el 2026-10-06 en flqercbgpgmmfaakrwkc.
-- "ok = false" significa parar y revisar el plan antes de crear funciones.
-- No usar este SQL para aplicar ni para registrar migraciones.

with expected_functions(signature, body_md5, config, auth_execute) as (
  values
    ('private.pm09_bloquear_operation_id_stock(text)', '51caae254c58ac1fb940afaef1c21f0a', 'search_path=""', false),
    ('public.registrar_devolucion_venta_pm09(text,text,text,text,text,numeric,numeric,text,text,date,jsonb)', '0d16337e9f66df5915ca30887144c46d', 'search_path=""', true),
    ('public.registrar_venta_stock_carrito_pm09(text,text,text,jsonb,date,jsonb)', '2fc206a4863bdfb009a78a33401e57eb', 'search_path=""', true),
    ('public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb)', '3f74dff6999bdc36ed54cd757345972e', 'search_path=public, auth, private, pg_temp', true),
    ('public.registrar_venta_stock_pm09(text,text,text,text,numeric,date,jsonb)', null, null, null),
    ('public.registrar_venta_stock(text,text,text,text,numeric,jsonb)', '93a6ffa723d09ff741fc3444a0bb5d17', 'search_path=public, auth, private, pg_temp', true),
    ('public.revertir_venta_stock_carrito_pm09(text,text,date,text)', '7054868d34fe182306e50a85cf54a456', 'search_path=""', true),
    ('public.revertir_venta_stock_carrito(text,text,text)', '59b8fc98799e5514d9c06bef23292a54', 'search_path=""', true),
    ('public.revertir_venta_stock_pm09(text,text,date,text)', null, null, null),
    ('public.revertir_venta_stock(text,text,text)', null, null, null)
),
function_checks as (
  select
    e.signature,
    case when p.oid is null then null else md5(replace(p.prosrc, E'\r', '')) end as actual_md5,
    (
      (p.oid is null) = (e.body_md5 is null)
      and (p.oid is null or (
        md5(replace(p.prosrc, E'\r', '')) = e.body_md5
        and p.prosecdef
        and array_to_string(p.proconfig, ',') = e.config
        and has_function_privilege('authenticated', p.oid, 'EXECUTE') = e.auth_execute
        and not has_function_privilege('anon', p.oid, 'EXECUTE')
        and not has_function_privilege('service_role', p.oid, 'EXECUTE')
      ))
    ) as ok
  from expected_functions e
  left join pg_proc p on p.oid = to_regprocedure(e.signature)
),
expected_tables(tab, columns_md5, constraints_md5) as (
  values
    ('arqueos_caja', '8cce751df7af3fce89e8b439899630d0', 'c12a21816a1fc78e12d0f1f065801790'),
    ('caja_operaciones', '523123cb2f18a21b88126548192ded19', 'db10d47d321e9ad30adc31cd5fe13ba3'),
    ('devoluciones_venta', '170a6cd20b8171ea4a6a5da21e8bdd11', 'c3961cf90341cd57baf4bb27b61f44ff'),
    ('movimientos_stock', '0a02dd40775f8a3c6bbc1004bd56941b', '1293739bf208aa70ad3576f051d97270'),
    ('stock_operaciones', '61458591c3a63aecde089a510b5b45b5', 'c6db2d618085b86cee8c40fb627f4120'),
    ('stock_ubicacion', '8f26ceb876ad017b5c20ae6c2fcaa2af', '381879f917e5afb5cf4f92948495beee')
),
column_hashes as (
  select table_name,
    md5(string_agg(
      column_name || ':' || data_type || ':' || coalesce(udt_name, '') || ':' ||
      is_nullable || ':' || coalesce(column_default, ''),
      '|' order by ordinal_position
    )) as md5
  from information_schema.columns
  where table_schema = 'public'
    and table_name in (select tab from expected_tables)
  group by table_name
),
constraint_hashes as (
  select cls.relname as table_name,
    md5(string_agg(con.conname || ':' || pg_get_constraintdef(con.oid), '|' order by con.conname)) as md5
  from pg_constraint con
  join pg_class cls on cls.oid = con.conrelid
  join pg_namespace ns on ns.oid = cls.relnamespace
  where ns.nspname = 'public'
    and cls.relname in (select tab from expected_tables)
  group by cls.relname
),
table_checks as (
  select e.tab,
    c.md5 is not distinct from e.columns_md5
      and k.md5 is not distinct from e.constraints_md5 as ok
  from expected_tables e
  left join column_hashes c on c.table_name = e.tab
  left join constraint_hashes k on k.table_name = e.tab
),
migration_checks as (
  select
    exists(select 1 from supabase_migrations.schema_migrations where name = 'pm27_restore_c24_operational_rpcs')
    and exists(select 1 from supabase_migrations.schema_migrations where name = 'p2_r03a_restore_pm08_pm09_post_reset_hardened')
    and not exists(select 1 from supabase_migrations.schema_migrations where name in (
      'pm09_conciliacion_caja',
      'pm09_fecha_operacion_economica',
      'pm09_operation_id_global_hardening',
      'abc_f5_pm09_security_hardening'
    )) as ok
),
data_checks as (
  select
    (select count(*) from public.stock_operaciones where tipo in ('VENTA', 'REVERSO')) as sale_operations,
    (select count(*) from public.movimientos_stock where tipo in ('VENTA', 'REVERSO')) as sale_movements
)
select jsonb_build_object(
  'ok',
    (select bool_and(ok) from function_checks)
    and (select bool_and(ok) from table_checks)
    and (select ok from migration_checks)
    and (select sale_operations = 0 and sale_movements = 0 from data_checks),
  'function_mismatches',
    (select coalesce(jsonb_agg(jsonb_build_object('signature', signature, 'actual_md5', actual_md5)), '[]'::jsonb)
     from function_checks where not ok),
  'table_mismatches',
    (select coalesce(jsonb_agg(tab), '[]'::jsonb) from table_checks where not ok),
  'migration_history_ok', (select ok from migration_checks),
  'sale_operations', (select sale_operations from data_checks),
  'sale_movements', (select sale_movements from data_checks)
) as pm09_baseline_preflight;
