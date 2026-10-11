-- ABC F2 M02B — checkout, pagos, reservas de saldo y reembolsos.
-- Aditiva. Sin activar cobros reales, sin proveedores externos y sin modificar ledgers legacy.
-- Depende de F2 M01/M01b + M02A ya presentes.

do $$
begin
  if to_regclass('public.abc_operaciones') is null
     or to_regclass('public.efectos_pendientes') is null
     or to_regclass('public.cuentas_comerciales') is null
     or to_regclass('public.ventas_fiscales') is null
     or to_regprocedure('private.la_tiene_local(text,text)') is null then
    raise exception 'ABC_F2_M02B_PREFLIGHT_FALLO: dependencias base ausentes';
  end if;

  if to_regclass('public.checkouts') is not null
     or to_regclass('public.checkout_ventas') is not null
     or to_regclass('public.pagos') is not null
     or to_regclass('public.pago_intentos') is not null
     or to_regclass('public.reservas_saldo') is not null
     or to_regclass('public.pago_aplicaciones') is not null
     or to_regclass('public.reembolsos') is not null
     or to_regclass('public.reembolso_aplicaciones') is not null then
    raise exception 'ABC_F2_M02B_PREFLIGHT_FALLO: objetos M02B ya existen';
  end if;
end $$;

-- M02A ya garantiza identidad tenant-aware de la venta. Este índice añade moneda
-- a la clave referenciable para checkout_ventas sin modificar datos.
create unique index if not exists abc_venta_scope_id_currency_uq
  on public.ventas_fiscales(empresa_id,local_id,id,currency_code);

create table public.checkouts (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  cuenta_id uuid not null,
  currency_code text not null,
  estado text not null default 'ABIERTO',
  version bigint not null default 1,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  operating_day date not null,
  completed_at timestamptz,
  cancelled_at timestamptz,
  constraint abc_checkout_moneda check (currency_code ~ '^[A-Z]{3}$'),
  constraint abc_checkout_estado check (
    estado in ('ABIERTO','EN_COBRO','COMPLETADO','CANCELADO')
  ),
  constraint abc_checkout_version check (version >= 1),
  constraint abc_checkout_tiempos check (
    (estado='COMPLETADO' and completed_at is not null and cancelled_at is null)
    or
    (estado='CANCELADO' and cancelled_at is not null and completed_at is null)
    or
    (estado in ('ABIERTO','EN_COBRO') and completed_at is null and cancelled_at is null)
  ),
  constraint abc_checkout_cuenta_fk
    foreign key (empresa_id,local_id,cuenta_id,currency_code)
    references public.cuentas_comerciales(empresa_id,local_id,id,currency_code)
    on delete restrict
);
create unique index abc_checkout_scope_id_uq
  on public.checkouts(empresa_id,local_id,id);
create unique index abc_checkout_scope_id_currency_uq
  on public.checkouts(empresa_id,local_id,id,currency_code);
create index abc_checkout_cuenta_estado_idx
  on public.checkouts(empresa_id,local_id,cuenta_id,estado,created_at desc);

create table public.checkout_ventas (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  checkout_id uuid not null,
  venta_fiscal_id uuid not null,
  currency_code text not null,
  importe_objetivo numeric(24,8) not null,
  created_at timestamptz not null default now(),
  constraint abc_checkout_venta_moneda check (currency_code ~ '^[A-Z]{3}$'),
  constraint abc_checkout_venta_importe check (importe_objetivo > 0),
  constraint abc_checkout_venta_checkout_fk
    foreign key (empresa_id,local_id,checkout_id,currency_code)
    references public.checkouts(empresa_id,local_id,id,currency_code)
    on delete restrict,
  constraint abc_checkout_venta_venta_fk
    foreign key (empresa_id,local_id,venta_fiscal_id,currency_code)
    references public.ventas_fiscales(empresa_id,local_id,id,currency_code)
    on delete restrict,
  constraint abc_checkout_venta_unica
    unique (empresa_id,local_id,checkout_id,venta_fiscal_id)
);
create unique index abc_checkout_venta_scope_id_uq
  on public.checkout_ventas(empresa_id,local_id,id);
