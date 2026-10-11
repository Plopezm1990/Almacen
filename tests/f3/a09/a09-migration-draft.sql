-- ABC F3/A09: descuentos y cortesias en cuentas con reparto de un solo IVA.
-- Aditiva; no habilita descuentos tras fiscalizacion,
-- ni repartos A08 con tipos mixtos. Ningun cobro es iniciado por esta RPC.

do $$
begin
  if to_regclass('public.cuenta_linea_repartos') is null
     or to_regclass('public.pedido_lineas') is null
     or to_regclass('public.pedido_linea_opciones') is null
     or to_regclass('public.membresias_usuario') is null
     or to_regprocedure('private.abc_materializar_reparto_linea(text,text,uuid)') is null
     or to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null
     or to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null
     or to_regprocedure('private.abc_terminal_sesion_operativa(text,text,uuid,uuid)') is null
     or to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'ABC_F3_A09_PREFLIGHT_FALLO: dependencias ausentes';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='membresias_usuario'
      and column_name='updated_at' and data_type='timestamp with time zone'
  ) then
    raise exception 'ABC_F3_A09_PREFLIGHT_FALLO: membresias_usuario.updated_at ausente';
  end if;
  if to_regclass('public.abc_descuento_politicas') is not null
     or to_regclass('public.abc_descuentos_aplicados') is not null
     or to_regclass('public.abc_descuento_autorizaciones') is not null
     or to_regclass('public.abc_descuento_aprobacion_intentos') is not null
     or to_regprocedure('public.abc_aplicar_descuento_cuenta(text,text,text,uuid,text,numeric,text,bigint,uuid,uuid,date)') is not null
     or to_regprocedure('public.abc_aprobar_descuento_cuenta(text,text,text,text,uuid,text,text)') is not null
     or to_regprocedure('public.abc_listar_descuento_politicas(text,text)') is not null
     or to_regprocedure('public.abc_configurar_descuento_politica(text,text,text,text,uuid,numeric,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text,date)') is not null
     or to_regprocedure('private.abc_a09_lock_config_context(text,text)') is not null
     or to_regprocedure('private.abc_a09_lock_config_context_write(text,text)') is not null
     or to_regprocedure('private.abc_a09_snapshot_solicitud(jsonb,uuid[],jsonb)') is not null
     or to_regprocedure('private.abc_a09_solicitud_dentro_limite(jsonb,jsonb)') is not null
     or to_regprocedure('private.abc_a09_politica_puede_autorizar(jsonb,jsonb)') is not null
     or to_regprocedure('private.abc_a09_jcs(jsonb)') is not null
     or to_regprocedure('private.abc_a09_snapshot_hash(jsonb)') is not null
     or to_regprocedure('private.abc_a09_validar_importe_snapshot(text,text)') is not null then
    raise exception 'ABC_F3_A09_PREFLIGHT_FALLO: A09 ya existe';
  end if;
end $$;

create table public.abc_descuento_politicas (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null references public.empresas(id) on delete restrict,
  local_id text,
  rol text,
  user_id uuid references auth.users(id) on delete restrict,
  max_percent numeric(9,4) not null,
  permite_cortesia boolean not null default false,
  puede_solicitar boolean not null default false,
  puede_aplicar boolean not null default false,
  puede_autorizar boolean not null default false,
  permite_escalado boolean not null default false,
  requiere_doble_aprobacion boolean not null default false,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint a09_politica_local_fk foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint a09_politica_sujeto check (
    (user_id is not null and rol is null)
    or (user_id is null and nullif(btrim(rol),'') is not null)
  ),
  constraint a09_politica_max check (max_percent>=0 and max_percent<=100),
  constraint a09_politica_cortesia check (not permite_cortesia or max_percent=100),
  constraint a09_politica_escalado check (not permite_escalado or puede_solicitar),
  constraint a09_politica_aplicar check (not puede_aplicar or max_percent>0),
  constraint a09_politica_autorizar check (not puede_autorizar or max_percent>0),
  constraint a09_politica_aprobacion check (not requiere_doble_aprobacion or puede_solicitar)
);
create unique index a09_politica_usuario_uq
  on public.abc_descuento_politicas(empresa_id,coalesce(local_id,''),user_id)
  where user_id is not null;
create unique index a09_politica_rol_uq
  on public.abc_descuento_politicas(empresa_id,coalesce(local_id,''),rol)
  where rol is not null;

create table public.abc_descuento_autorizaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  operation_id text not null unique,
  cuenta_id uuid not null references public.cuentas_comerciales(id) on delete restrict,
  solicitante_id uuid not null references auth.users(id) on delete restrict,
  motivo text not null check (char_length(btrim(motivo)) between 1 and 500),
  snapshot jsonb not null,
  snapshot_hash text not null check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  politica_solicitante jsonb not null,
  estado text not null default 'PENDIENTE'
    check (estado in ('PENDIENTE','APROBADA','RECHAZADA','INVALIDADA','APLICADA')),
  autorizador_id uuid references auth.users(id) on delete restrict,
  politica_autorizador jsonb,
  motivo_autorizacion text,
  solicitada_at timestamptz not null default now(),
  autorizada_at timestamptz,
  aplicada_at timestamptz,
  resultado jsonb,
  constraint a09_autorizacion_operacion_fk foreign key (empresa_id,local_id,operation_id)
    references public.abc_operaciones(empresa_id,local_id,operation_id) on delete restrict,
  constraint a09_autorizacion_local_fk foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint a09_autorizacion_estado_consistente check (
    (estado='PENDIENTE' and autorizador_id is null and autorizada_at is null and aplicada_at is null)
    or (estado='APROBADA' and autorizador_id is not null and autorizada_at is not null and aplicada_at is null)
    or (estado='APLICADA' and autorizador_id is not null and autorizada_at is not null and aplicada_at is not null)
    or (estado in ('RECHAZADA','INVALIDADA') and aplicada_at is null)
  )
);
create index a09_autorizaciones_contexto_estado_idx
  on public.abc_descuento_autorizaciones(empresa_id,local_id,estado,solicitada_at,id);

create table public.abc_descuento_aprobacion_intentos (
  empresa_id text not null,
  local_id text not null,
  operation_id text not null,
  attempt_id uuid not null,
  solicitante_id uuid not null references auth.users(id) on delete restrict,
  autorizador_id uuid not null references auth.users(id) on delete restrict,
  snapshot_hash text not null check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  decision text not null check (decision in ('APROBAR','RECHAZAR')),
  motivo text not null check (char_length(btrim(motivo)) between 1 and 500),
  attempt_hash text not null check (attempt_hash ~ '^[0-9a-f]{64}$'),
  resultado jsonb not null,
  occurred_at timestamptz not null default now(),
  primary key (operation_id,attempt_id),
  constraint a09_aprobacion_intento_fk foreign key (operation_id)
    references public.abc_descuento_autorizaciones(operation_id) on delete restrict,
  constraint a09_aprobacion_intento_local_fk foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict
);
create index a09_aprobacion_intentos_contexto_idx
  on public.abc_descuento_aprobacion_intentos(empresa_id,local_id,operation_id,occurred_at);

create table public.abc_descuentos_aplicados (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  operation_id text not null,
  cuenta_id uuid not null references public.cuentas_comerciales(id) on delete restrict,
  reparto_id uuid not null references public.cuenta_linea_repartos(id) on delete restrict,
  source_line_id uuid not null references public.pedido_lineas(id) on delete restrict,
  tipo text not null check (tipo in ('PERCENT','AMOUNT','COURTESY')),
  importe numeric(24,8) not null check (importe>=0),
  base_antes numeric(24,8) not null check (base_antes>=0),
  base_despues numeric(24,8) not null check (base_despues>=0),
  iva_antes numeric(24,8) not null check (iva_antes>=0),
  iva_despues numeric(24,8) not null check (iva_despues>=0),
  motivo text not null check (char_length(btrim(motivo)) between 1 and 500),
  solicitante_id uuid not null references auth.users(id) on delete restrict,
  autorizador_id uuid not null references auth.users(id) on delete restrict,
  autorizacion_id uuid references public.abc_descuento_autorizaciones(id) on delete restrict,
  terminal_id uuid not null references public.terminales_tpv(id) on delete restrict,
  session_id uuid not null references public.caja_sesiones(id) on delete restrict,
  operating_day date not null,
  created_at timestamptz not null default now(),
  constraint a09_descuento_operacion_fk foreign key (empresa_id,local_id,operation_id)
    references public.abc_operaciones(empresa_id,local_id,operation_id) on delete restrict,
  constraint a09_descuento_local_fk foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint a09_descuento_operacion_reparto_uq unique (operation_id,reparto_id)
);
create index a09_descuentos_linea_idx
  on public.abc_descuentos_aplicados(empresa_id,local_id,source_line_id,created_at,id);
create index a09_descuentos_cuenta_idx
  on public.abc_descuentos_aplicados(empresa_id,local_id,cuenta_id,created_at,id);

alter table public.abc_descuento_politicas enable row level security;
alter table public.abc_descuento_autorizaciones enable row level security;
alter table public.abc_descuento_aprobacion_intentos enable row level security;
alter table public.abc_descuentos_aplicados enable row level security;
create policy a09_autorizaciones_select on public.abc_descuento_autorizaciones
  for select to authenticated
  using (private.la_tiene_local(empresa_id,local_id));
create policy a09_aprobacion_intentos_select on public.abc_descuento_aprobacion_intentos
  for select to authenticated
  using (private.la_tiene_local(empresa_id,local_id));
create policy a09_descuentos_select on public.abc_descuentos_aplicados
  for select to authenticated
  using (private.la_tiene_local(empresa_id,local_id));
revoke all on table public.abc_descuento_politicas
  from public,anon,authenticated,service_role;
