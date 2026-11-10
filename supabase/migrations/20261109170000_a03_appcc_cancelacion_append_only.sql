-- A-03: cancelar un registro de captura no borra ni muta la lectura.
-- La cancelación es una anotación append-only con actor y motivo propios.

create table if not exists public.appcc_lectura_cancelaciones (
  id uuid primary key,
  lectura_id uuid not null unique references public.appcc_lecturas(id),
  empresa_id text not null,
  local_id text not null,
  motivo text not null,
  actor_user_id uuid not null,
  actor_empleado_id text,
  actor_nombre text,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists appcc_cancelaciones_scope_time_idx
  on public.appcc_lectura_cancelaciones (empresa_id, local_id, created_at desc);

alter table public.appcc_lectura_cancelaciones enable row level security;
revoke all on table public.appcc_lectura_cancelaciones from anon, authenticated;
grant select on table public.appcc_lectura_cancelaciones to authenticated;

drop policy if exists appcc_cancelaciones_select_scope on public.appcc_lectura_cancelaciones;
create policy appcc_cancelaciones_select_scope
  on public.appcc_lectura_cancelaciones for select to authenticated
  using (private.la_tiene_local(empresa_id, local_id));

create or replace function public.appcc_cancelar_lectura(
  p_cancelacion_id uuid,
  p_lectura_id uuid,
  p_motivo text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_empleado_id text;
  v_actor_nombre text;
  v_lectura public.appcc_lecturas%rowtype;
  v_cancelacion public.appcc_lectura_cancelaciones%rowtype;
  v_existente public.appcc_lectura_cancelaciones%rowtype;
  v_insertados integer := 0;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if v_uid is null or not private.la_usuario_activo() then
    raise exception 'usuario_inactivo_o_no_autenticado';
  end if;
  if p_cancelacion_id is null or p_lectura_id is null or v_motivo is null then
    raise exception 'cancelacion_parametros_invalidos';
  end if;

  select * into v_lectura
    from public.appcc_lecturas
   where id = p_lectura_id
   for update;
  if not found then raise exception 'lectura_no_encontrada'; end if;
  if not private.la_tiene_local(v_lectura.empresa_id, v_lectura.local_id) then
    raise exception 'contexto_no_autorizado';
  end if;

  select * into v_existente
    from public.appcc_lectura_cancelaciones
   where id = p_cancelacion_id;
  if found then
    if v_existente.lectura_id is distinct from p_lectura_id
       or v_existente.motivo is distinct from v_motivo
       or v_existente.actor_user_id is distinct from v_uid then
      raise exception 'cancelacion_id_conflict';
    end if;
    return jsonb_build_object('ok', true, 'replayed', true, 'cancelacion', to_jsonb(v_existente));
  end if;

  if exists (
    select 1 from public.appcc_lectura_cancelaciones c
     where c.lectura_id = p_lectura_id
  ) then
    raise exception 'lectura_ya_cancelada';
  end if;

  select p.empleado_id, p.nombre into v_empleado_id, v_actor_nombre
    from public.perfiles p
   where p.user_id = v_uid and p.activo = true;

  insert into public.appcc_lectura_cancelaciones (
    id, lectura_id, empresa_id, local_id, motivo,
    actor_user_id, actor_empleado_id, actor_nombre
  ) values (
    p_cancelacion_id, p_lectura_id, v_lectura.empresa_id, v_lectura.local_id,
    v_motivo, v_uid, v_empleado_id, v_actor_nombre
  ) on conflict (id) do nothing
  returning * into v_cancelacion;
  get diagnostics v_insertados = row_count;

  if v_insertados = 0 then
    select * into v_cancelacion
      from public.appcc_lectura_cancelaciones
     where id = p_cancelacion_id;
    if not found then raise exception 'cancelacion_replay_no_resuelto'; end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'replayed', v_insertados = 0,
    'cancelacion', to_jsonb(v_cancelacion),
    'lectura', to_jsonb(v_lectura)
  );
end;
$$;

revoke all on function public.appcc_cancelar_lectura(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.appcc_cancelar_lectura(uuid, uuid, text)
  to authenticated;
