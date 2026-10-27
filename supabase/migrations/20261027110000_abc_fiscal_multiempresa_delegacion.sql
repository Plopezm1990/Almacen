-- C07-C: acceso delegado al panel y evidencia externa de representación.
-- No envía correos, no custodia secretos, no activa emisión y no toca facturas.
begin;

do $$
begin
  if to_regclass('private.abc_fiscal_borradores') is null
    or to_regprocedure('private.abc_fiscal_config_acceso(text,text,uuid)') is null
    or to_regclass('public.entidades_fiscales') is null
    or to_regclass('public.membresias_usuario') is null then
    raise exception 'FISCAL_DELEGACION_DEPENDENCIAS_AUSENTES';
  end if;
end $$;

create table private.abc_fiscal_delegaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  entidad_fiscal_id uuid not null,
  invitado_email text not null check (
    invitado_email = lower(btrim(invitado_email))
    and invitado_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  permiso text not null check (permiso in ('CONSULTAR','PROPONER','VALIDAR_SITUACION')),
  estado text not null default 'INVITADA' check (estado in ('INVITADA','ACEPTADA','REVOCADA','CADUCADA')),
  expira_at timestamptz not null,
  aceptada_at timestamptz,
  aceptada_por uuid references auth.users(id) on delete restrict,
  revocada_at timestamptz,
  creada_por uuid not null references auth.users(id) on delete restrict,
  creada_at timestamptz not null default now(),
  actualizada_at timestamptz not null default now(),
  foreign key (empresa_id, entidad_fiscal_id)
    references public.entidades_fiscales(empresa_id, id) on delete restrict,
  check (expira_at > creada_at),
  check (estado <> 'ACEPTADA' or (aceptada_at is not null and aceptada_por is not null)),
  check (estado <> 'REVOCADA' or revocada_at is not null)
);

create index abc_fiscal_delegaciones_scope_idx
  on private.abc_fiscal_delegaciones(empresa_id, entidad_fiscal_id, estado, expira_at);
create unique index abc_fiscal_delegaciones_pendiente_email_uq
  on private.abc_fiscal_delegaciones(empresa_id, entidad_fiscal_id, invitado_email)
  where estado = 'INVITADA';

create table private.abc_fiscal_delegacion_revisiones (
  delegacion_id uuid not null references private.abc_fiscal_delegaciones(id) on delete restrict,
  version bigint not null check (version > 0),
  operation_id uuid not null,
  accion text not null check (accion in ('INVITAR','ACEPTAR','REVOCAR','CADUCAR')),
  request jsonb not null check (jsonb_typeof(request) = 'object'),
  resultado jsonb not null check (jsonb_typeof(resultado) = 'object'),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (delegacion_id, version),
  unique (delegacion_id, operation_id),
  unique (operation_id)
);

create table private.abc_fiscal_representaciones (
  empresa_id text not null,
  entidad_fiscal_id uuid not null,
  tipo text not null check (tipo in ('PENDIENTE','APODERAMIENTO','COLABORACION_SOCIAL')),
  estado text not null check (estado in ('PENDIENTE','ACREDITADA','REVOCADA','CADUCADA')),
  referencia_opaca text check (referencia_opaca is null or (length(btrim(referencia_opaca)) between 1 and 200 and referencia_opaca !~ '[[:cntrl:]]')),
  evidencia_sha256 text check (evidencia_sha256 is null or evidencia_sha256 ~ '^[0-9a-f]{64}$'),
  vigente_desde date,
  vigente_hasta date,
  validada_por uuid references auth.users(id) on delete restrict,
  validada_at timestamptz,
  actualizada_por uuid not null references auth.users(id) on delete restrict,
  actualizada_at timestamptz not null default now(),
  primary key (empresa_id, entidad_fiscal_id),
  foreign key (empresa_id, entidad_fiscal_id)
    references public.entidades_fiscales(empresa_id, id) on delete restrict,
  check ((tipo = 'PENDIENTE' and estado = 'PENDIENTE') or (tipo <> 'PENDIENTE' and referencia_opaca is not null and evidencia_sha256 is not null)),
  check ((estado = 'ACREDITADA') = (validada_por is not null and validada_at is not null)),
  check (vigente_hasta is null or vigente_desde is null or vigente_hasta >= vigente_desde)
);

