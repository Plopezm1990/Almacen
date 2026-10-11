-- ABC F4 B02/B03: resolvedor de tarjeta simulado, exclusivo de QA.
-- No conecta con ningún proveedor y delega la transición económica en
-- abc_resolver_intento para conservar reservas, checkout, dedupe y auditoría.

do $$
begin
  if to_regprocedure('public.abc_resolver_intento(text,text,text,uuid,text,text,text,numeric,numeric,numeric,jsonb)') is null then
    raise exception 'ABC_F4_B02B_QA_SIM_PREFLIGHT_FALLO: falta abc_resolver_intento';
  end if;
  if to_regclass('public.membresias_usuario') is null
     or to_regclass('public.abc_eventos') is null
     or to_regclass('public.pago_intentos') is null
     or to_regclass('public.pagos') is null
     or to_regclass('public.checkouts') is null then
    raise exception 'ABC_F4_B02B_QA_SIM_PREFLIGHT_FALLO: faltan tablas base';
  end if;
end $$;

create or replace function public.abc_qa_confirmar_pago_simulado(
  p_empresa_id text,
  p_local_id text,
  p_intento_id uuid,
  p_importe numeric
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_empresa constant text := 'QA-EMP-A';
  v_local constant text := 'QA-A1';
  v_provider constant text := 'QA_SIMULADO';
  v_uid uuid := auth.uid();
  v_intento public.pago_intentos%rowtype;
  v_pago public.pagos%rowtype;
  v_checkout public.checkouts%rowtype;
  v_terminal uuid;
  v_reference text;
  v_operation_id text;
  v_result jsonb;
  v_checkout_estado text;
begin
  if v_uid is null then
    raise exception 'abc_qa_simulador_no_autenticado';
  end if;
  if p_empresa_id is distinct from v_empresa or p_local_id is distinct from v_local then
    raise exception 'abc_qa_simulador_solo_qa';
  end if;
  if p_importe is null or p_importe <= 0 then
    raise exception 'abc_qa_simulador_importe_invalido';
  end if;
  if not exists (
    select 1
      from public.locales l
     where l.empresa_id = v_empresa
       and l.id = v_local
       and l.activo = true
  ) then
    raise exception 'abc_qa_simulador_local_no_disponible';
  end if;
  if not exists (
    select 1
      from public.membresias_usuario m
     where m.user_id = v_uid
       and m.empresa_id = v_empresa
       and m.activo = true
       and m.rol = 'Propietario'
       and (
         (m.todos_locales = true and m.local_id is null)
         or (m.todos_locales = false and m.local_id = v_local)
       )
  ) then
    raise exception 'abc_qa_simulador_propietario_requerido';
  end if;

  select i.* into v_intento
    from public.pago_intentos i
   where i.empresa_id = v_empresa
     and i.local_id = v_local
     and i.id = p_intento_id;
  if not found then
    raise exception 'abc_qa_simulador_intento_no_encontrado';
  end if;
  select p.* into v_pago
    from public.pagos p
   where p.empresa_id = v_empresa
     and p.local_id = v_local
     and p.id = v_intento.pago_id;
  if not found then
    raise exception 'abc_qa_simulador_pago_no_encontrado';
  end if;
  if v_pago.medio <> 'TARJETA' then
    raise exception 'abc_qa_simulador_solo_tarjeta';
  end if;
  if p_importe <> v_intento.requested_amount
     or p_importe <> v_pago.importe_objetivo then
    raise exception 'abc_qa_simulador_importe_distinto';
  end if;
  select c.* into v_checkout
    from public.checkouts c
   where c.empresa_id = v_empresa
     and c.local_id = v_local
     and c.id = v_pago.checkout_id;
  if not found then
    raise exception 'abc_qa_simulador_checkout_no_encontrado';
  end if;
  select o.terminal_id into v_terminal
    from public.abc_operaciones o
   where o.empresa_id = v_empresa
     and o.local_id = v_local
     and o.operation_id = v_intento.abc_command_id;
  if v_terminal is null then
    raise exception 'abc_qa_simulador_terminal_no_encontrado';
  end if;

  v_reference := 'QA-SIM-' || replace(p_intento_id::text, '-', '');
  v_operation_id := 'qa.f4.b02b.sim.' || replace(p_intento_id::text, '-', '');
  v_result := public.abc_resolver_intento(
    v_operation_id,
    v_empresa,
    v_local,
    p_intento_id,
    'CONFIRMADO',
    v_provider,
    v_reference,
    p_importe,
    p_importe,
    p_importe,
    jsonb_build_object(
      'modo', 'QA_SIMULADO',
      'resultado', 'APROBADO',
      'actor_user_id', v_uid,
      'intento_id', p_intento_id
    )
  );
  v_checkout_estado := coalesce(v_result->>'checkout_estado', 'COMPLETADO');

  insert into public.abc_eventos(
    empresa_id, local_id, operation_id, aggregate_type, aggregate_id,
    event_type, payload, actor_user_id, terminal_id, occurred_at,
    operating_day, executor_kind, executor_ref
  )
  select
    v_empresa, v_local, v_operation_id, 'PAGO', v_pago.id::text,
    'PAGO_CONFIRMADO',
    jsonb_build_object(
      'intento_id', p_intento_id,
      'pago_id', v_pago.id,
      'checkout_id', v_pago.checkout_id,
      'importe', p_importe,
      'currency_code', v_pago.payment_currency_code,
      'resultado', 'APROBADO',
      'checkout_estado', v_checkout_estado,
      'modo', 'QA_SIMULADO'
    ),
    v_uid, v_terminal, now(), v_checkout.operating_day,
    'SYSTEM_PROVIDER', v_provider
  where not exists (
    select 1
      from public.abc_eventos e
     where e.empresa_id = v_empresa
       and e.local_id = v_local
       and e.operation_id = v_operation_id
       and e.event_type = 'PAGO_CONFIRMADO'
  );

  return coalesce(v_result, '{}'::jsonb) || jsonb_build_object(
    'ok', true,
    'qa_simulado', true,
    'resultado', 'APROBADO',
    'provider_code', v_provider,
    'provider_reference', v_reference,
    'checkout_estado', v_checkout_estado
  );
end;
$function$;

comment on function public.abc_qa_confirmar_pago_simulado(text,text,uuid,numeric) is
  'ABC F4: aprueba una tarjeta simulada solo en QA-EMP-A/QA-A1 para Propietario; idempotente y sin proveedor real.';

revoke all on function public.abc_qa_confirmar_pago_simulado(text,text,uuid,numeric)
  from public, anon, service_role;
grant execute on function public.abc_qa_confirmar_pago_simulado(text,text,uuid,numeric)
  to authenticated;
