-- ABC · configuración segura de terminal TPV y caja física por Propietario.
-- QA primero. La clave/PIN local no es una credencial de servidor: la autoridad
-- real es la sesión autenticada y private.abc_config_puede_configurar().
-- No guarda secretos, certificados ni contraseñas del dispositivo.

set local lock_timeout = '10s';

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.locales') is null then v_missing:=array_append(v_missing,'locales'); end if;
  if to_regclass('public.terminales_tpv') is null then v_missing:=array_append(v_missing,'terminales_tpv'); end if;
  if to_regclass('public.cajas_fisicas') is null then v_missing:=array_append(v_missing,'cajas_fisicas'); end if;
  if to_regclass('public.caja_sesiones') is null then v_missing:=array_append(v_missing,'caja_sesiones'); end if;
  if to_regclass('public.caja_sesion_terminales') is null then v_missing:=array_append(v_missing,'caja_sesion_terminales'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.abc_config_puede_configurar(text,text)') is null then v_missing:=array_append(v_missing,'abc_config_puede_configurar'); end if;
  if to_regprocedure('private.abc_config_dia_evento(text,text)') is null then v_missing:=array_append(v_missing,'abc_config_dia_evento'); end if;
  if to_regprocedure('private.la_tiene_local(text,text)') is null then v_missing:=array_append(v_missing,'la_tiene_local'); end if;
  if to_regprocedure('auth.uid()') is null then v_missing:=array_append(v_missing,'auth.uid'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_F8_C04_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
end $$;

comment on table public.terminales_tpv is
  'Terminales TPV operativos por empresa y local. Alta y cambios por abc_configurar_terminal_tpv; nunca por acceso directo.';
comment on table public.cajas_fisicas is
  'Cajas físicas operativas por empresa y local. Alta y cambios por abc_configurar_caja_fisica; nunca por acceso directo.';

-- 1. Alta o actualización de terminal TPV. La identidad del dispositivo es
-- opcional y opaca; no es una contraseña ni concede permisos.
create or replace function public.abc_configurar_terminal_tpv(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_terminal_id uuid,
  p_nombre text,
  p_device_key text,
  p_capacidades jsonb,
  p_activo boolean,
  p_motivo text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_nombre text:=nullif(btrim(coalesce(p_nombre,'')), '');
  v_device_key text:=nullif(btrim(coalesce(p_device_key,'')), '');
  v_device_key_efectiva text;
  v_capacidades jsonb:=coalesce(p_capacidades,'{}'::jsonb);
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')), '');
  v_request jsonb;
  v_cmd jsonb;
  v_prev public.terminales_tpv%rowtype;
  v_found boolean;
  v_cambio boolean;
  v_creado boolean;
  v_anterior jsonb;
  v_nuevo jsonb;
  v_result jsonb;
begin
  if auth.uid() is null or not private.abc_config_puede_configurar(p_empresa_id,p_local_id) then
    raise exception 'abc_config_no_autorizado';
  end if;
  if p_terminal_id is null then raise exception 'terminal_id_requerido'; end if;
  if v_nombre is null or char_length(v_nombre)>80 then raise exception 'terminal_nombre_invalido'; end if;
  if v_device_key is not null and char_length(v_device_key)>120 then raise exception 'terminal_device_key_invalida'; end if;
  if jsonb_typeof(v_capacidades)<>'object' then raise exception 'terminal_capacidades_invalidas'; end if;
  if p_activo is null then raise exception 'terminal_estado_requerido'; end if;
  if v_motivo is null then raise exception 'terminal_motivo_requerido'; end if;
  if not exists(
    select 1 from public.locales l
     where l.empresa_id=p_empresa_id and l.id=p_local_id and l.activo=true
  ) then
    raise exception 'terminal_local_no_disponible';
  end if;

  v_request:=jsonb_build_object(
    'terminal_id',p_terminal_id,'nombre',v_nombre,'device_key_present',v_device_key is not null,
    'capacidades',v_capacidades,'activo',p_activo,'motivo',v_motivo
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIGURAR_TERMINAL_TPV',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('abc_terminales:'||p_empresa_id||'/'||p_local_id));
  select * into v_prev
    from public.terminales_tpv t
   where t.empresa_id=p_empresa_id and t.local_id=p_local_id and t.id=p_terminal_id
   for update;
  v_found:=found;
  -- NULL significa «no cambiar la identidad existente» en una actualización;
  -- una nueva alta sin device_key sigue siendo válida y queda pendiente de vinculación.
  v_device_key_efectiva:=case when v_found and p_device_key is null then v_prev.device_key else v_device_key end;

  if not v_found and exists(select 1 from public.terminales_tpv t where t.id=p_terminal_id) then
    raise exception 'terminal_id_en_uso';
  end if;
  if v_device_key_efectiva is not null and exists(
    select 1 from public.terminales_tpv t
     where t.empresa_id=p_empresa_id and t.local_id=p_local_id
       and t.device_key=v_device_key_efectiva and t.id<>p_terminal_id
  ) then
    raise exception 'terminal_device_key_duplicada';
  end if;
  if v_found and v_prev.activo=true and p_activo=false and exists(
    select 1 from public.caja_sesion_terminales st
     join public.caja_sesiones s on s.empresa_id=st.empresa_id and s.local_id=st.local_id and s.id=st.session_id
    where st.empresa_id=p_empresa_id and st.local_id=p_local_id and st.terminal_id=p_terminal_id
      and st.hasta is null and s.estado in ('PREPARANDO_APERTURA','ABIERTA','EN_CIERRE','CIERRE_PROVISIONAL')
  ) then
    raise exception 'terminal_sesion_abierta';
  end if;

  v_nuevo:=jsonb_build_object(
    'nombre',v_nombre,'device_key_present',v_device_key_efectiva is not null,'capacidades',v_capacidades,'activo',p_activo
  );
  if not v_found then
    v_creado:=true; v_cambio:=true;
    insert into public.terminales_tpv(id,empresa_id,local_id,nombre,device_key,activo,capacidades)
    values(p_terminal_id,p_empresa_id,p_local_id,v_nombre,v_device_key_efectiva,p_activo,v_capacidades);
    insert into public.abc_eventos(
      empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day
    ) values(
      p_empresa_id,p_local_id,p_operation_id,'TERMINAL_TPV',p_terminal_id::text,'TERMINAL_TPV_REGISTRADO',
      jsonb_build_object('terminal',v_nuevo,'motivo',v_motivo),auth.uid(),p_terminal_id,now(),private.abc_config_dia_evento(p_empresa_id,p_local_id)
    );
  else
    v_creado:=false;
    v_anterior:=jsonb_build_object(
      'nombre',v_prev.nombre,'device_key_present',v_prev.device_key is not null,'capacidades',v_prev.capacidades,'activo',v_prev.activo
    );
    v_cambio:=v_anterior is distinct from v_nuevo;
    if v_cambio then
      update public.terminales_tpv
         set nombre=v_nombre,device_key=v_device_key_efectiva,activo=p_activo,capacidades=v_capacidades
       where empresa_id=p_empresa_id and local_id=p_local_id and id=p_terminal_id;
      insert into public.abc_eventos(
        empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day
      ) values(
        p_empresa_id,p_local_id,p_operation_id,'TERMINAL_TPV',p_terminal_id::text,'TERMINAL_TPV_ACTUALIZADO',
        jsonb_build_object('anterior',v_anterior,'nuevo',v_nuevo,'motivo',v_motivo),auth.uid(),p_terminal_id,now(),private.abc_config_dia_evento(p_empresa_id,p_local_id)
      );
    end if;
  end if;

  v_result:=jsonb_build_object('ok',true,'terminal_id',p_terminal_id,'creado',v_creado,'cambio',v_cambio,'terminal',v_nuevo);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

-- 2. Alta o actualización de caja física. No se permite desactivar una caja
-- que tenga una sesión de caja abierta.
create or replace function public.abc_configurar_caja_fisica(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_caja_id uuid,
  p_nombre text,
  p_activo boolean,
  p_motivo text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_nombre text:=nullif(btrim(coalesce(p_nombre,'')), '');
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')), '');
  v_request jsonb;
  v_cmd jsonb;
  v_prev public.cajas_fisicas%rowtype;
  v_found boolean;
  v_cambio boolean;
  v_creado boolean;
  v_anterior jsonb;
  v_nuevo jsonb;
  v_result jsonb;
begin
  if auth.uid() is null or not private.abc_config_puede_configurar(p_empresa_id,p_local_id) then
    raise exception 'abc_config_no_autorizado';
  end if;
  if p_caja_id is null then raise exception 'caja_id_requerido'; end if;
  if v_nombre is null or char_length(v_nombre)>80 then raise exception 'caja_nombre_invalido'; end if;
  if p_activo is null then raise exception 'caja_estado_requerido'; end if;
  if v_motivo is null then raise exception 'caja_motivo_requerido'; end if;
  if not exists(
    select 1 from public.locales l
     where l.empresa_id=p_empresa_id and l.id=p_local_id and l.activo=true
  ) then
    raise exception 'caja_local_no_disponible';
  end if;

  v_request:=jsonb_build_object('caja_id',p_caja_id,'nombre',v_nombre,'activo',p_activo,'motivo',v_motivo);
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIGURAR_CAJA_FISICA',v_request,null
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('abc_cajas:'||p_empresa_id||'/'||p_local_id));
  select * into v_prev
    from public.cajas_fisicas c
   where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.id=p_caja_id
   for update;
  v_found:=found;
  if not v_found and exists(select 1 from public.cajas_fisicas c where c.id=p_caja_id) then
    raise exception 'caja_id_en_uso';
  end if;
  if v_found and v_prev.activo=true and p_activo=false and exists(
    select 1 from public.caja_sesiones s
     where s.empresa_id=p_empresa_id and s.local_id=p_local_id and s.caja_id=p_caja_id
       and s.estado in ('PREPARANDO_APERTURA','ABIERTA','EN_CIERRE','CIERRE_PROVISIONAL')
  ) then
    raise exception 'caja_sesion_abierta';
  end if;

  v_nuevo:=jsonb_build_object('nombre',v_nombre,'activo',p_activo);
  if not v_found then
    v_creado:=true; v_cambio:=true;
    insert into public.cajas_fisicas(id,empresa_id,local_id,nombre,activo)
    values(p_caja_id,p_empresa_id,p_local_id,v_nombre,p_activo);
    insert into public.abc_eventos(
      empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day
    ) values(
      p_empresa_id,p_local_id,p_operation_id,'CAJA_FISICA',p_caja_id::text,'CAJA_FISICA_REGISTRADA',
      jsonb_build_object('caja',v_nuevo,'motivo',v_motivo),auth.uid(),null,now(),private.abc_config_dia_evento(p_empresa_id,p_local_id)
    );
  else
    v_creado:=false;
    v_anterior:=jsonb_build_object('nombre',v_prev.nombre,'activo',v_prev.activo);
    v_cambio:=v_anterior is distinct from v_nuevo;
    if v_cambio then
      update public.cajas_fisicas
         set nombre=v_nombre,activo=p_activo
       where empresa_id=p_empresa_id and local_id=p_local_id and id=p_caja_id;
      insert into public.abc_eventos(
        empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day
      ) values(
        p_empresa_id,p_local_id,p_operation_id,'CAJA_FISICA',p_caja_id::text,'CAJA_FISICA_ACTUALIZADA',
        jsonb_build_object('anterior',v_anterior,'nuevo',v_nuevo,'motivo',v_motivo),auth.uid(),null,now(),private.abc_config_dia_evento(p_empresa_id,p_local_id)
      );
    end if;
  end if;

  v_result:=jsonb_build_object('ok',true,'caja_id',p_caja_id,'creado',v_creado,'cambio',v_cambio,'caja',v_nuevo);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

-- 3. Lectura de la configuración operativa del local. El dispositivo opaco no
-- se devuelve; solo se indica si está vinculado para no exponer identificadores.
create function public.abc_listar_terminales_cajas_local(
  p_empresa_id text,
  p_local_id text,
  p_incluir_inactivos boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if auth.uid() is null
     or nullif(btrim(coalesce(p_empresa_id,'')),'') is null
     or nullif(btrim(coalesce(p_local_id,'')),'') is null
     or not coalesce(private.la_tiene_local(p_empresa_id,p_local_id),false) then
    raise exception 'abc_config_no_autorizado';
  end if;
  return jsonb_build_object(
    'terminales',coalesce((select jsonb_agg(jsonb_build_object(
      'id',t.id,'nombre',t.nombre,'activo',t.activo,'capacidades',t.capacidades,
      'device_key_present',t.device_key is not null
    ) order by t.activo desc,lower(btrim(t.nombre)),t.id)
    from public.terminales_tpv t
    where t.empresa_id=p_empresa_id and t.local_id=p_local_id
      and (coalesce(p_incluir_inactivos,false) or t.activo=true)),'[]'::jsonb),
    'cajas',coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.id,'nombre',c.nombre,'activo',c.activo
    ) order by c.activo desc,lower(btrim(c.nombre)),c.id)
    from public.cajas_fisicas c
    where c.empresa_id=p_empresa_id and c.local_id=p_local_id
      and (coalesce(p_incluir_inactivos,false) or c.activo=true)),'[]'::jsonb)
  );
end $$;

revoke all on function public.abc_configurar_terminal_tpv(text,text,text,uuid,text,text,jsonb,boolean,text)
  from public,anon,authenticated,service_role;
revoke all on function public.abc_configurar_caja_fisica(text,text,text,uuid,text,boolean,text)
  from public,anon,authenticated,service_role;
revoke all on function public.abc_listar_terminales_cajas_local(text,text,boolean)
  from public,anon,authenticated,service_role;
grant execute on function public.abc_configurar_terminal_tpv(text,text,text,uuid,text,text,jsonb,boolean,text) to authenticated;
grant execute on function public.abc_configurar_caja_fisica(text,text,text,uuid,text,boolean,text) to authenticated;
grant execute on function public.abc_listar_terminales_cajas_local(text,text,boolean) to authenticated;
