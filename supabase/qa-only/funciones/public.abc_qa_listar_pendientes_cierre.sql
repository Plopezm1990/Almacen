CREATE OR REPLACE FUNCTION public.abc_qa_listar_pendientes_cierre(p_empresa_id text, p_local_id text, p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_effects jsonb;
  v_payments jsonb;
  v_session public.caja_sesiones%rowtype;
  v_terminal uuid;
begin
  if not private.abc_qa_c04_propietario(p_empresa_id,p_local_id) then
    raise exception 'abc_qa_reconcile_propietario_requerido';
  end if;
  select * into v_session
    from public.caja_sesiones s
   where s.empresa_id=p_empresa_id and s.local_id=p_local_id and s.id=p_session_id;
  if not found then raise exception 'abc_qa_reconcile_sesion_no_encontrada'; end if;
  if v_session.estado<>'CIERRE_PROVISIONAL' then raise exception 'abc_qa_reconcile_sesion_no_provisional'; end if;

  select st.terminal_id into v_terminal
    from public.caja_sesion_terminales st
   where st.empresa_id=p_empresa_id and st.local_id=p_local_id
     and st.session_id=p_session_id and st.hasta is null
   order by st.desde,st.terminal_id
   limit 1;
  if v_terminal is null then raise exception 'abc_qa_reconcile_terminal_no_encontrado'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,
    'tipo',q.tipo,
    'dedupe_key',q.dedupe_key,
    'estado',q.estado,
    'abc_command_id',q.abc_command_id,
    'comanda_id',q.comanda_id,
    'pedido_id',q.pedido_id,
    'created_at',q.created_at
  ) order by q.created_at,q.id),'[]'::jsonb)
    into v_effects
    from (
      select e.id,e.tipo,e.dedupe_key,e.estado,e.abc_command_id,e.created_at,
             e.payload->>'comanda_id' as comanda_id,
             e.payload->>'pedido_id' as pedido_id
        from public.efectos_pendientes e
        join public.abc_operaciones o
          on o.empresa_id=e.empresa_id and o.local_id=e.local_id
         and o.operation_id=e.abc_command_id
       where e.empresa_id=p_empresa_id and e.local_id=p_local_id
         and e.estado in ('PENDIENTE','EN_PROCESO','ERROR')
         and e.tipo in ('KITCHEN_COMANDA','KITCHEN_COMANDA_CAMBIO','KITCHEN_COMANDA_CANCELACION','KITCHEN_COMANDA_REIMPRESION')
         and o.request->>'session_id'=p_session_id::text
         and e.payload ? 'comanda_id'
    ) q;

  select coalesce(jsonb_agg(jsonb_build_object(
    'pago_id',q.pago_id,
    'checkout_id',q.checkout_id,
    'intento_id',q.intento_id,
    'medio',q.medio,
    'estado',q.estado,
    'intento_estado',q.intento_estado,
    'importe_objetivo',q.importe_objetivo,
    'abc_command_id',q.abc_command_id,
    'created_at',q.created_at
  ) order by q.created_at,q.pago_id),'[]'::jsonb)
    into v_payments
    from (
      select p.id as pago_id,p.checkout_id,i.id as intento_id,p.medio,p.estado,
             i.estado as intento_estado,p.importe_objetivo,i.abc_command_id,p.created_at
        from public.pagos p
        join public.pago_intentos i
          on i.empresa_id=p.empresa_id and i.local_id=p.local_id and i.pago_id=p.id
        join public.abc_operaciones o
          on o.empresa_id=i.empresa_id and o.local_id=i.local_id and o.operation_id=i.abc_command_id
        join public.checkouts c
          on c.empresa_id=p.empresa_id and c.local_id=p.local_id and c.id=p.checkout_id
       where p.empresa_id=p_empresa_id and p.local_id=p_local_id
         and p.medio='TARJETA'
         and p.estado in ('PENDIENTE','AUTORIZADO','DESCONOCIDO')
         and i.estado in ('PENDIENTE','AUTORIZADO','DESCONOCIDO')
         and o.command_type='ABC_INICIAR_COBRO'
         and o.operation_id like 'f4.b02b03.pay.%'
         and exists (
           select 1 from public.caja_sesion_terminales st
            where st.empresa_id=p_empresa_id and st.local_id=p_local_id
              and st.session_id=p_session_id and st.terminal_id=o.terminal_id and st.hasta is null
         )
    ) q;

  return jsonb_build_object('ok',true,'session_id',p_session_id,'effects',v_effects,'payments',v_payments);
end $function$;