create table private.abc_fiscal_representacion_revisiones (
  empresa_id text not null,
  entidad_fiscal_id uuid not null,
  version bigint not null check (version > 0),
  operation_id uuid not null,
  request jsonb not null check (jsonb_typeof(request) = 'object'),
  resultado jsonb not null check (jsonb_typeof(resultado) = 'object'),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (empresa_id, entidad_fiscal_id, version),
  unique (empresa_id, entidad_fiscal_id, operation_id),
  foreign key (empresa_id, entidad_fiscal_id)
    references private.abc_fiscal_representaciones(empresa_id, entidad_fiscal_id) on delete restrict
);

alter table private.abc_fiscal_delegaciones enable row level security;
alter table private.abc_fiscal_delegacion_revisiones enable row level security;
alter table private.abc_fiscal_representaciones enable row level security;
alter table private.abc_fiscal_representacion_revisiones enable row level security;
revoke all on private.abc_fiscal_delegaciones, private.abc_fiscal_delegacion_revisiones,
  private.abc_fiscal_representaciones, private.abc_fiscal_representacion_revisiones
  from public, anon, authenticated, service_role;

create function private.abc_fiscal_delegacion_propietario(p_empresa text, p_local text, p_entidad uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and coalesce(private.abc_tiene_capacidad(p_empresa,p_local,'ABC_EMISOR_CAMBIAR'),false)
    and exists (select 1 from public.membresias_usuario m
      where m.user_id=auth.uid() and m.empresa_id=p_empresa and m.activo
        and m.rol='Propietario' and m.todos_locales and m.local_id is null)
    and exists (select 1 from public.empresas e where e.id=p_empresa and e.activo)
    and exists (select 1 from public.locales l where l.empresa_id=p_empresa and l.id=p_local and l.activo)
    and exists (select 1 from public.entidades_fiscales e
      join public.entidad_fiscal_locales el on el.empresa_id=e.empresa_id and el.entidad_fiscal_id=e.id and el.local_id=p_local and el.activa
      where e.empresa_id=p_empresa and e.id=p_entidad and e.activa);
$$;

create function private.abc_fiscal_delegacion_normalizar_email(p_email text)
returns text language plpgsql immutable set search_path = '' as $$
declare v text := lower(btrim(coalesce(p_email,''))); begin
  if v !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'FISCAL_DELEGACION_EMAIL_INVALIDO'; end if;
  return v;
end $$;

create function private.abc_fiscal_delegacion_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.empresa_id is distinct from new.empresa_id
    or old.entidad_fiscal_id is distinct from new.entidad_fiscal_id
    or old.invitado_email is distinct from new.invitado_email
    or old.creada_por is distinct from new.creada_por
    or old.creada_at is distinct from new.creada_at then
    raise exception 'FISCAL_DELEGACION_ALCANCE_INMUTABLE';
  end if;
  return new;
end $$;
create trigger abc_fiscal_delegacion_scope before update on private.abc_fiscal_delegaciones
  for each row execute function private.abc_fiscal_delegacion_guard();

create function private.abc_fiscal_delegacion_revision_guard()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'FISCAL_DELEGACION_HISTORIAL_INMUTABLE'; end $$;
create trigger abc_fiscal_delegacion_revision_inmutable before update or delete
  on private.abc_fiscal_delegacion_revisiones for each row execute function private.abc_fiscal_delegacion_revision_guard();
create trigger abc_fiscal_representacion_revision_inmutable before update or delete
  on private.abc_fiscal_representacion_revisiones for each row execute function private.abc_fiscal_delegacion_revision_guard();

create function private.abc_fiscal_representacion_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.empresa_id is distinct from new.empresa_id or old.entidad_fiscal_id is distinct from new.entidad_fiscal_id then
    raise exception 'FISCAL_REPRESENTACION_ALCANCE_INMUTABLE';
  end if;
  return new;
end $$;
create trigger abc_fiscal_representacion_scope before update on private.abc_fiscal_representaciones
  for each row execute function private.abc_fiscal_representacion_guard();

create function public.abc_fiscal_listar_delegaciones(p_empresa_id text, p_local_id text, p_entidad_fiscal_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare r jsonb;
begin
  if not private.abc_fiscal_delegacion_propietario(p_empresa_id,p_local_id,p_entidad_fiscal_id) then
    raise exception 'FISCAL_DELEGACION_NO_AUTORIZADO' using errcode='42501';
  end if;
  update private.abc_fiscal_delegaciones set estado='CADUCADA', actualizada_at=now()
    where empresa_id=p_empresa_id and entidad_fiscal_id=p_entidad_fiscal_id
      and estado='INVITADA' and expira_at <= now();
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',d.id,'email',d.invitado_email,'permiso',d.permiso,'estado',d.estado,
    'expira_at',d.expira_at,'aceptada_at',d.aceptada_at
  ) order by d.creada_at desc),'[]'::jsonb) into r
  from private.abc_fiscal_delegaciones d
  where d.empresa_id=p_empresa_id and d.entidad_fiscal_id=p_entidad_fiscal_id;
  return jsonb_build_object('empresa_id',p_empresa_id,'entidad_fiscal_id',p_entidad_fiscal_id,'delegaciones',r);
