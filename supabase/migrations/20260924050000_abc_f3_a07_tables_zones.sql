-- ABC F3 A07 — mesas, zonas y responsables.
-- Aditiva. Crea catálogo de zonas/mesas, historial de asignación cuenta↔mesa,
-- mapa de sala y operaciones idempotentes/concurrentes.
-- Reutiliza responsable_actual/A06. No implementa split/merge A08 ni frontend.

do $$
declare
  v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.cuentas_comerciales') is null then v_missing:=array_append(v_missing,'cuentas_comerciales'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_terminal_sesion_operativa(text,text,uuid,uuid)') is null then v_missing:=array_append(v_missing,'abc_terminal_sesion_operativa'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('public.abc_recuperar_cuenta(text,text,uuid,uuid,uuid,date)') is null then v_missing:=array_append(v_missing,'abc_recuperar_cuenta'); end if;
  if to_regprocedure('public.abc_listar_cuentas_recuperables(text,text,uuid,uuid,date,integer)') is null then v_missing:=array_append(v_missing,'abc_listar_cuentas_recuperables'); end if;

  if cardinality(v_missing)>0 then
    raise exception 'ABC_F3_A07_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  if to_regclass('public.tpv_zonas') is not null
     or to_regclass('public.tpv_mesas') is not null
     or to_regclass('public.cuenta_mesa_asignaciones') is not null then
    raise exception 'ABC_F3_A07_PREFLIGHT_FALLO: tablas A07 ya existen';
  end if;
end $$;

create table public.tpv_zonas(
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  codigo text not null,
  nombre text not null,
  tipo text not null,
  orden integer not null default 0,
  activo boolean not null default true,
  version bigint not null default 1,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint a07_zona_local_fk foreign key(empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint a07_zona_created_by_fk foreign key(created_by)
    references auth.users(id) on delete restrict,
  constraint a07_zona_codigo check(nullif(btrim(codigo),'') is not null),
  constraint a07_zona_nombre check(nullif(btrim(nombre),'') is not null),
  constraint a07_zona_tipo check(tipo in ('SALA','TERRAZA','BARRA','EXTERIOR','OTRO')),
  constraint a07_zona_orden check(orden>=0),
  constraint a07_zona_version check(version>=1),
  constraint a07_zona_scope_id_uq unique(empresa_id,local_id,id),
  constraint a07_zona_scope_codigo_uq unique(empresa_id,local_id,codigo)
);

create index a07_zona_scope_activo_idx
  on public.tpv_zonas(empresa_id,local_id,activo,orden,id);

create table public.tpv_mesas(
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  zona_id uuid not null,
  codigo text not null,
  nombre text not null,
  capacidad integer not null default 1,
  orden integer not null default 0,
  activo boolean not null default true,
  estado_manual text not null default 'NORMAL',
  reservada_hasta timestamptz,
  reserva_ref text,
  notas text,
  version bigint not null default 1,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint a07_mesa_local_fk foreign key(empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint a07_mesa_zona_fk foreign key(empresa_id,local_id,zona_id)
    references public.tpv_zonas(empresa_id,local_id,id) on delete restrict,
  constraint a07_mesa_created_by_fk foreign key(created_by)
    references auth.users(id) on delete restrict,
  constraint a07_mesa_codigo check(nullif(btrim(codigo),'') is not null),
  constraint a07_mesa_nombre check(nullif(btrim(nombre),'') is not null),
  constraint a07_mesa_capacidad check(capacidad between 1 and 999),
  constraint a07_mesa_orden check(orden>=0),
  constraint a07_mesa_estado_manual check(estado_manual in ('NORMAL','RESERVADA','BLOQUEADA')),
  constraint a07_mesa_reserva_shape check(
    estado_manual='RESERVADA'
    or (reservada_hasta is null and reserva_ref is null)
  ),
  constraint a07_mesa_version check(version>=1),
  constraint a07_mesa_scope_id_uq unique(empresa_id,local_id,id),
  constraint a07_mesa_scope_codigo_uq unique(empresa_id,local_id,codigo)
);

create index a07_mesa_scope_zona_idx
  on public.tpv_mesas(empresa_id,local_id,zona_id,activo,orden,id);

create table public.cuenta_mesa_asignaciones(
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  cuenta_id uuid not null,
  mesa_id uuid not null,
  comensales integer not null default 1,
  desde timestamptz not null default now(),
  hasta timestamptz,
  motivo_fin text,
  actor_user_id uuid not null,
  terminal_id uuid not null,
  session_id uuid not null,
  operating_day date not null,
  cuenta_version_resultante bigint not null,
  mesa_version_resultante bigint not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint a07_asignacion_cuenta_fk foreign key(empresa_id,local_id,cuenta_id)
    references public.cuentas_comerciales(empresa_id,local_id,id) on delete restrict,
  constraint a07_asignacion_mesa_fk foreign key(empresa_id,local_id,mesa_id)
    references public.tpv_mesas(empresa_id,local_id,id) on delete restrict,
  constraint a07_asignacion_actor_fk foreign key(actor_user_id)
    references auth.users(id) on delete restrict,
  constraint a07_asignacion_terminal_fk foreign key(terminal_id)
    references public.terminales_tpv(id) on delete restrict,
  constraint a07_asignacion_session_fk foreign key(session_id)
    references public.caja_sesiones(id) on delete restrict,
  constraint a07_asignacion_comensales check(comensales between 1 and 999),
  constraint a07_asignacion_versiones check(
    cuenta_version_resultante>=1 and mesa_version_resultante>=1
  ),
  constraint a07_asignacion_fin check(
    (hasta is null and motivo_fin is null)
    or
    (hasta is not null and nullif(btrim(motivo_fin),'') is not null)
  )
);

create unique index a07_asignacion_cuenta_activa_uq
  on public.cuenta_mesa_asignaciones(empresa_id,local_id,cuenta_id)
  where hasta is null;

create index a07_asignacion_mesa_activa_idx
  on public.cuenta_mesa_asignaciones(empresa_id,local_id,mesa_id,desde,id)
  where hasta is null;

create index a07_asignacion_cuenta_hist_idx
  on public.cuenta_mesa_asignaciones(empresa_id,local_id,cuenta_id,desde desc,id);

alter table public.tpv_zonas enable row level security;
alter table public.tpv_mesas enable row level security;
alter table public.cuenta_mesa_asignaciones enable row level security;

create policy a07_zonas_select
on public.tpv_zonas for select to authenticated
using (private.la_tiene_local(empresa_id,local_id));

create policy a07_mesas_select
on public.tpv_mesas for select to authenticated
using (private.la_tiene_local(empresa_id,local_id));

create policy a07_asignaciones_select
on public.cuenta_mesa_asignaciones for select to authenticated
using (private.la_tiene_local(empresa_id,local_id));

revoke all on table public.tpv_zonas from public,anon,authenticated,service_role;
revoke all on table public.tpv_mesas from public,anon,authenticated,service_role;
revoke all on table public.cuenta_mesa_asignaciones from public,anon,authenticated,service_role;

grant select on table public.tpv_zonas to authenticated;
grant select on table public.tpv_mesas to authenticated;
grant select on table public.cuenta_mesa_asignaciones to authenticated;

create function private.abc_estado_mesa_efectivo(
  p_empresa_id text,
  p_local_id text,
  p_mesa_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_mesa public.tpv_mesas%rowtype;
begin
  select * into v_mesa
  from public.tpv_mesas
  where empresa_id=p_empresa_id and local_id=p_local_id and id=p_mesa_id;

  if not found then return null; end if;
  if not v_mesa.activo then return 'FUERA_SERVICIO'; end if;
  if v_mesa.estado_manual='BLOQUEADA' then return 'BLOQUEADA'; end if;

  if exists(
    select 1
    from public.cuenta_mesa_asignaciones a
    join public.cuentas_comerciales c
      on c.empresa_id=a.empresa_id
     and c.local_id=a.local_id
     and c.id=a.cuenta_id
    where a.empresa_id=p_empresa_id
      and a.local_id=p_local_id
      and a.mesa_id=p_mesa_id
      and a.hasta is null
      and c.estado='ABIERTA'
  ) then
    return 'OCUPADA';
  end if;

  if v_mesa.estado_manual='RESERVADA'
     and (v_mesa.reservada_hasta is null or v_mesa.reservada_hasta>now()) then
    return 'RESERVADA';
  end if;

  return 'LIBRE';
end $$;

create function private.abc_ubicacion_cuenta(
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select coalesce((
    select jsonb_build_object(
      'asignacion_id',a.id,
      'mesa_id',m.id,
      'mesa_codigo',m.codigo,
      'mesa_nombre',m.nombre,
      'mesa_version',m.version,
      'zona_id',z.id,
      'zona_codigo',z.codigo,
      'zona_nombre',z.nombre,
      'zona_tipo',z.tipo,
      'zona_version',z.version,
      'comensales',a.comensales,
      'asignada_desde',a.desde,
      'estado_mesa',private.abc_estado_mesa_efectivo(a.empresa_id,a.local_id,a.mesa_id)
    )
    from public.cuenta_mesa_asignaciones a
    join public.tpv_mesas m
      on m.empresa_id=a.empresa_id and m.local_id=a.local_id and m.id=a.mesa_id
    join public.tpv_zonas z
      on z.empresa_id=m.empresa_id and z.local_id=m.local_id and z.id=m.zona_id
    where a.empresa_id=$1 and a.local_id=$2 and a.cuenta_id=$3 and a.hasta is null
    limit 1
  ),'null'::jsonb)
$$;

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
    when 'ABC_CUENTA_REASIGNAR' then
      v_rol in ('Propietario','Encargado')
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
    when 'ABC_SALA_VER' then
      v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_SALA_CONFIGURAR' then
      v_rol in ('Propietario','Encargado')
    when 'ABC_MESA_ASIGNAR' then
      v_rol in ('Propietario','Encargado','Cajero/a','Camarero/a')
    when 'ABC_MESA_RESERVAR' then
      v_rol in ('Propietario','Encargado')
    when 'ABC_MESA_BLOQUEAR' then
      v_rol in ('Propietario','Encargado')
    else false
  end;
end $$;



create function public.abc_crear_zona(
  p_operation_id text,p_empresa_id text,p_local_id text,p_zona_id uuid,
  p_codigo text,p_nombre text,p_tipo text,p_orden integer,
  p_terminal_id uuid,p_session_id uuid,p_operating_day date
)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare
  v_codigo text:=upper(btrim(coalesce(p_codigo,'')));
  v_nombre text:=btrim(coalesce(p_nombre,''));
  v_tipo text:=upper(btrim(coalesce(p_tipo,'')));
  v_request jsonb; v_cmd jsonb; v_result jsonb;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_SALA_CONFIGURAR') then
    raise exception 'zona_configurar_no_autorizada';
  end if;
  if p_zona_id is null or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'zona_parametros_requeridos';
  end if;
  if v_codigo='' or v_nombre='' then raise exception 'zona_codigo_nombre_requeridos'; end if;
  if v_tipo not in ('SALA','TERRAZA','BARRA','EXTERIOR','OTRO') then raise exception 'zona_tipo_invalido'; end if;
  if p_orden is null or p_orden<0 then raise exception 'zona_orden_invalido'; end if;
  if not private.abc_terminal_sesion_operativa(p_empresa_id,p_local_id,p_terminal_id,p_session_id) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  v_request:=jsonb_build_object('zona_id',p_zona_id,'codigo',v_codigo,'nombre',v_nombre,'tipo',v_tipo,'orden',p_orden,'terminal_id',p_terminal_id,'session_id',p_session_id,'operating_day',p_operating_day);
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_CREAR_ZONA',v_request,p_terminal_id);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  insert into public.tpv_zonas(id,empresa_id,local_id,codigo,nombre,tipo,orden,created_by)
  values(p_zona_id,p_empresa_id,p_local_id,v_codigo,v_nombre,v_tipo,p_orden,auth.uid());

  insert into public.abc_eventos(empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day)
  values(p_empresa_id,p_local_id,p_operation_id,'ZONA',p_zona_id::text,'ZONA_CREADA',
    jsonb_build_object('codigo',v_codigo,'nombre',v_nombre,'tipo',v_tipo,'orden',p_orden,'version',1,'session_id',p_session_id),
    auth.uid(),p_terminal_id,now(),p_operating_day);

  v_result:=jsonb_build_object('ok',true,'zona_id',p_zona_id,'version',1,'codigo',v_codigo,'tipo',v_tipo);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_actualizar_zona(
  p_operation_id text,p_empresa_id text,p_local_id text,p_zona_id uuid,
  p_codigo text,p_nombre text,p_tipo text,p_orden integer,p_activo boolean,
  p_expected_version bigint,p_terminal_id uuid,p_session_id uuid,p_operating_day date
)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare
  v_zona public.tpv_zonas%rowtype;
  v_codigo text:=upper(btrim(coalesce(p_codigo,'')));
  v_nombre text:=btrim(coalesce(p_nombre,''));
  v_tipo text:=upper(btrim(coalesce(p_tipo,'')));
  v_request jsonb; v_cmd jsonb; v_result jsonb; v_new bigint;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_SALA_CONFIGURAR') then
    raise exception 'zona_configurar_no_autorizada';
  end if;
  if p_zona_id is null or p_activo is null or p_expected_version is null or p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'zona_parametros_requeridos';
  end if;
  if v_codigo='' or v_nombre='' or p_orden is null or p_orden<0 then raise exception 'zona_datos_invalidos'; end if;
  if v_tipo not in ('SALA','TERRAZA','BARRA','EXTERIOR','OTRO') then raise exception 'zona_tipo_invalido'; end if;
  if not private.abc_terminal_sesion_operativa(p_empresa_id,p_local_id,p_terminal_id,p_session_id) then raise exception 'terminal_sesion_no_operativa'; end if;

  v_request:=jsonb_build_object('zona_id',p_zona_id,'codigo',v_codigo,'nombre',v_nombre,'tipo',v_tipo,'orden',p_orden,'activo',p_activo,'expected_version',p_expected_version,'terminal_id',p_terminal_id,'session_id',p_session_id,'operating_day',p_operating_day);
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_ACTUALIZAR_ZONA',v_request,p_terminal_id);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_zona from public.tpv_zonas
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_zona_id for update;
  if not found then raise exception 'zona_no_encontrada'; end if;
  if v_zona.version<>p_expected_version then raise exception 'zona_version_conflict'; end if;

  if (not p_activo or v_zona.tipo<>v_tipo) and exists(
    select 1 from public.tpv_mesas m
    join public.cuenta_mesa_asignaciones a
      on a.empresa_id=m.empresa_id and a.local_id=m.local_id and a.mesa_id=m.id and a.hasta is null
    where m.empresa_id=p_empresa_id and m.local_id=p_local_id and m.zona_id=p_zona_id
  ) then
    raise exception 'zona_con_ocupacion_activa';
  end if;
  if not p_activo and exists(
    select 1 from public.tpv_mesas m
    where m.empresa_id=p_empresa_id and m.local_id=p_local_id and m.zona_id=p_zona_id and m.activo
  ) then
    raise exception 'zona_con_mesas_activas';
  end if;

  update public.tpv_zonas
     set codigo=v_codigo,nombre=v_nombre,tipo=v_tipo,orden=p_orden,activo=p_activo,
         version=version+1,updated_at=now()
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_zona_id
  returning version into v_new;

  insert into public.abc_eventos(empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day)
  values(p_empresa_id,p_local_id,p_operation_id,'ZONA',p_zona_id::text,'ZONA_CONFIGURADA',
    jsonb_build_object('codigo',v_codigo,'nombre',v_nombre,'tipo',v_tipo,'orden',p_orden,'activo',p_activo,'version',v_new,'session_id',p_session_id),
    auth.uid(),p_terminal_id,now(),p_operating_day);

  v_result:=jsonb_build_object('ok',true,'zona_id',p_zona_id,'version',v_new,'activo',p_activo);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_crear_mesa(
  p_operation_id text,p_empresa_id text,p_local_id text,p_mesa_id uuid,p_zona_id uuid,
  p_codigo text,p_nombre text,p_capacidad integer,p_orden integer,
  p_terminal_id uuid,p_session_id uuid,p_operating_day date
)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare
  v_codigo text:=upper(btrim(coalesce(p_codigo,'')));
  v_nombre text:=btrim(coalesce(p_nombre,''));
  v_request jsonb; v_cmd jsonb; v_result jsonb;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_SALA_CONFIGURAR') then raise exception 'mesa_configurar_no_autorizada'; end if;
  if p_mesa_id is null or p_zona_id is null or p_terminal_id is null or p_session_id is null or p_operating_day is null then raise exception 'mesa_parametros_requeridos'; end if;
  if v_codigo='' or v_nombre='' or p_capacidad is null or p_capacidad<1 or p_capacidad>999 or p_orden is null or p_orden<0 then raise exception 'mesa_datos_invalidos'; end if;
  if not private.abc_terminal_sesion_operativa(p_empresa_id,p_local_id,p_terminal_id,p_session_id) then raise exception 'terminal_sesion_no_operativa'; end if;
  if not exists(select 1 from public.tpv_zonas z where z.empresa_id=p_empresa_id and z.local_id=p_local_id and z.id=p_zona_id and z.activo) then raise exception 'zona_no_activa'; end if;

  v_request:=jsonb_build_object('mesa_id',p_mesa_id,'zona_id',p_zona_id,'codigo',v_codigo,'nombre',v_nombre,'capacidad',p_capacidad,'orden',p_orden,'terminal_id',p_terminal_id,'session_id',p_session_id,'operating_day',p_operating_day);
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_CREAR_MESA',v_request,p_terminal_id);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  insert into public.tpv_mesas(id,empresa_id,local_id,zona_id,codigo,nombre,capacidad,orden,created_by)
  values(p_mesa_id,p_empresa_id,p_local_id,p_zona_id,v_codigo,v_nombre,p_capacidad,p_orden,auth.uid());

  insert into public.abc_eventos(empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day)
  values(p_empresa_id,p_local_id,p_operation_id,'MESA',p_mesa_id::text,'MESA_CREADA',
    jsonb_build_object('zona_id',p_zona_id,'codigo',v_codigo,'nombre',v_nombre,'capacidad',p_capacidad,'orden',p_orden,'version',1,'session_id',p_session_id),
    auth.uid(),p_terminal_id,now(),p_operating_day);

  v_result:=jsonb_build_object('ok',true,'mesa_id',p_mesa_id,'zona_id',p_zona_id,'version',1);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_actualizar_mesa(
  p_operation_id text,p_empresa_id text,p_local_id text,p_mesa_id uuid,p_zona_id uuid,
  p_codigo text,p_nombre text,p_capacidad integer,p_orden integer,p_activo boolean,p_notas text,
  p_expected_version bigint,p_terminal_id uuid,p_session_id uuid,p_operating_day date
)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare
  v_mesa public.tpv_mesas%rowtype;
  v_codigo text:=upper(btrim(coalesce(p_codigo,'')));
  v_nombre text:=btrim(coalesce(p_nombre,''));
  v_notas text:=nullif(btrim(coalesce(p_notas,'')),'');
  v_request jsonb; v_cmd jsonb; v_result jsonb; v_new bigint;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_SALA_CONFIGURAR') then raise exception 'mesa_configurar_no_autorizada'; end if;
  if p_mesa_id is null or p_zona_id is null or p_activo is null or p_expected_version is null or p_terminal_id is null or p_session_id is null or p_operating_day is null then raise exception 'mesa_parametros_requeridos'; end if;
  if v_codigo='' or v_nombre='' or p_capacidad is null or p_capacidad<1 or p_capacidad>999 or p_orden is null or p_orden<0 then raise exception 'mesa_datos_invalidos'; end if;
  if not private.abc_terminal_sesion_operativa(p_empresa_id,p_local_id,p_terminal_id,p_session_id) then raise exception 'terminal_sesion_no_operativa'; end if;
  if not exists(select 1 from public.tpv_zonas z where z.empresa_id=p_empresa_id and z.local_id=p_local_id and z.id=p_zona_id and z.activo) then raise exception 'zona_no_activa'; end if;

  v_request:=jsonb_build_object('mesa_id',p_mesa_id,'zona_id',p_zona_id,'codigo',v_codigo,'nombre',v_nombre,'capacidad',p_capacidad,'orden',p_orden,'activo',p_activo,'notas',v_notas,'expected_version',p_expected_version,'terminal_id',p_terminal_id,'session_id',p_session_id,'operating_day',p_operating_day);
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_ACTUALIZAR_MESA',v_request,p_terminal_id);
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
     set zona_id=p_zona_id,codigo=v_codigo,nombre=v_nombre,capacidad=p_capacidad,orden=p_orden,
         activo=p_activo,notas=v_notas,version=version+1,updated_at=now()
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_mesa_id
  returning version into v_new;

  insert into public.abc_eventos(empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day)
  values(p_empresa_id,p_local_id,p_operation_id,'MESA',p_mesa_id::text,'MESA_CONFIGURADA',
    jsonb_build_object('zona_anterior',v_mesa.zona_id,'zona_actual',p_zona_id,'codigo',v_codigo,'nombre',v_nombre,'capacidad',p_capacidad,'orden',p_orden,'activo',p_activo,'notas',v_notas,'version',v_new,'session_id',p_session_id),
    auth.uid(),p_terminal_id,now(),p_operating_day);

  v_result:=jsonb_build_object('ok',true,'mesa_id',p_mesa_id,'version',v_new,'activo',p_activo);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_cambiar_estado_mesa(
  p_operation_id text,p_empresa_id text,p_local_id text,p_mesa_id uuid,
  p_estado_manual text,p_reservada_hasta timestamptz,p_reserva_ref text,p_notas text,
  p_expected_mesa_version bigint,p_terminal_id uuid,p_session_id uuid,p_operating_day date
)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare
  v_mesa public.tpv_mesas%rowtype;
  v_estado text:=upper(btrim(coalesce(p_estado_manual,'')));
  v_ref text:=nullif(btrim(coalesce(p_reserva_ref,'')),'');
  v_notas text:=nullif(btrim(coalesce(p_notas,'')),'');
  v_cap text; v_event text; v_request jsonb; v_cmd jsonb; v_result jsonb; v_new bigint;
begin
  v_cap:=case when v_estado='RESERVADA' then 'ABC_MESA_RESERVAR' else 'ABC_MESA_BLOQUEAR' end;
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,v_cap) then raise exception 'mesa_estado_no_autorizado'; end if;
  if p_mesa_id is null or p_expected_mesa_version is null or p_terminal_id is null or p_session_id is null or p_operating_day is null then raise exception 'mesa_estado_parametros_requeridos'; end if;
  if v_estado not in ('NORMAL','RESERVADA','BLOQUEADA') then raise exception 'mesa_estado_manual_invalido'; end if;
  if v_estado='RESERVADA' and p_reservada_hasta is not null and p_reservada_hasta<=now() then raise exception 'reserva_hasta_no_futura'; end if;
  if v_estado<>'RESERVADA' then p_reservada_hasta:=null; v_ref:=null; end if;
  if not private.abc_terminal_sesion_operativa(p_empresa_id,p_local_id,p_terminal_id,p_session_id) then raise exception 'terminal_sesion_no_operativa'; end if;

  v_request:=jsonb_build_object('mesa_id',p_mesa_id,'estado_manual',v_estado,'reservada_hasta',p_reservada_hasta,'reserva_ref',v_ref,'notas',v_notas,'expected_mesa_version',p_expected_mesa_version,'terminal_id',p_terminal_id,'session_id',p_session_id,'operating_day',p_operating_day);
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_CAMBIAR_ESTADO_MESA',v_request,p_terminal_id);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_mesa from public.tpv_mesas
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_mesa_id for update;
  if not found then raise exception 'mesa_no_encontrada'; end if;
  if v_mesa.version<>p_expected_mesa_version then raise exception 'mesa_version_conflict'; end if;
  if not v_mesa.activo then raise exception 'mesa_fuera_servicio'; end if;
  if v_estado<>'NORMAL' and exists(
    select 1 from public.cuenta_mesa_asignaciones a
    where a.empresa_id=p_empresa_id and a.local_id=p_local_id and a.mesa_id=p_mesa_id and a.hasta is null
  ) then raise exception 'mesa_ocupada_no_cambia_estado_manual'; end if;

  update public.tpv_mesas
     set estado_manual=v_estado,reservada_hasta=p_reservada_hasta,reserva_ref=v_ref,
         notas=coalesce(v_notas,notas),version=version+1,updated_at=now()
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_mesa_id
  returning version into v_new;

  v_event:=case v_estado when 'RESERVADA' then 'MESA_RESERVADA' when 'BLOQUEADA' then 'MESA_BLOQUEADA' else 'MESA_DESBLOQUEADA' end;
  insert into public.abc_eventos(empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day)
  values(p_empresa_id,p_local_id,p_operation_id,'MESA',p_mesa_id::text,v_event,
    jsonb_build_object('estado_anterior',v_mesa.estado_manual,'estado_actual',v_estado,'reservada_hasta',p_reservada_hasta,'reserva_ref',v_ref,'version',v_new,'session_id',p_session_id),
    auth.uid(),p_terminal_id,now(),p_operating_day);

  v_result:=jsonb_build_object('ok',true,'mesa_id',p_mesa_id,'estado_manual',v_estado,'estado_efectivo',private.abc_estado_mesa_efectivo(p_empresa_id,p_local_id,p_mesa_id),'version',v_new);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_asignar_cuenta_mesa(
  p_operation_id text,p_empresa_id text,p_local_id text,p_cuenta_id uuid,p_mesa_id uuid,
  p_comensales integer,p_expected_cuenta_version bigint,p_expected_mesa_version bigint,
  p_terminal_id uuid,p_session_id uuid,p_operating_day date
)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare
  v_cuenta public.cuentas_comerciales%rowtype;
  v_mesa public.tpv_mesas%rowtype;
  v_zona public.tpv_zonas%rowtype;
  v_request jsonb; v_cmd jsonb; v_result jsonb;
  v_cv bigint; v_mv bigint; v_asig uuid:=gen_random_uuid(); v_modalidad text;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_MESA_ASIGNAR') then raise exception 'mesa_asignar_no_autorizada'; end if;
  if p_cuenta_id is null or p_mesa_id is null or p_comensales is null or p_comensales<1 or p_comensales>999
     or p_expected_cuenta_version is null or p_expected_mesa_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then raise exception 'mesa_asignar_parametros_invalidos'; end if;
  if not private.abc_terminal_sesion_operativa(p_empresa_id,p_local_id,p_terminal_id,p_session_id) then raise exception 'terminal_sesion_no_operativa'; end if;

  v_request:=jsonb_build_object('cuenta_id',p_cuenta_id,'mesa_id',p_mesa_id,'comensales',p_comensales,'expected_cuenta_version',p_expected_cuenta_version,'expected_mesa_version',p_expected_mesa_version,'terminal_id',p_terminal_id,'session_id',p_session_id,'operating_day',p_operating_day);
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_ASIGNAR_CUENTA_MESA',v_request,p_terminal_id);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_cuenta from public.cuentas_comerciales
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_id for update;
  if not found then raise exception 'cuenta_no_encontrada'; end if;
  if v_cuenta.estado<>'ABIERTA' then raise exception 'cuenta_no_abierta'; end if;
  if v_cuenta.version<>p_expected_cuenta_version then raise exception 'cuenta_version_conflict'; end if;
  if v_cuenta.opened_operating_day<>p_operating_day then raise exception 'operating_day_cuenta_inconsistente'; end if;
  if exists(select 1 from public.cuenta_mesa_asignaciones a where a.empresa_id=p_empresa_id and a.local_id=p_local_id and a.cuenta_id=p_cuenta_id and a.hasta is null) then raise exception 'cuenta_ya_asignada_mesa'; end if;

  select * into v_mesa from public.tpv_mesas
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_mesa_id for update;
  if not found then raise exception 'mesa_no_encontrada'; end if;
  if v_mesa.version<>p_expected_mesa_version then raise exception 'mesa_version_conflict'; end if;
  if not v_mesa.activo then raise exception 'mesa_fuera_servicio'; end if;
  if private.abc_estado_mesa_efectivo(p_empresa_id,p_local_id,p_mesa_id) in ('BLOQUEADA','RESERVADA','FUERA_SERVICIO') then raise exception 'mesa_no_asignable'; end if;

  select * into v_zona from public.tpv_zonas
   where empresa_id=p_empresa_id and local_id=p_local_id and id=v_mesa.zona_id;
  if not found or not v_zona.activo then raise exception 'zona_no_activa'; end if;
  v_modalidad:=case when v_zona.tipo='TERRAZA' then 'TERRAZA' else 'MESA' end;

  update public.cuentas_comerciales set modalidad=v_modalidad,version=version+1
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_id returning version into v_cv;

  update public.tpv_mesas
     set estado_manual=case when estado_manual='RESERVADA' and reservada_hasta is not null and reservada_hasta<=now() then 'NORMAL' else estado_manual end,
         reservada_hasta=case when estado_manual='RESERVADA' and reservada_hasta is not null and reservada_hasta<=now() then null else reservada_hasta end,
         reserva_ref=case when estado_manual='RESERVADA' and reservada_hasta is not null and reservada_hasta<=now() then null else reserva_ref end,
         version=version+1,updated_at=now()
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_mesa_id returning version into v_mv;

  insert into public.cuenta_mesa_asignaciones(
    id,empresa_id,local_id,cuenta_id,mesa_id,comensales,actor_user_id,terminal_id,session_id,operating_day,
    cuenta_version_resultante,mesa_version_resultante,snapshot
  ) values(
    v_asig,p_empresa_id,p_local_id,p_cuenta_id,p_mesa_id,p_comensales,auth.uid(),p_terminal_id,p_session_id,p_operating_day,
    v_cv,v_mv,jsonb_build_object('zona_id',v_zona.id,'zona_codigo',v_zona.codigo,'zona_nombre',v_zona.nombre,'zona_tipo',v_zona.tipo,'mesa_codigo',v_mesa.codigo,'mesa_nombre',v_mesa.nombre,'modalidad',v_modalidad)
  );

  insert into public.abc_eventos(empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day)
  values(p_empresa_id,p_local_id,p_operation_id,'CUENTA',p_cuenta_id::text,'CUENTA_MESA_ASIGNADA',
    jsonb_build_object('asignacion_id',v_asig,'mesa_id',p_mesa_id,'zona_id',v_zona.id,'comensales',p_comensales,'cuenta_version',v_cv,'mesa_version',v_mv,'session_id',p_session_id),
    auth.uid(),p_terminal_id,now(),p_operating_day);

  v_result:=jsonb_build_object('ok',true,'cuenta_id',p_cuenta_id,'mesa_id',p_mesa_id,'asignacion_id',v_asig,'comensales',p_comensales,'cuenta_version',v_cv,'mesa_version',v_mv,'modalidad',v_modalidad);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_mover_cuenta_mesa(
  p_operation_id text,p_empresa_id text,p_local_id text,p_cuenta_id uuid,p_mesa_destino_id uuid,
  p_comensales integer,p_motivo text,p_expected_cuenta_version bigint,
  p_expected_mesa_origen_version bigint,p_expected_mesa_destino_version bigint,
  p_terminal_id uuid,p_session_id uuid,p_operating_day date
)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare
  v_cuenta public.cuentas_comerciales%rowtype;
  v_asig public.cuenta_mesa_asignaciones%rowtype;
  v_origen public.tpv_mesas%rowtype; v_dest public.tpv_mesas%rowtype; v_zona public.tpv_zonas%rowtype;
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
  v_request jsonb; v_cmd jsonb; v_result jsonb; v_new_asig uuid:=gen_random_uuid();
  v_cv bigint; v_ov bigint; v_dv bigint; v_modalidad text;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_MESA_ASIGNAR') then raise exception 'mesa_mover_no_autorizada'; end if;
  if p_cuenta_id is null or p_mesa_destino_id is null or p_comensales is null or p_comensales<1 or p_comensales>999
     or v_motivo is null or p_expected_cuenta_version is null or p_expected_mesa_origen_version is null or p_expected_mesa_destino_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null then raise exception 'mesa_mover_parametros_invalidos'; end if;
  if not private.abc_terminal_sesion_operativa(p_empresa_id,p_local_id,p_terminal_id,p_session_id) then raise exception 'terminal_sesion_no_operativa'; end if;

  v_request:=jsonb_build_object('cuenta_id',p_cuenta_id,'mesa_destino_id',p_mesa_destino_id,'comensales',p_comensales,'motivo',v_motivo,'expected_cuenta_version',p_expected_cuenta_version,'expected_mesa_origen_version',p_expected_mesa_origen_version,'expected_mesa_destino_version',p_expected_mesa_destino_version,'terminal_id',p_terminal_id,'session_id',p_session_id,'operating_day',p_operating_day);
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_MOVER_CUENTA_MESA',v_request,p_terminal_id);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_cuenta from public.cuentas_comerciales
   where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_id for update;
  if not found then raise exception 'cuenta_no_encontrada'; end if;
  if v_cuenta.estado<>'ABIERTA' then raise exception 'cuenta_no_abierta'; end if;
  if v_cuenta.version<>p_expected_cuenta_version then raise exception 'cuenta_version_conflict'; end if;
  if v_cuenta.opened_operating_day<>p_operating_day then raise exception 'operating_day_cuenta_inconsistente'; end if;

  select * into v_asig from public.cuenta_mesa_asignaciones
   where empresa_id=p_empresa_id and local_id=p_local_id and cuenta_id=p_cuenta_id and hasta is null for update;
  if not found then raise exception 'cuenta_sin_mesa_activa'; end if;
  if v_asig.mesa_id=p_mesa_destino_id then raise exception 'mesa_destino_igual_origen'; end if;

  perform 1 from public.tpv_mesas
   where empresa_id=p_empresa_id and local_id=p_local_id and id in(v_asig.mesa_id,p_mesa_destino_id)
   order by id for update;

  select * into v_origen from public.tpv_mesas where empresa_id=p_empresa_id and local_id=p_local_id and id=v_asig.mesa_id;
  select * into v_dest from public.tpv_mesas where empresa_id=p_empresa_id and local_id=p_local_id and id=p_mesa_destino_id;
  if v_dest.id is null then raise exception 'mesa_destino_no_encontrada'; end if;
  if v_origen.version<>p_expected_mesa_origen_version then raise exception 'mesa_origen_version_conflict'; end if;
  if v_dest.version<>p_expected_mesa_destino_version then raise exception 'mesa_destino_version_conflict'; end if;
  if not v_dest.activo or private.abc_estado_mesa_efectivo(p_empresa_id,p_local_id,p_mesa_destino_id) in ('BLOQUEADA','RESERVADA','FUERA_SERVICIO') then raise exception 'mesa_destino_no_asignable'; end if;

  select * into v_zona from public.tpv_zonas where empresa_id=p_empresa_id and local_id=p_local_id and id=v_dest.zona_id;
  if not found or not v_zona.activo then raise exception 'zona_destino_no_activa'; end if;
  v_modalidad:=case when v_zona.tipo='TERRAZA' then 'TERRAZA' else 'MESA' end;

  update public.cuenta_mesa_asignaciones set hasta=now(),motivo_fin=v_motivo where id=v_asig.id;
  update public.tpv_mesas set version=version+1,updated_at=now() where id=v_origen.id returning version into v_ov;
  update public.tpv_mesas
     set estado_manual=case when estado_manual='RESERVADA' and reservada_hasta is not null and reservada_hasta<=now() then 'NORMAL' else estado_manual end,
         reservada_hasta=case when estado_manual='RESERVADA' and reservada_hasta is not null and reservada_hasta<=now() then null else reservada_hasta end,
         reserva_ref=case when estado_manual='RESERVADA' and reservada_hasta is not null and reservada_hasta<=now() then null else reserva_ref end,
         version=version+1,updated_at=now()
   where id=v_dest.id returning version into v_dv;
  update public.cuentas_comerciales set modalidad=v_modalidad,version=version+1 where id=p_cuenta_id returning version into v_cv;

  insert into public.cuenta_mesa_asignaciones(
    id,empresa_id,local_id,cuenta_id,mesa_id,comensales,actor_user_id,terminal_id,session_id,operating_day,
    cuenta_version_resultante,mesa_version_resultante,snapshot
  ) values(
    v_new_asig,p_empresa_id,p_local_id,p_cuenta_id,p_mesa_destino_id,p_comensales,auth.uid(),p_terminal_id,p_session_id,p_operating_day,
    v_cv,v_dv,jsonb_build_object('zona_id',v_zona.id,'zona_codigo',v_zona.codigo,'zona_nombre',v_zona.nombre,'zona_tipo',v_zona.tipo,'mesa_codigo',v_dest.codigo,'mesa_nombre',v_dest.nombre,'modalidad',v_modalidad,'origen_mesa_id',v_origen.id)
  );

  insert into public.abc_eventos(empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day)
  values(p_empresa_id,p_local_id,p_operation_id,'CUENTA',p_cuenta_id::text,'CUENTA_MESA_MOVIDA',
    jsonb_build_object('asignacion_anterior_id',v_asig.id,'asignacion_nueva_id',v_new_asig,'mesa_origen_id',v_origen.id,'mesa_destino_id',v_dest.id,'comensales',p_comensales,'motivo',v_motivo,'cuenta_version',v_cv,'mesa_origen_version',v_ov,'mesa_destino_version',v_dv,'session_id',p_session_id),
    auth.uid(),p_terminal_id,now(),p_operating_day);

  v_result:=jsonb_build_object('ok',true,'cuenta_id',p_cuenta_id,'mesa_origen_id',v_origen.id,'mesa_destino_id',v_dest.id,'asignacion_id',v_new_asig,'cuenta_version',v_cv,'mesa_origen_version',v_ov,'mesa_destino_version',v_dv,'modalidad',v_modalidad);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_liberar_cuenta_mesa(
  p_operation_id text,p_empresa_id text,p_local_id text,p_cuenta_id uuid,p_motivo text,
  p_expected_cuenta_version bigint,p_expected_mesa_version bigint,
  p_terminal_id uuid,p_session_id uuid,p_operating_day date
)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare
  v_cuenta public.cuentas_comerciales%rowtype; v_asig public.cuenta_mesa_asignaciones%rowtype; v_mesa public.tpv_mesas%rowtype;
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
  v_request jsonb; v_cmd jsonb; v_result jsonb; v_cv bigint; v_mv bigint;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_MESA_ASIGNAR') then raise exception 'mesa_liberar_no_autorizada'; end if;
  if p_cuenta_id is null or v_motivo is null or p_expected_cuenta_version is null or p_expected_mesa_version is null or p_terminal_id is null or p_session_id is null or p_operating_day is null then raise exception 'mesa_liberar_parametros_invalidos'; end if;
  if not private.abc_terminal_sesion_operativa(p_empresa_id,p_local_id,p_terminal_id,p_session_id) then raise exception 'terminal_sesion_no_operativa'; end if;

  v_request:=jsonb_build_object('cuenta_id',p_cuenta_id,'motivo',v_motivo,'expected_cuenta_version',p_expected_cuenta_version,'expected_mesa_version',p_expected_mesa_version,'terminal_id',p_terminal_id,'session_id',p_session_id,'operating_day',p_operating_day);
  v_cmd:=private.abc_operacion_iniciar(p_operation_id,p_empresa_id,p_local_id,'ABC_LIBERAR_CUENTA_MESA',v_request,p_terminal_id);
  if (v_cmd->>'replayed')::boolean then return coalesce(v_cmd->'resultado',v_cmd); end if;

  select * into v_cuenta from public.cuentas_comerciales where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_id for update;
  if not found then raise exception 'cuenta_no_encontrada'; end if;
  if v_cuenta.estado<>'ABIERTA' then raise exception 'cuenta_no_abierta'; end if;
  if v_cuenta.version<>p_expected_cuenta_version then raise exception 'cuenta_version_conflict'; end if;
  if v_cuenta.opened_operating_day<>p_operating_day then raise exception 'operating_day_cuenta_inconsistente'; end if;

  select * into v_asig from public.cuenta_mesa_asignaciones where empresa_id=p_empresa_id and local_id=p_local_id and cuenta_id=p_cuenta_id and hasta is null for update;
  if not found then raise exception 'cuenta_sin_mesa_activa'; end if;
  select * into v_mesa from public.tpv_mesas where empresa_id=p_empresa_id and local_id=p_local_id and id=v_asig.mesa_id for update;
  if v_mesa.version<>p_expected_mesa_version then raise exception 'mesa_version_conflict'; end if;

  update public.cuenta_mesa_asignaciones set hasta=now(),motivo_fin=v_motivo where id=v_asig.id;
  update public.tpv_mesas set version=version+1,updated_at=now() where id=v_mesa.id returning version into v_mv;
  update public.cuentas_comerciales set version=version+1 where id=p_cuenta_id returning version into v_cv;

  insert into public.abc_eventos(empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,payload,actor_user_id,terminal_id,occurred_at,operating_day)
  values(p_empresa_id,p_local_id,p_operation_id,'CUENTA',p_cuenta_id::text,'CUENTA_MESA_LIBERADA',
    jsonb_build_object('asignacion_id',v_asig.id,'mesa_id',v_mesa.id,'motivo',v_motivo,'cuenta_version',v_cv,'mesa_version',v_mv,'session_id',p_session_id),
    auth.uid(),p_terminal_id,now(),p_operating_day);

  v_result:=jsonb_build_object('ok',true,'cuenta_id',p_cuenta_id,'mesa_id',v_mesa.id,'cuenta_version',v_cv,'mesa_version',v_mv);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_listar_mapa_sala(
  p_empresa_id text,p_local_id text,p_terminal_id uuid,p_session_id uuid,p_operating_day date
)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_zonas jsonb;
begin
  if auth.uid() is null or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_SALA_VER') then raise exception 'sala_ver_no_autorizada'; end if;
  if p_terminal_id is null or p_session_id is null or p_operating_day is null then raise exception 'sala_parametros_requeridos'; end if;
  if not private.abc_terminal_sesion_operativa(p_empresa_id,p_local_id,p_terminal_id,p_session_id) then raise exception 'terminal_sesion_no_operativa'; end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'zona_id',z.id,'codigo',z.codigo,'nombre',z.nombre,'tipo',z.tipo,'orden',z.orden,'version',z.version,
      'mesas',coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'mesa_id',m.id,'codigo',m.codigo,'nombre',m.nombre,'capacidad',m.capacidad,'orden',m.orden,
            'version',m.version,'estado_manual',m.estado_manual,'estado_efectivo',private.abc_estado_mesa_efectivo(m.empresa_id,m.local_id,m.id),
            'reservada_hasta',m.reservada_hasta,'reserva_ref',m.reserva_ref,'notas',m.notas,
            'ocupacion_comensales',coalesce((select sum(a.comensales) from public.cuenta_mesa_asignaciones a where a.empresa_id=m.empresa_id and a.local_id=m.local_id and a.mesa_id=m.id and a.hasta is null),0),
            'sobre_capacidad',coalesce((select sum(a.comensales) from public.cuenta_mesa_asignaciones a where a.empresa_id=m.empresa_id and a.local_id=m.local_id and a.mesa_id=m.id and a.hasta is null),0)>m.capacidad,
            'cuentas',coalesce((
              select jsonb_agg(jsonb_build_object(
                'cuenta_id',c.id,'cuenta_version',c.version,'modalidad',c.modalidad,'responsable_actual',c.responsable_actual,
                'comensales',a.comensales,'asignada_desde',a.desde
              ) order by a.desde,a.id)
              from public.cuenta_mesa_asignaciones a
              join public.cuentas_comerciales c on c.empresa_id=a.empresa_id and c.local_id=a.local_id and c.id=a.cuenta_id
              where a.empresa_id=m.empresa_id and a.local_id=m.local_id and a.mesa_id=m.id and a.hasta is null and c.estado='ABIERTA'
            ),'[]'::jsonb)
          ) order by m.orden,m.codigo,m.id
        )
        from public.tpv_mesas m
        where m.empresa_id=z.empresa_id and m.local_id=z.local_id and m.zona_id=z.id and m.activo
      ),'[]'::jsonb)
    ) order by z.orden,z.codigo,z.id
  ),'[]'::jsonb)
  into v_zonas
  from public.tpv_zonas z
  where z.empresa_id=p_empresa_id and z.local_id=p_local_id and z.activo;

  return jsonb_build_object('ok',true,'terminal_id',p_terminal_id,'session_id',p_session_id,'operating_day',p_operating_day,'zonas',v_zonas);
