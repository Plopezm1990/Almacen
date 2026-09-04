-- PM-07 · Alinear autorización de venta con roles reales de L&A Suite QA.
create or replace function private.pm07_puede_vender()
returns boolean
language sql
stable security definer
set search_path='public','auth','private','pg_temp'
as $$
  select private.la_usuario_activo()
     and coalesce(private.la_rol(),'') in ('Propietario','Encargado','Cajero/a','Camarero/a','Churrero/a');
$$;
