-- ABC F2 M02A — núcleo comercial y partición fiscal.
-- Aditiva. Sin activar flujos ABC, sin modificar tablas/RPC legacy.
-- Depende de F2 M01/M01b ya presentes.

do $$
begin
  if to_regclass('public.empresas') is null
     or to_regclass('public.locales') is null
     or to_regclass('public.abc_operaciones') is null
     or to_regclass('public.abc_eventos') is null
     or to_regprocedure('private.la_tiene_empresa(text)') is null
     or to_regprocedure('private.la_tiene_local(text,text)') is null
     or to_regclass('public.abc_locales_empresa_id_id_uq') is null then
    raise exception 'ABC_F2_M02A_PREFLIGHT_FALLO: dependencias base ausentes';
  end if;

  if to_regclass('public.entidades_fiscales') is not null
     or to_regclass('public.entidad_fiscal_monedas') is not null
     or to_regclass('public.entidad_fiscal_locales') is not null
     or to_regclass('public.entidad_fiscal_local_monedas') is not null
     or to_regclass('public.cuentas_comerciales') is not null
     or to_regclass('public.pedidos_tpv') is not null
     or to_regclass('public.pedido_lineas') is not null
     or to_regclass('public.ventas_fiscales') is not null
     or to_regclass('public.venta_fiscal_lineas') is not null then
    raise exception 'ABC_F2_M02A_PREFLIGHT_FALLO: objetos M02A ya existen';
  end if;
end $$;

create table public.entidades_fiscales (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null references public.empresas(id) on delete restrict,
  nombre_legal text not null,
  identificador_fiscal text,
  country_code text not null,
  simulada boolean not null default true,
  activa boolean not null default true,
  version bigint not null default 1,
  datos_legales jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint abc_entidad_fiscal_nombre check (nullif(btrim(nombre_legal),'') is not null),
  constraint abc_entidad_fiscal_identificador check (
    identificador_fiscal is null or nullif(btrim(identificador_fiscal),'') is not null
  ),
  constraint abc_entidad_fiscal_country check (country_code ~ '^[A-Z]{2}$'),
  constraint abc_entidad_fiscal_version check (version >= 1)
);
create unique index abc_entidad_fiscal_empresa_id_uq
  on public.entidades_fiscales(empresa_id,id);
create index abc_entidad_fiscal_empresa_activa_idx
  on public.entidades_fiscales(empresa_id,activa);

create table public.entidad_fiscal_monedas (
  empresa_id text not null,
  entidad_fiscal_id uuid not null,
  currency_code text not null,
  es_principal boolean not null default false,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (empresa_id,entidad_fiscal_id,currency_code),
  constraint abc_entidad_moneda_codigo check (currency_code ~ '^[A-Z]{3}$'),
  constraint abc_entidad_moneda_principal_activa check (not es_principal or activa),
  constraint abc_entidad_moneda_entidad_fk
    foreign key (empresa_id,entidad_fiscal_id)
    references public.entidades_fiscales(empresa_id,id) on delete restrict
);
create unique index abc_entidad_moneda_principal_uq
  on public.entidad_fiscal_monedas(empresa_id,entidad_fiscal_id)
  where es_principal;
create index abc_entidad_moneda_activa_idx
  on public.entidad_fiscal_monedas(empresa_id,entidad_fiscal_id,activa);

create table public.entidad_fiscal_locales (
  empresa_id text not null,
  local_id text not null,
  entidad_fiscal_id uuid not null,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (empresa_id,local_id,entidad_fiscal_id),
  constraint abc_entidad_local_local_fk
    foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint abc_entidad_local_entidad_fk
    foreign key (empresa_id,entidad_fiscal_id)
    references public.entidades_fiscales(empresa_id,id) on delete restrict
);
create index abc_entidad_local_activa_idx
  on public.entidad_fiscal_locales(empresa_id,local_id,activa);

