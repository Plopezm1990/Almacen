-- ABC F4 B06 / subpunto 1 — frontera de cobros que no son venta.
--
-- Este ledger no sustituye a pagos_encargo: los anticipos de encargo existentes
-- siguen reutilizando ese contrato. La tabla deja preparada una frontera común
-- para propinas, anticipos y fianzas sin añadirlos al total de ventas_fiscales,
-- checkout_ventas ni pagos.
--
-- La escritura queda cerrada hasta que B06 autorice la RPC de alta/aplicación/
-- devolución. Así no se crea una segunda vía de mutación directa desde el cliente.

do $$
begin
  if to_regclass('public.abc_operaciones') is null then
    raise exception 'ABC_F4_B06_PREFLIGHT_FALLO: falta abc_operaciones';
  end if;
  if to_regprocedure('private.la_tiene_local(text,text)') is null then
    raise exception 'ABC_F4_B06_PREFLIGHT_FALLO: falta la_tiene_local';
  end if;
  if to_regclass('public.abc_cobros_no_venta') is not null then
    raise exception 'ABC_F4_B06_PREFLIGHT_FALLO: tabla ya existe';
  end if;
end $$;

create table public.abc_cobros_no_venta (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  abc_command_id text not null,
  concepto text not null,
  importe numeric(24,8) not null,
  currency_code text not null,
  medio text not null,
  encargo_id text,
  titular_id text,
  responsable_user_id uuid not null references auth.users(id) on delete restrict,
  datos jsonb not null default '{}'::jsonb,
  operating_day date not null,
  occurred_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint abc_cobro_no_venta_concepto check (
    concepto in ('PROPINA','ANTICIPO','FIANZA')
  ),
  constraint abc_cobro_no_venta_importe check (importe > 0),
  constraint abc_cobro_no_venta_moneda check (currency_code ~ '^[A-Z]{3}$'),
  constraint abc_cobro_no_venta_medio check (
    medio in ('EFECTIVO','TARJETA','TRANSFERENCIA','OTRO')
  ),
  constraint abc_cobro_no_venta_anticipo_encargo check (
    (concepto = 'ANTICIPO' and nullif(btrim(encargo_id),'') is not null)
    or
    (concepto <> 'ANTICIPO' and encargo_id is null)
  ),
  constraint abc_cobro_no_venta_fianza_titular check (
    concepto <> 'FIANZA'
    or nullif(btrim(titular_id),'') is not null
  ),
  constraint abc_cobro_no_venta_scope_fk
    foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint abc_cobro_no_venta_command_fk
    foreign key (empresa_id,local_id,abc_command_id)
    references public.abc_operaciones(empresa_id,local_id,operation_id)
    on delete restrict,
  constraint abc_cobro_no_venta_command_uq
    unique (abc_command_id)
);

comment on table public.abc_cobros_no_venta is
  'B06: propinas, anticipos y fianzas fuera del total de la venta ordinaria.';
comment on column public.abc_cobros_no_venta.concepto is
  'Clasificación económica no venta; nunca se interpreta como línea de venta.';
comment on column public.abc_cobros_no_venta.encargo_id is
  'Solo se informa para ANTICIPO; su aplicación o devolución se implementa en el siguiente subpunto B06.';

alter table public.abc_cobros_no_venta enable row level security;

create policy abc_cobros_no_venta_select on public.abc_cobros_no_venta
  for select to authenticated
  using (private.la_tiene_local(empresa_id,local_id));

revoke all on public.abc_cobros_no_venta from public, anon, authenticated;
grant select on public.abc_cobros_no_venta to authenticated;

create index abc_cobros_no_venta_scope_day_idx
  on public.abc_cobros_no_venta(empresa_id,local_id,operating_day,occurred_at desc);
create index abc_cobros_no_venta_concepto_idx
  on public.abc_cobros_no_venta(empresa_id,local_id,concepto,occurred_at desc);