end $$;

create function public.abc_fiscal_invitar_asesoria(
  p_operation_id uuid, p_empresa_id text, p_local_id text, p_entidad_fiscal_id uuid,
  p_email text, p_permiso text, p_expira_at timestamptz
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_email text; v_id uuid; v_result jsonb; v_prev private.abc_fiscal_delegacion_revisiones%rowtype; v_version bigint;
begin
  if not private.abc_fiscal_delegacion_propietario(p_empresa_id,p_local_id,p_entidad_fiscal_id) then raise exception 'FISCAL_DELEGACION_NO_AUTORIZADO' using errcode='42501'; end if;
  v_email := private.abc_fiscal_delegacion_normalizar_email(p_email);
  if p_operation_id is null or p_permiso not in ('CONSULTAR','PROPONER','VALIDAR_SITUACION') then raise exception 'FISCAL_DELEGACION_PARAMETROS_INVALIDOS'; end if;
  if p_expira_at is null or p_expira_at <= now() or p_expira_at > now() + interval '180 days' then raise exception 'FISCAL_DELEGACION_EXPIRACION_INVALIDA'; end if;
  perform pg_advisory_xact_lock(hashtextextended(jsonb_build_array('fiscal-delegacion',p_empresa_id,p_entidad_fiscal_id,v_email)::text,0));
  select * into v_prev from private.abc_fiscal_delegacion_revisiones where operation_id=p_operation_id;
  if found then return v_prev.resultado; end if;
  if exists (select 1 from private.abc_fiscal_delegaciones where empresa_id=p_empresa_id and entidad_fiscal_id=p_entidad_fiscal_id and invitado_email=v_email and estado='INVITADA') then raise exception 'FISCAL_DELEGACION_YA_INVITADA'; end if;
  insert into private.abc_fiscal_delegaciones(empresa_id,entidad_fiscal_id,invitado_email,permiso,expira_at,creada_por)
    values(p_empresa_id,p_entidad_fiscal_id,v_email,p_permiso,p_expira_at,auth.uid()) returning id into v_id;
  v_result := jsonb_build_object('id',v_id,'empresa_id',p_empresa_id,'entidad_fiscal_id',p_entidad_fiscal_id,'email',v_email,'permiso',p_permiso,'estado','INVITADA','expira_at',p_expira_at,'envio_email','PENDIENTE');
  insert into private.abc_fiscal_delegacion_revisiones(delegacion_id,version,operation_id,accion,request,resultado,actor_user_id)
    values(v_id,1,p_operation_id,'INVITAR',jsonb_build_object('email',v_email,'permiso',p_permiso,'expira_at',p_expira_at),v_result,auth.uid());
  return v_result;
end $$;

create function public.abc_fiscal_revocar_delegacion(
  p_operation_id uuid, p_empresa_id text, p_local_id text, p_delegacion_id uuid
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare d private.abc_fiscal_delegaciones%rowtype; v_result jsonb; v_prev private.abc_fiscal_delegacion_revisiones%rowtype; v_version bigint;
begin
  select * into d from private.abc_fiscal_delegaciones where id=p_delegacion_id and empresa_id=p_empresa_id for update;
  if not found or not private.abc_fiscal_delegacion_propietario(p_empresa_id,p_local_id,d.entidad_fiscal_id) then raise exception 'FISCAL_DELEGACION_NO_AUTORIZADO' using errcode='42501'; end if;
  if p_operation_id is null then raise exception 'FISCAL_DELEGACION_PARAMETROS_INVALIDOS'; end if;
  select * into v_prev from private.abc_fiscal_delegacion_revisiones where delegacion_id=d.id and operation_id=p_operation_id;
  if found then return v_prev.resultado; end if;
  select coalesce(max(version),0)+1 into v_version from private.abc_fiscal_delegacion_revisiones where delegacion_id=d.id;
  update private.abc_fiscal_delegaciones set estado='REVOCADA',revocada_at=coalesce(revocada_at,now()),actualizada_at=now() where id=d.id;
  v_result := jsonb_build_object('id',d.id,'estado','REVOCADA','revocada_at',(select revocada_at from private.abc_fiscal_delegaciones where id=d.id));
  insert into private.abc_fiscal_delegacion_revisiones(delegacion_id,version,operation_id,accion,request,resultado,actor_user_id)
    values(d.id,v_version,p_operation_id,'REVOCAR',jsonb_build_object('id',d.id),v_result,auth.uid());
  return v_result;
end $$;

create function public.abc_fiscal_guardar_representacion(
  p_operation_id uuid, p_empresa_id text, p_local_id text, p_entidad_fiscal_id uuid,
  p_tipo text, p_estado text, p_referencia_opaca text, p_evidencia_sha256 text,
  p_vigente_desde date, p_vigente_hasta date
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_result jsonb; v_prev private.abc_fiscal_representacion_revisiones%rowtype; v_version bigint; v_ref text := nullif(btrim(p_referencia_opaca),''); v_sha text := lower(nullif(btrim(p_evidencia_sha256),''));
begin
  if not private.abc_fiscal_delegacion_propietario(p_empresa_id,p_local_id,p_entidad_fiscal_id) then raise exception 'FISCAL_DELEGACION_NO_AUTORIZADO' using errcode='42501'; end if;
  if p_operation_id is null or p_tipo not in ('PENDIENTE','APODERAMIENTO','COLABORACION_SOCIAL') or p_estado not in ('PENDIENTE','ACREDITADA','REVOCADA','CADUCADA') then raise exception 'FISCAL_REPRESENTACION_PARAMETROS_INVALIDOS'; end if;
  if p_tipo='PENDIENTE' and p_estado<>'PENDIENTE' then raise exception 'FISCAL_REPRESENTACION_INCONSISTENTE'; end if;
  if p_tipo<>'PENDIENTE' and (v_ref is null or v_sha !~ '^[0-9a-f]{64}$') then raise exception 'FISCAL_REPRESENTACION_EVIDENCIA_REQUERIDA'; end if;
  if p_vigente_hasta is not null and p_vigente_desde is not null and p_vigente_hasta<p_vigente_desde then raise exception 'FISCAL_REPRESENTACION_FECHAS_INVALIDAS'; end if;
  select * into v_prev from private.abc_fiscal_representacion_revisiones where empresa_id=p_empresa_id and entidad_fiscal_id=p_entidad_fiscal_id and operation_id=p_operation_id;
  if found then return v_prev.resultado; end if;
  perform pg_advisory_xact_lock(hashtextextended(jsonb_build_array('fiscal-representacion',p_empresa_id,p_entidad_fiscal_id)::text,0));
  select coalesce(max(version),0)+1 into v_version from private.abc_fiscal_representacion_revisiones where empresa_id=p_empresa_id and entidad_fiscal_id=p_entidad_fiscal_id;
  insert into private.abc_fiscal_representaciones(empresa_id,entidad_fiscal_id,tipo,estado,referencia_opaca,evidencia_sha256,vigente_desde,vigente_hasta,validada_por,validada_at,actualizada_por)
    values(p_empresa_id,p_entidad_fiscal_id,p_tipo,p_estado,v_ref,v_sha,p_vigente_desde,p_vigente_hasta,case when p_estado='ACREDITADA' then auth.uid() end,case when p_estado='ACREDITADA' then now() end,auth.uid())
    on conflict (empresa_id,entidad_fiscal_id) do update set tipo=excluded.tipo,estado=excluded.estado,referencia_opaca=excluded.referencia_opaca,evidencia_sha256=excluded.evidencia_sha256,vigente_desde=excluded.vigente_desde,vigente_hasta=excluded.vigente_hasta,validada_por=excluded.validada_por,validada_at=excluded.validada_at,actualizada_por=excluded.actualizada_por,actualizada_at=now();
  v_result := jsonb_build_object('empresa_id',p_empresa_id,'entidad_fiscal_id',p_entidad_fiscal_id,'tipo',p_tipo,'estado',p_estado,'referencia_opaca',v_ref,'evidencia_sha256',v_sha,'vigente_desde',p_vigente_desde,'vigente_hasta',p_vigente_hasta,'emision_habilitada',false);
  insert into private.abc_fiscal_representacion_revisiones(empresa_id,entidad_fiscal_id,version,operation_id,request,resultado,actor_user_id)
    values(p_empresa_id,p_entidad_fiscal_id,v_version,p_operation_id,jsonb_build_object('tipo',p_tipo,'estado',p_estado,'referencia_opaca',v_ref,'evidencia_sha256',v_sha,'vigente_desde',p_vigente_desde,'vigente_hasta',p_vigente_hasta),v_result,auth.uid());
  return v_result;
end $$;

revoke all on function private.abc_fiscal_delegacion_propietario(text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function private.abc_fiscal_delegacion_normalizar_email(text) from public,anon,authenticated,service_role;
revoke all on function private.abc_fiscal_delegacion_guard() from public,anon,authenticated,service_role;
revoke all on function private.abc_fiscal_delegacion_revision_guard() from public,anon,authenticated,service_role;
revoke all on function private.abc_fiscal_representacion_guard() from public,anon,authenticated,service_role;
revoke all on function public.abc_fiscal_listar_delegaciones(text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.abc_fiscal_invitar_asesoria(uuid,text,text,uuid,text,text,timestamptz) from public,anon,authenticated,service_role;
revoke all on function public.abc_fiscal_revocar_delegacion(uuid,text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.abc_fiscal_guardar_representacion(uuid,text,text,uuid,text,text,text,text,date,date) from public,anon,authenticated,service_role;
grant execute on function public.abc_fiscal_listar_delegaciones(text,text,uuid) to authenticated;
grant execute on function public.abc_fiscal_invitar_asesoria(uuid,text,text,uuid,text,text,timestamptz) to authenticated;
grant execute on function public.abc_fiscal_revocar_delegacion(uuid,text,text,uuid) to authenticated;
grant execute on function public.abc_fiscal_guardar_representacion(uuid,text,text,uuid,text,text,text,text,date,date) to authenticated;

commit;
