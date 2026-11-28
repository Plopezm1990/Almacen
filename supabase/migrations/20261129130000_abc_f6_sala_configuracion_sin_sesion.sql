-- ABC F6 — configuración administrativa de salas y mesas sin sesión de caja.
--
-- Permite al Propietario preparar el plano de un local antes de abrir la primera
-- caja. Mantiene las RPC A07 operativas sin cambios: mapa de TPV, asignaciones,
-- traslados y liberaciones siguen exigiendo terminal + sesión ABIERTA.
-- No aplicar directamente en QA compartido ni en producción durante este cierre.

do $$
declare
  v_missing text[]:=array[]::text[];
begin
  if to_regprocedure('private.abc_config_puede_configurar(text,text)') is null then v_missing:=array_append(v_missing,'abc_config_puede_configurar'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_config_dia_evento(text,text)') is null then v_missing:=array_append(v_missing,'abc_config_dia_evento'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regclass('public.tpv_zonas') is null then v_missing:=array_append(v_missing,'tpv_zonas'); end if;
  if to_regclass('public.tpv_mesas') is null then v_missing:=array_append(v_missing,'tpv_mesas'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_F6_SALA_CONFIG_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
end $$;

create or replace function public.abc_config_listar_plano_sala(
  p_empresa_id text,
  p_local_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_zonas jsonb;
begin
  if auth.uid() is null
     or not private.abc_config_puede_configurar(p_empresa_id,p_local_id)
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_SALA_CONFIGURAR') then
    raise exception 'sala_configurar_no_autorizada';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'zona_id',z.id,
      'codigo',z.codigo,
      'nombre',z.nombre,
      'tipo',z.tipo,
      'orden',z.orden,
      'version',z.version,
      'activo',z.activo,
      'mesas',coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'mesa_id',m.id,
            'codigo',m.codigo,
            'nombre',m.nombre,
            'capacidad',m.capacidad,
            'orden',m.orden,
            'version',m.version,
            'activo',m.activo,
            'estado_manual',m.estado_manual,
            'notas',m.notas
          ) order by m.orden,m.codigo,m.id
        )
        from public.tpv_mesas m
        where m.empresa_id=z.empresa_id
          and m.local_id=z.local_id
          and m.zona_id=z.id
      ),'[]'::jsonb)
    ) order by z.orden,z.codigo,z.id
  ),'[]'::jsonb)
    into v_zonas
    from public.tpv_zonas z
   where z.empresa_id=p_empresa_id
     and z.local_id=p_local_id;

  return jsonb_build_object(
    'ok',true,
    'configurable',true,
    'operating_day',private.abc_config_dia_evento(p_empresa_id,p_local_id),
    'zonas',v_zonas
  );
end $$;

