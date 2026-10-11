-- PM12 P14 · cierre durable del conteo y desbloqueo del almacén.
-- Se aplica únicamente en QA durante esta revisión. No modifica conteos ni stock
-- existentes: guarda el cierre autorizado como un hecho idempotente separado.

create table if not exists public.pm12_conteo_cierres (
  empresa_id text not null,
  local_id text not null,
  conteo_id text not null,
  conteo jsonb not null,
  responsable_id text not null,
  responsable_nombre text not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  cerrado_en timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (empresa_id, local_id, conteo_id)
);

alter table public.pm12_conteo_cierres enable row level security;
revoke all on table public.pm12_conteo_cierres from public, anon, authenticated;

create or replace function public.pm12_cerrar_conteo(
  p_empresa_id text,
  p_local_id text,
  p_conteo jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, auth, private, pg_temp
as $$
declare
  v_id text;
  v_responsable_id text;
  v_responsable_nombre text;
  v_cerrado_en timestamptz;
  v_empleado public.empleados%rowtype;
  v_existente public.pm12_conteo_cierres%rowtype;
  v_conteo jsonb;
  v_cierre jsonb;
  v_responsables jsonb;
  v_audit_id text;
begin
  if auth.uid() is null or not coalesce(private.la_usuario_activo(), false) then
    raise exception 'cierre_no_autorizado';
  end if;
  if coalesce(private.la_rol(), '') <> 'Propietario' then
    raise exception 'cierre_no_autorizado';
  end if;
  if p_empresa_id is null or p_local_id is null or lower(p_local_id) = 'todos'
     or not coalesce(private.la_tiene_empresa(p_empresa_id), false)
     or not coalesce(private.la_tiene_local(p_empresa_id, p_local_id), false) then
    raise exception 'contexto_no_autorizado';
  end if;
  if jsonb_typeof(p_conteo) is distinct from 'object' then
    raise exception 'conteo_invalido';
  end if;

  v_id := nullif(btrim(p_conteo->>'id'), '');
  if v_id is null or p_conteo->>'empresaId' is distinct from p_empresa_id
     or p_conteo->>'localId' is distinct from p_local_id
     or coalesce((p_conteo->>'completado')::boolean, false) is not true
     or coalesce(p_conteo->>'estado', '') not in ('COMPLETADO', 'PARCIAL') then
    raise exception 'conteo_invalido';
  end if;

  v_responsable_id := coalesce(
    nullif(btrim(p_conteo->'cierre'->>'responsableId'), ''),
    nullif(btrim(p_conteo->'responsables'->>'contadoPorId'), '')
  );
  if v_responsable_id is null then
    raise exception 'responsable_obligatorio';
  end if;
  select * into v_empleado
  from public.empleados
  where id = v_responsable_id
    and empresa_id = p_empresa_id
    and local_id = p_local_id
    and estado = 'activo'
  for share;
  if not found then
    raise exception 'responsable_no_valido';
  end if;
  v_responsable_nombre := coalesce(nullif(btrim(p_conteo->'cierre'->>'responsableNombre'), ''), v_empleado.nombre);
  if v_responsable_nombre is distinct from v_empleado.nombre then
    raise exception 'responsable_no_valido';
  end if;
  v_cerrado_en := coalesce(nullif(p_conteo->>'cerradoEn', '')::timestamptz, now());

  select * into v_existente
  from public.pm12_conteo_cierres
  where empresa_id = p_empresa_id and local_id = p_local_id and conteo_id = v_id
  for update;
  if found then
    return jsonb_build_object('ok', true, 'replayed', true, 'conteo', v_existente.conteo,
      'responsableId', v_existente.responsable_id, 'responsableNombre', v_existente.responsable_nombre,
      'cerradoEn', v_existente.cerrado_en);
  end if;

  v_responsables := coalesce(p_conteo->'responsables', '{}'::jsonb)
    || jsonb_build_object('contadoPorId', v_empleado.id, 'contadoPor', v_empleado.nombre);
  v_cierre := coalesce(p_conteo->'cierre', '{}'::jsonb)
    || jsonb_build_object('actorId', v_empleado.id, 'actorNombre', v_empleado.nombre,
      'responsableId', v_empleado.id, 'responsableNombre', v_empleado.nombre, 'cerradoEn', v_cerrado_en);
  v_conteo := p_conteo
    || jsonb_build_object('empresaId', p_empresa_id, 'localId', p_local_id,
      'completado', true, 'cerradoEn', v_cerrado_en,
      'responsables', v_responsables, 'cierre', v_cierre);

  insert into public.pm12_conteo_cierres(
    empresa_id, local_id, conteo_id, conteo, responsable_id, responsable_nombre,
    actor_user_id, cerrado_en
  ) values (
    p_empresa_id, p_local_id, v_id, v_conteo, v_empleado.id, v_empleado.nombre,
    auth.uid(), v_cerrado_en
  );

  v_audit_id := 'pm12-cierre-conteo:' || p_empresa_id || ':' || p_local_id || ':' || v_id;
  insert into public.auditoria_registro(id, fecha, datos, empresa_id, local_id, actor_user_id)
  values (
    v_audit_id, current_date,
    jsonb_build_object('accion', 'Finalizar conteo', 'conteoId', v_id,
      'responsableId', v_empleado.id, 'responsableNombre', v_empleado.nombre,
      'cerradoEn', v_cerrado_en, 'estado', v_conteo->>'estado'),
    p_empresa_id, p_local_id, auth.uid()
  ) on conflict (id) do nothing;

  return jsonb_build_object('ok', true, 'replayed', false, 'conteo', v_conteo,
    'responsableId', v_empleado.id, 'responsableNombre', v_empleado.nombre,
    'cerradoEn', v_cerrado_en);
end;
$$;

revoke all on function public.pm12_cerrar_conteo(text, text, jsonb) from public, anon;
grant execute on function public.pm12_cerrar_conteo(text, text, jsonb) to authenticated;

create or replace function public.pm12_listar_cierres(
  p_empresa_id text,
  p_local_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, auth, private, pg_temp
as $$
begin
  if auth.uid() is null or not coalesce(private.la_usuario_activo(), false)
     or not coalesce(private.la_tiene_empresa(p_empresa_id), false)
     or not coalesce(private.la_tiene_local(p_empresa_id, p_local_id), false) then
    raise exception 'contexto_no_autorizado';
  end if;
  return coalesce((select jsonb_agg(conteo order by cerrado_en desc)
    from public.pm12_conteo_cierres
    where empresa_id = p_empresa_id and local_id = p_local_id), '[]'::jsonb);
end;
$$;

revoke all on function public.pm12_listar_cierres(text, text) from public, anon;
grant execute on function public.pm12_listar_cierres(text, text) to authenticated;
