CREATE OR REPLACE FUNCTION public.abc_simular_apertura_cajon(p_operation_id text, p_empresa_id text, p_local_id text, p_equipo_id uuid, p_motivo text, p_terminal_id uuid, p_checkout_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_cmd jsonb; v_request jsonb; v_result jsonb;
  v_equipo public.abc_local_equipos%rowtype;
  v_motivo text := btrim(coalesce(p_motivo,''));
  v_operating_day date;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR') then
    raise exception 'abc_cajon_no_autorizado';
  end if;
  if p_equipo_id is null then raise exception 'cajon_parametros_requeridos'; end if;
  if p_checkout_id is null and v_motivo = '' then raise exception 'cajon_motivo_requerido'; end if;

  v_request := jsonb_build_object('equipo_id',p_equipo_id,'motivo',v_motivo,'checkout_id',p_checkout_id);
  v_cmd := private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_SIMULAR_APERTURA_CAJON',v_request,p_terminal_id);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_equipo from public.abc_local_equipos e
   where e.empresa_id=p_empresa_id and e.local_id=p_local_id and e.id=p_equipo_id;
  if not found then raise exception 'cajon_equipo_no_encontrado'; end if;
  if not v_equipo.activo then raise exception 'cajon_equipo_inactivo'; end if;
  if v_equipo.tipo <> 'CAJON_MONEDERO' then raise exception 'cajon_equipo_tipo_incorrecto'; end if;

  if not exists (
    select 1 from public.caja_sesiones s
     where s.empresa_id=p_empresa_id and s.local_id=p_local_id and s.estado='ABIERTA'
  ) then
    raise exception 'sesion_caja_no_abierta';
  end if;

  select (public.abc_obtener_dia_operativo_local(p_empresa_id,p_local_id)->>'operating_day')::date into v_operating_day;
  if v_operating_day is null then raise exception 'operating_day_servidor_ausente'; end if;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'EQUIPO',p_equipo_id::text,'CAJON_ABIERTO_SIMULADO',
    jsonb_build_object('equipo_nombre',v_equipo.nombre,'motivo',nullif(v_motivo,''),'checkout_id',p_checkout_id,'modo','SIMULADO'),
    auth.uid(),p_terminal_id,now(),v_operating_day
  );

  v_result := jsonb_build_object(
    'ok',true,'equipo_id',v_equipo.id,'equipo_nombre',v_equipo.nombre,
    'mensaje','Se habría abierto el cajón '||v_equipo.nombre||' (modo simulador: no hay conexión real con el aparato).'
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
exception when others then
  begin perform private.abc_operacion_fallar(p_operation_id,jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)); exception when others then null; end;
  raise;
end $function$;
