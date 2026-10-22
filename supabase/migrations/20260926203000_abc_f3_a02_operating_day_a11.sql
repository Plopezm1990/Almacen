-- ABC F3 A02.1 P06 — operating_day autoritativo según A11.
-- Aditiva. No inserta configuración real, no cobra, no mueve stock y no despliega frontend.
-- Mantiene la firma pública de abc_abrir_cuenta para compatibilidad, pero el día operativo
-- deja de ser autoridad del cliente: el servidor lo deriva de una regla versionada por local.

do $$
declare
  v_missing text[]:=array[]::text[];
begin
  if to_regclass('public.locales') is null then v_missing:=array_append(v_missing,'locales'); end if;
  if to_regclass('public.cuentas_comerciales') is null then v_missing:=array_append(v_missing,'cuentas_comerciales'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing:=array_append(v_missing,'abc_eventos'); end if;
  if to_regprocedure('public.abc_abrir_cuenta(text,text,text,uuid,text,text,uuid,uuid,uuid,date)') is null then
    v_missing:=array_append(v_missing,'abc_abrir_cuenta');
  end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then
    v_missing:=array_append(v_missing,'abc_tiene_capacidad');
  end if;
  if to_regprocedure('private.abc_terminal_sesion_operativa(text,text,uuid,uuid)') is null then
    v_missing:=array_append(v_missing,'abc_terminal_sesion_operativa');
  end if;
  if to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null then
    v_missing:=array_append(v_missing,'abc_operacion_iniciar');
  end if;
  if to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null then
    v_missing:=array_append(v_missing,'abc_operacion_completar');
  end if;

  if cardinality(v_missing)>0 then
    raise exception 'ABC_F3_A02_P06_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  if to_regclass('private.abc_operating_day_reglas') is not null
     or exists(
       select 1
       from pg_proc p
       join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='private'
         and p.proname='abc_resolver_operating_day_contexto'
     ) then
    raise exception 'ABC_F3_A02_P06_PREFLIGHT_FALLO: objetos P06 ya existen';
  end if;
end $$;

create table private.abc_operating_day_reglas (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  version bigint not null,
  timezone_name text not null,
  cutoff_time time without time zone not null,
  vigente_desde timestamptz not null,
  vigente_hasta timestamptz,
  motivo text not null default 'CONFIGURACION',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint abc_operating_day_regla_local_fk
    foreign key (empresa_id,local_id)
    references public.locales(empresa_id,id) on delete restrict,
  constraint abc_operating_day_regla_version
    check (version>=1),
  constraint abc_operating_day_regla_timezone
    check (nullif(btrim(timezone_name),'') is not null),
  constraint abc_operating_day_regla_vigencia
    check (vigente_hasta is null or vigente_hasta>vigente_desde),
  constraint abc_operating_day_regla_motivo
    check (nullif(btrim(motivo),'') is not null),
  unique (empresa_id,local_id,version)
);

create unique index abc_operating_day_regla_actual_uq
  on private.abc_operating_day_reglas(empresa_id,local_id)
  where vigente_hasta is null;

create index abc_operating_day_regla_lookup_idx
  on private.abc_operating_day_reglas(
    empresa_id,local_id,vigente_desde desc,vigente_hasta
  );

revoke all on table private.abc_operating_day_reglas
from public,anon,authenticated;

create function private.abc_resolver_operating_day_contexto(
  p_empresa_id text,
  p_local_id text,
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_count integer;
  v_rule private.abc_operating_day_reglas%rowtype;
  v_local_ts timestamp without time zone;
  v_local_date date;
  v_cutoff_instant timestamptz;
  v_operating_day date;
begin
  if nullif(btrim(coalesce(p_empresa_id,'')),'') is null
     or nullif(btrim(coalesce(p_local_id,'')),'') is null
     or p_occurred_at is null then
    raise exception 'operating_day_parametros_requeridos';
  end if;

  if not exists(
    select 1
      from public.locales l
     where l.empresa_id=p_empresa_id
       and l.id=p_local_id
       and l.activo=true
  ) then
    raise exception 'operating_day_local_no_disponible';
  end if;

  select count(*)
    into v_count
    from private.abc_operating_day_reglas r
   where r.empresa_id=p_empresa_id
     and r.local_id=p_local_id
     and r.vigente_desde<=p_occurred_at
     and (r.vigente_hasta is null or p_occurred_at<r.vigente_hasta);

  if v_count=0 then
    raise exception 'operating_day_configuracion_ausente';
  end if;
  if v_count>1 then
    raise exception 'operating_day_configuracion_ambigua';
  end if;

  select r.*
    into v_rule
    from private.abc_operating_day_reglas r
   where r.empresa_id=p_empresa_id
     and r.local_id=p_local_id
     and r.vigente_desde<=p_occurred_at
     and (r.vigente_hasta is null or p_occurred_at<r.vigente_hasta)
   order by r.vigente_desde desc,r.version desc
   limit 1;

  if not exists(
    select 1
      from pg_catalog.pg_timezone_names tz
     where tz.name=v_rule.timezone_name
  ) then
    raise exception 'operating_day_timezone_invalida';
  end if;

  v_local_ts:=p_occurred_at at time zone v_rule.timezone_name;
  v_local_date:=v_local_ts::date;

  -- Convertir la pared local del corte a un instante absoluto evita depender
  -- de la zona del navegador. PostgreSQL aplica las reglas TZ de su catálogo;
  -- si una hora local no existe por DST, el instante se normaliza al primer
  -- instante válido posterior.
  v_cutoff_instant:=(v_local_date+v_rule.cutoff_time) at time zone v_rule.timezone_name;

  if p_occurred_at>=v_cutoff_instant then
    v_operating_day:=v_local_date;
  else
    v_operating_day:=v_local_date-1;
  end if;

  return jsonb_build_object(
    'operating_day',v_operating_day,
    'occurred_at',p_occurred_at,
    'local_timezone',v_rule.timezone_name,
    'local_wall_time',v_local_ts,
    'cutoff_time',v_rule.cutoff_time,
    'cutoff_instant',v_cutoff_instant,
    'cutoff_rule_id',v_rule.id,
    'cutoff_rule_version',v_rule.version
  );
end $$;

revoke all on function private.abc_resolver_operating_day_contexto(text,text,timestamptz)
from public,anon,authenticated;

create or replace function public.abc_abrir_cuenta(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid,
  p_modalidad text,
  p_currency_code text,
  p_responsable_actual uuid,
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
  v_modalidad text:=upper(btrim(coalesce(p_modalidad,'')));
  v_currency text:=upper(btrim(coalesce(p_currency_code,'')));
  v_responsable uuid:=coalesce(p_responsable_actual,auth.uid());
  v_request jsonb;
  v_cmd jsonb;
  v_result jsonb;
  v_occurred_at timestamptz;
  v_operating_ctx jsonb;
  v_operating_day date;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CUENTA_OPERAR') then
    raise exception 'abc_cuenta_no_autorizada';
  end if;
  if p_cuenta_id is null or p_terminal_id is null or p_session_id is null then
    raise exception 'cuenta_parametros_requeridos';
  end if;
  if v_modalidad not in ('BARRA','MESA','TERRAZA','TAKEAWAY','OTRO') then
    raise exception 'modalidad_cuenta_invalida';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'moneda_cuenta_invalida'; end if;
  if not private.abc_terminal_sesion_operativa(
    p_empresa_id,p_local_id,p_terminal_id,p_session_id
  ) then
    raise exception 'terminal_sesion_no_operativa';
  end if;
  if not private.abc_usuario_activo_local(p_empresa_id,p_local_id,v_responsable) then
    raise exception 'responsable_cuenta_no_pertenece_local';
  end if;
  if not exists(
    select 1
      from public.entidad_fiscal_local_monedas elm
      join public.entidades_fiscales ef
        on ef.empresa_id=elm.empresa_id
       and ef.id=elm.entidad_fiscal_id
     where elm.empresa_id=p_empresa_id
       and elm.local_id=p_local_id
       and elm.currency_code=v_currency
       and elm.activa=true
       and ef.activa=true
  ) then
    raise exception 'moneda_cuenta_no_habilitada';
  end if;

  -- La aserción del cliente forma parte del request idempotente, pero no es autoridad.
  v_request:=jsonb_build_object(
    'cuenta_id',p_cuenta_id,
    'modalidad',v_modalidad,
    'currency_code',v_currency,
    'responsable_actual',v_responsable,
    'terminal_id',p_terminal_id,
    'session_id',p_session_id,
    'operating_day_assertion',p_operating_day
  );
  v_cmd:=private.abc_operacion_iniciar(
    p_operation_id,p_empresa_id,p_local_id,'ABC_ABRIR_CUENTA',v_request,p_terminal_id
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;

  v_occurred_at:=clock_timestamp();
  v_operating_ctx:=private.abc_resolver_operating_day_contexto(
    p_empresa_id,p_local_id,v_occurred_at
  );
  v_operating_day:=(v_operating_ctx->>'operating_day')::date;

  if p_operating_day is not null and p_operating_day<>v_operating_day then
    raise exception 'operating_day_cliente_no_autoritativo';
  end if;

  insert into public.cuentas_comerciales(
    id,empresa_id,local_id,currency_code,modalidad,estado,version,
    responsable_actual,created_by,opened_operating_day
  ) values (
    p_cuenta_id,p_empresa_id,p_local_id,v_currency,v_modalidad,'ABIERTA',1,
    v_responsable,auth.uid(),v_operating_day
  );

  insert into public.abc_eventos(
    empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,
    payload,actor_user_id,terminal_id,occurred_at,operating_day
  ) values (
    p_empresa_id,p_local_id,p_operation_id,'CUENTA',p_cuenta_id::text,'CUENTA_ABIERTA',
    jsonb_build_object(
      'modalidad',v_modalidad,
      'currency_code',v_currency,
      'responsable_actual',v_responsable,
      'session_id',p_session_id,
      'version',1,
      'local_timezone',v_operating_ctx->>'local_timezone',
      'cutoff_time',v_operating_ctx->>'cutoff_time',
      'cutoff_rule_id',v_operating_ctx->>'cutoff_rule_id',
      'cutoff_rule_version',(v_operating_ctx->>'cutoff_rule_version')::bigint
    ),
    auth.uid(),p_terminal_id,v_occurred_at,v_operating_day
  );

  v_result:=jsonb_build_object(
    'ok',true,
    'cuenta_id',p_cuenta_id,
    'estado','ABIERTA',
    'version',1,
    'currency_code',v_currency,
    'modalidad',v_modalidad,
    'responsable_actual',v_responsable,
    'operating_day',v_operating_day,
    'occurred_at',v_occurred_at,
    'local_timezone',v_operating_ctx->>'local_timezone',
    'cutoff_time',v_operating_ctx->>'cutoff_time',
    'cutoff_rule_id',v_operating_ctx->>'cutoff_rule_id',
    'cutoff_rule_version',(v_operating_ctx->>'cutoff_rule_version')::bigint
  );
  perform private.abc_operacion_completar(p_operation_id,v_result);
  return v_result;
end $$;

comment on table private.abc_operating_day_reglas is
  'A11: reglas versionadas por local para derivar operating_day. Sin filas por defecto.';
comment on function private.abc_resolver_operating_day_contexto(text,text,timestamptz) is
  'A11: deriva operating_day desde instante absoluto, zona IANA y hora de corte versionada.';

-- Deliberadamente no se insertan reglas reales en esta migración.
-- La provisión del piloto requiere una hora de corte aprobada y un flujo controlado.
