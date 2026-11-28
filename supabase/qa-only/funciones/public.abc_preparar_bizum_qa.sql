CREATE OR REPLACE FUNCTION public.abc_preparar_bizum_qa(p_operation_id text, p_empresa_id text, p_local_id text, p_checkout_id uuid, p_importe_objetivo numeric, p_payment_currency_code text, p_terminal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_currency text := upper(btrim(coalesce(p_payment_currency_code, '')));
begin
  if auth.uid() is null then
    raise exception 'bizum_qa_no_autorizado';
  end if;
  if nullif(btrim(coalesce(p_operation_id, '')), '') is null
     or nullif(btrim(coalesce(p_empresa_id, '')), '') is null
     or nullif(btrim(coalesce(p_local_id, '')), '') is null
     or p_checkout_id is null
     or p_terminal_id is null then
    raise exception 'bizum_qa_parametros_requeridos';
  end if;
  if p_importe_objetivo is null or p_importe_objetivo <= 0 then
    raise exception 'bizum_qa_importe_invalido';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'bizum_qa_moneda_invalida';
  end if;

  return jsonb_build_object(
    'ok', true,
    'medio', 'BIZUM_QA',
    'estado', 'PREPARADO_QA',
    'operation_id', p_operation_id,
    'checkout_id', p_checkout_id,
    'importe_objetivo', p_importe_objetivo,
    'payment_currency_code', v_currency,
    'provider_started', false,
    'cash_movement', false,
    'write_performed', false,
    'requires_explicit_resolution', true
  );
end;
$function$;
