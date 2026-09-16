\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;

create function public.descontar_stock_carrito(p_lineas jsonb, p_venta_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return jsonb_build_object('ok', true, 'ventaId', p_venta_id, 'lineas', p_lineas);
end
$$;

create function public.anular_venta_tpv(p_venta_id text, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return jsonb_build_object('ok', true, 'ventaId', p_venta_id, 'motivo', p_motivo);
end
$$;

-- Control no objetivo: debe conservar su ACL authenticated.
create function public.obtener_contexto_operativo()
returns jsonb
language sql
security definer
set search_path = public
as $$ select '{"ok":true}'::jsonb $$;

revoke all on function public.descontar_stock_carrito(jsonb,text) from public, anon, authenticated;
revoke all on function public.anular_venta_tpv(text,text) from public, anon, authenticated;
revoke all on function public.obtener_contexto_operativo() from public, anon, authenticated;
grant execute on function public.descontar_stock_carrito(jsonb,text) to authenticated;
grant execute on function public.anular_venta_tpv(text,text) to authenticated;
grant execute on function public.obtener_contexto_operativo() to authenticated;

\i supabase/migrations/20260916054000_p2_r02_revocar_exec_rpcs_legacy.sql

do $p2_r02_acl_smoke$
declare
  r regprocedure;
begin
  foreach r in array array[
    'public.descontar_stock_carrito(jsonb,text)'::regprocedure,
    'public.anular_venta_tpv(text,text)'::regprocedure
  ] loop
    if has_function_privilege('authenticated', r, 'EXECUTE') then
      raise exception 'P2-R02 ACL_FALLO: authenticated conserva EXECUTE sobre %', r;
    end if;
    -- anon es un rol limpio en este PostgreSQL efimero: si PUBLIC conservara
    -- EXECUTE, anon lo heredaria y esta comprobacion fallaria.
    if has_function_privilege('anon', r, 'EXECUTE') then
      raise exception 'P2-R02 ACL_FALLO: anon/PUBLIC conserva EXECUTE sobre %', r;
    end if;
    if not exists (select 1 from pg_proc p where p.oid = r::oid and p.prosecdef) then
      raise exception 'P2-R02 ACL_FALLO: % dejo de ser SECURITY DEFINER', r;
    end if;
  end loop;

  r := 'public.obtener_contexto_operativo()'::regprocedure;
  if not has_function_privilege('authenticated', r, 'EXECUTE') then
    raise exception 'P2-R02 SCOPE_FALLO: obtener_contexto_operativo perdio EXECUTE authenticated';
  end if;
  if has_function_privilege('anon', r, 'EXECUTE') then
    raise exception 'P2-R02 SCOPE_FALLO: obtener_contexto_operativo gano EXECUTE anon/PUBLIC';
  end if;

  raise notice 'P2_R02_ACL_SMOKE=PASS';
end
$p2_r02_acl_smoke$;
