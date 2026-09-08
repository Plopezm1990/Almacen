-- revoke execute ... from public no bastó para retirar el privilegio de anon
-- (Supabase concede EXECUTE a anon explícitamente en las funciones nuevas, no vía PUBLIC).
-- Se revoca explícitamente para que anon quede exactamente igual que en registrar_pago_factura,
-- registrar_movimiento_caja y el resto de RPC financieras: sin acceso.
revoke execute on function public.registrar_encargo(text, text, text, text, numeric, text, jsonb) from anon;
revoke execute on function public.registrar_pago_encargo(text, text, text, text, text, text, numeric, date, text, jsonb) from anon;
revoke execute on function public.revertir_pago_encargo(text, text, text, text) from anon;
