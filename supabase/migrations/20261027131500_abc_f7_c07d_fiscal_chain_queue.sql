-- ABC F7 C07-D. Registro fiscal inmutable, cadena SHA-256 y cola controlada.
-- QA-only en esta etapa. No realiza llamadas a AEAT ni almacena secretos.

do $$
begin
  if to_regclass('public.abc_c05_documentos_emitidos') is null
     or to_regprocedure('private.abc_c05_entidad_para_local(text,text)') is null then
    raise exception 'ABC_F7_C07D_PREFLIGHT_FALLO:C05_reconciliado_no_disponible';
  end if;
end $$;

create table public.abc_c07d_registros_fiscales (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  entidad_fiscal_id uuid not null,
  local_id text not null,
  documento_id uuid not null references public.abc_c05_documentos_emitidos(id) on delete restrict,
  secuencia bigint not null,
  evento text not null default 'EMISION',
  estado text not null default 'CONFIRMADO',
  snapshot jsonb not null,
  hash_anterior_sha256 text,
  hash_sha256 text not null,
  operation_id text not null,
  actor_user_id uuid,
  created_at timestamptz not null default now(),
  constraint abc_c07d_registro_entidad_fk
    foreign key (empresa_id, entidad_fiscal_id)
    references public.entidades_fiscales(empresa_id, id) on delete restrict,
  constraint abc_c07d_registro_local_entidad_fk
    foreign key (empresa_id, local_id, entidad_fiscal_id)
    references public.entidad_fiscal_locales(empresa_id, local_id, entidad_fiscal_id) on delete restrict,
  constraint abc_c07d_registro_secuencia_ck
    check (secuencia >= 1),
  constraint abc_c07d_registro_evento_ck
    check (evento in ('EMISION','ANULACION','RECTIFICACION')),
  constraint abc_c07d_registro_estado_ck
    check (estado in ('CONFIRMADO','ANULADO')),
  constraint abc_c07d_registro_hash_anterior_ck
    check (hash_anterior_sha256 is null or hash_anterior_sha256 ~ '^[0-9a-f]{64}$'),
  constraint abc_c07d_registro_hash_ck
    check (hash_sha256 ~ '^[0-9a-f]{64}$'),
  constraint abc_c07d_registro_secuencia_uq
    unique (empresa_id, entidad_fiscal_id, secuencia),
  constraint abc_c07d_registro_operation_uq
    unique (empresa_id, entidad_fiscal_id, operation_id),
  constraint abc_c07d_registro_documento_evento_uq
    unique (empresa_id, entidad_fiscal_id, documento_id, evento)
);

create index abc_c07d_registro_documento_idx
  on public.abc_c07d_registros_fiscales(empresa_id, documento_id);
create index abc_c07d_registro_documento_fk_idx
  on public.abc_c07d_registros_fiscales(documento_id);
create index abc_c07d_registro_local_entidad_idx
  on public.abc_c07d_registros_fiscales(empresa_id, local_id, entidad_fiscal_id);

create table public.abc_c07d_cola_fiscal (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  entidad_fiscal_id uuid not null,
  local_id text not null,
  registro_id uuid not null references public.abc_c07d_registros_fiscales(id) on delete restrict,
  operation_id text not null,
  estado text not null default 'PENDIENTE',
  intentos integer not null default 0,
  disponible_at timestamptz not null default now(),
  claim_token text,
  lease_until timestamptz,
  payload jsonb not null default '{}'::jsonb,
  respuesta jsonb,
  ultimo_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint abc_c07d_cola_entidad_fk
    foreign key (empresa_id, entidad_fiscal_id)
    references public.entidades_fiscales(empresa_id, id) on delete restrict,
  constraint abc_c07d_cola_local_entidad_fk
    foreign key (empresa_id, local_id, entidad_fiscal_id)
    references public.entidad_fiscal_locales(empresa_id, local_id, entidad_fiscal_id) on delete restrict,
  constraint abc_c07d_cola_estado_ck
    check (estado in ('PENDIENTE','EN_PROCESO','ACEPTADO','RECHAZADO','ERROR','DESCONOCIDO')),
  constraint abc_c07d_cola_intentos_ck
    check (intentos >= 0),
  constraint abc_c07d_cola_registro_uq
    unique (empresa_id, entidad_fiscal_id, registro_id),
  constraint abc_c07d_cola_operation_uq
    unique (empresa_id, entidad_fiscal_id, operation_id)
);

create index abc_c07d_cola_claim_idx
  on public.abc_c07d_cola_fiscal(empresa_id, entidad_fiscal_id, estado, disponible_at);
create index abc_c07d_cola_registro_fk_idx
  on public.abc_c07d_cola_fiscal(registro_id);
create index abc_c07d_cola_local_entidad_idx
  on public.abc_c07d_cola_fiscal(empresa_id, local_id, entidad_fiscal_id);

create function private.abc_c07d_guard_registro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'registro_fiscal_inmutable';
end $$;