revoke all on table public.abc_descuento_autorizaciones
  from public,anon,authenticated,service_role;
revoke all on table public.abc_descuento_aprobacion_intentos
  from public,anon,authenticated,service_role;
revoke all on table public.abc_descuentos_aplicados
  from public,anon,authenticated,service_role;
grant select on table public.abc_descuentos_aplicados to authenticated;
grant select on table public.abc_descuento_autorizaciones to authenticated;
grant select on table public.abc_descuento_aprobacion_intentos to authenticated;

create function private.abc_a09_lock_config_context(p_empresa_id text,p_local_id text)
returns void language plpgsql volatile security definer set search_path=''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended(
    'abc_a09_discount_config:'||p_empresa_id,0));
end $$;

create function private.abc_a09_lock_config_context_write(
  p_empresa_id text,p_local_id text
) returns void language plpgsql volatile security definer set search_path=''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'abc_a09_discount_config:'||p_empresa_id,0));
end $$;

create function private.abc_a09_config_lock_trigger()
returns trigger language plpgsql volatile security definer set search_path=''
as $$
declare
  v_keys text[]:=array[]::text[];
  v_key text;
  v_old_company text;
  v_new_company text;
  v_old_local text;
  v_new_local text;
  v_old_user uuid;
  v_new_user uuid;
  v_old_global boolean:=false;
  v_new_global boolean:=false;
  v_failure jsonb:=jsonb_build_object('ok',false,'status','INVALIDADA',
    'error','descuento_autorizacion_configuracion_cambiada');
begin
  if tg_op<>'INSERT' then
    if tg_table_name='abc_descuento_politicas' then
      v_old_company:=old.empresa_id;
      v_old_local:=old.local_id;
      v_old_global:=old.local_id is null;
    else
      v_old_company:=old.empresa_id;
      v_old_user:=old.user_id;
    end if;
    v_keys:=array_append(v_keys,'abc_a09_discount_config:'||v_old_company);
  end if;
  if tg_op<>'DELETE' then
    if tg_table_name='abc_descuento_politicas' then
      v_new_company:=new.empresa_id;
      v_new_local:=new.local_id;
      v_new_global:=new.local_id is null;
    else
      v_new_company:=new.empresa_id;
      v_new_user:=new.user_id;
    end if;
    v_keys:=array_append(v_keys,'abc_a09_discount_config:'||v_new_company);
  end if;
  for v_key in select distinct k from unnest(v_keys) as x(k) order by k loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key,0));
  end loop;

  if tg_table_name='abc_descuento_politicas' then
    with invalidated as (
      update public.abc_descuento_autorizaciones a
      set estado='INVALIDADA',resultado=v_failure
      where a.empresa_id=any(array_remove(array[v_old_company,v_new_company],null))
        and a.estado in ('PENDIENTE','APROBADA')
        and (v_old_global or v_new_global or a.local_id=any(
          array_remove(array[v_old_local,v_new_local],null)))
      returning a.empresa_id,a.local_id,a.operation_id
    )
    update public.abc_operaciones o
    set status='FALLIDA',resultado=null,error=v_failure,completed_at=now()
    from invalidated i
    where o.empresa_id=i.empresa_id and o.local_id=i.local_id
      and o.operation_id=i.operation_id and o.status='PROCESANDO';
  else
    with invalidated as (
      update public.abc_descuento_autorizaciones a
      set estado='INVALIDADA',resultado=v_failure
      where a.empresa_id=any(array_remove(array[v_old_company,v_new_company],null))
        and a.estado in ('PENDIENTE','APROBADA')
        and (a.solicitante_id=any(array_remove(array[v_old_user,v_new_user],null))
          or a.autorizador_id=any(array_remove(array[v_old_user,v_new_user],null)))
      returning a.empresa_id,a.local_id,a.operation_id
    )
    update public.abc_operaciones o
    set status='FALLIDA',resultado=null,error=v_failure,completed_at=now()
    from invalidated i
    where o.empresa_id=i.empresa_id and o.local_id=i.local_id
      and o.operation_id=i.operation_id and o.status='PROCESANDO';
  end if;

  if tg_op='UPDATE' then
    new.updated_at:=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond');
    return new;
  elsif tg_op='DELETE' then return old;
  else return new;
  end if;
end $$;

create trigger a09_lock_politica_config
  before insert or update or delete on public.abc_descuento_politicas
  for each row execute function private.abc_a09_config_lock_trigger();
create trigger a09_lock_membresia_config
  before insert or update or delete on public.membresias_usuario
  for each row execute function private.abc_a09_config_lock_trigger();

create function private.abc_descuento_politica_usuario(
  p_user_id uuid,p_empresa_id text,p_local_id text
) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_m public.membresias_usuario%rowtype;
  v_p public.abc_descuento_politicas%rowtype;
  v_max numeric(9,4):=0;
  v_cortesia boolean:=false;
  v_request boolean:=false;
  v_apply boolean:=false;
  v_authorize boolean:=false;
  v_escalation boolean:=false;
  v_requiere boolean:=false;
begin
  if p_user_id is null or p_empresa_id is null or p_local_id is null then
    return jsonb_build_object('user_id',coalesce(p_user_id::text,''),
      'membership_id','','membership_scope','','membership_role','',
      'membership_active','false','membership_version','',
      'policy_id','','policy_scope','','policy_version','',
      'max_percent','0.0000','permite_cortesia','false',
      'puede_solicitar','false','puede_aplicar','false',
      'puede_autorizar','false','permite_escalado','false',
      'requiere_doble_aprobacion','false');
  end if;
  select m.* into v_m
  from public.membresias_usuario m
  where m.user_id=p_user_id and m.empresa_id=p_empresa_id and m.activo=true
    and ((m.todos_locales=false and m.local_id=p_local_id)
      or (m.todos_locales=true and m.local_id is null))
  order by case when m.local_id=p_local_id then 0 else 1 end,m.id desc
  limit 1;
  if not found then
    return jsonb_build_object('user_id',p_user_id::text,
      'membership_id','','membership_scope','','membership_role','',
      'membership_active','false','membership_version','',
      'policy_id','','policy_scope','','policy_version','',
      'max_percent','0.0000','permite_cortesia','false',
      'puede_solicitar','false','puede_aplicar','false',
      'puede_autorizar','false','permite_escalado','false',
      'requiere_doble_aprobacion','false');
  end if;
  if v_m.rol='Propietario' then
    v_max:=100; v_cortesia:=true; v_request:=true; v_apply:=true; v_authorize:=true;
  elsif v_m.rol='Encargado' then
    v_max:=20; v_request:=true; v_apply:=true; v_authorize:=true;
  end if;
  select p.* into v_p
  from public.abc_descuento_politicas p
  where p.empresa_id=p_empresa_id and p.activa=true
    and (p.local_id=p_local_id or p.local_id is null)
    and (p.user_id=p_user_id or p.rol=v_m.rol)
  order by case
    when p.user_id=p_user_id and p.local_id=p_local_id then 0
    when p.user_id=p_user_id then 1
    when p.rol=v_m.rol and p.local_id=p_local_id then 2
    else 3 end
  limit 1;
  if found then
    v_max:=v_p.max_percent;
    v_cortesia:=v_p.permite_cortesia;
    v_request:=v_p.puede_solicitar;
    v_apply:=v_p.puede_aplicar;
    v_authorize:=v_p.puede_autorizar;
    v_escalation:=v_p.permite_escalado;
    v_requiere:=v_p.requiere_doble_aprobacion;
  end if;
  return jsonb_build_object(
    'user_id',p_user_id::text,'membership_id',v_m.id::text,
    'membership_scope',case when v_m.todos_locales then '*' else v_m.local_id end,
    'membership_role',v_m.rol,'membership_active',v_m.activo::text,
    'membership_version',coalesce(extract(epoch from v_m.updated_at)::numeric(20,6)::text,''),
    'policy_id',coalesce(v_p.id::text,''),
    'policy_scope',case when v_p.id is null then '' else coalesce(v_p.local_id,'*') end,
    'policy_version',case when v_p.id is null then ''
      else extract(epoch from v_p.updated_at)::numeric(20,6)::text end,
    'max_percent',v_max::text,'permite_cortesia',v_cortesia::text,
    'puede_solicitar',v_request::text,'puede_aplicar',v_apply::text,
    'puede_autorizar',v_authorize::text,'permite_escalado',v_escalation::text,
    'requiere_doble_aprobacion',v_requiere::text
  );
end $$;

create or replace function private.abc_descuento_politica(
  p_empresa_id text,p_local_id text
) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
begin
  if auth.uid() is null or not private.la_tiene_local(p_empresa_id,p_local_id) then
    return private.abc_descuento_politica_usuario(null,p_empresa_id,p_local_id);
  end if;
  return private.abc_descuento_politica_usuario(auth.uid(),p_empresa_id,p_local_id);
end $$;

create function public.abc_listar_descuento_politicas(
  p_empresa_id text,p_local_id text
) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.membresias_usuario m
    where m.user_id=auth.uid() and m.empresa_id=p_empresa_id
      and m.activo=true and m.rol='Propietario'
      and ((m.todos_locales=true and m.local_id is null)
        or (m.todos_locales=false and m.local_id=p_local_id))
  ) then raise exception 'descuento_politica_no_autorizada'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',p.id::text,'empresa_id',p.empresa_id,'local_id',p.local_id,
      'rol',p.rol,'user_id',p.user_id::text,'max_percent',p.max_percent::text,
      'permite_cortesia',p.permite_cortesia,'puede_solicitar',p.puede_solicitar,
      'puede_aplicar',p.puede_aplicar,'puede_autorizar',p.puede_autorizar,
      'permite_escalado',p.permite_escalado,
      'requiere_doble_aprobacion',p.requiere_doble_aprobacion,
      'activa',p.activa,'updated_at',p.updated_at
    ) order by p.rol nulls last,p.user_id nulls last,p.id),'[]'::jsonb)
    into v_result
  from public.abc_descuento_politicas p
  where p.empresa_id=p_empresa_id and p.local_id=p_local_id;
  return v_result;
