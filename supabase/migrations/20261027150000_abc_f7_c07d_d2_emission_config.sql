-- ABC F7 C07-D.2.1 — configuración persistente de emisión fiscal en QA.
--
-- Esta migración no activa emisión, no transporta a AEAT y no guarda secretos.
-- Las credenciales se representan únicamente por una referencia opaca de
-- servidor. La serie elegida se valida contra C05 y contra la entidad/local.

do $$
begin
  if to_regclass('public.locales') is null
     or to_regclass('public.entidades_fiscales') is null
     or to_regclass('public.entidad_fiscal_locales') is null
     or to_regclass('public.abc_c05_series_documentales') is null
     or to_regprocedure('private.abc_fiscal_config_acceso(text,text,uuid)') is null
     or to_regprocedure('private.abc_operacion_iniciar(text,text,text,text,jsonb,uuid)') is null
     or to_regprocedure('private.abc_operacion_completar(text,jsonb)') is null
     or to_regprocedure('private.abc_operacion_fallar(text,jsonb)') is null then
    raise exception 'ABC_F7_C07D_D2_PREFLIGHT_FALLO:dependencias_config_fiscal_ausentes';
  end if;
  if to_regclass('private.abc_c07d_adaptadores_fiscales') is not null
     or to_regclass('private.abc_c07d_emision_config') is not null
     or to_regclass('private.abc_c07d_emision_config_revisiones') is not null then
    raise exception 'ABC_F7_C07D_D2_PREFLIGHT_FALLO:objetos_ya_existen';
  end if;
end $$;

create table private.abc_c07d_adaptadores_fiscales (
  adapter_code text primary key,
  display_name text not null,
  adapter_version text not null,
  environments text[] not null,
  credential_required boolean not null default false,
  capabilities jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint abc_c07d_adapter_code_ck check (
    adapter_code ~ '^[A-Z][A-Z0-9_]{2,63}$'
  ),
  constraint abc_c07d_adapter_name_ck check (
    char_length(btrim(display_name)) between 1 and 160
  ),
  constraint abc_c07d_adapter_version_ck check (
    adapter_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'
  ),
  constraint abc_c07d_adapter_env_ck check (
    cardinality(environments) > 0
    and environments <@ array['QA','SANDBOX','PRODUCCION']::text[]
  ),
  constraint abc_c07d_adapter_capabilities_ck check (
    jsonb_typeof(capabilities) = 'object'
  )
);

comment on table private.abc_c07d_adaptadores_fiscales is
  'C07-D.2: catálogo server-side de adaptadores fiscales; no contiene secretos ni endpoints editables.';

insert into private.abc_c07d_adaptadores_fiscales(
  adapter_code, display_name, adapter_version, environments,
  credential_required, capabilities, enabled
) values (
  'SIMULADOR_C07D',
  'Adaptador fiscal simulado C07-D',
  '1.0.0',
  array['QA','SANDBOX']::text[],
  false,
  jsonb_build_object(
    'transport', 'DISABLED',
    'supports_queue', true,
    'supports_retry', true,
    'supports_unknown_result', true
  ),
  true
);

create table private.abc_c07d_emision_config (
  empresa_id text not null,
  local_id text not null,
  entidad_fiscal_id uuid not null,
  tipo_documento text not null,
  serie_id uuid not null,
  adapter_code text not null references private.abc_c07d_adaptadores_fiscales(adapter_code) on delete restrict,
  environment text not null,
  credential_ref text,
  estado text not null default 'BORRADOR',
  version bigint not null default 1,
  configuracion jsonb not null default '{}'::jsonb,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (empresa_id, local_id, entidad_fiscal_id, tipo_documento),
  foreign key (empresa_id, local_id, entidad_fiscal_id)
    references public.entidad_fiscal_locales(empresa_id, local_id, entidad_fiscal_id)
    on delete restrict,
  foreign key (empresa_id, local_id)
    references public.locales(empresa_id, id)
    on delete restrict,
  foreign key (serie_id)
    references public.abc_c05_series_documentales(id)
    on delete restrict,
  foreign key (updated_by) references auth.users(id) on delete restrict,
  constraint abc_c07d_emision_tipo_ck check (
    tipo_documento ~ '^[A-Z][A-Z0-9_]{1,39}$'
  ),
  constraint abc_c07d_emision_environment_ck check (
    environment in ('QA','SANDBOX','PRODUCCION')
  ),
  constraint abc_c07d_emision_estado_ck check (
    estado in ('BORRADOR','VALIDADA','ACTIVA','BLOQUEADA')
  ),
  constraint abc_c07d_emision_version_ck check (version >= 1),
  constraint abc_c07d_emision_credential_ck check (
    credential_ref is null
    or (
      credential_ref ~ '^[A-Z][A-Z0-9_]{2,127}$'
      and credential_ref not like 'SUPABASE_%'
    )
  ),
  constraint abc_c07d_emision_config_ck check (
    jsonb_typeof(configuracion) = 'object'
    and not (configuracion ?| array[
      'secret','secrets','password','token','private_key','privateKey',
      'client_secret','clientSecret','endpoint','url','certificate','pem'
    ])
  )
);

