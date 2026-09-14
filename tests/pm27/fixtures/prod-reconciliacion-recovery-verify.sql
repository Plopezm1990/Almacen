\set ON_ERROR_STOP on

do $verify$
begin
  if to_regclass('public.clientes_empresa') is not null
     or to_regclass('public.encargos_empresa') is not null
     or to_regclass('public.pagos_encargo') is not null then
    raise exception 'recovery_tablas';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='stock_ubicacion' and column_name='unidad'
  ) then
    raise exception 'recovery_unidad';
  end if;
  if not has_function_privilege('authenticated','public.descontar_stock_carrito(jsonb,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.anular_venta_tpv(text,text)','EXECUTE') then
    raise exception 'recovery_acl';
  end if;
end
$verify$;

select 'PM27_PROD_RECON_RECOVERY_VERIFY=PASS' as resultado;