create unique index abc_checkout_venta_scope_sale_currency_uq
  on public.checkout_ventas(
    empresa_id,local_id,id,venta_fiscal_id,currency_code
  );
create index abc_checkout_venta_venta_idx
  on public.checkout_ventas(empresa_id,local_id,venta_fiscal_id,created_at);

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  checkout_id uuid not null,
  medio text not null,
  estado text not null default 'PENDIENTE',
  sale_currency_code text not null,
  payment_currency_code text not null,
  importe_objetivo numeric(24,8) not null,
  importe_recibido numeric(24,8),
  cambio_entregado numeric(24,8),
  version bigint not null default 1,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint abc_pago_medio check (
    medio in ('EFECTIVO','TARJETA','TRANSFERENCIA','OTRO')
  ),
  constraint abc_pago_estado check (
    estado in (
      'PENDIENTE','AUTORIZADO','CONFIRMADO','RECHAZADO',
      'CANCELADO','DESCONOCIDO','REEMBOLSADO'
    )
  ),
  constraint abc_pago_sale_moneda check (sale_currency_code ~ '^[A-Z]{3}$'),
  constraint abc_pago_payment_moneda check (payment_currency_code ~ '^[A-Z]{3}$'),
  constraint abc_pago_importe check (importe_objetivo > 0),
  constraint abc_pago_version check (version >= 1),
  constraint abc_pago_efectivo check (
    (
      medio='EFECTIVO'
      and importe_recibido is not null
      and cambio_entregado is not null
      and importe_recibido >= importe_objetivo
      and cambio_entregado >= 0
      and importe_recibido - cambio_entregado = importe_objetivo
    )
    or
    (
      medio<>'EFECTIVO'
      and importe_recibido is null
      and cambio_entregado is null
    )
  ),
  constraint abc_pago_resolucion check (
    (estado in ('CONFIRMADO','RECHAZADO','CANCELADO','REEMBOLSADO') and resolved_at is not null)
    or
    (estado in ('PENDIENTE','AUTORIZADO','DESCONOCIDO') and resolved_at is null)
  ),
  constraint abc_pago_checkout_fk
    foreign key (empresa_id,local_id,checkout_id,sale_currency_code)
    references public.checkouts(empresa_id,local_id,id,currency_code)
    on delete restrict
);
create unique index abc_pago_scope_id_uq
  on public.pagos(empresa_id,local_id,id);
create unique index abc_pago_scope_payment_currency_uq
  on public.pagos(empresa_id,local_id,id,payment_currency_code);
create unique index abc_pago_scope_currencies_uq
  on public.pagos(
    empresa_id,local_id,id,payment_currency_code,sale_currency_code
  );
create index abc_pago_checkout_estado_idx
  on public.pagos(empresa_id,local_id,checkout_id,estado,created_at);