end $$;


create or replace function public.abc_recuperar_cuenta(
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_cuenta public.cuentas_comerciales%rowtype;
  v_pedidos jsonb;
  v_cobro jsonb;
  v_last_activity timestamptz;
  v_revision text;
  v_requires_day boolean;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR') then
    raise exception 'cuenta_recuperar_no_autorizada';
  end if;
  if p_cuenta_id is null or p_terminal_id is null
     or p_session_id is null or p_operating_day is null then
    raise exception 'cuenta_recuperar_parametros_requeridos';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  select *
    into v_cuenta
    from public.cuentas_comerciales
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_cuenta_id;

  if not found then raise exception 'cuenta_no_encontrada'; end if;

  v_last_activity:=private.abc_ultima_actividad_cuenta(
    p_empresa_id,p_local_id,p_cuenta_id
  );
  v_revision:=private.abc_revision_cuenta(
    p_empresa_id,p_local_id,p_cuenta_id
  );
  v_requires_day:=
    v_cuenta.estado='ABIERTA'
    and v_cuenta.opened_operating_day<>p_operating_day;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',p.id,
        'estado',p.estado,
        'version',p.version,
        'currency_code',p.currency_code,
        'created_by',p.created_by,
        'created_at',p.created_at,
        'created_operating_day',p.created_operating_day,
        'closed_at',p.closed_at,
        'lineas',coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id',l.id,
              'producto_id',l.producto_id,
              'cantidad',l.cantidad,
              'unidad',l.unidad,
              'estado',l.estado,
              'version',l.version,
              'entidad_fiscal_id',l.entidad_fiscal_id,
              'currency_code',l.currency_code,
              'precio_unitario',l.precio_unitario,
              'descuento_total',l.descuento_total,
              'base',l.base,
              'impuestos',l.impuestos,
              'total',l.total,
              'snapshot_comercial',l.snapshot_comercial,
              'snapshot_calculo',l.snapshot_calculo,
              'created_by',l.created_by,
              'created_at',l.created_at,
              'created_operating_day',l.created_operating_day,
              'opciones',coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'id',o.id,
                    'grupo_id',o.grupo_id,
                    'opcion_id',o.opcion_id,
                    'tipo_grupo',o.tipo_grupo,
                    'tipo_opcion',o.tipo_opcion,
                    'nombre_grupo',o.nombre_grupo,
                    'nombre_opcion',o.nombre_opcion,
                    'cantidad',o.cantidad,
                    'delta_precio_unitario',o.delta_precio_unitario,
                    'impuesto_pct',o.impuesto_pct,
                    'base',o.base,
                    'impuestos',o.impuestos,
                    'total',o.total,
                    'catalog_group_version',o.catalog_group_version,
                    'catalog_product_group_version',o.catalog_product_group_version,
                    'catalog_option_version',o.catalog_option_version,
                    'snapshot',o.snapshot,
                    'created_by',o.created_by,
                    'created_at',o.created_at,
                    'created_operating_day',o.created_operating_day
                  )
                  order by o.created_at,o.id
                )
                from public.pedido_linea_opciones o
                where o.empresa_id=l.empresa_id
                  and o.local_id=l.local_id
                  and o.linea_id=l.id
              ),'[]'::jsonb),
              'transiciones',coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'id',t.id,
                    'operation_id',t.operation_id,
                    'estado_anterior',t.estado_anterior,
                    'estado_nuevo',t.estado_nuevo,
                    'motivo',t.motivo,
                    'actor_user_id',t.actor_user_id,
                    'terminal_id',t.terminal_id,
                    'session_id',t.session_id,
                    'occurred_at',t.occurred_at,
                    'operating_day',t.operating_day,
                    'metadata',t.metadata
                  )
                  order by t.occurred_at,t.id
                )
                from public.pedido_linea_transiciones t
                where t.empresa_id=l.empresa_id
                  and t.local_id=l.local_id
                  and t.linea_id=l.id
              ),'[]'::jsonb)
            )
            order by l.created_at,l.id
          )
          from public.pedido_lineas l
          where l.empresa_id=p.empresa_id
            and l.local_id=p.local_id
            and l.pedido_id=p.id
        ),'[]'::jsonb),
        'transiciones',coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id',t.id,
              'operation_id',t.operation_id,
              'estado_anterior',t.estado_anterior,
              'estado_nuevo',t.estado_nuevo,
              'motivo',t.motivo,
              'actor_user_id',t.actor_user_id,
              'terminal_id',t.terminal_id,
              'session_id',t.session_id,
              'occurred_at',t.occurred_at,
              'operating_day',t.operating_day,
              'metadata',t.metadata
            )
            order by t.occurred_at,t.id
          )
          from public.pedido_transiciones t
          where t.empresa_id=p.empresa_id
            and t.local_id=p.local_id
            and t.pedido_id=p.id
        ),'[]'::jsonb)
      )
      order by p.created_at,p.id
    ),
    '[]'::jsonb
  )
  into v_pedidos
  from public.pedidos_tpv p
  where p.empresa_id=p_empresa_id
    and p.local_id=p_local_id
    and p.cuenta_id=p_cuenta_id;

  v_cobro:=public.abc_estado_cobro_cuenta(
    p_empresa_id,p_local_id,p_cuenta_id
  );

  return jsonb_build_object(
    'ok',true,
    'recuperado_at',now(),
    'terminal_id',p_terminal_id,
    'session_id',p_session_id,
    'requested_operating_day',p_operating_day,
    'revision',v_revision,
    'reanudable',
      v_cuenta.estado='ABIERTA' and not v_requires_day,
    'requires_operating_day_resolution',v_requires_day,
    'cuenta',jsonb_build_object(
      'id',v_cuenta.id,
      'empresa_id',v_cuenta.empresa_id,
      'local_id',v_cuenta.local_id,
      'currency_code',v_cuenta.currency_code,
      'modalidad',v_cuenta.modalidad,
      'estado',v_cuenta.estado,
      'version',v_cuenta.version,
      'responsable_actual',v_cuenta.responsable_actual,
      'created_by',v_cuenta.created_by,
      'opened_at',v_cuenta.opened_at,
      'opened_operating_day',v_cuenta.opened_operating_day,
      'closed_at',v_cuenta.closed_at,
      'created_at',v_cuenta.created_at,
      'last_activity_at',v_last_activity
    ),
    'ubicacion',private.abc_ubicacion_cuenta(p_empresa_id,p_local_id,p_cuenta_id),
    'pedidos',v_pedidos,
    'estado_cobro',v_cobro
  );
