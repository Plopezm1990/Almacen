-- PM13-P08 — catálogo seguro de cargos personalizados.
-- Solo prepara el contrato servidor para QA; no se aplica automáticamente.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.empresas') is null then v_missing := array_append(v_missing, 'empresas'); end if;
  if to_regclass('public.locales') is null then v_missing := array_append(v_missing, 'locales'); end if;
  if to_regclass('public.membresias_usuario') is null then v_missing := array_append(v_missing, 'membresias_usuario'); end if;
  if to_regclass('public.auditoria_registro') is null then v_missing := array_append(v_missing, 'auditoria_registro'); end if;
  if to_regprocedure('auth.uid()') is null then v_missing := array_append(v_missing, 'auth.uid'); end if;
  if to_regprocedure('private.abc_config_puede_configurar(text,text)') is null then v_missing := array_append(v_missing, 'abc_config_puede_configurar'); end if;
  if cardinality(v_missing) > 0 then
    raise exception 'PM13_P08_PREFLIGHT_FALLO:%', array_to_string(v_missing, ',');
  end if;
end $preflight$;

create table if not exists public.abc_cargos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null references public.empresas(id) on delete restrict,
  nombre text not null,
  nombre_normalizado text not null,
  descripcion text not null default '',
  activo boolean not null default true,
  copiado_de uuid references public.abc_cargos(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint abc_cargos_nombre_valido check (char_length(btrim(nombre)) between 1 and 80),
  constraint abc_cargos_nombre_normalizado_valido check (nombre_normalizado = lower(regexp_replace(btrim(nombre_normalizado), '\s+', ' ', 'g')) and char_length(nombre_normalizado) between 1 and 80),
  constraint abc_cargos_descripcion_valida check (char_length(descripcion) <= 500)
);

create unique index if not exists abc_cargos_empresa_nombre_uq
  on public.abc_cargos(empresa_id, nombre_normalizado);
create index if not exists abc_cargos_empresa_estado_idx
  on public.abc_cargos(empresa_id, activo, nombre_normalizado);

alter table public.abc_cargos enable row level security;
revoke all on table public.abc_cargos from public, anon, authenticated, service_role;

create or replace function private.pm13_cargo_normalizar_nombre(p_nombre text)
returns text
language sql
immutable
security definer
set search_path = 'pg_catalog'
as $$
  select lower(regexp_replace(btrim(coalesce(p_nombre, '')), '\s+', ' ', 'g'))
$$;

create or replace function private.pm13_cargo_autorizado(p_empresa_id text, p_local_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.abc_config_puede_configurar(p_empresa_id, p_local_id), false)
$$;

create or replace function private.pm13_cargo_validar_contexto(p_empresa_id text, p_local_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.pm13_cargo_autorizado(p_empresa_id, p_local_id) then
    raise exception 'cargo_no_autorizado';
  end if;
  if not exists (
    select 1 from public.locales l
     where l.empresa_id = p_empresa_id and l.id = p_local_id and l.activo = true
  ) then
    raise exception 'cargo_local_no_disponible';
  end if;
end
$$;

create or replace function private.pm13_cargo_auditar(p_accion text, p_empresa_id text, p_local_id text, p_detalle jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_id text := gen_random_uuid()::text;
begin
  if v_actor is null then raise exception 'cargo_actor_requerido'; end if;
  insert into public.auditoria_registro(id, fecha, datos, empresa_id, local_id, actor_user_id)
  values (v_id, current_date, jsonb_build_object('accion', p_accion, 'empresaId', p_empresa_id, 'localId', p_local_id, 'actorUserId', v_actor) || coalesce(p_detalle, '{}'::jsonb), p_empresa_id, p_local_id, v_actor);
end
$$;

create or replace function public.abc_listar_cargos(p_empresa_id text, p_local_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.pm13_cargo_validar_contexto(p_empresa_id, p_local_id);
  return jsonb_build_object(
    'ok', true,
    'empresa_id', p_empresa_id,
    'local_id', p_local_id,
    'cargos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'empresa_id', c.empresa_id,
        'nombre', c.nombre,
        'descripcion', c.descripcion,
        'activo', c.activo,
        'copiado_de', c.copiado_de,
        'asignados_count', 0,
        'personas_asignadas', '[]'::jsonb,
        'created_at', c.created_at,
        'updated_at', c.updated_at
      ) order by c.activo desc, c.nombre_normalizado)
      from public.abc_cargos c
      where c.empresa_id = p_empresa_id
    ), '[]'::jsonb)
  );
end
$$;