comment on table private.abc_c07d_emision_config is
  'C07-D.2: configuración por empresa, local, entidad fiscal, tipo y serie; el valor secreto nunca se almacena aquí.';
comment on column private.abc_c07d_emision_config.credential_ref is
  'Referencia opaca a un secreto server-side; no es el secreto ni su contenido.';

create unique index abc_c07d_emision_serie_uq
  on private.abc_c07d_emision_config(serie_id);
create index abc_c07d_emision_adapter_scope_idx
  on private.abc_c07d_emision_config(empresa_id, entidad_fiscal_id, estado, environment);

create table private.abc_c07d_emision_config_revisiones (
  empresa_id text not null,
  local_id text not null,
  entidad_fiscal_id uuid not null,
  tipo_documento text not null,
  version bigint not null,
  operation_id uuid not null unique,
  request jsonb not null,
  resultado jsonb not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (empresa_id, local_id, entidad_fiscal_id, tipo_documento, version),
  foreign key (empresa_id, local_id, entidad_fiscal_id, tipo_documento)
    references private.abc_c07d_emision_config(
      empresa_id, local_id, entidad_fiscal_id, tipo_documento
    ) on delete restrict,
  constraint abc_c07d_revision_request_ck check (jsonb_typeof(request) = 'object'),
  constraint abc_c07d_revision_result_ck check (jsonb_typeof(resultado) = 'object')
);

alter table private.abc_c07d_adaptadores_fiscales enable row level security;
alter table private.abc_c07d_emision_config enable row level security;
alter table private.abc_c07d_emision_config_revisiones enable row level security;

revoke all on table private.abc_c07d_adaptadores_fiscales,
  private.abc_c07d_emision_config,
  private.abc_c07d_emision_config_revisiones
from public, anon, authenticated, service_role;

create function private.abc_c07d_emision_config_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and (old.empresa_id is distinct from new.empresa_id
     or old.local_id is distinct from new.local_id
     or old.entidad_fiscal_id is distinct from new.entidad_fiscal_id
     or old.tipo_documento is distinct from new.tipo_documento) then
    raise exception 'C07D_CONFIG_SCOPE_INMUTABLE';
  end if;
  if not exists (
    select 1
      from public.abc_c05_series_documentales s
     where s.id = new.serie_id
       and s.empresa_id = new.empresa_id
       and s.local_id = new.local_id
       and s.entidad_fiscal_id = new.entidad_fiscal_id
       and s.tipo_documento = new.tipo_documento
       and s.activa
  ) then
    raise exception 'C07D_CONFIG_SERIE_NO_CORRESPONDE';
  end if;
  return new;
end $$;

create trigger abc_c07d_emision_config_scope
before insert or update on private.abc_c07d_emision_config
for each row execute function private.abc_c07d_emision_config_guard();

create function private.abc_c07d_emision_revision_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'C07D_CONFIG_HISTORIAL_INMUTABLE';
end $$;

create trigger abc_c07d_emision_revision_immutable
before update or delete on private.abc_c07d_emision_config_revisiones
for each row execute function private.abc_c07d_emision_revision_guard();

