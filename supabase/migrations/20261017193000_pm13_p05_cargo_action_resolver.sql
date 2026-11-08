-- PM13-P05 — resolver seguro de acciones para cargos personalizados.
-- Preparado para aplicar únicamente en QA mediante el canal aprobado.
-- No concede permisos por defecto: catálogo, techo, alcance y dependencia son obligatorios.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.empresas') is null then v_missing := array_append(v_missing, 'empresas'); end if;
  if to_regclass('public.locales') is null then v_missing := array_append(v_missing, 'locales'); end if;
  if to_regclass('public.empleados') is null then v_missing := array_append(v_missing, 'empleados'); end if;
  if to_regclass('public.perfiles') is null then v_missing := array_append(v_missing, 'perfiles'); end if;
  if to_regclass('public.membresias_usuario') is null then v_missing := array_append(v_missing, 'membresias_usuario'); end if;
  if to_regclass('public.abc_cargos') is null then v_missing := array_append(v_missing, 'abc_cargos'); end if;
  if to_regclass('public.abc_cargo_asignaciones') is null then v_missing := array_append(v_missing, 'abc_cargo_asignaciones'); end if;
  if to_regclass('public.abc_cargo_pantallas') is null then v_missing := array_append(v_missing, 'abc_cargo_pantallas'); end if;
  if to_regclass('public.auditoria_registro') is null then v_missing := array_append(v_missing, 'auditoria_registro'); end if;
  if to_regclass('public.abc_eventos') is null then v_missing := array_append(v_missing, 'abc_eventos'); end if;
  if to_regprocedure('auth.uid()') is null then v_missing := array_append(v_missing, 'auth.uid'); end if;
  if to_regprocedure('private.pm13_cargo_validar_contexto(text,text)') is null then v_missing := array_append(v_missing, 'pm13_cargo_validar_contexto'); end if;
  if to_regprocedure('private.pm13_cargo_auditar(text,text,text,jsonb)') is null then v_missing := array_append(v_missing, 'pm13_cargo_auditar'); end if;
  if cardinality(v_missing) > 0 then
    raise exception 'PM13_P05_RESOLVER_PREFLIGHT_FALLO:%', array_to_string(v_missing, ',');
  end if;
end $preflight$;

create table if not exists private.pm13_p05_acciones_catalogo (
  clave text primary key,
  accion text not null check (accion in ('CONSULTAR','CREAR','EDITAR','ANULAR_ELIMINAR')),
  alcance_maximo text not null check (alcance_maximo in ('PROPIO','LOCAL','EMPRESA')),
  modulo text not null,
  requiere_consulta boolean not null default true,
  consulta_clave text,
  rol_minimo text not null check (rol_minimo in ('Camarero/a','Cajero/a','Encargado')),
  unique (clave, accion)
);

insert into private.pm13_p05_acciones_catalogo
  (clave, accion, alcance_maximo, modulo, requiere_consulta, consulta_clave, rol_minimo)
values
  ('PM13_PERSONAL_CONSULTAR', 'CONSULTAR', 'LOCAL', 'PM13_PERSONAL', false, null, 'Camarero/a'),
  ('PM13_PERSONAL_CREAR', 'CREAR', 'LOCAL', 'PM13_PERSONAL', true, 'ABC_PANTALLA_PERSONAL_CONSULTAR', 'Encargado'),
  ('PM13_PERSONAL_EDITAR', 'EDITAR', 'LOCAL', 'PM13_PERSONAL', true, 'ABC_PANTALLA_PERSONAL_CONSULTAR', 'Encargado'),
  ('PM13_PERSONAL_ANULAR', 'ANULAR_ELIMINAR', 'LOCAL', 'PM13_PERSONAL', true, 'ABC_PANTALLA_PERSONAL_CONSULTAR', 'Encargado'),
  ('PM13_FICHAJE_CONSULTAR', 'CONSULTAR', 'LOCAL', 'PM13_FICHAJE', false, null, 'Camarero/a'),
  ('PM13_FICHAJE_MANUAL', 'CREAR', 'LOCAL', 'PM13_FICHAJE', true, 'ABC_PANTALLA_FICHAJE_CONSULTAR', 'Encargado'),
  ('PM13_FICHAJE_CORREGIR', 'EDITAR', 'LOCAL', 'PM13_FICHAJE', true, 'ABC_PANTALLA_FICHAJE_CONSULTAR', 'Encargado'),
  ('PM13_FICHAJE_ANULAR', 'ANULAR_ELIMINAR', 'LOCAL', 'PM13_FICHAJE', true, 'ABC_PANTALLA_FICHAJE_CONSULTAR', 'Encargado'),
  ('PM13_AUSENCIA_CONSULTAR', 'CONSULTAR', 'LOCAL', 'PM13_AUSENCIAS', false, null, 'Camarero/a'),
  ('PM13_AUSENCIA_REGISTRAR', 'CREAR', 'LOCAL', 'PM13_AUSENCIAS', true, 'ABC_PANTALLA_PERSONAL_CONSULTAR', 'Encargado'),
  ('PM13_AUSENCIA_ANULAR', 'ANULAR_ELIMINAR', 'LOCAL', 'PM13_AUSENCIAS', true, 'ABC_PANTALLA_PERSONAL_CONSULTAR', 'Encargado')
