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
