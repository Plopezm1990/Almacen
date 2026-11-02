-- ABC F3 A10C — clasificación de preparación y guard atómico de rutas.
-- Preparada para QA. No aplica datos por sí sola hasta ejecutar la migración.
-- Depende de F3 A03, F3 A05 y F3 A10.

do $$
declare v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.catalogo_tpv_productos') is null then
    v_missing:=array_append(v_missing,'catalogo_tpv_productos');
  end if;
  if to_regclass('public.pedido_lineas') is null then
    v_missing:=array_append(v_missing,'pedido_lineas');
  end if;
  if to_regclass('public.pedidos_tpv') is null then
    v_missing:=array_append(v_missing,'pedidos_tpv');
  end if;
  if to_regclass('public.tpv_producto_estaciones') is null then
    v_missing:=array_append(v_missing,'tpv_producto_estaciones');
  end if;
  if to_regclass('public.tpv_estaciones_preparacion') is null then
    v_missing:=array_append(v_missing,'tpv_estaciones_preparacion');
  end if;
  if to_regprocedure('private.abc_a10_estacion_producto(text,text,text)') is null then
    v_missing:=array_append(v_missing,'abc_a10_estacion_producto');
  end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then
    v_missing:=array_append(v_missing,'abc_operacion_iniciar');
  end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then
    v_missing:=array_append(v_missing,'abc_operacion_completar');
  end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_F3_A10C_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;
end $$;

alter table public.catalogo_tpv_productos
  add column if not exists requiere_preparacion boolean;

comment on column public.catalogo_tpv_productos.requiere_preparacion is
  'Clasificación operativa de cocina. TRUE requiere ruta activa, FALSE se entrega directamente, NULL queda pendiente de clasificar y se bloquea al enviar.';

create index if not exists abc_catalogo_preparacion_idx
  on public.catalogo_tpv_productos(
    empresa_id,local_id,activo,requiere_preparacion,producto_id,currency_code
  );

create or replace function private.abc_a10_producto_requiere_preparacion(
  p_empresa_id text,
  p_local_id text,
  p_producto_id text,
  p_currency_code text
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select c.requiere_preparacion
    from public.catalogo_tpv_productos c
   where c.empresa_id=$1
     and c.local_id=$2
     and c.producto_id=$3
     and c.currency_code=$4
     and c.activo=true
   limit 1
$$;

create or replace function private.abc_a10_validar_rutas_envio(
  p_empresa_id text,
  p_local_id text,
  p_pedido_id uuid,
  p_currency_code text
)
returns void
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_sin_clasificar text[];
  v_sin_ruta text[];
begin
  select
    coalesce(
      array_agg(distinct l.producto_id order by l.producto_id)
        filter (where c.producto_id is null or c.requiere_preparacion is null),
      '{}'::text[]
    ),
    coalesce(
      array_agg(distinct l.producto_id order by l.producto_id)
        filter (
          where c.requiere_preparacion=true
            and not exists(
              select 1
                from public.tpv_producto_estaciones pe
                join public.tpv_estaciones_preparacion e
                  on e.empresa_id=pe.empresa_id
                 and e.local_id=pe.local_id
                 and e.id=pe.estacion_id
               where pe.empresa_id=l.empresa_id
                 and pe.local_id=l.local_id
                 and pe.producto_id=l.producto_id
                 and pe.activo=true
                 and e.activo=true
            )
        ),
      '{}'::text[]
    )
    into v_sin_clasificar,v_sin_ruta
    from public.pedido_lineas l
    left join public.catalogo_tpv_productos c
      on c.empresa_id=l.empresa_id
     and c.local_id=l.local_id
     and c.producto_id=l.producto_id
     and c.currency_code=p_currency_code
     and c.activo=true
   where l.empresa_id=p_empresa_id
     and l.local_id=p_local_id
     and l.pedido_id=p_pedido_id
     and l.estado<>'CANCELADA';

  if cardinality(v_sin_clasificar)>0 then
    raise exception 'producto_preparacion_clasificacion_pendiente'
      using detail='productos='||array_to_string(v_sin_clasificar,',');
  end if;

  if cardinality(v_sin_ruta)>0 then
    raise exception 'producto_preparacion_sin_ruta'
      using detail='productos='||array_to_string(v_sin_ruta,',');
  end if;
end $$;

revoke all on function private.abc_a10_producto_requiere_preparacion(text,text,text,text)
from public,anon,authenticated,service_role;
revoke all on function private.abc_a10_validar_rutas_envio(text,text,uuid,text)
from public,anon,authenticated,service_role;

-- Solo las líneas clasificadas como preparación generan comanda. Las líneas
-- directas completan A05 sin crear una comanda artificial.
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
             l.producto_id,l.cantidad,l.version,
             private.abc_a10_estacion_producto(n.empresa_id,n.local_id,l.producto_id) estacion_id,
             private.abc_a10_snapshot_linea(n.empresa_id,n.local_id,n.linea_id) snapshot
        from a10_new_transitions n
        join public.pedido_lineas l
          on l.empresa_id=n.empresa_id and l.local_id=n.local_id and l.id=n.linea_id
        join public.pedidos_tpv p
          on p.empresa_id=n.empresa_id and p.local_id=n.local_id and p.id=n.pedido_id
       where n.estado_nuevo in ('ENVIADA','CANCELADA')
         and private.abc_a10_producto_requiere_preparacion(
               n.empresa_id,n.local_id,l.producto_id,p.currency_code
             ) is true
    )
    select empresa_id,local_id,operation_id,pedido_id,actor_user_id,estacion_id,
           case when estado_nuevo='ENVIADA' then 'NUEVA' else 'CANCELACION' end tipo,
           coalesce(estacion_id::text,'SIN_RUTA') route_key
      from routed
     group by empresa_id,local_id,operation_id,pedido_id,actor_user_id,estacion_id,
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
          join public.pedidos_tpv p
            on p.empresa_id=n.empresa_id and p.local_id=n.local_id and p.id=n.pedido_id
         where n.estado_nuevo in ('ENVIADA','CANCELADA')
           and private.abc_a10_producto_requiere_preparacion(
                 n.empresa_id,n.local_id,l.producto_id,p.currency_code
               ) is true
      ) r
     where r.empresa_id=g.empresa_id and r.local_id=g.local_id
       and r.operation_id=g.operation_id and r.pedido_id=g.pedido_id
       and r.estacion_id is not distinct from g.estacion_id
       and (case when r.estado_nuevo='ENVIADA' then 'NUEVA' else 'CANCELACION' end)=g.tipo
    on conflict (comanda_id,linea_id,accion) do nothing;

    perform private.abc_a10_encolar_comanda(v_comanda_id);
  end loop;

  return null;
