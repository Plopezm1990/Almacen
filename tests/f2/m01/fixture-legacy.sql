\set ON_ERROR_STOP on

create extension if not exists pgcrypto;
create schema if not exists auth;
create schema if not exists private;

do $$
begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;

create table auth.users (
  id uuid primary key
);

create table public.empresas (
  id text primary key,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  datos jsonb not null default '{}'::jsonb
);

create table public.locales (
  id text primary key,
  empresa_id text not null references public.empresas(id),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  datos jsonb not null default '{}'::jsonb
);

create table private.g1_operation_ids_global (
  operation_id text primary key,
  ledger text not null,
  created_at timestamptz not null default now()
);

create or replace function private.g1_claim_operation_id()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_ledger text;
begin
  if new.operation_id is null or btrim(new.operation_id)='' then
    raise exception 'operation_id_requerido';
  end if;
  insert into private.g1_operation_ids_global(operation_id,ledger)
  values(new.operation_id,tg_table_name)
  on conflict(operation_id) do nothing;
  select g.ledger into v_ledger
    from private.g1_operation_ids_global g
   where g.operation_id=new.operation_id;
  if v_ledger is distinct from tg_table_name then
    raise exception 'operation_id_conflict';
  end if;
  return new;
end $$;

create or replace function private.la_tiene_local(p_empresa text,p_local text)
returns boolean language sql stable security definer set search_path=''
as $$
  select p_empresa = current_setting('app.test_empresa',true)
     and p_local = current_setting('app.test_local',true)
$$;

grant usage on schema private to authenticated;
grant execute on function private.la_tiene_local(text,text) to authenticated;

create table public.caja_operaciones (
  operation_id text primary key,
  tipo text not null check (tipo in ('ENTRADA','RETIRADA','REEMBOLSO','REVERSO_ENTRADA','REVERSO_RETIRADA')),
  empresa_id text not null,
  local_id text not null,
  fecha date not null,
  importe numeric not null check (importe > 0),
  efecto_efectivo numeric not null,
  medio_pago text not null check (medio_pago in ('EFECTIVO','TARJETA','TRANSFERENCIA','OTRO')),
  concepto text not null,
  origen_tipo text not null,
  origen_id text,
  ref_operation_id text references public.caja_operaciones(operation_id) on delete restrict,
  payload jsonb not null,
  actor_user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint pm08_caja_operation_id_formato
    check (operation_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$'),
  constraint pm08_caja_concepto_requerido check (btrim(concepto)<>''),
  constraint pm08_caja_efecto_consistente check (
    (tipo='ENTRADA' and efecto_efectivo=importe and medio_pago='EFECTIVO')
    or (tipo='RETIRADA' and efecto_efectivo=-importe and medio_pago='EFECTIVO')
    or (tipo='REEMBOLSO' and efecto_efectivo=case when medio_pago='EFECTIVO' then -importe else 0 end)
    or (tipo='REVERSO_ENTRADA' and efecto_efectivo=-importe and medio_pago='EFECTIVO' and ref_operation_id is not null)
    or (tipo='REVERSO_RETIRADA' and efecto_efectivo=importe and medio_pago='EFECTIVO' and ref_operation_id is not null)
  )
);

create trigger g1_operation_id_global
before insert on public.caja_operaciones
for each row execute function private.g1_claim_operation_id();
