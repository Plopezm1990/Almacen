-- Plan Maestro L&A Suite — Etapa 5, T6, punto 4: corrige abc_registrar_ticket_correo_enviado.
-- Hoja QA-6 (Pedro, 24/10/2026) — hallazgo en prueba Cowork en vivo.
--
-- abc_eventos.operation_id tiene una clave foránea obligatoria hacia
-- abc_operaciones (empresa_id, local_id, operation_id) — todo evento debe
-- referirse a una operación ya registrada mediante
-- private.abc_operacion_iniciar. La versión original de esta función no lo
-- hacía (se trató por error como un simple insert de auditoría, sin pasar
-- por el mismo mecanismo que usa el resto del proyecto), así que el
-- `insert into abc_eventos` fallaba siempre con 409 (violación de clave
-- foránea) — el correo salía bien por Resend, pero nunca quedaba
-- constancia. Confirmado en los registros de QA: abc_datos_ticket_correo
-- en 200, abc_registrar_ticket_correo_enviado en 409, cero filas en
-- abc_eventos pese a que el correo llegó de verdad.
--
-- Esta migración reemplaza la función con el mismo patrón idempotente
-- (abc_operacion_iniciar/completar/fallar) que ya usa el resto del
-- proyecto — mismo cambio de comportamiento que corrige el fallo, sin
-- tocar abc_datos_ticket_correo ni la Edge Function.

do $$
begin
  if to_regprocedure('public.abc_registrar_ticket_correo_enviado(text,text,text,uuid,text,text)') is null then
    raise exception 'T6_TICKET_CORREO_FIX_PREFLIGHT_FALLO: la función a corregir no existe';
  end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null
     or to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null
     or to_regprocedure('private.abc_operacion_fallar(text,jsonb)') is null then
    raise exception 'T6_TICKET_CORREO_FIX_PREFLIGHT_FALLO: helpers de operación ausentes';
  end if;
end $$;

create or replace function public.abc_registrar_ticket_correo_enviado(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_checkout_id uuid,
  p_email text,
  p_resend_id text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_cmd jsonb;
  v_request jsonb;
  v_result jsonb;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COBRO_INICIAR') then
    raise exception 'abc_ticket_correo_no_autorizado';
  end if;
  if p_operation_id is null or p_checkout_id is null or p_email is null then
    raise exception 'ticket_correo_registro_parametros_invalidos';
  end if;
  if not exists (
    select 1 from public.checkouts c
     where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.id=p_checkout_id
  ) then
    raise exception 'ticket_correo_checkout_no_encontrado';
  end if;

  v_request := jsonb_build_object('checkout_id',p_checkout_id,'email',p_email,'resend_id',p_resend_id);
  v_cmd := private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_TICKET_CORREO_ENVIADO',v_request,null);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'TICKET_CORREO',p_checkout_id::text,'TICKET_CORREO_ENVIADO',
    jsonb_build_object('email',p_email,'resend_id',p_resend_id),
    auth.uid(),null,now(),current_date
  );

  v_result := jsonb_build_object('ok',true);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $$;

comment on function public.abc_registrar_ticket_correo_enviado is
  'T6 Hoja QA-6: deja constancia en abc_eventos de que se envió un ticket por correo. Corregido 24/10/2026: usa abc_operacion_iniciar/completar porque abc_eventos.operation_id exige una fila ya existente en abc_operaciones (clave foránea).';

revoke all on function public.abc_registrar_ticket_correo_enviado(text,text,text,uuid,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.abc_registrar_ticket_correo_enviado(text,text,text,uuid,text,text)
  to authenticated;
