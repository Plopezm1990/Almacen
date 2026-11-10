-- Fase 3: APPCC histórico y atribución server-side.
--
-- A-03: almacen_kv.puntosControl solo define controles y no es un historial
-- de lecturas. Las lecturas se insertan exclusivamente por RPC, con hora y
-- actor derivados del servidor. Las correcciones son nuevas filas y conservan
-- el valor anterior en una tabla propia.
--
-- A-04: registrar_auditoria ya recibía auth.uid() para actor_user_id, pero el
-- nombre y la identidad de empleado podían llegar del cliente. Esta versión
-- deriva el nombre y empleado_id de perfiles; los argumentos de UI quedan solo
-- como compatibilidad de forma y no como autoridad de identidad.

create table if not exists public.appcc_puntos_control (
  id text primary key,
  empresa_id text not null,
  local_id text,
  nombre text not null,
  tipo text not null,
  frecuencia text not null,
  temp_min numeric,
  temp_max numeric,
  activo boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.appcc_lecturas (
  id uuid primary key,
  punto_control_id text not null references public.appcc_puntos_control(id),
  empresa_id text not null,
  local_id text not null,
  punto_nombre text not null,
  tipo text not null,
  valor text not null,
  conforme boolean,
  observaciones text not null default '',
  realizada_en timestamptz not null default clock_timestamp(),
  actor_user_id uuid not null,
  actor_empleado_id text,
  actor_nombre text,
  created_at timestamptz not null default clock_timestamp()
);

create table if not exists public.appcc_lectura_correcciones (
  id uuid primary key,
  lectura_original_id uuid not null references public.appcc_lecturas(id),
  lectura_correccion_id uuid not null unique references public.appcc_lecturas(id),
  empresa_id text not null,
  local_id text not null,
  valor_anterior text not null,
  conforme_anterior boolean,
  observaciones_anterior text not null default '',
  motivo text not null,
  actor_user_id uuid not null,
  actor_empleado_id text,
  actor_nombre text,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists appcc_puntos_control_scope_idx
  on public.appcc_puntos_control (empresa_id, local_id, activo);
create index if not exists appcc_lecturas_scope_time_idx
  on public.appcc_lecturas (empresa_id, local_id, realizada_en desc);
create index if not exists appcc_lecturas_punto_time_idx
  on public.appcc_lecturas (punto_control_id, realizada_en desc);
create index if not exists appcc_correcciones_original_idx
  on public.appcc_lectura_correcciones (lectura_original_id, created_at desc);

alter table public.auditoria_registro
  add column if not exists actor_empleado_id text;

-- Backfill only the point definitions that already exist in the generic store.
-- It does not fabricate readings or historical timestamps.
insert into public.appcc_puntos_control (
  id, empresa_id, local_id, nombre, tipo, frecuencia, temp_min, temp_max,
  activo, created_by, created_at, updated_at
)
select
  point->>'id',
  kv.empresa_id,
  nullif(point->>'localId', ''),
  coalesce(nullif(point->>'nombre', ''), point->>'id'),
  coalesce(nullif(point->>'tipo', ''), 'temperatura'),
  coalesce(nullif(point->>'frecuencia', ''), 'Diaria'),
  case when point->>'tempMin' is null or point->>'tempMin' = '' then null else (point->>'tempMin')::numeric end,
  case when point->>'tempMax' is null or point->>'tempMax' = '' then null else (point->>'tempMax')::numeric end,
  coalesce((point->>'activo')::boolean, true),
  null,
  coalesce(kv.updated_at, clock_timestamp()),
  coalesce(kv.updated_at, clock_timestamp())
from public.almacen_kv kv
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(kv.value) = 'array' then kv.value else '[]'::jsonb end
) point
where kv.key = 'puntosControl'
  and point ? 'id'
on conflict (id) do update set
  empresa_id = excluded.empresa_id,
  local_id = excluded.local_id,
  nombre = excluded.nombre,
  tipo = excluded.tipo,
  frecuencia = excluded.frecuencia,
  temp_min = excluded.temp_min,
  temp_max = excluded.temp_max,
  activo = excluded.activo,
  updated_at = excluded.updated_at;

update public.auditoria_registro a
set actor_empleado_id = p.empleado_id
from public.perfiles p
where a.actor_user_id = p.user_id
  and a.actor_empleado_id is null;

alter table public.appcc_puntos_control enable row level security;
alter table public.appcc_lecturas enable row level security;
alter table public.appcc_lectura_correcciones enable row level security;

revoke all on table public.appcc_puntos_control from anon, authenticated;
revoke all on table public.appcc_lecturas from anon, authenticated;
revoke all on table public.appcc_lectura_correcciones from anon, authenticated;

grant select on table public.appcc_puntos_control,
  public.appcc_lecturas,
  public.appcc_lectura_correcciones to authenticated;

drop policy if exists appcc_puntos_control_select_scope on public.appcc_puntos_control;
create policy appcc_puntos_control_select_scope
  on public.appcc_puntos_control for select to authenticated
  using (private.la_tiene_local(empresa_id, local_id) or local_id is null);

drop policy if exists appcc_lecturas_select_scope on public.appcc_lecturas;
create policy appcc_lecturas_select_scope
  on public.appcc_lecturas for select to authenticated
  using (private.la_tiene_local(empresa_id, local_id));

drop policy if exists appcc_correcciones_select_scope on public.appcc_lectura_correcciones;
create policy appcc_correcciones_select_scope
  on public.appcc_lectura_correcciones for select to authenticated
  using (private.la_tiene_local(empresa_id, local_id));

create or replace function public.appcc_registrar_lectura(
  p_lectura_id uuid,
  p_punto_control_id text,
  p_empresa_id text,
  p_local_id text,
  p_valor text,
  p_conforme boolean,
  p_observaciones text default ''
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_empleado_id text;
  v_actor_nombre text;
  v_punto public.appcc_puntos_control%rowtype;
  v_existente public.appcc_lecturas%rowtype;
  v_insertados integer := 0;
begin
  if v_uid is null or not private.la_usuario_activo() then
    raise exception 'usuario_inactivo_o_no_autenticado';
  end if;
  if p_lectura_id is null then raise exception 'lectura_id_requerido'; end if;
  if p_valor is null or btrim(p_valor) = '' then raise exception 'valor_requerido'; end if;
  if not private.la_tiene_local(p_empresa_id, p_local_id) then
    raise exception 'contexto_no_autorizado';
  end if;

  select * into v_punto
  from public.appcc_puntos_control p
  where p.id = p_punto_control_id
    and p.empresa_id = p_empresa_id
    and (p.local_id is null or p.local_id = p_local_id)
    and p.activo = true;
  if not found then raise exception 'punto_control_no_encontrado'; end if;

  select p.empleado_id, p.nombre
    into v_empleado_id, v_actor_nombre
  from public.perfiles p
  where p.user_id = v_uid and p.activo = true;

  insert into public.appcc_lecturas (
    id, punto_control_id, empresa_id, local_id, punto_nombre, tipo, valor,
    conforme, observaciones, actor_user_id, actor_empleado_id, actor_nombre
  ) values (
    p_lectura_id, v_punto.id, p_empresa_id, p_local_id, v_punto.nombre,
    v_punto.tipo, p_valor, p_conforme, coalesce(p_observaciones, ''),
    v_uid, v_empleado_id, v_actor_nombre
  ) on conflict (id) do nothing;
  get diagnostics v_insertados = row_count;

  select * into v_existente from public.appcc_lecturas where id = p_lectura_id;
  if not found then raise exception 'lectura_replay_no_resuelto'; end if;
  if v_existente.punto_control_id is distinct from v_punto.id
     or v_existente.empresa_id is distinct from p_empresa_id
     or v_existente.local_id is distinct from p_local_id
     or v_existente.valor is distinct from p_valor
     or v_existente.conforme is distinct from p_conforme
     or v_existente.observaciones is distinct from coalesce(p_observaciones, '')
     or v_existente.actor_user_id is distinct from v_uid then
    raise exception 'lectura_id_conflict';
  end if;

  return jsonb_build_object(
    'ok', true,
    'replayed', v_insertados = 0,
    'lectura', to_jsonb(v_existente)
  );
end;
$$;

create or replace function public.appcc_corregir_lectura(
  p_correccion_id uuid,
  p_lectura_original_id uuid,
  p_valor text,
  p_conforme boolean,
  p_observaciones text,
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
  v_original public.appcc_lecturas%rowtype;
  v_nueva public.appcc_lecturas%rowtype;
  v_existente public.appcc_lectura_correcciones%rowtype;
  v_nueva_id uuid := gen_random_uuid();
begin
  if v_uid is null or not private.la_usuario_activo() then
    raise exception 'usuario_inactivo_o_no_autenticado';
  end if;
  if p_correccion_id is null or p_lectura_original_id is null then
    raise exception 'correccion_id_requerido';
  end if;
  if p_valor is null or btrim(p_valor) = '' then raise exception 'valor_requerido'; end if;
  if p_motivo is null or btrim(p_motivo) = '' then raise exception 'motivo_requerido'; end if;

  select * into v_existente
  from public.appcc_lectura_correcciones
  where id = p_correccion_id;
  if found then
    select * into v_nueva
    from public.appcc_lecturas
    where id = v_existente.lectura_correccion_id;
    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'correccion', to_jsonb(v_existente),
      'lectura', to_jsonb(v_nueva)
    );
  end if;

  select * into v_original
  from public.appcc_lecturas
  where id = p_lectura_original_id
  for update;
  if not found then raise exception 'lectura_original_no_encontrada'; end if;
  if not private.la_tiene_local(v_original.empresa_id, v_original.local_id) then
    raise exception 'contexto_no_autorizado';
  end if;

  select p.empleado_id, p.nombre into v_empleado_id, v_actor_nombre
  from public.perfiles p where p.user_id = v_uid and p.activo = true;

  insert into public.appcc_lecturas (
    id, punto_control_id, empresa_id, local_id, punto_nombre, tipo, valor,
    conforme, observaciones, actor_user_id, actor_empleado_id, actor_nombre
  ) values (
    v_nueva_id, v_original.punto_control_id, v_original.empresa_id,
    v_original.local_id, v_original.punto_nombre, v_original.tipo, p_valor,
    p_conforme, coalesce(p_observaciones, ''), v_uid, v_empleado_id, v_actor_nombre
  ) returning * into v_nueva;

  insert into public.appcc_lectura_correcciones (
    id, lectura_original_id, lectura_correccion_id, empresa_id, local_id,
    valor_anterior, conforme_anterior, observaciones_anterior, motivo,
    actor_user_id, actor_empleado_id, actor_nombre
  ) values (
    p_correccion_id, v_original.id, v_nueva.id, v_original.empresa_id,
    v_original.local_id, v_original.valor, v_original.conforme,
    v_original.observaciones, btrim(p_motivo), v_uid, v_empleado_id,
    v_actor_nombre
  );
  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'correccion', to_jsonb(v_existente),
    'lectura', to_jsonb(v_nueva)
  );
end;
$$;

revoke all on function public.appcc_registrar_lectura(uuid,text,text,text,text,boolean,text)
  from public, anon, authenticated;
grant execute on function public.appcc_registrar_lectura(uuid,text,text,text,text,boolean,text)
  to authenticated;
revoke all on function public.appcc_corregir_lectura(uuid,uuid,text,boolean,text,text)
  from public, anon, authenticated;
grant execute on function public.appcc_corregir_lectura(uuid,uuid,text,boolean,text,text)
  to authenticated;

create or replace function public.registrar_auditoria(
  p_id text,
  p_usuario text,
  p_accion text,
  p_detalle text,
  p_fecha date,
  p_hora text,
  p_empresa_id text,
  p_local_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_empleado_id text;
  v_actor_nombre text;
  v_id text := nullif(btrim(p_id), '');
  v_accion text := nullif(btrim(p_accion), '');
  v_fecha date := coalesce(p_fecha, current_date);
  v_hora text := coalesce(nullif(btrim(p_hora), ''), to_char(clock_timestamp(), 'HH24:MI'));
  v_empresa text := nullif(btrim(p_empresa_id), '');
  v_local text := nullif(btrim(p_local_id), '');
  v_datos jsonb;
  v_existente public.auditoria_registro%rowtype;
  v_insertados integer := 0;
begin
  if v_uid is null or not private.la_usuario_activo() then
    raise exception 'usuario_inactivo_o_no_autenticado';
  end if;
  if v_id is null then raise exception 'auditoria_id_invalido'; end if;
  if v_accion is null then raise exception 'auditoria_accion_requerida'; end if;
  if v_empresa is null then
    select case when count(distinct m.empresa_id) = 1 then min(m.empresa_id) end
      into v_empresa from public.membresias_usuario m
     where m.user_id = v_uid and m.activo = true;
  end if;
  if v_empresa is null or not private.la_tiene_empresa(v_empresa) then
    raise exception 'empresa_no_autorizada';
  end if;
  if v_local is not null and upper(v_local) = 'TODOS' then v_local := null; end if;
  if v_local is not null and not private.la_tiene_local(v_empresa, v_local) then
    raise exception 'local_no_autorizado';
  end if;

  select p.empleado_id, p.nombre into v_empleado_id, v_actor_nombre
  from public.perfiles p where p.user_id = v_uid and p.activo = true;
  v_datos := jsonb_build_object(
    'id', v_id, 'fecha', v_fecha::text, 'hora', v_hora,
    'usuario', coalesce(nullif(v_actor_nombre, ''), 'Cuenta sin nombre'),
    'usuarioAutenticado', v_uid::text, 'accion', v_accion,
    'detalle', coalesce(p_detalle, ''), 'empresaId', v_empresa,
    'localId', v_local, 'actorUserId', v_uid
  ) || case when v_empleado_id is null then '{}'::jsonb
            else jsonb_build_object('empleadoId', v_empleado_id) end;

  insert into public.auditoria_registro (
    id, fecha, datos, empresa_id, local_id, actor_user_id, actor_empleado_id
  ) values (
    v_id, v_fecha, v_datos, v_empresa, v_local, v_uid, v_empleado_id
  ) on conflict (id) do nothing;
  get diagnostics v_insertados = row_count;
  select * into v_existente from public.auditoria_registro where id = v_id;
  if not found then raise exception 'auditoria_replay_no_resuelto'; end if;
  if v_insertados = 0 and (
       v_existente.fecha is distinct from v_fecha
       or v_existente.datos is distinct from v_datos
       or v_existente.empresa_id is distinct from v_empresa
       or v_existente.local_id is distinct from v_local
       or v_existente.actor_user_id is distinct from v_uid
       or v_existente.actor_empleado_id is distinct from v_empleado_id
     ) then
    raise exception 'auditoria_id_conflict';
  end if;
  return jsonb_build_object(
    'ok', true, 'id', v_id, 'empresaId', v_empresa, 'localId', v_local,
    'actorUserId', v_uid, 'actorEmpleadoId', v_empleado_id,
    'replayed', v_insertados = 0
  );
end;
$$;

revoke all on function public.registrar_auditoria(text,text,text,text,date,text,text,text)
  from public, anon, authenticated;
grant execute on function public.registrar_auditoria(text,text,text,text,date,text,text,text)
  to authenticated;

