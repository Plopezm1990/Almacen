-- PM13 P06: excepciones individuales de permiso por empleado.
--
-- Precedencia (decidida con el propietario):
--   barreras de seguridad  >  excepción individual (heredar/permitir/denegar)  >  cargo
-- Un trabajador tiene UN cargo efectivo (el más reciente), como ya hace el resolver.
-- "heredar" = ausencia de excepción activa (se hereda el resultado del cargo).
-- deny por defecto. Una excepción NO puede saltarse las barreras de seguridad
-- (membresía, local activo, propietario protegido, techo de rol técnico, alcance del
-- catálogo, dependencia de consulta): un allow individual sigue sujeto a ellas.

begin;

-- 1. Tabla de excepciones (versionada, auditada), aislada por empresa+empleado.
create table if not exists public.abc_permiso_excepciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  empleado_id text not null,
  clave text not null,
  accion text not null,
  alcance text not null,
  permitido boolean not null,            -- true=permitir, false=denegar ("heredar" => sin fila activa)
  activo boolean not null default true,
  version bigint not null default 1,
  motivo text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists abc_permiso_excepciones_lookup_idx
  on public.abc_permiso_excepciones (empresa_id, empleado_id, clave, accion, activo);

-- Sin acceso directo del cliente: solo vía RPC SECURITY DEFINER.
alter table public.abc_permiso_excepciones enable row level security;
revoke all on table public.abc_permiso_excepciones from anon, authenticated;

-- 2. RPC para configurar una excepción (heredar / permitir / denegar).
create or replace function public.pm13_configurar_excepcion_permiso(
  p_empresa_id text,
  p_local_id text,
  p_empleado_id text,
  p_clave text,
  p_accion text,
  p_alcance text,
  p_efecto text,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_cat private.pm13_p05_acciones_catalogo%rowtype;
  v_member public.membresias_usuario%rowtype;
  v_employee public.empleados%rowtype;
  v_clave text := upper(btrim(coalesce(p_clave, '')));
  v_accion text := upper(btrim(coalesce(p_accion, '')));
  v_alcance text := upper(btrim(coalesce(p_alcance, '')));
  v_efecto text := lower(btrim(coalesce(p_efecto, '')));
  v_permitido boolean;
  v_version bigint;
begin
  if auth.uid() is null
     or nullif(btrim(coalesce(p_empresa_id,'')),'') is null
     or nullif(btrim(coalesce(p_local_id,'')),'') is null
     or nullif(btrim(coalesce(p_empleado_id,'')),'') is null then
    return jsonb_build_object('ok', false, 'codigo', 'contexto_no_autorizado');
  end if;
  if v_efecto not in ('heredar','permitir','denegar') then
    return jsonb_build_object('ok', false, 'codigo', 'efecto_no_valido');
  end if;
  if v_alcance not in ('PROPIO','LOCAL','EMPRESA') then
    return jsonb_build_object('ok', false, 'codigo', 'alcance_no_valido');
  end if;
  -- Solo el Propietario de la empresa gestiona excepciones.
  select * into v_member
    from public.membresias_usuario m
   where m.user_id = auth.uid() and m.empresa_id = p_empresa_id and m.activo = true
     and m.rol = 'Propietario'
     and ((m.todos_locales = false and m.local_id = p_local_id) or m.todos_locales = true)
   order by case when m.todos_locales = false then 0 else 1 end, m.id desc
   limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'membresia_no_autorizada');
  end if;
  -- El empleado debe existir en la empresa+local y estar activo.
  select * into v_employee from public.empleados e
   where e.id = p_empleado_id and e.empresa_id = p_empresa_id and e.local_id = p_local_id and e.estado = 'activo';
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'empleado_no_disponible');
  end if;
  -- La acción debe estar catalogada y el alcance dentro del máximo del catálogo.
  select * into v_cat from private.pm13_p05_acciones_catalogo c where c.clave = v_clave and c.accion = v_accion;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'clave_no_catalogada');
  end if;
  if not private.pm13_p05_alcance_cubre(v_cat.alcance_maximo, v_alcance) then
    return jsonb_build_object('ok', false, 'codigo', 'alcance_fuera_de_catalogo');
  end if;

  if v_efecto = 'heredar' then
    update public.abc_permiso_excepciones
       set activo = false, updated_by = auth.uid(), updated_at = now()
     where empresa_id = p_empresa_id and empleado_id = p_empleado_id
       and clave = v_cat.clave and accion = v_cat.accion and alcance = v_alcance and activo = true;
    return jsonb_build_object('ok', true, 'efecto', 'heredar');
  end if;

  v_permitido := (v_efecto = 'permitir');
  select coalesce(max(version), 0) + 1 into v_version
    from public.abc_permiso_excepciones
   where empresa_id = p_empresa_id and empleado_id = p_empleado_id
     and clave = v_cat.clave and accion = v_cat.accion and alcance = v_alcance;
  -- Desactiva la anterior y escribe la nueva versión (transaccional, auditable).
  update public.abc_permiso_excepciones
     set activo = false, updated_by = auth.uid(), updated_at = now()
   where empresa_id = p_empresa_id and empleado_id = p_empleado_id
     and clave = v_cat.clave and accion = v_cat.accion and alcance = v_alcance and activo = true;
  insert into public.abc_permiso_excepciones
    (empresa_id, empleado_id, clave, accion, alcance, permitido, activo, version, motivo, created_by, updated_by)
  values
    (p_empresa_id, p_empleado_id, v_cat.clave, v_cat.accion, v_alcance, v_permitido, true, v_version,
     nullif(btrim(coalesce(p_motivo,'')),''), auth.uid(), auth.uid());
  return jsonb_build_object('ok', true, 'efecto', v_efecto, 'version', v_version);
