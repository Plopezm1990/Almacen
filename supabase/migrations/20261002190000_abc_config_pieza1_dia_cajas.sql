-- ABC · capa de configuración por empresa y local, PIEZA 1 (solo QA hasta que Pedro autorice otra cosa).
--
-- Decisiones de Pedro (2/10/2026, hoja F1): D03 «10 cajas abiertas a la vez por local», D06 «corte del día
-- a las 00:00, configurable por local», configuración por el propietario de cada empresa. Inventario en
-- docs/plan-abc/F6_INVENTARIO_CAPA_CONFIGURACION_2026-10-02.md.
--
-- Qué hace (aditiva; sin tocar datos existentes al aplicar):
--  1. `abc_config_ajustes`: ajustes por local (hoy solo `cajas_abiertas_max`, entero 1..10, 10 por defecto).
--     Sin acceso directo (RLS sin políticas y sin permisos de tabla): solo por las funciones de abajo.
--  2. `abc_configurar_ajuste` (propietario del local; operation_id idempotente; evento en `abc_eventos`) y
--     `abc_obtener_ajustes` (cualquier miembro del local; devuelve también la regla vigente del día operativo).
--  3. `abc_configurar_dia_operativo`: crea una regla NUEVA (versión siguiente) del corte del día y cierra la
--     vigente. Valores por defecto: Europe/Madrid y 00:00. El cambio rige desde `p_vigente_desde` (por
--     defecto, la próxima medianoche local) y siempre en el futuro; la primera regla de un local rige desde
--     2000-01-01 (sin regla no se pudo registrar nada). Corte permitido de 00:00 a 12:00.
--  4. `abc_abrir_sesion_caja`: rechaza la apertura (`caja_limite_sesiones_alcanzado`) si el local ya tiene
--     `cajas_abiertas_max` cajas ocupadas. Cuentan como ocupadas las mismas cuatro situaciones que el índice
--     «una sesión activa por caja» (PREPARANDO_APERTURA, ABIERTA, EN_CIERRE, CIERRE_PROVISIONAL). Bajar el
--     límite no cierra sesiones ya abiertas: solo bloquea aperturas nuevas.
--
-- NO cambia: el resolver del día operativo (un local sin regla sigue fallando de forma explícita, como exige
-- A11), la política de descuentos (el 20 % por defecto del encargado está en los contratos A09; ver informe),
-- ni ningún permiso por rol (pieza de permisos aparte).

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.locales') is null then v_missing:=array_append(v_missing,'locales'); end if;
  if to_regclass('public.empresas') is null then v_missing:=array_append(v_missing,'empresas'); end if;
  if to_regclass('public.membresias_usuario') is null then v_missing:=array_append(v_missing,'membresias_usuario'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regclass('public.caja_sesiones') is null then v_missing:=array_append(v_missing,'caja_sesiones'); end if;
  if to_regclass('private.abc_operating_day_reglas') is null then v_missing:=array_append(v_missing,'abc_operating_day_reglas'); end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then v_missing:=array_append(v_missing,'abc_operacion_iniciar'); end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then v_missing:=array_append(v_missing,'abc_operacion_completar'); end if;
  if to_regprocedure('private.abc_resolver_operating_day_contexto(text,text,timestamp with time zone)') is null then v_missing:=array_append(v_missing,'abc_resolver_operating_day_contexto'); end if;
  if to_regprocedure('private.la_tiene_local(text,text)') is null then v_missing:=array_append(v_missing,'la_tiene_local'); end if;
  if to_regprocedure('auth.uid()') is null then v_missing:=array_append(v_missing,'auth.uid'); end if;
  if to_regprocedure('public.abc_abrir_sesion_caja(text,text,text,uuid,uuid,uuid,uuid,text,numeric,date)') is null then v_missing:=array_append(v_missing,'abc_abrir_sesion_caja'); end if;

  if cardinality(v_missing)>0 then
    raise exception 'ABC_CFG1_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  -- Solo se parchea la función tal y como la dejó M04a (mismo texto, comprobado por hash).
  if (select md5(p.prosrc) from pg_proc p
       where p.oid='public.abc_abrir_sesion_caja(text,text,text,uuid,uuid,uuid,uuid,text,numeric,date)'::regprocedure)
     <> '416d085f933f188e1581d6087cece61d' then
    raise exception 'ABC_CFG1_PREFLIGHT_FALLO: abc_abrir_sesion_caja no coincide con la versión M04a esperada';
  end if;

  if to_regclass('public.abc_config_ajustes') is not null
     or to_regprocedure('public.abc_configurar_ajuste(text,text,text,text,jsonb,text)') is not null
     or to_regprocedure('public.abc_configurar_dia_operativo(text,text,text,text,time without time zone,timestamp with time zone,text)') is not null then
    raise exception 'ABC_CFG1_PREFLIGHT_FALLO: objetos de la pieza 1 ya existen';
  end if;
end $$;

-- 1. Ajustes por local.
create table public.abc_config_ajustes (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null references public.empresas(id) on delete restrict,
  local_id text not null,
  clave text not null,
  valor jsonb not null,
  version bigint not null default 1,
  motivo text not null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint abc_config_ajuste_local_fk foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint abc_config_ajuste_clave check (clave in ('cajas_abiertas_max')),
  constraint abc_config_ajuste_motivo check (nullif(btrim(motivo),'') is not null),
  constraint abc_config_ajuste_version check (version>=1),
  constraint abc_config_ajuste_valor check (
    case clave
      when 'cajas_abiertas_max' then
        case when jsonb_typeof(valor)='number'
          then (valor#>>'{}')::numeric between 1 and 10
               and (valor#>>'{}')::numeric=trunc((valor#>>'{}')::numeric)
          else false end
      else false
    end
  ),
  constraint abc_config_ajuste_uq unique (empresa_id,local_id,clave)
);

alter table public.abc_config_ajustes enable row level security;
revoke all on table public.abc_config_ajustes from public,anon,authenticated,service_role;

comment on table public.abc_config_ajustes is
  'Ajustes por empresa y local (capa de configuración, pieza 1). Sin acceso directo: se lee con abc_obtener_ajustes y se escribe con abc_configurar_ajuste.';

-- 2. Ayudas privadas.
create function private.abc_config_puede_configurar(
  p_empresa_id text,
  p_local_id text
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_rol text;
begin
  if auth.uid() is null then return false; end if;
  if nullif(btrim(coalesce(p_empresa_id,'')),'') is null
     or nullif(btrim(coalesce(p_local_id,'')),'') is null then
    return false;
  end if;
  if not coalesce(private.la_tiene_local(p_empresa_id,p_local_id),false) then return false; end if;

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

  return coalesce(v_rol,'')='Propietario';
end $$;

create function private.abc_ajuste_cajas_max(
  p_empresa_id text,
  p_local_id text
)
returns integer
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(
    (select (a.valor#>>'{}')::integer
       from public.abc_config_ajustes a
      where a.empresa_id=p_empresa_id
        and a.local_id=p_local_id
        and a.clave='cajas_abiertas_max'),
    10
  )
$$;

-- Día que se anota en los eventos de configuración: el operativo si el local tiene regla; si no, el
-- día natural en Europe/Madrid (los eventos exigen una fecha y la primera regla aún no existe).
create function private.abc_config_dia_evento(
  p_empresa_id text,
  p_local_id text
)
returns date
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  return (private.abc_resolver_operating_day_contexto(p_empresa_id,p_local_id,now())->>'operating_day')::date;
exception when others then
  return (now() at time zone 'Europe/Madrid')::date;
end $$;

-- 3. Configurar un ajuste de un local.
create function public.abc_configurar_ajuste(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_clave text,
  p_valor jsonb,
  p_motivo text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_clave text:=btrim(coalesce(p_clave,''));
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
  v_valor numeric;
  v_request jsonb;
  v_cmd jsonb;
  v_prev public.abc_config_ajustes%rowtype;
  v_found boolean;
  v_version bigint;
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_config_puede_configurar(p_empresa_id,p_local_id) then
    raise exception 'abc_config_no_autorizado';
  end if;
  if v_clave<>'cajas_abiertas_max' then raise exception 'ajuste_clave_invalida'; end if;
  if p_valor is null or jsonb_typeof(p_valor)<>'number' then raise exception 'ajuste_valor_invalido'; end if;
  v_valor:=(p_valor#>>'{}')::numeric;
  if v_valor<>trunc(v_valor) or v_valor<1 or v_valor>10 then raise exception 'ajuste_valor_fuera_de_rango'; end if;
  if v_motivo is null then raise exception 'ajuste_motivo_requerido'; end if;

  v_request:=jsonb_build_object('clave',v_clave,'valor',v_valor,'motivo',v_motivo);
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIGURAR_AJUSTE',v_request,null
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  perform pg_advisory_xact_lock(hashtext('abc_ajuste:'||p_empresa_id||'/'||p_local_id||'/'||v_clave));

  select * into v_prev
    from public.abc_config_ajustes a
   where a.empresa_id=p_empresa_id and a.local_id=p_local_id and a.clave=v_clave
   for update;
  v_found:=found;

  if v_found and (v_prev.valor#>>'{}')::numeric=v_valor then
    v_result:=jsonb_build_object('ok',true,'clave',v_clave,'valor',v_valor::integer,
      'version',v_prev.version,'cambio',false,'origen','local');
  else
    if v_found then
      update public.abc_config_ajustes
         set valor=to_jsonb(v_valor::integer), version=version+1, motivo=v_motivo,
             updated_by=auth.uid(), updated_at=now()
       where id=v_prev.id
      returning version into v_version;
    else
      insert into public.abc_config_ajustes(empresa_id,local_id,clave,valor,version,motivo,updated_by)
      values (p_empresa_id,p_local_id,v_clave,to_jsonb(v_valor::integer),1,v_motivo,auth.uid());
      v_version:=1;
    end if;

    insert into public.abc_eventos(
      empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
      payload,actor_user_id,terminal_id,occurred_at,operating_day
    ) values (
      p_empresa_id,p_local_id,p_operation_id,'LOCAL_CONFIG',v_clave,'AJUSTE_CONFIGURADO',
      jsonb_build_object(
        'clave',v_clave,
        'anterior',case when v_found then v_prev.valor else null end,
        'nuevo',to_jsonb(v_valor::integer),
        'version',v_version,
        'motivo',v_motivo
      ),
      auth.uid(),null,now(),private.abc_config_dia_evento(p_empresa_id,p_local_id)
    );

    v_result:=jsonb_build_object('ok',true,'clave',v_clave,'valor',v_valor::integer,
      'version',v_version,'cambio',true,'origen','local');
  end if;

  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

-- 4. Leer los ajustes efectivos de un local (y la regla vigente del día operativo).
create function public.abc_obtener_ajustes(
  p_empresa_id text,
  p_local_id text
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
    'cajas_abiertas_max',
    coalesce(
      (select jsonb_build_object('valor',a.valor,'origen','local','version',a.version)
         from public.abc_config_ajustes a
        where a.empresa_id=p_empresa_id and a.local_id=p_local_id and a.clave='cajas_abiertas_max'),
      jsonb_build_object('valor',10,'origen','defecto','version',0)
    ),
    'dia_operativo',
    (select jsonb_build_object(
              'timezone_name',r.timezone_name,'cutoff_time',r.cutoff_time,
              'vigente_desde',r.vigente_desde,'version',r.version)
       from private.abc_operating_day_reglas r
      where r.empresa_id=p_empresa_id and r.local_id=p_local_id and r.vigente_hasta is null)
  );
end $$;

-- 5. Corte del día operativo de un local (regla versionada).
create function public.abc_configurar_dia_operativo(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_timezone_name text default null,
  p_cutoff_time time without time zone default null,
  p_vigente_desde timestamp with time zone default null,
  p_motivo text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_tz text:=coalesce(nullif(btrim(coalesce(p_timezone_name,'')),''),'Europe/Madrid');
  v_cutoff time without time zone:=coalesce(p_cutoff_time,time '00:00');
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
  v_prev private.abc_operating_day_reglas%rowtype;
  v_hasta_historico timestamp with time zone;
  v_desde timestamp with time zone;
  v_version integer;
  v_request jsonb;
  v_cmd jsonb;
  v_result jsonb;
  v_found boolean;
begin
  if auth.uid() is null
     or not private.abc_config_puede_configurar(p_empresa_id,p_local_id) then
    raise exception 'abc_config_no_autorizado';
  end if;
  if v_motivo is null then raise exception 'dia_operativo_motivo_requerido'; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names tz where tz.name=v_tz) then
    raise exception 'dia_operativo_timezone_invalida';
  end if;
  if v_cutoff>time '12:00' then raise exception 'dia_operativo_corte_fuera_de_rango'; end if;
  if not exists(
    select 1 from public.locales l
     where l.empresa_id=p_empresa_id and l.id=p_local_id and l.activo=true
  ) then
    raise exception 'dia_operativo_local_no_disponible';
  end if;

  v_request:=jsonb_build_object(
    'timezone_name',v_tz,'cutoff_time',v_cutoff,'vigente_desde',p_vigente_desde,'motivo',v_motivo
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_CONFIGURAR_DIA_OPERATIVO',v_request,null
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  perform pg_advisory_xact_lock(hashtext('abc_dia_operativo:'||p_empresa_id||'/'||p_local_id));

  select * into v_prev
    from private.abc_operating_day_reglas r
   where r.empresa_id=p_empresa_id and r.local_id=p_local_id and r.vigente_hasta is null
   for update;
  v_found:=found;

  if v_found then
    if v_prev.timezone_name=v_tz and v_prev.cutoff_time=v_cutoff then
      v_result:=jsonb_build_object('ok',true,'cambio',false,'timezone_name',v_tz,'cutoff_time',v_cutoff,
        'version',v_prev.version,'vigente_desde',v_prev.vigente_desde);
      perform private.abc_operacion_completar(p_operation_id,v_result);
      return v_result;
    end if;
    v_desde:=coalesce(
      p_vigente_desde,
      (((now() at time zone v_prev.timezone_name)::date+1)::timestamp at time zone v_prev.timezone_name)
    );
    if v_desde<=now() then raise exception 'dia_operativo_vigencia_pasada'; end if;
    if v_desde<=v_prev.vigente_desde then raise exception 'dia_operativo_vigencia_incoherente'; end if;
    update private.abc_operating_day_reglas set vigente_hasta=v_desde where id=v_prev.id;
  else
    select max(r.vigente_hasta) into v_hasta_historico
      from private.abc_operating_day_reglas r
     where r.empresa_id=p_empresa_id and r.local_id=p_local_id;
    v_desde:=coalesce(p_vigente_desde,v_hasta_historico,timestamp with time zone '2000-01-01 00:00:00+00');
    if v_hasta_historico is not null and v_desde<v_hasta_historico then
      raise exception 'dia_operativo_vigencia_incoherente';
    end if;
  end if;

  select coalesce(max(r.version),0)+1 into v_version
    from private.abc_operating_day_reglas r
   where r.empresa_id=p_empresa_id and r.local_id=p_local_id;

  insert into private.abc_operating_day_reglas(
    empresa_id,local_id,version,timezone_name,cutoff_time,vigente_desde,vigente_hasta,motivo,created_by
  ) values (
    p_empresa_id,p_local_id,v_version,v_tz,v_cutoff,v_desde,null,v_motivo,auth.uid()
  );

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'LOCAL_CONFIG','dia_operativo','DIA_OPERATIVO_REGLA_CAMBIADA',
    jsonb_build_object(
      'anterior',case when v_found then jsonb_build_object(
        'version',v_prev.version,'timezone_name',v_prev.timezone_name,'cutoff_time',v_prev.cutoff_time,
        'vigente_hasta',v_desde) else null end,
      'nueva',jsonb_build_object(
        'version',v_version,'timezone_name',v_tz,'cutoff_time',v_cutoff,'vigente_desde',v_desde),
      'motivo',v_motivo
    ),
    auth.uid(),null,now(),private.abc_config_dia_evento(p_empresa_id,p_local_id)
  );

  v_result:=jsonb_build_object('ok',true,'cambio',true,'timezone_name',v_tz,'cutoff_time',v_cutoff,
    'version',v_version,'vigente_desde',v_desde);
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

-- 6. Límite de cajas abiertas en la apertura de sesión (M04a + límite).
create or replace function public.abc_abrir_sesion_caja(
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

  -- Limite de cajas abiertas a la vez por local (decision D03; ajuste `cajas_abiertas_max`, 10 por
  -- defecto). El cerrojo serializa las aperturas del mismo local para que dos aperturas simultaneas
  -- no superen el limite.
  perform pg_advisory_xact_lock(hashtext('abc_cajas_abiertas:'||p_empresa_id||'/'||p_local_id));

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

  if (
    select count(*)
      from public.caja_sesiones s
     where s.empresa_id=p_empresa_id
       and s.local_id=p_local_id
       and s.estado in ('PREPARANDO_APERTURA','ABIERTA','EN_CIERRE','CIERRE_PROVISIONAL')
  ) >= private.abc_ajuste_cajas_max(p_empresa_id,p_local_id) then
    raise exception 'caja_limite_sesiones_alcanzado';
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

revoke all on function private.abc_config_puede_configurar(text,text) from public,anon,authenticated,service_role;
revoke all on function private.abc_ajuste_cajas_max(text,text) from public,anon,authenticated,service_role;
revoke all on function private.abc_config_dia_evento(text,text) from public,anon,authenticated,service_role;
revoke all on function public.abc_configurar_ajuste(text,text,text,text,jsonb,text)
  from public,anon,authenticated,service_role;
revoke all on function public.abc_obtener_ajustes(text,text)
  from public,anon,authenticated,service_role;
revoke all on function public.abc_configurar_dia_operativo(text,text,text,text,time without time zone,timestamp with time zone,text)
  from public,anon,authenticated,service_role;
revoke all on function public.abc_abrir_sesion_caja(
  text,text,text,uuid,uuid,uuid,uuid,text,numeric,date
) from public,anon,authenticated,service_role;
grant execute on function public.abc_configurar_ajuste(text,text,text,text,jsonb,text) to authenticated;
grant execute on function public.abc_obtener_ajustes(text,text) to authenticated;
grant execute on function public.abc_configurar_dia_operativo(text,text,text,text,time without time zone,timestamp with time zone,text) to authenticated;
grant execute on function public.abc_abrir_sesion_caja(
  text,text,text,uuid,uuid,uuid,uuid,text,numeric,date
) to authenticated;
