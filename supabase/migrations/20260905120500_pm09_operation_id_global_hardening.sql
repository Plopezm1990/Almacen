-- PM-09 / Punto 17
-- Robustez e idempotencia global para ventas/reversos PM09.
-- Evita reutilizar el mismo operationId entre ledgers de stock y caja/arqueos.
-- Destino autorizado: Supabase QA. No aplicar a producción sin autorización expresa.

create or replace function private.pm09_bloquear_operation_id_stock(p_operation_id text)
returns text
language plpgsql
security definer
set search_path = public, auth, private, pg_temp
as $$
declare
  v_operation_id text;
begin
  v_operation_id := private.pm08_validar_operation_id(p_operation_id);
  perform private.pm08_bloquear_operation_id(v_operation_id);

  if exists(select 1 from public.caja_operaciones where operation_id=v_operation_id)
     or exists(select 1 from public.arqueos_caja where operation_id=v_operation_id)
     or exists(select 1 from public.arqueos_caja_anulaciones where operation_id=v_operation_id) then
    raise exception 'operation_id_conflict';
  end if;

  return v_operation_id;
end;
$$;

create or replace function public.registrar_venta_stock_pm09(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_producto_id text,
  p_cantidad numeric,
  p_fecha date,
  p_datos jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, private, pg_temp
as $$
declare
  v_res jsonb;
  v_operation_id text;
begin
  if p_fecha is null then raise exception 'fecha_requerida'; end if;
  v_operation_id := private.pm09_bloquear_operation_id_stock(p_operation_id);
  v_res := public.registrar_venta_stock(
    v_operation_id,p_empresa_id,p_local_id,p_producto_id,p_cantidad,
    coalesce(p_datos,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha)
  );
  update public.movimientos_stock
     set datos=coalesce(datos,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha)
   where operation_id=v_operation_id and tipo='VENTA';
  return coalesce(v_res,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha);
end;
$$;

create or replace function public.registrar_venta_stock_carrito_pm09(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_lineas jsonb,
  p_fecha date,
  p_datos jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, private, pg_temp
as $$
declare
  v_res jsonb;
  v_operation_id text;
begin
  if p_fecha is null then raise exception 'fecha_requerida'; end if;
  v_operation_id := private.pm09_bloquear_operation_id_stock(p_operation_id);
  v_res := public.registrar_venta_stock_carrito(
    v_operation_id,p_empresa_id,p_local_id,p_lineas,
    coalesce(p_datos,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha)
  );
  update public.movimientos_stock
     set datos=coalesce(datos,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha)
   where operation_id=v_operation_id and tipo='VENTA';
  return coalesce(v_res,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha);
end;
$$;

create or replace function public.revertir_venta_stock_pm09(
  p_operation_id text,
  p_venta_operation_id text,
  p_fecha date,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, private, pg_temp
as $$
declare
  v_res jsonb;
  v_fecha_existente date;
  v_operation_id text;
begin
  if p_fecha is null then raise exception 'fecha_requerida'; end if;
  v_operation_id := private.pm09_bloquear_operation_id_stock(p_operation_id);
  if exists(select 1 from public.stock_operaciones where operation_id=v_operation_id) then
    select min(case when coalesce(datos->>'fechaOperacion','') ~ '^\d{4}-\d{2}-\d{2}$' then (datos->>'fechaOperacion')::date end)
      into v_fecha_existente
      from public.movimientos_stock
     where operation_id=v_operation_id and tipo='REVERSO';
    if v_fecha_existente is null or v_fecha_existente<>p_fecha then
      raise exception 'operation_id_conflict';
    end if;
  end if;
  v_res := public.revertir_venta_stock(v_operation_id,p_venta_operation_id,p_motivo);
  update public.movimientos_stock
     set datos=coalesce(datos,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha)
   where operation_id=v_operation_id and tipo='REVERSO';
  return coalesce(v_res,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha);
end;
$$;

create or replace function public.revertir_venta_stock_carrito_pm09(
  p_operation_id text,
  p_venta_operation_id text,
  p_fecha date,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, private, pg_temp
as $$
declare
  v_res jsonb;
  v_fecha_existente date;
  v_operation_id text;
begin
  if p_fecha is null then raise exception 'fecha_requerida'; end if;
  v_operation_id := private.pm09_bloquear_operation_id_stock(p_operation_id);
  if exists(select 1 from public.stock_operaciones where operation_id=v_operation_id) then
    select min(case when coalesce(datos->>'fechaOperacion','') ~ '^\d{4}-\d{2}-\d{2}$' then (datos->>'fechaOperacion')::date end)
      into v_fecha_existente
      from public.movimientos_stock
     where operation_id=v_operation_id and tipo='REVERSO';
    if v_fecha_existente is null or v_fecha_existente<>p_fecha then
      raise exception 'operation_id_conflict';
    end if;
  end if;
  v_res := public.revertir_venta_stock_carrito(v_operation_id,p_venta_operation_id,p_motivo);
  update public.movimientos_stock
     set datos=coalesce(datos,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha)
   where operation_id=v_operation_id and tipo='REVERSO';
  return coalesce(v_res,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha);
end;
$$;

revoke all on function private.pm09_bloquear_operation_id_stock(text) from public, anon, authenticated;
revoke all on function public.registrar_venta_stock_pm09(text,text,text,text,numeric,date,jsonb) from public, anon;
revoke all on function public.registrar_venta_stock_carrito_pm09(text,text,text,jsonb,date,jsonb) from public, anon;
revoke all on function public.revertir_venta_stock_pm09(text,text,date,text) from public, anon;
revoke all on function public.revertir_venta_stock_carrito_pm09(text,text,date,text) from public, anon;

grant execute on function public.registrar_venta_stock_pm09(text,text,text,text,numeric,date,jsonb) to authenticated;
grant execute on function public.registrar_venta_stock_carrito_pm09(text,text,text,jsonb,date,jsonb) to authenticated;
grant execute on function public.revertir_venta_stock_pm09(text,text,date,text) to authenticated;
grant execute on function public.revertir_venta_stock_carrito_pm09(text,text,date,text) to authenticated;