end $$;

create function public.abc_configurar_descuento_politica(
  p_operation_id text,p_empresa_id text,p_local_id text,p_rol text,p_user_id uuid,
  p_max_percent numeric,p_permite_cortesia boolean,p_puede_solicitar boolean,
  p_puede_aplicar boolean,p_puede_autorizar boolean,p_permite_escalado boolean,
  p_requiere_doble_aprobacion boolean,p_activa boolean,p_motivo text,
  p_operating_day date
) returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
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
end $$;

revoke all on function public.abc_listar_descuento_politicas(text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.abc_listar_descuento_politicas(text,text)
  to authenticated;
revoke all on function public.abc_configurar_descuento_politica(
  text,text,text,text,uuid,numeric,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text,date
) from public,anon,authenticated,service_role;
grant execute on function public.abc_configurar_descuento_politica(
  text,text,text,text,uuid,numeric,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text,date
) to authenticated;

create function private.abc_a09_solicitud_dentro_limite(
  p_snapshot jsonb,p_policy jsonb
) returns boolean language sql immutable security definer set search_path=''
as $$
  select coalesce((p_policy->>'max_percent')::numeric,0)>0
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_snapshot->'lines','[]'::jsonb)) l
      cross join lateral (
        select coalesce(sum((s->>'descuento_solicitado')::numeric),0) delta
        from jsonb_array_elements(coalesce(p_snapshot->'shares','[]'::jsonb)) s
        where s->>'source_line_id'=l->>'line_id'
      ) d
      where ((l->>'descuento')::numeric+d.delta)*100
        > (l->>'base_original')::numeric*(p_policy->>'max_percent')::numeric
    )
$$;

create function private.abc_a09_snapshot_solicitud(
  p_request jsonb,p_source_ids uuid[],p_politica_solicitante jsonb
) returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  v_account_id uuid:=(p_request->>'cuenta_id')::uuid;
  v_kind text:=p_request->>'tipo';
  v_value numeric:=nullif(p_request->>'valor','')::numeric;
  v_base numeric(24,8);
  v_amount numeric(24,8);
  v_lines jsonb;
  v_shares jsonb;
  v_accounts jsonb;
  v_source_ids jsonb;
begin
  select coalesce(sum(r.base),0)::numeric(24,8) into v_base
  from public.cuenta_linea_repartos r
  where r.empresa_id=p_request->>'empresa_id' and r.local_id=p_request->>'local_id'
    and r.cuenta_id=v_account_id and r.estado='ACTIVO'
    and r.source_line_id=any(p_source_ids);
  v_amount:=case v_kind when 'COURTESY' then v_base
    when 'PERCENT' then round(v_base*v_value/100,8) else v_value end;

  with base as (
    select r.*,l.version line_version,l.estado line_state,
      l.descuento_total line_discount,l.base line_base,l.impuestos line_tax,l.total line_total,
      l.base+l.descuento_total line_gross
    from public.cuenta_linea_repartos r
    join public.pedido_lineas l on l.empresa_id=r.empresa_id and l.local_id=r.local_id
      and l.id=r.source_line_id
    where r.empresa_id=p_request->>'empresa_id' and r.local_id=p_request->>'local_id'
      and r.estado='ACTIVO' and r.source_line_id=any(p_source_ids)
  ), raw as (
    select b.id,floor(v_amount*b.base/v_base*100000000) units,
      v_amount*b.base/v_base*100000000-floor(v_amount*b.base/v_base*100000000) fraction
    from base b where b.cuenta_id=v_account_id
  ), ranked as (
    select raw.*,row_number() over(order by fraction desc,id) rank,
      sum(units) over() floor_total
    from raw
  ), allocations as (
    select id,(units+case when rank<=round(v_amount*100000000)-floor_total
      then 1 else 0 end)/100000000::numeric amount
    from ranked
  )
  select jsonb_agg(jsonb_build_object(
      'reparto_id',b.id::text,'source_line_id',b.source_line_id::text,
      'cuenta_id',b.cuenta_id::text,'reparto_version',b.version::text,
      'line_version',b.line_version::text,'estado_linea',b.line_state,
      'cantidad',b.cantidad::text,'descuento_antes',b.descuento::text,
      'base_antes',b.base::text,'iva_antes',b.impuestos::text,'total_antes',b.total::text,
      'descuento_linea_antes',b.line_discount::text,'base_linea_antes',b.line_base::text,
      'iva_linea_antes',b.line_tax::text,'total_linea_antes',b.line_total::text,
      'base_original_linea',b.line_gross::text,
      'descuento_solicitado',coalesce(a.amount,0)::numeric(24,8)::text
    ) order by b.source_line_id,b.id) into v_shares
  from base b left join allocations a on a.id=b.id;

  select jsonb_agg(jsonb_build_object(
      'line_id',l.id::text,'version',l.version::text,'estado',l.estado,
      'descuento',l.descuento_total::text,'base',l.base::text,
      'iva',l.impuestos::text,'total',l.total::text,
      'base_original',(l.base+l.descuento_total)::text
    ) order by l.id) into v_lines
  from public.pedido_lineas l
  where l.empresa_id=p_request->>'empresa_id' and l.local_id=p_request->>'local_id'
    and l.id=any(p_source_ids);

  select jsonb_agg(jsonb_build_object(
      'cuenta_id',c.id::text,'version',c.version::text,'estado',c.estado
    ) order by c.id) into v_accounts
  from public.cuentas_comerciales c
  where c.empresa_id=p_request->>'empresa_id' and c.local_id=p_request->>'local_id'
    and c.id in (select distinct (x->>'cuenta_id')::uuid
      from jsonb_array_elements(coalesce(v_shares,'[]'::jsonb)) x);
  select jsonb_agg(x::text order by x) into v_source_ids
  from unnest(p_source_ids) x;

  return jsonb_build_object(
    'schema_version','1','canonicalization','RFC8785_JCS','hash_algorithm','SHA-256',
    'operation',jsonb_build_object(
      'operation_id',p_request->>'operation_id','empresa_id',p_request->>'empresa_id',
      'local_id',p_request->>'local_id','cuenta_id',v_account_id::text,
      'tipo',v_kind,'valor',coalesce(v_value::numeric(24,8)::text,''),
      'motivo',p_request->>'motivo','solicitante_id',p_request->>'actor_user_id',
      'expected_cuenta_version',p_request->>'expected_cuenta_version',
      'terminal_id',p_request->>'terminal_id','session_id',p_request->>'session_id',
      'operating_day',p_request->>'operating_day','base_objetivo',v_base::text,
      'importe_descuento',v_amount::text,
      'requiere_escalado',not private.abc_a09_solicitud_dentro_limite(
        jsonb_build_object('lines',coalesce(v_lines,'[]'::jsonb),
          'shares',coalesce(v_shares,'[]'::jsonb)),p_politica_solicitante)
    ),
    'source_line_ids',coalesce(v_source_ids,'[]'::jsonb),
    'accounts',coalesce(v_accounts,'[]'::jsonb),
    'lines',coalesce(v_lines,'[]'::jsonb),
    'shares',coalesce(v_shares,'[]'::jsonb),
    'politica_solicitante',p_politica_solicitante
  );
end $$;

create function private.abc_a09_politica_puede_autorizar(
  p_snapshot jsonb,p_policy jsonb
) returns boolean language sql immutable security definer set search_path=''
as $$
  select coalesce((p_policy->>'puede_autorizar')::boolean,false)
    and coalesce((p_policy->>'max_percent')::numeric,0)>0
    and (p_snapshot#>>'{operation,tipo}'<>'COURTESY'
      or coalesce((p_policy->>'permite_cortesia')::boolean,false))
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_snapshot->'lines','[]'::jsonb)) l
      cross join lateral (
        select coalesce(sum((s->>'descuento_solicitado')::numeric),0) delta
        from jsonb_array_elements(coalesce(p_snapshot->'shares','[]'::jsonb)) s
        where s->>'source_line_id'=l->>'line_id'
      ) d
      where ((l->>'descuento')::numeric+d.delta)*100
        > (l->>'base_original')::numeric*(p_policy->>'max_percent')::numeric
    )
    and not (
      p_snapshot#>>'{operation,tipo}'<>'COURTESY'
      and exists (
        select 1 from jsonb_array_elements(coalesce(p_snapshot->'shares','[]'::jsonb)) s
        where (s->>'descuento_solicitado')::numeric>0
          and (s->>'descuento_solicitado')::numeric=(s->>'base_antes')::numeric
      )
    )
$$;

create function public.abc_aplicar_descuento_cuenta(
  p_operation_id text,p_empresa_id text,p_local_id text,p_cuenta_id uuid,
  p_tipo text,p_valor numeric,p_motivo text,p_expected_cuenta_version bigint,
  p_terminal_id uuid,p_session_id uuid,p_operating_day date
) returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare
  v_policy jsonb;
  v_requester_policy jsonb;
  v_authorizer_policy jsonb;
  v_snapshot jsonb;
  v_snapshot_hash text;
  v_authorization public.abc_descuento_autorizaciones%rowtype;
  v_has_authorization boolean:=false;
  v_requires_dual boolean:=false;
  v_over_requester_limit boolean:=false;
  v_escalated boolean:=false;
  v_authorizer_id uuid;
  v_authorization_id uuid;
  v_max numeric(9,4);
  v_authorizer_max numeric(9,4);
  v_kind text:=upper(btrim(coalesce(p_tipo,'')));
  v_reason text:=btrim(coalesce(p_motivo,''));
  v_request jsonb;
  v_cmd jsonb;
  v_cuenta public.cuentas_comerciales%rowtype;
  v_line public.pedido_lineas%rowtype;
  v_row public.cuenta_linea_repartos%rowtype;
  v_line_id uuid;
  v_rate numeric(9,4);
  v_source_ids uuid[]:=array[]::uuid[];
  v_changed_source_ids uuid[]:=array[]::uuid[];
  v_account_ids uuid[]:=array[]::uuid[];
  v_base numeric(24,8);
  v_amount numeric(24,8);
  v_delta numeric(24,8);
  v_tax numeric(24,8);
  v_new_base numeric(24,8);
  v_new_total numeric(24,8);
  v_agg record;
  v_alloc record;
  v_version bigint;
  v_result jsonb;
