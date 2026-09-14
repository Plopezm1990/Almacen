\set ON_ERROR_STOP on

do $verify$
begin
  if strpos(pg_get_functiondef('public.registrar_venta_stock(text,text,text,text,numeric,jsonb)'::regprocedure),'pm27_reconciliacion_pendiente_c24') > 0
     or strpos(pg_get_functiondef('public.registrar_encargo(text,text,text,text,numeric,text,jsonb)'::regprocedure),'pm27_reconciliacion_pendiente_c24') > 0 then
    raise exception 'puente_c24_no_reemplazado';
  end if;
  if strpos(pg_get_functiondef('public.registrar_pago_encargo(text,text,text,text,text,text,numeric,date,text,jsonb)'::regprocedure),'caja_operaciones') > 0
     or strpos(pg_get_functiondef('public.registrar_pago_encargo(text,text,text,text,text,text,numeric,date,text,jsonb)'::regprocedure),'pagos_factura') > 0 then
    raise exception 'pago_depende_ledger_legacy';
  end if;
  if has_function_privilege('authenticated','public.descontar_stock_carrito(jsonb,text)','EXECUTE')
     or has_function_privilege('authenticated','public.anular_venta_tpv(text,text)','EXECUTE') then
    raise exception 'legacy_rpc_sigue_expuesta';
  end if;
end
$verify$;

select 'PM27_PROD_RECON_C24_VERIFY=PASS' as resultado;
