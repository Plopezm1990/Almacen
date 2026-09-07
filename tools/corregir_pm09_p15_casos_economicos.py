from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

old_params = 'const params = { p_operation_id: ventaId, p_empresa_id: empresaId, p_local_id: localActivoId, p_lineas: lineasParaRpc, p_datos: { medioPago, detallePago: detallePago || null } };'
new_params = 'const params = { p_operation_id: ventaId, p_empresa_id: empresaId, p_local_id: localActivoId, p_lineas: lineasParaRpc, p_fecha: todayISO(), p_datos: { medioPago, detallePago: detallePago || null } };'
if s.count(old_params) != 1:
    raise SystemExit(f'PM09_P15_PARAMS_VENTA_NO_UNICO:{s.count(old_params)}')
s = s.replace(old_params, new_params, 1)

old_sale_rpc = 'supabase.rpc("registrar_venta_stock_carrito", params)'
new_sale_rpc = 'supabase.rpc("registrar_venta_stock_carrito_pm09", params)'
if s.count(old_sale_rpc) != 1:
    raise SystemExit(f'PM09_P15_RPC_VENTA_NO_UNICO:{s.count(old_sale_rpc)}')
s = s.replace(old_sale_rpc, new_sale_rpc, 1)

old_reverse = 'const r2 = await supabase.rpc("revertir_venta_stock_carrito", { p_operation_id: operationId, p_venta_operation_id: ventaId, p_motivo: motivo || "" });'
new_reverse = 'const r2 = await supabase.rpc("revertir_venta_stock_carrito_pm09", { p_operation_id: operationId, p_venta_operation_id: ventaId, p_fecha: todayISO(), p_motivo: motivo || "" });'
if s.count(old_reverse) != 1:
    raise SystemExit(f'PM09_P15_RPC_REVERSO_NO_UNICO:{s.count(old_reverse)}')
s = s.replace(old_reverse, new_reverse, 1)

old_return_rpc = 'window.__nubeCliente.rpc("registrar_devolucion_venta", {'
new_return_rpc = 'window.__nubeCliente.rpc("registrar_devolucion_venta_pm09", {'
if s.count(old_return_rpc) != 1:
    raise SystemExit(f'PM09_P15_RPC_DEVOLUCION_NO_UNICO:{s.count(old_return_rpc)}')
s = s.replace(old_return_rpc, new_return_rpc, 1)

old_date = 'fecha: creado ? creado.slice(0, 10) : todayISO(),'
new_date = 'fecha: d2.fechaOperacion || (creado ? creado.slice(0, 10) : todayISO()),'
if s.count(old_date) != 1:
    raise SystemExit(f'PM09_P15_SYNC_FECHA_NO_UNICO:{s.count(old_date)}')
s = s.replace(old_date, new_date, 1)

p.write_text(s, encoding='utf-8')
print('PM09_P15_PATCH_OK=1')
