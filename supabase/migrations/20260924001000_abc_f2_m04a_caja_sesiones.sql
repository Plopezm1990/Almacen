-- ABC F2 C01-M04A — autoridad transaccional de sesiones, cajas y terminales.
-- Aditiva. No cierra caja/fiscalidad: el cierre definitivo se mantiene para C04.
-- Depende de M01/M01b + M03A + M03B + M03C.

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.cajas_fisicas') is null then v_missing:=array_append(v_missing,'cajas_fisicas'); end if;
  if to_regclass('public.caja_sesiones') is null then v_missing:=array_append(v_missing,'caja_sesiones'); end if;
  if to_regclass('public.caja_sesion_terminales') is null then v_missing:=array_append(v_missing,'caja_sesion_terminales'); end if;
  if to_regclass('public.terminales_tpv') is null then v_missing:=array_append(v_missing,'terminales_tpv'); end if;
  if to_regclass('public.caja_operaciones') is null then v_missing:=array_append(v_missing,'caja_operaciones'); end if;
  if to_regclass('public.abc_operaciones') is null then v_missing:=array_append(v_missing,'abc_operaciones'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regclass('public.membresias_usuario') is null then v_missing:=array_append(v_missing,'membresias_usuario'); end if;

  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_request_hash(jsonb)') is null then v_missing:=array_append(v_missing,'abc_request_hash'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;

  if cardinality(v_missing)>0 then
    raise exception 'ABC_F2_M04A_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  if to_regclass('public.caja_sesion_responsables') is not null
     or to_regprocedure('private.abc_usuario_activo_local(text,text,uuid)') is not null
     or to_regprocedure('public.abc_abrir_sesion_caja(text,text,text,uuid,uuid,uuid,uuid,text,numeric,date)') is not null
     or to_regprocedure('public.abc_vincular_terminal_caja(text,text,text,uuid,uuid,date)') is not null
     or to_regprocedure('public.abc_desvincular_terminal_caja(text,text,text,uuid,uuid,text,date)') is not null
     or to_regprocedure('public.abc_cambiar_responsable_caja(text,text,text,uuid,uuid,text,uuid,date)') is not null
     or to_regprocedure('public.abc_cancelar_apertura_caja(text,text,text,uuid,text,uuid,date)') is not null
     or exists(select 1 from pg_constraint where conname='abc_sesion_apertura_tiempos')
     or exists(select 1 from pg_indexes where schemaname='public' and indexname='abc_terminal_una_sesion_activa_uq') then
    raise exception 'ABC_F2_M04A_PREFLIGHT_FALLO: objetos M04A ya existen';
  end if;

  if exists(
    select 1
      from public.caja_sesion_terminales
     where hasta is null
     group by terminal_id
    having count(*)>1
  ) then
    raise exception 'ABC_F2_M04A_PREFLIGHT_FALLO: terminal activo en multiples sesiones';
  end if;
end $$;

create table public.caja_sesion_responsables (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  session_id uuid not null,
  user_id uuid not null references auth.users(id) on delete restrict,
  desde timestamptz not null default now(),
  hasta timestamptz,
  asignado_por uuid not null references auth.users(id) on delete restrict,
  motivo text not null,
  created_at timestamptz not null default now(),
  constraint abc_sesion_responsable_sesion_fk
    foreign key (empresa_id,local_id,session_id)
    references public.caja_sesiones(empresa_id,local_id,id)
    on delete restrict,
  constraint abc_sesion_responsable_rango
    check (hasta is null or hasta>desde),
  constraint abc_sesion_responsable_motivo
    check (nullif(btrim(motivo),'') is not null)
);

create unique index abc_sesion_responsable_activo_uq
  on public.caja_sesion_responsables(session_id)
  where hasta is null;

create index abc_sesion_responsable_scope_idx
  on public.caja_sesion_responsables(empresa_id,local_id,session_id,desde);

create unique index abc_terminal_una_sesion_activa_uq
  on public.caja_sesion_terminales(terminal_id)
  where hasta is null;

alter table public.caja_sesiones
  add constraint abc_sesion_apertura_tiempos
  check (
    (
      estado in ('PREPARANDO_APERTURA','APERTURA_CANCELADA')
      and abierta_at is null
    )
    or
    (
      estado in ('ABIERTA','EN_CIERRE','CIERRE_PROVISIONAL','CERRADA_FINAL')
      and abierta_at is not null
    )
  );

alter table public.caja_sesion_responsables enable row level security;

create policy abc_caja_sesion_responsable_select
on public.caja_sesion_responsables
for select
to authenticated
using (private.la_tiene_local(empresa_id,local_id));

revoke all on table public.caja_sesion_responsables from public,anon,authenticated;
grant select on table public.caja_sesion_responsables to authenticated;

create function private.abc_usuario_activo_local(
  p_empresa_id text,
  p_local_id text,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select p_user_id is not null
     and exists(
       select 1
         from public.membresias_usuario m
        where m.user_id=p_user_id
          and m.empresa_id=p_empresa_id
          and m.activo=true
          and (
            (m.todos_locales=false and m.local_id=p_local_id)
            or (m.todos_locales=true and m.local_id is null)
          )
     )
$$;

create function public.abc_abrir_sesion_caja(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_session_id uuid,
  p_caja_id uuid,
  p_responsable_user_id uuid,
  p_terminal_id uuid,
  p_currency_code text,
  p_fondo_inicial numeric,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_request jsonb;
  v_cmd jsonb;
  v_currency text:=upper(btrim(coalesce(p_currency_code,'')));
  v_fondo numeric(24,8);
  v_cash_operation_id text;
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR') then
    raise exception 'abc_caja_no_autorizado';
  end if;

  if p_session_id is null or p_caja_id is null or p_responsable_user_id is null
     or p_terminal_id is null or p_operating_day is null then
    raise exception 'apertura_caja_parametros_requeridos';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'moneda_caja_invalida'; end if;
  if p_fondo_inicial is null or p_fondo_inicial<0 then raise exception 'fondo_inicial_invalido'; end if;
  if p_fondo_inicial<>round(p_fondo_inicial,8) then raise exception 'fondo_inicial_precision_invalida'; end if;
  if not private.abc_usuario_activo_local(p_empresa_id,p_local_id,p_responsable_user_id) then
    raise exception 'responsable_caja_no_pertenece_local';
  end if;

  v_fondo:=p_fondo_inicial::numeric(24,8);
  v_request:=jsonb_build_object(
    'session_id',p_session_id,
    'caja_id',p_caja_id,
    'responsable_user_id',p_responsable_user_id,
    'terminal_id',p_terminal_id,
    'currency_code',v_currency,
    'fondo_inicial',v_fondo,
    'operating_day',p_operating_day
  );

  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,
    'ABC_ABRIR_SESION_CAJA',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  perform 1
    from public.cajas_fisicas c
   where c.empresa_id=p_empresa_id
     and c.local_id=p_local_id
     and c.id=p_caja_id
     and c.activo=true
   for update;
  if not found then raise exception 'caja_fisica_no_disponible'; end if;

  if exists(
    select 1
      from public.caja_sesiones s
     where s.empresa_id=p_empresa_id
       and s.local_id=p_local_id
       and s.caja_id=p_caja_id
       and s.estado in ('PREPARANDO_APERTURA','ABIERTA','EN_CIERRE','CIERRE_PROVISIONAL')
  ) then
    raise exception 'caja_con_sesion_activa';
  end if;

  perform 1
    from public.terminales_tpv t
   where t.empresa_id=p_empresa_id
     and t.local_id=p_local_id
     and t.id=p_terminal_id
     and t.activo=true
   for update;
  if not found then raise exception 'terminal_no_disponible'; end if;

  if exists(
    select 1
      from public.caja_sesion_terminales st
     where st.terminal_id=p_terminal_id
       and st.hasta is null
  ) then
    raise exception 'terminal_ya_vinculado_otra_sesion';
  end if;

  insert into public.caja_sesiones(
    id,empresa_id,local_id,caja_id,estado,version,
    abierta_at,abierta_por
  ) values (
    p_session_id,p_empresa_id,p_local_id,p_caja_id,'ABIERTA',1,
    now(),auth.uid()
  );

  insert into public.caja_sesion_terminales(
    empresa_id,local_id,session_id,terminal_id,desde
  ) values (
    p_empresa_id,p_local_id,p_session_id,p_terminal_id,now()
  );

  insert into public.caja_sesion_responsables(
    empresa_id,local_id,session_id,user_id,desde,asignado_por,motivo
  ) values (
    p_empresa_id,p_local_id,p_session_id,p_responsable_user_id,
    now(),auth.uid(),'APERTURA'
  );

  if v_fondo>0 then
    v_cash_operation_id:='abc.cash.open.'||
      private.abc_request_hash(
        jsonb_build_object(
          'command',p_operation_id,
          'session_id',p_session_id,
          'currency_code',v_currency
        )
      );

    insert into public.caja_operaciones(
      operation_id,tipo,empresa_id,local_id,fecha,importe,efecto_efectivo,
      medio_pago,concepto,origen_tipo,origen_id,payload,actor_user_id,
      abc_command_id,caja_id,session_id,terminal_id,currency_code,
      operating_day,occurred_at,categoria
    ) values (
      v_cash_operation_id,'ENTRADA',p_empresa_id,p_local_id,p_operating_day,
      v_fondo,v_fondo,'EFECTIVO','Fondo inicial de sesion ABC',
      'ABC_CAJA_SESION',p_session_id::text,
      jsonb_build_object(
        'session_id',p_session_id,
        'responsable_user_id',p_responsable_user_id,
        'fondo_inicial',v_fondo,
        'currency_code',v_currency
      ),
      auth.uid(),p_operation_id,p_caja_id,p_session_id,p_terminal_id,
      v_currency,p_operating_day,now(),'FONDO_INICIAL'
    );
  end if;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'CAJA_SESION',p_session_id::text,
    'CAJA_SESION_ABIERTA',
    jsonb_build_object(
      'caja_id',p_caja_id,
      'responsable_user_id',p_responsable_user_id,
      'terminal_id',p_terminal_id,
      'fondo_inicial',v_fondo,
      'currency_code',v_currency,
      'caja_operation_id',v_cash_operation_id
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,
    'session_id',p_session_id,
    'estado','ABIERTA',
    'caja_id',p_caja_id,
    'responsable_user_id',p_responsable_user_id,
    'terminal_id',p_terminal_id,
    'fondo_inicial',v_fondo,
    'currency_code',v_currency,
    'caja_operation_id',v_cash_operation_id
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_vincular_terminal_caja(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_session_id uuid,
  p_terminal_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_request jsonb;
  v_cmd jsonb;
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR') then
    raise exception 'abc_caja_no_autorizado';
  end if;
  if p_session_id is null or p_terminal_id is null or p_operating_day is null then
    raise exception 'vinculo_terminal_parametros_requeridos';
  end if;

  v_request:=jsonb_build_object(
    'session_id',p_session_id,
    'terminal_id',p_terminal_id,
    'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,
    'ABC_VINCULAR_TERMINAL_CAJA',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  perform 1
    from public.caja_sesiones s
   where s.empresa_id=p_empresa_id
     and s.local_id=p_local_id
     and s.id=p_session_id
     and s.estado='ABIERTA'
   for update;
  if not found then raise exception 'sesion_caja_no_abierta'; end if;

  perform 1
    from public.terminales_tpv t
   where t.empresa_id=p_empresa_id
     and t.local_id=p_local_id
     and t.id=p_terminal_id
     and t.activo=true
   for update;
  if not found then raise exception 'terminal_no_disponible'; end if;

  if exists(
    select 1 from public.caja_sesion_terminales st
     where st.terminal_id=p_terminal_id and st.hasta is null
  ) then
    raise exception 'terminal_ya_vinculado_otra_sesion';
  end if;

  insert into public.caja_sesion_terminales(
    empresa_id,local_id,session_id,terminal_id,desde
  ) values (
    p_empresa_id,p_local_id,p_session_id,p_terminal_id,now()
  );

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'CAJA_SESION',p_session_id::text,
    'CAJA_TERMINAL_VINCULADO',
    jsonb_build_object('terminal_id',p_terminal_id),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'session_id',p_session_id,'terminal_id',p_terminal_id,'vinculado',true
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_desvincular_terminal_caja(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_session_id uuid,
  p_terminal_id uuid,
  p_motivo text,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_request jsonb;
  v_cmd jsonb;
  v_motivo text:=btrim(coalesce(p_motivo,''));
  v_link_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR') then
    raise exception 'abc_caja_no_autorizado';
  end if;
  if p_session_id is null or p_terminal_id is null or p_operating_day is null then
    raise exception 'desvinculo_terminal_parametros_requeridos';
  end if;
  if v_motivo='' then raise exception 'motivo_desvinculo_requerido'; end if;

  v_request:=jsonb_build_object(
    'session_id',p_session_id,'terminal_id',p_terminal_id,
    'motivo',v_motivo,'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,
    'ABC_DESVINCULAR_TERMINAL_CAJA',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  perform 1
    from public.caja_sesiones s
   where s.empresa_id=p_empresa_id
     and s.local_id=p_local_id
     and s.id=p_session_id
     and s.estado='ABIERTA'
   for update;
  if not found then raise exception 'sesion_caja_no_abierta'; end if;

  select st.id
    into v_link_id
    from public.caja_sesion_terminales st
   where st.empresa_id=p_empresa_id
     and st.local_id=p_local_id
     and st.session_id=p_session_id
     and st.terminal_id=p_terminal_id
     and st.hasta is null
   for update;
  if not found then raise exception 'terminal_no_vinculado_sesion'; end if;

  update public.caja_sesion_terminales
     set hasta=now()
   where id=v_link_id;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'CAJA_SESION',p_session_id::text,
    'CAJA_TERMINAL_DESVINCULADO',
    jsonb_build_object('terminal_id',p_terminal_id,'motivo',v_motivo),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'session_id',p_session_id,'terminal_id',p_terminal_id,'vinculado',false
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_cambiar_responsable_caja(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_session_id uuid,
  p_nuevo_responsable_user_id uuid,
  p_motivo text,
  p_terminal_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_request jsonb;
  v_cmd jsonb;
  v_motivo text:=btrim(coalesce(p_motivo,''));
  v_actual_id uuid;
  v_actual_user uuid;
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR') then
    raise exception 'abc_caja_no_autorizado';
  end if;
  if p_session_id is null or p_nuevo_responsable_user_id is null
     or p_terminal_id is null or p_operating_day is null then
    raise exception 'relevo_caja_parametros_requeridos';
  end if;
  if v_motivo='' then raise exception 'motivo_relevo_requerido'; end if;
  if not private.abc_usuario_activo_local(
    p_empresa_id,p_local_id,p_nuevo_responsable_user_id
  ) then
    raise exception 'responsable_caja_no_pertenece_local';
  end if;

  v_request:=jsonb_build_object(
    'session_id',p_session_id,
    'nuevo_responsable_user_id',p_nuevo_responsable_user_id,
    'motivo',v_motivo,
    'terminal_id',p_terminal_id,
    'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,
    'ABC_CAMBIAR_RESPONSABLE_CAJA',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  perform 1
    from public.caja_sesiones s
   where s.empresa_id=p_empresa_id
     and s.local_id=p_local_id
     and s.id=p_session_id
     and s.estado='ABIERTA'
   for update;
  if not found then raise exception 'sesion_caja_no_abierta'; end if;

  if not exists(
    select 1 from public.caja_sesion_terminales st
     where st.empresa_id=p_empresa_id
       and st.local_id=p_local_id
       and st.session_id=p_session_id
       and st.terminal_id=p_terminal_id
       and st.hasta is null
  ) then
    raise exception 'terminal_no_vinculado_sesion';
  end if;

  select r.id,r.user_id
    into v_actual_id,v_actual_user
    from public.caja_sesion_responsables r
   where r.empresa_id=p_empresa_id
     and r.local_id=p_local_id
     and r.session_id=p_session_id
     and r.hasta is null
   for update;
  if not found then raise exception 'sesion_sin_responsable_activo'; end if;
  if v_actual_user=p_nuevo_responsable_user_id then
    raise exception 'responsable_ya_activo';
  end if;

  update public.caja_sesion_responsables
     set hasta=now()
   where id=v_actual_id;

  insert into public.caja_sesion_responsables(
    empresa_id,local_id,session_id,user_id,desde,asignado_por,motivo
  ) values (
    p_empresa_id,p_local_id,p_session_id,p_nuevo_responsable_user_id,
    now(),auth.uid(),v_motivo
  );

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'CAJA_SESION',p_session_id::text,
    'CAJA_RESPONSABLE_CAMBIADO',
    jsonb_build_object(
      'responsable_anterior_user_id',v_actual_user,
      'responsable_nuevo_user_id',p_nuevo_responsable_user_id,
      'motivo',v_motivo
    ),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'session_id',p_session_id,
    'responsable_anterior_user_id',v_actual_user,
    'responsable_nuevo_user_id',p_nuevo_responsable_user_id
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

create function public.abc_cancelar_apertura_caja(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_session_id uuid,
  p_motivo text,
  p_terminal_id uuid,
  p_operating_day date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_request jsonb;
  v_cmd jsonb;
  v_motivo text:=btrim(coalesce(p_motivo,''));
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR') then
    raise exception 'abc_caja_no_autorizado';
  end if;
  if p_session_id is null or p_operating_day is null then
    raise exception 'cancelacion_apertura_parametros_requeridos';
  end if;
  if v_motivo='' then raise exception 'motivo_cancelacion_apertura_requerido'; end if;

  v_request:=jsonb_build_object(
    'session_id',p_session_id,'motivo',v_motivo,
    'terminal_id',p_terminal_id,'operating_day',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,
    'ABC_CANCELAR_APERTURA_CAJA',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  perform 1
    from public.caja_sesiones s
   where s.empresa_id=p_empresa_id
     and s.local_id=p_local_id
     and s.id=p_session_id
     and s.estado='PREPARANDO_APERTURA'
   for update;
  if not found then raise exception 'apertura_no_cancelable'; end if;

  if exists(
    select 1 from public.caja_operaciones co
     where co.empresa_id=p_empresa_id
       and co.local_id=p_local_id
       and co.session_id=p_session_id
  ) then
    raise exception 'apertura_con_movimientos_no_cancelable';
  end if;

  update public.caja_sesion_terminales
     set hasta=now()
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and session_id=p_session_id
     and hasta is null;

  update public.caja_sesion_responsables
     set hasta=now()
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and session_id=p_session_id
     and hasta is null;

  update public.caja_sesiones
     set estado='APERTURA_CANCELADA',
         cerrada_at=now(),
         version=version+1
   where empresa_id=p_empresa_id
     and local_id=p_local_id
     and id=p_session_id;

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'CAJA_SESION',p_session_id::text,
    'CAJA_APERTURA_CANCELADA',
    jsonb_build_object('motivo',v_motivo),
    auth.uid(),p_terminal_id,now(),p_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,'session_id',p_session_id,'estado','APERTURA_CANCELADA'
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

revoke all on function private.abc_usuario_activo_local(text,text,uuid)
  from public,anon,authenticated,service_role;

revoke all on function public.abc_abrir_sesion_caja(
  text,text,text,uuid,uuid,uuid,uuid,text,numeric,date
) from public,anon,authenticated,service_role;
revoke all on function public.abc_vincular_terminal_caja(
  text,text,text,uuid,uuid,date
) from public,anon,authenticated,service_role;
revoke all on function public.abc_desvincular_terminal_caja(
  text,text,text,uuid,uuid,text,date
) from public,anon,authenticated,service_role;
revoke all on function public.abc_cambiar_responsable_caja(
  text,text,text,uuid,uuid,text,uuid,date
) from public,anon,authenticated,service_role;
revoke all on function public.abc_cancelar_apertura_caja(
  text,text,text,uuid,text,uuid,date
) from public,anon,authenticated,service_role;

grant execute on function public.abc_abrir_sesion_caja(
  text,text,text,uuid,uuid,uuid,uuid,text,numeric,date
) to authenticated;
grant execute on function public.abc_vincular_terminal_caja(
  text,text,text,uuid,uuid,date
) to authenticated;
grant execute on function public.abc_desvincular_terminal_caja(
  text,text,text,uuid,uuid,text,date
) to authenticated;
grant execute on function public.abc_cambiar_responsable_caja(
  text,text,text,uuid,uuid,text,uuid,date
) to authenticated;
grant execute on function public.abc_cancelar_apertura_caja(
  text,text,text,uuid,text,uuid,date
) to authenticated;
