-- Esquema mínimo y datos señuelo para el contrato A-02
-- (tests/f5/c07/db/a02-venta-fiscal-sellada-contract.mjs).
--
-- Las tablas llevan las columnas tal y como están en producción, obtenidas de
-- su catálogo el 2026-11-08; se omiten los `not null` y las claves ajenas,
-- que no son lo que este contrato audita. Sí se conservan las dos
-- restricciones que importan: los estados admitidos y `abc_venta_lock`, que
-- exige `locked_at` cuando la venta queda CERRADA o BLOQUEADA.
--
-- No crea ni destruye la base: la prepara el arnés.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;

create schema if not exists private;
create schema if not exists auth;

create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('a02.uid', true), '')::uuid $$;

create table public.abc_cobro_incidencias (
  id uuid,
  empresa_id text,
  local_id text,
  intento_id uuid,
  operation_id text,
  estado text,
  motivo text,
  provider_code text,
  provider_reference text,
  evidencia jsonb,
  resultado_estado text,
  resultado jsonb,
  created_by uuid,
  created_at timestamp with time zone,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  resolution_operation_id text,
  version bigint
);

create table public.abc_eventos (
  id bigint,
  empresa_id text,
  local_id text,
  operation_id text,
  aggregate_type text,
  aggregate_id text,
  event_type text,
  payload jsonb,
  actor_user_id uuid,
  terminal_id uuid,
  occurred_at timestamp with time zone,
  operating_day date,
  created_at timestamp with time zone,
  executor_kind text,
  executor_ref text
);

create table public.checkout_ventas (
  id uuid,
  empresa_id text,
  local_id text,
  checkout_id uuid,
  venta_fiscal_id uuid,
  currency_code text,
  importe_objetivo numeric,
  created_at timestamp with time zone
);

create table public.checkouts (
  id uuid,
  empresa_id text,
  local_id text,
  cuenta_id uuid,
  currency_code text,
  estado text,
  version bigint,
  created_by uuid,
  created_at timestamp with time zone,
  operating_day date,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone
);

create table public.cuentas_comerciales (
  id uuid,
  empresa_id text,
  local_id text,
  currency_code text,
  modalidad text,
  estado text,
  version bigint,
  responsable_actual uuid,
  created_by uuid,
  opened_at timestamp with time zone,
  opened_operating_day date,
  closed_at timestamp with time zone,
  created_at timestamp with time zone
);

create table public.pago_aplicaciones (
  id uuid,
  empresa_id text,
  local_id text,
  pago_id uuid,
  intento_id uuid,
  checkout_venta_id uuid,
  venta_fiscal_id uuid,
  payment_amount numeric,
  payment_currency_code text,
  sale_amount numeric,
  sale_currency_code text,
  fx_snapshot jsonb,
  confirmed_at timestamp with time zone,
  created_at timestamp with time zone
);

create table public.pago_intentos (
  id uuid,
  empresa_id text,
  local_id text,
  pago_id uuid,
  abc_command_id text,
  estado text,
  provider_code text,
  provider_reference text,
  requested_amount numeric,
  payment_currency_code text,
  authorized_amount numeric,
  captured_amount numeric,
  settled_amount numeric,
  authorization_status text,
  capture_status text,
  settlement_status text,
  provider_snapshot jsonb,
  started_at timestamp with time zone,
  resolved_at timestamp with time zone
);

create table public.pagos (
  id uuid,
  empresa_id text,
  local_id text,
  checkout_id uuid,
  medio text,
  estado text,
  sale_currency_code text,
  payment_currency_code text,
  importe_objetivo numeric,
  importe_recibido numeric,
  cambio_entregado numeric,
  version bigint,
  created_by uuid,
  created_at timestamp with time zone,
  resolved_at timestamp with time zone
);

create table public.pedidos_tpv (
  id uuid,
  empresa_id text,
  local_id text,
  cuenta_id uuid,
  currency_code text,
  estado text,
  version bigint,
  created_by uuid,
  created_at timestamp with time zone,
  created_operating_day date,
  closed_at timestamp with time zone
);

create table public.reservas_saldo (
  id uuid,
  empresa_id text,
  local_id text,
  intento_id uuid,
  checkout_venta_id uuid,
  venta_fiscal_id uuid,
  sale_currency_code text,
  importe_reservado numeric,
  estado text,
  created_at timestamp with time zone,
  consumed_at timestamp with time zone,
  released_at timestamp with time zone
);

create table public.ventas_fiscales (
  id uuid,
  empresa_id text,
  local_id text,
  cuenta_id uuid,
  entidad_fiscal_id uuid,
  currency_code text,
  estado text,
  version bigint,
  subtotal numeric,
  descuento_total numeric,
  impuestos_total numeric,
  total numeric,
  snapshot_calculo jsonb,
  locked_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone,
  created_operating_day date
);

alter table public.ventas_fiscales
  add constraint abc_venta_estado check (estado in ('ABIERTA','BLOQUEADA','CERRADA','CANCELADA'));
alter table public.ventas_fiscales
  add constraint abc_venta_lock check (estado not in ('BLOQUEADA','CERRADA') or locked_at is not null);

-- Sustitutos de las piezas que este contrato no audita: la identidad, la
-- capacidad y la idempotencia de la operación se dan por buenas, porque lo
-- que se comprueba aquí es el sellado de la venta fiscal.
create or replace function private.abc_terminal_sesion_operativa(text, text, uuid, uuid)
returns boolean language sql stable as $$ select true $$;
create or replace function private.abc_tiene_capacidad(text, text, text)
returns boolean language sql stable as $$ select true $$;
create or replace function private.abc_operacion_iniciar(text, text, text, text, jsonb, uuid)
returns jsonb language sql as $$ select jsonb_build_object('replayed', false) $$;
create or replace function private.abc_operacion_completar(text, jsonb)
returns void language sql as $$ select null::void $$;
create or replace function private.abc_operacion_fallar(text, jsonb)
returns void language sql as $$ select null::void $$;
create or replace function private.abc_registrar_transicion_pedido(text, text, uuid, text, text, text, text, uuid, uuid, uuid, date, jsonb)
returns void language sql as $$ select null::void $$;