create table public.entidad_fiscal_local_monedas (
  empresa_id text not null,
  local_id text not null,
  entidad_fiscal_id uuid not null,
  currency_code text not null,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (empresa_id,local_id,entidad_fiscal_id,currency_code),
  constraint abc_entidad_local_moneda_codigo check (currency_code ~ '^[A-Z]{3}$'),
  constraint abc_entidad_local_moneda_local_fk
    foreign key (empresa_id,local_id,entidad_fiscal_id)
    references public.entidad_fiscal_locales(empresa_id,local_id,entidad_fiscal_id)
    on delete restrict,
  constraint abc_entidad_local_moneda_entidad_fk
    foreign key (empresa_id,entidad_fiscal_id,currency_code)
    references public.entidad_fiscal_monedas(empresa_id,entidad_fiscal_id,currency_code)
    on delete restrict
);
create index abc_entidad_local_moneda_activa_idx
  on public.entidad_fiscal_local_monedas(
    empresa_id,local_id,entidad_fiscal_id,activa,currency_code
  );

create table public.cuentas_comerciales (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  currency_code text not null,
  modalidad text not null,
  estado text not null default 'ABIERTA',
  version bigint not null default 1,
  responsable_actual uuid references auth.users(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  opened_at timestamptz not null default now(),
  opened_operating_day date not null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint abc_cuenta_moneda check (currency_code ~ '^[A-Z]{3}$'),
  constraint abc_cuenta_modalidad check (
    modalidad in ('BARRA','MESA','TERRAZA','TAKEAWAY','OTRO')
  ),
  constraint abc_cuenta_estado check (estado in ('ABIERTA','CERRADA','CANCELADA')),
  constraint abc_cuenta_version check (version >= 1),
  constraint abc_cuenta_cierre check (
    (estado='ABIERTA' and closed_at is null)
    or
    (estado in ('CERRADA','CANCELADA') and closed_at is not null)
  ),
  constraint abc_cuenta_local_fk
    foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict
);
create unique index abc_cuenta_scope_id_uq
  on public.cuentas_comerciales(empresa_id,local_id,id);
create unique index abc_cuenta_scope_id_currency_uq
  on public.cuentas_comerciales(empresa_id,local_id,id,currency_code);
create index abc_cuenta_scope_estado_idx
  on public.cuentas_comerciales(empresa_id,local_id,estado,opened_at desc);

create table public.pedidos_tpv (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  cuenta_id uuid not null,
  currency_code text not null,
  estado text not null default 'BORRADOR',
  version bigint not null default 1,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_operating_day date not null,
  closed_at timestamptz,
  constraint abc_pedido_moneda check (currency_code ~ '^[A-Z]{3}$'),
  constraint abc_pedido_estado check (
    estado in ('BORRADOR','ABIERTO','ENVIADO','SERVIDO','CERRADO','CANCELADO')
  ),
  constraint abc_pedido_version check (version >= 1),
  constraint abc_pedido_cierre check (
    (estado in ('CERRADO','CANCELADO') and closed_at is not null)
    or
    (estado not in ('CERRADO','CANCELADO') and closed_at is null)
  ),
  constraint abc_pedido_cuenta_fk
    foreign key (empresa_id,local_id,cuenta_id,currency_code)
    references public.cuentas_comerciales(empresa_id,local_id,id,currency_code)
    on delete restrict
);
create unique index abc_pedido_scope_id_uq
  on public.pedidos_tpv(empresa_id,local_id,id);
create unique index abc_pedido_scope_id_currency_uq
  on public.pedidos_tpv(empresa_id,local_id,id,currency_code);
create index abc_pedido_cuenta_estado_idx
  on public.pedidos_tpv(empresa_id,local_id,cuenta_id,estado,created_at);

create table public.pedido_lineas (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  pedido_id uuid not null,
  producto_id text not null,
  cantidad numeric(24,8) not null,
  unidad text not null,
  estado text not null default 'BORRADOR',
  version bigint not null default 1,
  entidad_fiscal_id uuid,
  currency_code text not null,
  precio_unitario numeric(24,8),
  descuento_total numeric(24,8),
  base numeric(24,8),
  impuestos numeric(24,8),
  total numeric(24,8),
  snapshot_comercial jsonb not null default '{}'::jsonb,
  snapshot_calculo jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_operating_day date not null,
  constraint abc_linea_producto check (nullif(btrim(producto_id),'') is not null),
  constraint abc_linea_cantidad check (cantidad > 0),
  constraint abc_linea_unidad check (nullif(btrim(unidad),'') is not null),
  constraint abc_linea_estado check (
    estado in (
      'BORRADOR','CONFIRMADA','ENVIADA','EN_PREPARACION',
      'PREPARADA','SERVIDA','CANCELADA'
    )
  ),
  constraint abc_linea_version check (version >= 1),
  constraint abc_linea_moneda check (currency_code ~ '^[A-Z]{3}$'),
  constraint abc_linea_importes_no_negativos check (
    (precio_unitario is null or precio_unitario >= 0)
    and (descuento_total is null or descuento_total >= 0)
    and (base is null or base >= 0)
    and (impuestos is null or impuestos >= 0)
    and (total is null or total >= 0)
  ),
  constraint abc_linea_confirmada_completa check (
    estado not in ('CONFIRMADA','ENVIADA','EN_PREPARACION','PREPARADA','SERVIDA')
    or (
      entidad_fiscal_id is not null
      and precio_unitario is not null
      and descuento_total is not null
      and base is not null
      and impuestos is not null
      and total is not null
    )
  ),
  constraint abc_linea_pedido_fk
    foreign key (empresa_id,local_id,pedido_id,currency_code)
    references public.pedidos_tpv(empresa_id,local_id,id,currency_code)
    on delete restrict,
  constraint abc_linea_emisor_moneda_fk
    foreign key (empresa_id,local_id,entidad_fiscal_id,currency_code)
    references public.entidad_fiscal_local_monedas(
      empresa_id,local_id,entidad_fiscal_id,currency_code
    ) on delete restrict
);
create unique index abc_linea_scope_id_uq
  on public.pedido_lineas(empresa_id,local_id,id);
create unique index abc_linea_scope_issuer_currency_uq
  on public.pedido_lineas(empresa_id,local_id,id,entidad_fiscal_id,currency_code);
create index abc_linea_pedido_estado_idx
  on public.pedido_lineas(empresa_id,local_id,pedido_id,estado,created_at);

create table public.ventas_fiscales (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  cuenta_id uuid not null,
  entidad_fiscal_id uuid not null,
  currency_code text not null,
  estado text not null default 'ABIERTA',
  version bigint not null default 1,
  subtotal numeric(24,8) not null default 0,
  descuento_total numeric(24,8) not null default 0,
  impuestos_total numeric(24,8) not null default 0,
  total numeric(24,8) not null default 0,
  snapshot_calculo jsonb not null default '{}'::jsonb,
  locked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_operating_day date not null,
  constraint abc_venta_moneda check (currency_code ~ '^[A-Z]{3}$'),
  constraint abc_venta_estado check (
    estado in ('ABIERTA','BLOQUEADA','CERRADA','CANCELADA')
  ),
  constraint abc_venta_version check (version >= 1),
  constraint abc_venta_importes check (
    subtotal >= 0
    and descuento_total >= 0
    and impuestos_total >= 0
    and total >= 0
  ),
  constraint abc_venta_lock check (
    estado not in ('BLOQUEADA','CERRADA') or locked_at is not null
  ),
  constraint abc_venta_cuenta_fk
    foreign key (empresa_id,local_id,cuenta_id,currency_code)
    references public.cuentas_comerciales(empresa_id,local_id,id,currency_code)
    on delete restrict,
  constraint abc_venta_emisor_moneda_fk
    foreign key (empresa_id,local_id,entidad_fiscal_id,currency_code)
    references public.entidad_fiscal_local_monedas(
      empresa_id,local_id,entidad_fiscal_id,currency_code
    ) on delete restrict
);
create unique index abc_venta_scope_id_uq
  on public.ventas_fiscales(empresa_id,local_id,id);
create unique index abc_venta_scope_issuer_currency_uq
  on public.ventas_fiscales(
    empresa_id,local_id,id,entidad_fiscal_id,currency_code
  );
create index abc_venta_cuenta_estado_idx
  on public.ventas_fiscales(empresa_id,local_id,cuenta_id,estado,created_at);

create table public.venta_fiscal_lineas (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  venta_fiscal_id uuid not null,
  source_line_id uuid not null,
  entidad_fiscal_id uuid not null,
  currency_code text not null,
  cantidad numeric(24,8) not null,
  precio_unitario numeric(24,8) not null,
  descuento numeric(24,8) not null,
  base numeric(24,8) not null,
  impuesto numeric(24,8) not null,
  total numeric(24,8) not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint abc_venta_linea_moneda check (currency_code ~ '^[A-Z]{3}$'),
  constraint abc_venta_linea_cantidad check (cantidad > 0),
  constraint abc_venta_linea_importes check (
    precio_unitario >= 0
    and descuento >= 0
    and base >= 0
    and impuesto >= 0
    and total >= 0
  ),
  constraint abc_venta_linea_venta_fk
    foreign key (
      empresa_id,local_id,venta_fiscal_id,entidad_fiscal_id,currency_code
    )
    references public.ventas_fiscales(
      empresa_id,local_id,id,entidad_fiscal_id,currency_code
    ) on delete restrict,
  constraint abc_venta_linea_source_fk
    foreign key (
      empresa_id,local_id,source_line_id,entidad_fiscal_id,currency_code
    )
    references public.pedido_lineas(
      empresa_id,local_id,id,entidad_fiscal_id,currency_code
    ) on delete restrict
);
create unique index abc_venta_linea_scope_id_uq
  on public.venta_fiscal_lineas(empresa_id,local_id,id);
create index abc_venta_linea_venta_idx
  on public.venta_fiscal_lineas(empresa_id,local_id,venta_fiscal_id,created_at);
create index abc_venta_linea_source_idx
  on public.venta_fiscal_lineas(empresa_id,local_id,source_line_id);

alter table public.entidades_fiscales enable row level security;
alter table public.entidad_fiscal_monedas enable row level security;
alter table public.entidad_fiscal_locales enable row level security;
alter table public.entidad_fiscal_local_monedas enable row level security;
alter table public.cuentas_comerciales enable row level security;
alter table public.pedidos_tpv enable row level security;
alter table public.pedido_lineas enable row level security;
alter table public.ventas_fiscales enable row level security;
alter table public.venta_fiscal_lineas enable row level security;

create policy abc_entidad_fiscal_select on public.entidades_fiscales
  for select to authenticated using (private.la_tiene_empresa(empresa_id));
create policy abc_entidad_fiscal_moneda_select on public.entidad_fiscal_monedas
  for select to authenticated using (private.la_tiene_empresa(empresa_id));
create policy abc_entidad_fiscal_local_select on public.entidad_fiscal_locales
  for select to authenticated using (private.la_tiene_local(empresa_id,local_id));
create policy abc_entidad_fiscal_local_moneda_select on public.entidad_fiscal_local_monedas
  for select to authenticated using (private.la_tiene_local(empresa_id,local_id));
create policy abc_cuenta_comercial_select on public.cuentas_comerciales
  for select to authenticated using (private.la_tiene_local(empresa_id,local_id));
create policy abc_pedido_tpv_select on public.pedidos_tpv
  for select to authenticated using (private.la_tiene_local(empresa_id,local_id));
create policy abc_pedido_linea_select on public.pedido_lineas
  for select to authenticated using (private.la_tiene_local(empresa_id,local_id));
create policy abc_venta_fiscal_select on public.ventas_fiscales
  for select to authenticated using (private.la_tiene_local(empresa_id,local_id));
create policy abc_venta_fiscal_linea_select on public.venta_fiscal_lineas
  for select to authenticated using (private.la_tiene_local(empresa_id,local_id));

revoke all privileges
on table
  public.entidades_fiscales,
  public.entidad_fiscal_monedas,
  public.entidad_fiscal_locales,
  public.entidad_fiscal_local_monedas,
  public.cuentas_comerciales,
  public.pedidos_tpv,
  public.pedido_lineas,
  public.ventas_fiscales,
  public.venta_fiscal_lineas
from anon, authenticated;

grant select
on table
  public.entidades_fiscales,
  public.entidad_fiscal_monedas,
  public.entidad_fiscal_locales,
  public.entidad_fiscal_local_monedas,
  public.cuentas_comerciales,
  public.pedidos_tpv,
  public.pedido_lineas,
  public.ventas_fiscales,
  public.venta_fiscal_lineas
to authenticated;
