-- QA-only authenticated smoke helper. Install with execute_sql in QA and drop
-- it after the browser test. The final P0001 exception rolls back every write.

create or replace function private.pm09_qa_session_smoke_20261006()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_empresa text;
  v_local text;
  v_producto text;
  v_before numeric;
  v_after numeric;
  v_sale_id text;
  v_reverse_id text;
  v_fecha date := (pg_catalog.now() at time zone 'Europe/Madrid')::date;
  v_sale jsonb;
  v_reverse jsonb;
begin
  if v_uid is null then raise exception 'PM09_QA_SMOKE_AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from supabase_migrations.schema_migrations
    where name = 'abc_f5_pm09_security_hardening'
  ) then raise exception 'PM09_QA_SMOKE_NOT_QA'; end if;

  select s.empresa_id, s.local_id, s.producto_id, s.almacen + s.piso
    into v_empresa, v_local, v_producto, v_before
  from public.stock_ubicacion s
  join public.membresias_usuario m
    on m.user_id = v_uid
   and m.empresa_id = s.empresa_id
   and (m.todos_locales or m.local_id = s.local_id)
  where m.activo
    and m.rol in ('Propietario', 'Encargado')
    and s.local_operable
    and s.empresa_id like 'QA-%'
    and s.local_id like 'QA-%'
    and s.producto_id like 'QA-%'
    and s.almacen + s.piso >= 1
  order by s.empresa_id, s.local_id, s.producto_id
  limit 1
  for update of s;
  if not found then raise exception 'PM09_QA_SMOKE_NO_AUTHORIZED_FIXTURE'; end if;

  v_sale_id := 'PM09-QA-SESSION-' || pg_catalog.substr(
    pg_catalog.md5(v_uid::text || pg_catalog.clock_timestamp()::text || pg_catalog.random()::text), 1, 24
  );
  v_reverse_id := v_sale_id || '-REV';

  v_sale := public.registrar_venta_stock_pm09(
    v_sale_id, v_empresa, v_local, v_producto, 1, v_fecha,
    pg_catalog.jsonb_build_object('origen', 'PM09_QA_SESSION_SMOKE')
  );
  if v_sale->>'ok' <> 'true' or v_sale->>'replayed' <> 'false' then
    raise exception 'PM09_QA_SMOKE_SALE_FAILED';
  end if;
  select almacen + piso into v_after from public.stock_ubicacion
   where empresa_id = v_empresa and local_id = v_local and producto_id = v_producto;
  if v_after <> v_before - 1 then raise exception 'PM09_QA_SMOKE_SALE_STOCK_FAILED'; end if;

  v_reverse := public.revertir_venta_stock_pm09(
    v_reverse_id, v_sale_id, v_fecha, 'Humo autenticado QA'
  );
  if v_reverse->>'ok' <> 'true' or v_reverse->>'replayed' <> 'false' then
    raise exception 'PM09_QA_SMOKE_REVERSE_FAILED';
  end if;
  select almacen + piso into v_after from public.stock_ubicacion
   where empresa_id = v_empresa and local_id = v_local and producto_id = v_producto;
  if v_after <> v_before then raise exception 'PM09_QA_SMOKE_REVERSE_STOCK_FAILED'; end if;
  if (
    select pg_catalog.count(*) from public.movimientos_stock
    where operation_id in (v_sale_id, v_reverse_id)
      and datos->>'fechaOperacion' = v_fecha::text
  ) <> 2 then raise exception 'PM09_QA_SMOKE_DATE_FAILED'; end if;

  raise exception 'PM09_QA_SMOKE_PASS_ROLLBACK' using errcode = 'P0001';
end
$function$;

create or replace function public.pm09_qa_session_smoke_20261006()
returns void
language sql
security invoker
set search_path = ''
as $function$
  select private.pm09_qa_session_smoke_20261006()
$function$;

revoke all on function private.pm09_qa_session_smoke_20261006() from public, anon, authenticated, service_role;
revoke all on function public.pm09_qa_session_smoke_20261006() from public, anon, authenticated, service_role;
grant execute on function private.pm09_qa_session_smoke_20261006() to authenticated;
grant execute on function public.pm09_qa_session_smoke_20261006() to authenticated;
