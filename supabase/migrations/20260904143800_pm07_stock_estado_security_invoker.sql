-- PM-07 · La vista debe respetar las policies RLS de stock_ubicacion.
alter view public.stock_estado set (security_invoker = true);