create trigger abc_c07d_registro_no_update
before update or delete on public.abc_c07d_registros_fiscales
for each row execute function private.abc_c07d_guard_registro();

create function private.abc_c07d_normalize_registro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anterior public.abc_c07d_registros_fiscales%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      new.empresa_id || ':' || new.entidad_fiscal_id::text, 0
    )
  );
  if new.evento = 'EMISION' and not exists (
    select 1
      from public.abc_c05_documentos_emitidos d
     where d.id = new.documento_id
       and d.empresa_id = new.empresa_id
       and d.entidad_fiscal_id = new.entidad_fiscal_id
       and d.estado = 'EMITIDO'
  ) then
    raise exception 'registro_fiscal_requiere_documento_emitido';
  end if;
  select * into v_anterior
    from public.abc_c07d_registros_fiscales r
   where r.empresa_id = new.empresa_id
     and r.entidad_fiscal_id = new.entidad_fiscal_id
   order by r.secuencia desc
   limit 1
   for update;
  new.secuencia := coalesce(v_anterior.secuencia, 0) + 1;
  new.hash_anterior_sha256 := v_anterior.hash_sha256;
  new.hash_sha256 := encode(
    extensions.digest(coalesce(v_anterior.hash_sha256, '') || new.snapshot::text, 'sha256'),
    'hex'
  );
  return new;
end $$;

create trigger abc_c07d_registro_chain_lock
before insert on public.abc_c07d_registros_fiscales
for each row execute function private.abc_c07d_normalize_registro();

