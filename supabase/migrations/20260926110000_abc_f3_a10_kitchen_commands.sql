-- ABC F3 A10 — estaciones, comandas, cambios y entrega idempotente a preparación.
-- Aditiva. Reutiliza A05 para estados de preparación y M04C para outbox/leases.
-- No mueve stock, no cobra, no emite documentos fiscales y no crea datos reales.

do $$
declare
  v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.pedido_linea_transiciones') is null then v_missing:=array_append(v_missing,'pedido_linea_transiciones'); end if;
  if to_regclass('public.pedido_lineas') is null then v_missing:=array_append(v_missing,'pedido_lineas'); end if;
  if to_regclass('public.pedidos_tpv') is null then v_missing:=array_append(v_missing,'pedidos_tpv'); end if;
  if to_regclass('public.efectos_pendientes') is null then v_missing:=array_append(v_missing,'efectos_pendientes'); end if;
  if to_regprocedure('private.abc_encolar_efecto(text,text,text,text,text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_encolar_efecto'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.abc_terminal_sesion_operativa(text,text,uuid,uuid)') is null then v_missing:=array_append(v_missing,'abc_terminal_sesion_operativa'); end if;
  if to_regprocedure('public.abc_enviar_pedido(text,text,text,uuid,bigint,uuid,uuid,date)') is null then v_missing:=array_append(v_missing,'abc_enviar_pedido'); end if;
  if cardinality(v_missing)>0 then
    raise exception 'ABC_F3_A10_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  if to_regclass('public.tpv_estaciones_preparacion') is not null
     or to_regclass('public.tpv_producto_estaciones') is not null
     or to_regclass('public.comandas_preparacion') is not null
     or to_regclass('public.comanda_lineas') is not null
     or to_regprocedure('public.abc_crear_estacion_preparacion(text,text,text,uuid,text,text,text,uuid,uuid,date)') is not null
     or to_regprocedure('public.abc_reclamar_efectos_cocina(text,integer,integer)') is not null then
    raise exception 'ABC_F3_A10_PREFLIGHT_FALLO: objetos A10 ya existen';
  end if;
end $$;

create table public.tpv_estaciones_preparacion (
  id uuid not null default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  codigo text not null,
  nombre text not null,
  tipo text not null default 'OTRO',
  activo boolean not null default true,
  version bigint not null default 1,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  unique (empresa_id,local_id,id),
  unique (empresa_id,local_id,codigo),
  constraint a10_estacion_codigo check (nullif(btrim(codigo),'') is not null),
  constraint a10_estacion_nombre check (nullif(btrim(nombre),'') is not null),
  constraint a10_estacion_tipo check (tipo in ('COCINA','CHURRERIA','BARRA','BEBIDAS','OTRO')),
  constraint a10_estacion_version check (version>=1),
  constraint a10_estacion_local_fk
    foreign key (empresa_id,local_id) references public.locales(empresa_id,id) on delete restrict,
  constraint a10_estacion_actor_fk
    foreign key (created_by) references auth.users(id) on delete restrict
);

create table public.tpv_producto_estaciones (
  empresa_id text not null,
  local_id text not null,
  producto_id text not null,
  estacion_id uuid not null,
  prioridad smallint not null default 1,
  activo boolean not null default true,
  version bigint not null default 1,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (empresa_id,local_id,producto_id,estacion_id),
  constraint a10_prod_est_producto check (nullif(btrim(producto_id),'') is not null),
  constraint a10_prod_est_prioridad check (prioridad between 1 and 100),
  constraint a10_prod_est_version check (version>=1),
  constraint a10_prod_est_estacion_fk
    foreign key (empresa_id,local_id,estacion_id)
    references public.tpv_estaciones_preparacion(empresa_id,local_id,id) on delete restrict,
  constraint a10_prod_est_actor_fk
    foreign key (created_by) references auth.users(id) on delete restrict
);

create unique index a10_producto_estacion_activa_uq
  on public.tpv_producto_estaciones(empresa_id,local_id,producto_id)
  where activo=true;

create table public.comandas_preparacion (
  id uuid not null default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  pedido_id uuid not null,
  estacion_id uuid,
  operation_id text not null,
  tipo text not null,
  route_key text not null,
  estado text not null,
  version bigint not null default 1,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  received_at timestamptz,
  received_worker_ref text,
  primary key (id),
  unique (empresa_id,operation_id,route_key,tipo),
  constraint a10_comanda_tipo check (tipo in ('NUEVA','CAMBIO','CANCELACION')),
  constraint a10_comanda_estado check (estado in ('PENDIENTE','RECIBIDA','BLOQUEADA')),
  constraint a10_comanda_route check (nullif(btrim(route_key),'') is not null),
  constraint a10_comanda_version check (version>=1),
  constraint a10_comanda_pedido_fk
    foreign key (empresa_id,local_id,pedido_id)
    references public.pedidos_tpv(empresa_id,local_id,id) on delete restrict,
  constraint a10_comanda_estacion_fk
    foreign key (empresa_id,local_id,estacion_id)
    references public.tpv_estaciones_preparacion(empresa_id,local_id,id) on delete restrict,
  constraint a10_comanda_operacion_fk
    foreign key (empresa_id,local_id,operation_id)
    references public.abc_operaciones(empresa_id,local_id,operation_id) on delete restrict,
  constraint a10_comanda_actor_fk
    foreign key (created_by) references auth.users(id) on delete restrict,
  constraint a10_comanda_ruta_estado check (
    (estacion_id is null and estado='BLOQUEADA')
    or (estacion_id is not null and estado in ('PENDIENTE','RECIBIDA'))
  )
);

create index a10_comanda_estacion_estado_idx
  on public.comandas_preparacion(empresa_id,local_id,estacion_id,estado,created_at,id);

create table public.comanda_lineas (
  id uuid not null default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  comanda_id uuid not null,
  pedido_id uuid not null,
  linea_id uuid not null,
  accion text not null,
  estado_anterior text,
  estado_objetivo text not null,
  linea_version bigint not null,
  producto_id text not null,
  cantidad numeric(24,8) not null,
  nota text,
  decision_merma text not null default 'NO_APLICA',
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (comanda_id,linea_id,accion),
  constraint a10_comanda_linea_accion check (accion in ('ALTA','CAMBIO','CANCELACION')),
  constraint a10_comanda_linea_cantidad check (cantidad>0),
  constraint a10_comanda_linea_merma check (
    decision_merma in ('NO_APLICA','PENDIENTE','MERMA_CONFIRMADA','NO_MERMA')
  ),
  constraint a10_comanda_linea_snapshot check (jsonb_typeof(snapshot)='object'),
  constraint a10_comanda_linea_comanda_fk
    foreign key (comanda_id) references public.comandas_preparacion(id) on delete restrict,
  constraint a10_comanda_linea_pedido_fk
    foreign key (empresa_id,local_id,pedido_id)
    references public.pedidos_tpv(empresa_id,local_id,id) on delete restrict,
  constraint a10_comanda_linea_linea_fk
    foreign key (empresa_id,local_id,linea_id)
    references public.pedido_lineas(empresa_id,local_id,id) on delete restrict
);

alter table public.tpv_estaciones_preparacion enable row level security;
alter table public.tpv_producto_estaciones enable row level security;
alter table public.comandas_preparacion enable row level security;
alter table public.comanda_lineas enable row level security;

create policy a10_estaciones_select on public.tpv_estaciones_preparacion
  for select to authenticated using (private.la_tiene_local(empresa_id,local_id));
create policy a10_producto_estaciones_select on public.tpv_producto_estaciones
  for select to authenticated using (private.la_tiene_local(empresa_id,local_id));
create policy a10_comandas_select on public.comandas_preparacion
  for select to authenticated using (private.la_tiene_local(empresa_id,local_id));
create policy a10_comanda_lineas_select on public.comanda_lineas
  for select to authenticated using (private.la_tiene_local(empresa_id,local_id));

revoke all on table
  public.tpv_estaciones_preparacion,
  public.tpv_producto_estaciones,
  public.comandas_preparacion,
  public.comanda_lineas
from public,anon,authenticated,service_role;

grant select on table
  public.tpv_estaciones_preparacion,
  public.tpv_producto_estaciones,
  public.comandas_preparacion,
  public.comanda_lineas
to authenticated;

create function private.abc_a10_tiene_capacidad(
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
  v_cap text:=upper(btrim(coalesce(p_capacidad,'')));
begin
  if auth.uid() is null or v_cap='' or not private.la_tiene_local(p_empresa_id,p_local_id) then
    return false;
  end if;

  select m.rol into v_rol
    from public.membresias_usuario m
   where m.user_id=auth.uid()
     and m.empresa_id=p_empresa_id
     and m.activo=true
     and (
       (m.todos_locales=false and m.local_id=p_local_id)
       or (m.todos_locales=true and m.local_id is null)
     )
   order by case when m.todos_locales=false and m.local_id=p_local_id then 0 else 1 end,m.id desc
   limit 1;

  if v_rol is null then
    return false;
  end if;

  return case v_cap
    when 'ABC_COMANDA_VER' then v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a','Churrero/a')
    when 'ABC_COMANDA_CONFIGURAR' then v_rol in ('Propietario','Encargado')
    when 'ABC_COMANDA_CAMBIAR' then v_rol in ('Propietario','Encargado','Camarero/a')
    when 'ABC_COMANDA_REIMPRIMIR' then v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a','Churrero/a')
    when 'ABC_COMANDA_MERMA_DECIDIR' then v_rol in ('Propietario','Encargado')
    else false
  end;
end $$;

create function private.abc_a10_estacion_producto(
  p_empresa_id text,
  p_local_id text,
  p_producto_id text
)
returns uuid
language sql
stable
security definer
set search_path=''
as $$
  select pe.estacion_id
    from public.tpv_producto_estaciones pe
    join public.tpv_estaciones_preparacion e
      on e.empresa_id=pe.empresa_id
     and e.local_id=pe.local_id
     and e.id=pe.estacion_id
   where pe.empresa_id=$1 and pe.local_id=$2 and pe.producto_id=$3
     and pe.activo=true and e.activo=true
   order by pe.prioridad,pe.estacion_id
   limit 1
$$;

create function private.abc_a10_snapshot_linea(
  p_empresa_id text,
  p_local_id text,
  p_linea_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'linea_id',l.id,
    'pedido_id',l.pedido_id,
    'producto_id',l.producto_id,
    'cantidad',l.cantidad,
    'unidad',l.unidad,
    'precio_unitario',l.precio_unitario,
    'descuento_total',l.descuento_total,
    'base',l.base,
    'impuestos',l.impuestos,
    'total',l.total,
    'linea_version',l.version,
    'snapshot_comercial',l.snapshot_comercial,
    'opciones',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'grupo_id',o.grupo_id,'opcion_id',o.opcion_id,
          'nombre_grupo',o.nombre_grupo,'nombre_opcion',o.nombre_opcion,
          'cantidad',o.cantidad,'delta_precio_unitario',o.delta_precio_unitario,
          'snapshot',o.snapshot
        ) order by o.id
      )
      from public.pedido_linea_opciones o
      where o.empresa_id=l.empresa_id and o.local_id=l.local_id and o.linea_id=l.id
    ),'[]'::jsonb)
  )
  from public.pedido_lineas l
  where l.empresa_id=$1 and l.local_id=$2 and l.id=$3
