CREATE OR REPLACE FUNCTION public.abc_datos_ticket_correo(p_empresa_id text, p_local_id text, p_checkout_id uuid, p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;