create table public.pago_intentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  pago_id uuid not null,
  abc_command_id text not null,
  estado text not null default 'PENDIENTE',
  provider_code text,
  provider_reference text,
  requested_amount numeric(24,8) not null,
  payment_currency_code text not null,
  authorized_amount numeric(24,8),
  captured_amount numeric(24,8),
  settled_amount numeric(24,8),
  authorization_status text not null default 'PENDIENTE',
  capture_status text not null default 'PENDIENTE',
  settlement_status text not null default 'PENDIENTE',
  provider_snapshot jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint abc_intento_estado check (
    estado in (
      'PENDIENTE','AUTORIZADO','CONFIRMADO',
      'RECHAZADO','CANCELADO','DESCONOCIDO'
    )
  ),
  constraint abc_intento_provider check (
    (provider_code is null and provider_reference is null)
    or nullif(btrim(provider_code),'') is not null
  ),
  constraint abc_intento_importe check (
    requested_amount > 0
    and (authorized_amount is null or (authorized_amount >= 0 and authorized_amount <= requested_amount))
    and (captured_amount is null or (captured_amount >= 0 and captured_amount <= requested_amount))
    and (
      settled_amount is null
      or (
        settled_amount >= 0
        and captured_amount is not null
        and settled_amount <= captured_amount
      )
    )
  ),
  constraint abc_intento_moneda check (payment_currency_code ~ '^[A-Z]{3}$'),
  constraint abc_intento_authorization_status check (
    authorization_status in (
      'NO_APLICA','PENDIENTE','AUTORIZADO',
      'RECHAZADO','CANCELADO','DESCONOCIDO'
    )
  ),
  constraint abc_intento_capture_status check (
    capture_status in (
      'NO_APLICA','PENDIENTE','CONFIRMADO',
      'RECHAZADO','CANCELADO','DESCONOCIDO'
    )
  ),
  constraint abc_intento_settlement_status check (
    settlement_status in (
      'NO_APLICA','PENDIENTE','LIQUIDADO',
      'RECHAZADO','CANCELADO','DESCONOCIDO'
    )
  ),
  constraint abc_intento_resolucion check (
    (estado in ('CONFIRMADO','RECHAZADO','CANCELADO') and resolved_at is not null)
    or
    (estado in ('PENDIENTE','AUTORIZADO','DESCONOCIDO') and resolved_at is null)
  ),
  constraint abc_intento_pago_fk
    foreign key (empresa_id,local_id,pago_id,payment_currency_code)
    references public.pagos(empresa_id,local_id,id,payment_currency_code)
    on delete restrict,
  constraint abc_intento_command_fk
    foreign key (empresa_id,local_id,abc_command_id)
    references public.abc_operaciones(empresa_id,local_id,operation_id)
    on delete restrict,
  constraint abc_intento_command_unico unique (abc_command_id)
);
create unique index abc_intento_scope_id_uq
  on public.pago_intentos(empresa_id,local_id,id);
create unique index abc_intento_scope_pago_id_currency_uq
  on public.pago_intentos(
    empresa_id,local_id,pago_id,id,payment_currency_code
  );
create unique index abc_intento_provider_reference_uq
  on public.pago_intentos(empresa_id,provider_code,provider_reference)
  where provider_code is not null and provider_reference is not null;
create index abc_intento_pago_estado_idx
  on public.pago_intentos(empresa_id,local_id,pago_id,estado,started_at desc);

create table public.reservas_saldo (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  intento_id uuid not null,
  checkout_venta_id uuid not null,
  venta_fiscal_id uuid not null,
  sale_currency_code text not null,
  importe_reservado numeric(24,8) not null,
  estado text not null default 'ACTIVA',
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  released_at timestamptz,
  constraint abc_reserva_moneda check (sale_currency_code ~ '^[A-Z]{3}$'),
  constraint abc_reserva_importe check (importe_reservado > 0),
  constraint abc_reserva_estado check (
    estado in ('ACTIVA','CONSUMIDA','LIBERADA')
  ),
  constraint abc_reserva_tiempos check (
    (estado='ACTIVA' and consumed_at is null and released_at is null)
    or
    (estado='CONSUMIDA' and consumed_at is not null and released_at is null)
    or
    (estado='LIBERADA' and released_at is not null and consumed_at is null)
  ),
  constraint abc_reserva_intento_fk
    foreign key (empresa_id,local_id,intento_id)
    references public.pago_intentos(empresa_id,local_id,id)
    on delete restrict,
  constraint abc_reserva_checkout_venta_fk
    foreign key (
      empresa_id,local_id,checkout_venta_id,venta_fiscal_id,sale_currency_code
    )
    references public.checkout_ventas(
      empresa_id,local_id,id,venta_fiscal_id,currency_code
    ) on delete restrict,
  constraint abc_reserva_intento_venta_unica
    unique (empresa_id,local_id,intento_id,checkout_venta_id)
);
create unique index abc_reserva_scope_id_uq
  on public.reservas_saldo(empresa_id,local_id,id);
create index abc_reserva_venta_activa_idx
  on public.reservas_saldo(
    empresa_id,local_id,venta_fiscal_id,sale_currency_code,created_at
  ) where estado='ACTIVA';

