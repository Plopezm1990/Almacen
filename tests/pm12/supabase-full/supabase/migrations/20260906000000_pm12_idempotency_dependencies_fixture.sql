-- Test-only fixture reproducing the existing PM08/PM09/G1 idempotency boundary.
create or replace function private.pm08_validar_operation_id(p_operation_id text) returns text
language plpgsql immutable set search_path='pg_catalog','pg_temp' as $$
declare v text:=btrim(coalesce(p_operation_id,'')); begin
  if v !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$' then raise exception 'operation_id_invalido'; end if;
  return v;
end; $$;
create or replace function private.pm08_bloquear_operation_id(p_operation_id text) returns text
language plpgsql security definer set search_path='pg_catalog','pg_temp' as $$
declare v text; begin
  v:=private.pm08_validar_operation_id(p_operation_id);
  perform pg_advisory_xact_lock(hashtextextended('la-suite-pm08:'||v,0));
  return v;
end; $$;
revoke all on function private.pm08_bloquear_operation_id(text) from public,anon,authenticated;

create or replace function private.pm09_bloquear_operation_id_stock(p_operation_id text) returns text
language plpgsql security definer set search_path='public','auth','private','pg_temp' as $$
declare v text; begin
  v:=private.pm08_validar_operation_id(p_operation_id);
  perform private.pm08_bloquear_operation_id(v);
  if exists(select 1 from public.caja_operaciones where operation_id=v)
    or exists(select 1 from public.arqueos_caja where operation_id=v)
    or exists(select 1 from public.arqueos_caja_anulaciones where operation_id=v)
  then raise exception 'operation_id_conflict'; end if;
  return v;
end; $$;

create table private.g1_operation_ids_global(
  operation_id text primary key, ledger text not null, created_at timestamptz not null default now()
);
revoke all on private.g1_operation_ids_global from public,anon,authenticated;
create or replace function private.g1_claim_operation_id() returns trigger
language plpgsql security definer set search_path='public','auth','private','pg_temp' as $$
declare v_ledger text; begin
  if new.operation_id is null or btrim(new.operation_id)='' then raise exception 'operation_id_requerido'; end if;
  insert into private.g1_operation_ids_global(operation_id,ledger) values(new.operation_id,tg_table_name)
    on conflict(operation_id) do nothing;
  select ledger into v_ledger from private.g1_operation_ids_global where operation_id=new.operation_id;
  if v_ledger is distinct from tg_table_name then raise exception 'operation_id_conflict'; end if;
  return new;
end; $$;
revoke all on function private.g1_claim_operation_id() from public,anon,authenticated;
create trigger g1_operation_id_global before insert on public.stock_operaciones
for each row execute function private.g1_claim_operation_id();
