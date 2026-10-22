-- ABC F3 A10B — auditoría append-only de estaciones, rutas y comandas.
-- Aditiva sobre A10. No crea datos reales, no muta stock, pagos ni fiscalidad.
-- Reutiliza public.abc_eventos como registro de auditoría de negocio.

do $$
declare
  v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regclass('public.tpv_estaciones_preparacion') is null then v_missing:=array_append(v_missing,'tpv_estaciones_preparacion'); end if;
  if to_regclass('public.tpv_producto_estaciones') is null then v_missing:=array_append(v_missing,'tpv_producto_estaciones'); end if;
  if to_regclass('public.comandas_preparacion') is null then v_missing:=array_append(v_missing,'comandas_preparacion'); end if;
  if to_regclass('public.comanda_lineas') is null then v_missing:=array_append(v_missing,'comanda_lineas'); end if;
  if to_regprocedure('private.abc_a10_procesar_transiciones_linea()') is null then v_missing:=array_append(v_missing,'abc_a10_procesar_transiciones_linea'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_F3_A10B_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
end $$;

create or replace function private.abc_a10_procesar_transiciones_linea()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  g record;
  v_comanda_id uuid;
begin
  for g in
    with routed as (
      select n.empresa_id,n.local_id,n.operation_id,n.pedido_id,n.linea_id,
             n.estado_anterior,n.estado_nuevo,n.actor_user_id,
             n.terminal_id,n.operating_day,
             l.producto_id,l.cantidad,l.version,
             private.abc_a10_estacion_producto(n.empresa_id,n.local_id,l.producto_id) estacion_id,
             private.abc_a10_snapshot_linea(n.empresa_id,n.local_id,n.linea_id) snapshot
        from a10_new_transitions n
        join public.pedido_lineas l
          on l.empresa_id=n.empresa_id and l.local_id=n.local_id and l.id=n.linea_id
       where n.estado_nuevo in ('ENVIADA','CANCELADA')
    )
    select empresa_id,local_id,operation_id,pedido_id,actor_user_id,terminal_id,operating_day,estacion_id,
           case when estado_nuevo='ENVIADA' then 'NUEVA' else 'CANCELACION' end tipo,
           coalesce(estacion_id::text,'SIN_RUTA') route_key
      from routed
     group by empresa_id,local_id,operation_id,pedido_id,actor_user_id,terminal_id,operating_day,estacion_id,
              case when estado_nuevo='ENVIADA' then 'NUEVA' else 'CANCELACION' end
  loop
    insert into public.comandas_preparacion(
      empresa_id,local_id,pedido_id,estacion_id,operation_id,tipo,route_key,
      estado,version,created_by
    ) values (
      g.empresa_id,g.local_id,g.pedido_id,g.estacion_id,g.operation_id,g.tipo,g.route_key,
      case when g.estacion_id is null then 'BLOQUEADA' else 'PENDIENTE' end,
      1,g.actor_user_id
    )
    on conflict (empresa_id,operation_id,route_key,tipo) do nothing
    returning id into v_comanda_id;

    if v_comanda_id is null then
      select id into v_comanda_id
        from public.comandas_preparacion
       where empresa_id=g.empresa_id
         and operation_id=g.operation_id
         and route_key=g.route_key
         and tipo=g.tipo;
    end if;

    insert into public.comanda_lineas(
      empresa_id,local_id,comanda_id,pedido_id,linea_id,accion,
      estado_anterior,estado_objetivo,linea_version,producto_id,cantidad,
      nota,decision_merma,snapshot
    )
    select r.empresa_id,r.local_id,v_comanda_id,r.pedido_id,r.linea_id,
           case when r.estado_nuevo='ENVIADA' then 'ALTA' else 'CANCELACION' end,
           r.estado_anterior,r.estado_nuevo,r.version,r.producto_id,r.cantidad,
           null,
           case when r.estado_nuevo='CANCELADA' and r.estado_anterior='PREPARADA'
                then 'PENDIENTE' else 'NO_APLICA' end,
           r.snapshot
      from (
        select n.empresa_id,n.local_id,n.operation_id,n.pedido_id,n.linea_id,
               n.estado_anterior,n.estado_nuevo,
               l.producto_id,l.cantidad,l.version,
               private.abc_a10_estacion_producto(n.empresa_id,n.local_id,l.producto_id) estacion_id,
               private.abc_a10_snapshot_linea(n.empresa_id,n.local_id,n.linea_id) snapshot
          from a10_new_transitions n
          join public.pedido_lineas l
            on l.empresa_id=n.empresa_id and l.local_id=n.local_id and l.id=n.linea_id
         where n.estado_nuevo in ('ENVIADA','CANCELADA')
      ) r
     where r.empresa_id=g.empresa_id and r.local_id=g.local_id
       and r.operation_id=g.operation_id and r.pedido_id=g.pedido_id
       and r.estacion_id is not distinct from g.estacion_id
       and (case when r.estado_nuevo='ENVIADA' then 'NUEVA' else 'CANCELACION' end)=g.tipo
    on conflict (comanda_id,linea_id,accion) do nothing;

    insert into public.abc_eventos(
      empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
      payload,actor_user_id,terminal_id,occurred_at,operating_day
    ) values (
      g.empresa_id,g.local_id,g.operation_id,'COMANDA_PREPARACION',v_comanda_id::text,
      case when g.tipo='NUEVA' then 'COMANDA_PREPARACION_GENERADA'
           else 'COMANDA_CANCELACION_GENERADA' end,
      jsonb_build_object(
        'pedido_id',g.pedido_id,'estacion_id',g.estacion_id,'tipo',g.tipo,
        'route_key',g.route_key,
        'estado',case when g.estacion_id is null then 'BLOQUEADA' else 'PENDIENTE' end,
        'lineas',(select count(*) from public.comanda_lineas cl where cl.comanda_id=v_comanda_id)
      ),
      g.actor_user_id,g.terminal_id,clock_timestamp(),g.operating_day
    );

    perform private.abc_a10_encolar_comanda(v_comanda_id);
  end loop;

  return null;
end $$;

create or replace function public.abc_crear_estacion_preparacion(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_estacion_id uuid,
  p_codigo text,
  p_nombre text,
  p_tipo text,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_codigo text:=upper(btrim(coalesce(p_codigo,'')));
  v_nombre text:=btrim(coalesce(p_nombre,''));
  v_tipo text:=upper(btrim(coalesce(p_tipo,'')));
  v_request jsonb;
  v_cmd jsonb;
  v_result jsonb;
begin
  if not private.abc_a10_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COMANDA_CONFIGURAR') then
    raise exception 'comanda_configurar_no_autorizado';
  end if;
  if p_estacion_id is null or v_codigo='' or v_nombre='' or v_tipo not in ('COCINA','CHURRERIA','BARRA','BEBIDAS','OTRO')
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'estacion_parametros_invalidos';
  end if;
  if not private.abc_terminal_sesion_operativa(p_empresa_id,p_local_id,p_terminal_id,p_session_id) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  v_request:=jsonb_build_object('estacion_id',p_estacion_id,'codigo',v_codigo,'nombre',v_nombre,'tipo',v_tipo);
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_CREAR_ESTACION_PREPARACION',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  insert into public.tpv_estaciones_preparacion(
    id,empresa_id,local_id,codigo,nombre,tipo,activo,version,created_by
  ) values (
    p_estacion_id,p_empresa_id,p_local_id,v_codigo,v_nombre,v_tipo,true,1,auth.uid()
  );

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'ESTACION_PREPARACION',p_estacion_id::text,
    'ESTACION_PREPARACION_CREADA',
    jsonb_build_object('codigo',v_codigo,'nombre',v_nombre,'tipo',v_tipo,'activo',true,'version',1,'session_id',p_session_id),
    auth.uid(),p_terminal_id,clock_timestamp(),p_operating_day
  );

  v_result:=jsonb_build_object('ok',true,'estacion_id',p_estacion_id,'version',1,'activo',true);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create or replace function public.abc_actualizar_estacion_preparacion(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_estacion_id uuid,
  p_nombre text,
  p_tipo text,
  p_activo boolean,
  p_expected_version bigint,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_est public.tpv_estaciones_preparacion%rowtype;
  v_nombre text:=btrim(coalesce(p_nombre,''));
  v_tipo text:=upper(btrim(coalesce(p_tipo,'')));
  v_request jsonb;
  v_cmd jsonb;
  v_result jsonb;
  v_version bigint;
begin
  if not private.abc_a10_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COMANDA_CONFIGURAR') then
    raise exception 'comanda_configurar_no_autorizado';
  end if;
  if p_estacion_id is null or v_nombre='' or v_tipo not in ('COCINA','CHURRERIA','BARRA','BEBIDAS','OTRO')
     or p_activo is null or p_expected_version is null or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'estacion_parametros_invalidos';
  end if;
  if not private.abc_terminal_sesion_operativa(p_empresa_id,p_local_id,p_terminal_id,p_session_id) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  v_request:=jsonb_build_object('estacion_id',p_estacion_id,'nombre',v_nombre,'tipo',v_tipo,'activo',p_activo,'expected_version',p_expected_version);
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_ACTUALIZAR_ESTACION_PREPARACION',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_est from public.tpv_estaciones_preparacion
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_estacion_id for update;
  if not found then raise exception 'estacion_no_encontrada'; end if;
  if v_est.version<>p_expected_version then raise exception 'estacion_version_conflict'; end if;

  update public.tpv_estaciones_preparacion
     set nombre=v_nombre,tipo=v_tipo,activo=p_activo,version=version+1,updated_at=now()
   where id=p_estacion_id
  returning version into v_version;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'ESTACION_PREPARACION',p_estacion_id::text,
    'ESTACION_PREPARACION_ACTUALIZADA',
    jsonb_build_object(
      'before',jsonb_build_object('nombre',v_est.nombre,'tipo',v_est.tipo,'activo',v_est.activo,'version',v_est.version),
      'after',jsonb_build_object('nombre',v_nombre,'tipo',v_tipo,'activo',p_activo,'version',v_version),
      'session_id',p_session_id
    ),
    auth.uid(),p_terminal_id,clock_timestamp(),p_operating_day
  );

  v_result:=jsonb_build_object('ok',true,'estacion_id',p_estacion_id,'version',v_version,'activo',p_activo);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create or replace function public.abc_asignar_producto_estacion(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_producto_id text,
  p_estacion_id uuid,
  p_prioridad smallint,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_producto text:=btrim(coalesce(p_producto_id,''));
  v_request jsonb;
  v_cmd jsonb;
  v_result jsonb;
begin
  if not private.abc_a10_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COMANDA_CONFIGURAR') then
    raise exception 'comanda_configurar_no_autorizado';
  end if;
  if v_producto='' or p_estacion_id is null or p_prioridad is null or p_prioridad<1 or p_prioridad>100
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'producto_estacion_parametros_invalidos';
  end if;
  if not private.abc_terminal_sesion_operativa(p_empresa_id,p_local_id,p_terminal_id,p_session_id) then
    raise exception 'terminal_sesion_no_operativa';
  end if;
  if not exists(
    select 1 from public.catalogo_tpv_productos c
     where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.producto_id=v_producto and c.activo=true
  ) then raise exception 'producto_tpv_no_disponible'; end if;
  if not exists(
    select 1 from public.tpv_estaciones_preparacion e
     where e.empresa_id=p_empresa_id and e.local_id=p_local_id and e.id=p_estacion_id and e.activo=true
  ) then raise exception 'estacion_no_operativa'; end if;

  v_request:=jsonb_build_object('producto_id',v_producto,'estacion_id',p_estacion_id,'prioridad',p_prioridad);
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_ASIGNAR_PRODUCTO_ESTACION',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  update public.tpv_producto_estaciones
     set activo=false,version=version+1,updated_at=now()
   where empresa_id=p_empresa_id and local_id=p_local_id and producto_id=v_producto
     and activo=true and estacion_id<>p_estacion_id;

  insert into public.tpv_producto_estaciones(
    empresa_id,local_id,producto_id,estacion_id,prioridad,activo,version,created_by
  ) values (
    p_empresa_id,p_local_id,v_producto,p_estacion_id,p_prioridad,true,1,auth.uid()
  )
  on conflict (empresa_id,local_id,producto_id,estacion_id)
  do update set prioridad=excluded.prioridad,activo=true,
                version=public.tpv_producto_estaciones.version+1,updated_at=now();

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'RUTA_PREPARACION',v_producto,
    'PRODUCTO_ESTACION_ASIGNADA',
    jsonb_build_object('producto_id',v_producto,'estacion_id',p_estacion_id,'prioridad',p_prioridad,'session_id',p_session_id),
    auth.uid(),p_terminal_id,clock_timestamp(),p_operating_day
  );

  v_result:=jsonb_build_object('ok',true,'producto_id',v_producto,'estacion_id',p_estacion_id);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create or replace function public.abc_enviar_cambio_comanda(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_linea_id uuid,
  p_nota text,
  p_expected_linea_version bigint,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_linea public.pedido_lineas%rowtype;
  v_estacion uuid;
  v_nota text:=btrim(coalesce(p_nota,''));
  v_request jsonb;
  v_cmd jsonb;
  v_comanda_id uuid:=gen_random_uuid();
  v_result jsonb;
begin
  if not private.abc_a10_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COMANDA_CAMBIAR') then
    raise exception 'comanda_cambio_no_autorizado';
  end if;
  if p_linea_id is null or v_nota='' or p_expected_linea_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'comanda_cambio_parametros_invalidos';
  end if;
  if not private.abc_terminal_sesion_operativa(p_empresa_id,p_local_id,p_terminal_id,p_session_id) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  select * into v_linea from public.pedido_lineas
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_linea_id for update;
  if not found then raise exception 'linea_no_encontrada'; end if;
  if v_linea.version<>p_expected_linea_version then raise exception 'linea_version_conflict'; end if;
  if v_linea.estado not in ('ENVIADA','EN_PREPARACION','PREPARADA') then
    raise exception 'linea_no_admite_cambio_comanda';
  end if;
  v_estacion:=private.abc_a10_estacion_producto(p_empresa_id,p_local_id,v_linea.producto_id);
  if v_estacion is null then raise exception 'linea_sin_estacion_preparacion'; end if;

  v_request:=jsonb_build_object('linea_id',p_linea_id,'nota',v_nota,'expected_linea_version',p_expected_linea_version);
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_ENVIAR_CAMBIO_COMANDA',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  insert into public.comandas_preparacion(
    id,empresa_id,local_id,pedido_id,estacion_id,operation_id,tipo,route_key,estado,version,created_by
  ) values (
    v_comanda_id,p_empresa_id,p_local_id,v_linea.pedido_id,v_estacion,p_operation_id,
    'CAMBIO',v_estacion::text,'PENDIENTE',1,auth.uid()
  );

  insert into public.comanda_lineas(
    empresa_id,local_id,comanda_id,pedido_id,linea_id,accion,
    estado_anterior,estado_objetivo,linea_version,producto_id,cantidad,
    nota,decision_merma,snapshot
  ) values (
    p_empresa_id,p_local_id,v_comanda_id,v_linea.pedido_id,p_linea_id,'CAMBIO',
    v_linea.estado,v_linea.estado,v_linea.version,v_linea.producto_id,v_linea.cantidad,
    v_nota,'NO_APLICA',private.abc_a10_snapshot_linea(p_empresa_id,p_local_id,p_linea_id)
  );

  perform private.abc_a10_encolar_comanda(v_comanda_id);

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'COMANDA_PREPARACION',v_comanda_id::text,
    'COMANDA_CAMBIO_ENVIADO',
    jsonb_build_object('pedido_id',v_linea.pedido_id,'linea_id',p_linea_id,'estacion_id',v_estacion,'nota',v_nota,'session_id',p_session_id),
    auth.uid(),p_terminal_id,clock_timestamp(),p_operating_day
  );

  v_result:=jsonb_build_object('ok',true,'comanda_id',v_comanda_id,'tipo','CAMBIO','estado','PENDIENTE');
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create or replace function public.abc_reimprimir_comanda(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_comanda_id uuid,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_comanda public.comandas_preparacion%rowtype;
  v_request jsonb;
  v_cmd jsonb;
  v_payload jsonb;
  v_efecto uuid;
  v_result jsonb;
begin
  if not private.abc_a10_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COMANDA_REIMPRIMIR') then
    raise exception 'comanda_reimprimir_no_autorizado';
  end if;
  if p_comanda_id is null or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'comanda_reimprimir_parametros_invalidos';
  end if;
  if not private.abc_terminal_sesion_operativa(p_empresa_id,p_local_id,p_terminal_id,p_session_id) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  select * into v_comanda from public.comandas_preparacion
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_comanda_id;
  if not found then raise exception 'comanda_no_encontrada'; end if;
  if v_comanda.estacion_id is null then raise exception 'comanda_sin_estacion'; end if;

  v_request:=jsonb_build_object('comanda_id',p_comanda_id,'terminal_id',p_terminal_id,'session_id',p_session_id);
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_REIMPRIMIR_COMANDA',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select jsonb_build_object(
    'comanda_id',v_comanda.id,'pedido_id',v_comanda.pedido_id,
    'estacion_id',v_comanda.estacion_id,'tipo','REIMPRESION',
    'original_tipo',v_comanda.tipo,
    'lineas',coalesce(jsonb_agg(jsonb_build_object(
      'linea_id',cl.linea_id,'accion',cl.accion,'nota',cl.nota,'snapshot',cl.snapshot
    ) order by cl.id),'[]'::jsonb)
  ) into v_payload
  from public.comanda_lineas cl where cl.comanda_id=v_comanda.id;

  v_efecto:=private.abc_encolar_efecto(
    p_empresa_id,p_local_id,p_operation_id,'KITCHEN_COMANDA_REIMPRESION',
    'comanda-reprint:'||p_comanda_id::text||':'||p_operation_id,v_payload
  );

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'COMANDA_PREPARACION',p_comanda_id::text,
    'COMANDA_REIMPRESION_SOLICITADA',
    jsonb_build_object('pedido_id',v_comanda.pedido_id,'estacion_id',v_comanda.estacion_id,'efecto_id',v_efecto,'original_tipo',v_comanda.tipo,'session_id',p_session_id),
    auth.uid(),p_terminal_id,clock_timestamp(),p_operating_day
  );

  v_result:=jsonb_build_object('ok',true,'comanda_id',p_comanda_id,'efecto_id',v_efecto,'tipo','REIMPRESION');
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create or replace function public.abc_resolver_merma_comanda_linea(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_comanda_linea_id uuid,
  p_decision text,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_decision text:=upper(btrim(coalesce(p_decision,'')));
  v_row public.comanda_lineas%rowtype;
  v_request jsonb;
  v_cmd jsonb;
  v_result jsonb;
begin
  if not private.abc_a10_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COMANDA_MERMA_DECIDIR') then
    raise exception 'comanda_merma_no_autorizada';
  end if;
  if p_comanda_linea_id is null or v_decision not in ('MERMA_CONFIRMADA','NO_MERMA')
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'comanda_merma_parametros_invalidos';
  end if;
  if not private.abc_terminal_sesion_operativa(p_empresa_id,p_local_id,p_terminal_id,p_session_id) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  select cl.* into v_row
    from public.comanda_lineas cl
    join public.comandas_preparacion c on c.id=cl.comanda_id
   where cl.id=p_comanda_linea_id and cl.empresa_id=p_empresa_id and cl.local_id=p_local_id
     and c.tipo='CANCELACION'
   for update;
  if not found then raise exception 'comanda_linea_no_encontrada'; end if;
  if v_row.decision_merma<>'PENDIENTE' then raise exception 'comanda_merma_no_pendiente'; end if;

  v_request:=jsonb_build_object('comanda_linea_id',p_comanda_linea_id,'decision',v_decision);
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_RESOLVER_MERMA_COMANDA',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  update public.comanda_lineas set decision_merma=v_decision where id=p_comanda_linea_id;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'COMANDA_LINEA',p_comanda_linea_id::text,
    'COMANDA_MERMA_RESUELTA',
    jsonb_build_object('decision_merma',v_decision,'comanda_id',v_row.comanda_id,'linea_id',v_row.linea_id,'stock_mutado',false,'session_id',p_session_id),
    auth.uid(),p_terminal_id,clock_timestamp(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'comanda_linea_id',p_comanda_linea_id,'decision_merma',v_decision,
    'stock_mutado',false
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create or replace function public.abc_confirmar_entrega_comanda(
  p_efecto_id uuid,
  p_worker_ref text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_worker text:=btrim(coalesce(p_worker_ref,''));
  v_efecto public.efectos_pendientes%rowtype;
  v_comanda_id uuid;
  v_tipo text;
  v_actor uuid;
  v_terminal uuid;
  v_operating_day date;
begin
  select * into v_efecto from public.efectos_pendientes where id=p_efecto_id for update;
  if not found then raise exception 'efecto_no_encontrado'; end if;
  if v_efecto.tipo not in (
    'KITCHEN_COMANDA','KITCHEN_COMANDA_CAMBIO',
    'KITCHEN_COMANDA_CANCELACION','KITCHEN_COMANDA_REIMPRESION'
  ) then raise exception 'efecto_no_es_comanda'; end if;
  if v_efecto.estado='COMPLETADO' then
    return jsonb_build_object('ok',true,'already_completed',true,'efecto_id',p_efecto_id);
  end if;
  if v_efecto.estado<>'EN_PROCESO' or v_efecto.worker_ref is distinct from v_worker then
    raise exception 'efecto_lease_no_poseida';
  end if;
  if v_efecto.lease_until<=now() then raise exception 'efecto_lease_expirada'; end if;

  v_comanda_id:=(v_efecto.payload->>'comanda_id')::uuid;
  if v_comanda_id is null then raise exception 'efecto_comanda_payload_invalido'; end if;

  if v_efecto.tipo<>'KITCHEN_COMANDA_REIMPRESION' then
    update public.comandas_preparacion
       set estado='RECIBIDA',
           received_at=coalesce(received_at,now()),
           received_worker_ref=coalesce(received_worker_ref,v_worker),
           version=case when estado='RECIBIDA' then version else version+1 end
     where id=v_comanda_id and empresa_id=v_efecto.empresa_id and local_id=v_efecto.local_id
       and estado in ('PENDIENTE','RECIBIDA');
    if not found then raise exception 'comanda_no_entregable'; end if;
  elsif not exists(
    select 1 from public.comandas_preparacion
     where id=v_comanda_id and empresa_id=v_efecto.empresa_id and local_id=v_efecto.local_id
  ) then
    raise exception 'comanda_no_encontrada';
  end if;

  update public.efectos_pendientes
     set estado='COMPLETADO',completed_at=now(),locked_at=null,lease_until=null,
         worker_ref=null,next_attempt_at=null,last_error=null
   where id=p_efecto_id;

  select e.actor_user_id,e.terminal_id,e.operating_day
    into v_actor,v_terminal,v_operating_day
    from public.abc_eventos e
   where e.empresa_id=v_efecto.empresa_id
     and e.local_id=v_efecto.local_id
     and e.operation_id=v_efecto.abc_command_id
     and e.aggregate_id=v_comanda_id::text
     and e.event_type in (
       'COMANDA_PREPARACION_GENERADA','COMANDA_CANCELACION_GENERADA',
       'COMANDA_CAMBIO_ENVIADO','COMANDA_REIMPRESION_SOLICITADA'
     )
   order by e.id desc
   limit 1;

  if v_actor is not null and v_operating_day is not null then
    insert into public.abc_eventos(
      empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
      payload,actor_user_id,terminal_id,occurred_at,operating_day
    ) values (
      v_efecto.empresa_id,v_efecto.local_id,v_efecto.abc_command_id,
      'COMANDA_PREPARACION',v_comanda_id::text,'COMANDA_ENTREGA_CONFIRMADA',
      jsonb_build_object('efecto_id',p_efecto_id,'worker_ref',v_worker,'tipo_efecto',v_efecto.tipo),
      v_actor,v_terminal,clock_timestamp(),v_operating_day
    );
  end if;

  v_tipo:=v_efecto.tipo;
  return jsonb_build_object(
    'ok',true,'efecto_id',p_efecto_id,'comanda_id',v_comanda_id,
    'tipo',v_tipo,'estado','COMPLETADO'
  );
end $$;
-- Mantener el mismo perímetro ACL de A10 después de CREATE OR REPLACE.
revoke all on function private.abc_a10_procesar_transiciones_linea() from public,anon,authenticated,service_role;
revoke all on function public.abc_crear_estacion_preparacion(text,text,text,uuid,text,text,text,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_actualizar_estacion_preparacion(text,text,text,uuid,text,text,boolean,bigint,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_asignar_producto_estacion(text,text,text,text,uuid,smallint,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_enviar_cambio_comanda(text,text,text,uuid,text,bigint,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_reimprimir_comanda(text,text,text,uuid,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_resolver_merma_comanda_linea(text,text,text,uuid,text,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_confirmar_entrega_comanda(uuid,text) from public,anon,authenticated,service_role;

grant execute on function public.abc_crear_estacion_preparacion(text,text,text,uuid,text,text,text,uuid,uuid,date) to authenticated;
grant execute on function public.abc_actualizar_estacion_preparacion(text,text,text,uuid,text,text,boolean,bigint,uuid,uuid,date) to authenticated;
grant execute on function public.abc_asignar_producto_estacion(text,text,text,text,uuid,smallint,uuid,uuid,date) to authenticated;
grant execute on function public.abc_enviar_cambio_comanda(text,text,text,uuid,text,bigint,uuid,uuid,date) to authenticated;
grant execute on function public.abc_reimprimir_comanda(text,text,text,uuid,uuid,uuid,date) to authenticated;
grant execute on function public.abc_resolver_merma_comanda_linea(text,text,text,uuid,text,uuid,uuid,date) to authenticated;
grant execute on function public.abc_confirmar_entrega_comanda(uuid,text) to service_role;