on conflict (clave) do update
  set accion = excluded.accion,
      alcance_maximo = excluded.alcance_maximo,
      modulo = excluded.modulo,
      requiere_consulta = excluded.requiere_consulta,
      consulta_clave = excluded.consulta_clave,
      rol_minimo = excluded.rol_minimo;

create or replace function private.pm13_p05_rol_alcanza(p_rol text, p_rol_minimo text)
returns boolean
language sql
immutable
security definer
set search_path = 'pg_catalog'
as $$
  select case p_rol
    when 'Propietario' then 4
    when 'Encargado' then 3
    when 'Cajero/a' then 2
    when 'Camarero/a' then 1
    else 0
  end >= case p_rol_minimo
    when 'Encargado' then 3
    when 'Cajero/a' then 2
    when 'Camarero/a' then 1
    else 99
  end
$$;

create or replace function private.pm13_p05_alcance_cubre(p_concedido text, p_solicitado text)
returns boolean
language sql
immutable
security definer
set search_path = 'pg_catalog'
as $$
  select case p_concedido
    when 'EMPRESA' then 3
    when 'LOCAL' then 2
    when 'PROPIO' then 1
    else 0
  end >= case p_solicitado
    when 'EMPRESA' then 3
    when 'LOCAL' then 2
    when 'PROPIO' then 1
    else 99
  end
$$;

create table if not exists public.abc_cargo_permisos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null references public.empresas(id) on delete restrict,
  cargo_id uuid not null references public.abc_cargos(id) on delete restrict,
  clave text not null references private.pm13_p05_acciones_catalogo(clave) on delete restrict,
  accion text not null check (accion in ('CONSULTAR','CREAR','EDITAR','ANULAR_ELIMINAR')),
  alcance text not null check (alcance in ('PROPIO','LOCAL','EMPRESA')),
  permitido boolean not null default true,
  activo boolean not null default true,
  version bigint not null default 1 check (version >= 1),
  motivo text not null check (nullif(btrim(motivo), '') is not null),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint abc_cargo_permiso_clave_accion_uq unique (empresa_id, cargo_id, clave, accion, alcance)
);

create index if not exists abc_cargo_permisos_resolver_idx
  on public.abc_cargo_permisos(empresa_id, cargo_id, clave, accion, activo);

alter table public.abc_cargo_permisos enable row level security;
revoke all on table public.abc_cargo_permisos from public, anon, authenticated, service_role;

