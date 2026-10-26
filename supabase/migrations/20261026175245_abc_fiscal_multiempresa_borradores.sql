-- C07-A: preferencias fiscales por empresa y entidad emisora. Solo borradores.
-- No activa C07, reserva series, crea facturas, importa certificados ni envía registros.
do $$
begin
  if to_regclass('public.entidades_fiscales') is null
    or to_regclass('public.entidad_fiscal_locales') is null
    or to_regclass('public.membresias_usuario') is null
    or to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then
    raise exception 'FISCAL_CONFIG_DEPENDENCIAS_AUSENTES';
  end if;
end $$;

create table private.abc_fiscal_borradores (
  empresa_id text not null,
  entidad_fiscal_id uuid not null,
  version bigint not null check (version > 0),
  estado text not null default 'BORRADOR' check (estado = 'BORRADOR'),
  configuracion jsonb not null check (jsonb_typeof(configuracion) = 'object'),
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  primary key (empresa_id, entidad_fiscal_id),
  foreign key (empresa_id, entidad_fiscal_id)
    references public.entidades_fiscales(empresa_id, id) on delete restrict
);

create table private.abc_fiscal_borrador_revisiones (
  empresa_id text not null,
  entidad_fiscal_id uuid not null,
  version bigint not null,
  operation_id uuid not null,
  request jsonb not null,
  resultado jsonb not null,
  actor_user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (empresa_id, entidad_fiscal_id, version),
  unique (empresa_id, entidad_fiscal_id, operation_id),
  foreign key (empresa_id, entidad_fiscal_id)
    references private.abc_fiscal_borradores(empresa_id, entidad_fiscal_id) on delete restrict
);

alter table private.abc_fiscal_borradores enable row level security;
alter table private.abc_fiscal_borrador_revisiones enable row level security;
revoke all on private.abc_fiscal_borradores, private.abc_fiscal_borrador_revisiones
  from public, anon, authenticated, service_role;

create function private.abc_fiscal_borrador_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'abc_fiscal_borrador_revisiones' or tg_op = 'DELETE' then
    raise exception 'FISCAL_CONFIG_HISTORIAL_INMUTABLE';
  end if;
  if old.empresa_id is distinct from new.empresa_id
    or old.entidad_fiscal_id is distinct from new.entidad_fiscal_id then
    raise exception 'FISCAL_CONFIG_ALCANCE_INMUTABLE';
  end if;
  return new;
end $$;
create trigger abc_fiscal_borrador_scope before update or delete
  on private.abc_fiscal_borradores for each row
  execute function private.abc_fiscal_borrador_guard();
create trigger abc_fiscal_revision_inmutable before update or delete
  on private.abc_fiscal_borrador_revisiones for each row
  execute function private.abc_fiscal_borrador_guard();

