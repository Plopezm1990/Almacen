-- ABC F4 B09 / subpunto 1 — modelo de liquidaciones y disputas.
--
-- Esta migración solo crea el libro de conciliación. No importa datos, no
-- modifica pagos, no crea ventas y no produce movimientos de caja o stock.
-- La entrada autorizada y la resolución de incidencias se añadirán después.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if to_regclass('public.locales') is null
     or to_regclass('public.pagos') is null
     or to_regclass('public.pago_intentos') is null then
    raise exception 'ABC_F4_B09_PREFLIGHT_FALLO: faltan tablas de contexto o pagos';
  end if;
  if to_regclass('public.abc_b09_liquidaciones') is not null
     or to_regclass('public.abc_b09_liquidacion_lineas') is not null
     or to_regclass('public.abc_b09_disputas') is not null then
    raise exception 'ABC_F4_B09_PREFLIGHT_FALLO: objetos B09 ya existen';
  end if;
end $$;

create table public.abc_b09_liquidaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  provider_code text not null,
  provider_account_id text not null,
  settlement_reference text not null,
  currency_code text not null,
  periodo_desde date,
  periodo_hasta date,
  importe_vendido numeric(24,8) not null default 0,
  importe_cobrado numeric(24,8) not null default 0,
  importe_devuelto numeric(24,8) not null default 0,
  importe_comision numeric(24,8) not null default 0,
  importe_liquidado numeric(24,8) not null default 0,
  estado text not null default 'RECIBIDA',
  origen text not null default 'SIMULADOR',
  provider_snapshot jsonb not null default '{}'::jsonb,
  source_operation_id text,
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint abc_b09_liq_scope_fk
    foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint abc_b09_liq_provider_ck check (
    provider_code ~ '^[A-Z][A-Z0-9_]{1,63}$'
  ),
  constraint abc_b09_liq_account_ck check (
    char_length(btrim(provider_account_id)) between 1 and 240
  ),
  constraint abc_b09_liq_reference_ck check (
    char_length(btrim(settlement_reference)) between 1 and 240
  ),
  constraint abc_b09_liq_currency_ck check (currency_code ~ '^[A-Z]{3}$'),
  constraint abc_b09_liq_period_ck check (
    periodo_hasta is null or periodo_desde is null or periodo_hasta >= periodo_desde
  ),
  constraint abc_b09_liq_amounts_ck check (
    importe_vendido >= 0
    and importe_cobrado >= 0
    and importe_devuelto >= 0
    and importe_comision >= 0
    and importe_liquidado >= 0
    and importe_devuelto <= importe_cobrado
  ),
  constraint abc_b09_liq_state_ck check (
    estado in ('RECIBIDA','EN_CONCILIACION','CONCILIADA','CON_DISCREPANCIA','CERRADA','CANCELADA')
  ),
  constraint abc_b09_liq_origin_ck check (origen in ('SIMULADOR','PROVEEDOR','IMPORTACION_AUTORIZADA')),
  constraint abc_b09_liq_snapshot_ck check (jsonb_typeof(provider_snapshot) = 'object')
);

create unique index abc_b09_liq_business_key_uq
  on public.abc_b09_liquidaciones(
    empresa_id,local_id,provider_code,provider_account_id,settlement_reference,currency_code
  );
create unique index abc_b09_liq_scope_id_uq
  on public.abc_b09_liquidaciones(empresa_id,local_id,id);
create index abc_b09_liq_status_idx
  on public.abc_b09_liquidaciones(empresa_id,local_id,estado,created_at desc);

create table public.abc_b09_liquidacion_lineas (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  liquidacion_id uuid not null,
  provider_line_reference text not null,
  commercial_reference text,
  pago_id uuid,
  intento_id uuid,
  payment_currency_code text not null,
  importe_vendido numeric(24,8) not null default 0,
  importe_cobrado numeric(24,8) not null default 0,
  importe_devuelto numeric(24,8) not null default 0,
  importe_comision numeric(24,8) not null default 0,
  importe_liquidado numeric(24,8) not null default 0,
  estado text not null default 'RECIBIDA',
  provider_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint abc_b09_linea_scope_fk
    foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint abc_b09_linea_liq_fk
    foreign key (empresa_id,local_id,liquidacion_id)
    references public.abc_b09_liquidaciones(empresa_id,local_id,id) on delete restrict,
  constraint abc_b09_linea_pago_fk
    foreign key (empresa_id,local_id,pago_id,payment_currency_code)
    references public.pagos(empresa_id,local_id,id,payment_currency_code) on delete restrict,
  constraint abc_b09_linea_intento_fk
    foreign key (empresa_id,local_id,pago_id,intento_id,payment_currency_code)
    references public.pago_intentos(empresa_id,local_id,pago_id,id,payment_currency_code) on delete restrict,
  constraint abc_b09_linea_reference_ck check (
    char_length(btrim(provider_line_reference)) between 1 and 240
  ),
  constraint abc_b09_linea_currency_ck check (payment_currency_code ~ '^[A-Z]{3}$'),
  constraint abc_b09_linea_amounts_ck check (
    importe_vendido >= 0
    and importe_cobrado >= 0
    and importe_devuelto >= 0
    and importe_comision >= 0
    and importe_liquidado >= 0
    and importe_devuelto <= importe_cobrado
  ),
  constraint abc_b09_linea_state_ck check (
    estado in ('RECIBIDA','VINCULADA','NO_VINCULADA','DISCREPANCIA','EXCLUIDA')
  ),
  constraint abc_b09_linea_snapshot_ck check (jsonb_typeof(provider_snapshot) = 'object'),
  constraint abc_b09_linea_link_pair_ck check (
    (pago_id is null and intento_id is null) or (pago_id is not null and intento_id is not null)
  )
);

