-- ABC F5 C04: conciliación explícita de pendientes de prueba en QA.
-- No confirma pagos, no ejecuta proveedores y no altera operaciones completadas.

do $$
begin
  if to_regclass('public.caja_sesiones') is null
     or to_regclass('public.efectos_pendientes') is null
     or to_regclass('public.pagos') is null
     or to_regclass('public.pago_intentos') is null
     or to_regclass('public.checkouts') is null
     or to_regclass('public.abc_operaciones') is null
     or to_regclass('public.abc_eventos') is null
     or to_regclass('public.comandas_preparacion') is null
     or to_regclass('public.membresias_usuario') is null
     or to_regprocedure('public.abc_resolver_intento(text,text,text,uuid,text,text,text,numeric,numeric,numeric,jsonb)') is null
     or to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null
     or to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then
    raise exception 'ABC_F5_C04_QA_RECONCILE_PREFLIGHT_FALLO';
  end if;
end $$;

create or replace function private.abc_qa_c04_propietario(
  p_empresa_id text,
  p_local_id text
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select auth.uid() is not null
     and p_empresa_id='QA-EMP-A'
     and p_local_id='QA-A1'
     and exists (
       select 1
         from public.locales l
        where l.empresa_id=p_empresa_id
          and l.id=p_local_id
          and l.activo=true
     )
     and exists (
       select 1
         from public.membresias_usuario m
        where m.user_id=auth.uid()
          and m.empresa_id=p_empresa_id
          and m.activo=true
          and m.rol='Propietario'
          and ((m.todos_locales=true and m.local_id is null) or (m.todos_locales=false and m.local_id=p_local_id))
     );
$$;

create or replace function public.abc_qa_listar_pendientes_cierre(
  p_empresa_id text,
  p_local_id text,
  p_session_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
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
end $$;

create or replace function public.abc_qa_compensar_efecto_cierre(
  p_empresa_id text,
  p_local_id text,
  p_session_id uuid,
  p_efecto_id uuid,
  p_motivo text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_effect public.efectos_pendientes%rowtype;
  v_session public.caja_sesiones%rowtype;
  v_terminal uuid;
  v_operation_id text;
  v_cmd jsonb;
  v_comanda_id uuid;
  v_result jsonb;
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'' );
begin
  if not private.abc_qa_c04_propietario(p_empresa_id,p_local_id) then raise exception 'abc_qa_reconcile_propietario_requerido'; end if;
  if v_motivo is null then raise exception 'abc_qa_reconcile_motivo_requerido'; end if;
  if length(v_motivo)>500 then raise exception 'abc_qa_reconcile_motivo_demasiado_largo'; end if;
  select * into v_session from public.caja_sesiones s where s.empresa_id=p_empresa_id and s.local_id=p_local_id and s.id=p_session_id;
  if not found or v_session.estado<>'CIERRE_PROVISIONAL' then raise exception 'abc_qa_reconcile_sesion_no_provisional'; end if;
  select * into v_effect from public.efectos_pendientes e
   where e.empresa_id=p_empresa_id and e.local_id=p_local_id and e.id=p_efecto_id;
  if not found then raise exception 'abc_qa_reconcile_efecto_no_encontrado'; end if;
  if v_effect.estado='COMPLETADO' then
    return jsonb_build_object('ok',true,'already_resolved',true,'efecto_id',p_efecto_id,'estado','COMPLETADO');
  end if;
  if v_effect.estado not in ('PENDIENTE','EN_PROCESO','ERROR') then raise exception 'abc_qa_reconcile_efecto_no_pendiente'; end if;
  if v_effect.tipo not in ('KITCHEN_COMANDA','KITCHEN_COMANDA_CAMBIO','KITCHEN_COMANDA_CANCELACION','KITCHEN_COMANDA_REIMPRESION') then
    raise exception 'abc_qa_reconcile_efecto_tipo_no_admitido';
  end if;
  if v_effect.payload->>'comanda_id' is null or v_effect.payload->>'pedido_id' is null then raise exception 'abc_qa_reconcile_payload_no_verificable'; end if;
  v_comanda_id:=(v_effect.payload->>'comanda_id')::uuid;
  if not exists (
    select 1 from public.comandas_preparacion c
     where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.id=v_comanda_id
       and c.pedido_id=(v_effect.payload->>'pedido_id')::uuid
       and c.estado in ('PENDIENTE','BLOQUEADA')
  ) then raise exception 'abc_qa_reconcile_comanda_no_pendiente'; end if;
  if not exists (
    select 1 from public.abc_operaciones o
     where o.empresa_id=p_empresa_id and o.local_id=p_local_id and o.operation_id=v_effect.abc_command_id
       and o.request->>'session_id'=p_session_id::text
  ) then raise exception 'abc_qa_reconcile_efecto_fuera_de_sesion'; end if;
  select st.terminal_id into v_terminal
    from public.caja_sesion_terminales st
   where st.empresa_id=p_empresa_id and st.local_id=p_local_id and st.session_id=p_session_id and st.hasta is null
   order by st.desde,st.terminal_id limit 1;
  if v_terminal is null then raise exception 'abc_qa_reconcile_terminal_no_encontrado'; end if;

  v_operation_id:='qa.f5.c04.effect.compensate.'||replace(p_efecto_id::text,'-','');
  v_cmd:=private.abc_operacion_iniciar(
    v_operation_id,p_empresa_id,p_local_id,'ABC_QA_COMPENSAR_EFECTO_CIERRE',
    jsonb_build_object('session_id',p_session_id,'efecto_id',p_efecto_id,'motivo',v_motivo),v_terminal
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  update public.efectos_pendientes
     set estado='COMPLETADO',completed_at=now(),locked_at=null,lease_until=null,
         worker_ref=null,next_attempt_at=null,
         last_error=jsonb_build_object('kind','QA_COMPENSACION','motivo',v_motivo,'actor_user_id',auth.uid(),'session_id',p_session_id)
   where id=p_efecto_id and estado in ('PENDIENTE','EN_PROCESO','ERROR');
  if not found then raise exception 'abc_qa_reconcile_efecto_cambio_concurrente'; end if;
  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,
    actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,v_operation_id,'EFECTO_PENDIENTE',p_efecto_id::text,
    'QA_EFECTO_COMPENSADO',jsonb_build_object('tipo',v_effect.tipo,'dedupe_key',v_effect.dedupe_key,
      'comanda_id',v_comanda_id,'pedido_id',(v_effect.payload->>'pedido_id')::uuid,'motivo',v_motivo,
      'estado_anterior',v_effect.estado,'estado','COMPLETADO'),auth.uid(),v_terminal,now(),current_date
  );
  v_result:=jsonb_build_object('ok',true,'efecto_id',p_efecto_id,'estado','COMPLETADO','operation_id',v_operation_id,'motivo',v_motivo);
  perform private.abc_operacion_completar(v_operation_id,v_result);
  return v_result;
end $$;

create or replace function public.abc_qa_cancelar_pago_cierre(
  p_empresa_id text,
  p_local_id text,
  p_session_id uuid,
  p_intento_id uuid,
  p_motivo text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_intento public.pago_intentos%rowtype;
  v_pago public.pagos%rowtype;
  v_session public.caja_sesiones%rowtype;
  v_operation public.abc_operaciones%rowtype;
  v_terminal uuid;
  v_operation_id text;
  v_result jsonb;
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'' );
begin
  if not private.abc_qa_c04_propietario(p_empresa_id,p_local_id) then raise exception 'abc_qa_reconcile_propietario_requerido'; end if;
  if v_motivo is null then raise exception 'abc_qa_reconcile_motivo_requerido'; end if;
  if length(v_motivo)>500 then raise exception 'abc_qa_reconcile_motivo_demasiado_largo'; end if;
  select * into v_session from public.caja_sesiones s where s.empresa_id=p_empresa_id and s.local_id=p_local_id and s.id=p_session_id;
  if not found or v_session.estado<>'CIERRE_PROVISIONAL' then raise exception 'abc_qa_reconcile_sesion_no_provisional'; end if;
  select * into v_intento from public.pago_intentos i where i.empresa_id=p_empresa_id and i.local_id=p_local_id and i.id=p_intento_id;
  if not found then raise exception 'abc_qa_reconcile_intento_no_encontrado'; end if;
  select * into v_pago from public.pagos p where p.empresa_id=p_empresa_id and p.local_id=p_local_id and p.id=v_intento.pago_id;
  if not found then raise exception 'abc_qa_reconcile_pago_no_encontrado'; end if;
  if v_intento.estado='CANCELADO' and v_pago.estado='CANCELADO' then
    return jsonb_build_object('ok',true,'already_resolved',true,'intento_id',p_intento_id,'pago_id',v_pago.id,'estado','CANCELADO');
  end if;
  if v_intento.estado<>'PENDIENTE' or v_pago.estado<>'PENDIENTE' then raise exception 'abc_qa_reconcile_pago_no_pendiente'; end if;
  if v_pago.medio<>'TARJETA' or v_intento.abc_command_id not like 'f4.b02b03.pay.%' then raise exception 'abc_qa_reconcile_pago_no_simulado'; end if;
  select * into v_operation from public.abc_operaciones o
   where o.empresa_id=p_empresa_id and o.local_id=p_local_id and o.operation_id=v_intento.abc_command_id
     and o.command_type='ABC_INICIAR_COBRO';
  if not found then raise exception 'abc_qa_reconcile_operacion_pago_no_verificable'; end if;
  if not exists (
    select 1 from public.caja_sesion_terminales st
     where st.empresa_id=p_empresa_id and st.local_id=p_local_id and st.session_id=p_session_id
       and st.terminal_id=v_operation.terminal_id and st.hasta is null
  ) then raise exception 'abc_qa_reconcile_pago_fuera_de_sesion'; end if;
  select st.terminal_id into v_terminal from public.caja_sesion_terminales st
   where st.empresa_id=p_empresa_id and st.local_id=p_local_id and st.session_id=p_session_id and st.hasta is null
   order by st.desde,st.terminal_id limit 1;
  if v_terminal is null then raise exception 'abc_qa_reconcile_terminal_no_encontrado'; end if;

  v_operation_id:='qa.f5.c04.payment.cancel.'||replace(p_intento_id::text,'-','');
  v_result:=public.abc_resolver_intento(
    v_operation_id,p_empresa_id,p_local_id,p_intento_id,'CANCELADO','QA_SIMULADO',
    'QA-CANCEL-'||replace(p_intento_id::text,'-',''),null,null,null,
    jsonb_build_object('modo','QA_SIMULADO','resultado','CANCELADO','motivo',v_motivo,'actor_user_id',auth.uid(),'session_id',p_session_id)
  );
  if not exists (
    select 1 from public.abc_eventos e where e.empresa_id=p_empresa_id and e.local_id=p_local_id
      and e.operation_id=v_operation_id and e.event_type='QA_PAGO_SIMULADO_CANCELADO'
  ) then
    insert into public.abc_eventos(
      empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,
      actor_user_id,terminal_id,occurred_at,operating_day
    ) values (
      p_empresa_id,p_local_id,v_operation_id,'PAGO',v_pago.id::text,'QA_PAGO_SIMULADO_CANCELADO',
      jsonb_build_object('intento_id',p_intento_id,'pago_id',v_pago.id,'checkout_id',v_pago.checkout_id,
        'motivo',v_motivo,'estado','CANCELADO','provider_code','QA_SIMULADO'),auth.uid(),v_terminal,now(),current_date
    );
  end if;
  return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('ok',true,'estado','CANCELADO','qa_simulado',true,'motivo',v_motivo);
end $$;

revoke all on function private.abc_qa_c04_propietario(text,text) from public,anon,authenticated,service_role;
revoke all on function public.abc_qa_listar_pendientes_cierre(text,text,uuid) from public,anon,service_role;
revoke all on function public.abc_qa_compensar_efecto_cierre(text,text,uuid,uuid,text) from public,anon,service_role;
revoke all on function public.abc_qa_cancelar_pago_cierre(text,text,uuid,uuid,text) from public,anon,service_role;
grant execute on function public.abc_qa_listar_pendientes_cierre(text,text,uuid) to authenticated;
grant execute on function public.abc_qa_compensar_efecto_cierre(text,text,uuid,uuid,text) to authenticated;
grant execute on function public.abc_qa_cancelar_pago_cierre(text,text,uuid,uuid,text) to authenticated;