create or replace function public.pm13_listar_cargo_permisos(
  p_empresa_id text,
  p_local_id text,
  p_cargo_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.pm13_cargo_validar_contexto(p_empresa_id, p_local_id);
  if p_cargo_id is null or not exists (
    select 1 from public.abc_cargos c
     where c.id = p_cargo_id and c.empresa_id = p_empresa_id
  ) then
    raise exception 'cargo_no_encontrado';
  end if;
  return jsonb_build_object(
    'ok', true,
    'empresa_id', p_empresa_id,
    'local_id', p_local_id,
    'cargo_id', p_cargo_id,
    'permisos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'clave', cat.clave,
        'accion', cat.accion,
        'alcance_maximo', cat.alcance_maximo,
        'modulo', cat.modulo,
        'requiere_consulta', cat.requiere_consulta,
        'permitido', coalesce(cp.permitido, false),
        'alcance', cp.alcance,
        'activo', coalesce(cp.activo, false),
        'version', cp.version,
        'motivo', cp.motivo
      ) order by cat.clave, cat.accion)
      from private.pm13_p05_acciones_catalogo cat
      left join public.abc_cargo_permisos cp
        on cp.empresa_id = p_empresa_id
       and cp.cargo_id = p_cargo_id
       and cp.clave = cat.clave
       and cp.accion = cat.accion
       and cp.activo = true
    ), '[]'::jsonb)
  );
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
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cat private.pm13_p05_acciones_catalogo%rowtype;
  v_prev public.abc_cargo_permisos%rowtype;
  v_row public.abc_cargo_permisos%rowtype;
  v_found boolean;
  v_version bigint;
  v_clave text := upper(btrim(coalesce(p_clave, '')));
  v_accion text := upper(btrim(coalesce(p_accion, '')));
  v_alcance text := upper(btrim(coalesce(p_alcance, '')));
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  perform private.pm13_cargo_validar_contexto(p_empresa_id, p_local_id);
  if nullif(btrim(coalesce(p_operation_id, '')), '') is null then raise exception 'cargo_permiso_operation_id_requerido'; end if;
  if p_cargo_id is null or not exists (
    select 1 from public.abc_cargos c
     where c.id = p_cargo_id and c.empresa_id = p_empresa_id and c.activo = true
  ) then raise exception 'cargo_no_disponible'; end if;
  if v_motivo is null then raise exception 'cargo_permiso_motivo_requerido'; end if;
  select * into v_cat
    from private.pm13_p05_acciones_catalogo c
   where c.clave = v_clave and c.accion = v_accion;
  if not found then raise exception 'cargo_permiso_clave_invalida'; end if;
  if v_alcance not in ('PROPIO','LOCAL','EMPRESA') then raise exception 'cargo_permiso_alcance_invalido'; end if;
  if not private.pm13_p05_alcance_cubre(v_cat.alcance_maximo, v_alcance) then raise exception 'cargo_permiso_alcance_fuera_de_catalogo'; end if;

  perform pg_advisory_xact_lock(hashtext('pm13_p05_permiso:' || p_empresa_id || ':' || p_cargo_id::text || ':' || v_clave || ':' || v_accion || ':' || v_alcance));
  select * into v_prev
    from public.abc_cargo_permisos cp
   where cp.empresa_id = p_empresa_id and cp.cargo_id = p_cargo_id
     and cp.clave = v_clave and cp.accion = v_accion and cp.alcance = v_alcance
   for update;
  v_found := found;
  if v_found then
    update public.abc_cargo_permisos
       set permitido = p_permitido, activo = true, version = v_prev.version + 1,
           motivo = v_motivo, updated_by = auth.uid(), updated_at = now()
     where id = v_prev.id
     returning * into v_row;
  else
    insert into public.abc_cargo_permisos(
      empresa_id, cargo_id, clave, accion, alcance, permitido, activo, version, motivo, created_by, updated_by
    ) values (
      p_empresa_id, p_cargo_id, v_clave, v_accion, v_alcance, p_permitido, true, 1, v_motivo, auth.uid(), auth.uid()
    ) returning * into v_row;
  end if;
  perform private.pm13_cargo_auditar(
    'CARGO_PERMISO_CONFIGURADO', p_empresa_id, p_local_id,
    jsonb_build_object(
      'cargoId', p_cargo_id,
      'clave', v_clave,
      'accion', v_accion,
      'alcance', v_alcance,
      'anterior', case when v_found then jsonb_build_object('permitido', v_prev.permitido, 'activo', v_prev.activo, 'version', v_prev.version) else null end,
      'nuevo', jsonb_build_object('permitido', p_permitido, 'activo', true, 'version', v_row.version),
      'motivo', v_motivo,
      'operationId', p_operation_id
    )
  );
  return jsonb_build_object(
    'ok', true, 'cargo_id', p_cargo_id, 'clave', v_clave, 'accion', v_accion,
    'alcance', v_alcance, 'permitido', p_permitido, 'version', v_row.version
  );
end
$$;

