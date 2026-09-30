-- ABC F4 B06 / subpunto 2 — trazabilidad del anticipo.
--
-- Cada aplicación o devolución queda como un movimiento inmutable relacionado
-- con el anticipo original. El límite acumulado del importe se resolverá en la
-- RPC del siguiente subpunto; esta migración fija ya la relación y el destino.

do $$
begin
  if to_regclass('public.abc_cobros_no_venta') is null
     or to_regclass('public.abc_operaciones') is null
     or to_regclass('public.ventas_fiscales') is null
     or to_regclass('public.caja_operaciones') is null then
    raise exception 'ABC_F4_B06_TRACE_PREFLIGHT_FALLO: dependencias ausentes';
  end if;
  if to_regprocedure('private.la_tiene_local(text,text)') is null then
    raise exception 'ABC_F4_B06_TRACE_PREFLIGHT_FALLO: falta la_tiene_local';
  end if;
  if to_regclass('public.abc_anticipo_movimientos') is not null then
    raise exception 'ABC_F4_B06_TRACE_PREFLIGHT_FALLO: tabla ya existe';
  end if;
end $$;

create unique index abc_cobros_no_venta_scope_id_uq
  on public.abc_cobros_no_venta(empresa_id,local_id,id);

create table public.abc_anticipo_movimientos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  abc_command_id text not null,
  anticipo_id uuid not null,
  movimiento text not null,
  importe numeric(24,8) not null,
  currency_code text not null,
  venta_fiscal_id uuid,
  caja_operation_id text,
  motivo text,
  responsable_user_id uuid not null references auth.users(id) on delete restrict,
  datos jsonb not null default '{}'::jsonb,
  operating_day date not null,
  occurred_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint abc_anticipo_movimiento_tipo check (
    movimiento in ('APLICACION','DEVOLUCION')
  ),
  constraint abc_anticipo_movimiento_importe check (importe > 0),
  constraint abc_anticipo_movimiento_moneda check (currency_code ~ '^[A-Z]{3}$'),
  constraint abc_anticipo_movimiento_destino check (
    (
      movimiento='APLICACION'
      and venta_fiscal_id is not null
      and caja_operation_id is null
    )
    or
    (
      movimiento='DEVOLUCION'
      and venta_fiscal_id is null
      and caja_operation_id is not null
      and nullif(btrim(motivo),'') is not null
    )
  ),
  constraint abc_anticipo_movimiento_scope_fk
    foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint abc_anticipo_movimiento_command_fk
    foreign key (empresa_id,local_id,abc_command_id)
    references public.abc_operaciones(empresa_id,local_id,operation_id)
    on delete restrict,
  constraint abc_anticipo_movimiento_source_fk
    foreign key (empresa_id,local_id,anticipo_id)
    references public.abc_cobros_no_venta(empresa_id,local_id,id)
    on delete restrict,
  constraint abc_anticipo_movimiento_venta_fk
    foreign key (empresa_id,local_id,venta_fiscal_id,currency_code)
    references public.ventas_fiscales(empresa_id,local_id,id,currency_code)
    on delete restrict,
  constraint abc_anticipo_movimiento_command_uq
    unique (abc_command_id)
);

alter table public.abc_anticipo_movimientos enable row level security;

create policy abc_anticipo_movimientos_select on public.abc_anticipo_movimientos
  for select to authenticated
  using (private.la_tiene_local(empresa_id,local_id));

revoke all on public.abc_anticipo_movimientos from public, anon, authenticated;
grant select on public.abc_anticipo_movimientos to authenticated;

create index abc_anticipo_movimientos_source_idx
  on public.abc_anticipo_movimientos(empresa_id,local_id,anticipo_id,occurred_at);
create index abc_anticipo_movimientos_target_idx
  on public.abc_anticipo_movimientos(empresa_id,local_id,venta_fiscal_id,occurred_at)
  where movimiento='APLICACION';
create index abc_anticipo_movimientos_refund_idx
  on public.abc_anticipo_movimientos(empresa_id,local_id,caja_operation_id,occurred_at)
  where movimiento='DEVOLUCION';

create or replace function private.abc_b06_validar_anticipo_movimiento()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
declare
  v_concepto text;
  v_moneda text;
begin
  select concepto,currency_code
    into v_concepto,v_moneda
    from public.abc_cobros_no_venta
   where empresa_id=new.empresa_id
     and local_id=new.local_id
     and id=new.anticipo_id;

  if v_concepto is distinct from 'ANTICIPO' then
    raise exception 'b06_fuente_no_es_anticipo';
  end if;
  if v_moneda is distinct from new.currency_code then
    raise exception 'b06_moneda_anticipo_incompatible';
  end if;
  if new.caja_operation_id is not null
     and not exists (
       select 1 from public.caja_operaciones
        where operation_id=new.caja_operation_id
          and empresa_id=new.empresa_id
          and local_id=new.local_id
     ) then
    raise exception 'b06_devolucion_caja_fuera_contexto';
  end if;
  return new;
end;
$$;

revoke all on function private.abc_b06_validar_anticipo_movimiento() from public, anon, authenticated;

create trigger abc_b06_anticipo_movimiento_guard
before insert or update on public.abc_anticipo_movimientos
for each row execute function private.abc_b06_validar_anticipo_movimiento();

comment on table public.abc_anticipo_movimientos is
  'B06: relación inmutable de cada anticipo con una aplicación a venta o una devolución a caja.';
comment on column public.abc_anticipo_movimientos.importe is
  'Importe del movimiento del anticipo; el saldo disponible se valida en la RPC B06 posterior.';
