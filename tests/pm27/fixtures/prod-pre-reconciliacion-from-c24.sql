\set ON_ERROR_STOP on

-- Parte del fixture C24 y lo degrada al estado estructural observado en producción
-- antes de la reconciliación del 2026-09-14.

drop function public.registrar_venta_stock(text,text,text,text,numeric,jsonb);
drop function public.registrar_venta_stock_carrito(text,text,text,jsonb,jsonb);
drop function public.trasladar_stock_interno(text,text,text,text,text,text,numeric,jsonb);
drop function public.trasladar_stock_entre_locales(text,text,text,text,text,text,numeric,jsonb);
drop function public.registrar_encargo(text,text,text,text,numeric,text,jsonb);
drop function public.registrar_pago_encargo(text,text,text,text,text,text,numeric,date,text,jsonb);
drop function public.revertir_pago_encargo(text,text,text,text);

drop trigger g1_operation_id_global on public.pagos_encargo;
drop table public.pagos_encargo;
drop table public.encargos_empresa;
drop table public.clientes_empresa;

drop function private.pm08_validar_dinero(numeric,boolean,boolean);
drop function private.pm08_local_operable(text,text);
drop function private.pm08_puede_operar_caja();
drop function private.pm07_puede_vender();
drop function private.pm07_validar_cantidad(numeric,boolean,smallint);

alter table public.stock_ubicacion drop column unidad;
alter table public.almacen_kv drop column empresa_id;
alter table public.almacen_kv drop column local_id;

create or replace function private.pm08_validar_operation_id(p_operation_id text)
returns text
language plpgsql
immutable
set search_path=''
as $function$
declare v text := btrim(coalesce(p_operation_id,''));
begin
  if v !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$' then
    raise exception 'operation_id_invalido';
  end if;
  return v;
end
$function$;

create or replace function private.pm08_bloquear_operation_id(p_operation_id text)
returns void
language plpgsql
set search_path=''
as $function$
declare v text;
begin
  v := private.pm08_validar_operation_id(p_operation_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('la-suite-pm08:'||v,0));
end
$function$;

create or replace function private.pm09_bloquear_operation_id_stock(p_operation_id text)
returns text
language plpgsql
security definer
set search_path=''
as $function$
declare v text; v_ledger text;
begin
  v := private.pm08_validar_operation_id(p_operation_id);
  perform private.pm08_bloquear_operation_id(v);
  select g.ledger into v_ledger
    from private.g1_operation_ids_global g
   where g.operation_id=v;
  if found and v_ledger <> 'stock_operaciones' then
    raise exception 'operation_id_conflict';
  end if;
  return v;
end
$function$;

create or replace function private.g1_claim_operation_id()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare v_ledger text;
begin
  if new.operation_id is null or btrim(new.operation_id)='' then
    raise exception 'operation_id_requerido';
  end if;
  insert into private.g1_operation_ids_global(operation_id,ledger)
  values(new.operation_id,tg_table_name)
  on conflict(operation_id) do nothing;
  select g.ledger into v_ledger
    from private.g1_operation_ids_global g
   where g.operation_id=new.operation_id;
  if v_ledger is distinct from tg_table_name then
    raise exception 'operation_id_conflict';
  end if;
  return new;
end
$function$;

select 'PM27_PROD_DRIFT_FIXTURE=PASS' as resultado;