create or replace function public.abc_config_crear_zona(
  p_operation_id text,p_empresa_id text,p_local_id text,p_zona_id uuid,
  p_codigo text,p_nombre text,p_tipo text,p_orden integer
)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare
  v_codigo text:=upper(btrim(coalesce(p_codigo,'')));
  v_nombre text:=btrim(coalesce(p_nombre,''));
  v_tipo text:=upper(btrim(coalesce(p_tipo,'')));
  v_dia date:=private.abc_config_dia_evento(p_empresa_id,p_local_id);
  v_request jsonb; v_cmd jsonb; v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_config_puede_configurar(p_empresa_id,p_local_id)
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_SALA_CONFIGURAR') then
    raise exception 'sala_configurar_no_autorizada';
  end if;
  if p_zona_id is null then raise exception 'zona_parametros_requeridos'; end if;
  if v_codigo='' or v_nombre='' then raise exception 'zona_codigo_nombre_requeridos'; end if;
  if v_tipo not in ('SALA','TERRAZA','BARRA','EXTERIOR','OTRO') then raise exception 'zona_tipo_invalido'; end if;
  if p_orden is null or p_orden<0 then raise exception 'zona_orden_invalido'; end if;

  v_request:=jsonb_build_object('origen','CONFIG_SALA','zona_id',p_zona_id,'codigo',v_codigo,'nombre',v_nombre,'tipo',v_tipo,'orden',p_orden);
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIG_CREAR_ZONA',v_request,null);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  insert into public.tpv_zonas(id,empresa_id,local_id,codigo,nombre,tipo,orden,created_by)
  values(p_zona_id,p_empresa_id,p_local_id,v_codigo,v_nombre,v_tipo,p_orden,auth.uid());

  insert into public.abc_eventos(empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day)
  values(p_empresa_id,p_local_id,p_operation_id,'ZONA',p_zona_id::text,'ZONA_CONFIGURADA',
    jsonb_build_object('origen','CONFIG_SALA','accion','CREAR','codigo',v_codigo,'nombre',v_nombre,'tipo',v_tipo,'orden',p_orden,'version',1),
    auth.uid(),null,now(),v_dia);

  v_result:=jsonb_build_object('ok',true,'zona_id',p_zona_id,'version',1,'codigo',v_codigo,'tipo',v_tipo,'activo',true);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create or replace function public.abc_config_actualizar_zona(
  p_operation_id text,p_empresa_id text,p_local_id text,p_zona_id uuid,
  p_codigo text,p_nombre text,p_tipo text,p_orden integer,p_activo boolean,
  p_expected_version bigint
)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare
  v_zona public.tpv_zonas%rowtype;
  v_codigo text:=upper(btrim(coalesce(p_codigo,'')));
  v_nombre text:=btrim(coalesce(p_nombre,''));
  v_tipo text:=upper(btrim(coalesce(p_tipo,'')));
  v_dia date:=private.abc_config_dia_evento(p_empresa_id,p_local_id);
  v_request jsonb; v_cmd jsonb; v_result jsonb; v_new bigint;
