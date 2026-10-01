-- ABC F4 B10.2 — modo de captura PCI configurable y neutral respecto al proveedor.
--
-- El modo describe dónde captura la tarjeta el proveedor. No permite que el
-- navegador o ABC reciban PAN/CVV: la integración real sigue siendo externa.

begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $$
begin
  if to_regclass('private.abc_b07_proveedores') is null then
    raise exception 'ABC_F4_B10_PCI_PREFLIGHT_FALLO:falta abc_b07_proveedores';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema='private'
       and table_name='abc_b07_proveedores'
       and column_name='capture_mode'
  ) then
    raise exception 'ABC_F4_B10_PCI_PREFLIGHT_FALLO:capture_mode ya existe';
  end if;
end $$;

alter table private.abc_b07_proveedores
  add column capture_mode text not null default 'EXTERNAL_TERMINAL';

alter table private.abc_b07_proveedores
  add constraint abc_b10_capture_mode_ck
  check (capture_mode in ('EXTERNAL_TERMINAL','HOSTED_FIELDS','HOSTED_REDIRECT'));

create or replace function public.abc_b07_obtener_configuracion(
  p_provider_code text,
  p_provider_account_id text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_provider_code text := upper(btrim(coalesce(p_provider_code, '')));
  v_provider_account_id text := btrim(coalesce(p_provider_account_id, ''));
  v_config jsonb;
begin
  if v_provider_code = '' or v_provider_account_id = '' then
    raise exception 'ABC_F4_B07_CONFIG_INVALIDA';
  end if;

  select jsonb_build_object(
    'provider_code', p.provider_code,
    'provider_account_id', c.provider_account_id,
    'adapter_key', p.adapter_key,
    'capture_mode', p.capture_mode,
    'signature_config', p.signature_config,
    'normalization_config', p.normalization_config,
    'secret_ref', c.secret_ref,
    'empresa_id', c.empresa_id,
    'local_id', c.local_id,
    'version', greatest(p.version, c.version)
  )
    into v_config
    from private.abc_b07_proveedores p
    join private.abc_b07_cuentas_comerciales c
      on c.provider_code = p.provider_code
   where p.provider_code = v_provider_code
     and c.provider_account_id = v_provider_account_id
     and p.enabled
     and c.enabled;

  return coalesce(v_config, '{}'::jsonb);
end;
$$;

comment on column private.abc_b07_proveedores.capture_mode is
  'B10: ubicación de captura externa; no autoriza PAN/CVV en navegador, logs ni ABC.';

comment on function public.abc_b07_obtener_configuracion(text,text) is
  'B07/B10: resuelve servidor-servidor la cuenta y devuelve configuración no secreta, incluido el modo de captura PCI.';

revoke all on function public.abc_b07_obtener_configuracion(text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.abc_b07_obtener_configuracion(text,text)
  to service_role;

commit;
