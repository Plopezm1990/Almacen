-- ABC F4 B10.1 — barrera de datos de tarjeta.
--
-- El terminal/proveedor captura los datos de tarjeta. ABC solo conserva
-- referencias, importes, estados y snapshots de proveedor sanitizados.
-- No guarda PAN, CVV/CVC ni detalles completos de método de pago.

begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.pago_intentos') is null then
    v_missing := array_append(v_missing, 'pago_intentos');
  end if;
  if to_regclass('public.reembolsos') is null then
    v_missing := array_append(v_missing, 'reembolsos');
  end if;
  if to_regclass('public.efectos_pendientes') is null then
    v_missing := array_append(v_missing, 'efectos_pendientes');
  end if;
  if to_regclass('public.abc_eventos') is null then
    v_missing := array_append(v_missing, 'abc_eventos');
  end if;
  if to_regclass('public.abc_b07_eventos_proveedor') is null then
    v_missing := array_append(v_missing, 'abc_b07_eventos_proveedor');
  end if;
  if to_regprocedure('private.abc_b10_payload_sin_datos_tarjeta(jsonb)') is not null then
    v_missing := array_append(v_missing, 'preflight: objeto B10 ya existe');
  end if;
  if cardinality(v_missing) > 0 then
    raise exception 'ABC_F4_B10_PREFLIGHT_FALLO:%', array_to_string(v_missing, ',');
  end if;
end $$;

create function private.abc_b10_payload_sin_datos_tarjeta(p_payload jsonb)
returns boolean
language plpgsql
immutable
security definer
set search_path=''
as $$
declare
  v_item record;
  v_key text;
begin
  if p_payload is null then return false; end if;
  if jsonb_typeof(p_payload) = 'object' then
    for v_item in select key, value from jsonb_each(p_payload) loop
      v_key := lower(replace(replace(v_item.key, '-', '_'), ' ', '_'));
      if v_key in (
        'pan','primary_account_number','cvv','cvc','cid',
        'card_number','cardnumber','numero_tarjeta',
        'security_code','track_data','magstripe','full_card',
        'card_data','payment_method_details','raw_card_data',
        'private_key','secret_value'
      ) then
        return false;
      end if;
      if jsonb_typeof(v_item.value) in ('object','array')
         and not private.abc_b10_payload_sin_datos_tarjeta(v_item.value) then
        return false;
      end if;
    end loop;
  elsif jsonb_typeof(p_payload) = 'array' then
    for v_item in select value from jsonb_array_elements(p_payload) loop
      if jsonb_typeof(v_item.value) in ('object','array')
         and not private.abc_b10_payload_sin_datos_tarjeta(v_item.value) then
        return false;
      end if;
    end loop;
  end if;
  return true;
end;
$$;

do $$
begin
  if exists (
    select 1 from public.pago_intentos
     where not private.abc_b10_payload_sin_datos_tarjeta(provider_snapshot)
  ) then
    raise exception 'ABC_F4_B10_DATOS_TARJETA_EXISTENTES:pago_intentos';
  end if;
  if exists (
    select 1 from public.reembolsos
     where not private.abc_b10_payload_sin_datos_tarjeta(provider_snapshot)
  ) then
    raise exception 'ABC_F4_B10_DATOS_TARJETA_EXISTENTES:reembolsos';
  end if;
  if exists (
    select 1 from public.efectos_pendientes
     where not private.abc_b10_payload_sin_datos_tarjeta(payload)
  ) then
    raise exception 'ABC_F4_B10_DATOS_TARJETA_EXISTENTES:efectos_pendientes';
  end if;
  if exists (
    select 1 from public.abc_eventos
     where not private.abc_b10_payload_sin_datos_tarjeta(payload)
  ) then
    raise exception 'ABC_F4_B10_DATOS_TARJETA_EXISTENTES:abc_eventos';
  end if;
  if exists (
    select 1 from public.abc_b07_eventos_proveedor
     where not private.abc_b10_payload_sin_datos_tarjeta(payload)
        or (last_conflict_payload is not null
            and not private.abc_b10_payload_sin_datos_tarjeta(last_conflict_payload))
  ) then
    raise exception 'ABC_F4_B10_DATOS_TARJETA_EXISTENTES:abc_b07_eventos_proveedor';
  end if;
end $$;

alter table public.pago_intentos
  add constraint abc_b10_pago_intento_snapshot_sin_tarjeta_ck
  check (private.abc_b10_payload_sin_datos_tarjeta(provider_snapshot));

alter table public.reembolsos
  add constraint abc_b10_reembolso_snapshot_sin_tarjeta_ck
  check (private.abc_b10_payload_sin_datos_tarjeta(provider_snapshot));

alter table public.efectos_pendientes
  add constraint abc_b10_efecto_payload_sin_tarjeta_ck
  check (private.abc_b10_payload_sin_datos_tarjeta(payload));

alter table public.abc_eventos
  add constraint abc_b10_evento_payload_sin_tarjeta_ck
  check (private.abc_b10_payload_sin_datos_tarjeta(payload));

alter table public.abc_b07_eventos_proveedor
  add constraint abc_b10_b07_payload_sin_tarjeta_ck
  check (
    private.abc_b10_payload_sin_datos_tarjeta(payload)
    and (
      last_conflict_payload is null
      or private.abc_b10_payload_sin_datos_tarjeta(last_conflict_payload)
    )
  );

comment on function private.abc_b10_payload_sin_datos_tarjeta(jsonb) is
  'B10: valida recursivamente que payloads y snapshots no contengan PAN, CVV/CVC ni datos completos de tarjeta.';

commit;
