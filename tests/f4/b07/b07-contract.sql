\set ON_ERROR_STOP on

-- F4 B07 / subpunto 1: configuración privada, sin proveedor hardcodeado y sin
-- secretos persistidos en la base de datos.

do $$
declare
  v_rls boolean;
begin
  if to_regclass('private.abc_b07_proveedores') is null
     or to_regclass('private.abc_b07_cuentas_comerciales') is null then
    raise exception 'F4_B07_FAIL: faltan tablas privadas de configuración';
  end if;

  select c.relrowsecurity into v_rls
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='private' and c.relname='abc_b07_proveedores';
  if v_rls is not true then
    raise exception 'F4_B07_FAIL: RLS de proveedores no activado';
  end if;

  select c.relrowsecurity into v_rls
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='private' and c.relname='abc_b07_cuentas_comerciales';
  if v_rls is not true then
    raise exception 'F4_B07_FAIL: RLS de cuentas no activado';
  end if;

  if has_table_privilege('anon','private.abc_b07_proveedores','SELECT')
     or has_table_privilege('authenticated','private.abc_b07_proveedores','SELECT')
     or has_table_privilege('anon','private.abc_b07_cuentas_comerciales','SELECT')
     or has_table_privilege('authenticated','private.abc_b07_cuentas_comerciales','SELECT') then
    raise exception 'F4_B07_FAIL: configuración expuesta a clientes';
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema='private'
       and table_name in ('abc_b07_proveedores','abc_b07_cuentas_comerciales')
       and column_name in ('secret_value','api_key','private_key','secret')
  ) then
    raise exception 'F4_B07_FAIL: secreto persistido en base de datos';
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid='private.abc_b07_cuentas_comerciales'::regclass
       and conname='abc_b07_account_scope_fk'
  ) or not exists (
    select 1 from pg_constraint
     where conrelid='private.abc_b07_cuentas_comerciales'::regclass
       and conname='abc_b07_account_provider_uq'
  ) then
    raise exception 'F4_B07_FAIL: relación o unicidad de cuenta incompleta';
  end if;

  if exists (select 1 from private.abc_b07_proveedores)
     or exists (select 1 from private.abc_b07_cuentas_comerciales) then
    raise exception 'F4_B07_FAIL: se ha hardcodeado un proveedor o una cuenta';
  end if;
end $$;

select 'ABC_F4_B07_CONFIG=PASS' as result;