create table public.pago_aplicaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  pago_id uuid not null,
  intento_id uuid not null,
  checkout_venta_id uuid not null,
  venta_fiscal_id uuid not null,
  payment_amount numeric(24,8) not null,
  payment_currency_code text not null,
  sale_amount numeric(24,8) not null,
  sale_currency_code text not null,
  fx_snapshot jsonb not null default '{}'::jsonb,
  confirmed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint abc_aplicacion_payment_amount check (payment_amount > 0),
  constraint abc_aplicacion_sale_amount check (sale_amount > 0),
  constraint abc_aplicacion_payment_moneda check (
    payment_currency_code ~ '^[A-Z]{3}$'
  ),
  constraint abc_aplicacion_sale_moneda check (
    sale_currency_code ~ '^[A-Z]{3}$'
  ),
  constraint abc_aplicacion_pago_fk
    foreign key (
      empresa_id,local_id,pago_id,payment_currency_code,sale_currency_code
    )
    references public.pagos(
      empresa_id,local_id,id,payment_currency_code,sale_currency_code
    ) on delete restrict,
  constraint abc_aplicacion_intento_fk
    foreign key (
      empresa_id,local_id,pago_id,intento_id,payment_currency_code
    )
    references public.pago_intentos(
      empresa_id,local_id,pago_id,id,payment_currency_code
    ) on delete restrict,
  constraint abc_aplicacion_checkout_venta_fk
    foreign key (
      empresa_id,local_id,checkout_venta_id,venta_fiscal_id,sale_currency_code
    )
    references public.checkout_ventas(
      empresa_id,local_id,id,venta_fiscal_id,currency_code
    ) on delete restrict,
  constraint abc_aplicacion_intento_venta_unica
    unique (empresa_id,local_id,intento_id,checkout_venta_id)
);
create unique index abc_aplicacion_scope_id_uq
  on public.pago_aplicaciones(empresa_id,local_id,id);
create unique index abc_aplicacion_scope_refund_uq
  on public.pago_aplicaciones(
    empresa_id,local_id,id,venta_fiscal_id,payment_currency_code,sale_currency_code
  );
create index abc_aplicacion_venta_idx
  on public.pago_aplicaciones(
    empresa_id,local_id,venta_fiscal_id,sale_currency_code,confirmed_at
  );

create table public.reembolsos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  pago_id uuid not null,
  abc_command_id text not null,
  estado text not null default 'PENDIENTE',
  payment_currency_code text not null,
  importe_solicitado numeric(24,8) not null,
  provider_code text,
  provider_reference text,
  motivo text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint abc_reembolso_estado check (
    estado in ('PENDIENTE','CONFIRMADO','RECHAZADO','CANCELADO','DESCONOCIDO')
  ),
  constraint abc_reembolso_moneda check (
    payment_currency_code ~ '^[A-Z]{3}$'
  ),
  constraint abc_reembolso_importe check (importe_solicitado > 0),
  constraint abc_reembolso_motivo check (
    nullif(btrim(motivo),'') is not null
  ),
  constraint abc_reembolso_provider check (
    (provider_code is null and provider_reference is null)
    or nullif(btrim(provider_code),'') is not null
  ),
  constraint abc_reembolso_resolucion check (
    (estado in ('CONFIRMADO','RECHAZADO','CANCELADO') and resolved_at is not null)
    or
    (estado in ('PENDIENTE','DESCONOCIDO') and resolved_at is null)
  ),
  constraint abc_reembolso_pago_fk
    foreign key (empresa_id,local_id,pago_id,payment_currency_code)
    references public.pagos(empresa_id,local_id,id,payment_currency_code)
    on delete restrict,
  constraint abc_reembolso_command_fk
    foreign key (empresa_id,local_id,abc_command_id)
    references public.abc_operaciones(empresa_id,local_id,operation_id)
    on delete restrict,
  constraint abc_reembolso_command_unico unique (abc_command_id)
);
create unique index abc_reembolso_scope_id_uq
  on public.reembolsos(empresa_id,local_id,id);
create unique index abc_reembolso_scope_payment_currency_uq
  on public.reembolsos(empresa_id,local_id,id,payment_currency_code);
