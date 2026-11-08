-- ABC P3c · el stock lo gobierna el ledger, no la cola de productos.
--
-- Una venta cambia stock en stock_ubicacion y en la proyección local de
-- productos. Si la pestaña conserva una copia anterior y reintenta
-- abc_productos_guardar_lista, la RPC de concurrencia veía ese cambio legítimo
-- como una edición simultánea del campo stock y dejaba la cola bloqueada.
-- La ruta contextual normaliza únicamente los campos operativos de stock a la
-- versión actual del servidor antes de delegar en la fusión comercial P3c.
-- Los campos de nombre, precio, IVA, unidad, activo, tipo y local siguen
-- sujetos a la detección normal de conflictos.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure('public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb)') is null then
    raise exception 'ABC_P3C_STOCK_PREFLIGHT:falta_rpc_lista_legacy';
  end if;
  if to_regprocedure('private.plataforma_kv_permitido(text,text,text,text)') is null then
    raise exception 'ABC_P3C_STOCK_PREFLIGHT:falta_autorizador_kv';
  end if;
end
$preflight$;

create or replace function public.abc_productos_guardar_lista(
  p_operation_id text,
  p_base jsonb,
  p_nuevo jsonb,
  p_venta jsonb,
  p_empresa_id text,
  p_local_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_empresa text := nullif(btrim(p_empresa_id), '');
  v_local text := nullif(btrim(p_local_id), '');
  v_actual jsonb;
  v_base_normalizada jsonb;
  v_nuevo_normalizado jsonb;
begin
  if auth.uid() is null then
    raise exception 'abc_productos_no_autorizado' using errcode = '42501';
  end if;
  if v_empresa is null or v_local is null then
    raise exception 'abc_productos_contexto_requerido' using errcode = '42501';
  end if;
  if not private.plataforma_kv_permitido(v_empresa, v_local, 'productos', 'escribir') then
    raise exception 'abc_productos_no_autorizado' using errcode = '42501';
  end if;

  select k.value
    into v_actual
    from public.almacen_kv k
   where k.key = 'productos'
     and k.empresa_id = v_empresa
   for update;
  if not found or jsonb_typeof(v_actual) <> 'array' then
    raise exception 'abc_productos_lista_nube_ausente';
  end if;

  -- Stock, mínimos y marcas de proyección son datos derivados del ledger.
  -- Copiarlos desde la lista remota evita que una venta o recepción concurrente
  -- se interprete como edición manual. Se conserva el resto del JSON local.
  select coalesce(jsonb_agg(
    case when remoto.e is null then local_item.e
         else local_item.e || jsonb_build_object(
           'stock', remoto.e->'stock',
           'stockPisoVenta', remoto.e->'stockPisoVenta',
           'stockMinimo', remoto.e->'stockMinimo',
           'stockMinimoPisoVenta', remoto.e->'stockMinimoPisoVenta',
           '_pm07BajoMinimo', remoto.e->'_pm07BajoMinimo',
           '_pm07Servidor', remoto.e->'_pm07Servidor',
           '_pm07LocalOperable', remoto.e->'_pm07LocalOperable',
           'deficitPendiente', remoto.e->'deficitPendiente'
         )
    end order by local_item.ord
  ), '[]'::jsonb)
    into v_base_normalizada
    from jsonb_array_elements(coalesce(p_base, '[]'::jsonb))
         with ordinality as local_item(e, ord)
    left join lateral (
      select e
        from jsonb_array_elements(v_actual) e
       where e->>'id' = local_item.e->>'id'
       limit 1
    ) remoto on true;

  select coalesce(jsonb_agg(
    case when remoto.e is null then local_item.e
         else local_item.e || jsonb_build_object(
           'stock', remoto.e->'stock',
           'stockPisoVenta', remoto.e->'stockPisoVenta',
           'stockMinimo', remoto.e->'stockMinimo',
           'stockMinimoPisoVenta', remoto.e->'stockMinimoPisoVenta',
           '_pm07BajoMinimo', remoto.e->'_pm07BajoMinimo',
           '_pm07Servidor', remoto.e->'_pm07Servidor',
           '_pm07LocalOperable', remoto.e->'_pm07LocalOperable',
           'deficitPendiente', remoto.e->'deficitPendiente'
         )
    end order by local_item.ord
  ), '[]'::jsonb)
    into v_nuevo_normalizado
    from jsonb_array_elements(coalesce(p_nuevo, '[]'::jsonb))
         with ordinality as local_item(e, ord)
    left join lateral (
      select e
        from jsonb_array_elements(v_actual) e
       where e->>'id' = local_item.e->>'id'
       limit 1
    ) remoto on true;

  perform set_config('la.productos_empresa_contexto', v_empresa, true);
  return public.abc_productos_guardar_lista(
    p_operation_id,
    v_base_normalizada,
    v_nuevo_normalizado,
    coalesce(p_venta, '[]'::jsonb)
  );
end
$function$;

revoke all on function public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb,text,text)
  from public, anon, service_role;
grant execute on function public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb,text,text)
  to authenticated;

do $postflight$
begin
  if to_regprocedure('public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb,text,text)') is null then
    raise exception 'ABC_P3C_STOCK_POSTFLIGHT:falta_rpc_contextual';
  end if;
  if not has_function_privilege(
    'authenticated',
    'public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb,text,text)',
    'EXECUTE'
  ) then
    raise exception 'ABC_P3C_STOCK_POSTFLIGHT:sin_execute_authenticated';
  end if;
end
$postflight$;

select pg_notify('pgrst', 'reload schema');

commit;
