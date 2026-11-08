-- C07-D Paso maestro 3 — variante de infraestructura productiva segura
--
-- Este artefacto instala únicamente infraestructura y controles. No copia
-- fixtures, empresas, registros ni configuración de QA. No crea el adaptador
-- SIMULADOR_C07D. El transporte fiscal permanece DISABLED y la emisión queda
-- bloqueada hasta una configuración y un adaptador aprobados.
--
-- Orden de aplicación: C05 reconcile -> cadena/cola -> hardening -> índices
-- -> checkout bloqueado -> configuración sin seed -> wiring -> D3 sandbox.
-- Aplicar solo después de ejecutar 000_c07d_production_preflight.sql.

set local lock_timeout = '10s';
set local statement_timeout = '60s';


-- ===== BEGIN 20261027130000_abc_f7_c07d_c05_reconcile.sql =====
-- ABC F7 C07-D. Reconciliacion fiscal de C05 por entidad emisora.
-- QA-only en esta etapa. No contiene transporte AEAT ni secretos.

do $$
declare
  v_missing text[] := array[]::text[];
  v_ambiguo boolean;
begin
  if to_regclass('public.abc_c05_series_documentales') is null then
    v_missing := array_append(v_missing, 'abc_c05_series_documentales');
  end if;
  if to_regclass('public.abc_c05_documentos_emitidos') is null then
    v_missing := array_append(v_missing, 'abc_c05_documentos_emitidos');
  end if;
  if to_regclass('public.entidades_fiscales') is null then
    v_missing := array_append(v_missing, 'entidades_fiscales');
  end if;
  if to_regclass('public.entidad_fiscal_locales') is null then
    v_missing := array_append(v_missing, 'entidad_fiscal_locales');
  end if;
  if cardinality(v_missing) > 0 then
    raise exception 'ABC_F7_C07D_C05_RECONCILE_PREFLIGHT_FALLO:%', array_to_string(v_missing, ',');
  end if;

  select exists (
    select 1
      from public.abc_c05_series_documentales s
      left join public.entidad_fiscal_locales efl
        on efl.empresa_id = s.empresa_id
       and efl.local_id = s.local_id
       and efl.activa = true
     group by s.id
     having count(efl.entidad_fiscal_id) <> 1
  ) into v_ambiguo;
  if v_ambiguo then
    raise exception 'ABC_F7_C07D_C05_RECONCILE_AMBIGUO:series_sin_un_emisor_activo';
  end if;

  select exists (
    select 1
      from public.abc_c05_documentos_emitidos d
      left join public.entidad_fiscal_locales efl
        on efl.empresa_id = d.empresa_id
       and efl.local_id = d.local_id
       and efl.activa = true
     group by d.id
     having count(efl.entidad_fiscal_id) <> 1
  ) into v_ambiguo;
  if v_ambiguo then
    raise exception 'ABC_F7_C07D_C05_RECONCILE_AMBIGUO:documentos_sin_un_emisor_activo';
  end if;

  select exists (
    select 1
      from public.abc_c05_series_documentales s
      join public.entidad_fiscal_locales efl
        on efl.empresa_id = s.empresa_id
       and efl.local_id = s.local_id
       and efl.activa = true
     group by s.empresa_id, efl.entidad_fiscal_id, s.tipo_documento, s.codigo_serie
     having count(*) > 1
  ) into v_ambiguo;
  if v_ambiguo then
    raise exception 'ABC_F7_C07D_C05_RECONCILE_CONFLICTO:series_repetidas_por_emisor';
  end if;
end $$;

alter table public.abc_c05_series_documentales
  add column if not exists entidad_fiscal_id uuid;

alter table public.abc_c05_documentos_emitidos
  add column if not exists entidad_fiscal_id uuid;

update public.abc_c05_series_documentales s
   set entidad_fiscal_id = efl.entidad_fiscal_id
  from public.entidad_fiscal_locales efl
 where efl.empresa_id = s.empresa_id
   and efl.local_id = s.local_id
   and efl.activa = true;

update public.abc_c05_documentos_emitidos d
   set entidad_fiscal_id = s.entidad_fiscal_id
  from public.abc_c05_series_documentales s
 where s.id = d.serie_id;

do $$
begin
  if exists (select 1 from public.abc_c05_series_documentales where entidad_fiscal_id is null)
     or exists (select 1 from public.abc_c05_documentos_emitidos where entidad_fiscal_id is null) then
    raise exception 'ABC_F7_C07D_C05_RECONCILE_FALLO:backfill_incompleto';
  end if;
end $$;

alter table public.abc_c05_series_documentales
  alter column entidad_fiscal_id set not null;
alter table public.abc_c05_documentos_emitidos
  alter column entidad_fiscal_id set not null;

alter table public.abc_c05_series_documentales
  drop constraint if exists abc_c05_serie_scope_key;
alter table public.abc_c05_documentos_emitidos
  drop constraint if exists abc_c05_documento_numero_uq;

alter table public.abc_c05_series_documentales
  add constraint abc_c05_serie_entidad_fk
  foreign key (empresa_id, entidad_fiscal_id)
  references public.entidades_fiscales(empresa_id, id)
  on delete restrict;

alter table public.abc_c05_series_documentales
  add constraint abc_c05_serie_entidad_local_fk
  foreign key (empresa_id, local_id, entidad_fiscal_id)
  references public.entidad_fiscal_locales(empresa_id, local_id, entidad_fiscal_id)
  on delete restrict;

alter table public.abc_c05_documentos_emitidos
  add constraint abc_c05_documento_entidad_fk
  foreign key (empresa_id, entidad_fiscal_id)
  references public.entidades_fiscales(empresa_id, id)
  on delete restrict;

alter table public.abc_c05_documentos_emitidos
  add constraint abc_c05_documento_entidad_local_fk
  foreign key (empresa_id, local_id, entidad_fiscal_id)
  references public.entidad_fiscal_locales(empresa_id, local_id, entidad_fiscal_id)
  on delete restrict;

