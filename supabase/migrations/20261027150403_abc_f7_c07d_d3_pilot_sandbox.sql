-- C07-D.3: expediente server-side del piloto sandbox por empresa.
--
-- Esta migración no activa emisión, no transporta a AEAT, no guarda secretos y
-- no permite PRODUCTION_ENABLED. Solo registra el alcance, el adaptador lógico,
-- el estado del piloto y evidencias seguras de QA/SANDBOX por empresa.

begin;

do $$
begin
  if to_regclass('public.locales') is null
     or to_regclass('public.entidad_fiscal_locales') is null
     or to_regclass('private.abc_c07d_adaptadores_fiscales') is null
     or to_regprocedure('private.abc_fiscal_config_acceso(text,text,uuid)') is null
     or to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null
     or to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null
     or to_regprocedure('private.abc_operacion_fallar(text,jsonb)') is null then
    raise exception 'ABC_F7_C07D_D3_PREFLIGHT_FALLO:dependencias_piloto_ausentes';
  end if;
  if to_regclass('private.abc_c07d_pilotos_sandbox') is not null
     or to_regclass('private.abc_c07d_pilotos_sandbox_revisiones') is not null then
    raise exception 'ABC_F7_C07D_D3_PREFLIGHT_FALLO:objetos_ya_existen';
  end if;
end $$;

create table private.abc_c07d_pilotos_sandbox (
  pilot_id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  entidad_fiscal_id uuid not null,
  provider_code text,
  adapter_code text references private.abc_c07d_adaptadores_fiscales(adapter_code) on delete restrict,
  adapter_version text,
  serie_id uuid,
  environment text not null default 'SANDBOX',
  estado text not null default 'PENDIENTE_EMPRESA',
  version bigint not null default 1,
  evidencias jsonb not null default '{}'::jsonb,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, local_id, entidad_fiscal_id),
  foreign key (empresa_id, local_id, entidad_fiscal_id)
    references public.entidad_fiscal_locales(empresa_id, local_id, entidad_fiscal_id)
    on delete restrict,
  foreign key (empresa_id, local_id)
    references public.locales(empresa_id, id)
    on delete restrict,
  foreign key (serie_id)
    references public.abc_c05_series_documentales(id)
    on delete restrict,
  constraint abc_c07d_pilot_environment_ck check (environment = 'SANDBOX'),
  constraint abc_c07d_pilot_state_ck check (estado in (
    'PENDIENTE_EMPRESA', 'EXPEDIENTE_EN_REVISION', 'READY_FOR_SANDBOX',
    'SANDBOX_EN_CURSO', 'SANDBOX_PASS', 'PILOTO_CERRADO'
  )),
  constraint abc_c07d_pilot_version_ck check (version >= 1),
  constraint abc_c07d_pilot_provider_ck check (
    provider_code is null or provider_code ~ '^[A-Z][A-Z0-9_]{2,63}$'
  ),
  constraint abc_c07d_pilot_adapter_version_ck check (
    adapter_version is null or adapter_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'
  ),
  constraint abc_c07d_pilot_evidence_ck check (
    jsonb_typeof(evidencias) = 'object'
    and not (evidencias ?| array[
      'secret','secrets','password','token','private_key','privateKey',
      'client_secret','clientSecret','endpoint','url','certificate','pem'
    ])
  )
);

comment on table private.abc_c07d_pilotos_sandbox is
  'C07-D.3: expediente server-side por empresa para pruebas SANDBOX; no activa producción ni guarda secretos.';
comment on column private.abc_c07d_pilotos_sandbox.evidencias is
  'Flags y referencias seguras del expediente; nunca contiene secretos, endpoints ni certificados.';

create index abc_c07d_pilot_state_idx
  on private.abc_c07d_pilotos_sandbox(empresa_id, estado, updated_at desc);

create table private.abc_c07d_pilotos_sandbox_revisiones (
  pilot_id uuid not null references private.abc_c07d_pilotos_sandbox(pilot_id) on delete restrict,
  version bigint not null,
  operation_id uuid not null unique,
  request jsonb not null,
  resultado jsonb not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (pilot_id, version),
  constraint abc_c07d_pilot_revision_request_ck check (jsonb_typeof(request) = 'object'),
  constraint abc_c07d_pilot_revision_result_ck check (jsonb_typeof(resultado) = 'object')
);

alter table private.abc_c07d_pilotos_sandbox enable row level security;
alter table private.abc_c07d_pilotos_sandbox_revisiones enable row level security;

