-- ABC P3c · reintento seguro para cambios automáticos de stock/contexto.
--
-- La lista heredada puede conservar diferencias automáticas de stock, empresa o
-- local después de una venta o de la hidratación inicial. Si no hay ningún
-- cambio comercial, esas diferencias no deben entrar en la fusión de edición
-- humana ni dejar la cola bloqueada. Los cambios de nombre, precio, IVA,
-- unidad, activo o tipo siguen pasando por la RPC P3c histórica.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if to_regprocedure('public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb)') is null then
    raise exception 'ABC_P3C_FAST_PREFLIGHT:falta_rpc_lista_legacy';
  end if;
  if to_regprocedure('private.plataforma_kv_permitido(text,text,text,text)') is null then
    raise exception 'ABC_P3C_FAST_PREFLIGHT:falta_autorizador_kv';
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
  v_base_operativa jsonb;
  v_nuevo_operativa jsonb;
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

  -- La vía rápida solo se permite si no hay intención comercial y las listas
  -- son iguales después de quitar campos derivados/contextuales. Así no puede
  -- tragarse un cambio humano de precio, nombre, IVA, unidad, activo o tipo.
  select coalesce(jsonb_agg(
    e - array[
      'stock', 'stockPisoVenta', 'stockMinimo', 'stockMinimoPisoVenta',
      '_pm07BajoMinimo', '_pm07Servidor', '_pm07LocalOperable',
      'deficitPendiente', 'empresaId', 'localId'
    ]::text[] order by e->>'id'
  ), '[]'::jsonb)
    into v_base_operativa
    from jsonb_array_elements(coalesce(p_base, '[]'::jsonb)) e;

  select coalesce(jsonb_agg(
    e - array[
      'stock', 'stockPisoVenta', 'stockMinimo', 'stockMinimoPisoVenta',
      '_pm07BajoMinimo', '_pm07Servidor', '_pm07LocalOperable',
      'deficitPendiente', 'empresaId', 'localId'
    ]::text[] order by e->>'id'
  ), '[]'::jsonb)
    into v_nuevo_operativa
    from jsonb_array_elements(coalesce(p_nuevo, '[]'::jsonb)) e;

  if coalesce(p_venta, '[]'::jsonb) = '[]'::jsonb
     and v_base_operativa is not distinct from v_nuevo_operativa then
    return jsonb_build_object(
      'ok', true,
      'venta_cambiada', 0,
      'productos_cambiados', 0,
      'lista_confirmada', v_actual,
      'catalogo_ya_sincronizado', true,
      'catalogo_pendiente_contexto_fiscal', false
    );
  end if;

  -- Para cualquier edición que no sea solo operativa se conserva la misma
  -- normalización de stock de la ventana anterior y la fusión P3c existente.
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
    raise exception 'ABC_P3C_FAST_POSTFLIGHT:falta_rpc_contextual';
  end if;
  if not has_function_privilege(
    'authenticated',
    'public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb,text,text)',
    'EXECUTE'
  ) then
    raise exception 'ABC_P3C_FAST_POSTFLIGHT:sin_execute_authenticated';
  end if;
end
$postflight$;

select pg_notify('pgrst', 'reload schema');

commit;
