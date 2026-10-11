-- ABC F3 A05 — máquina de estados operativa de pedido/línea.
-- Aditiva. No activa frontend, no mueve stock, no cobra y no crea datos reales.
-- Depende de F3 A03/A04.

do $$
declare v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.pedidos_tpv') is null then v_missing:=array_append(v_missing,'pedidos_tpv'); end if;
  if to_regclass('public.pedido_lineas') is null then v_missing:=array_append(v_missing,'pedido_lineas'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regclass('public.abc_operaciones') is null then v_missing:=array_append(v_missing,'abc_operaciones'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_terminal_sesion_operativa(text,text,uuid,uuid)') is null then v_missing:=array_append(v_missing,'abc_terminal_sesion_operativa'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;

  if cardinality(v_missing)>0 then
    raise exception 'ABC_F3_A05_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  if to_regclass('public.pedido_transiciones') is not null
     or to_regclass('public.pedido_linea_transiciones') is not null
     or to_regprocedure('private.abc_estado_agregado_pedido(text,text,uuid)') is not null
     or to_regprocedure('private.abc_actualizar_estado_pedido_desde_lineas(text,text,uuid,text,uuid,uuid,uuid,date)') is not null
     or to_regprocedure('public.abc_enviar_pedido(text,text,text,uuid,bigint,uuid,uuid,date)') is not null
     or to_regprocedure('public.abc_iniciar_preparacion_linea(text,text,text,uuid,bigint,bigint,uuid,uuid,date)') is not null
     or to_regprocedure('public.abc_marcar_linea_preparada(text,text,text,uuid,bigint,bigint,uuid,uuid,date)') is not null
     or to_regprocedure('public.abc_servir_linea(text,text,text,uuid,bigint,bigint,uuid,uuid,date)') is not null
     or to_regprocedure('public.abc_cancelar_linea(text,text,text,uuid,text,bigint,bigint,uuid,uuid,date)') is not null
     or to_regprocedure('public.abc_cancelar_pedido(text,text,text,uuid,text,bigint,uuid,uuid,date)') is not null
     or to_regprocedure('public.abc_cerrar_pedido_operativo(text,text,text,uuid,bigint,uuid,uuid,date)') is not null
     or to_regprocedure('public.abc_estado_cobro_cuenta(text,text,uuid)') is not null then
    raise exception 'ABC_F3_A05_PREFLIGHT_FALLO: objetos A05 ya existen';
  end if;
end $$;

alter table public.pedidos_tpv
  drop constraint abc_pedido_estado;

alter table public.pedidos_tpv
  add constraint abc_pedido_estado check (
    estado in (
      'BORRADOR','ABIERTO','ENVIADO','EN_PREPARACION',
      'PARCIALMENTE_PREPARADO','PREPARADO','SERVIDO','CERRADO','CANCELADO'
    )
  );

create table public.pedido_transiciones (
  id uuid not null default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  pedido_id uuid not null,
  operation_id text not null,
  estado_anterior text not null,
  estado_nuevo text not null,
  motivo text,
  actor_user_id uuid not null,
  terminal_id uuid not null,
  session_id uuid not null,
  occurred_at timestamptz not null default now(),
  operating_day date not null,
  metadata jsonb not null default '{}'::jsonb,
  primary key (id),
  constraint abc_pedido_transicion_estado_anterior check (
    estado_anterior in (
      'BORRADOR','ABIERTO','ENVIADO','EN_PREPARACION',
      'PARCIALMENTE_PREPARADO','PREPARADO','SERVIDO','CERRADO','CANCELADO'
    )
  ),
  constraint abc_pedido_transicion_estado_nuevo check (
    estado_nuevo in (
      'BORRADOR','ABIERTO','ENVIADO','EN_PREPARACION',
      'PARCIALMENTE_PREPARADO','PREPARADO','SERVIDO','CERRADO','CANCELADO'
    )
  ),
  constraint abc_pedido_transicion_cambio check (estado_anterior<>estado_nuevo),
  constraint abc_pedido_transicion_pedido_fk
    foreign key (empresa_id,local_id,pedido_id)
    references public.pedidos_tpv(empresa_id,local_id,id) on delete restrict,
  constraint abc_pedido_transicion_operacion_fk
    foreign key (empresa_id,local_id,operation_id)
    references public.abc_operaciones(empresa_id,local_id,operation_id) on delete restrict,
  constraint abc_pedido_transicion_actor_fk
    foreign key (actor_user_id) references auth.users(id) on delete restrict,
  constraint abc_pedido_transicion_terminal_fk
    foreign key (empresa_id,local_id,terminal_id)
    references public.terminales_tpv(empresa_id,local_id,id) on delete restrict,
  constraint abc_pedido_transicion_session_fk
    foreign key (empresa_id,local_id,session_id)
    references public.caja_sesiones(empresa_id,local_id,id) on delete restrict
);

create table public.pedido_linea_transiciones (
  id uuid not null default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  pedido_id uuid not null,
  linea_id uuid not null,
  operation_id text not null,
  estado_anterior text not null,
  estado_nuevo text not null,
  motivo text,
  actor_user_id uuid not null,
  terminal_id uuid not null,
  session_id uuid not null,
  occurred_at timestamptz not null default now(),
  operating_day date not null,
  metadata jsonb not null default '{}'::jsonb,
  primary key (id),
  constraint abc_linea_transicion_estado_anterior check (
    estado_anterior in (
      'BORRADOR','CONFIRMADA','ENVIADA','EN_PREPARACION',
      'PREPARADA','SERVIDA','CANCELADA'
    )
  ),
  constraint abc_linea_transicion_estado_nuevo check (
    estado_nuevo in (
      'BORRADOR','CONFIRMADA','ENVIADA','EN_PREPARACION',
      'PREPARADA','SERVIDA','CANCELADA'
    )
  ),
  constraint abc_linea_transicion_cambio check (estado_anterior<>estado_nuevo),
  constraint abc_linea_transicion_pedido_fk
    foreign key (empresa_id,local_id,pedido_id)
    references public.pedidos_tpv(empresa_id,local_id,id) on delete restrict,
  constraint abc_linea_transicion_linea_fk
    foreign key (empresa_id,local_id,linea_id)
    references public.pedido_lineas(empresa_id,local_id,id) on delete restrict,
  constraint abc_linea_transicion_operacion_fk
    foreign key (empresa_id,local_id,operation_id)
    references public.abc_operaciones(empresa_id,local_id,operation_id) on delete restrict,
  constraint abc_linea_transicion_actor_fk
    foreign key (actor_user_id) references auth.users(id) on delete restrict,
  constraint abc_linea_transicion_terminal_fk
    foreign key (empresa_id,local_id,terminal_id)
    references public.terminales_tpv(empresa_id,local_id,id) on delete restrict,
  constraint abc_linea_transicion_session_fk
    foreign key (empresa_id,local_id,session_id)
    references public.caja_sesiones(empresa_id,local_id,id) on delete restrict
);

create index abc_pedido_transiciones_timeline_idx
  on public.pedido_transiciones(empresa_id,local_id,pedido_id,occurred_at,id);

create index abc_linea_transiciones_timeline_idx
  on public.pedido_linea_transiciones(empresa_id,local_id,linea_id,occurred_at,id);

alter table public.pedido_transiciones enable row level security;
alter table public.pedido_linea_transiciones enable row level security;

create policy abc_pedido_transiciones_select
on public.pedido_transiciones
for select to authenticated
using (private.la_tiene_local(empresa_id,local_id));

create policy abc_linea_transiciones_select
on public.pedido_linea_transiciones
for select to authenticated
using (private.la_tiene_local(empresa_id,local_id));

revoke all on table
  public.pedido_transiciones,
  public.pedido_linea_transiciones
from public,anon,authenticated,service_role;

grant select on table
  public.pedido_transiciones,
  public.pedido_linea_transiciones
to authenticated;

create or replace function private.abc_tiene_capacidad(
  p_empresa_id text,
  p_local_id text,
  p_capacidad text
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_rol text;
  v_capacidad text := upper(btrim(coalesce(p_capacidad,'')));
begin
  if auth.uid() is null then return false; end if;
  if nullif(btrim(coalesce(p_empresa_id,'')),'') is null
     or nullif(btrim(coalesce(p_local_id,'')),'') is null
     or v_capacidad='' then
    return false;
  end if;
  if not private.la_tiene_local(p_empresa_id,p_local_id) then
    return false;
  end if;

  select m.rol
    into v_rol
    from public.membresias_usuario m
   where m.user_id=auth.uid()
     and m.empresa_id=p_empresa_id
     and m.activo=true
     and (
       (m.todos_locales=false and m.local_id=p_local_id)
       or (m.todos_locales=true and m.local_id is null)
     )
   order by
     case when m.todos_locales=false and m.local_id=p_local_id then 0 else 1 end,
     m.id desc
   limit 1;

  if v_rol is null then return false; end if;

  return case v_capacidad
    when 'ABC_CUENTA_OPERAR' then
      v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a','Churrero/a')
    when 'ABC_COBRO_INICIAR' then
      v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_COBRO_EFECTIVO' then
      v_rol in ('Propietario','Encargado','Cajero/a')
    when 'ABC_REEMBOLSO_SOLICITAR' then
      v_rol in ('Propietario','Encargado')
    when 'ABC_REEMBOLSO_CONFIRMAR' then
      v_rol in ('Propietario','Encargado')
    when 'ABC_CAJA_OPERAR' then
      v_rol in ('Propietario','Encargado','Cajero/a')
    when 'ABC_EMISOR_CAMBIAR' then
      v_rol in ('Propietario','Encargado')
    when 'ABC_PEDIDO_ENVIAR' then
      v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_PREPARACION_INICIAR' then
      v_rol in ('Propietario','Encargado','Camarero/a','Churrero/a')
    when 'ABC_PREPARACION_COMPLETAR' then
      v_rol in ('Propietario','Encargado','Camarero/a','Churrero/a')
    when 'ABC_PEDIDO_SERVIR' then
      v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_LINEA_CANCELAR' then
      v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_CANCELACION_SENSIBLE' then
      v_rol in ('Propietario','Encargado')
    when 'ABC_PEDIDO_CANCELAR' then
      v_rol in ('Propietario','Encargado')
    when 'ABC_PEDIDO_CERRAR' then
      v_rol in ('Propietario','Encargado','Cajero/a')
    else false
  end;
end $$;

create function private.abc_estado_agregado_pedido(
  p_empresa_id text,
  p_local_id text,
  p_pedido_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_activos integer;
  v_enviadas integer;
  v_preparando integer;
  v_preparadas integer;
  v_servidas integer;
begin
  select
    count(*) filter (where estado<>'CANCELADA'),
    count(*) filter (where estado='ENVIADA'),
    count(*) filter (where estado='EN_PREPARACION'),
    count(*) filter (where estado='PREPARADA'),
    count(*) filter (where estado='SERVIDA')
  into v_activos,v_enviadas,v_preparando,v_preparadas,v_servidas
  from public.pedido_lineas
  where empresa_id=p_empresa_id
    and local_id=p_local_id
    and pedido_id=p_pedido_id;

  if v_activos=0 then return 'ABIERTO'; end if;
  if v_servidas=v_activos then return 'SERVIDO'; end if;
  if v_preparadas+v_servidas=v_activos and v_preparadas>0 then return 'PREPARADO'; end if;
  if v_preparadas+v_servidas>0 then return 'PARCIALMENTE_PREPARADO'; end if;
  if v_preparando>0 then return 'EN_PREPARACION'; end if;
  if v_enviadas>0 then return 'ENVIADO'; end if;
  return 'ABIERTO';
end $$;

create function private.abc_registrar_transicion_pedido(
  p_empresa_id text,
  p_local_id text,
  p_pedido_id uuid,
  p_operation_id text,
  p_estado_anterior text,
  p_estado_nuevo text,
  p_motivo text,
  p_actor uuid,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
volatile
security definer
set search_path=''
as $$
  insert into public.pedido_transiciones(
    empresa_id,local_id,pedido_id,operation_id,
    estado_anterior,estado_nuevo,motivo,actor_user_id,
    terminal_id,session_id,occurred_at,operating_day,metadata
  ) values (
    $1,$2,$3,$4,$5,$6,nullif(btrim(coalesce($7,'')),''),
    $8,$9,$10,now(),$11,coalesce($12,'{}'::jsonb)
  )
$$;

create function private.abc_registrar_transicion_linea(
  p_empresa_id text,
  p_local_id text,
  p_pedido_id uuid,
  p_linea_id uuid,
  p_operation_id text,
  p_estado_anterior text,
  p_estado_nuevo text,
  p_motivo text,
  p_actor uuid,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
volatile
security definer
set search_path=''
as $$
  insert into public.pedido_linea_transiciones(
    empresa_id,local_id,pedido_id,linea_id,operation_id,
    estado_anterior,estado_nuevo,motivo,actor_user_id,
    terminal_id,session_id,occurred_at,operating_day,metadata
  ) values (
    $1,$2,$3,$4,$5,$6,$7,nullif(btrim(coalesce($8,'')),''),
    $9,$10,$11,now(),$12,coalesce($13,'{}'::jsonb)
  )
$$;

create function private.abc_actualizar_estado_pedido_desde_lineas(
  p_empresa_id text,
  p_local_id text,
  p_pedido_id uuid,
  p_operation_id text,
  p_actor uuid,
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
  v_estado_nuevo text;
  v_version bigint;
begin
  select *
    into v_pedido
    from public.pedidos_tpv
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_pedido_id
   for update;

  if not found then raise exception 'pedido_no_encontrado'; end if;
  if v_pedido.estado in ('CERRADO','CANCELADO') then
    raise exception 'pedido_terminal_no_recalculable';
  end if;

  v_estado_nuevo:=private.abc_estado_agregado_pedido(
    p_empresa_id,p_local_id,p_pedido_id
  );

  update public.pedidos_tpv
     set estado=v_estado_nuevo,
         version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_pedido_id
  returning version into v_version;

  if v_pedido.estado<>v_estado_nuevo then
    perform private.abc_registrar_transicion_pedido(
      p_empresa_id,p_local_id,p_pedido_id,p_operation_id,
      v_pedido.estado,v_estado_nuevo,null,p_actor,p_terminal_id,p_session_id,
      p_operating_day,
      jsonb_build_object('origen','DERIVADO_LINEAS')
    );
  end if;

  return jsonb_build_object(
    'estado_anterior',v_pedido.estado,
    'estado',v_estado_nuevo,
    'version',v_version,
    'cambio_estado',v_pedido.estado<>v_estado_nuevo
  );
end $$;

create function private.abc_transicionar_linea_operativa(
  p_objetivo text,
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_linea_id uuid,
  p_expected_linea_version bigint,
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
  v_objetivo text:=upper(btrim(coalesce(p_objetivo,'')));
  v_capacidad text;
  v_estado_requerido text;
  v_event_type text;
  v_pedido_id uuid;
  v_pedido public.pedidos_tpv%rowtype;
  v_linea public.pedido_lineas%rowtype;
  v_cmd jsonb;
  v_request jsonb;
  v_order_result jsonb;
  v_result jsonb;
  v_linea_version bigint;
begin
  v_capacidad:=case v_objetivo
    when 'EN_PREPARACION' then 'ABC_PREPARACION_INICIAR'
    when 'PREPARADA' then 'ABC_PREPARACION_COMPLETAR'
    when 'SERVIDA' then 'ABC_PEDIDO_SERVIR'
    else null
  end;
  v_estado_requerido:=case v_objetivo
    when 'EN_PREPARACION' then 'ENVIADA'
    when 'PREPARADA' then 'EN_PREPARACION'
    when 'SERVIDA' then 'PREPARADA'
    else null
  end;
  v_event_type:=case v_objetivo
    when 'EN_PREPARACION' then 'PEDIDO_LINEA_PREPARACION_INICIADA'
    when 'PREPARADA' then 'PEDIDO_LINEA_PREPARADA'
    when 'SERVIDA' then 'PEDIDO_LINEA_SERVIDA'
    else null
  end;

  if v_capacidad is null then raise exception 'transicion_linea_objetivo_invalido'; end if;
  if auth.uid() is null or not private.abc_tiene_capacidad(
    p_empresa_id,p_local_id,v_capacidad
  ) then
    raise exception 'transicion_linea_no_autorizada';
  end if;
  if p_linea_id is null or p_expected_linea_version is null
     or p_expected_pedido_version is null or p_terminal_id is null
     or p_session_id is null or p_operating_day is null then
    raise exception 'transicion_linea_parametros_requeridos';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  v_request:=jsonb_build_object(
    'linea_id',p_linea_id,'objetivo',v_objetivo,
    'expected_linea_version',p_expected_linea_version,
    'expected_pedido_version',p_expected_pedido_version,
    'terminal_id',p_terminal_id,'session_id',p_session_id,
    'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,
    'ABC_LINEA_ESTADO_'||v_objetivo,v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select pedido_id
    into v_pedido_id
    from public.pedido_lineas
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_linea_id;
  if not found then raise exception 'linea_no_encontrada'; end if;

  select *
    into v_pedido
    from public.pedidos_tpv
   where empresa_id=p_empresa_id and local_id=p_local_id and id=v_pedido_id
   for update;
  if not found then raise exception 'pedido_no_encontrado'; end if;
  if v_pedido.estado in ('CERRADO','CANCELADO') then raise exception 'pedido_no_operable'; end if;
  if v_pedido.version<>p_expected_pedido_version then raise exception 'pedido_version_conflict'; end if;
  if v_pedido.created_operating_day<>p_operating_day then raise exception 'operating_day_pedido_inconsistente'; end if;

  select *
    into v_linea
    from public.pedido_lineas
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_linea_id
   for update;
  if not found then raise exception 'linea_no_encontrada'; end if;
  if v_linea.version<>p_expected_linea_version then raise exception 'linea_version_conflict'; end if;
  if v_linea.estado<>v_estado_requerido then
    raise exception 'transicion_linea_invalida:%->%',v_linea.estado,v_objetivo;
  end if;

  update public.pedido_lineas
     set estado=v_objetivo,
         version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_linea_id
  returning version into v_linea_version;

  perform private.abc_registrar_transicion_linea(
    p_empresa_id,p_local_id,v_pedido_id,p_linea_id,p_operation_id,
    v_linea.estado,v_objetivo,null,auth.uid(),p_terminal_id,p_session_id,
    p_operating_day,
    jsonb_build_object('linea_version',v_linea_version)
  );

  v_order_result:=private.abc_actualizar_estado_pedido_desde_lineas(
    p_empresa_id,p_local_id,v_pedido_id,p_operation_id,auth.uid(),
    p_terminal_id,p_session_id,p_operating_day
  );

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'PEDIDO_LINEA',p_linea_id::text,v_event_type,
    jsonb_build_object(
      'pedido_id',v_pedido_id,
      'estado_anterior',v_linea.estado,
      'estado',v_objetivo,
      'linea_version',v_linea_version,
      'pedido_estado',v_order_result->>'estado',
      'pedido_version',(v_order_result->>'version')::bigint,
      'session_id',p_session_id
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,
    'linea_id',p_linea_id,
    'estado',v_objetivo,
    'linea_version',v_linea_version,
    'pedido_id',v_pedido_id,
    'pedido_estado',v_order_result->>'estado',
    'pedido_version',(v_order_result->>'version')::bigint
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_enviar_pedido(
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

create function public.abc_iniciar_preparacion_linea(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_linea_id uuid,
  p_expected_linea_version bigint,
  p_expected_pedido_version bigint,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language sql
volatile
security definer
set search_path=''
as $$
  select private.abc_transicionar_linea_operativa(
    'EN_PREPARACION',$1,$2,$3,$4,$5,$6,$7,$8,$9
  )
$$;

create function public.abc_marcar_linea_preparada(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_linea_id uuid,
  p_expected_linea_version bigint,
  p_expected_pedido_version bigint,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language sql
volatile
security definer
set search_path=''
as $$
  select private.abc_transicionar_linea_operativa(
    'PREPARADA',$1,$2,$3,$4,$5,$6,$7,$8,$9
  )
$$;

create function public.abc_servir_linea(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_linea_id uuid,
  p_expected_linea_version bigint,
  p_expected_pedido_version bigint,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language sql
volatile
security definer
set search_path=''
as $$
  select private.abc_transicionar_linea_operativa(
    'SERVIDA',$1,$2,$3,$4,$5,$6,$7,$8,$9
  )
$$;

create function public.abc_cancelar_linea(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_linea_id uuid,
  p_motivo text,
  p_expected_linea_version bigint,
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
  v_pedido_id uuid;
  v_pedido public.pedidos_tpv%rowtype;
  v_linea public.pedido_lineas%rowtype;
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
  v_cmd jsonb;
  v_request jsonb;
  v_order_result jsonb;
  v_result jsonb;
  v_linea_version bigint;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_LINEA_CANCELAR') then
    raise exception 'linea_cancelar_no_autorizada';
  end if;
  if v_motivo is null then raise exception 'motivo_cancelacion_requerido'; end if;
  if p_linea_id is null or p_expected_linea_version is null
     or p_expected_pedido_version is null or p_terminal_id is null
     or p_session_id is null or p_operating_day is null then
    raise exception 'linea_cancelar_parametros_requeridos';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  v_request:=jsonb_build_object(
    'linea_id',p_linea_id,'motivo',v_motivo,
    'expected_linea_version',p_expected_linea_version,
    'expected_pedido_version',p_expected_pedido_version,
    'terminal_id',p_terminal_id,'session_id',p_session_id,'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_CANCELAR_LINEA',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  select pedido_id into v_pedido_id
    from public.pedido_lineas
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_linea_id;
  if not found then raise exception 'linea_no_encontrada'; end if;

  select *
    into v_pedido
    from public.pedidos_tpv
   where empresa_id=p_empresa_id and local_id=p_local_id and id=v_pedido_id
   for update;
  if not found then raise exception 'pedido_no_encontrado'; end if;
  if v_pedido.estado in ('CERRADO','CANCELADO') then raise exception 'pedido_no_operable'; end if;
  if v_pedido.version<>p_expected_pedido_version then raise exception 'pedido_version_conflict'; end if;
  if v_pedido.created_operating_day<>p_operating_day then raise exception 'operating_day_pedido_inconsistente'; end if;

  select *
    into v_linea
    from public.pedido_lineas
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_linea_id
   for update;
  if not found then raise exception 'linea_no_encontrada'; end if;
  if v_linea.version<>p_expected_linea_version then raise exception 'linea_version_conflict'; end if;
  if v_linea.estado in ('SERVIDA','CANCELADA') then raise exception 'linea_no_cancelable'; end if;

  if v_linea.estado in ('ENVIADA','EN_PREPARACION','PREPARADA')
     and not private.abc_tiene_capacidad(
       p_empresa_id,p_local_id,'ABC_CANCELACION_SENSIBLE'
     ) then
    raise exception 'cancelacion_sensible_no_autorizada';
  end if;

  update public.pedido_lineas
     set estado='CANCELADA',
         version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_linea_id
  returning version into v_linea_version;

  perform private.abc_registrar_transicion_linea(
    p_empresa_id,p_local_id,v_pedido_id,p_linea_id,p_operation_id,
    v_linea.estado,'CANCELADA',v_motivo,auth.uid(),p_terminal_id,p_session_id,
    p_operating_day,jsonb_build_object('linea_version',v_linea_version)
  );

  v_order_result:=private.abc_actualizar_estado_pedido_desde_lineas(
    p_empresa_id,p_local_id,v_pedido_id,p_operation_id,auth.uid(),
    p_terminal_id,p_session_id,p_operating_day
  );

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'PEDIDO_LINEA',p_linea_id::text,'PEDIDO_LINEA_CANCELADA',
    jsonb_build_object(
      'pedido_id',v_pedido_id,'estado_anterior',v_linea.estado,'estado','CANCELADA',
      'motivo',v_motivo,'linea_version',v_linea_version,
      'pedido_estado',v_order_result->>'estado',
      'pedido_version',(v_order_result->>'version')::bigint,'session_id',p_session_id
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'linea_id',p_linea_id,'estado','CANCELADA',
    'linea_version',v_linea_version,'pedido_id',v_pedido_id,
    'pedido_estado',v_order_result->>'estado',
    'pedido_version',(v_order_result->>'version')::bigint
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_cancelar_pedido(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_pedido_id uuid,
  p_motivo text,
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
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
  v_cmd jsonb;
  v_request jsonb;
  v_result jsonb;
  v_new_version bigint;
  v_canceladas integer;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_PEDIDO_CANCELAR') then
    raise exception 'pedido_cancelar_no_autorizado';
  end if;
  if v_motivo is null then raise exception 'motivo_cancelacion_requerido'; end if;
  if p_pedido_id is null or p_expected_pedido_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'pedido_cancelar_parametros_requeridos';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  v_request:=jsonb_build_object(
    'pedido_id',p_pedido_id,'motivo',v_motivo,
    'expected_pedido_version',p_expected_pedido_version,
    'terminal_id',p_terminal_id,'session_id',p_session_id,'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_CANCELAR_PEDIDO',v_request,p_terminal_id
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
  if v_pedido.estado in ('CERRADO','CANCELADO') then raise exception 'pedido_no_cancelable'; end if;
  if v_pedido.version<>p_expected_pedido_version then raise exception 'pedido_version_conflict'; end if;
  if v_pedido.created_operating_day<>p_operating_day then raise exception 'operating_day_pedido_inconsistente'; end if;

  perform 1
    from public.pedido_lineas
   where empresa_id=p_empresa_id and local_id=p_local_id and pedido_id=p_pedido_id
   order by id
   for update;

  if exists(
    select 1 from public.pedido_lineas
     where empresa_id=p_empresa_id and local_id=p_local_id and pedido_id=p_pedido_id
       and estado='SERVIDA'
  ) then
    raise exception 'pedido_con_lineas_servidas_no_cancelable';
  end if;

  insert into public.pedido_linea_transiciones(
    empresa_id,local_id,pedido_id,linea_id,operation_id,
    estado_anterior,estado_nuevo,motivo,actor_user_id,
    terminal_id,session_id,occurred_at,operating_day,metadata
  )
  select empresa_id,local_id,pedido_id,id,p_operation_id,
         estado,'CANCELADA',v_motivo,auth.uid(),p_terminal_id,p_session_id,
         now(),p_operating_day,
         jsonb_build_object('origen','CANCELACION_PEDIDO','linea_version',version+1)
    from public.pedido_lineas
   where empresa_id=p_empresa_id and local_id=p_local_id and pedido_id=p_pedido_id
     and estado<>'CANCELADA';

  get diagnostics v_canceladas = row_count;

  update public.pedido_lineas
     set estado='CANCELADA',
         version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and pedido_id=p_pedido_id
     and estado<>'CANCELADA';

  update public.pedidos_tpv
     set estado='CANCELADO',
         closed_at=now(),
         version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_pedido_id
  returning version into v_new_version;

  perform private.abc_registrar_transicion_pedido(
    p_empresa_id,p_local_id,p_pedido_id,p_operation_id,
    v_pedido.estado,'CANCELADO',v_motivo,auth.uid(),p_terminal_id,p_session_id,
    p_operating_day,jsonb_build_object('lineas_canceladas',v_canceladas)
  );

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'PEDIDO',p_pedido_id::text,'PEDIDO_CANCELADO',
    jsonb_build_object(
      'estado_anterior',v_pedido.estado,'estado','CANCELADO',
      'motivo',v_motivo,'pedido_version',v_new_version,
      'lineas_canceladas',v_canceladas,'session_id',p_session_id
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'pedido_id',p_pedido_id,'estado','CANCELADO',
    'pedido_version',v_new_version,'lineas_canceladas',v_canceladas
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_cerrar_pedido_operativo(
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
  v_new_version bigint;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_PEDIDO_CERRAR') then
    raise exception 'pedido_cerrar_no_autorizado';
  end if;
  if p_pedido_id is null or p_expected_pedido_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'pedido_cerrar_parametros_requeridos';
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
    p_operation_id,p_empresa_id,p_local_id,'ABC_CERRAR_PEDIDO_OPERATIVO',v_request,p_terminal_id
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
  if v_pedido.estado<>'SERVIDO' then raise exception 'pedido_no_cerrable_operativamente'; end if;
  if v_pedido.version<>p_expected_pedido_version then raise exception 'pedido_version_conflict'; end if;
  if v_pedido.created_operating_day<>p_operating_day then raise exception 'operating_day_pedido_inconsistente'; end if;

  update public.pedidos_tpv
     set estado='CERRADO',
         closed_at=now(),
         version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_pedido_id
  returning version into v_new_version;

  perform private.abc_registrar_transicion_pedido(
    p_empresa_id,p_local_id,p_pedido_id,p_operation_id,
    v_pedido.estado,'CERRADO',null,auth.uid(),p_terminal_id,p_session_id,
    p_operating_day,jsonb_build_object('cierre','OPERATIVO')
  );

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'PEDIDO',p_pedido_id::text,'PEDIDO_CERRADO_OPERATIVO',
    jsonb_build_object(
      'estado_anterior',v_pedido.estado,'estado','CERRADO',
      'pedido_version',v_new_version,'session_id',p_session_id
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'pedido_id',p_pedido_id,'estado','CERRADO','pedido_version',v_new_version
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_estado_cobro_cuenta(
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_total numeric(24,8);
  v_confirmado numeric(24,8);
  v_saldo numeric(24,8);
  v_estado text;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR') then
    raise exception 'estado_cobro_no_autorizado';
  end if;

  if not exists(
    select 1 from public.cuentas_comerciales c
     where c.empresa_id=p_empresa_id
       and c.local_id=p_local_id
       and c.id=p_cuenta_id
  ) then
    raise exception 'cuenta_no_encontrada';
  end if;

  select coalesce(sum(v.total),0)::numeric(24,8)
    into v_total
    from public.ventas_fiscales v
   where v.empresa_id=p_empresa_id
     and v.local_id=p_local_id
     and v.cuenta_id=p_cuenta_id
     and v.estado<>'CANCELADA';

  select coalesce(sum(a.sale_amount),0)::numeric(24,8)
    into v_confirmado
    from public.pago_aplicaciones a
    join public.pago_intentos i
      on i.empresa_id=a.empresa_id
     and i.local_id=a.local_id
     and i.id=a.intento_id
    join public.ventas_fiscales v
      on v.empresa_id=a.empresa_id
     and v.local_id=a.local_id
     and v.id=a.venta_fiscal_id
   where a.empresa_id=p_empresa_id
     and a.local_id=p_local_id
     and v.cuenta_id=p_cuenta_id
     and v.estado<>'CANCELADA'
     and i.estado='CONFIRMADO';

  if v_confirmado>v_total then raise exception 'estado_cobro_inconsistente'; end if;
  v_saldo:=(v_total-v_confirmado)::numeric(24,8);

  v_estado:=case
    when v_total=0 then 'SIN_COBRO'
    when v_confirmado=0 then 'PENDIENTE'
    when v_confirmado<v_total then 'PARCIALMENTE_PAGADO'
    else 'PAGADO'
  end;

  return jsonb_build_object(
    'cuenta_id',p_cuenta_id,
    'estado',v_estado,
    'total',v_total,
    'confirmado',v_confirmado,
    'saldo',v_saldo
  );
end $$;

revoke all on function private.abc_estado_agregado_pedido(text,text,uuid)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_registrar_transicion_pedido(
  text,text,uuid,text,text,text,text,uuid,uuid,uuid,date,jsonb
) from public,anon,authenticated,service_role;
revoke all on function private.abc_registrar_transicion_linea(
  text,text,uuid,uuid,text,text,text,text,uuid,uuid,uuid,date,jsonb
) from public,anon,authenticated,service_role;
revoke all on function private.abc_actualizar_estado_pedido_desde_lineas(
  text,text,uuid,text,uuid,uuid,uuid,date
) from public,anon,authenticated,service_role;
revoke all on function private.abc_transicionar_linea_operativa(
  text,text,text,text,uuid,bigint,bigint,uuid,uuid,date
) from public,anon,authenticated,service_role;

revoke all on function public.abc_enviar_pedido(
  text,text,text,uuid,bigint,uuid,uuid,date
) from public,anon,authenticated,service_role;
revoke all on function public.abc_iniciar_preparacion_linea(
  text,text,text,uuid,bigint,bigint,uuid,uuid,date
) from public,anon,authenticated,service_role;
revoke all on function public.abc_marcar_linea_preparada(
  text,text,text,uuid,bigint,bigint,uuid,uuid,date
) from public,anon,authenticated,service_role;
revoke all on function public.abc_servir_linea(
  text,text,text,uuid,bigint,bigint,uuid,uuid,date
) from public,anon,authenticated,service_role;
revoke all on function public.abc_cancelar_linea(
  text,text,text,uuid,text,bigint,bigint,uuid,uuid,date
) from public,anon,authenticated,service_role;
revoke all on function public.abc_cancelar_pedido(
  text,text,text,uuid,text,bigint,uuid,uuid,date
) from public,anon,authenticated,service_role;
revoke all on function public.abc_cerrar_pedido_operativo(
  text,text,text,uuid,bigint,uuid,uuid,date
) from public,anon,authenticated,service_role;
revoke all on function public.abc_estado_cobro_cuenta(
  text,text,uuid
) from public,anon,authenticated,service_role;

grant execute on function public.abc_enviar_pedido(
  text,text,text,uuid,bigint,uuid,uuid,date
) to authenticated;
grant execute on function public.abc_iniciar_preparacion_linea(
  text,text,text,uuid,bigint,bigint,uuid,uuid,date
) to authenticated;
grant execute on function public.abc_marcar_linea_preparada(
  text,text,text,uuid,bigint,bigint,uuid,uuid,date
) to authenticated;
grant execute on function public.abc_servir_linea(
  text,text,text,uuid,bigint,bigint,uuid,uuid,date
) to authenticated;
grant execute on function public.abc_cancelar_linea(
  text,text,text,uuid,text,bigint,bigint,uuid,uuid,date
) to authenticated;
grant execute on function public.abc_cancelar_pedido(
  text,text,text,uuid,text,bigint,uuid,uuid,date
) to authenticated;
grant execute on function public.abc_cerrar_pedido_operativo(
  text,text,text,uuid,bigint,uuid,uuid,date
) to authenticated;
grant execute on function public.abc_estado_cobro_cuenta(
  text,text,uuid
) to authenticated;