create unique index abc_reembolso_provider_reference_uq
  on public.reembolsos(empresa_id,provider_code,provider_reference)
  where provider_code is not null and provider_reference is not null;
create index abc_reembolso_pago_estado_idx
  on public.reembolsos(empresa_id,local_id,pago_id,estado,created_at desc);

create table public.reembolso_aplicaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  reembolso_id uuid not null,
  pago_aplicacion_id uuid not null,
  venta_fiscal_id uuid not null,
  importe_venta numeric(24,8) not null,
  sale_currency_code text not null,
  importe_pago numeric(24,8) not null,
  payment_currency_code text not null,
  created_at timestamptz not null default now(),
  constraint abc_reembolso_aplicacion_importes check (
    importe_venta > 0 and importe_pago > 0
  ),
  constraint abc_reembolso_aplicacion_sale_moneda check (
    sale_currency_code ~ '^[A-Z]{3}$'
  ),
  constraint abc_reembolso_aplicacion_payment_moneda check (
    payment_currency_code ~ '^[A-Z]{3}$'
  ),
  constraint abc_reembolso_aplicacion_reembolso_fk
    foreign key (
      empresa_id,local_id,reembolso_id,payment_currency_code
    )
    references public.reembolsos(
      empresa_id,local_id,id,payment_currency_code
    ) on delete restrict,
  constraint abc_reembolso_aplicacion_pago_fk
    foreign key (
      empresa_id,local_id,pago_aplicacion_id,venta_fiscal_id,
      payment_currency_code,sale_currency_code
    )
    references public.pago_aplicaciones(
      empresa_id,local_id,id,venta_fiscal_id,
      payment_currency_code,sale_currency_code
    ) on delete restrict,
  constraint abc_reembolso_aplicacion_source_unica
    unique (empresa_id,local_id,reembolso_id,pago_aplicacion_id)
);
create unique index abc_reembolso_aplicacion_scope_id_uq
  on public.reembolso_aplicaciones(empresa_id,local_id,id);
create index abc_reembolso_aplicacion_venta_idx
  on public.reembolso_aplicaciones(
    empresa_id,local_id,venta_fiscal_id,created_at
  );

alter table public.checkouts enable row level security;
alter table public.checkout_ventas enable row level security;
alter table public.pagos enable row level security;
alter table public.pago_intentos enable row level security;
alter table public.reservas_saldo enable row level security;
alter table public.pago_aplicaciones enable row level security;
alter table public.reembolsos enable row level security;
alter table public.reembolso_aplicaciones enable row level security;

create policy abc_checkout_select on public.checkouts
  for select to authenticated using (private.la_tiene_local(empresa_id,local_id));
create policy abc_checkout_venta_select on public.checkout_ventas
  for select to authenticated using (private.la_tiene_local(empresa_id,local_id));
create policy abc_pago_select on public.pagos
  for select to authenticated using (private.la_tiene_local(empresa_id,local_id));
create policy abc_intento_select on public.pago_intentos
  for select to authenticated using (private.la_tiene_local(empresa_id,local_id));
create policy abc_reserva_select on public.reservas_saldo
  for select to authenticated using (private.la_tiene_local(empresa_id,local_id));
create policy abc_aplicacion_select on public.pago_aplicaciones
  for select to authenticated using (private.la_tiene_local(empresa_id,local_id));
create policy abc_reembolso_select on public.reembolsos
  for select to authenticated using (private.la_tiene_local(empresa_id,local_id));
create policy abc_reembolso_aplicacion_select on public.reembolso_aplicaciones
  for select to authenticated using (private.la_tiene_local(empresa_id,local_id));

revoke all privileges
on table
  public.checkouts,
  public.checkout_ventas,
  public.pagos,
  public.pago_intentos,
  public.reservas_saldo,
  public.pago_aplicaciones,
  public.reembolsos,
  public.reembolso_aplicaciones
from anon, authenticated;

grant select
on table
  public.checkouts,
  public.checkout_ventas,
  public.pagos,
  public.reembolsos
to authenticated;
