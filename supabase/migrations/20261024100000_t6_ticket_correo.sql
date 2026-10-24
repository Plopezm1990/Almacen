-- Plan Maestro L&A Suite — Etapa 5, T6, punto 4: ticket por correo.
-- Hoja QA-6 (Pedro, 24/10/2026).
--
-- Dos piezas de servidor, ambas de solo lectura/registro (el envío real del
-- correo lo hace una Edge Function nueva, "enviar-ticket-correo", que es la
-- única pieza que toca la clave de Resend):
--
--   1. abc_datos_ticket_correo: valida permiso + que la cuenta sea de esta
--      empresa/local, y devuelve los datos AUTÉNTICOS del cobro (total,
--      medios de pago, moneda, fecha) para que el correo nunca pueda decir
--      un importe distinto al que de verdad se cobró. No escribe nada.
--   2. abc_registrar_ticket_correo_enviado: deja constancia en abc_eventos
--      de que se envió un ticket a tal correo, una vez Resend confirma el
--      envío. No es una operación de dinero: un reintento que duplicase
--      esta fila no tiene ningún efecto dañino (el envío real a Resend ya
--      se protege aparte con su propia Idempotency-Key).
--
-- No sustituye el ticket impreso ni es un documento fiscal (eso es la Hoja
-- QA-5, factura a empresa, que no se toca aquí).

do $$
begin
  if to_regclass('public.checkouts') is null or to_regclass('public.pagos') is null
     or to_regclass('public.abc_eventos') is null or to_regclass('public.empresas') is null then
    raise exception 'T6_TICKET_CORREO_PREFLIGHT_FALLO: falta alguna tabla base';
  end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then
    raise exception 'T6_TICKET_CORREO_PREFLIGHT_FALLO: helper de capacidad ausente';
  end if;
  if to_regprocedure('public.abc_datos_ticket_correo(text,text,uuid,text)') is not null
     or to_regprocedure('public.abc_registrar_ticket_correo_enviado(text,text,uuid,text,text,text)') is not null then
    raise exception 'T6_TICKET_CORREO_PREFLIGHT_FALLO: alguna RPC ya existe';
  end if;
end $$;

create or replace function public.abc_datos_ticket_correo(
  p_empresa_id text,
  p_local_id text,
  p_checkout_id uuid,
  p_email text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_checkout public.checkouts%rowtype;
  v_empresa_nombre text;
  v_medios jsonb;
  v_total numeric(24,8);
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COBRO_INICIAR') then
    raise exception 'abc_ticket_correo_no_autorizado';
  end if;
  if p_checkout_id is null or p_email is null
     or p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(p_email) > 254 then
    raise exception 'ticket_correo_email_invalido';
  end if;

  select * into v_checkout
    from public.checkouts c
   where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.id=p_checkout_id;
  if not found then raise exception 'ticket_correo_checkout_no_encontrado'; end if;

  select coalesce(sum(p.importe_objetivo),0) into v_total
    from public.pagos p
   where p.empresa_id=p_empresa_id and p.local_id=p_local_id
     and p.checkout_id=p_checkout_id and p.estado='CONFIRMADO';

  select coalesce(jsonb_agg(jsonb_build_object('medio',t.medio,'importe',t.importe) order by t.medio),'[]'::jsonb)
    into v_medios
  from (
    select p.medio, sum(p.importe_objetivo) as importe
      from public.pagos p
     where p.empresa_id=p_empresa_id and p.local_id=p_local_id
       and p.checkout_id=p_checkout_id and p.estado='CONFIRMADO'
     group by p.medio
  ) t;

  select e.nombre into v_empresa_nombre from public.empresas e where e.id=p_empresa_id;

  return jsonb_build_object(
    'ok',true,
    'checkoutId',v_checkout.id,
    'cuentaId',v_checkout.cuenta_id,
    'empresaNombre',coalesce(v_empresa_nombre,''),
    'moneda',v_checkout.currency_code,
    'fecha',coalesce(v_checkout.completed_at,v_checkout.created_at),
    'total',v_total,
    'medios',v_medios
  );
end $$;

comment on function public.abc_datos_ticket_correo is
  'T6 Hoja QA-6: datos auténticos (importe realmente cobrado) para construir el correo del ticket. No escribe nada.';

revoke all on function public.abc_datos_ticket_correo(text,text,uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.abc_datos_ticket_correo(text,text,uuid,text)
  to authenticated;

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

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'TICKET_CORREO',p_checkout_id::text,'TICKET_CORREO_ENVIADO',
    jsonb_build_object('email',p_email,'resend_id',p_resend_id),
    auth.uid(),null,now(),current_date
  );

  return jsonb_build_object('ok',true);
end $$;

comment on function public.abc_registrar_ticket_correo_enviado is
  'T6 Hoja QA-6: deja constancia en abc_eventos de que se envió un ticket por correo, una vez confirmado por Resend.';

revoke all on function public.abc_registrar_ticket_correo_enviado(text,text,text,uuid,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.abc_registrar_ticket_correo_enviado(text,text,text,uuid,text,text)
  to authenticated;