create unique index abc_b09_linea_provider_key_uq
  on public.abc_b09_liquidacion_lineas(
    empresa_id,local_id,liquidacion_id,provider_line_reference
  );
create unique index abc_b09_linea_scope_id_uq
  on public.abc_b09_liquidacion_lineas(empresa_id,local_id,id);
create index abc_b09_linea_pago_idx
  on public.abc_b09_liquidacion_lineas(empresa_id,local_id,pago_id,intento_id);
create index abc_b09_linea_status_idx
  on public.abc_b09_liquidacion_lineas(empresa_id,local_id,estado,created_at desc);

create table public.abc_b09_disputas (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  provider_code text not null,
  provider_account_id text not null,
  provider_dispute_reference text not null,
  provider_reason_code text,
  provider_line_reference text,
  liquidacion_linea_id uuid,
  pago_id uuid,
  intento_id uuid,
  payment_currency_code text not null,
  importe_disputado numeric(24,8) not null,
  estado text not null default 'ABIERTA',
  responsable_user_id uuid references auth.users(id) on delete restrict,
  documentacion jsonb not null default '{}'::jsonb,
  provider_snapshot jsonb not null default '{}'::jsonb,
  resolution_note text,
  opened_at timestamptz not null default now(),
  due_at timestamptz,
  resolved_at timestamptz,
  created_by uuid references auth.users(id) on delete restrict,
  constraint abc_b09_disputa_scope_fk
    foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint abc_b09_disputa_linea_fk
    foreign key (empresa_id,local_id,liquidacion_linea_id)
    references public.abc_b09_liquidacion_lineas(empresa_id,local_id,id) on delete restrict,
  constraint abc_b09_disputa_pago_fk
    foreign key (empresa_id,local_id,pago_id,payment_currency_code)
    references public.pagos(empresa_id,local_id,id,payment_currency_code) on delete restrict,
  constraint abc_b09_disputa_intento_fk
    foreign key (empresa_id,local_id,pago_id,intento_id,payment_currency_code)
    references public.pago_intentos(empresa_id,local_id,pago_id,id,payment_currency_code) on delete restrict,
  constraint abc_b09_disputa_provider_ck check (provider_code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  constraint abc_b09_disputa_account_ck check (char_length(btrim(provider_account_id)) between 1 and 240),
  constraint abc_b09_disputa_reference_ck check (char_length(btrim(provider_dispute_reference)) between 1 and 240),
  constraint abc_b09_disputa_currency_ck check (payment_currency_code ~ '^[A-Z]{3}$'),
  constraint abc_b09_disputa_amount_ck check (importe_disputado > 0),
  constraint abc_b09_disputa_state_ck check (
    estado in ('ABIERTA','EN_INVESTIGACION','ACEPTADA','RECHAZADA','REPRESENTADA','CERRADA','CANCELADA')
  ),
  constraint abc_b09_disputa_docs_ck check (jsonb_typeof(documentacion) = 'object'),
  constraint abc_b09_disputa_snapshot_ck check (jsonb_typeof(provider_snapshot) = 'object'),
  constraint abc_b09_disputa_link_pair_ck check (
    (pago_id is null and intento_id is null) or (pago_id is not null and intento_id is not null)
  ),
  constraint abc_b09_disputa_resolution_ck check (
    (estado in ('CERRADA','CANCELADA','ACEPTADA','RECHAZADA') and resolved_at is not null)
    or (estado in ('ABIERTA','EN_INVESTIGACION','REPRESENTADA') and resolved_at is null)
  )
);

create unique index abc_b09_disputa_business_key_uq
  on public.abc_b09_disputas(
    empresa_id,local_id,provider_code,provider_account_id,provider_dispute_reference
  );
create unique index abc_b09_disputa_scope_id_uq
  on public.abc_b09_disputas(empresa_id,local_id,id);
create index abc_b09_disputa_pago_idx
  on public.abc_b09_disputas(empresa_id,local_id,pago_id,intento_id,estado);
create index abc_b09_disputa_state_idx
  on public.abc_b09_disputas(empresa_id,local_id,estado,due_at);

comment on table public.abc_b09_liquidaciones is
  'B09: resumen autorizado de liquidacion comercial; no sustituye ventas, pagos ni caja.';
comment on table public.abc_b09_liquidacion_lineas is
  'B09: detalle de liquidacion que puede vincularse a un pago e intento existentes.';
comment on table public.abc_b09_disputas is
  'B09: disputas y contracargos trazables; no son devoluciones fisicas ni las aplican automaticamente.';

alter table public.abc_b09_liquidaciones enable row level security;
alter table public.abc_b09_liquidacion_lineas enable row level security;
alter table public.abc_b09_disputas enable row level security;

revoke all on table public.abc_b09_liquidaciones from public, anon, authenticated;
revoke all on table public.abc_b09_liquidacion_lineas from public, anon, authenticated;
revoke all on table public.abc_b09_disputas from public, anon, authenticated;
grant all on table public.abc_b09_liquidaciones to service_role;
grant all on table public.abc_b09_liquidacion_lineas to service_role;
grant all on table public.abc_b09_disputas to service_role;

commit;