end $$;


create or replace function public.abc_listar_cuentas_recuperables(
  p_empresa_id text,
  p_local_id text,
  p_terminal_id uuid,
  p_session_id uuid,
  p_operating_day date,
  p_abandono_minutos integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR') then
    raise exception 'cuentas_recuperables_no_autorizadas';
  end if;
  if p_terminal_id is null or p_session_id is null or p_operating_day is null then
    raise exception 'cuentas_recuperables_parametros_requeridos';
  end if;
  if p_abandono_minutos is null or p_abandono_minutos<0 or p_abandono_minutos>10080 then
    raise exception 'abandono_minutos_invalido';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then
    raise exception 'terminal_sesion_no_operativa';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'cuenta_id',x.id,
        'estado',x.estado,
        'version',x.version,
        'currency_code',x.currency_code,
        'modalidad',x.modalidad,
        'responsable_actual',x.responsable_actual,
        'opened_at',x.opened_at,
        'opened_operating_day',x.opened_operating_day,
        'last_activity_at',x.last_activity_at,
        'pedidos_count',x.pedidos_count,
        'lineas_activas_count',x.lineas_activas_count,
        'revision',x.revision,
        'ubicacion',private.abc_ubicacion_cuenta(p_empresa_id,p_local_id,x.id),
        'reanudable_mismo_dia',x.opened_operating_day=p_operating_day,
        'requires_operating_day_resolution',x.opened_operating_day<>p_operating_day,
        'posible_abandono',
          x.last_activity_at <= now()-make_interval(mins=>p_abandono_minutos)
      )
      order by x.last_activity_at desc,x.id
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      c.id,
      c.estado,
      c.version,
      c.currency_code,
      c.modalidad,
      c.responsable_actual,
      c.opened_at,
      c.opened_operating_day,
      private.abc_ultima_actividad_cuenta(
        c.empresa_id,c.local_id,c.id
      ) last_activity_at,
      private.abc_revision_cuenta(
        c.empresa_id,c.local_id,c.id
      ) revision,
      (
        select count(*)
        from public.pedidos_tpv p
        where p.empresa_id=c.empresa_id
          and p.local_id=c.local_id
          and p.cuenta_id=c.id
          and p.estado not in ('CERRADO','CANCELADO')
      ) pedidos_count,
      (
        select count(*)
        from public.pedido_lineas l
        join public.pedidos_tpv p
          on p.empresa_id=l.empresa_id
         and p.local_id=l.local_id
         and p.id=l.pedido_id
        where p.empresa_id=c.empresa_id
          and p.local_id=c.local_id
          and p.cuenta_id=c.id
          and l.estado<>'CANCELADA'
      ) lineas_activas_count
    from public.cuentas_comerciales c
    where c.empresa_id=p_empresa_id
      and c.local_id=p_local_id
      and c.estado='ABIERTA'
  ) x;

  return jsonb_build_object(
    'ok',true,
    'terminal_id',p_terminal_id,
    'session_id',p_session_id,
    'operating_day',p_operating_day,
    'abandono_minutos',p_abandono_minutos,
    'cuentas',v_result
  );