end
$fn$;

revoke all on function public.pm13_configurar_excepcion_permiso(text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.pm13_configurar_excepcion_permiso(text,text,text,text,text,text,text,text) to authenticated;

-- 3. Resolver con la excepción por encima del cargo (misma firma; barreras intactas).
create or replace function public.pm13_resolver_cargo_permiso(p_empresa_id text, p_local_id text, p_clave text, p_accion text, p_alcance text, p_empleado_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_cat private.pm13_p05_acciones_catalogo%rowtype;
  v_member public.membresias_usuario%rowtype;
  v_profile public.perfiles%rowtype;
  v_employee public.empleados%rowtype;
  v_assignment public.abc_cargo_asignaciones%rowtype;
  v_perm public.abc_cargo_permisos%rowtype;
  v_excepcion public.abc_permiso_excepciones%rowtype;
  v_tiene_cargo boolean := false;
  v_consulta_ok boolean := true;
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

  -- Cargo efectivo (el más reciente) y dependencia de consulta: se calculan una vez y
  -- sirven tanto para la excepción "permitir" como para el camino de cargo.
  select * into v_assignment
    from public.abc_cargo_asignaciones a
   where a.empresa_id = p_empresa_id and a.local_id = p_local_id and a.empleado_id = v_employee.id and a.activo = true
   order by a.asignado_desde desc, a.created_at desc limit 1;
  v_tiene_cargo := found;
  if v_cat.requiere_consulta then
    v_consulta_ok := v_tiene_cargo and exists (
      select 1 from public.abc_cargo_pantallas cp
       where cp.empresa_id = p_empresa_id and cp.cargo_id = v_assignment.cargo_id and cp.capacidad_consulta = v_cat.consulta_clave
    );
  end if;

  -- Excepción individual (manda sobre el cargo). "heredar" = sin fila activa.
  select * into v_excepcion
    from public.abc_permiso_excepciones ex
   where ex.empresa_id = p_empresa_id and ex.empleado_id = v_employee.id
     and ex.clave = v_cat.clave and ex.accion = v_cat.accion
     and ex.activo = true and private.pm13_p05_alcance_cubre(ex.alcance, v_alcance)
   order by ex.version desc limit 1;
  if found then
    if v_excepcion.permitido = false then
      return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'excepcion_denegada', 'fuente', 'excepcion');
    end if;
    -- Allow individual: sigue sujeto a la dependencia de consulta (no abre módulos nuevos).
    if v_cat.requiere_consulta and not v_consulta_ok then
      return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'dependencia_consulta_faltante', 'fuente', 'excepcion');
    end if;
    return jsonb_build_object('ok', true, 'permitido', true, 'motivo', 'excepcion_concedida', 'fuente', 'excepcion', 'alcance', v_alcance);
  end if;

  -- Sin excepción: se hereda el resultado del cargo (comportamiento previo intacto).
  if not v_tiene_cargo then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'cargo_no_asignado');
  end if;
  if v_cat.requiere_consulta and not v_consulta_ok then
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
$function$;

commit;
