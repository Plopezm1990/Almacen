-- ABC F4 B07 / subpunto 2 — resolución servidor-servidor de configuración.
--
-- La Edge Function solo recibe provider_code y provider_account_id como
-- selectores de configuración. empresa_id y local_id salen de esta función;
-- nunca se aceptan como autoridad desde el webhook.

begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $$
begin
  if to_regclass('private.abc_b07_proveedores') is null
     or to_regclass('private.abc_b07_cuentas_comerciales') is null then
    raise exception 'ABC_F4_B07_SERVER_PREFLIGHT_FALLO: falta el registro de proveedores';
  end if;
end $$;

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

comment on function public.abc_b07_obtener_configuracion(text,text) is
  'B07: resuelve en servidor una cuenta de proveedor a su ámbito comercial y devuelve solo configuración no secreta.';

revoke all on function public.abc_b07_obtener_configuracion(text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.abc_b07_obtener_configuracion(text,text)
  to service_role;

commit;
