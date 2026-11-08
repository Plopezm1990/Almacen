-- ABC D09-D11 — conservar el snapshot económico al consumir una línea de pedido.
-- El movimiento de stock es el origen que lee el historial de ventas. La línea
-- de pedido puede cambiar de estado después, por lo que el precio e IVA deben
-- quedar congelados en datos en el mismo momento del consumo.

create or replace function private.abc_stock_consumir_linea(
  p_linea public.pedido_lineas,
  p_modalidad text,
  p_motivo text
)
returns void
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_stock public.stock_ubicacion%rowtype;
  v_row public.abc_stock_lineas%rowtype;
  v_found boolean;
  v_op text := 'abc.stock.consume.'||p_linea.id::text;
  v_iva numeric := coalesce(
    (p_linea.snapshot_comercial->>'impuesto_pct')::numeric,
    case
      when coalesce(p_linea.base,0) <> 0
        then (coalesce(p_linea.impuestos,0) / p_linea.base) * 100
      else 0
    end,
    0
  );
begin
  select * into v_stock
    from public.stock_ubicacion
   where empresa_id=p_linea.empresa_id
     and local_id=p_linea.local_id
     and producto_id=p_linea.producto_id
   for update;
  if not found then
    return;
  end if;

  select * into v_row
    from public.abc_stock_lineas
   where empresa_id=p_linea.empresa_id
     and local_id=p_linea.local_id
     and linea_id=p_linea.id
   for update;
  v_found:=found;

  if v_found and v_row.estado in ('CONSUMIDA','MERMA','REVERTIDA','CANCELADA') then
    return;
  end if;

  perform public.registrar_venta_stock_pm09(
    v_op,
    p_linea.empresa_id,
    p_linea.local_id,
    p_linea.producto_id,
    p_linea.cantidad,
    p_linea.created_operating_day,
    jsonb_build_object(
      'origen','ABC_PEDIDO_LINEA',
      'linea_id',p_linea.id,
      'pedido_id',p_linea.pedido_id,
      'modalidad',upper(p_modalidad),
      'motivo',p_motivo,
      'precioUnitarioNeto',coalesce(p_linea.precio_unitario,0),
      'ingresoUnitario',coalesce(p_linea.precio_unitario,0),
      'ivaVentaAplicado',v_iva,
      'baseLinea',coalesce(p_linea.base,0),
      'impuestosLinea',coalesce(p_linea.impuestos,0),
      'importeLinea',coalesce(p_linea.total,0),
      'precioUnitarioConImpuesto',case
        when coalesce(p_linea.cantidad,0) <> 0
          then coalesce(p_linea.total,0) / p_linea.cantidad
        else 0
      end
    )
  );

  if v_found then
    update public.abc_stock_lineas
       set estado='CONSUMIDA',
           consume_operation_id=v_op,
           motivo=p_motivo,
           version=version+1,
           updated_at=now()
     where empresa_id=p_linea.empresa_id
       and local_id=p_linea.local_id
       and linea_id=p_linea.id;
  else
    insert into public.abc_stock_lineas(
      empresa_id,local_id,linea_id,pedido_id,producto_id,modalidad,cantidad,
      estado,consume_operation_id,motivo
    ) values (
      p_linea.empresa_id,p_linea.local_id,p_linea.id,p_linea.pedido_id,
      p_linea.producto_id,upper(p_modalidad),p_linea.cantidad,
      'CONSUMIDA',v_op,p_motivo
    );
  end if;
end $$;