begin
  if auth.uid() is null
     or not private.abc_config_puede_configurar(p_empresa_id,p_local_id)
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_SALA_CONFIGURAR') then
    raise exception 'sala_configurar_no_autorizada';
  end if;
  if p_zona_id is null or p_activo is null or p_expected_version is null then raise exception 'zona_parametros_requeridos'; end if;
  if v_codigo='' or v_nombre='' or p_orden is null or p_orden<0 then raise exception 'zona_datos_invalidos'; end if;
  if v_tipo not in ('SALA','TERRAZA','BARRA','EXTERIOR','OTRO') then raise exception 'zona_tipo_invalido'; end if;

  v_request:=jsonb_build_object('origen','CONFIG_SALA','zona_id',p_zona_id,'codigo',v_codigo,'nombre',v_nombre,'tipo',v_tipo,'orden',p_orden,'activo',p_activo,'expected_version',p_expected_version);
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIG_ACTUALIZAR_ZONA',v_request,null);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_zona from public.tpv_zonas
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_zona_id for update;
  if not found then raise exception 'zona_no_encontrada'; end if;
  if v_zona.version<>p_expected_version then raise exception 'zona_version_conflict'; end if;
  if (not p_activo or v_zona.tipo<>v_tipo) and exists(
    select 1 from public.tpv_mesas m
    join public.cuenta_mesa_asignaciones a on a.empresa_id=m.empresa_id and a.local_id=m.local_id and a.mesa_id=m.id and a.hasta is null
    where m.empresa_id=p_empresa_id and m.local_id=p_local_id and m.zona_id=p_zona_id
  ) then raise exception 'zona_con_ocupacion_activa'; end if;
  if not p_activo and exists(
    select 1 from public.tpv_mesas m
    where m.empresa_id=p_empresa_id and m.local_id=p_local_id and m.zona_id=p_zona_id and m.activo
  ) then raise exception 'zona_con_mesas_activas'; end if;

  update public.tpv_zonas
     set codigo=v_codigo,nombre=v_nombre,tipo=v_tipo,orden=p_orden,activo=p_activo,version=version+1,updated_at=now()
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_zona_id
  returning version into v_new;

  insert into public.abc_eventos(empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day)
  values(p_empresa_id,p_local_id,p_operation_id,'ZONA',p_zona_id::text,'ZONA_CONFIGURADA',
    jsonb_build_object('origen','CONFIG_SALA','accion','ACTUALIZAR','codigo',v_codigo,'nombre',v_nombre,'tipo',v_tipo,'orden',p_orden,'activo',p_activo,'version',v_new),
    auth.uid(),null,now(),v_dia);

  v_result:=jsonb_build_object('ok',true,'zona_id',p_zona_id,'version',v_new,'activo',p_activo);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create or replace function public.abc_config_crear_mesa(
  p_operation_id text,p_empresa_id text,p_local_id text,p_mesa_id uuid,p_zona_id uuid,
  p_codigo text,p_nombre text,p_capacidad integer,p_orden integer
)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare
  v_codigo text:=upper(btrim(coalesce(p_codigo,'')));
  v_nombre text:=btrim(coalesce(p_nombre,''));
  v_dia date:=private.abc_config_dia_evento(p_empresa_id,p_local_id);
  v_request jsonb; v_cmd jsonb; v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_config_puede_configurar(p_empresa_id,p_local_id)
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_SALA_CONFIGURAR') then
    raise exception 'sala_configurar_no_autorizada';
  end if;
  if p_mesa_id is null or p_zona_id is null then raise exception 'mesa_parametros_requeridos'; end if;
  if v_codigo='' or v_nombre='' or p_capacidad is null or p_capacidad<1 or p_capacidad>999 or p_orden is null or p_orden<0 then raise exception 'mesa_datos_invalidos'; end if;
  if not exists(select 1 from public.tpv_zonas z where z.empresa_id=p_empresa_id and z.local_id=p_local_id and z.id=p_zona_id and z.activo) then raise exception 'zona_no_activa'; end if;

  v_request:=jsonb_build_object('origen','CONFIG_SALA','mesa_id',p_mesa_id,'zona_id',p_zona_id,'codigo',v_codigo,'nombre',v_nombre,'capacidad',p_capacidad,'orden',p_orden);
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIG_CREAR_MESA',v_request,null);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  insert into public.tpv_mesas(id,empresa_id,local_id,zona_id,codigo,nombre,capacidad,orden,created_by)
  values(p_mesa_id,p_empresa_id,p_local_id,p_zona_id,v_codigo,v_nombre,p_capacidad,p_orden,auth.uid());

  insert into public.abc_eventos(empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day)
  values(p_empresa_id,p_local_id,p_operation_id,'MESA',p_mesa_id::text,'MESA_CONFIGURADA',
    jsonb_build_object('origen','CONFIG_SALA','accion','CREAR','zona_id',p_zona_id,'codigo',v_codigo,'nombre',v_nombre,'capacidad',p_capacidad,'orden',p_orden,'version',1),
    auth.uid(),null,now(),v_dia);

  v_result:=jsonb_build_object('ok',true,'mesa_id',p_mesa_id,'zona_id',p_zona_id,'version',1,'activo',true);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create or replace function public.abc_config_actualizar_mesa(
  p_operation_id text,p_empresa_id text,p_local_id text,p_mesa_id uuid,p_zona_id uuid,
  p_codigo text,p_nombre text,p_capacidad integer,p_orden integer,p_activo boolean,p_notas text,
  p_expected_version bigint
)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare
  v_mesa public.tpv_mesas%rowtype;
  v_codigo text:=upper(btrim(coalesce(p_codigo,'')));
  v_nombre text:=btrim(coalesce(p_nombre,''));
  v_notas text:=nullif(btrim(coalesce(p_notas,'')),'');
  v_dia date:=private.abc_config_dia_evento(p_empresa_id,p_local_id);
  v_request jsonb; v_cmd jsonb; v_result jsonb; v_new bigint;
