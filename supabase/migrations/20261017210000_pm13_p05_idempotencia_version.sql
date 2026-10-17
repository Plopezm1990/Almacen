-- PM13-P05 — idempotencia de operation_id y control optimista de versión.
-- Solo QA mediante el canal aprobado; no se aplica a producción.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '30s';

create table if not exists private.pm13_p05_permiso_operaciones (
  operation_id text primary key,
  request_hash text not null,
  resultado jsonb not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

revoke all on table private.pm13_p05_permiso_operaciones from public, anon, authenticated, service_role;

do $rename$
begin
  if to_regprocedure('public.pm13_configurar_cargo_permiso(text,text,text,uuid,text,text,text,boolean,text)') is not null
     and to_regprocedure('public.pm13_configurar_cargo_permiso_base(text,text,text,uuid,text,text,text,boolean,text)') is null then
    alter function public.pm13_configurar_cargo_permiso(text,text,text,uuid,text,text,text,boolean,text)
      rename to pm13_configurar_cargo_permiso_base;
  end if;
end
$rename$;

create or replace function private.pm13_p05_configurar_cargo_permiso_controlado(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cargo_id uuid,
  p_clave text,
  p_accion text,
  p_alcance text,
  p_permitido boolean,
  p_motivo text,
  p_version_esperada bigint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_operation_id text := nullif(btrim(coalesce(p_operation_id, '')), '');
  v_empresa_id text := nullif(btrim(coalesce(p_empresa_id, '')), '');
  v_local_id text := nullif(btrim(coalesce(p_local_id, '')), '');
  v_clave text := upper(btrim(coalesce(p_clave, '')));
  v_accion text := upper(btrim(coalesce(p_accion, '')));
  v_alcance text := upper(btrim(coalesce(p_alcance, '')));
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_hash text;
  v_existing private.pm13_p05_permiso_operaciones%rowtype;
  v_current_version bigint;
  v_result jsonb;
begin
  perform private.pm13_cargo_validar_contexto(v_empresa_id, v_local_id);

  if v_operation_id is null then raise exception 'cargo_permiso_operation_id_requerido'; end if;

  v_hash := md5(jsonb_build_object(
    'empresa_id', v_empresa_id,
    'local_id', v_local_id,
    'cargo_id', p_cargo_id,
    'clave', v_clave,
    'accion', v_accion,
    'alcance', v_alcance,
    'permitido', p_permitido,
    'motivo', v_motivo,
    'version_esperada', p_version_esperada,
    'actor_user_id', auth.uid()
  )::text);

  perform pg_advisory_xact_lock(hashtext('pm13_p05_operation:' || v_operation_id));

  select * into v_existing
    from private.pm13_p05_permiso_operaciones
   where operation_id = v_operation_id
   for update;

  if found then
    if v_existing.request_hash <> v_hash then
      raise exception 'cargo_permiso_operation_id_conflict';
    end if;
    return v_existing.resultado;
  end if;

  if p_version_esperada is not null then
    select cp.version into v_current_version
      from public.abc_cargo_permisos cp
     where cp.empresa_id = v_empresa_id
       and cp.cargo_id = p_cargo_id
       and cp.clave = v_clave
       and cp.accion = v_accion
       and cp.alcance = v_alcance
     for update;

    if coalesce(v_current_version, 0) <> p_version_esperada then
      raise exception 'cargo_permiso_version_conflict';
    end if;
  end if;

  v_result := public.pm13_configurar_cargo_permiso_base(
    v_operation_id,
    v_empresa_id,
    v_local_id,
    p_cargo_id,
    v_clave,
    v_accion,
    v_alcance,
    p_permitido,
    v_motivo
  );

  insert into private.pm13_p05_permiso_operaciones(
    operation_id, request_hash, resultado, actor_user_id
  ) values (
    v_operation_id, v_hash, v_result, auth.uid()
  );

  return v_result;
end
$$;

create or replace function public.pm13_configurar_cargo_permiso(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cargo_id uuid,
  p_clave text,
  p_accion text,
  p_alcance text,
  p_permitido boolean,
  p_motivo text
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select private.pm13_p05_configurar_cargo_permiso_controlado(
    p_operation_id, p_empresa_id, p_local_id, p_cargo_id, p_clave,
    p_accion, p_alcance, p_permitido, p_motivo, null
  )
$$;

create or replace function public.pm13_configurar_cargo_permiso_v2(
  p_operation_id text,
  p_empresa_id text,
  p_local_id text,
  p_cargo_id uuid,
  p_clave text,
  p_accion text,
  p_alcance text,
  p_permitido boolean,
  p_motivo text,
  p_version_esperada bigint
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select private.pm13_p05_configurar_cargo_permiso_controlado(
    p_operation_id, p_empresa_id, p_local_id, p_cargo_id, p_clave,
    p_accion, p_alcance, p_permitido, p_motivo, p_version_esperada
  )
$$;

revoke all on function public.pm13_configurar_cargo_permiso_base(text,text,text,uuid,text,text,text,boolean,text) from public, anon, authenticated, service_role;
revoke all on function private.pm13_p05_configurar_cargo_permiso_controlado(text,text,text,uuid,text,text,text,boolean,text,bigint) from public, anon, authenticated, service_role;
revoke all on function public.pm13_configurar_cargo_permiso(text,text,text,uuid,text,text,text,boolean,text) from public, anon, authenticated, service_role;
revoke all on function public.pm13_configurar_cargo_permiso_v2(text,text,text,uuid,text,text,text,boolean,text,bigint) from public, anon, authenticated, service_role;

grant execute on function public.pm13_configurar_cargo_permiso(text,text,text,uuid,text,text,text,boolean,text) to authenticated;
grant execute on function public.pm13_configurar_cargo_permiso_v2(text,text,text,uuid,text,text,text,boolean,text,bigint) to authenticated;

comment on table private.pm13_p05_permiso_operaciones is 'Idempotencia de cambios de permisos PM13; no expuesta al Data API.';
comment on function public.pm13_configurar_cargo_permiso_v2(text,text,text,uuid,text,text,text,boolean,text,bigint) is 'Configura un permiso PM13 con replay idempotente y control optimista de versión.';

commit;