create or replace function public.abc_crear_cargo(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_nombre text,
  p_descripcion text default ''
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_normalizado text := private.pm13_cargo_normalizar_nombre(p_nombre);
  v_descripcion text := btrim(coalesce(p_descripcion, ''));
  v_cargo public.abc_cargos%rowtype;
begin
  perform private.pm13_cargo_validar_contexto(p_empresa_id, p_local_id);
  if nullif(v_nombre, '') is null then raise exception 'cargo_nombre_requerido'; end if;
  if char_length(v_nombre) > 80 then raise exception 'cargo_nombre_demasiado_largo'; end if;
  if char_length(v_descripcion) > 500 then raise exception 'cargo_descripcion_demasiado_larga'; end if;
  if exists (select 1 from public.abc_cargos where empresa_id = p_empresa_id and nombre_normalizado = v_normalizado) then
    raise exception 'cargo_nombre_ya_existe';
  end if;
  insert into public.abc_cargos(empresa_id, nombre, nombre_normalizado, descripcion, created_by, updated_by)
  values (p_empresa_id, v_nombre, v_normalizado, v_descripcion, auth.uid(), auth.uid())
  returning * into v_cargo;
  perform private.pm13_cargo_auditar('CARGO_CREADO', p_empresa_id, p_local_id, jsonb_build_object('cargoId', v_cargo.id, 'nombre', v_cargo.nombre, 'operationId', p_operation_id));
  return jsonb_build_object('ok', true, 'cargo', to_jsonb(v_cargo));
exception
  when unique_violation then raise exception 'cargo_nombre_ya_existe';
end
$$;

create or replace function public.abc_editar_cargo(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cargo_id uuid,
  p_nombre text,
  p_descripcion text default ''
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_normalizado text := private.pm13_cargo_normalizar_nombre(p_nombre);
  v_descripcion text := btrim(coalesce(p_descripcion, ''));
  v_cargo public.abc_cargos%rowtype;
begin
  perform private.pm13_cargo_validar_contexto(p_empresa_id, p_local_id);
  if p_cargo_id is null then raise exception 'cargo_id_requerido'; end if;
  if nullif(v_nombre, '') is null then raise exception 'cargo_nombre_requerido'; end if;
  if char_length(v_nombre) > 80 then raise exception 'cargo_nombre_demasiado_largo'; end if;
  if char_length(v_descripcion) > 500 then raise exception 'cargo_descripcion_demasiado_larga'; end if;
  select * into v_cargo from public.abc_cargos where id = p_cargo_id and empresa_id = p_empresa_id for update;
  if not found then raise exception 'cargo_no_encontrado'; end if;
  if exists (select 1 from public.abc_cargos where empresa_id = p_empresa_id and nombre_normalizado = v_normalizado and id <> p_cargo_id) then
    raise exception 'cargo_nombre_ya_existe';
  end if;
  update public.abc_cargos
     set nombre = v_nombre, nombre_normalizado = v_normalizado, descripcion = v_descripcion, updated_by = auth.uid(), updated_at = now()
   where id = p_cargo_id
  returning * into v_cargo;
  perform private.pm13_cargo_auditar('CARGO_EDITADO', p_empresa_id, p_local_id, jsonb_build_object('cargoId', v_cargo.id, 'nombre', v_cargo.nombre, 'operationId', p_operation_id));
  return jsonb_build_object('ok', true, 'cargo', to_jsonb(v_cargo));
exception
  when unique_violation then raise exception 'cargo_nombre_ya_existe';
end
$$;

create or replace function public.abc_duplicar_cargo(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cargo_id uuid,
  p_nombre text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_origen public.abc_cargos%rowtype;
  v_cargo public.abc_cargos%rowtype;
  v_nombre text;
  v_normalizado text;
begin
  perform private.pm13_cargo_validar_contexto(p_empresa_id, p_local_id);
  select * into v_origen from public.abc_cargos where id = p_cargo_id and empresa_id = p_empresa_id for share;
  if not found then raise exception 'cargo_no_encontrado'; end if;
  v_nombre := btrim(coalesce(nullif(p_nombre, ''), v_origen.nombre || ' copia'));
  v_normalizado := private.pm13_cargo_normalizar_nombre(v_nombre);
  if char_length(v_nombre) > 80 then raise exception 'cargo_nombre_demasiado_largo'; end if;
  if exists (select 1 from public.abc_cargos where empresa_id = p_empresa_id and nombre_normalizado = v_normalizado) then
    raise exception 'cargo_nombre_ya_existe';
  end if;
  insert into public.abc_cargos(empresa_id, nombre, nombre_normalizado, descripcion, copiado_de, created_by, updated_by)
  values (p_empresa_id, v_nombre, v_normalizado, v_origen.descripcion, v_origen.id, auth.uid(), auth.uid())
  returning * into v_cargo;
  perform private.pm13_cargo_auditar('CARGO_DUPLICADO', p_empresa_id, p_local_id, jsonb_build_object('cargoId', v_cargo.id, 'copiadoDe', v_origen.id, 'nombre', v_cargo.nombre, 'permisosClonados', false, 'operationId', p_operation_id));
  return jsonb_build_object('ok', true, 'cargo', to_jsonb(v_cargo), 'permisos_clonados', false);
exception
  when unique_violation then raise exception 'cargo_nombre_ya_existe';
end
$$;

revoke all on function private.pm13_cargo_normalizar_nombre(text) from public, anon, authenticated, service_role;
revoke all on function private.pm13_cargo_autorizado(text, text) from public, anon, authenticated, service_role;
revoke all on function private.pm13_cargo_validar_contexto(text, text) from public, anon, authenticated, service_role;
revoke all on function private.pm13_cargo_auditar(text, text, text, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.abc_listar_cargos(text, text) from public, anon, authenticated, service_role;
revoke all on function public.abc_crear_cargo(text, text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.abc_editar_cargo(text, text, text, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.abc_duplicar_cargo(text, text, text, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.abc_listar_cargos(text, text) to authenticated;
grant execute on function public.abc_crear_cargo(text, text, text, text, text) to authenticated;
grant execute on function public.abc_editar_cargo(text, text, text, uuid, text, text) to authenticated;
grant execute on function public.abc_duplicar_cargo(text, text, text, uuid, text) to authenticated;

comment on table public.abc_cargos is 'Catálogo de cargos personalizados por empresa. Sin acceso directo; operaciones mediante RPC y solo Propietario.';

commit;