create or replace function public.pm13_resolver_cargo_permiso(
  p_empresa_id text,
  p_local_id text,
  p_clave text,
  p_accion text,
  p_alcance text,
  p_empleado_id text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cat private.pm13_p05_acciones_catalogo%rowtype;
  v_member public.membresias_usuario%rowtype;
  v_profile public.perfiles%rowtype;
  v_employee public.empleados%rowtype;
  v_assignment public.abc_cargo_asignaciones%rowtype;
  v_perm public.abc_cargo_permisos%rowtype;
  v_clave text := upper(btrim(coalesce(p_clave, '')));
  v_accion text := upper(btrim(coalesce(p_accion, '')));
  v_alcance text := upper(btrim(coalesce(p_alcance, '')));
  v_empleado_id text;
  v_reason text := 'denegado_por_defecto';
begin
  if auth.uid() is null or nullif(btrim(coalesce(p_empresa_id, '')), '') is null or nullif(btrim(coalesce(p_local_id, '')), '') is null then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'contexto_no_autorizado');
  end if;
  if v_alcance not in ('PROPIO','LOCAL','EMPRESA') then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'alcance_no_valido');
  end if;
  select * into v_cat from private.pm13_p05_acciones_catalogo c where c.clave = v_clave and c.accion = v_accion;
  if not found then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'clave_no_catalogada');
  end if;
  if not private.pm13_p05_alcance_cubre(v_cat.alcance_maximo, v_alcance) then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'alcance_fuera_de_catalogo');
  end if;
  select * into v_member
    from public.membresias_usuario m
   where m.user_id = auth.uid() and m.empresa_id = p_empresa_id and m.activo = true
     and ((m.todos_locales = false and m.local_id = p_local_id) or (m.todos_locales = true and m.local_id is null))
   order by case when m.todos_locales = false then 0 else 1 end, m.id desc
   limit 1;
  if not found then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'membresia_no_autorizada');
  end if;
  if not exists (select 1 from public.locales l where l.id = p_local_id and l.empresa_id = p_empresa_id and l.activo = true) then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'local_no_disponible');
  end if;
  if v_member.rol = 'Propietario' then
    return jsonb_build_object('ok', true, 'permitido', true, 'motivo', 'propietario_protegido', 'fuente', 'rol_tecnico', 'alcance', v_alcance);
  end if;
  select * into v_profile from public.perfiles p where p.user_id = auth.uid() and p.activo = true order by p.updated_at desc limit 1;
  v_empleado_id := coalesce(nullif(p_empleado_id, ''), v_profile.empleado_id);
  if v_empleado_id is null then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'empleado_no_vinculado');
  end if;
  if v_profile.empleado_id is distinct from v_empleado_id then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'empleado_no_coincide');
  end if;
  select * into v_employee from public.empleados e
   where e.id = v_empleado_id and e.empresa_id = p_empresa_id and e.local_id = p_local_id and e.estado = 'activo';
  if not found then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'empleado_no_disponible');
  end if;
  if v_alcance = 'PROPIO' and v_profile.empleado_id is distinct from v_employee.id then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'alcance_propio_no_coincide');
  end if;
  if not private.pm13_p05_rol_alcanza(v_member.rol, v_cat.rol_minimo) then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'techo_rol_tecnico', 'fuente', 'rol_tecnico');
  end if;
  select * into v_assignment
    from public.abc_cargo_asignaciones a
   where a.empresa_id = p_empresa_id and a.local_id = p_local_id and a.empleado_id = v_employee.id and a.activo = true
   order by a.asignado_desde desc, a.created_at desc limit 1;
  if not found then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'cargo_no_asignado');
  end if;
  if v_cat.requiere_consulta and not exists (
    select 1 from public.abc_cargo_pantallas cp
     where cp.empresa_id = p_empresa_id and cp.cargo_id = v_assignment.cargo_id and cp.capacidad_consulta = v_cat.consulta_clave
  ) then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'dependencia_consulta_faltante', 'fuente', 'cargo');
  end if;
  if exists (
    select 1 from public.abc_cargo_permisos cp
     where cp.empresa_id = p_empresa_id and cp.cargo_id = v_assignment.cargo_id
       and cp.clave = v_cat.clave and cp.accion = v_cat.accion
       and cp.activo = true and private.pm13_p05_alcance_cubre(cp.alcance, v_alcance)
       and cp.permitido = false
  ) then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'cargo_revocado', 'fuente', 'cargo');
  end if;
  select * into v_perm
    from public.abc_cargo_permisos cp
   where cp.empresa_id = p_empresa_id and cp.cargo_id = v_assignment.cargo_id
     and cp.clave = v_cat.clave and cp.accion = v_cat.accion
     and cp.activo = true and private.pm13_p05_alcance_cubre(cp.alcance, v_alcance)
   order by cp.version desc limit 1;
  if not found then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', v_reason, 'fuente', 'cargo');
  end if;
  return jsonb_build_object(
    'ok', true, 'permitido', true, 'motivo', 'cargo_autorizado', 'fuente', 'cargo',
    'cargo_id', v_assignment.cargo_id, 'alcance', v_perm.alcance, 'version', v_perm.version
  );
end
$$;

revoke all on function private.pm13_p05_rol_alcanza(text,text) from public, anon, authenticated, service_role;
revoke all on function private.pm13_p05_alcance_cubre(text,text) from public, anon, authenticated, service_role;
revoke all on function public.pm13_listar_cargo_permisos(text,text,uuid) from public, anon, authenticated, service_role;
revoke all on function public.pm13_configurar_cargo_permiso(text,text,text,uuid,text,text,text,boolean,text) from public, anon, authenticated, service_role;
revoke all on function public.pm13_resolver_cargo_permiso(text,text,text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.pm13_listar_cargo_permisos(text,text,uuid) to authenticated;
grant execute on function public.pm13_configurar_cargo_permiso(text,text,text,uuid,text,text,text,boolean,text) to authenticated;
grant execute on function public.pm13_resolver_cargo_permiso(text,text,text,text,text,text) to authenticated;

comment on table public.abc_cargo_permisos is 'Decisiones de acciones PM13 por cargo. Denegación por defecto; sin acceso directo, solo mediante RPC autorizadas.';
comment on function public.pm13_resolver_cargo_permiso(text,text,text,text,text,text) is 'Resuelve una acción de cargo personalizado con tenant, membresía, techo técnico, consulta, alcance y revocación.';

commit;