create function public.abc_c07d_registrar_documento_fiscal(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_documento_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_entidad uuid;
  v_documento public.abc_c05_documentos_emitidos%rowtype;
  v_anterior public.abc_c07d_registros_fiscales%rowtype;
  v_registro public.abc_c07d_registros_fiscales%rowtype;
  v_snapshot jsonb;
  v_hash text;
  v_secuencia bigint;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_EMISOR_CAMBIAR') then
    raise exception 'abc_registro_fiscal_no_autorizado';
  end if;
  if p_operation_id is null or p_documento_id is null then
    raise exception 'registro_fiscal_parametros_invalidos';
  end if;
  v_entidad := private.abc_c05_entidad_para_local(p_empresa_id, p_local_id);

  select * into v_registro
    from public.abc_c07d_registros_fiscales r
   where r.empresa_id = p_empresa_id
     and r.entidad_fiscal_id = v_entidad
     and r.operation_id = p_operation_id;
  if found then
    return jsonb_build_object(
      'ok', true, 'replayed', true, 'registro_id', v_registro.id,
      'secuencia', v_registro.secuencia, 'hash_sha256', v_registro.hash_sha256,
      'cola_estado', (select c.estado from public.abc_c07d_cola_fiscal c where c.registro_id = v_registro.id)
    );
  end if;

  select * into v_documento
    from public.abc_c05_documentos_emitidos d
   where d.empresa_id = p_empresa_id
     and d.local_id = p_local_id
     and d.entidad_fiscal_id = v_entidad
     and d.id = p_documento_id
   for update;
  if not found then raise exception 'documento_fiscal_no_encontrado'; end if;

  if exists (
    select 1 from public.abc_c07d_registros_fiscales r
     where r.empresa_id = p_empresa_id
       and r.entidad_fiscal_id = v_entidad
       and r.documento_id = p_documento_id
       and r.evento = 'EMISION'
  ) then
    raise exception 'documento_fiscal_ya_registrado';
  end if;

  select * into v_anterior
    from public.abc_c07d_registros_fiscales r
   where r.empresa_id = p_empresa_id
     and r.entidad_fiscal_id = v_entidad
   order by r.secuencia desc
   limit 1
   for update;
  v_secuencia := coalesce(v_anterior.secuencia, 0) + 1;
  v_snapshot := jsonb_build_object(
    'empresa_id', v_documento.empresa_id,
    'entidad_fiscal_id', v_documento.entidad_fiscal_id,
    'local_id', v_documento.local_id,
    'documento_id', v_documento.id,
    'tipo_documento', v_documento.tipo_documento,
    'codigo_serie', v_documento.codigo_serie,
    'numero', v_documento.numero,
    'estado_documental', v_documento.estado,
    'documento_origen_id', v_documento.documento_origen_id,
    'resultado', v_documento.resultado,
    'payload', coalesce(p_payload, '{}'::jsonb)
  );
  v_hash := encode(
    extensions.digest(coalesce(v_anterior.hash_sha256, '') || v_snapshot::text, 'sha256'),
    'hex'
  );
  insert into public.abc_c07d_registros_fiscales(
    empresa_id, entidad_fiscal_id, local_id, documento_id, secuencia,
    evento, estado, snapshot, hash_anterior_sha256, hash_sha256,
    operation_id, actor_user_id
  ) values (
    p_empresa_id, v_entidad, p_local_id, v_documento.id, v_secuencia,
    'EMISION', 'CONFIRMADO', v_snapshot, v_anterior.hash_sha256, v_hash,
    p_operation_id, auth.uid()
  ) returning * into v_registro;
  insert into public.abc_c07d_cola_fiscal(
    empresa_id, entidad_fiscal_id, local_id, registro_id, operation_id, payload
  ) values (
    p_empresa_id, v_entidad, p_local_id, v_registro.id, p_operation_id,
    jsonb_build_object('registro_id', v_registro.id, 'snapshot', v_snapshot)
  );
  return jsonb_build_object(
    'ok', true, 'replayed', false, 'registro_id', v_registro.id,
    'secuencia', v_registro.secuencia, 'hash_anterior_sha256', v_registro.hash_anterior_sha256,
    'hash_sha256', v_registro.hash_sha256, 'cola_estado', 'PENDIENTE'
  );
end $$;

create function public.abc_c07d_reclamar_cola_fiscal(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_limite integer default 10
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_entidad uuid;
  v_items jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_EMISOR_CAMBIAR') then
    raise exception 'abc_cola_fiscal_no_autorizada';
  end if;
  if p_operation_id is null or p_limite is null or p_limite < 1 or p_limite > 50 then
    raise exception 'cola_fiscal_parametros_invalidos';
  end if;
  v_entidad := private.abc_c05_entidad_para_local(p_empresa_id, p_local_id);
  with candidatos as (
    select c.id
      from public.abc_c07d_cola_fiscal c
     where c.empresa_id = p_empresa_id
       and c.entidad_fiscal_id = v_entidad
       and c.disponible_at <= now()
       and (c.estado = 'PENDIENTE' or (c.estado = 'EN_PROCESO' and c.lease_until < now()))
     order by c.disponible_at, c.id
     limit p_limite
     for update skip locked
  ), actualizados as (
    update public.abc_c07d_cola_fiscal c
       set estado = 'EN_PROCESO',
           intentos = c.intentos + 1,
           claim_token = p_operation_id,
           lease_until = now() + interval '5 minutes',
           updated_at = now()
      from candidatos x
     where c.id = x.id
     returning c.id, c.registro_id, c.operation_id, c.intentos, c.lease_until
  )
  select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb)
    into v_items
    from actualizados a;
  return jsonb_build_object('ok', true, 'items', v_items);
end $$;

create function public.abc_c07d_resolver_cola_fiscal(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cola_id uuid,
  p_estado text,
  p_resultado jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_entidad uuid;
  v_cola public.abc_c07d_cola_fiscal%rowtype;
  v_estado text := upper(btrim(coalesce(p_estado, '')));
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_EMISOR_CAMBIAR') then
    raise exception 'abc_cola_fiscal_no_autorizada';
  end if;
  if p_operation_id is null or p_cola_id is null
     or v_estado not in ('ACEPTADO','RECHAZADO','ERROR','DESCONOCIDO') then
    raise exception 'resolucion_cola_fiscal_parametros_invalidos';
  end if;
  v_entidad := private.abc_c05_entidad_para_local(p_empresa_id, p_local_id);
  select * into v_cola
    from public.abc_c07d_cola_fiscal c
   where c.id = p_cola_id
     and c.empresa_id = p_empresa_id
     and c.entidad_fiscal_id = v_entidad
   for update;
  if not found then raise exception 'cola_fiscal_no_encontrada'; end if;
  if v_cola.estado <> 'EN_PROCESO' or v_cola.claim_token <> p_operation_id then
    raise exception 'cola_fiscal_claim_invalido';
  end if;
  update public.abc_c07d_cola_fiscal
     set estado = v_estado,
         respuesta = coalesce(p_resultado, '{}'::jsonb),
         ultimo_error = case when v_estado = 'ERROR' then coalesce(p_resultado->>'message', 'error_no_especificado') else null end,
         claim_token = null,
         lease_until = null,
         updated_at = now()
   where id = v_cola.id;
  return jsonb_build_object('ok', true, 'cola_id', v_cola.id, 'estado', v_estado);
end $$;

revoke all on table public.abc_c07d_registros_fiscales, public.abc_c07d_cola_fiscal from public, anon, authenticated, service_role;
alter table public.abc_c07d_registros_fiscales enable row level security;
alter table public.abc_c07d_cola_fiscal enable row level security;
revoke all on function private.abc_c07d_guard_registro() from public, anon, authenticated, service_role;
revoke all on function private.abc_c07d_normalize_registro() from public, anon, authenticated, service_role;
revoke all on function public.abc_c07d_registrar_documento_fiscal(text, text, text, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.abc_c07d_reclamar_cola_fiscal(text, text, text, integer) from public, anon, authenticated, service_role;
revoke all on function public.abc_c07d_resolver_cola_fiscal(text, text, text, uuid, text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.abc_c07d_registrar_documento_fiscal(text, text, text, uuid, jsonb) to authenticated;
grant execute on function public.abc_c07d_reclamar_cola_fiscal(text, text, text, integer) to authenticated;
grant execute on function public.abc_c07d_resolver_cola_fiscal(text, text, text, uuid, text, jsonb) to authenticated;