revoke all on table private.abc_c07d_pilotos_sandbox,
  private.abc_c07d_pilotos_sandbox_revisiones
from public, anon, authenticated, service_role;

create function private.abc_c07d_pilot_normalizar_evidencias(p_evidencias jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(coalesce(p_evidencias, '{}'::jsonb)) <> 'object' then
    raise exception 'C07D_PILOT_EVIDENCIAS_DEBE_SER_OBJETO';
  end if;
  if coalesce(p_evidencias, '{}'::jsonb) ?| array[
    'secret','secrets','password','token','private_key','privateKey',
    'client_secret','clientSecret','endpoint','url','certificate','pem'
  ] then
    raise exception 'C07D_PILOT_EVIDENCIAS_NO_ADMITE_SECRETOS';
  end if;
  return coalesce(p_evidencias, '{}'::jsonb);
end $$;

create function private.abc_c07d_pilot_requirements(p_estado text, p_evidencias jsonb)
returns void
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_required text[];
  v_key text;
begin
  v_required := case p_estado
    when 'READY_FOR_SANDBOX' then array[
      'empresa_real','identidad_verificada','representacion_verificada',
      'adaptador_elegido','sandbox_externo','hardware_disponible'
    ]
    when 'SANDBOX_PASS' then array[
      'sandbox_cotejado','resultado_satisfactorio','qr_cotejado','hardware_probado'
    ]
    when 'PILOTO_CERRADO' then array[
      'sandbox_cotejado','resultado_satisfactorio','qr_cotejado','hardware_probado',
      'revision_propietario','revision_asesoria','decision_salida'
    ]
    else array[]::text[]
  end;
  foreach v_key in array v_required loop
    if coalesce((p_evidencias ->> v_key)::boolean, false) is not true then
      raise exception 'C07D_PILOT_EVIDENCIA_REQUERIDA:%', v_key;
    end if;
  end loop;
end $$;

create function private.abc_c07d_pilot_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed boolean;
begin
  if new.environment <> 'SANDBOX' then
    raise exception 'C07D_PILOT_SOLO_SANDBOX';
  end if;
  if tg_op = 'UPDATE' and (
    old.pilot_id is distinct from new.pilot_id
    or old.empresa_id is distinct from new.empresa_id
    or old.local_id is distinct from new.local_id
    or old.entidad_fiscal_id is distinct from new.entidad_fiscal_id
    or old.environment is distinct from new.environment
  ) then
    raise exception 'C07D_PILOT_SCOPE_INMUTABLE';
  end if;
  if new.estado <> 'PENDIENTE_EMPRESA' and new.adapter_code is null then
    raise exception 'C07D_PILOT_ADAPTADOR_REQUERIDO';
  end if;
  if new.estado <> 'PENDIENTE_EMPRESA' and new.adapter_code = 'SIMULADOR_C07D' then
    raise exception 'C07D_PILOT_SIMULADOR_NO_ES_SANDBOX_EXTERNO';
  end if;
  if new.estado in ('READY_FOR_SANDBOX','SANDBOX_EN_CURSO','SANDBOX_PASS','PILOTO_CERRADO')
     and new.serie_id is null then
    raise exception 'C07D_PILOT_SERIE_REQUERIDA';
  end if;
  if new.serie_id is not null and not exists (
    select 1 from public.abc_c05_series_documentales s
     where s.id = new.serie_id
       and s.empresa_id = new.empresa_id
       and s.local_id = new.local_id
       and s.entidad_fiscal_id = new.entidad_fiscal_id
       and s.activa
  ) then
    raise exception 'C07D_PILOT_SERIE_NO_CORRESPONDE';
  end if;
  if tg_op = 'UPDATE' then
    select case
      when old.estado = new.estado then true
      when old.estado = 'PENDIENTE_EMPRESA' and new.estado = 'EXPEDIENTE_EN_REVISION' then true
      when old.estado = 'EXPEDIENTE_EN_REVISION' and new.estado = 'READY_FOR_SANDBOX' then true
      when old.estado = 'READY_FOR_SANDBOX' and new.estado = 'SANDBOX_EN_CURSO' then true
      when old.estado = 'SANDBOX_EN_CURSO' and new.estado = 'SANDBOX_PASS' then true
      when old.estado = 'SANDBOX_PASS' and new.estado = 'PILOTO_CERRADO' then true
      else false
    end into v_allowed;
    if not v_allowed then
      raise exception 'C07D_PILOT_TRANSICION_INVALIDA';
    end if;
  end if;
  perform private.abc_c07d_pilot_requirements(new.estado, new.evidencias);
  return new;
end $$;

create trigger abc_c07d_pilot_guard
before insert or update on private.abc_c07d_pilotos_sandbox
for each row execute function private.abc_c07d_pilot_guard();

create function private.abc_c07d_pilot_revision_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'C07D_PILOT_HISTORIAL_INMUTABLE';
end $$;

create trigger abc_c07d_pilot_revision_immutable
before update or delete on private.abc_c07d_pilotos_sandbox_revisiones
for each row execute function private.abc_c07d_pilot_revision_guard();

create function private.abc_c07d_pilot_result(
  p_pilot private.abc_c07d_pilotos_sandbox
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'pilot_id', p_pilot.pilot_id,
    'empresa_id', p_pilot.empresa_id,
    'local_id', p_pilot.local_id,
    'entidad_fiscal_id', p_pilot.entidad_fiscal_id,
    'provider_code', p_pilot.provider_code,
    'adapter_code', p_pilot.adapter_code,
    'adapter_version', p_pilot.adapter_version,
    'serie_id', p_pilot.serie_id,
    'environment', p_pilot.environment,
    'estado', p_pilot.estado,
    'version', p_pilot.version,
    'evidencias', p_pilot.evidencias,
    'updated_at', p_pilot.updated_at
  )
$$;

create function public.abc_c07d_leer_piloto_sandbox(
  p_empresa_id text,
  p_local_id text,
  p_entidad_fiscal_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pilot private.abc_c07d_pilotos_sandbox%rowtype;
begin
  if not private.abc_fiscal_config_acceso(p_empresa_id,p_local_id,p_entidad_fiscal_id) then
    raise exception 'C07D_PILOT_NO_AUTORIZADO' using errcode = '42501';
  end if;
  select * into v_pilot
    from private.abc_c07d_pilotos_sandbox p
   where p.empresa_id = p_empresa_id
     and p.local_id = p_local_id
     and p.entidad_fiscal_id = p_entidad_fiscal_id;
  if not found then
    return jsonb_build_object(
      'ok', true,
      'configurado', false,
      'estado', 'PENDIENTE_EMPRESA',
      'empresa_id', p_empresa_id,
      'local_id', p_local_id,
      'entidad_fiscal_id', p_entidad_fiscal_id
    );
  end if;
  return jsonb_build_object('ok', true, 'configurado', true, 'piloto', private.abc_c07d_pilot_result(v_pilot));
end $$;

create function public.abc_c07d_guardar_piloto_sandbox(
  p_operation_id uuid,
  p_empresa_id text,
  p_local_id text,
  p_entidad_fiscal_id uuid,
  p_provider_code text,
  p_adapter_code text,
  p_adapter_version text,
  p_serie_id uuid,
  p_estado text,
  p_evidencias jsonb,
  p_version_esperada bigint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cmd jsonb;
  v_request jsonb;
  v_current private.abc_c07d_pilotos_sandbox%rowtype;
  v_saved private.abc_c07d_pilotos_sandbox%rowtype;
  v_adapter private.abc_c07d_adaptadores_fiscales%rowtype;
  v_estado text := upper(btrim(coalesce(p_estado,'')));
  v_provider text := nullif(upper(btrim(coalesce(p_provider_code,''))), '');
  v_adapter_code text := nullif(upper(btrim(coalesce(p_adapter_code,''))), '');
  v_adapter_version text := nullif(btrim(coalesce(p_adapter_version,'')), '');
  v_evidencias jsonb;
  v_next_version bigint;
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_fiscal_config_acceso(p_empresa_id,p_local_id,p_entidad_fiscal_id) then
    raise exception 'C07D_PILOT_NO_AUTORIZADO' using errcode = '42501';
  end if;
  if p_operation_id is null
     or p_version_esperada is null
     or p_version_esperada < 0
     or v_estado not in ('PENDIENTE_EMPRESA','EXPEDIENTE_EN_REVISION','READY_FOR_SANDBOX','SANDBOX_EN_CURSO','SANDBOX_PASS','PILOTO_CERRADO') then
    raise exception 'C07D_PILOT_PARAMETROS_INVALIDOS';
  end if;
  if v_adapter_code is not null then
    select * into v_adapter
      from private.abc_c07d_adaptadores_fiscales a
     where a.adapter_code = v_adapter_code and a.enabled;
    if not found or not ('SANDBOX' = any(v_adapter.environments)) then
      raise exception 'C07D_PILOT_ADAPTADOR_SANDBOX_NO_DISPONIBLE';
    end if;
    if v_adapter.adapter_version is distinct from v_adapter_version then
      raise exception 'C07D_PILOT_VERSION_ADAPTADOR_INCORRECTA';
    end if;
  end if;
  v_evidencias := private.abc_c07d_pilot_normalizar_evidencias(p_evidencias);
  v_request := jsonb_build_object(
    'provider_code',v_provider,
    'adapter_code',v_adapter_code,
    'adapter_version',v_adapter_version,
    'serie_id',p_serie_id,
    'environment','SANDBOX',
    'estado',v_estado,
    'evidencias',v_evidencias,
    'version_esperada',p_version_esperada
  );
  v_cmd := private.abc_operacion_iniciar(
    p_operation_id::text,p_empresa_id,p_local_id,
    'ABC_C07D_GUARDAR_PILOTO_SANDBOX',v_request,null
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;
  select * into v_current
    from private.abc_c07d_pilotos_sandbox p
   where p.empresa_id=p_empresa_id
     and p.local_id=p_local_id
     and p.entidad_fiscal_id=p_entidad_fiscal_id
   for update;
  if found then
    if v_current.version <> p_version_esperada then
      raise exception 'C07D_PILOT_VERSION_OBSOLETA';
    end if;
    v_next_version := v_current.version + 1;
    update private.abc_c07d_pilotos_sandbox set
      provider_code=v_provider,
      adapter_code=v_adapter_code,
      adapter_version=v_adapter_version,
      serie_id=p_serie_id,
      estado=v_estado,
      version=v_next_version,
      evidencias=v_evidencias,
      updated_by=auth.uid(),
      updated_at=now()
    where pilot_id=v_current.pilot_id
    returning * into v_saved;
  else
    if p_version_esperada <> 0 then
      raise exception 'C07D_PILOT_VERSION_OBSOLETA';
    end if;
    insert into private.abc_c07d_pilotos_sandbox(
      empresa_id,local_id,entidad_fiscal_id,provider_code,adapter_code,
      adapter_version,serie_id,environment,estado,version,evidencias,updated_by
    ) values (
      p_empresa_id,p_local_id,p_entidad_fiscal_id,v_provider,v_adapter_code,
      v_adapter_version,p_serie_id,'SANDBOX',v_estado,1,v_evidencias,auth.uid()
    ) returning * into v_saved;
    v_next_version := 1;
  end if;
  v_result := jsonb_build_object('ok',true,'configurado',true,'piloto',private.abc_c07d_pilot_result(v_saved));
  insert into private.abc_c07d_pilotos_sandbox_revisiones(
    pilot_id,version,operation_id,request,resultado,actor_user_id
  ) values (v_saved.pilot_id,v_next_version,p_operation_id,v_request,v_result,auth.uid());
  perform private.abc_operacion_completar(p_operation_id::text,v_result);
  return v_result;
exception when others then
  begin
    perform private.abc_operacion_fallar(
      p_operation_id::text,
      jsonb_build_object('sqlstate',sqlstate,'message',sqlerrm)
    );
  exception when others then null;
  end;
  raise;
end $$;

revoke all on function private.abc_c07d_pilot_normalizar_evidencias(jsonb) from public,anon,authenticated,service_role;
revoke all on function private.abc_c07d_pilot_requirements(text,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.abc_c07d_pilot_guard() from public,anon,authenticated,service_role;
revoke all on function private.abc_c07d_pilot_revision_guard() from public,anon,authenticated,service_role;
revoke all on function private.abc_c07d_pilot_result(private.abc_c07d_pilotos_sandbox) from public,anon,authenticated,service_role;
revoke all on function public.abc_c07d_leer_piloto_sandbox(text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.abc_c07d_guardar_piloto_sandbox(uuid,text,text,uuid,text,text,text,uuid,text,jsonb,bigint) from public,anon,authenticated,service_role;
grant execute on function public.abc_c07d_leer_piloto_sandbox(text,text,uuid) to authenticated;
grant execute on function public.abc_c07d_guardar_piloto_sandbox(uuid,text,text,uuid,text,text,text,uuid,text,jsonb,bigint) to authenticated;

commit;
