-- PM13 P05 corrector: el RPC de pantallas debe abrir la operación antes de auditar.
-- Sin esta corrección, abc_eventos rechaza el operation_id por su FK.

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.abc_pantallas_rol') is null then
    v_missing := array_append(v_missing,'abc_pantallas_rol');
  end if;
  if to_regclass('public.abc_eventos') is null then
    v_missing := array_append(v_missing,'abc_eventos');
  end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then
    v_missing := array_append(v_missing,'abc_operacion_iniciar');
  end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then
    v_missing := array_append(v_missing,'abc_operacion_completar');
  end if;
  if to_regprocedure('private.abc_config_dia_evento(text,text)') is null then
    v_missing := array_append(v_missing,'abc_config_dia_evento');
  end if;
  if cardinality(v_missing) > 0 then
    raise exception 'PM13_P05_RPC_OPERACION_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
end $$;

create or replace function public.abc_configurar_pantalla_rol(
  p_operation_id text, p_empresa_id text, p_local_id text, p_ambito text,
  p_rol text, p_capacidad text, p_permitido boolean, p_motivo text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_ambito text:=upper(btrim(coalesce(p_ambito,'')));
  v_rol text:=btrim(coalesce(p_rol,''));
  v_cap text:=upper(btrim(coalesce(p_capacidad,'')));
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')), '');
  v_cat record;
  v_destino text;
  v_request jsonb;
  v_cmd jsonb;
  v_prev public.abc_pantallas_rol%rowtype;
  v_antes boolean;
  v_version bigint;
  v_ef_antes boolean;
  v_ef_despues boolean;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'abc_config_no_autorizado'; end if;
  if v_ambito not in ('LOCAL','EMPRESA') then raise exception 'capacidad_ambito_invalido'; end if;
  if v_rol not in ('Encargado','Cajero/a','Camarero/a') then raise exception 'capacidad_rol_invalido'; end if;
  if v_motivo is null then raise exception 'capacidad_motivo_requerido'; end if;
  if v_ambito='EMPRESA' then
    if not coalesce(private.abc_config_puede_configurar_empresa(p_empresa_id,p_local_id),false) then raise exception 'abc_config_no_autorizado'; end if;
  elsif not coalesce(private.abc_config_puede_configurar(p_empresa_id,p_local_id),false) then
    raise exception 'abc_config_no_autorizado';
  end if;
  select * into v_cat from private.abc_rol_pantalla_catalogo() where capacidad=v_cap;
  if not found then raise exception 'capacidad_invalida'; end if;
  if not exists(select 1 from public.locales where empresa_id=p_empresa_id and id=p_local_id and activo=true) then
    raise exception 'capacidad_local_no_disponible';
  end if;

  v_destino:=case when v_ambito='EMPRESA' then null else p_local_id end;
  v_request:=jsonb_build_object(
    'ambito',v_ambito,'local_id',p_local_id,'rol',v_rol,'capacidad',v_cap,
    'permitido',p_permitido,'motivo',v_motivo
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIGURAR_PANTALLA_ROL',v_request,null
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  perform pg_advisory_xact_lock(hashtext('abc_pantallas_rol:'||p_empresa_id));
  select * into v_prev from public.abc_pantallas_rol
   where empresa_id=p_empresa_id and local_id is not distinct from v_destino
     and rol=v_rol and capacidad=v_cap for update;
  v_antes:=case when found then v_prev.permitido else null end;
  v_ef_antes:=case
    when v_rol='Encargado' then coalesce(
      (select permitido from public.abc_pantallas_rol where empresa_id=p_empresa_id and local_id=p_local_id and rol=v_rol and capacidad=v_cap),
      (select permitido from public.abc_pantallas_rol where empresa_id=p_empresa_id and local_id is null and rol=v_rol and capacidad=v_cap),
      v_cat.encargado)
    when v_rol='Cajero/a' then coalesce(
      (select permitido from public.abc_pantallas_rol where empresa_id=p_empresa_id and local_id=p_local_id and rol=v_rol and capacidad=v_cap),
      (select permitido from public.abc_pantallas_rol where empresa_id=p_empresa_id and local_id is null and rol=v_rol and capacidad=v_cap),
      v_cat.cajero)
    else coalesce(
      (select permitido from public.abc_pantallas_rol where empresa_id=p_empresa_id and local_id=p_local_id and rol=v_rol and capacidad=v_cap),
      (select permitido from public.abc_pantallas_rol where empresa_id=p_empresa_id and local_id is null and rol=v_rol and capacidad=v_cap),
      v_cat.camarero)
  end;
  if found then
    update public.abc_pantallas_rol
       set permitido=p_permitido,version=version+1,motivo=v_motivo,
           updated_by=auth.uid(),updated_at=now()
     where id=v_prev.id
     returning version into v_version;
  else
    insert into public.abc_pantallas_rol(
      empresa_id,local_id,rol,capacidad,permitido,version,motivo,created_by,updated_by
    ) values(
      p_empresa_id,v_destino,v_rol,v_cap,p_permitido,1,v_motivo,auth.uid(),auth.uid()
    ) returning version into v_version;
  end if;

  v_ef_despues:=case when p_permitido is null then
    case when v_rol='Encargado' then v_cat.encargado when v_rol='Cajero/a' then v_cat.cajero else v_cat.camarero end
    else p_permitido end;
  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,
    actor_user_id,terminal_id,occurred_at,operating_day
  ) values(
    p_empresa_id,p_local_id,p_operation_id,'PANTALLA_ROL',
    coalesce(v_destino,'*')||'/'||v_rol||'/'||v_cap,'PANTALLA_ROL_CONFIGURADA',
    jsonb_build_object(
      'ambito',v_ambito,'local_destino',v_destino,'rol',v_rol,'capacidad',v_cap,
      'anterior',v_antes,'nuevo',p_permitido,'version',v_version,'motivo',v_motivo,
      'efectivo_antes',v_ef_antes,'efectivo_despues',v_ef_despues
    ),auth.uid(),null,now(),private.abc_config_dia_evento(p_empresa_id,p_local_id)
  );
  v_result:=jsonb_build_object(
    'ok',true,'ambito',v_ambito,'local_id',v_destino,'rol',v_rol,'capacidad',v_cap,
    'permitido',p_permitido,'version',v_version,'efectivo_en_local',v_ef_despues
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

revoke all on function public.abc_configurar_pantalla_rol(text,text,text,text,text,text,boolean,text) from public, anon;
grant execute on function public.abc_configurar_pantalla_rol(text,text,text,text,text,text,boolean,text) to authenticated;