end $$;

create or replace function public.abc_enviar_pedido(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_pedido_id uuid,
  p_expected_pedido_version bigint,
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
  v_pedido public.pedidos_tpv%rowtype;
  v_cmd jsonb;
  v_request jsonb;
  v_result jsonb;
  v_lineas integer;
  v_new_version bigint;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_PEDIDO_ENVIAR') then
    raise exception 'pedido_enviar_no_autorizado';
  end if;
  if p_pedido_id is null or p_expected_pedido_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'pedido_enviar_parametros_requeridos';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  v_request:=jsonb_build_object(
    'pedido_id',p_pedido_id,'expected_pedido_version',p_expected_pedido_version,
    'terminal_id',p_terminal_id,'session_id',p_session_id,'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_ENVIAR_PEDIDO',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select *
    into v_pedido
    from public.pedidos_tpv
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_pedido_id
   for update;
  if not found then raise exception 'pedido_no_encontrado'; end if;
  if v_pedido.estado<>'ABIERTO' then raise exception 'pedido_no_enviable'; end if;
  if v_pedido.version<>p_expected_pedido_version then raise exception 'pedido_version_conflict'; end if;
  if v_pedido.created_operating_day<>p_operating_day then raise exception 'operating_day_pedido_inconsistente'; end if;

  perform 1
    from public.pedido_lineas
   where empresa_id=p_empresa_id and local_id=p_local_id and pedido_id=p_pedido_id
   order by id
   for update;

  select count(*) filter (where estado<>'CANCELADA')
    into v_lineas
    from public.pedido_lineas
   where empresa_id=p_empresa_id and local_id=p_local_id and pedido_id=p_pedido_id;

  if v_lineas=0 then raise exception 'pedido_sin_lineas_enviables'; end if;
  if exists(
    select 1 from public.pedido_lineas
     where empresa_id=p_empresa_id and local_id=p_local_id and pedido_id=p_pedido_id
       and estado<>'CANCELADA'
       and estado<>'CONFIRMADA'
  ) then
    raise exception 'pedido_lineas_no_confirmadas';
  end if;

  -- Se ejecuta después de bloquear el pedido y las líneas, y antes de
  -- insertar cualquier transición. Un cambio de ruta concurrente no puede
  -- producir un falso éxito del envío.
  perform private.abc_a10_validar_rutas_envio(
    p_empresa_id,p_local_id,p_pedido_id,v_pedido.currency_code
  );

  insert into public.pedido_linea_transiciones(
    empresa_id,local_id,pedido_id,linea_id,operation_id,
    estado_anterior,estado_nuevo,motivo,actor_user_id,
    terminal_id,session_id,occurred_at,operating_day,metadata
  )
  select empresa_id,local_id,pedido_id,id,p_operation_id,
         estado,'ENVIADA',null,auth.uid(),p_terminal_id,p_session_id,
         now(),p_operating_day,
         jsonb_build_object('origen','ENVIO_PEDIDO','linea_version',version+1)
    from public.pedido_lineas
   where empresa_id=p_empresa_id and local_id=p_local_id and pedido_id=p_pedido_id
     and estado='CONFIRMADA';

  update public.pedido_lineas
     set estado='ENVIADA',
         version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and pedido_id=p_pedido_id
     and estado='CONFIRMADA';

  update public.pedidos_tpv
     set estado='ENVIADO',
         version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_pedido_id
  returning version into v_new_version;

  perform private.abc_registrar_transicion_pedido(
    p_empresa_id,p_local_id,p_pedido_id,p_operation_id,
    v_pedido.estado,'ENVIADO',null,auth.uid(),p_terminal_id,p_session_id,
    p_operating_day,jsonb_build_object('lineas_enviadas',v_lineas)
  );

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'PEDIDO',p_pedido_id::text,'PEDIDO_ENVIADO',
    jsonb_build_object(
      'estado_anterior',v_pedido.estado,'estado','ENVIADO',
      'pedido_version',v_new_version,'lineas_enviadas',v_lineas,'session_id',p_session_id
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'pedido_id',p_pedido_id,'estado','ENVIADO',
    'pedido_version',v_new_version,'lineas_enviadas',v_lineas
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

revoke all on function public.abc_enviar_pedido(text,text,text,uuid,bigint,uuid,uuid,date)
from public,anon,service_role;
grant execute on function public.abc_enviar_pedido(text,text,text,uuid,bigint,uuid,uuid,date)
to authenticated;
