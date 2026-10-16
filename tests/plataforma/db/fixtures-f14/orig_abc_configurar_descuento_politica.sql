CREATE OR REPLACE FUNCTION public.abc_configurar_descuento_politica(p_operation_id text, p_empresa_id text, p_local_id text, p_rol text, p_user_id uuid, p_max_percent numeric, p_permite_cortesia boolean, p_puede_solicitar boolean, p_puede_aplicar boolean, p_puede_autorizar boolean, p_permite_escalado boolean, p_requiere_doble_aprobacion boolean, p_activa boolean, p_motivo text, p_operating_day date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text:=nullif(btrim(coalesce(p_rol,'')),'');
  v_reason text:=btrim(coalesce(p_motivo,''));
  v_request jsonb;
  v_command jsonb;
  v_existing public.abc_descuento_politicas%rowtype;
  v_before jsonb;
  v_policy_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.membresias_usuario m
    where m.user_id=auth.uid() and m.empresa_id=p_empresa_id
      and m.activo=true and m.rol='Propietario'
      and ((m.todos_locales=true and m.local_id is null)
        or (m.todos_locales=false and m.local_id=p_local_id))
  ) then raise exception 'descuento_politica_no_autorizada'; end if;
  if p_local_id is null or ((v_role is null)=(p_user_id is null))
     or p_max_percent is null or p_max_percent<0 or p_max_percent>100
     or p_max_percent<>round(p_max_percent,4)
     or p_permite_cortesia is null or p_puede_solicitar is null
     or p_puede_aplicar is null or p_puede_autorizar is null
     or p_permite_escalado is null or p_requiere_doble_aprobacion is null
     or p_activa is null or p_operating_day is null
     or char_length(v_reason) not between 1 and 500
     or (p_permite_cortesia and p_max_percent<>100)
     or (p_permite_escalado and not p_puede_solicitar)
     or (p_puede_aplicar and p_max_percent=0)
     or (p_puede_autorizar and p_max_percent=0)
     or (p_requiere_doble_aprobacion and not p_puede_solicitar) then
    raise exception 'descuento_politica_parametros_invalidos';
  end if;
  if p_user_id is not null and not exists (
    select 1 from public.membresias_usuario m
    where m.user_id=p_user_id and m.empresa_id=p_empresa_id and m.activo=true
      and ((m.todos_locales=true and m.local_id is null)
        or (m.todos_locales=false and m.local_id=p_local_id))
  ) then raise exception 'descuento_politica_usuario_fuera_de_local'; end if;

  v_request:=jsonb_build_object(
    'operation_id',p_operation_id,'empresa_id',p_empresa_id,'local_id',p_local_id,
    'rol',v_role,'user_id',p_user_id,'max_percent',p_max_percent::numeric(9,4)::text,
    'permite_cortesia',p_permite_cortesia,'puede_solicitar',p_puede_solicitar,
    'puede_aplicar',p_puede_aplicar,'puede_autorizar',p_puede_autorizar,
    'permite_escalado',p_permite_escalado,
    'requiere_doble_aprobacion',p_requiere_doble_aprobacion,'activa',p_activa,
    'motivo',v_reason,'operating_day',p_operating_day,'actor_user_id',auth.uid()
  );
  perform private.abc_a09_lock_config_context_write(p_empresa_id,p_local_id);
  v_command:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,
    'ABC_CONFIGURAR_DESCUENTO_POLITICA',v_request,null);
  if (v_command->>'replayed')::boolean then
    if v_command->>'status'='COMPLETADA' then return v_command->'resultado'; end if;
    if v_command->>'status'='FALLIDA' then return coalesce(v_command->'error',v_command); end if;
  end if;

  if v_role is not null then
    select * into v_existing from public.abc_descuento_politicas p
    where p.empresa_id=p_empresa_id and p.local_id=p_local_id and p.rol=v_role
    for update;
  else
    select * into v_existing from public.abc_descuento_politicas p
    where p.empresa_id=p_empresa_id and p.local_id=p_local_id and p.user_id=p_user_id
    for update;
  end if;
  if found then
    v_policy_id:=v_existing.id;
    v_before:=to_jsonb(v_existing);
    update public.abc_descuento_politicas set
      max_percent=p_max_percent,permite_cortesia=p_permite_cortesia,
      puede_solicitar=p_puede_solicitar,puede_aplicar=p_puede_aplicar,
      puede_autorizar=p_puede_autorizar,permite_escalado=p_permite_escalado,
      requiere_doble_aprobacion=p_requiere_doble_aprobacion,activa=p_activa
    where id=v_policy_id;
  else
    insert into public.abc_descuento_politicas(
      empresa_id,local_id,rol,user_id,max_percent,permite_cortesia,
      puede_solicitar,puede_aplicar,puede_autorizar,permite_escalado,
      requiere_doble_aprobacion,activa
    ) values (
      p_empresa_id,p_local_id,v_role,p_user_id,p_max_percent,p_permite_cortesia,
      p_puede_solicitar,p_puede_aplicar,p_puede_autorizar,p_permite_escalado,
      p_requiere_doble_aprobacion,p_activa
    ) returning id into v_policy_id;
  end if;
  v_result:=jsonb_build_object('ok',true,'status','CONFIGURADA',
    'operation_id',p_operation_id,'policy_id',v_policy_id,
    'local_id',p_local_id,'rol',v_role,'user_id',p_user_id,
    'configuracion',v_request-'operation_id'-'motivo'-'operating_day'-'actor_user_id',
    'replayed',false);
  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'DESCUENTO_POLITICA',v_policy_id::text,
    'DESCUENTO_POLITICA_CONFIGURADA',
    jsonb_build_object('before',v_before,'after',to_jsonb((
      select p from public.abc_descuento_politicas p where p.id=v_policy_id
    )),'reason',v_reason),
    auth.uid(),clock_timestamp(),p_operating_day
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $function$;
