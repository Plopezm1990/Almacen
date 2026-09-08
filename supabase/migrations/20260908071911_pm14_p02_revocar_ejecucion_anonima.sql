-- Alinear privilegios de ejecucion con el resto de RPC financieras (registrar_pago_factura,
-- registrar_movimiento_caja, etc.): anon nunca debe poder invocar estas funciones.
revoke execute on function public.registrar_encargo(text, text, text, text, numeric, text, jsonb) from public;
revoke execute on function public.registrar_pago_encargo(text, text, text, text, text, text, numeric, date, text, jsonb) from public;
revoke execute on function public.revertir_pago_encargo(text, text, text, text) from public;

grant execute on function public.registrar_encargo(text, text, text, text, numeric, text, jsonb) to authenticated;
grant execute on function public.registrar_pago_encargo(text, text, text, text, text, text, numeric, date, text, jsonb) to authenticated;
grant execute on function public.revertir_pago_encargo(text, text, text, text) to authenticated;
