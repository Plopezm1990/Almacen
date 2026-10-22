-- ABC F4 B07 / subpunto 1 — registro configurable de proveedores y cuentas.
--
-- La tabla vive en private y solo conserva configuración no secreta. El secreto
-- real se guardará en el almacén de secretos de la Edge Function; aquí solo se
-- guarda su nombre lógico para que el adaptador pueda resolverlo en servidor.

do $$
begin
  if to_regclass('public.locales') is null then
    raise exception 'ABC_F4_B07_PREFLIGHT_FALLO: falta locales';
  end if;
  if to_regclass('private.abc_b07_proveedores') is not null
     or to_regclass('private.abc_b07_cuentas_comerciales') is not null then
    raise exception 'ABC_F4_B07_PREFLIGHT_FALLO: objetos B07 ya existen';
  end if;
end $$;

create table private.abc_b07_proveedores (
  provider_code text primary key,
  display_name text not null,
  adapter_key text not null default 'GENERIC_HMAC',
  signature_config jsonb not null,
  normalization_config jsonb not null,
  enabled boolean not null default false,
  version bigint not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint abc_b07_provider_code_ck check (
    provider_code ~ '^[A-Z][A-Z0-9_]{1,63}$'
  ),
  constraint abc_b07_provider_name_ck check (
    char_length(btrim(display_name)) between 1 and 160
  ),
  constraint abc_b07_adapter_key_ck check (
    adapter_key ~ '^[A-Z][A-Z0-9_]{1,63}$'
  ),
  constraint abc_b07_signature_config_ck check (
    jsonb_typeof(signature_config) = 'object'
    and signature_config ?& array['location','algorithm','encoding']
    and signature_config->>'location' in ('HEADER','QUERY')
    and signature_config->>'algorithm' in ('HMAC_SHA256','HMAC_SHA512','ASYMMETRIC')
    and signature_config->>'encoding' in ('HEX','BASE64','BASE64URL')
  ),
  constraint abc_b07_normalization_config_ck check (
    jsonb_typeof(normalization_config) = 'object'
    and normalization_config ?& array[
      'event_id','account_id','reference','amount','currency','status'
    ]
  )
);

create table private.abc_b07_cuentas_comerciales (
  id uuid primary key default gen_random_uuid(),
  provider_code text not null
    references private.abc_b07_proveedores(provider_code) on delete restrict,
  provider_account_id text not null,
  empresa_id text not null,
  local_id text not null,
  secret_ref text not null,
  enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  version bigint not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint abc_b07_account_id_ck check (
    char_length(btrim(provider_account_id)) between 1 and 240
  ),
  constraint abc_b07_secret_ref_ck check (
    secret_ref ~ '^[A-Z][A-Z0-9_]{2,127}$'
    and secret_ref not like 'SUPABASE_%'
  ),
  constraint abc_b07_account_metadata_ck check (
    jsonb_typeof(metadata) = 'object'
  ),
  constraint abc_b07_account_scope_fk
    foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint abc_b07_account_provider_uq
    unique (provider_code,provider_account_id)
);

comment on table private.abc_b07_proveedores is
  'B07: catálogo configurable de adaptadores y rutas no secretas del proveedor.';
comment on table private.abc_b07_cuentas_comerciales is
  'B07: vínculo servidor-servidor entre cuenta comercial, empresa y local.';
comment on column private.abc_b07_cuentas_comerciales.secret_ref is
  'Nombre del secreto del entorno servidor; nunca almacena el secreto ni su valor.';

alter table private.abc_b07_proveedores enable row level security;
alter table private.abc_b07_cuentas_comerciales enable row level security;

revoke all on table private.abc_b07_proveedores
  from public, anon, authenticated, service_role;
revoke all on table private.abc_b07_cuentas_comerciales
  from public, anon, authenticated, service_role;

create index abc_b07_proveedores_enabled_idx
  on private.abc_b07_proveedores(provider_code)
  where enabled;
create index abc_b07_cuentas_enabled_scope_idx
  on private.abc_b07_cuentas_comerciales(provider_code,empresa_id,local_id)
  where enabled;