$$;

create function private.abc_a10_encolar_comanda(
  p_comanda_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_cmd public.comandas_preparacion%rowtype;
  v_payload jsonb;
  v_tipo text;
begin
  select * into v_cmd
    from public.comandas_preparacion
   where id=p_comanda_id
   for update;

  if not found then raise exception 'comanda_no_encontrada'; end if;
  if v_cmd.estacion_id is null or v_cmd.estado='BLOQUEADA' then return null; end if;

  v_tipo:=case v_cmd.tipo
    when 'NUEVA' then 'KITCHEN_COMANDA'
    when 'CAMBIO' then 'KITCHEN_COMANDA_CAMBIO'
    when 'CANCELACION' then 'KITCHEN_COMANDA_CANCELACION'
  end;

  select jsonb_build_object(
    'comanda_id',v_cmd.id,
    'pedido_id',v_cmd.pedido_id,
    'estacion_id',v_cmd.estacion_id,
    'tipo',v_cmd.tipo,
    'lineas',coalesce(jsonb_agg(
      jsonb_build_object(
        'linea_id',cl.linea_id,
        'accion',cl.accion,
        'estado_anterior',cl.estado_anterior,
        'estado_objetivo',cl.estado_objetivo,
        'linea_version',cl.linea_version,
        'producto_id',cl.producto_id,
        'cantidad',cl.cantidad,
        'nota',cl.nota,
        'decision_merma',cl.decision_merma,
        'snapshot',cl.snapshot
      ) order by cl.id
    ),'[]'::jsonb)
  )
  into v_payload
  from public.comanda_lineas cl
  where cl.comanda_id=v_cmd.id;

  return private.abc_encolar_efecto(
    v_cmd.empresa_id,v_cmd.local_id,v_cmd.operation_id,
    v_tipo,'comanda:'||v_cmd.id::text,v_payload
  );
end $$;

create function private.abc_a10_procesar_transiciones_linea()
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
       where n.estado_nuevo in ('ENVIADA','CANCELADA')
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
         where n.estado_nuevo in ('ENVIADA','CANCELADA')
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

create trigger a10_pedido_linea_transiciones_comandas
after insert on public.pedido_linea_transiciones
referencing new table as a10_new_transitions
for each statement
execute function private.abc_a10_procesar_transiciones_linea();

create function public.abc_crear_estacion_preparacion(
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

  v_result:=jsonb_build_object('ok',true,'estacion_id',p_estacion_id,'version',1,'activo',true);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_actualizar_estacion_preparacion(
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

  v_result:=jsonb_build_object('ok',true,'estacion_id',p_estacion_id,'version',v_version,'activo',p_activo);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_asignar_producto_estacion(
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

  v_result:=jsonb_build_object('ok',true,'producto_id',v_producto,'estacion_id',p_estacion_id);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_enviar_cambio_comanda(
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
  v_result:=jsonb_build_object('ok',true,'comanda_id',v_comanda_id,'tipo','CAMBIO','estado','PENDIENTE');
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_reimprimir_comanda(
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

  v_result:=jsonb_build_object('ok',true,'comanda_id',p_comanda_id,'efecto_id',v_efecto,'tipo','REIMPRESION');
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_resolver_merma_comanda_linea(
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

  v_result:=jsonb_build_object(
    'ok',true,'comanda_linea_id',p_comanda_linea_id,'decision_merma',v_decision,
    'stock_mutado',false
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_listar_comandas_estacion(
  p_empresa_id text,
  p_local_id text,
  p_estacion_id uuid,
  p_limite integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if not private.abc_a10_tiene_capacidad(p_empresa_id,p_local_id,'ABC_COMANDA_VER') then
    raise exception 'comanda_ver_no_autorizado';
  end if;
  if p_limite is null or p_limite<1 or p_limite>500 then raise exception 'comanda_limite_invalido'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',c.id,'pedido_id',c.pedido_id,'estacion_id',c.estacion_id,
      'tipo',c.tipo,'estado',c.estado,'version',c.version,
      'created_at',c.created_at,'received_at',c.received_at,
      'lineas',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',cl.id,'linea_id',cl.linea_id,'accion',cl.accion,
          'producto_id',cl.producto_id,'cantidad',cl.cantidad,
          'nota',cl.nota,'decision_merma',cl.decision_merma,'snapshot',cl.snapshot
        ) order by cl.id)
        from public.comanda_lineas cl where cl.comanda_id=c.id
      ),'[]'::jsonb)
    ) order by c.created_at,c.id)
    from (
      select * from public.comandas_preparacion
       where empresa_id=p_empresa_id and local_id=p_local_id
         and (p_estacion_id is null or estacion_id=p_estacion_id)
       order by created_at,id
       limit p_limite
    ) c
  ),'[]'::jsonb);
end $$;

create function public.abc_reclamar_efectos_cocina(
  p_worker_ref text,
  p_limite integer default 10,
  p_lease_seconds integer default 60
)
returns setof public.efectos_pendientes
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_worker text:=btrim(coalesce(p_worker_ref,''));
begin
  if v_worker='' then raise exception 'worker_ref_requerido'; end if;
  if p_limite is null or p_limite<1 or p_limite>100 then raise exception 'limite_efectos_invalido'; end if;
  if p_lease_seconds is null or p_lease_seconds<5 or p_lease_seconds>3600 then raise exception 'lease_seconds_invalido'; end if;

  return query
  with candidatos as (
    select e.id
      from public.efectos_pendientes e
     where e.tipo in (
       'KITCHEN_COMANDA','KITCHEN_COMANDA_CAMBIO',
       'KITCHEN_COMANDA_CANCELACION','KITCHEN_COMANDA_REIMPRESION'
     )
       and (
         (e.estado in ('PENDIENTE','ERROR') and e.next_attempt_at<=now())
         or (e.estado='EN_PROCESO' and e.lease_until<=now())
       )
     order by case when e.estado='EN_PROCESO' then e.lease_until else e.next_attempt_at end,
              e.created_at,e.id
     for update skip locked
     limit p_limite
  )
  update public.efectos_pendientes e
     set estado='EN_PROCESO',attempt_count=e.attempt_count+1,last_attempt_at=now(),
         locked_at=now(),lease_until=now()+make_interval(secs=>p_lease_seconds),
         worker_ref=v_worker,next_attempt_at=null
    from candidatos c
   where e.id=c.id
  returning e.*;
end $$;

create function public.abc_confirmar_entrega_comanda(
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

  v_tipo:=v_efecto.tipo;
  return jsonb_build_object(
    'ok',true,'efecto_id',p_efecto_id,'comanda_id',v_comanda_id,
    'tipo',v_tipo,'estado','COMPLETADO'
  );
end $$;

revoke all on function private.abc_a10_tiene_capacidad(text,text,text) from public,anon,authenticated,service_role;
revoke all on function private.abc_a10_estacion_producto(text,text,text) from public,anon,authenticated,service_role;
revoke all on function private.abc_a10_snapshot_linea(text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function private.abc_a10_encolar_comanda(uuid) from public,anon,authenticated,service_role;
revoke all on function private.abc_a10_procesar_transiciones_linea() from public,anon,authenticated,service_role;

revoke all on function public.abc_crear_estacion_preparacion(text,text,text,uuid,text,text,text,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_actualizar_estacion_preparacion(text,text,text,uuid,text,text,boolean,bigint,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_asignar_producto_estacion(text,text,text,text,uuid,smallint,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_enviar_cambio_comanda(text,text,text,uuid,text,bigint,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_reimprimir_comanda(text,text,text,uuid,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_resolver_merma_comanda_linea(text,text,text,uuid,text,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_listar_comandas_estacion(text,text,uuid,integer) from public,anon,authenticated,service_role;
revoke all on function public.abc_reclamar_efectos_cocina(text,integer,integer) from public,anon,authenticated,service_role;
revoke all on function public.abc_confirmar_entrega_comanda(uuid,text) from public,anon,authenticated,service_role;

grant execute on function public.abc_crear_estacion_preparacion(text,text,text,uuid,text,text,text,uuid,uuid,date) to authenticated;
grant execute on function public.abc_actualizar_estacion_preparacion(text,text,text,uuid,text,text,boolean,bigint,uuid,uuid,date) to authenticated;
grant execute on function public.abc_asignar_producto_estacion(text,text,text,text,uuid,smallint,uuid,uuid,date) to authenticated;
grant execute on function public.abc_enviar_cambio_comanda(text,text,text,uuid,text,bigint,uuid,uuid,date) to authenticated;
grant execute on function public.abc_reimprimir_comanda(text,text,text,uuid,uuid,uuid,date) to authenticated;
grant execute on function public.abc_resolver_merma_comanda_linea(text,text,text,uuid,text,uuid,uuid,date) to authenticated;
grant execute on function public.abc_listar_comandas_estacion(text,text,uuid,integer) to authenticated;

grant execute on function public.abc_reclamar_efectos_cocina(text,integer,integer) to service_role;
grant execute on function public.abc_confirmar_entrega_comanda(uuid,text) to service_role;
