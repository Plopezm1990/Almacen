-- PM27 / Producción — recuperación PRE-reconciliación.
-- Solo usar si el backend C24 debe abortarse ANTES de desplegar el frontend.
-- Falla cerrado si alguna tabla nueva ya contiene datos o si stock_ubicacion dejó de estar vacío.
-- No manipula supabase_migrations.schema_migrations.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('private.pm27_prod_recovery_20260914') is null then
    raise exception 'PM27_PROD_RECOVERY_ABORT: falta snapshot privado';
  end if;

  if to_regclass('public.clientes_empresa') is not null
     and exists (select 1 from public.clientes_empresa) then
    raise exception 'PM27_PROD_RECOVERY_ABORT: clientes_empresa ya contiene datos';
  end if;
  if to_regclass('public.encargos_empresa') is not null
     and exists (select 1 from public.encargos_empresa) then
    raise exception 'PM27_PROD_RECOVERY_ABORT: encargos_empresa ya contiene datos';
  end if;
  if to_regclass('public.pagos_encargo') is not null
     and exists (select 1 from public.pagos_encargo) then
    raise exception 'PM27_PROD_RECOVERY_ABORT: pagos_encargo ya contiene datos';
  end if;
  if exists (select 1 from public.stock_ubicacion) then
    raise exception 'PM27_PROD_RECOVERY_ABORT: stock_ubicacion ya contiene datos';
  end if;
end
$preflight$;

drop function if exists public.registrar_venta_stock(text,text,text,text,numeric,jsonb);
drop function if exists public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb);
drop function if exists public.trasladar_stock_interno(text,text,text,text,text,text,numeric,jsonb);
drop function if exists public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb);
drop function if exists public.registrar_encargo(text,text,text,text,numeric,text,jsonb);
drop function if exists public.registrar_pago_encargo(text,text,text,text,text,text,numeric,date,text,jsonb);
drop function if exists public.revertir_pago_encargo(text,text,text,text);

drop trigger if exists pm27_c22_pagos_encargo_integridad on public.pagos_encargo;
drop trigger if exists pm27_c22_pagos_encargo_no_truncate on public.pagos_encargo;
drop trigger if exists g1_operation_id_global on public.pagos_encargo;
drop function if exists private.pm27_c22_validar_pago_encargo_integridad();

drop function if exists private.pm14_total_encargo(text,text,text);

drop table if exists public.pagos_encargo;
drop table if exists public.encargos_empresa;
drop table if exists public.clientes_empresa;

drop function if exists private.pm06_puede_gestionar_finanzas();
drop function if exists private.pm08_validar_dinero(numeric,boolean,boolean);
drop function if exists private.pm08_local_operable(text,text);
drop function if exists private.pm08_puede_operar_caja();
drop function if exists private.pm07_puede_vender();
drop function if exists private.pm07_validar_cantidad(numeric,boolean,smallint);

alter table public.stock_ubicacion drop column if exists unidad;
alter table public.almacen_kv drop column if exists empresa_id;
alter table public.almacen_kv drop column if exists local_id;

do $restore$
declare
  r record;
begin
  for r in
    select definition
      from private.pm27_prod_recovery_20260914
     order by signature
  loop
    execute r.definition;
  end loop;
end
$restore$;

revoke all on function public.obtener_contexto_operativo() from public, anon, authenticated;
grant execute on function public.obtener_contexto_operativo() to authenticated;

revoke all on function private.pm12_confirmar_ajuste_stock(text,text,text,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function private.pm12_confirmar_ajuste_stock(text,text,text,jsonb,jsonb,jsonb) to authenticated;

revoke all on function private.pm12_cancelar_conteo_stock(text,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function private.pm12_cancelar_conteo_stock(text,text,jsonb,jsonb) to authenticated;

revoke all on function private.es_propietario_activo() from public, anon, authenticated;
grant execute on function private.es_propietario_activo() to authenticated;

revoke all on function public.descontar_stock_carrito(jsonb,text) from public, anon, authenticated;
grant execute on function public.descontar_stock_carrito(jsonb,text) to authenticated;
revoke all on function public.anular_venta_tpv(text,text) from public, anon, authenticated;
grant execute on function public.anular_venta_tpv(text,text) to authenticated;

drop table private.pm27_prod_recovery_20260914;

do $post$
begin
  if to_regclass('public.clientes_empresa') is not null
     or to_regclass('public.encargos_empresa') is not null
     or to_regclass('public.pagos_encargo') is not null
     or to_regprocedure('public.registrar_venta_stock(text,text,text,text,numeric,jsonb)') is not null then
    raise exception 'PM27_PROD_RECOVERY_ABORT: recuperación incompleta';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.obtener_contexto_operativo()',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.descontar_stock_carrito(jsonb,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.anular_venta_tpv(text,text)',
       'EXECUTE'
     ) then
    raise exception 'PM27_PROD_RECOVERY_ABORT: ACL PRE-C24 no restaurado';
  end if;

  raise notice 'PM27_PROD_RECOVERY=PASS';
end
$post$;

commit;