create function private.abc_fiscal_config_acceso(p_empresa text, p_local text, p_entidad uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and coalesce(private.abc_tiene_capacidad(p_empresa, p_local, 'ABC_EMISOR_CAMBIAR'), false)
    and exists (select 1 from public.membresias_usuario m
      where m.user_id = auth.uid() and m.empresa_id = p_empresa and m.activo
        and m.rol = 'Propietario' and m.todos_locales and m.local_id is null)
    and exists (select 1 from public.entidades_fiscales e
      join public.entidad_fiscal_locales el
        on el.empresa_id = e.empresa_id and el.entidad_fiscal_id = e.id and el.activa
      join public.locales l on l.empresa_id = el.empresa_id and l.id = el.local_id and l.activo
      join public.empresas emp on emp.id = e.empresa_id and emp.activo
      where e.empresa_id = p_empresa and e.id = p_entidad and e.activa and l.id = p_local);
$$;

-- Lista cerrada de datos de preferencias y contacto. Ningún secreto ni estado de conexión.
create function private.abc_fiscal_config_normalizar(p_config jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  k text;
  v jsonb;
  c jsonb := jsonb_build_object(
    'jurisdiccion','PENDIENTE','sujecion','PENDIENTE','modalidad','PENDIENTE',
    'canal','PENDIENTE','representacion','PENDIENTE','tipo_factura','PENDIENTE',
    'asesoria_nombre',null,'asesoria_email',null,'presentador_nif',null);
begin
  if p_config is null or jsonb_typeof(p_config) <> 'object'
    or octet_length(p_config::text) > 4096 then
    raise exception 'FISCAL_CONFIG_FORMATO_INVALIDO';
  end if;
  for k,v in select key,value from jsonb_each(p_config) loop
    if not (c ? k) then raise exception 'FISCAL_CONFIG_CAMPO_NO_PERMITIDO'; end if;
    if jsonb_typeof(v) not in ('string','null') then
      raise exception 'FISCAL_CONFIG_TIPO_INVALIDO';
    end if;
    if jsonb_typeof(v) = 'string' then
      if length(v #>> '{}') > 200 or (v #>> '{}') ~ '[[:cntrl:]]' then
        raise exception 'FISCAL_CONFIG_VALOR_INVALIDO';
      end if;
      c := jsonb_set(c, array[k], coalesce(to_jsonb(nullif(btrim(v #>> '{}'),'')), 'null'::jsonb));
    else c := jsonb_set(c, array[k], v);
    end if;
  end loop;
  if coalesce(c->>'jurisdiccion','') not in ('PENDIENTE','ES_AEAT','ES_FORAL','OTRA')
    or coalesce(c->>'sujecion','') not in ('PENDIENTE','SUJETO_RRSIF','EXCLUIDO_SII','EXCLUIDO_OTRO')
    or coalesce(c->>'modalidad','') not in ('PENDIENTE','VERIFACTU','NO_VERIFACTU')
    or coalesce(c->>'canal','') not in ('PENDIENTE','DIRECTO','ASESORIA','PROVEEDOR')
    or coalesce(c->>'representacion','') not in ('PENDIENTE','PROPIO','APODERAMIENTO','COLABORACION_SOCIAL')
    or coalesce(c->>'tipo_factura','') not in ('PENDIENTE','SIMPLIFICADA','COMPLETA') then
    raise exception 'FISCAL_CONFIG_OPCION_INVALIDA';
  end if;
  if c->>'asesoria_email' is not null
    and c->>'asesoria_email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'FISCAL_CONFIG_EMAIL_INVALIDO';
  end if;
  if c->>'presentador_nif' is not null then
    c := jsonb_set(c, '{presentador_nif}', to_jsonb(upper(c->>'presentador_nif')));
    if c->>'presentador_nif' !~ '^[A-Z0-9]{9}$' then
      raise exception 'FISCAL_CONFIG_NIF_FORMATO_INVALIDO';
    end if;
  end if;
  -- Un borrador incompleto sí se puede guardar; una contradicción de modalidad no.
  if c->>'modalidad' <> 'PENDIENTE' and
    (c->>'jurisdiccion' <> 'ES_AEAT' or c->>'sujecion' <> 'SUJETO_RRSIF') then
    raise exception 'FISCAL_CONFIG_AMBITO_INCOMPATIBLE';
  end if;
  if c->>'canal' = 'DIRECTO' and c->>'representacion' not in ('PENDIENTE','PROPIO') then
    raise exception 'FISCAL_CONFIG_REPRESENTACION_INCOMPATIBLE';
  end if;
  if c->>'canal' in ('ASESORIA','PROVEEDOR') and c->>'representacion' = 'PROPIO' then
    raise exception 'FISCAL_CONFIG_REPRESENTACION_INCOMPATIBLE';
  end if;
  return c;
end $$;

create function public.abc_fiscal_leer_borrador(p_empresa_id text, p_local_id text, p_entidad_fiscal_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  b private.abc_fiscal_borradores%rowtype;
  e public.entidades_fiscales%rowtype;
begin
  if not coalesce(private.abc_fiscal_config_acceso(p_empresa_id,p_local_id,p_entidad_fiscal_id),false) then
    raise exception 'FISCAL_CONFIG_NO_AUTORIZADO' using errcode = '42501';
  end if;
  select * into b from private.abc_fiscal_borradores
    where empresa_id = p_empresa_id and entidad_fiscal_id = p_entidad_fiscal_id;
  select * into e from public.entidades_fiscales
    where empresa_id = p_empresa_id and id = p_entidad_fiscal_id;
  return jsonb_build_object('empresa_id',p_empresa_id,'entidad_fiscal_id',p_entidad_fiscal_id,
    'version',coalesce(b.version,0),'estado','BORRADOR','conexion','NO_CONFIGURADA',
    'emision_habilitada',false,'configuracion',b.configuracion,
    'emisor',jsonb_build_object('nombre_legal',e.nombre_legal,'nif',e.identificador_fiscal,
      'pais',e.country_code,'simulada',e.simulada));
end $$;

create function public.abc_fiscal_guardar_borrador(
  p_operation_id uuid, p_empresa_id text, p_local_id text, p_entidad_fiscal_id uuid,
  p_version_esperada bigint, p_configuracion jsonb
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  c jsonb;
  req jsonb;
  prev private.abc_fiscal_borrador_revisiones%rowtype;
  b private.abc_fiscal_borradores%rowtype;
  res jsonb;
begin
  -- Autorizar también los reintentos; nunca devolver un resultado de otra empresa.
  if not coalesce(private.abc_fiscal_config_acceso(p_empresa_id,p_local_id,p_entidad_fiscal_id),false) then
    raise exception 'FISCAL_CONFIG_NO_AUTORIZADO' using errcode = '42501';
  end if;
  if p_operation_id is null or p_version_esperada is null or p_version_esperada < 0 then
    raise exception 'FISCAL_CONFIG_VERSION_REQUERIDA';
  end if;
  c := private.abc_fiscal_config_normalizar(p_configuracion);
  req := jsonb_build_object('configuracion',c,'version_esperada',p_version_esperada);
  perform pg_advisory_xact_lock(hashtextextended(
    jsonb_build_array('fiscal-config',p_empresa_id,p_entidad_fiscal_id)::text,0));
  select * into prev from private.abc_fiscal_borrador_revisiones
    where empresa_id = p_empresa_id and entidad_fiscal_id = p_entidad_fiscal_id
      and operation_id = p_operation_id;
  if found then
    if prev.request is distinct from req then raise exception 'FISCAL_CONFIG_OPERATION_CONFLICT'; end if;
    return prev.resultado;
  end if;
  select * into b from private.abc_fiscal_borradores
    where empresa_id = p_empresa_id and entidad_fiscal_id = p_entidad_fiscal_id for update;
  if coalesce(b.version,0) <> p_version_esperada then
    raise exception 'FISCAL_CONFIG_VERSION_OBSOLETA';
  end if;
  insert into private.abc_fiscal_borradores
    (empresa_id,entidad_fiscal_id,version,configuracion,updated_by)
    values (p_empresa_id,p_entidad_fiscal_id,p_version_esperada+1,c,auth.uid())
    on conflict (empresa_id,entidad_fiscal_id) do update
      set version = excluded.version, configuracion = excluded.configuracion,
        updated_at = now(), updated_by = excluded.updated_by;
  res := public.abc_fiscal_leer_borrador(p_empresa_id,p_local_id,p_entidad_fiscal_id);
  insert into private.abc_fiscal_borrador_revisiones
    (empresa_id,entidad_fiscal_id,version,operation_id,request,resultado,actor_user_id)
    values (p_empresa_id,p_entidad_fiscal_id,p_version_esperada+1,p_operation_id,req,res,auth.uid());
  return res;
end $$;

revoke all on function private.abc_fiscal_borrador_guard() from public,anon,authenticated,service_role;
revoke all on function private.abc_fiscal_config_acceso(text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function private.abc_fiscal_config_normalizar(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.abc_fiscal_leer_borrador(text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.abc_fiscal_guardar_borrador(uuid,text,text,uuid,bigint,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.abc_fiscal_leer_borrador(text,text,uuid) to authenticated;
grant execute on function public.abc_fiscal_guardar_borrador(uuid,text,text,uuid,bigint,jsonb) to authenticated;