create function private.abc_c07d_config_normalizar(p_config jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(coalesce(p_config, '{}'::jsonb)) <> 'object' then
    raise exception 'C07D_CONFIG_DEBE_SER_OBJETO';
  end if;
  if coalesce(p_config, '{}'::jsonb) ?| array[
    'secret','secrets','password','token','private_key','privateKey',
    'client_secret','clientSecret','endpoint','url','certificate','pem'
  ] then
    raise exception 'C07D_CONFIG_NO_ADMITE_SECRETOS';
  end if;
  return coalesce(p_config, '{}'::jsonb);
end $$;

create function private.abc_c07d_emision_resultado(
  p_config private.abc_c07d_emision_config
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'empresa_id', p_config.empresa_id,
    'local_id', p_config.local_id,
    'entidad_fiscal_id', p_config.entidad_fiscal_id,
    'tipo_documento', p_config.tipo_documento,
    'serie_id', p_config.serie_id,
    'adapter_code', p_config.adapter_code,
    'environment', p_config.environment,
    'estado', p_config.estado,
    'version', p_config.version,
    'credential_configured', p_config.credential_ref is not null,
    'configuracion', p_config.configuracion,
    'updated_at', p_config.updated_at
  )
$$;

create function private.abc_c07d_resolver_emision_config(
  p_empresa_id text,
  p_local_id text,
  p_entidad_fiscal_id uuid,
  p_tipo_documento text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_config private.abc_c07d_emision_config%rowtype;
  v_adapter private.abc_c07d_adaptadores_fiscales%rowtype;
  v_serie public.abc_c05_series_documentales%rowtype;
begin
  select * into v_config
    from private.abc_c07d_emision_config c
   where c.empresa_id = p_empresa_id
     and c.local_id = p_local_id
     and c.entidad_fiscal_id = p_entidad_fiscal_id
     and c.tipo_documento = upper(btrim(coalesce(p_tipo_documento,'')))
   for share;
  if not found then
    raise exception 'C07D_CONFIG_EMISION_AUSENTE';
  end if;
  if v_config.estado not in ('VALIDADA','ACTIVA') then
    raise exception 'C07D_CONFIG_EMISION_NO_VALIDADA';
  end if;
  select * into v_adapter
    from private.abc_c07d_adaptadores_fiscales a
   where a.adapter_code = v_config.adapter_code
     and a.enabled;
  if not found or not (v_config.environment = any(v_adapter.environments)) then
    raise exception 'C07D_ADAPTADOR_NO_DISPONIBLE';
  end if;
  select * into v_serie
    from public.abc_c05_series_documentales s
   where s.id = v_config.serie_id
     and s.activa
     and s.empresa_id = v_config.empresa_id
     and s.local_id = v_config.local_id
     and s.entidad_fiscal_id = v_config.entidad_fiscal_id
     and s.tipo_documento = v_config.tipo_documento;
  if not found then
    raise exception 'C07D_CONFIG_SERIE_NO_DISPONIBLE';
  end if;
  return jsonb_build_object(
    'ok', true,
    'configuracion', private.abc_c07d_emision_resultado(v_config),
    'codigo_serie', v_serie.codigo_serie,
    'nombre_serie', v_serie.nombre,
    'adapter_version', v_adapter.adapter_version,
    'credential_ref', v_config.credential_ref,
    'capabilities', v_adapter.capabilities
  );
end $$;

create function public.abc_c07d_listar_adaptadores_fiscales(
  p_empresa_id text,
  p_local_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_adaptadores jsonb;
begin
  if auth.uid() is null
     or not exists (
       select 1 from public.membresias_usuario m
        where m.user_id = auth.uid()
          and m.empresa_id = p_empresa_id
          and m.activo
          and m.rol = 'Propietario'
          and m.todos_locales
          and m.local_id is null
     )
     or not exists (select 1 from public.empresas e where e.id = p_empresa_id and e.activo)
     or not exists (select 1 from public.locales l where l.empresa_id = p_empresa_id and l.id = p_local_id and l.activo) then
    raise exception 'C07D_CONFIG_NO_AUTORIZADO' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'adapter_code', a.adapter_code,
    'display_name', a.display_name,
    'adapter_version', a.adapter_version,
    'environments', a.environments,
    'credential_required', a.credential_required,
    'capabilities', a.capabilities
  ) order by a.adapter_code), '[]'::jsonb)
    into v_adaptadores
    from private.abc_c07d_adaptadores_fiscales a
   where a.enabled;
  return jsonb_build_object(
    'ok', true,
    'empresa_id', p_empresa_id,
    'local_id', p_local_id,
    'adaptadores', v_adaptadores
  );
end $$;