end $$;



revoke all on function private.abc_estado_mesa_efectivo(text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function private.abc_ubicacion_cuenta(text,text,uuid) from public,anon,authenticated,service_role;

revoke all on function public.abc_crear_zona(text,text,text,uuid,text,text,text,integer,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_actualizar_zona(text,text,text,uuid,text,text,text,integer,boolean,bigint,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_crear_mesa(text,text,text,uuid,uuid,text,text,integer,integer,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_actualizar_mesa(text,text,text,uuid,uuid,text,text,integer,integer,boolean,text,bigint,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_cambiar_estado_mesa(text,text,text,uuid,text,timestamptz,text,text,bigint,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_asignar_cuenta_mesa(text,text,text,uuid,uuid,integer,bigint,bigint,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_mover_cuenta_mesa(text,text,text,uuid,uuid,integer,text,bigint,bigint,bigint,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_liberar_cuenta_mesa(text,text,text,uuid,text,bigint,bigint,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_listar_mapa_sala(text,text,uuid,uuid,date) from public,anon,authenticated,service_role;

grant execute on function public.abc_crear_zona(text,text,text,uuid,text,text,text,integer,uuid,uuid,date) to authenticated;
grant execute on function public.abc_actualizar_zona(text,text,text,uuid,text,text,text,integer,boolean,bigint,uuid,uuid,date) to authenticated;
grant execute on function public.abc_crear_mesa(text,text,text,uuid,uuid,text,text,integer,integer,uuid,uuid,date) to authenticated;
grant execute on function public.abc_actualizar_mesa(text,text,text,uuid,uuid,text,text,integer,integer,boolean,text,bigint,uuid,uuid,date) to authenticated;
grant execute on function public.abc_cambiar_estado_mesa(text,text,text,uuid,text,timestamptz,text,text,bigint,uuid,uuid,date) to authenticated;
grant execute on function public.abc_asignar_cuenta_mesa(text,text,text,uuid,uuid,integer,bigint,bigint,uuid,uuid,date) to authenticated;
grant execute on function public.abc_mover_cuenta_mesa(text,text,text,uuid,uuid,integer,text,bigint,bigint,bigint,uuid,uuid,date) to authenticated;
grant execute on function public.abc_liberar_cuenta_mesa(text,text,text,uuid,text,bigint,bigint,uuid,uuid,date) to authenticated;
grant execute on function public.abc_listar_mapa_sala(text,text,uuid,uuid,date) to authenticated;

-- Mantener ACL explícita de las RPC A06 reemplazadas.
revoke all on function public.abc_recuperar_cuenta(text,text,uuid,uuid,uuid,date) from public,anon,authenticated,service_role;
revoke all on function public.abc_listar_cuentas_recuperables(text,text,uuid,uuid,date,integer) from public,anon,authenticated,service_role;
grant execute on function public.abc_recuperar_cuenta(text,text,uuid,uuid,uuid,date) to authenticated;
grant execute on function public.abc_listar_cuentas_recuperables(text,text,uuid,uuid,date,integer) to authenticated;