begin
  if auth.uid() is null or not private.la_tiene_local(p_empresa_id,p_local_id) then
    raise exception 'descuento_no_autorizado';
  end if;
  perform private.abc_a09_lock_config_context(p_empresa_id,p_local_id);
  v_policy:=private.abc_descuento_politica(p_empresa_id,p_local_id);
  v_requester_policy:=private.abc_descuento_politica_usuario(
    auth.uid(),p_empresa_id,p_local_id
  );
  v_max:=(v_policy->>'max_percent')::numeric;
  if p_cuenta_id is null or p_expected_cuenta_version is null
     or p_terminal_id is null or p_session_id is null or p_operating_day is null
     or char_length(v_reason) not between 1 and 500
     or v_kind not in ('PERCENT','AMOUNT','COURTESY')
     or (v_kind='COURTESY' and p_valor is not null)
     or (v_kind<>'COURTESY' and (p_valor is null or p_valor<=0
       or p_valor<>round(p_valor,8)))
     or (v_kind='PERCENT' and p_valor>100) then
    raise exception 'descuento_parametros_invalidos';
  end if;
  if not coalesce((v_requester_policy->>'puede_solicitar')::boolean,false) then
    raise exception 'descuento_solicitar_no_autorizado';
  end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then raise exception 'terminal_sesion_no_operativa'; end if;

  v_request:=jsonb_build_object(
    'operation_id',p_operation_id,'empresa_id',p_empresa_id,'local_id',p_local_id,
    'cuenta_id',p_cuenta_id,'tipo',v_kind,'valor',p_valor,'motivo',v_reason,
    'expected_cuenta_version',p_expected_cuenta_version,
    'terminal_id',p_terminal_id,'session_id',p_session_id,
    'operating_day',p_operating_day,'actor_user_id',auth.uid()
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_APLICAR_DESCUENTO_CUENTA',
    v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    if v_cmd->>'status'='COMPLETADA' then return v_cmd->'resultado'; end if;
    if v_cmd->>'status'='FALLIDA' then return coalesce(v_cmd->'error',v_cmd); end if;
  end if;
  select * into v_authorization from public.abc_descuento_autorizaciones a
  where a.operation_id=p_operation_id and a.empresa_id=p_empresa_id and a.local_id=p_local_id;
  v_has_authorization:=found;
  v_escalated:=case when v_has_authorization then coalesce(
    (v_authorization.snapshot#>>'{operation,requiere_escalado}')::boolean,false)
    else false end;
  if v_has_authorization and (
    v_requester_policy is distinct from v_authorization.politica_solicitante
    or v_max<=0
    or (v_kind='COURTESY' and not coalesce((v_policy->>'permite_cortesia')::boolean,false))
    or not coalesce((v_requester_policy->>'puede_solicitar')::boolean,false)
    or (v_escalated and not coalesce((v_requester_policy->>'permite_escalado')::boolean,false))
    or (not v_escalated and not coalesce(
      (v_requester_policy->>'requiere_doble_aprobacion')::boolean,false))
  ) then
    v_result:=jsonb_build_object('ok',false,'status','INVALIDADA',
      'operation_id',p_operation_id,'error','descuento_autorizacion_configuracion_cambiada');
    update public.abc_descuento_autorizaciones
      set estado='INVALIDADA',resultado=v_result where id=v_authorization.id;
    perform private.abc_operacion_fallar(p_operation_id,v_result);
    return v_result;
  end if;
  if not v_has_authorization and v_max<=0 then raise exception 'descuento_no_autorizado'; end if;
  if v_kind='COURTESY' and not coalesce((v_policy->>'permite_cortesia')::boolean,false) then
    if v_has_authorization then
      v_result:=jsonb_build_object('ok',false,'status','INVALIDADA',
        'operation_id',p_operation_id,'error','cortesia_no_autorizada');
      update public.abc_descuento_autorizaciones
        set estado='INVALIDADA',resultado=v_result where id=v_authorization.id;
      perform private.abc_operacion_fallar(p_operation_id,v_result);
      return v_result;
    end if;
    raise exception 'cortesia_no_autorizada';
  end if;
  v_authorizer_id:=auth.uid();

  -- Bloquear en orden todas las cuentas con participacion en las lineas
  -- visibles en la cuenta objetivo, como hace A08 en operaciones bilaterales.
  perform 1 from public.cuentas_comerciales c
  where c.empresa_id=p_empresa_id and c.local_id=p_local_id
    and (c.id=p_cuenta_id or c.id in (
      select r2.cuenta_id from public.cuenta_linea_repartos r2
      where r2.empresa_id=p_empresa_id and r2.local_id=p_local_id
        and r2.estado='ACTIVO' and r2.source_line_id in (
          select l.id from public.pedido_lineas l
          join public.pedidos_tpv p on p.empresa_id=l.empresa_id
            and p.local_id=l.local_id and p.id=l.pedido_id
          where l.empresa_id=p_empresa_id and l.local_id=p_local_id
            and (p.cuenta_id=p_cuenta_id or exists (
              select 1 from public.cuenta_linea_repartos rt
              where rt.empresa_id=l.empresa_id and rt.local_id=l.local_id
                and rt.source_line_id=l.id and rt.cuenta_id=p_cuenta_id
                and rt.estado='ACTIVO'
            ))
        )
    ))
  order by c.id for update;

  select * into v_cuenta from public.cuentas_comerciales c
  where c.empresa_id=p_empresa_id and c.local_id=p_local_id and c.id=p_cuenta_id
  for update;
  if not found then
    if v_has_authorization then
      v_result:=jsonb_build_object('ok',false,'status','INVALIDADA',
        'operation_id',p_operation_id,'error','descuento_cuenta_no_encontrada');
      update public.abc_descuento_autorizaciones
        set estado='INVALIDADA',resultado=v_result where id=v_authorization.id;
      perform private.abc_operacion_fallar(p_operation_id,v_result);
      return v_result;
    end if;
    raise exception 'descuento_cuenta_no_encontrada';
  end if;
  if v_cuenta.estado<>'ABIERTA' then
    if v_has_authorization then
      v_result:=jsonb_build_object('ok',false,'status','INVALIDADA',
        'operation_id',p_operation_id,'error','descuento_cuenta_no_abierta');
      update public.abc_descuento_autorizaciones
        set estado='INVALIDADA',resultado=v_result where id=v_authorization.id;
      perform private.abc_operacion_fallar(p_operation_id,v_result);
      return v_result;
    end if;
    raise exception 'descuento_cuenta_no_abierta';
  end if;
  if v_cuenta.version<>p_expected_cuenta_version then
    if v_has_authorization then
      v_result:=jsonb_build_object('ok',false,'status','INVALIDADA',
        'operation_id',p_operation_id,'error','cuenta_version_conflict');
      update public.abc_descuento_autorizaciones
        set estado='INVALIDADA',resultado=v_result where id=v_authorization.id;
      perform private.abc_operacion_fallar(p_operation_id,v_result);
      return v_result;
    end if;
    raise exception 'cuenta_version_conflict';
  end if;
  if v_cuenta.opened_operating_day<>p_operating_day then
    raise exception 'descuento_operating_day_incompatible';
  end if;

  -- El orden cuenta -> linea -> reparto sigue las RPC A08. La transaccion
  -- completa se revierte ante cualquier version/conflicto.
  for v_line_id in
    select distinct l.id
    from public.pedido_lineas l
    join public.pedidos_tpv p on p.empresa_id=l.empresa_id
      and p.local_id=l.local_id and p.id=l.pedido_id
    where l.empresa_id=p_empresa_id and l.local_id=p_local_id
      and l.estado<>'CANCELADA'
      and (p.cuenta_id=p_cuenta_id or exists (
        select 1 from public.cuenta_linea_repartos r
        where r.empresa_id=l.empresa_id and r.local_id=l.local_id
          and r.source_line_id=l.id and r.cuenta_id=p_cuenta_id and r.estado='ACTIVO'
      ))
    order by l.id
  loop
    select * into v_line from public.pedido_lineas l
    where l.empresa_id=p_empresa_id and l.local_id=p_local_id and l.id=v_line_id
    for update;
    -- Una linea originaria de esta cuenta puede haberse movido por completo.
    if exists (
      select 1 from public.cuenta_linea_repartos r
      where r.empresa_id=p_empresa_id and r.local_id=p_local_id
        and r.source_line_id=v_line_id and r.estado='ACTIVO'
    ) and not exists (
      select 1 from public.cuenta_linea_repartos r
      where r.empresa_id=p_empresa_id and r.local_id=p_local_id
        and r.source_line_id=v_line_id and r.cuenta_id=p_cuenta_id
        and r.estado='ACTIVO'
    ) then continue; end if;
    if v_line.estado in ('BORRADOR','CANCELADA') or v_line.base is null
       or v_line.descuento_total is null or v_line.impuestos is null
       or v_line.total is null then raise exception 'descuento_linea_no_apta'; end if;
    v_rate:=coalesce(
      nullif(v_line.snapshot_calculo->>'impuesto_base_pct','')::numeric,
      nullif(v_line.snapshot_calculo->>'impuesto_pct','')::numeric,
      nullif(v_line.snapshot_comercial->>'impuesto_pct','')::numeric,
      nullif(v_line.snapshot_comercial->>'impuesto_base_pct','')::numeric
    );
    if v_rate is null or v_rate<0 or v_rate>100 then
      raise exception 'descuento_tipo_iva_desconocido';
    end if;
    if exists (
      select 1 from public.pedido_linea_opciones o
      where o.empresa_id=p_empresa_id and o.local_id=p_local_id
        and o.linea_id=v_line_id and o.base<>0 and o.impuesto_pct<>v_rate
    ) then raise exception 'descuento_reparto_iva_mixto_no_soportado'; end if;
    if exists (
      select 1 from public.venta_fiscal_lineas vl
      join public.ventas_fiscales vf on vf.empresa_id=vl.empresa_id
        and vf.local_id=vl.local_id and vf.id=vl.venta_fiscal_id
      where vl.empresa_id=p_empresa_id and vl.local_id=p_local_id
        and vl.source_line_id=v_line_id and vf.estado<>'CANCELADA'
    ) then raise exception 'descuento_linea_fiscalizada'; end if;
    if not exists (
      select 1 from public.cuenta_linea_repartos r
      where r.empresa_id=p_empresa_id and r.local_id=p_local_id
        and r.source_line_id=v_line_id and r.estado='ACTIVO'
    ) then
      perform private.abc_materializar_reparto_linea(p_empresa_id,p_local_id,v_line_id);
    end if;
    v_source_ids:=array_append(v_source_ids,v_line_id);
  end loop;
  if cardinality(v_source_ids)=0 then raise exception 'descuento_cuenta_sin_lineas'; end if;

  perform 1 from public.cuenta_linea_repartos r
  where r.empresa_id=p_empresa_id and r.local_id=p_local_id
    and r.source_line_id=any(v_source_ids) and r.estado='ACTIVO'
  order by r.source_line_id,r.id for update;
  if exists (
    select 1 from public.cuenta_linea_repartos r
    where r.empresa_id=p_empresa_id and r.local_id=p_local_id
      and r.source_line_id=any(v_source_ids) and r.estado='ACTIVO'
      and r.total<>r.base+r.impuestos
  ) then raise exception 'descuento_reparto_importes_invalidos'; end if;

  select array_agg(distinct r.cuenta_id order by r.cuenta_id)
    into v_account_ids
  from public.cuenta_linea_repartos r
  where r.empresa_id=p_empresa_id and r.local_id=p_local_id
    and r.source_line_id=any(v_source_ids) and r.estado='ACTIVO';

  if exists (
    select 1 from public.cuentas_comerciales c
    where c.empresa_id=p_empresa_id and c.local_id=p_local_id
      and c.id=any(v_account_ids) and c.estado<>'ABIERTA'
  ) then raise exception 'descuento_reparto_cuenta_no_abierta'; end if;

  if exists (
    select 1 from public.cuenta_cuotas_importe q
    where q.empresa_id=p_empresa_id and q.local_id=p_local_id and q.estado='ACTIVA'
      and (q.cuenta_origen_id=any(v_account_ids)
        or q.cuenta_destino_id=any(v_account_ids))
  ) or exists (
    select 1 from public.checkouts c
    where c.empresa_id=p_empresa_id and c.local_id=p_local_id
      and c.cuenta_id=any(v_account_ids) and c.estado<>'CANCELADO'
  ) then raise exception 'descuento_compromiso_financiero'; end if;

  -- La fuente siempre debe conciliar con todos los repartos antes de tocarla.
  for v_line_id in select unnest(v_source_ids) loop
    select sum(r.descuento) descuento,sum(r.base) base,
           sum(r.impuestos) impuestos,sum(r.total) total
      into v_agg
    from public.cuenta_linea_repartos r
    where r.empresa_id=p_empresa_id and r.local_id=p_local_id
      and r.source_line_id=v_line_id and r.estado='ACTIVO';
    select * into v_line from public.pedido_lineas where id=v_line_id;
    if v_line.descuento_total<>v_agg.descuento or v_line.base<>v_agg.base
       or v_line.impuestos<>v_agg.impuestos or v_line.total<>v_agg.total then
      raise exception 'descuento_reparto_fuente_inconsistente';
    end if;
  end loop;

  select coalesce(sum(r.base),0)::numeric(24,8) into v_base
  from public.cuenta_linea_repartos r
  where r.empresa_id=p_empresa_id and r.local_id=p_local_id
    and r.cuenta_id=p_cuenta_id and r.estado='ACTIVO'
    and r.source_line_id=any(v_source_ids);
  if v_base<=0 then raise exception 'descuento_base_no_positiva'; end if;
  v_amount:=case v_kind
    when 'COURTESY' then v_base
    when 'PERCENT' then round(v_base*p_valor/100,8)
    else p_valor end;
  if v_amount<=0 or v_amount>v_base then raise exception 'descuento_importe_fuera_base'; end if;
  if v_kind<>'COURTESY' and v_amount=v_base then
    raise exception 'descuento_cortesia_requerida';
  end if;

  v_snapshot:=private.abc_a09_snapshot_solicitud(
    v_request,v_source_ids,v_requester_policy
  );
  v_snapshot_hash:=private.abc_a09_snapshot_hash(v_snapshot);
  v_over_requester_limit:=coalesce(
    (v_snapshot#>>'{operation,requiere_escalado}')::boolean,false
  );
  if v_over_requester_limit
     and not coalesce((v_requester_policy->>'permite_escalado')::boolean,false) then
    raise exception 'descuento_escalado_no_permitido';
  end if;
  v_requires_dual:=coalesce(
    (v_requester_policy->>'requiere_doble_aprobacion')::boolean,false)
    or v_over_requester_limit or v_has_authorization;
  if not coalesce((v_requester_policy->>'puede_aplicar')::boolean,false) then
    raise exception 'descuento_aplicar_no_autorizado';
  end if;

  if v_requires_dual then
    if not v_has_authorization then
      v_result:=jsonb_build_object('ok',false,'status','PENDIENTE_AUTORIZACION',
        'operation_id',p_operation_id,'approval_hash',v_snapshot_hash,
        'amount',v_amount::text,'snapshot',v_snapshot,'replayed',false);
      insert into public.abc_descuento_autorizaciones(
        empresa_id,local_id,operation_id,cuenta_id,solicitante_id,motivo,
        snapshot,snapshot_hash,politica_solicitante,resultado
      ) values (
        p_empresa_id,p_local_id,p_operation_id,p_cuenta_id,auth.uid(),v_reason,
        v_snapshot,v_snapshot_hash,v_requester_policy,v_result
      ) returning id into v_authorization_id;
      v_authorization.id:=v_authorization_id;
      v_authorization.estado:='PENDIENTE';
      v_authorization.snapshot:=v_snapshot;
      v_authorization.snapshot_hash:=v_snapshot_hash;
      v_authorization.politica_solicitante:=v_requester_policy;
      v_authorization.solicitante_id:=auth.uid();
      v_authorization.motivo:=v_reason;
      v_has_authorization:=true;
      return v_result;
    end if;
    if v_authorization.estado='PENDIENTE' then
      if v_authorization.snapshot_hash<>v_snapshot_hash
         or v_authorization.snapshot is distinct from v_snapshot then
        v_result:=jsonb_build_object('ok',false,'status','INVALIDADA',
          'operation_id',p_operation_id,'error','descuento_autorizacion_version_obsoleta');
        update public.abc_descuento_autorizaciones
          set estado='INVALIDADA',resultado=v_result where id=v_authorization.id;
        perform private.abc_operacion_fallar(p_operation_id,v_result);
        return v_result;
      end if;
      return (v_authorization.resultado||jsonb_build_object('replayed',true));
    end if;
    if v_authorization.estado<>'APROBADA' then
      return coalesce(v_authorization.resultado,
        jsonb_build_object('ok',false,'status',v_authorization.estado,
          'operation_id',p_operation_id));
    end if;
    v_authorizer_id:=v_authorization.autorizador_id;
    v_authorizer_policy:=private.abc_descuento_politica_usuario(
      v_authorizer_id,p_empresa_id,p_local_id
    );
    if v_authorizer_policy is distinct from v_authorization.politica_autorizador
       or not private.abc_a09_politica_puede_autorizar(v_snapshot,v_authorizer_policy)
       or v_snapshot_hash<>v_authorization.snapshot_hash
       or v_snapshot is distinct from v_authorization.snapshot then
      v_result:=jsonb_build_object('ok',false,'status','INVALIDADA',
        'operation_id',p_operation_id,'error','descuento_autorizacion_contexto_cambiado');
      update public.abc_descuento_autorizaciones
        set estado='INVALIDADA',resultado=v_result where id=v_authorization.id;
      perform private.abc_operacion_fallar(p_operation_id,v_result);
      return v_result;
    end if;
    v_authorizer_max:=(v_authorizer_policy->>'max_percent')::numeric;
    if coalesce((v_snapshot#>>'{operation,requiere_escalado}')::boolean,false) then
      v_max:=v_authorizer_max;
    else
      v_max:=least(v_max,v_authorizer_max);
    end if;
    v_authorization_id:=v_authorization.id;
  end if;

  -- Unidades de 10^-8, restos mayores y empate por reparto.id.
  for v_alloc in
    with raw as (
      select r.id,
        floor(v_amount*r.base/v_base*100000000) units,
        v_amount*r.base/v_base*100000000
          - floor(v_amount*r.base/v_base*100000000) fraction
      from public.cuenta_linea_repartos r
      where r.empresa_id=p_empresa_id and r.local_id=p_local_id
        and r.cuenta_id=p_cuenta_id and r.estado='ACTIVO'
        and r.source_line_id=any(v_source_ids)
    ), ranked as (
      select raw.*,
        row_number() over(order by fraction desc,id) rank_remainder,
        sum(units) over() floor_total
      from raw
    )
    select id,
      (units+case when rank_remainder<=round(v_amount*100000000)-floor_total
        then 1 else 0 end)/100000000::numeric as amount
    from ranked order by id
  loop
    if v_alloc.amount=0 then continue; end if;
    select * into v_row from public.cuenta_linea_repartos where id=v_alloc.id for update;
    if v_kind<>'COURTESY' and v_alloc.amount=v_row.base then
      raise exception 'descuento_cortesia_requerida';
    end if;
    select coalesce(
      nullif(l.snapshot_calculo->>'impuesto_base_pct','')::numeric,
      nullif(l.snapshot_calculo->>'impuesto_pct','')::numeric,
      nullif(l.snapshot_comercial->>'impuesto_pct','')::numeric,
      nullif(l.snapshot_comercial->>'impuesto_base_pct','')::numeric
    ) into v_rate
    from public.pedido_lineas l where l.id=v_row.source_line_id;
    v_new_base:=v_row.base-v_alloc.amount;
    v_tax:=case when v_new_base=0 then 0
      else v_row.impuestos-round(v_alloc.amount*v_rate/100,8) end;
    if v_new_base<0 or v_tax<0 or v_row.total<>v_row.base+v_row.impuestos then
      raise exception 'descuento_reparto_importes_invalidos';
    end if;
    v_new_total:=v_new_base+v_tax;
    update public.cuenta_linea_repartos
      set descuento=descuento+v_alloc.amount,base=v_new_base,
          impuestos=v_tax,total=v_new_total,version=version+1
      where id=v_row.id;
    insert into public.abc_descuentos_aplicados(
      empresa_id,local_id,operation_id,cuenta_id,reparto_id,source_line_id,
      tipo,importe,base_antes,base_despues,iva_antes,iva_despues,motivo,
      solicitante_id,autorizador_id,autorizacion_id,terminal_id,session_id,operating_day
    ) values (
      p_empresa_id,p_local_id,p_operation_id,p_cuenta_id,v_row.id,v_row.source_line_id,
      v_kind,v_alloc.amount,v_row.base,v_new_base,v_row.impuestos,v_tax,v_reason,
      auth.uid(),v_authorizer_id,v_authorization_id,p_terminal_id,p_session_id,p_operating_day
    );
    if not v_row.source_line_id=any(v_changed_source_ids) then
      v_changed_source_ids:=array_append(v_changed_source_ids,v_row.source_line_id);
    end if;
  end loop;

  for v_line_id in select unnest(v_changed_source_ids) loop
    select sum(r.descuento) descuento,sum(r.base) base,
           sum(r.impuestos) impuestos,sum(r.total) total,
           sum(r.descuento+r.base) gross
      into v_agg
    from public.cuenta_linea_repartos r
    where r.empresa_id=p_empresa_id and r.local_id=p_local_id
      and r.source_line_id=v_line_id and r.estado='ACTIVO';
    if v_agg.gross<=0 or v_agg.descuento*100>v_agg.gross*v_max
       or v_agg.total<>v_agg.base+v_agg.impuestos then
      raise exception 'descuento_limite_acumulado_excedido';
    end if;
    update public.pedido_lineas
      set descuento_total=v_agg.descuento,base=v_agg.base,
          impuestos=v_agg.impuestos,total=v_agg.total,version=version+1,
          snapshot_calculo=snapshot_calculo || jsonb_build_object(
            'a09_ultimo_operation_id',p_operation_id
          )
      where empresa_id=p_empresa_id and local_id=p_local_id and id=v_line_id;
  end loop;

  update public.cuentas_comerciales set version=version+1
  where empresa_id=p_empresa_id and local_id=p_local_id and id=p_cuenta_id
  returning version into v_version;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'CUENTA',p_cuenta_id::text,
    'CUENTA_DESCUENTO_APLICADO',
    jsonb_build_object('tipo',v_kind,'valor',p_valor,'importe',v_amount,
      'motivo',v_reason,'solicitante_id',auth.uid(),'autorizador_id',v_authorizer_id,
      'autorizacion_id',v_authorization_id,
      'cuenta_version',v_version,'session_id',p_session_id),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );
  v_result:=jsonb_build_object(
    'ok',true,'status','APLICADA','cuenta_id',p_cuenta_id,'tipo',v_kind,'descuento',v_amount,
    'autorizador_id',v_authorizer_id,'autorizacion_id',v_authorization_id,
    'cuenta_version',v_version,
    'total_comercial',private.abc_total_comercial_cuenta(
      p_empresa_id,p_local_id,p_cuenta_id
    )
  );
  if v_authorization_id is not null then
    update public.abc_descuento_autorizaciones
      set estado='APLICADA',aplicada_at=now(),resultado=v_result
      where id=v_authorization_id and estado='APROBADA';
    if not found then raise exception 'descuento_autorizacion_no_aprobada'; end if;
  end if;
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_aprobar_descuento_cuenta(
  p_operation_id text,p_empresa_id text,p_local_id text,p_snapshot_hash text,
  p_attempt_id uuid,p_decision text,p_motivo text
) returns jsonb
language plpgsql volatile security definer set search_path=''
as $$
declare
  v_operation public.abc_operaciones%rowtype;
  v_authorization public.abc_descuento_autorizaciones%rowtype;
  v_existing_attempt public.abc_descuento_aprobacion_intentos%rowtype;
  v_requester_policy jsonb;
  v_authorizer_policy jsonb;
  v_snapshot jsonb;
  v_source_ids uuid[];
  v_attempt_hash text;
  v_escalated boolean:=false;
  v_decision text:=upper(btrim(coalesce(p_decision,'')));
  v_reason text:=btrim(coalesce(p_motivo,''));
  v_result jsonb;
begin
  if auth.uid() is null or p_attempt_id is null
     or p_snapshot_hash !~ '^[0-9a-f]{64}$'
     or v_decision not in ('APROBAR','RECHAZAR')
     or char_length(v_reason) not between 1 and 500 then
    raise exception 'descuento_aprobacion_parametros_invalidos';
  end if;
  if not private.la_tiene_local(p_empresa_id,p_local_id) then
    raise exception 'contexto_no_autorizado';
  end if;
  perform private.abc_a09_lock_config_context(p_empresa_id,p_local_id);
  perform private.abc_lock_operation_id(p_operation_id);
  select * into v_operation from public.abc_operaciones o
  where o.operation_id=p_operation_id and o.empresa_id=p_empresa_id
    and o.local_id=p_local_id and o.command_type='ABC_APLICAR_DESCUENTO_CUENTA'
  for update;
  if not found then raise exception 'descuento_solicitud_no_encontrada'; end if;
  select * into v_authorization from public.abc_descuento_autorizaciones a
  where a.operation_id=p_operation_id and a.empresa_id=p_empresa_id
    and a.local_id=p_local_id for update;
  if not found then raise exception 'descuento_solicitud_no_encontrada'; end if;

  v_attempt_hash:=private.abc_request_hash(jsonb_build_object(
    'actor_user_id',auth.uid(),'snapshot_hash',p_snapshot_hash,
    'decision',v_decision,'motivo',v_reason
  ));
  select * into v_existing_attempt
  from public.abc_descuento_aprobacion_intentos i
  where i.operation_id=p_operation_id and i.attempt_id=p_attempt_id;
  if found then
    if v_existing_attempt.autorizador_id is distinct from auth.uid()
       or v_existing_attempt.attempt_hash<>v_attempt_hash then
      raise exception 'descuento_aprobacion_attempt_id_conflict';
    end if;
    return v_existing_attempt.resultado||jsonb_build_object('replayed',true);
  end if;

  if p_snapshot_hash<>v_authorization.snapshot_hash then
    v_result:=jsonb_build_object('ok',false,'status','RECHAZADA',
      'operation_id',p_operation_id,'error','descuento_aprobacion_snapshot_conflict');
    insert into public.abc_descuento_aprobacion_intentos(
      empresa_id,local_id,operation_id,attempt_id,solicitante_id,autorizador_id,
      snapshot_hash,decision,motivo,attempt_hash,resultado
    ) values (p_empresa_id,p_local_id,p_operation_id,p_attempt_id,
      v_authorization.solicitante_id,auth.uid(),p_snapshot_hash,v_decision,v_reason,
      v_attempt_hash,v_result);
    return v_result;
  end if;
  if v_authorization.estado<>'PENDIENTE' then
    v_result:=jsonb_build_object('ok',false,'status',v_authorization.estado,
      'operation_id',p_operation_id,
      'error',case when v_authorization.estado='APROBADA'
        then 'descuento_ya_aprobado' else 'descuento_solicitud_cerrada' end,
      'autorizador_id',coalesce(v_authorization.autorizador_id::text,''));
    insert into public.abc_descuento_aprobacion_intentos(
      empresa_id,local_id,operation_id,attempt_id,solicitante_id,autorizador_id,
      snapshot_hash,decision,motivo,attempt_hash,resultado
    ) values (p_empresa_id,p_local_id,p_operation_id,p_attempt_id,
      v_authorization.solicitante_id,auth.uid(),p_snapshot_hash,v_decision,v_reason,
      v_attempt_hash,v_result);
    return v_result;
  end if;

  if auth.uid()=v_authorization.solicitante_id then
    v_result:=jsonb_build_object('ok',false,'status','RECHAZADA',
      'operation_id',p_operation_id,'error','descuento_autoaprobacion_rechazada');
    insert into public.abc_descuento_aprobacion_intentos(
      empresa_id,local_id,operation_id,attempt_id,solicitante_id,autorizador_id,
      snapshot_hash,decision,motivo,attempt_hash,resultado
    ) values (p_empresa_id,p_local_id,p_operation_id,p_attempt_id,
      v_authorization.solicitante_id,auth.uid(),p_snapshot_hash,v_decision,v_reason,
      v_attempt_hash,v_result);
    return v_result;
  end if;

  -- Lock in the A08 order so a split/merge cannot change the approved shares
  -- while the amount snapshot is checked.
  perform 1 from public.cuentas_comerciales c
  where c.empresa_id=p_empresa_id and c.local_id=p_local_id
    and c.id in (select (x->>'cuenta_id')::uuid
      from jsonb_array_elements(v_authorization.snapshot->'accounts') x)
  order by c.id for update;
  perform 1 from public.pedido_lineas l
  where l.empresa_id=p_empresa_id and l.local_id=p_local_id
    and l.id in (select (x->>'line_id')::uuid
      from jsonb_array_elements(v_authorization.snapshot->'lines') x)
  order by l.id for update;
  perform 1 from public.cuenta_linea_repartos r
  where r.empresa_id=p_empresa_id and r.local_id=p_local_id
    and r.id in (select (x->>'reparto_id')::uuid
      from jsonb_array_elements(v_authorization.snapshot->'shares') x)
  order by r.source_line_id,r.id for update;

  select array_agg((x #>> '{}')::uuid order by (x #>> '{}')) into v_source_ids
  from jsonb_array_elements(v_authorization.snapshot->'source_line_ids') x;
  v_requester_policy:=private.abc_descuento_politica_usuario(
    v_authorization.solicitante_id,p_empresa_id,p_local_id
  );
  v_authorizer_policy:=private.abc_descuento_politica_usuario(
    auth.uid(),p_empresa_id,p_local_id
  );
  v_snapshot:=private.abc_a09_snapshot_solicitud(
    v_operation.request,v_source_ids,v_requester_policy
  );
  v_escalated:=coalesce(
    (v_authorization.snapshot#>>'{operation,requiere_escalado}')::boolean,false
  );
  if v_requester_policy is distinct from v_authorization.politica_solicitante
     or not coalesce((v_requester_policy->>'puede_solicitar')::boolean,false)
     or (v_escalated and not coalesce(
       (v_requester_policy->>'permite_escalado')::boolean,false))
     or (not v_escalated and not coalesce(
       (v_requester_policy->>'requiere_doble_aprobacion')::boolean,false))
     or private.abc_a09_snapshot_hash(v_snapshot)<>v_authorization.snapshot_hash
     or v_snapshot is distinct from v_authorization.snapshot then
    v_result:=jsonb_build_object('ok',false,'status','INVALIDADA',
      'operation_id',p_operation_id,'error','descuento_autorizacion_version_obsoleta');
    update public.abc_descuento_autorizaciones
      set estado='INVALIDADA',resultado=v_result where id=v_authorization.id;
    if v_operation.status='PROCESANDO' then
      perform private.abc_operacion_fallar(p_operation_id,v_result);
    end if;
    insert into public.abc_descuento_aprobacion_intentos(
      empresa_id,local_id,operation_id,attempt_id,solicitante_id,autorizador_id,
      snapshot_hash,decision,motivo,attempt_hash,resultado
    ) values (p_empresa_id,p_local_id,p_operation_id,p_attempt_id,
      v_authorization.solicitante_id,auth.uid(),p_snapshot_hash,v_decision,v_reason,
      v_attempt_hash,v_result);
    return v_result;
  end if;
  if not coalesce((v_authorizer_policy->>'puede_autorizar')::boolean,false)
     or (v_decision='APROBAR' and not private.abc_a09_politica_puede_autorizar(
       v_snapshot,v_authorizer_policy
     )) then
    v_result:=jsonb_build_object('ok',false,'status','RECHAZADA',
      'operation_id',p_operation_id,'error','descuento_aprobador_sin_permiso');
    insert into public.abc_descuento_aprobacion_intentos(
      empresa_id,local_id,operation_id,attempt_id,solicitante_id,autorizador_id,
      snapshot_hash,decision,motivo,attempt_hash,resultado
    ) values (p_empresa_id,p_local_id,p_operation_id,p_attempt_id,
      v_authorization.solicitante_id,auth.uid(),p_snapshot_hash,v_decision,v_reason,
      v_attempt_hash,v_result);
    return v_result;
  end if;

  if v_decision='RECHAZAR' then
    v_result:=jsonb_build_object('ok',false,'status','RECHAZADA',
      'operation_id',p_operation_id,'autorizador_id',auth.uid(),
      'motivo',v_reason,'error','descuento_rechazado_por_autorizador');
    update public.abc_descuento_autorizaciones set estado='RECHAZADA',
      autorizador_id=auth.uid(),politica_autorizador=v_authorizer_policy,
      motivo_autorizacion=v_reason,autorizada_at=now(),resultado=v_result
    where id=v_authorization.id and estado='PENDIENTE';
    perform private.abc_operacion_fallar(p_operation_id,v_result);
  else
    v_result:=jsonb_build_object('ok',true,'status','APROBADA',
      'operation_id',p_operation_id,'approval_hash',v_authorization.snapshot_hash,
      'solicitante_id',v_authorization.solicitante_id,
      'autorizador_id',auth.uid(),'motivo',v_reason,'replayed',false);
    update public.abc_descuento_autorizaciones set estado='APROBADA',
      autorizador_id=auth.uid(),politica_autorizador=v_authorizer_policy,
      motivo_autorizacion=v_reason,autorizada_at=now(),resultado=v_result
    where id=v_authorization.id and estado='PENDIENTE';
    if not found then raise exception 'descuento_autorizacion_estado_conflict'; end if;
  end if;
  insert into public.abc_descuento_aprobacion_intentos(
    empresa_id,local_id,operation_id,attempt_id,solicitante_id,autorizador_id,
    snapshot_hash,decision,motivo,attempt_hash,resultado
  ) values (p_empresa_id,p_local_id,p_operation_id,p_attempt_id,
    v_authorization.solicitante_id,auth.uid(),p_snapshot_hash,v_decision,v_reason,
    v_attempt_hash,v_result);
  return v_result;
end $$;

revoke all on function public.abc_aprobar_descuento_cuenta(
  text,text,text,text,uuid,text,text
) from public,anon,authenticated,service_role;
grant execute on function public.abc_aprobar_descuento_cuenta(
  text,text,text,text,uuid,text,text
) to authenticated;

revoke all on function private.abc_descuento_politica(text,text)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_descuento_politica_usuario(uuid,text,text)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_a09_lock_config_context(text,text)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_a09_lock_config_context_write(text,text)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_a09_config_lock_trigger()
  from public,anon,authenticated,service_role;
revoke all on function private.abc_a09_snapshot_solicitud(jsonb,uuid[],jsonb)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_a09_solicitud_dentro_limite(jsonb,jsonb)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_a09_politica_puede_autorizar(jsonb,jsonb)
  from public,anon,authenticated,service_role;

-- Un escritor fiscal privilegiado puede haber preparado importes antes de que
-- A09 confirme el descuento. La FK por si sola espera el lock de la linea,
-- pero despues permite insertar una instantanea antigua. Este guard bloquea
-- la fuente y exige la cuota A08 actual para toda linea tocada por A09.
-- La fiscalizacion parcial posterior a A09 queda cerrada hasta que exista una
-- RPC fiscal que asigne y redondee sus importes con un contrato propio.
create function private.abc_a09_guard_fiscal_linea()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_cuenta_id uuid;
  v_expected record;
begin
  perform 1 from public.pedido_lineas l
  where l.empresa_id=new.empresa_id and l.local_id=new.local_id
    and l.id=new.source_line_id for update;
  if not found then raise exception 'a09_fiscal_linea_fuente_ausente'; end if;
  if not exists (
    select 1 from public.abc_descuentos_aplicados d
    where d.empresa_id=new.empresa_id and d.local_id=new.local_id
      and d.source_line_id=new.source_line_id
  ) then return new; end if;

  select vf.cuenta_id into v_cuenta_id from public.ventas_fiscales vf
  where vf.empresa_id=new.empresa_id and vf.local_id=new.local_id
    and vf.id=new.venta_fiscal_id and vf.estado<>'CANCELADA';
  if v_cuenta_id is null then raise exception 'a09_fiscal_venta_no_apta'; end if;
  select sum(r.cantidad) cantidad,sum(r.descuento) descuento,
         sum(r.base) base,sum(r.impuestos) impuesto,sum(r.total) total
    into v_expected
  from public.cuenta_linea_repartos r
  where r.empresa_id=new.empresa_id and r.local_id=new.local_id
    and r.source_line_id=new.source_line_id and r.cuenta_id=v_cuenta_id
    and r.estado='ACTIVO';
  if v_expected.cantidad is null or new.cantidad<>v_expected.cantidad
     or new.descuento<>v_expected.descuento or new.base<>v_expected.base
     or new.impuesto<>v_expected.impuesto or new.total<>v_expected.total then
    raise exception 'a09_fiscal_snapshot_obsoleto_o_parcial';
  end if;
  return new;
end $$;

create trigger a09_guard_fiscal_linea
  before insert or update on public.venta_fiscal_lineas
  for each row execute function private.abc_a09_guard_fiscal_linea();
revoke all on function private.abc_a09_guard_fiscal_linea()
  from public,anon,authenticated,service_role;

-- Proyección para impresión/documento: redondea cada agregado a céntimos,
-- asigna los restos por mayor fracción e id de línea y expone el ajuste que
-- reconcilia total = base + IVA + ajuste. Los importes fuente siguen a 8 dp.
create function private.abc_a09_proyectar_centimos(p_venta_fiscal_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  v_projection jsonb;
  v_expected_discount numeric;
begin
  if exists (
    select 1 from public.venta_fiscal_lineas vl
    join public.pedido_lineas l on l.empresa_id=vl.empresa_id
      and l.local_id=vl.local_id and l.id=vl.source_line_id
    cross join lateral (select coalesce(
      nullif(vl.snapshot->>'impuesto_pct','')::numeric,
      nullif(l.snapshot_calculo->>'impuesto_base_pct','')::numeric,
      nullif(l.snapshot_calculo->>'impuesto_pct','')::numeric,
      nullif(l.snapshot_comercial->>'impuesto_pct','')::numeric,
      nullif(l.snapshot_comercial->>'impuesto_base_pct','')::numeric
    ) rate) r
    where vl.venta_fiscal_id=p_venta_fiscal_id and (
      r.rate is null or exists (
        select 1 from public.pedido_linea_opciones o
        where o.empresa_id=vl.empresa_id and o.local_id=vl.local_id
          and o.linea_id=vl.source_line_id and o.base<>0 and o.impuesto_pct<>r.rate
      )
    )
  ) then raise exception 'a09_proyeccion_tipo_iva_desconocido_o_mixto'; end if;

  with source as (
    select vl.id::text id,vl.base,vl.descuento,vl.base+vl.descuento subtotal,
      vl.impuesto tax,vl.total,coalesce(
        nullif(vl.snapshot->>'impuesto_pct','')::numeric,
        nullif(l.snapshot_calculo->>'impuesto_base_pct','')::numeric,
        nullif(l.snapshot_calculo->>'impuesto_pct','')::numeric,
        nullif(l.snapshot_comercial->>'impuesto_pct','')::numeric,
        nullif(l.snapshot_comercial->>'impuesto_base_pct','')::numeric
      ) tax_rate
    from public.venta_fiscal_lineas vl
    join public.pedido_lineas l on l.empresa_id=vl.empresa_id
      and l.local_id=vl.local_id and l.id=vl.source_line_id
    where vl.venta_fiscal_id=p_venta_fiscal_id
  ), floors as (
    select s.*,
      floor(s.subtotal*100) subtotal_floor,
      s.subtotal*100-floor(s.subtotal*100) subtotal_fraction,
      floor(s.descuento*100) discount_floor,
      s.descuento*100-floor(s.descuento*100) discount_fraction,
      floor(s.tax*100) tax_floor,
      s.tax*100-floor(s.tax*100) tax_fraction,
      floor(s.total*100) total_floor,
      s.total*100-floor(s.total*100) total_fraction
    from source s
  ), targets as (
    select round(coalesce(sum(subtotal),0)*100) subtotal_target,
      coalesce(sum(subtotal_floor),0) subtotal_floor_sum,
      round(coalesce(sum(descuento),0)*100) discount_target,
      coalesce(sum(discount_floor),0) discount_floor_sum,
      round(coalesce(sum(total),0)*100) total_target,
      coalesce(sum(total_floor),0) total_floor_sum
    from floors
  ), allocated as (
    select f.id,
      f.subtotal_floor + case when row_number() over(
        order by f.subtotal_fraction desc,f.id
      ) <= t.subtotal_target-t.subtotal_floor_sum then 1 else 0 end subtotal_cents,
      f.discount_floor,f.discount_fraction,
      f.tax,f.tax_floor,f.tax_fraction,f.tax_rate,
      f.total_floor + case when row_number() over(
        order by f.total_fraction desc,f.id
      ) <= t.total_target-t.total_floor_sum then 1 else 0 end total_cents
    from floors f cross join targets t
  ), tax_ranked as (
    select a.id,a.tax_floor,
      row_number() over(partition by a.tax_rate order by a.tax_fraction desc,a.id) rank,
      round(sum(a.tax) over(partition by a.tax_rate)*100) target,
      sum(a.tax_floor) over(partition by a.tax_rate) floor_sum
    from allocated a
  ), tax_allocated as (
    select id,tax_floor+case when rank<=target-floor_sum then 1 else 0 end tax_cents
    from tax_ranked
  ), discount_ranked as (
    -- No se permite redondear descuento por encima del subtotal mostrado.
    select a.id,row_number() over(order by a.discount_fraction desc,a.id) rank
    from allocated a where a.discount_floor<a.subtotal_cents
  ), projected as (
    select a.id,a.subtotal_cents,
      a.discount_floor+case when d.rank<=t.discount_target-t.discount_floor_sum
        then 1 else 0 end discount_cents,
      x.tax_cents,a.total_cents
    from allocated a cross join targets t
    left join discount_ranked d on d.id=a.id
    join tax_allocated x on x.id=a.id
  ), lines_with_base as (
    select p.*,p.subtotal_cents-p.discount_cents base_cents
    from projected p
  ), document_lines as (
    select p.*,p.total_cents-p.base_cents-p.tax_cents adjustment_cents
    from lines_with_base p
  ), line_json as (
    select jsonb_agg(jsonb_build_object(
      'id',id,'subtotal_cents',subtotal_cents::text,
      'discount_cents',discount_cents::text,'base_cents',base_cents::text,
      'tax_cents',tax_cents::text,'rounding_adjustment_cents',adjustment_cents::text,
      'total_cents',total_cents::text
    ) order by id) lines,
      sum(subtotal_cents) subtotal_cents,sum(discount_cents) discount_cents,
      sum(base_cents) base_cents,sum(tax_cents) tax_cents,
      sum(adjustment_cents) adjustment_cents,sum(total_cents) total_cents
    from document_lines
  )
  select case when lines is null then null else jsonb_build_object(
    'lines',lines,'document',jsonb_build_object(
      'subtotal_cents',subtotal_cents::text,'discount_cents',discount_cents::text,
      'base_cents',base_cents::text,'tax_cents',tax_cents::text,
      'rounding_adjustment_cents',adjustment_cents::text,'total_cents',total_cents::text
    )) end into v_projection from line_json;
  if v_projection is null then raise exception 'a09_documento_sin_lineas'; end if;
  select round(coalesce(sum(vl.descuento),0)*100) into v_expected_discount
  from public.venta_fiscal_lineas vl
  where vl.venta_fiscal_id=p_venta_fiscal_id;
  if (v_projection#>>'{document,discount_cents}')::numeric<>v_expected_discount then
    raise exception 'a09_proyeccion_descuento_centimos_sin_capacidad';
  end if;
  return v_projection;
end $$;
revoke all on function private.abc_a09_proyectar_centimos(uuid)
  from public,anon,authenticated,service_role;

revoke all on function public.abc_aplicar_descuento_cuenta(
  text,text,text,uuid,text,numeric,text,bigint,uuid,uuid,date
) from public,anon,authenticated,service_role;
grant execute on function public.abc_aplicar_descuento_cuenta(
  text,text,text,uuid,text,numeric,text,bigint,uuid,uuid,date
) to authenticated;
revoke all on function private.abc_descuento_politica(text,text)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_descuento_politica_usuario(uuid,text,text)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_a09_lock_config_context(text,text)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_a09_lock_config_context_write(text,text)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_a09_config_lock_trigger()
  from public,anon,authenticated,service_role;
revoke all on function private.abc_a09_snapshot_solicitud(jsonb,uuid[],jsonb)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_a09_solicitud_dentro_limite(jsonb,jsonb)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_a09_politica_puede_autorizar(jsonb,jsonb)
  from public,anon,authenticated,service_role;

-- Versioned JCS primitives for the future immutable fiscal snapshot. A09
-- does not create snapshots or emit documents; these helpers pin the exact
-- byte/hash contract so the later issuer cannot reinterpret money values.
create function private.abc_a09_jcs(p_value jsonb)
returns text language plpgsql immutable security definer set search_path=''
as $$
declare
  v_type text:=jsonb_typeof(p_value);
  v_result text;
begin
  if p_value is null then raise exception 'a09_jcs_sql_null'; end if;
  case v_type
    when 'object' then
      if exists(select 1 from jsonb_object_keys(p_value) k where k !~ '^[ -~]*$') then
        raise exception 'a09_jcs_key_must_be_printable_ascii';
      end if;
      select '{'||coalesce(string_agg(
        to_json(k)::text||':'||private.abc_a09_jcs(v), ',' order by k collate "C"), '')||'}'
        into v_result from jsonb_each(p_value) e(k,v);
      return v_result;
    when 'array' then
      select '['||coalesce(string_agg(private.abc_a09_jcs(value),',' order by ordinality),'')||']'
        into v_result from jsonb_array_elements(p_value) with ordinality;
      return v_result;
    when 'string' then return to_json(p_value #>> '{}')::text;
    when 'boolean' then return p_value::text;
    when 'null' then return 'null';
    when 'number' then raise exception 'a09_jcs_json_numbers_forbidden';
    else raise exception 'a09_jcs_type_invalid';
  end case;
end $$;

create function private.abc_a09_snapshot_hash(p_value jsonb)
returns text language sql immutable security definer set search_path=''
as $$
  select encode(extensions.digest(
    convert_to(private.abc_a09_jcs(p_value),'UTF8'),'sha256'
  ),'hex')
$$;

create function private.abc_a09_validar_importe_snapshot(p_value text,p_scale text)
returns boolean language sql immutable security definer set search_path=''
as $$
  select case p_scale
    when 'DECIMAL_8' then p_value ~ '^(0|[1-9][0-9]*)\.[0-9]{8}$|^-(0\.(?!00000000)[0-9]{8}|[1-9][0-9]*\.[0-9]{8})$'
    when 'CENT_INTEGER' then p_value ~ '^(0|[1-9][0-9]*|-[1-9][0-9]*)$'
    else false end
$$;

revoke all on function private.abc_a09_jcs(jsonb)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_a09_snapshot_hash(jsonb)
  from public,anon,authenticated,service_role;
revoke all on function private.abc_a09_validar_importe_snapshot(text,text)
  from public,anon,authenticated,service_role;
