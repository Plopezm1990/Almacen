-- F4/B08: separar devolución física de reembolso económico.
-- Preparada para revisión; no aplicar automáticamente a QA ni producción.
--
-- La devolución física conserva stock y trazabilidad, pero no debe crear una
-- salida monetaria. Los reembolsos económicos deben usar abc_solicitar_reembolso,
-- que exige pago CONFIRMADO, aplicaciones confirmadas y capacidad específica.

revoke all on function public.registrar_devolucion_venta(
  text,text,text,text,text,numeric,numeric,text,text,date,jsonb
) from authenticated, service_role;

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
set search_path = ''
as $$
declare
  v_res jsonb;
begin
  if p_fecha is null then raise exception 'fecha_requerida'; end if;
  if p_reembolso is not null and p_reembolso <> 0 then
    raise exception 'reembolso_devolucion_separado';
  end if;
  v_res := public.registrar_devolucion_venta(
    p_operation_id,p_venta_operation_id,p_empresa_id,p_local_id,p_producto_id,
    p_cantidad,0,'SIN_REEMBOLSO',p_motivo,p_fecha,p_datos
  );
  update public.movimientos_stock
     set datos=coalesce(datos,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha)
   where operation_id=p_operation_id and tipo='DEVOLUCION_CLIENTE';
  return coalesce(v_res,'{}'::jsonb) || jsonb_build_object('fechaOperacion',p_fecha);
end;
$$;

revoke all on function public.registrar_devolucion_venta_pm09(
  text,text,text,text,text,numeric,numeric,text,text,date,jsonb
) from public, anon, service_role;
grant execute on function public.registrar_devolucion_venta_pm09(
  text,text,text,text,text,numeric,numeric,text,text,date,jsonb
) to authenticated;