begin
  if auth.uid() is null
     or not private.abc_config_puede_configurar(p_empresa_id,p_local_id)
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_SALA_CONFIGURAR') then
    raise exception 'sala_configurar_no_autorizada';
  end if;
  if p_mesa_id is null or p_zona_id is null or p_activo is null or p_expected_version is null then raise exception 'mesa_parametros_requeridos'; end if;
  if v_codigo='' or v_nombre='' or p_capacidad is null or p_capacidad<1 or p_capacidad>999 or p_orden is null or p_orden<0 then raise exception 'mesa_datos_invalidos'; end if;
  if not exists(select 1 from public.tpv_zonas z where z.empresa_id=p_empresa_id and z.local_id=p_local_id and z.id=p_zona_id and z.activo) then raise exception 'zona_no_activa'; end if;

  v_request:=jsonb_build_object('origen','CONFIG_SALA','mesa_id',p_mesa_id,'zona_id',p_zona_id,'codigo',v_codigo,'nombre',v_nombre,'capacidad',p_capacidad,'orden',p_orden,'activo',p_activo,'notas',v_notas,'expected_version',p_expected_version);
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIG_ACTUALIZAR_MESA',v_request,null);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_mesa from public.tpv_mesas
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_mesa_id for update;
  if not found then raise exception 'mesa_no_encontrada'; end if;
  if v_mesa.version<>p_expected_version then raise exception 'mesa_version_conflict'; end if;
  if (not p_activo or v_mesa.zona_id<>p_zona_id) and exists(
    select 1 from public.cuenta_mesa_asignaciones a
    where a.empresa_id=p_empresa_id and a.local_id=p_local_id and a.mesa_id=p_mesa_id and a.hasta is null
  ) then raise exception 'mesa_ocupada_no_reconfigurable'; end if;

  update public.tpv_mesas
     set zona_id=p_zona_id,codigo=v_codigo,nombre=v_nombre,capacidad=p_capacidad,orden=p_orden,activo=p_activo,notas=v_notas,version=version+1,updated_at=now()
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_mesa_id
  returning version into v_new;

  insert into public.abc_eventos(empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day)
  values(p_empresa_id,p_local_id,p_operation_id,'MESA',p_mesa_id::text,'MESA_CONFIGURADA',
    jsonb_build_object('origen','CONFIG_SALA','accion','ACTUALIZAR','zona_anterior',v_mesa.zona_id,'zona_actual',p_zona_id,'codigo',v_codigo,'nombre',v_nombre,'capacidad',p_capacidad,'orden',p_orden,'activo',p_activo,'notas',v_notas,'version',v_new),
    auth.uid(),null,now(),v_dia);

  v_result:=jsonb_build_object('ok',true,'mesa_id',p_mesa_id,'version',v_new,'activo',p_activo);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

revoke all on function public.abc_config_listar_plano_sala(text,text) from public,anon,authenticated,service_role;
revoke all on function public.abc_config_crear_zona(text,text,text,uuid,text,text,text,integer) from public,anon,authenticated,service_role;
revoke all on function public.abc_config_actualizar_zona(text,text,text,uuid,text,text,text,integer,boolean,bigint) from public,anon,authenticated,service_role;
revoke all on function public.abc_config_crear_mesa(text,text,text,uuid,uuid,text,text,integer,integer) from public,anon,authenticated,service_role;
revoke all on function public.abc_config_actualizar_mesa(text,text,text,uuid,uuid,text,text,integer,integer,boolean,text,bigint) from public,anon,authenticated,service_role;
grant execute on function public.abc_config_listar_plano_sala(text,text) to authenticated;
grant execute on function public.abc_config_crear_zona(text,text,text,uuid,text,text,text,integer) to authenticated;
grant execute on function public.abc_config_actualizar_zona(text,text,text,uuid,text,text,text,integer,boolean,bigint) to authenticated;
grant execute on function public.abc_config_crear_mesa(text,text,text,uuid,uuid,text,text,integer,integer) to authenticated;
grant execute on function public.abc_config_actualizar_mesa(text,text,text,uuid,uuid,text,text,integer,integer,boolean,text,bigint) to authenticated;
