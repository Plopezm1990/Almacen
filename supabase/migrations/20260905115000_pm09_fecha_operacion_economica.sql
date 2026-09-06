-- PM-09 / Punto 15
-- Fecha económica explícita para ventas, anulaciones y devoluciones.
-- Mantiene compatibilidad con las RPC PM07/PM08 existentes y no toca producción.

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
begin
  if p_fecha is null then raise exception 'fecha_requerida'; end if;
  v_res := public.registrar_venta_stock(
    p_operation_id,p_empresa_id,p_local_id,p_producto_id,p_cantidad,
    coalesce(p_datos,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha)
  );
  update public.movimientos_stock
     set datos=coalesce(datos,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha)
   where operation_id=p_operation_id and tipo='VENTA';
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
begin
  if p_fecha is null then raise exception 'fecha_requerida'; end if;
  v_res := public.registrar_venta_stock_carrito(
    p_operation_id,p_empresa_id,p_local_id,p_lineas,
    coalesce(p_datos,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha)
  );
  update public.movimientos_stock
     set datos=coalesce(datos,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha)
   where operation_id=p_operation_id and tipo='VENTA';
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
begin
  if p_fecha is null then raise exception 'fecha_requerida'; end if;
  if exists(select 1 from public.stock_operaciones where operation_id=p_operation_id) then
    select min(case when coalesce(datos->>'fechaOperacion','') ~ '^\d{4}-\d{2}-\d{2}$' then (datos->>'fechaOperacion')::date end)
      into v_fecha_existente
      from public.movimientos_stock
     where operation_id=p_operation_id and tipo='REVERSO';
    if v_fecha_existente is null or v_fecha_existente<>p_fecha then
      raise exception 'operation_id_conflict';
    end if;
  end if;
  v_res := public.revertir_venta_stock(p_operation_id,p_venta_operation_id,p_motivo);
  update public.movimientos_stock
     set datos=coalesce(datos,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha)
   where operation_id=p_operation_id and tipo='REVERSO';
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
begin
  if p_fecha is null then raise exception 'fecha_requerida'; end if;
  if exists(select 1 from public.stock_operaciones where operation_id=p_operation_id) then
    select min(case when coalesce(datos->>'fechaOperacion','') ~ '^\d{4}-\d{2}-\d{2}$' then (datos->>'fechaOperacion')::date end)
      into v_fecha_existente
      from public.movimientos_stock
     where operation_id=p_operation_id and tipo='REVERSO';
    if v_fecha_existente is null or v_fecha_existente<>p_fecha then
      raise exception 'operation_id_conflict';
    end if;
  end if;
  v_res := public.revertir_venta_stock_carrito(p_operation_id,p_venta_operation_id,p_motivo);
  update public.movimientos_stock
     set datos=coalesce(datos,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha)
   where operation_id=p_operation_id and tipo='REVERSO';
  return coalesce(v_res,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha);
end;
$$;