alter table public.abc_c05_series_documentales
  add constraint abc_c05_serie_entidad_scope_key
  unique (empresa_id, entidad_fiscal_id, tipo_documento, codigo_serie);

alter table public.abc_c05_documentos_emitidos
  add constraint abc_c05_documento_entidad_numero_uq
  unique (empresa_id, entidad_fiscal_id, tipo_documento, codigo_serie, numero);

create index if not exists abc_c05_serie_entidad_idx
  on public.abc_c05_series_documentales(empresa_id, entidad_fiscal_id, tipo_documento, codigo_serie);

create index if not exists abc_c05_documento_entidad_created_idx
  on public.abc_c05_documentos_emitidos(empresa_id, entidad_fiscal_id, created_at desc);

create or replace function private.abc_c05_entidad_para_local(
  p_empresa_id text,
  p_local_id text
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_entidad uuid;
  v_count integer;
begin
  select count(*)::integer into v_count
    from public.entidad_fiscal_locales efl
   where efl.empresa_id = p_empresa_id
     and efl.local_id = p_local_id
     and efl.activa = true;
  if v_count <> 1 then
    raise exception 'emisor_fiscal_ambiguo';
  end if;
  select efl.entidad_fiscal_id into v_entidad
    from public.entidad_fiscal_locales efl
   where efl.empresa_id = p_empresa_id
     and efl.local_id = p_local_id
     and efl.activa = true;
  return v_entidad;
end $$;

create or replace function public.abc_configurar_serie_documental(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_tipo_documento text,
  p_codigo_serie text,
  p_nombre text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cmd jsonb;
  v_result jsonb;
  v_request jsonb;
  v_tipo text := upper(btrim(coalesce(p_tipo_documento, '')));
  v_codigo text := upper(btrim(coalesce(p_codigo_serie, '')));
  v_nombre text := nullif(btrim(coalesce(p_nombre, '')), '');
  v_serie public.abc_c05_series_documentales%rowtype;
  v_entidad uuid;
  v_nueva boolean;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_EMISOR_CAMBIAR') then
    raise exception 'abc_serie_no_autorizada';
  end if;
  if p_operation_id is null
     or v_tipo !~ '^[A-Z][A-Z0-9_]{1,39}$'
     or v_codigo !~ '^[A-Z0-9][A-Z0-9._/-]{0,19}$' then
    raise exception 'serie_documental_parametros_invalidos';
  end if;
  v_entidad := private.abc_c05_entidad_para_local(p_empresa_id, p_local_id);
  v_request := jsonb_build_object(
    'tipo_documento', v_tipo,
    'codigo_serie', v_codigo,
    'nombre', v_nombre,
    'entidad_fiscal_id', v_entidad
  );
  v_cmd := private.abc_operacion_iniciar(
    p_operation_id, p_empresa_id, p_local_id,
    'ABC_CONFIGURAR_SERIE_DOCUMENTAL', v_request, null
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado', v_cmd);
  end if;

  select * into v_serie
    from public.abc_c05_series_documentales s
   where s.empresa_id = p_empresa_id
     and s.entidad_fiscal_id = v_entidad
     and s.tipo_documento = v_tipo
     and s.codigo_serie = v_codigo
   for update;
  v_nueva := not found;
  if v_nueva then
    insert into public.abc_c05_series_documentales(
      empresa_id, local_id, entidad_fiscal_id, tipo_documento,
      codigo_serie, nombre, autoridad, siguiente_numero, activa
    ) values (
      p_empresa_id, p_local_id, v_entidad, v_tipo,
      v_codigo, v_nombre, 'INTERNA', 1, true
    ) returning * into v_serie;
  elsif v_serie.local_id <> p_local_id then
    raise exception 'serie_documental_ya_configurada_en_otro_local';
  elsif not v_serie.activa then
    update public.abc_c05_series_documentales
       set activa = true, nombre = coalesce(v_nombre, nombre), updated_at = now()
     where id = v_serie.id
     returning * into v_serie;
  end if;

  v_result := jsonb_build_object(
    'ok', true,
    'serie_id', v_serie.id,
    'nueva', v_nueva,
    'entidad_fiscal_id', v_serie.entidad_fiscal_id,
    'tipo_documento', v_serie.tipo_documento,
    'codigo_serie', v_serie.codigo_serie,
    'siguiente_numero', v_serie.siguiente_numero,
    'activa', v_serie.activa
  );
  perform private.abc_operacion_completar(p_operation_id, v_result);
  return v_result;
exception when others then
  begin
    perform private.abc_operacion_fallar(
      p_operation_id,
      jsonb_build_object('sqlstate', sqlstate, 'message', sqlerrm)
    );
  exception when others then null;
  end;
  raise;
end $$;

create or replace function public.abc_reservar_numero_documental(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_tipo_documento text,
  p_codigo_serie text,
  p_documento_origen_id text,
  p_metadata jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cmd jsonb;
  v_result jsonb;
  v_request jsonb;
  v_serie public.abc_c05_series_documentales%rowtype;
  v_documento public.abc_c05_documentos_emitidos%rowtype;
  v_tipo text := upper(btrim(coalesce(p_tipo_documento, '')));
  v_codigo text := upper(btrim(coalesce(p_codigo_serie, '')));
  v_numero bigint;
  v_entidad uuid;
  v_session_id uuid;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_EMISOR_CAMBIAR') then
    raise exception 'abc_documento_no_autorizado';
  end if;
  if p_operation_id is null or p_empresa_id is null or p_local_id is null
     or v_tipo !~ '^[A-Z][A-Z0-9_]{1,39}$'
     or v_codigo !~ '^[A-Z0-9][A-Z0-9._/-]{0,19}$' then
    raise exception 'reserva_documental_parametros_invalidos';
  end if;
  v_entidad := private.abc_c05_entidad_para_local(p_empresa_id, p_local_id);
  if coalesce(p_metadata, '{}'::jsonb) ? 'session_id' then
    begin
      v_session_id := nullif(p_metadata->>'session_id', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'sesion_documental_invalida';
    end;
    if v_session_id is null or not exists (
      select 1 from public.caja_sesiones s
       where s.empresa_id = p_empresa_id
         and s.local_id = p_local_id
         and s.id = v_session_id
    ) then
      raise exception 'sesion_documental_no_encontrada';
    end if;
  end if;
  v_request := jsonb_build_object(
    'tipo_documento', v_tipo,
    'codigo_serie', v_codigo,
    'documento_origen_id', p_documento_origen_id,
    'metadata', coalesce(p_metadata, '{}'::jsonb),
    'entidad_fiscal_id', v_entidad
  );
  v_cmd := private.abc_operacion_iniciar(
    p_operation_id, p_empresa_id, p_local_id,
    'ABC_RESERVAR_NUMERO_DOCUMENTAL', v_request, null
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado', v_cmd);
  end if;

  select * into v_serie
    from public.abc_c05_series_documentales s
   where s.empresa_id = p_empresa_id
     and s.entidad_fiscal_id = v_entidad
     and s.tipo_documento = v_tipo
     and s.codigo_serie = v_codigo
     and s.activa = true
   for update;
  if not found then raise exception 'serie_documental_no_activa'; end if;
  if v_serie.siguiente_numero = 9223372036854775807 then
    raise exception 'serie_documental_agotada';
  end if;
  v_numero := v_serie.siguiente_numero;
  update public.abc_c05_series_documentales
     set siguiente_numero = v_numero + 1, updated_at = now()
   where id = v_serie.id;
  insert into public.abc_c05_documentos_emitidos(
    empresa_id, local_id, entidad_fiscal_id, serie_id,
    tipo_documento, codigo_serie, numero, estado, operation_id,
    documento_origen_id, session_id, resultado
  ) values (
    p_empresa_id, p_local_id, v_entidad, v_serie.id,
    v_tipo, v_codigo, v_numero, 'RESERVADO', p_operation_id,
    p_documento_origen_id, v_session_id, v_request
  ) returning * into v_documento;
  insert into public.abc_eventos(
    empresa_id, local_id, operation_id, aggregate_type, aggregate_id,
    event_type, payload, actor_user_id, terminal_id, occurred_at, operating_day
  ) values (
    p_empresa_id, p_local_id, p_operation_id, 'DOCUMENTO', v_documento.id::text,
    'DOCUMENTO_NUMERO_RESERVADO',
    jsonb_build_object(
      'tipo_documento', v_tipo, 'codigo_serie', v_codigo,
      'numero', v_numero, 'documento_origen_id', p_documento_origen_id,
      'entidad_fiscal_id', v_entidad, 'session_id', v_session_id
    ),
    auth.uid(), null, now(), current_date
  );
  v_result := jsonb_build_object(
    'ok', true, 'documento_id', v_documento.id, 'estado', 'RESERVADO',
    'entidad_fiscal_id', v_entidad, 'tipo_documento', v_tipo,
    'codigo_serie', v_codigo, 'numero', v_numero,
    'autoridad', v_serie.autoridad, 'session_id', v_session_id
  );
  perform private.abc_operacion_completar(p_operation_id, v_result);
  return v_result;
exception when others then
  begin
    perform private.abc_operacion_fallar(
      p_operation_id,
      jsonb_build_object('sqlstate', sqlstate, 'message', sqlerrm)
    );
  exception when others then null;
  end;
  raise;
end $$;

revoke all on function private.abc_c05_entidad_para_local(text, text) from public, anon, authenticated, service_role;
revoke all on function public.abc_configurar_serie_documental(text, text, text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.abc_reservar_numero_documental(text, text, text, text, text, text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.abc_configurar_serie_documental(text, text, text, text, text, text) to authenticated;
grant execute on function public.abc_reservar_numero_documental(text, text, text, text, text, text, jsonb) to authenticated;


-- ===== END 20261027130000_abc_f7_c07d_c05_reconcile.sql =====

-- ===== BEGIN 20261027131500_abc_f7_c07d_fiscal_chain_queue.sql =====
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


-- ===== END 20261027131500_abc_f7_c07d_fiscal_chain_queue.sql =====

-- ===== BEGIN 20261027133000_abc_f7_c07d_chain_hardening.sql =====
-- ABC F7 C07-D. Hardening de concurrencia de la cadena fiscal.
-- Se conserva como migracion separada para QA ya reconciliada.

do $$
begin
  if to_regclass('public.abc_c07d_registros_fiscales') is null then
    raise exception 'ABC_F7_C07D_HARDENING_PREFLIGHT_FALLO:registro_fiscal_no_disponible';
  end if;
end $$;

create or replace function private.abc_c07d_normalize_registro()
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

drop trigger if exists abc_c07d_registro_chain_lock
  on public.abc_c07d_registros_fiscales;
create trigger abc_c07d_registro_chain_lock
before insert on public.abc_c07d_registros_fiscales
for each row execute function private.abc_c07d_normalize_registro();

revoke all on function private.abc_c07d_normalize_registro() from public, anon, authenticated, service_role;


-- ===== END 20261027133000_abc_f7_c07d_chain_hardening.sql =====

-- ===== BEGIN 20261027134500_abc_f7_c07d_fk_indexes.sql =====
-- ABC F7 C07-D. Indices de cobertura de las claves foraneas fiscales.

create index if not exists abc_c05_serie_scope_fk_idx
  on public.abc_c05_series_documentales(empresa_id, local_id);
create index if not exists abc_c05_serie_entidad_local_fk_idx
  on public.abc_c05_series_documentales(empresa_id, local_id, entidad_fiscal_id);
create index if not exists abc_c05_documento_serie_fk_idx
  on public.abc_c05_documentos_emitidos(serie_id);
create index if not exists abc_c05_documento_entidad_local_fk_idx
  on public.abc_c05_documentos_emitidos(empresa_id, local_id, entidad_fiscal_id);
create index if not exists abc_c07d_registro_documento_fk_idx
  on public.abc_c07d_registros_fiscales(documento_id);
create index if not exists abc_c07d_registro_local_entidad_idx
  on public.abc_c07d_registros_fiscales(empresa_id, local_id, entidad_fiscal_id);
create index if not exists abc_c07d_cola_registro_fk_idx
  on public.abc_c07d_cola_fiscal(registro_id);
create index if not exists abc_c07d_cola_local_entidad_idx
  on public.abc_c07d_cola_fiscal(empresa_id, local_id, entidad_fiscal_id);


-- ===== END 20261027134500_abc_f7_c07d_fk_indexes.sql =====

-- ===== BEGIN 20261027135000_abc_f7_c07d_entity_fk_index.sql =====
-- ABC F7 C07-D. Cobertura del FK empresa/emisor de la relacion local-emisor.

create index if not exists entidad_fiscal_locales_entidad_fk_idx
  on public.entidad_fiscal_locales(empresa_id, entidad_fiscal_id);


-- ===== END 20261027135000_abc_f7_c07d_entity_fk_index.sql =====

-- ===== BEGIN 20261027143000_abc_f7_c07d_checkout_emit_qa.sql =====
-- ABC F7 C07-D.1 — enlaza checkout COMPLETADO con C05 y la cola C07-D.
-- QA-only en esta etapa: no llama a AEAT, no recibe certificados y no
-- almacena secretos. La serie se recibe desde la configuración del emisor.

do $$
begin
  if to_regprocedure('public.abc_reservar_numero_documental(text,text,text,text,text,text,jsonb)') is null
     or to_regprocedure('public.abc_resolver_emision_documental(text,text,text,uuid,text,jsonb)') is null
     or to_regprocedure('public.abc_c07d_registrar_documento_fiscal(text,text,text,uuid,jsonb)') is null then
    raise exception 'ABC_F7_C07D_D1_PREFLIGHT_FALLO:dependencias_c05_c07d_no_disponibles';
  end if;
end $$;

create or replace function public.abc_c07d_emitir_checkout(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid,
  p_tipo_documento text default 'FACTURA',
  p_codigo_serie text default 'TPV'
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
  v_result jsonb;
  v_checkout public.checkouts%rowtype;
  v_venta record;
  v_documento public.abc_c05_documentos_emitidos%rowtype;
  v_reserva jsonb;
  v_emision jsonb;
  v_registro jsonb;
  v_documentos jsonb := '[]'::jsonb;
  v_tipo text := upper(btrim(coalesce(p_tipo_documento, '')));
  v_serie text := upper(btrim(coalesce(p_codigo_serie, '')));
  v_entidad uuid;
  v_numero_documentos integer := 0;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_EMISOR_CAMBIAR') then
    raise exception 'abc_documento_no_autorizado';
  end if;
  if p_operation_id is null or nullif(btrim(p_operation_id), '') is null
     or p_empresa_id is null or p_local_id is null or p_cuenta_id is null
     or v_tipo !~ '^[A-Z][A-Z0-9_]{1,39}$'
     or v_serie !~ '^[A-Z0-9][A-Z0-9._/-]{0,19}$' then
    raise exception 'c07d_checkout_parametros_invalidos';
  end if;

  v_entidad := private.abc_c05_entidad_para_local(p_empresa_id, p_local_id);
  v_request := jsonb_build_object(
    'cuenta_id', p_cuenta_id,
    'tipo_documento', v_tipo,
    'codigo_serie', v_serie,
    'qa_only', true,
    'aeat_transport', 'DISABLED'
  );
  v_cmd := private.abc_operacion_iniciar(
    p_operation_id, p_empresa_id, p_local_id,
    'ABC_C07D_EMITIR_CHECKOUT', v_request, null
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado', v_cmd);
  end if;

  select c.* into v_checkout
    from public.checkouts c
   where c.empresa_id = p_empresa_id
     and c.local_id = p_local_id
     and c.cuenta_id = p_cuenta_id
     and c.estado = 'COMPLETADO'
   order by c.completed_at desc nulls last, c.created_at desc
   limit 1
   for update;
  if not found then
    raise exception 'c07d_checkout_no_completado';
  end if;

  if not exists (
    select 1 from public.checkout_ventas cv
     where cv.empresa_id = p_empresa_id
       and cv.local_id = p_local_id
       and cv.checkout_id = v_checkout.id
  ) then
    raise exception 'c07d_checkout_sin_ventas';
  end if;

  for v_venta in
    select cv.venta_fiscal_id, cv.importe_objetivo,
           vf.entidad_fiscal_id, vf.currency_code
      from public.checkout_ventas cv
      join public.ventas_fiscales vf
        on vf.empresa_id = cv.empresa_id
       and vf.local_id = cv.local_id
       and vf.id = cv.venta_fiscal_id
     where cv.empresa_id = p_empresa_id
       and cv.local_id = p_local_id
       and cv.checkout_id = v_checkout.id
     order by cv.venta_fiscal_id
  loop
    select d.* into v_documento
      from public.abc_c05_documentos_emitidos d
     where d.empresa_id = p_empresa_id
       and d.local_id = p_local_id
       and d.entidad_fiscal_id = v_entidad
       and d.documento_origen_id = v_venta.venta_fiscal_id::text
       and d.tipo_documento = v_tipo
       and d.codigo_serie = v_serie
     order by d.created_at desc
     limit 1
     for update;

    if not found then
      v_reserva := public.abc_reservar_numero_documental(
        p_operation_id || ':reserve:' || v_venta.venta_fiscal_id::text,
        p_empresa_id,
        p_local_id,
        v_tipo,
        v_serie,
        v_venta.venta_fiscal_id::text,
        jsonb_build_object(
          'checkout_id', v_checkout.id,
          'venta_fiscal_id', v_venta.venta_fiscal_id,
          'entidad_fiscal_id', v_entidad,
          'qa_only', true,
          'aeat_transport', 'DISABLED'
        )
      );
      select d.* into v_documento
        from public.abc_c05_documentos_emitidos d
       where d.id = (v_reserva->>'documento_id')::uuid
       for update;
    end if;

    if v_documento.estado = 'RESERVADO' then
      v_emision := public.abc_resolver_emision_documental(
        p_operation_id || ':emit:' || v_documento.id::text,
        p_empresa_id,
        p_local_id,
        v_documento.id,
        'EMITIDO',
        jsonb_build_object(
          'qa_only', true,
          'aeat_transport', 'DISABLED',
          'checkout_id', v_checkout.id,
          'venta_fiscal_id', v_venta.venta_fiscal_id,
          'cobro_confirmado', true
        )
      );
    end if;

    v_registro := public.abc_c07d_registrar_documento_fiscal(
      p_operation_id || ':c07d:' || v_documento.id::text,
      p_empresa_id,
      p_local_id,
      v_documento.id,
      jsonb_build_object(
        'qa_only', true,
        'aeat_transport', 'DISABLED',
        'checkout_id', v_checkout.id,
        'venta_fiscal_id', v_venta.venta_fiscal_id,
        'importe', v_venta.importe_objetivo,
        'currency_code', v_venta.currency_code,
        'cobro_confirmado', true
      )
    );

    v_numero_documentos := v_numero_documentos + 1;
    v_documentos := v_documentos || jsonb_build_array(jsonb_build_object(
      'venta_fiscal_id', v_venta.venta_fiscal_id,
      'documento_id', v_documento.id,
      'tipo_documento', v_documento.tipo_documento,
      'codigo_serie', v_documento.codigo_serie,
      'numero', v_documento.numero,
      'estado', 'EMITIDO',
      'registro_id', v_registro->'registro_id',
      'secuencia', v_registro->'secuencia',
      'hash_sha256', v_registro->'hash_sha256',
      'cola_estado', v_registro->'cola_estado',
      'qa_only', true,
      'aeat_transport', 'DISABLED'
    ));
  end loop;

  v_result := jsonb_build_object(
    'ok', true,
    'replayed', false,
    'checkout_id', v_checkout.id,
    'cuenta_id', p_cuenta_id,
    'tipo_documento', v_tipo,
    'codigo_serie', v_serie,
    'documentos', v_documentos,
    'numero_documentos', v_numero_documentos,
    'cola_estado', 'PENDIENTE',
    'qa_only', true,
    'aeat_transport', 'DISABLED'
  );
  perform private.abc_operacion_completar(p_operation_id, v_result);
  return v_result;
exception when others then
  begin
    perform private.abc_operacion_fallar(
      p_operation_id,
      jsonb_build_object('sqlstate', sqlstate, 'message', sqlerrm)
    );
  exception when others then null;
  end;
  raise;
end $$;

create or replace function public.abc_c07d_estado_cuenta(
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_entidad uuid;
  v_documentos jsonb;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_COBRO_INICIAR') then
    raise exception 'abc_documento_no_autorizado';
  end if;
  if p_empresa_id is null or p_local_id is null or p_cuenta_id is null then
    raise exception 'c07d_estado_parametros_invalidos';
  end if;
  v_entidad := private.abc_c05_entidad_para_local(p_empresa_id, p_local_id);
  select coalesce(jsonb_agg(jsonb_build_object(
    'venta_fiscal_id', vf.id,
    'documento_id', d.id,
    'tipo_documento', d.tipo_documento,
    'codigo_serie', d.codigo_serie,
    'numero', d.numero,
    'estado', d.estado,
    'registro_id', r.id,
    'secuencia', r.secuencia,
    'hash_sha256', r.hash_sha256,
    'cola_id', q.id,
    'cola_estado', q.estado,
    'created_at', d.created_at,
    'qa_only', true,
    'aeat_transport', 'DISABLED'
  ) order by d.created_at), '[]'::jsonb)
    into v_documentos
    from public.abc_c05_documentos_emitidos d
    join public.ventas_fiscales vf
      on vf.empresa_id = d.empresa_id
     and vf.local_id = d.local_id
     and vf.id::text = d.documento_origen_id
    left join public.abc_c07d_registros_fiscales r
      on r.empresa_id = d.empresa_id
     and r.entidad_fiscal_id = d.entidad_fiscal_id
     and r.documento_id = d.id
    left join public.abc_c07d_cola_fiscal q
      on q.empresa_id = r.empresa_id
     and q.entidad_fiscal_id = r.entidad_fiscal_id
     and q.registro_id = r.id
   where d.empresa_id = p_empresa_id
     and d.local_id = p_local_id
     and d.entidad_fiscal_id = v_entidad
     and vf.cuenta_id = p_cuenta_id;

  return jsonb_build_object(
    'ok', true,
    'cuenta_id', p_cuenta_id,
    'entidad_fiscal_id', v_entidad,
    'documentos', v_documentos,
    'qa_only', true,
    'aeat_transport', 'DISABLED'
  );
end $$;

revoke all on function public.abc_c07d_emitir_checkout(text,text,text,uuid,text,text)
  from public, anon, authenticated, service_role;
revoke all on function public.abc_c07d_estado_cuenta(text,text,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.abc_c07d_emitir_checkout(text,text,text,uuid,text,text)
  to authenticated;
grant execute on function public.abc_c07d_estado_cuenta(text,text,uuid)
  to authenticated;


-- ===== END 20261027143000_abc_f7_c07d_checkout_emit_qa.sql =====

-- ===== BEGIN 20261027150000_abc_f7_c07d_d2_emission_config.sql =====
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

-- El seed SIMULADOR_C07D se omite en producción.

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


-- ===== END 20261027150000_abc_f7_c07d_d2_emission_config.sql =====

-- ===== BEGIN 20261027151000_abc_f7_c07d_d2_emission_config_fix.sql =====
-- ABC F7 C07-D.2.1 — reparación del trigger de alcance tras la primera prueba QA.
-- En INSERT no existe OLD; el alcance solo es inmutable durante UPDATE.

create or replace function private.abc_c07d_emision_config_guard()
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

revoke all on function private.abc_c07d_emision_config_guard() from public,anon,authenticated,service_role;


-- ===== END 20261027151000_abc_f7_c07d_d2_emission_config_fix.sql =====

-- ===== BEGIN 20261027152000_abc_f7_c07d_d2_adapter_scope_fix.sql =====
-- ABC F7 C07-D.2.1 — el catálogo de adaptadores no depende de una entidad única.

create or replace function public.abc_c07d_listar_adaptadores_fiscales(
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

revoke all on function public.abc_c07d_listar_adaptadores_fiscales(text,text) from public,anon,authenticated,service_role;
grant execute on function public.abc_c07d_listar_adaptadores_fiscales(text,text) to authenticated;


-- ===== END 20261027152000_abc_f7_c07d_d2_adapter_scope_fix.sql =====

-- ===== BEGIN 20261027160000_abc_f7_c07d_d2_emission_wiring.sql =====
-- ABC F7 C07-D.2.2 — emisión gobernada por configuración fiscal persistente.
-- QA-only en esta etapa: no llama a AEAT, no transporta certificados ni secretos.
-- La serie enviada por el cliente queda como referencia de auditoría; la serie
-- efectiva siempre se resuelve en servidor desde private.abc_c07d_emision_config.

do $$
begin
  if to_regprocedure('private.abc_c07d_resolver_emision_config(text,text,uuid,text)') is null
     or to_regprocedure('public.abc_c07d_registrar_documento_fiscal(text,text,text,uuid,jsonb)') is null
     or to_regprocedure('public.abc_reservar_numero_documental(text,text,text,text,text,text,jsonb)') is null
     or to_regprocedure('public.abc_resolver_emision_documental(text,text,text,uuid,text,jsonb)') is null then
    raise exception 'ABC_F7_C07D_D2_2_PREFLIGHT_FALLO:dependencias_emision_no_disponibles';
  end if;
end $$;

create or replace function public.abc_c07d_emitir_checkout(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cuenta_id uuid,
  p_tipo_documento text default 'FACTURA',
  p_codigo_serie text default null
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
  v_result jsonb;
  v_checkout public.checkouts%rowtype;
  v_venta record;
  v_documento public.abc_c05_documentos_emitidos%rowtype;
  v_reserva jsonb;
  v_emision jsonb;
  v_registro jsonb;
  v_config jsonb;
  v_documentos jsonb := '[]'::jsonb;
  v_tipo text := upper(btrim(coalesce(p_tipo_documento, '')));
  v_serie_resuelta text;
  v_serie_solicitada text := nullif(upper(btrim(coalesce(p_codigo_serie, ''))), '');
  v_entidad_local uuid;
  v_numero_documentos integer := 0;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_EMISOR_CAMBIAR') then
    raise exception 'abc_documento_no_autorizado';
  end if;
  if p_operation_id is null or nullif(btrim(p_operation_id), '') is null
     or p_empresa_id is null or p_local_id is null or p_cuenta_id is null
     or v_tipo !~ '^[A-Z][A-Z0-9_]{1,39}$' then
    raise exception 'c07d_checkout_parametros_invalidos';
  end if;

  v_request := jsonb_build_object(
    'cuenta_id', p_cuenta_id,
    'tipo_documento', v_tipo,
    'serie_solicitada_cliente', v_serie_solicitada,
    'qa_only', true,
    'aeat_transport', 'DISABLED'
  );
  v_cmd := private.abc_operacion_iniciar(
    p_operation_id, p_empresa_id, p_local_id,
    'ABC_C07D_EMITIR_CHECKOUT', v_request, null
  );
  if (v_cmd->>'replayed')::boolean then
    return coalesce(v_cmd->'resultado', v_cmd);
  end if;

  select c.* into v_checkout
    from public.checkouts c
   where c.empresa_id = p_empresa_id
     and c.local_id = p_local_id
     and c.cuenta_id = p_cuenta_id
     and c.estado = 'COMPLETADO'
   order by c.completed_at desc nulls last, c.created_at desc
   limit 1
   for update;
  if not found then
    raise exception 'c07d_checkout_no_completado';
  end if;

  select count(*)::integer into v_numero_documentos
    from public.checkout_ventas cv
   where cv.empresa_id = p_empresa_id
     and cv.local_id = p_local_id
     and cv.checkout_id = v_checkout.id;
  if v_numero_documentos = 0 then
    raise exception 'c07d_checkout_sin_ventas';
  end if;

  -- La cadena C05/C07-D existente trabaja con una única entidad activa por
  -- local. Se comprueba antes de cualquier reserva para evitar emisiones
  -- parciales si el checkout contiene una venta de otra entidad.
  v_entidad_local := private.abc_c05_entidad_para_local(p_empresa_id, p_local_id);

  -- Preflight completo: resolver toda la configuración antes de mutar C05/C07-D.
  for v_venta in
    select cv.venta_fiscal_id, cv.importe_objetivo,
           vf.entidad_fiscal_id, vf.currency_code
      from public.checkout_ventas cv
      join public.ventas_fiscales vf
        on vf.empresa_id = cv.empresa_id
       and vf.local_id = cv.local_id
       and vf.id = cv.venta_fiscal_id
     where cv.empresa_id = p_empresa_id
       and cv.local_id = p_local_id
       and cv.checkout_id = v_checkout.id
     order by cv.venta_fiscal_id
  loop
    if v_venta.entidad_fiscal_id <> v_entidad_local then
      raise exception 'C07D_VENTA_ENTIDAD_NO_CORRESPONDE';
    end if;
    v_config := private.abc_c07d_resolver_emision_config(
      p_empresa_id,
      p_local_id,
      v_venta.entidad_fiscal_id,
      v_tipo
    );
    if v_serie_resuelta is null then
      v_serie_resuelta := upper(btrim(v_config->>'codigo_serie'));
    elsif v_serie_resuelta <> upper(btrim(v_config->>'codigo_serie')) then
      raise exception 'C07D_CHECKOUT_CONFIG_INCONSISTENTE';
    end if;
  end loop;

  for v_venta in
    select cv.venta_fiscal_id, cv.importe_objetivo,
           vf.entidad_fiscal_id, vf.currency_code
      from public.checkout_ventas cv
      join public.ventas_fiscales vf
        on vf.empresa_id = cv.empresa_id
       and vf.local_id = cv.local_id
       and vf.id = cv.venta_fiscal_id
     where cv.empresa_id = p_empresa_id
       and cv.local_id = p_local_id
       and cv.checkout_id = v_checkout.id
     order by cv.venta_fiscal_id
  loop
    select d.* into v_documento
      from public.abc_c05_documentos_emitidos d
     where d.empresa_id = p_empresa_id
       and d.local_id = p_local_id
       and d.entidad_fiscal_id = v_entidad_local
       and d.documento_origen_id = v_venta.venta_fiscal_id::text
       and d.tipo_documento = v_tipo
       and d.codigo_serie = v_serie_resuelta
     order by d.created_at desc
     limit 1
     for update;

    if not found then
      v_reserva := public.abc_reservar_numero_documental(
        p_operation_id || ':reserve:' || v_venta.venta_fiscal_id::text,
        p_empresa_id,
        p_local_id,
        v_tipo,
        v_serie_resuelta,
        v_venta.venta_fiscal_id::text,
        jsonb_build_object(
          'checkout_id', v_checkout.id,
          'venta_fiscal_id', v_venta.venta_fiscal_id,
          'entidad_fiscal_id', v_entidad_local,
          'serie_resuelta_en_servidor', v_serie_resuelta,
          'serie_solicitada_cliente', v_serie_solicitada,
          'qa_only', true,
          'aeat_transport', 'DISABLED'
        )
      );
      select d.* into v_documento
        from public.abc_c05_documentos_emitidos d
       where d.id = (v_reserva->>'documento_id')::uuid
       for update;
    end if;

    if v_documento.estado = 'RESERVADO' then
      v_emision := public.abc_resolver_emision_documental(
        p_operation_id || ':emit:' || v_documento.id::text,
        p_empresa_id,
        p_local_id,
        v_documento.id,
        'EMITIDO',
        jsonb_build_object(
          'checkout_id', v_checkout.id,
          'venta_fiscal_id', v_venta.venta_fiscal_id,
          'serie_resuelta_en_servidor', v_serie_resuelta,
          'serie_solicitada_cliente', v_serie_solicitada,
          'configuracion_fiscal', jsonb_build_object(
            'serie_id', v_config->'configuracion'->>'serie_id',
            'adapter_code', v_config->'configuracion'->>'adapter_code',
            'environment', v_config->'configuracion'->>'environment',
            'version', v_config->'configuracion'->>'version'
          ),
          'cobro_confirmado', true,
          'qa_only', true,
          'aeat_transport', 'DISABLED'
        )
      );
    end if;

    v_registro := public.abc_c07d_registrar_documento_fiscal(
      p_operation_id || ':c07d:' || v_documento.id::text,
      p_empresa_id,
      p_local_id,
      v_documento.id,
      jsonb_build_object(
        'checkout_id', v_checkout.id,
        'venta_fiscal_id', v_venta.venta_fiscal_id,
        'importe', v_venta.importe_objetivo,
        'currency_code', v_venta.currency_code,
        'serie_resuelta_en_servidor', v_serie_resuelta,
        'serie_solicitada_cliente', v_serie_solicitada,
        'configuracion_fiscal', jsonb_build_object(
          'serie_id', v_config->'configuracion'->>'serie_id',
          'adapter_code', v_config->'configuracion'->>'adapter_code',
          'environment', v_config->'configuracion'->>'environment',
          'version', v_config->'configuracion'->>'version'
        ),
        'cobro_confirmado', true,
        'qa_only', true,
        'aeat_transport', 'DISABLED'
      )
    );

    v_documentos := v_documentos || jsonb_build_array(jsonb_build_object(
      'venta_fiscal_id', v_venta.venta_fiscal_id,
      'documento_id', v_documento.id,
      'tipo_documento', v_documento.tipo_documento,
      'codigo_serie', v_documento.codigo_serie,
      'numero', v_documento.numero,
      'estado', 'EMITIDO',
      'registro_id', v_registro->'registro_id',
      'secuencia', v_registro->'secuencia',
      'hash_sha256', v_registro->'hash_sha256',
      'cola_estado', v_registro->'cola_estado',
      'qa_only', true,
      'aeat_transport', 'DISABLED'
    ));
  end loop;

  v_result := jsonb_build_object(
    'ok', true,
    'replayed', false,
    'checkout_id', v_checkout.id,
    'cuenta_id', p_cuenta_id,
    'tipo_documento', v_tipo,
    'codigo_serie', v_serie_resuelta,
    'serie_solicitada_cliente', v_serie_solicitada,
    'serie_resuelta_en_servidor', v_serie_resuelta,
    'configuracion_fiscal', jsonb_build_object(
      'serie_id', v_config->'configuracion'->>'serie_id',
      'adapter_code', v_config->'configuracion'->>'adapter_code',
      'environment', v_config->'configuracion'->>'environment',
      'version', v_config->'configuracion'->>'version'
    ),
    'documentos', v_documentos,
    'numero_documentos', v_numero_documentos,
    'cola_estado', 'PENDIENTE',
    'qa_only', true,
    'aeat_transport', 'DISABLED'
  );
  perform private.abc_operacion_completar(p_operation_id, v_result);
  return v_result;
exception when others then
  begin
    perform private.abc_operacion_fallar(
      p_operation_id,
      jsonb_build_object('sqlstate', sqlstate, 'message', sqlerrm)
    );
  exception when others then null;
  end;
  raise;
end $$;

revoke all on function public.abc_c07d_emitir_checkout(text,text,text,uuid,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.abc_c07d_emitir_checkout(text,text,text,uuid,text,text)
  to authenticated;


-- ===== END 20261027160000_abc_f7_c07d_d2_emission_wiring.sql =====

-- ===== BEGIN 20261027161000_abc_f7_c07d_d2_emission_resolver_lock_fix.sql =====
-- Corrección C07-D.2.2: el resolver toma FOR SHARE para impedir que cambie
-- la configuración durante una emisión, por lo que debe ser VOLATILE.

create or replace function private.abc_c07d_resolver_emision_config(
  p_empresa_id text,
  p_local_id text,
  p_entidad_fiscal_id uuid,
  p_tipo_documento text
)
returns jsonb
language plpgsql
volatile
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

revoke all on function private.abc_c07d_resolver_emision_config(text,text,uuid,text)
  from public, anon, authenticated, service_role;


-- ===== END 20261027161000_abc_f7_c07d_d2_emission_resolver_lock_fix.sql =====

-- ===== BEGIN 20261027162000_abc_f7_c07d_d2_emission_config_indexes.sql =====
-- C07-D.2.2 — índices de cobertura para las FK nuevas de la configuración.
-- No cambia el contrato ni expone las tablas privadas.

create index if not exists abc_c07d_emision_adapter_fk_idx
  on private.abc_c07d_emision_config(adapter_code);

create index if not exists abc_c07d_emision_updated_by_fk_idx
  on private.abc_c07d_emision_config(updated_by);

create index if not exists abc_c07d_revision_actor_fk_idx
  on private.abc_c07d_emision_config_revisiones(actor_user_id);


-- ===== END 20261027162000_abc_f7_c07d_d2_emission_config_indexes.sql =====

-- ===== BEGIN 20261027163000_abc_f7_c07d_d2_3_frontend_config_status.sql =====
-- C07-D.2.3: el TPV consulta el estado fiscal resuelto por servidor.
-- QA primero. No contiene credenciales ni transporte AEAT.

do $$
begin
  if to_regclass('private.abc_c07d_emision_config') is null
     or to_regclass('public.abc_c05_series_documentales') is null
     or to_regprocedure('private.abc_c05_entidad_para_local(text,text)') is null
     or to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then
    raise exception 'ABC_F7_C07D_D2_3_PREFLIGHT_FALLO';
  end if;
end
$$;

create or replace function public.abc_c07d_estado_configuracion_emision(
  p_empresa_id text,
  p_local_id text,
  p_tipo_documento text default 'FACTURA'
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_tipo text := upper(btrim(coalesce(p_tipo_documento, '')));
  v_entidad uuid;
  v_config private.abc_c07d_emision_config%rowtype;
  v_serie public.abc_c05_series_documentales%rowtype;
begin
  if auth.uid() is null
     or not private.abc_tiene_capacidad(p_empresa_id, p_local_id, 'ABC_EMISOR_CAMBIAR') then
    raise exception 'C07D_CONFIG_NO_AUTORIZADO' using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_empresa_id, '')), '') is null
     or nullif(btrim(coalesce(p_local_id, '')), '') is null
     or v_tipo !~ '^[A-Z0-9_:-]{1,40}$' then
    raise exception 'C07D_CONFIG_PARAMETROS_INVALIDOS' using errcode = '22023';
  end if;

  v_entidad := private.abc_c05_entidad_para_local(p_empresa_id, p_local_id);

  select *
    into v_config
    from private.abc_c07d_emision_config c
   where c.empresa_id = p_empresa_id
     and c.local_id = p_local_id
     and c.entidad_fiscal_id = v_entidad
     and c.tipo_documento = v_tipo;

  if not found then
    return jsonb_build_object(
      'ok', true,
      'configurada', false,
      'estado', 'NO_CONFIGURADA',
      'empresa_id', p_empresa_id,
      'local_id', p_local_id,
      'entidad_fiscal_id', v_entidad,
      'tipo_documento', v_tipo
    );
  end if;

  select *
    into v_serie
    from public.abc_c05_series_documentales s
   where s.id = v_config.serie_id
     and s.empresa_id = v_config.empresa_id
     and s.local_id = v_config.local_id
     and s.entidad_fiscal_id = v_config.entidad_fiscal_id
     and s.tipo_documento = v_config.tipo_documento
     and s.activa = true;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'configurada', true,
      'estado', 'INVALIDA',
      'error', 'C07D_CONFIG_SERIE_NO_DISPONIBLE',
      'empresa_id', p_empresa_id,
      'local_id', p_local_id,
      'entidad_fiscal_id', v_entidad,
      'tipo_documento', v_tipo,
      'version', v_config.version
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'configurada', true,
    'estado', upper(coalesce(v_config.estado, '')),
    'configuracion', jsonb_build_object(
      'empresa_id', v_config.empresa_id,
      'local_id', v_config.local_id,
      'entidad_fiscal_id', v_config.entidad_fiscal_id,
      'tipo_documento', v_config.tipo_documento,
      'serie_id', v_config.serie_id,
      'codigo_serie', v_serie.codigo_serie,
      'nombre_serie', v_serie.nombre,
      'adapter_code', v_config.adapter_code,
      'environment', v_config.environment,
      'estado', v_config.estado,
      'version', v_config.version,
      'credential_configured', v_config.credential_ref is not null,
      'updated_at', v_config.updated_at
    )
  );
end
$function$;

revoke all on function public.abc_c07d_estado_configuracion_emision(text, text, text) from public;
revoke all on function public.abc_c07d_estado_configuracion_emision(text, text, text) from anon;
revoke all on function public.abc_c07d_estado_configuracion_emision(text, text, text) from authenticated;
revoke all on function public.abc_c07d_estado_configuracion_emision(text, text, text) from service_role;
grant execute on function public.abc_c07d_estado_configuracion_emision(text, text, text) to authenticated;


-- ===== END 20261027163000_abc_f7_c07d_d2_3_frontend_config_status.sql =====

-- ===== BEGIN 20261027150403_abc_f7_c07d_d3_pilot_sandbox.sql =====
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


-- ===== END 20261027150403_abc_f7_c07d_d3_pilot_sandbox.sql =====