create function public.abc_c07d_leer_emision_config(
  p_empresa_id text,
  p_local_id text,
  p_entidad_fiscal_id uuid,
  p_tipo_documento text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_config private.abc_c07d_emision_config%rowtype;
  v_serie public.abc_c05_series_documentales%rowtype;
begin
  if not private.abc_fiscal_config_acceso(p_empresa_id, p_local_id, p_entidad_fiscal_id) then
    raise exception 'C07D_CONFIG_NO_AUTORIZADO' using errcode = '42501';
  end if;
  select * into v_config
    from private.abc_c07d_emision_config c
   where c.empresa_id = p_empresa_id
     and c.local_id = p_local_id
     and c.entidad_fiscal_id = p_entidad_fiscal_id
     and c.tipo_documento = upper(btrim(coalesce(p_tipo_documento,'')));
  if not found then
    return jsonb_build_object(
      'ok', true,
      'configurada', false,
      'estado', 'NO_CONFIGURADA',
      'empresa_id', p_empresa_id,
      'local_id', p_local_id,
      'entidad_fiscal_id', p_entidad_fiscal_id,
      'tipo_documento', upper(btrim(coalesce(p_tipo_documento,'')))
    );
  end if;
  select * into v_serie from public.abc_c05_series_documentales s where s.id = v_config.serie_id;
  return jsonb_build_object(
    'ok', true,
    'configurada', true,
    'configuracion', private.abc_c07d_emision_resultado(v_config),
    'codigo_serie', v_serie.codigo_serie,
    'nombre_serie', v_serie.nombre
  );
end $$;

create function public.abc_c07d_guardar_emision_config(
  p_operation_id uuid,
  p_empresa_id text,
  p_local_id text,
  p_entidad_fiscal_id uuid,
  p_tipo_documento text,
  p_serie_id uuid,
  p_adapter_code text,
  p_environment text,
  p_credential_ref text,
  p_estado text,
  p_configuracion jsonb,
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
  v_current private.abc_c07d_emision_config%rowtype;
  v_saved private.abc_c07d_emision_config%rowtype;
  v_adapter private.abc_c07d_adaptadores_fiscales%rowtype;
  v_serie public.abc_c05_series_documentales%rowtype;
  v_tipo text := upper(btrim(coalesce(p_tipo_documento,'')));
  v_adapter_code text := upper(btrim(coalesce(p_adapter_code,'')));
  v_environment text := upper(btrim(coalesce(p_environment,'')));
  v_estado text := upper(btrim(coalesce(p_estado,'')));
  v_credential_ref text := nullif(upper(btrim(coalesce(p_credential_ref,''))), '');
  v_config jsonb;
  v_next_version bigint;
  v_result jsonb;
begin
  if auth.uid() is null
     or not private.abc_fiscal_config_acceso(p_empresa_id,p_local_id,p_entidad_fiscal_id) then
    raise exception 'C07D_CONFIG_NO_AUTORIZADO' using errcode = '42501';
  end if;
  if p_operation_id is null
     or v_tipo !~ '^[A-Z][A-Z0-9_]{1,39}$'
     or p_serie_id is null
     or v_adapter_code !~ '^[A-Z][A-Z0-9_]{2,63}$'
     or v_environment not in ('QA','SANDBOX','PRODUCCION')
     or v_estado not in ('BORRADOR','VALIDADA','ACTIVA','BLOQUEADA')
     or coalesce(p_version_esperada,0) < 0 then
    raise exception 'C07D_CONFIG_PARAMETROS_INVALIDOS';
  end if;
  if v_estado = 'ACTIVA' then
    raise exception 'C07D_ACTIVACION_REQUIERE_REVISION';
  end if;
  v_config := private.abc_c07d_config_normalizar(p_configuracion);
  select * into v_adapter
    from private.abc_c07d_adaptadores_fiscales a
   where a.adapter_code = v_adapter_code and a.enabled;
  if not found or not (v_environment = any(v_adapter.environments)) then
    raise exception 'C07D_ADAPTADOR_ENTORNO_NO_SOPORTADO';
  end if;
  if v_adapter.credential_required and v_credential_ref is null then
    raise exception 'C07D_CREDENTIAL_REF_REQUERIDA';
  end if;
  if not v_adapter.credential_required and v_credential_ref is not null then
    raise exception 'C07D_ADAPTADOR_NO_DEBE_TENER_CREDENTIAL_REF';
  end if;
  select * into v_serie
    from public.abc_c05_series_documentales s
   where s.id = p_serie_id
     and s.empresa_id = p_empresa_id
     and s.local_id = p_local_id
     and s.entidad_fiscal_id = p_entidad_fiscal_id
     and s.tipo_documento = v_tipo
     and s.activa;
  if not found then
    raise exception 'C07D_CONFIG_SERIE_NO_CORRESPONDE';
  end if;
  v_request := jsonb_build_object(
    'entidad_fiscal_id',p_entidad_fiscal_id,
    'tipo_documento',v_tipo,
    'serie_id',p_serie_id,
    'adapter_code',v_adapter_code,
    'environment',v_environment,
    'credential_configured',v_credential_ref is not null,
    'estado',v_estado,
    'configuracion',v_config,
    'version_esperada',p_version_esperada
  );
  v_cmd := private.abc_operacion_iniciar(
    p_operation_id::text,p_empresa_id,p_local_id,
    'ABC_C07D_GUARDAR_EMISION_CONFIG',v_request,null
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado',v_cmd);
  end if;
  select * into v_current
    from private.abc_c07d_emision_config c
   where c.empresa_id=p_empresa_id
     and c.local_id=p_local_id
     and c.entidad_fiscal_id=p_entidad_fiscal_id
     and c.tipo_documento=v_tipo
   for update;
  if found then
    if v_current.version <> p_version_esperada then
      raise exception 'C07D_CONFIG_VERSION_OBSOLETA';
    end if;
    v_next_version := v_current.version + 1;
    update private.abc_c07d_emision_config set
      serie_id=p_serie_id,
      adapter_code=v_adapter_code,
      environment=v_environment,
      credential_ref=v_credential_ref,
      estado=v_estado,
      version=v_next_version,
      configuracion=v_config,
      updated_by=auth.uid(),
      updated_at=now()
    where empresa_id=p_empresa_id and local_id=p_local_id
      and entidad_fiscal_id=p_entidad_fiscal_id and tipo_documento=v_tipo
    returning * into v_saved;
  else
    if p_version_esperada <> 0 then
      raise exception 'C07D_CONFIG_VERSION_OBSOLETA';
    end if;
    insert into private.abc_c07d_emision_config(
      empresa_id,local_id,entidad_fiscal_id,tipo_documento,serie_id,
      adapter_code,environment,credential_ref,estado,version,
      configuracion,updated_by
    ) values (
      p_empresa_id,p_local_id,p_entidad_fiscal_id,v_tipo,p_serie_id,
      v_adapter_code,v_environment,v_credential_ref,v_estado,1,
      v_config,auth.uid()
    ) returning * into v_saved;
    v_next_version := 1;
  end if;
  v_result := jsonb_build_object(
    'ok',true,
    'configurada',true,
    'version',v_next_version,
    'serie_id',v_saved.serie_id,
    'codigo_serie',v_serie.codigo_serie,
    'adapter_code',v_saved.adapter_code,
    'environment',v_saved.environment,
    'estado',v_saved.estado,
    'credential_configured',v_saved.credential_ref is not null
  );
  insert into private.abc_c07d_emision_config_revisiones(
    empresa_id,local_id,entidad_fiscal_id,tipo_documento,version,
    operation_id,request,resultado,actor_user_id
  ) values (
    p_empresa_id,p_local_id,p_entidad_fiscal_id,v_tipo,v_next_version,
    p_operation_id,v_request,v_result,auth.uid()
  );
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

revoke all on function private.abc_c07d_emision_config_guard() from public,anon,authenticated,service_role;
revoke all on function private.abc_c07d_emision_revision_guard() from public,anon,authenticated,service_role;
revoke all on function private.abc_c07d_config_normalizar(jsonb) from public,anon,authenticated,service_role;
revoke all on function private.abc_c07d_emision_resultado(private.abc_c07d_emision_config) from public,anon,authenticated,service_role;
revoke all on function private.abc_c07d_resolver_emision_config(text,text,uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.abc_c07d_listar_adaptadores_fiscales(text,text) from public,anon,authenticated,service_role;
revoke all on function public.abc_c07d_leer_emision_config(text,text,uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.abc_c07d_guardar_emision_config(uuid,text,text,uuid,text,uuid,text,text,text,text,jsonb,bigint) from public,anon,authenticated,service_role;
grant execute on function public.abc_c07d_listar_adaptadores_fiscales(text,text) to authenticated;
grant execute on function public.abc_c07d_leer_emision_config(text,text,uuid,text) to authenticated;
grant execute on function public.abc_c07d_guardar_emision_config(uuid,text,text,uuid,text,uuid,text,text,text,text,jsonb,bigint) to authenticated;