create or replace function public.registrar_devolucion_venta_pm09(
  p_operation_id text,
  p_venta_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_producto_id text,
  p_cantidad numeric,
  p_reembolso numeric,
  p_medio_reembolso text,
  p_motivo text,
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
begin
  if p_fecha is null then raise exception 'fecha_requerida'; end if;
  v_res := public.registrar_devolucion_venta(
    p_operation_id,p_venta_operation_id,p_empresa_id,p_local_id,p_producto_id,
    p_cantidad,p_reembolso,p_medio_reembolso,p_motivo,p_fecha,p_datos
  );
  update public.movimientos_stock
     set datos=coalesce(datos,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha)
   where operation_id=p_operation_id and tipo='DEVOLUCION_CLIENTE';
  return coalesce(v_res,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha);
end;
$$;

-- Caja PM09: usar fecha económica cuando exista; los registros PM07/PM08
-- históricos conservan fallback explícito a created_at UTC.
create or replace function private.pm09_resumen_caja_ventas(
  p_empresa_id text,
  p_local_id text,
  p_fecha date
)
returns jsonb
language sql
stable
security definer
set search_path = public, auth, private, pg_temp
as $$
with base as (
  select
    m.*,
    coalesce(
      case when coalesce(m.datos->>'fechaOperacion','') ~ '^\d{4}-\d{2}-\d{2}$'
        then (m.datos->>'fechaOperacion')::date end,
      timezone('UTC',m.created_at)::date
    ) as fecha_operacion
  from public.movimientos_stock m
  where m.empresa_id=p_empresa_id
    and m.local_id=p_local_id
    and m.tipo in ('VENTA','REVERSO')
), mov as (
  select
    tipo,
    abs(coalesce(cantidad,0))::numeric as cantidad,
    coalesce(nullif(upper(btrim(datos->>'medioPago')),''),'EFECTIVO') as medio,
    case when coalesce(datos->>'ingresoUnitario','') ~ '^-?[0-9]+([.][0-9]+)?$'
      then abs((datos->>'ingresoUnitario')::numeric) else 0 end as ingreso_unitario,
    case when coalesce(datos->>'ivaVentaAplicado','') ~ '^-?[0-9]+([.][0-9]+)?$'
      then (datos->>'ivaVentaAplicado')::numeric else 0 end as iva,
    case when coalesce(datos->'detallePago'->>'efectivo','') ~ '^-?[0-9]+([.][0-9]+)?$'
      then abs((datos->'detallePago'->>'efectivo')::numeric) else 0 end as mixto_efectivo,
    case when coalesce(datos->'detallePago'->>'tarjeta','') ~ '^-?[0-9]+([.][0-9]+)?$'
      then abs((datos->'detallePago'->>'tarjeta')::numeric) else 0 end as mixto_tarjeta
  from base
  where fecha_operacion=p_fecha
), calc as (
  select
    tipo,
    case when medio='MIXTO' then mixto_efectivo
         when medio='EFECTIVO' then cantidad*ingreso_unitario*(1+iva/100)
         else 0 end as efectivo,
    case when medio='MIXTO' then mixto_tarjeta
         when medio='TARJETA' then cantidad*ingreso_unitario*(1+iva/100)
         else 0 end as tarjeta,
    case when medio='TRANSFERENCIA' then cantidad*ingreso_unitario*(1+iva/100) else 0 end as transferencia,
    case when medio not in ('EFECTIVO','TARJETA','TRANSFERENCIA','MIXTO') then cantidad*ingreso_unitario*(1+iva/100) else 0 end as otro
  from mov
)
select jsonb_build_object(
  'ventasEfectivo', round(coalesce(sum(case when tipo='VENTA' then efectivo else 0 end),0),2),
  'ventasTarjeta', round(coalesce(sum(case when tipo='VENTA' then tarjeta else 0 end),0),2),
  'ventasTransferencia', round(coalesce(sum(case when tipo='VENTA' then transferencia else 0 end),0),2),
  'ventasOtro', round(coalesce(sum(case when tipo='VENTA' then otro else 0 end),0),2),
  'reversosEfectivo', -round(coalesce(sum(case when tipo='REVERSO' then efectivo else 0 end),0),2),
  'reversosTarjeta', -round(coalesce(sum(case when tipo='REVERSO' then tarjeta else 0 end),0),2),
  'reversosTransferencia', -round(coalesce(sum(case when tipo='REVERSO' then transferencia else 0 end),0),2),
  'reversosOtro', -round(coalesce(sum(case when tipo='REVERSO' then otro else 0 end),0),2)
)
from calc;
$$;

revoke all on function public.registrar_venta_stock_pm09(text,text,text,text,numeric,date,jsonb) from public, anon;
revoke all on function public.registrar_venta_stock_carrito_pm09(text,text,text,jsonb,date,jsonb) from public, anon;
revoke all on function public.revertir_venta_stock_pm09(text,text,date,text) from public, anon;
revoke all on function public.revertir_venta_stock_carrito_pm09(text,text,date,text) from public, anon;
revoke all on function public.registrar_devolucion_venta_pm09(text,text,text,text,text,numeric,numeric,text,text,date,jsonb) from public, anon;

grant execute on function public.registrar_venta_stock_pm09(text,text,text,text,numeric,date,jsonb) to authenticated;
grant execute on function public.registrar_venta_stock_carrito_pm09(text,text,text,jsonb,date,jsonb) to authenticated;
grant execute on function public.revertir_venta_stock_pm09(text,text,date,text) to authenticated;
grant execute on function public.revertir_venta_stock_carrito_pm09(text,text,date,text) to authenticated;
grant execute on function public.registrar_devolucion_venta_pm09(text,text,text,text,text,numeric,numeric,text,text,date,jsonb) to authenticated;
