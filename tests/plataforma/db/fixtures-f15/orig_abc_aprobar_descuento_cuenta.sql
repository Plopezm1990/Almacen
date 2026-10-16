CREATE OR REPLACE FUNCTION public.abc_aprobar_descuento_cuenta(p_operation_id text, p_empresa_id text, p_local_id text, p_snapshot_hash text, p_attempt_id uuid, p_decision text, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_operation public.abc_operaciones%rowtype;
  v_authorization public.abc_descuento_autorizaciones%rowtype;
  v_existing_attempt public.abc_descuento_aprobacion_intentos%rowtype;
  v_requester_policy jsonb;
  v_authorizer_policy jsonb;
  v_snapshot jsonb;
  v_source_ids uuid[];
  v_attempt_hash text;
  v_escalated boolean:=false;
  v_decision text:=upper(btrim(coalesce(p_decision,'')));
  v_reason text:=btrim(coalesce(p_motivo,''));
  v_result jsonb;
begin
  if auth.uid() is null or p_attempt_id is null
     or p_snapshot_hash !~ '^[0-9a-f]{64}$'
     or v_decision not in ('APROBAR','RECHAZAR')
     or char_length(v_reason) not between 1 and 500 then
    raise exception 'descuento_aprobacion_parametros_invalidos';
  end if;
  if not private.la_tiene_local(p_empresa_id,p_local_id) then
    raise exception 'contexto_no_autorizado';
  end if;
  perform private.abc_a09_lock_config_context(p_empresa_id,p_local_id);
  perform private.abc_lock_operation_id(p_operation_id);
  select * into v_operation from public.abc_operaciones o
  where o.operation_id=p_operation_id and o.empresa_id=p_empresa_id
    and o.local_id=p_local_id and o.command_type='ABC_APLICAR_DESCUENTO_CUENTA'
  for update;
  if not found then raise exception 'descuento_solicitud_no_encontrada'; end if;
  select * into v_authorization from public.abc_descuento_autorizaciones a
  where a.operation_id=p_operation_id and a.empresa_id=p_empresa_id
    and a.local_id=p_local_id for update;
  if not found then raise exception 'descuento_solicitud_no_encontrada'; end if;

  v_attempt_hash:=private.abc_request_hash(jsonb_build_object(
    'actor_user_id',auth.uid(),'snapshot_hash',p_snapshot_hash,
    'decision',v_decision,'motivo',v_reason
  ));
  select * into v_existing_attempt
  from public.abc_descuento_aprobacion_intentos i
  where i.operation_id=p_operation_id and i.attempt_id=p_attempt_id;
  if found then
    if v_existing_attempt.autorizador_id is distinct from auth.uid()
       or v_existing_attempt.attempt_hash<>v_attempt_hash then
      raise exception 'descuento_aprobacion_attempt_id_conflict';
    end if;
    return v_existing_attempt.resultado||jsonb_build_object('replayed',true);
  end if;

  if p_snapshot_hash<>v_authorization.snapshot_hash then
    v_result:=jsonb_build_object('ok',false,'status','RECHAZADA',
      'operation_id',p_operation_id,'error','descuento_aprobacion_snapshot_conflict');
    insert into public.abc_descuento_aprobacion_intentos(
      empresa_id,local_id,operation_id,attempt_id,solicitante_id,autorizador_id,
      snapshot_hash,decision,motivo,attempt_hash,resultado
    ) values (p_empresa_id,p_local_id,p_operation_id,p_attempt_id,
      v_authorization.solicitante_id,auth.uid(),p_snapshot_hash,v_decision,v_reason,
      v_attempt_hash,v_result);
    return v_result;
  end if;
  if v_authorization.estado<>'PENDIENTE' then
    v_result:=jsonb_build_object('ok',false,'status',v_authorization.estado,
      'operation_id',p_operation_id,
      'error',case when v_authorization.estado='APROBADA'
        then 'descuento_ya_aprobado' else 'descuento_solicitud_cerrada' end,
      'autorizador_id',coalesce(v_authorization.autorizador_id::text,''));
    insert into public.abc_descuento_aprobacion_intentos(
      empresa_id,local_id,operation_id,attempt_id,solicitante_id,autorizador_id,
      snapshot_hash,decision,motivo,attempt_hash,resultado
    ) values (p_empresa_id,p_local_id,p_operation_id,p_attempt_id,
      v_authorization.solicitante_id,auth.uid(),p_snapshot_hash,v_decision,v_reason,
      v_attempt_hash,v_result);
    return v_result;
  end if;

  if auth.uid()=v_authorization.solicitante_id then
    v_result:=jsonb_build_object('ok',false,'status','RECHAZADA',
      'operation_id',p_operation_id,'error','descuento_autoaprobacion_rechazada');
    insert into public.abc_descuento_aprobacion_intentos(
      empresa_id,local_id,operation_id,attempt_id,solicitante_id,autorizador_id,
      snapshot_hash,decision,motivo,attempt_hash,resultado
    ) values (p_empresa_id,p_local_id,p_operation_id,p_attempt_id,
      v_authorization.solicitante_id,auth.uid(),p_snapshot_hash,v_decision,v_reason,
      v_attempt_hash,v_result);
    return v_result;
  end if;

  -- Lock in the A08 order so a split/merge cannot change the approved shares
  -- while the amount snapshot is checked.
  perform 1 from public.cuentas_comerciales c
  where c.empresa_id=p_empresa_id and c.local_id=p_local_id
    and c.id in (select (x->>'cuenta_id')::uuid
      from jsonb_array_elements(v_authorization.snapshot->'accounts') x)
  order by c.id for update;
  perform 1 from public.pedido_lineas l
  where l.empresa_id=p_empresa_id and l.local_id=p_local_id
    and l.id in (select (x->>'line_id')::uuid
      from jsonb_array_elements(v_authorization.snapshot->'lines') x)
  order by l.id for update;
  perform 1 from public.cuenta_linea_repartos r
  where r.empresa_id=p_empresa_id and r.local_id=p_local_id
    and r.id in (select (x->>'reparto_id')::uuid
      from jsonb_array_elements(v_authorization.snapshot->'shares') x)
  order by r.source_line_id,r.id for update;

  select array_agg((x #>> '{}')::uuid order by (x #>> '{}')) into v_source_ids
  from jsonb_array_elements(v_authorization.snapshot->'source_line_ids') x;
  v_requester_policy:=private.abc_descuento_politica_usuario(
    v_authorization.solicitante_id,p_empresa_id,p_local_id
  );
  v_authorizer_policy:=private.abc_descuento_politica_usuario(
    auth.uid(),p_empresa_id,p_local_id
  );
  v_snapshot:=private.abc_a09_snapshot_solicitud(
    v_operation.request,v_source_ids,v_requester_policy
  );
  v_escalated:=coalesce(
    (v_authorization.snapshot#>>'{operation,requiere_escalado}')::boolean,false
  );
  if v_requester_policy is distinct from v_authorization.politica_solicitante
     or not coalesce((v_requester_policy->>'puede_solicitar')::boolean,false)
     or (v_escalated and not coalesce(
       (v_requester_policy->>'permite_escalado')::boolean,false))
     or (not v_escalated and not coalesce(
       (v_requester_policy->>'requiere_doble_aprobacion')::boolean,false))
     or private.abc_a09_snapshot_hash(v_snapshot)<>v_authorization.snapshot_hash
     or v_snapshot is distinct from v_authorization.snapshot then
    v_result:=jsonb_build_object('ok',false,'status','INVALIDADA',
      'operation_id',p_operation_id,'error','descuento_autorizacion_version_obsoleta');
    update public.abc_descuento_autorizaciones
      set estado='INVALIDADA',resultado=v_result where id=v_authorization.id;
    if v_operation.status='PROCESANDO' then
      perform private.abc_operacion_fallar(p_operation_id,v_result);
    end if;
    insert into public.abc_descuento_aprobacion_intentos(
      empresa_id,local_id,operation_id,attempt_id,solicitante_id,autorizador_id,
      snapshot_hash,decision,motivo,attempt_hash,resultado
    ) values (p_empresa_id,p_local_id,p_operation_id,p_attempt_id,
      v_authorization.solicitante_id,auth.uid(),p_snapshot_hash,v_decision,v_reason,
      v_attempt_hash,v_result);
    return v_result;
  end if;
  if not coalesce((v_authorizer_policy->>'puede_autorizar')::boolean,false)
     or (v_decision='APROBAR' and not private.abc_a09_politica_puede_autorizar(
       v_snapshot,v_authorizer_policy
     )) then
    v_result:=jsonb_build_object('ok',false,'status','RECHAZADA',
      'operation_id',p_operation_id,'error','descuento_aprobador_sin_permiso');
    insert into public.abc_descuento_aprobacion_intentos(
      empresa_id,local_id,operation_id,attempt_id,solicitante_id,autorizador_id,
      snapshot_hash,decision,motivo,attempt_hash,resultado
    ) values (p_empresa_id,p_local_id,p_operation_id,p_attempt_id,
      v_authorization.solicitante_id,auth.uid(),p_snapshot_hash,v_decision,v_reason,
      v_attempt_hash,v_result);
    return v_result;
  end if;

  if v_decision='RECHAZAR' then
    v_result:=jsonb_build_object('ok',false,'status','RECHAZADA',
      'operation_id',p_operation_id,'autorizador_id',auth.uid(),
      'motivo',v_reason,'error','descuento_rechazado_por_autorizador');
    update public.abc_descuento_autorizaciones set estado='RECHAZADA',
      autorizador_id=auth.uid(),politica_autorizador=v_authorizer_policy,
      motivo_autorizacion=v_reason,autorizada_at=now(),resultado=v_result
    where id=v_authorization.id and estado='PENDIENTE';
    perform private.abc_operacion_fallar(p_operation_id,v_result);
  else
    v_result:=jsonb_build_object('ok',true,'status','APROBADA',
      'operation_id',p_operation_id,'approval_hash',v_authorization.snapshot_hash,
      'solicitante_id',v_authorization.solicitante_id,
      'autorizador_id',auth.uid(),'motivo',v_reason,'replayed',false);
    update public.abc_descuento_autorizaciones set estado='APROBADA',
      autorizador_id=auth.uid(),politica_autorizador=v_authorizer_policy,
      motivo_autorizacion=v_reason,autorizada_at=now(),resultado=v_result
    where id=v_authorization.id and estado='PENDIENTE';
    if not found then raise exception 'descuento_autorizacion_estado_conflict'; end if;
  end if;
  insert into public.abc_descuento_aprobacion_intentos(
    empresa_id,local_id,operation_id,attempt_id,solicitante_id,autorizador_id,
    snapshot_hash,decision,motivo,attempt_hash,resultado
  ) values (p_empresa_id,p_local_id,p_operation_id,p_attempt_id,
    v_authorization.solicitante_id,auth.uid(),p_snapshot_hash,v_decision,v_reason,
    v_attempt_hash,v_result);
  return v_result;
end $function$;
