-- ABC F6 — nombres libres, navegación efectiva y resolución estricta en QA.
-- No toca producción: se aplica únicamente después de 20261129100000.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.abc_cargos') is null then v_missing := array_append(v_missing, 'abc_cargos'); end if;
  if to_regclass('public.abc_cargo_asignaciones') is null then v_missing := array_append(v_missing, 'abc_cargo_asignaciones'); end if;
  if to_regclass('public.abc_cargo_pantallas') is null then v_missing := array_append(v_missing, 'abc_cargo_pantallas'); end if;
  if to_regclass('public.abc_cargo_permisos') is null then v_missing := array_append(v_missing, 'abc_cargo_permisos'); end if;
  if to_regclass('public.abc_permiso_excepciones') is null then v_missing := array_append(v_missing, 'abc_permiso_excepciones'); end if;
  if to_regclass('public.abc_pantallas_rol') is null then v_missing := array_append(v_missing, 'abc_pantallas_rol'); end if;
  if to_regclass('public.empresas') is null then v_missing := array_append(v_missing, 'empresas'); end if;
  if to_regclass('public.locales') is null then v_missing := array_append(v_missing, 'locales'); end if;
  if to_regclass('public.empleados') is null then v_missing := array_append(v_missing, 'empleados'); end if;
  if to_regclass('public.perfiles') is null then v_missing := array_append(v_missing, 'perfiles'); end if;
  if to_regclass('public.membresias_usuario') is null then v_missing := array_append(v_missing, 'membresias_usuario'); end if;
  if to_regprocedure('auth.uid()') is null then v_missing := array_append(v_missing, 'auth.uid'); end if;
  if to_regprocedure('private.pm13_p04_catalogo_consulta()') is null then v_missing := array_append(v_missing, 'pm13_p04_catalogo_consulta'); end if;
  if to_regprocedure('private.abc_rol_pantalla_catalogo()') is null then v_missing := array_append(v_missing, 'abc_rol_pantalla_catalogo'); end if;
  if to_regprocedure('private.pm13_cargo_auditar(text,text,text,jsonb)') is null then v_missing := array_append(v_missing, 'pm13_cargo_auditar'); end if;
  if cardinality(v_missing) > 0 then
    raise exception 'ABC_F6_NAVEGACION_PREFLIGHT_FALLO:%', array_to_string(v_missing, ',');
  end if;
end $preflight$;

-- Un cargo personalizado se identifica por su UUID y por la empresa. Su nombre
-- puede coincidir con cualquier rol histórico, incluido Propietario; eso nunca
-- convierte la fila en una membresía Propietario ni permite asignarla a una cuenta
-- propietaria, porque pm13_cargo_guard_propietario sigue activo.
drop trigger if exists pm13_cargo_guard_nombre on public.abc_cargos;
create or replace function private.pm13_cargo_guard_nombre()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  return new;
end
$$;
revoke all on function private.pm13_cargo_guard_nombre() from public, anon, authenticated, service_role;
comment on function private.pm13_cargo_guard_nombre() is
  'Compatibilidad histórica: los cargos personalizados admiten cualquier nombre válido; la identidad Propietario se protege por membresía y asignación, no por texto.';

-- Lista de pantallas efectivas para la sesión actual. Para cargos personalizados
-- se usa únicamente su asignación activa y abc_cargo_pantallas. Si la persona no
-- tiene cargo personalizado, se conserva la matriz de roles históricos como
-- compatibilidad, pero nunca se cae a Estándar por defecto.
create or replace function public.pm13_listar_pantallas_efectivas(
  p_empresa_id text,
  p_local_id text,
  p_empleado_id text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member public.membresias_usuario%rowtype;
  v_profile public.perfiles%rowtype;
  v_employee public.empleados%rowtype;
  v_assignment public.abc_cargo_asignaciones%rowtype;
  v_empleado_id text;
  v_pantallas jsonb;
begin
  if auth.uid() is null or nullif(btrim(coalesce(p_empresa_id, '')), '') is null or nullif(btrim(coalesce(p_local_id, '')), '') is null then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'contexto_no_autorizado', 'pantallas', '[]'::jsonb);
  end if;
  select * into v_member
    from public.membresias_usuario m
   where m.user_id = auth.uid() and m.empresa_id = p_empresa_id and m.activo = true
     and ((m.todos_locales = false and m.local_id = p_local_id) or (m.todos_locales = true and m.local_id is null))
   order by case when m.todos_locales = false then 0 else 1 end, m.id desc
   limit 1;
  if not found or not exists (select 1 from public.locales l where l.id = p_local_id and l.empresa_id = p_empresa_id and l.activo = true) then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'membresia_no_autorizada', 'pantallas', '[]'::jsonb);
  end if;
  if v_member.rol = 'Propietario' then
    select coalesce(jsonb_agg(jsonb_build_object('capacidad_consulta', c.capacidad_consulta, 'permitida', true) order by c.capacidad_consulta), '[]'::jsonb)
      into v_pantallas from private.pm13_p04_catalogo_consulta() c;
    return jsonb_build_object('ok', true, 'permitido', true, 'fuente', 'propietario_protegido', 'pantallas', v_pantallas);
  end if;
  select * into v_profile from public.perfiles p where p.user_id = auth.uid() and p.activo = true order by p.updated_at desc limit 1;
  v_empleado_id := coalesce(nullif(p_empleado_id, ''), v_profile.empleado_id);
  if v_empleado_id is null or v_profile.empleado_id is distinct from v_empleado_id then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'empleado_no_vinculado', 'pantallas', '[]'::jsonb);
  end if;
  select * into v_employee from public.empleados e
   where e.id = v_empleado_id and e.empresa_id = p_empresa_id and e.local_id = p_local_id and e.estado = 'activo';
  if not found then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'empleado_no_disponible', 'pantallas', '[]'::jsonb);
  end if;
  select a.* into v_assignment
    from public.abc_cargo_asignaciones a
    join public.abc_cargos c on c.id = a.cargo_id and c.empresa_id = a.empresa_id and c.activo = true
   where a.empresa_id = p_empresa_id and a.local_id = p_local_id and a.empleado_id = v_employee.id and a.activo = true
   order by a.asignado_desde desc, a.created_at desc limit 1;
  if found then
    select coalesce(jsonb_agg(jsonb_build_object(
      'capacidad_consulta', catalogo.capacidad_consulta,
      'permitida', exists (select 1 from public.abc_cargo_pantallas cp where cp.empresa_id = p_empresa_id and cp.cargo_id = v_assignment.cargo_id and cp.capacidad_consulta = catalogo.capacidad_consulta)
    ) order by catalogo.capacidad_consulta), '[]'::jsonb)
      into v_pantallas from private.pm13_p04_catalogo_consulta() catalogo;
    return jsonb_build_object('ok', true, 'permitido', true, 'fuente', 'cargo', 'cargo_id', v_assignment.cargo_id, 'pantallas', v_pantallas);
  end if;
  if v_member.rol not in ('Encargado', 'Cajero/a', 'Camarero/a') then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'cargo_no_asignado', 'pantallas', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'capacidad_consulta', catalogo.capacidad,
    'permitida', case v_member.rol
      when 'Encargado' then coalesce(lo.permitido, em.permitido, catalogo.encargado)
      when 'Cajero/a' then coalesce(lo.permitido, em.permitido, catalogo.cajero)
      else coalesce(lo.permitido, em.permitido, catalogo.camarero)
    end
  ) order by catalogo.capacidad), '[]'::jsonb)
    into v_pantallas
    from private.abc_rol_pantalla_catalogo() catalogo
    left join public.abc_pantallas_rol lo on lo.empresa_id = p_empresa_id and lo.local_id = p_local_id and lo.rol = v_member.rol and lo.capacidad = catalogo.capacidad
    left join public.abc_pantallas_rol em on em.empresa_id = p_empresa_id and em.local_id is null and em.rol = v_member.rol and em.capacidad = catalogo.capacidad;
  return jsonb_build_object('ok', true, 'permitido', true, 'fuente', 'rol_tecnico_compatibilidad', 'pantallas', v_pantallas);
end
$$;

revoke all on function public.pm13_listar_pantallas_efectivas(text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.pm13_listar_pantallas_efectivas(text,text,text) to authenticated;

-- Resolver final: las barreras de identidad, membresía, empleado, cargo activo,
-- pantalla y alcance siempre preceden a la excepción individual. La excepción
-- solo modifica el permiso después de existir una asignación válida.
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
  v_excepcion public.abc_permiso_excepciones%rowtype;
  v_clave text := upper(btrim(coalesce(p_clave, '')));
  v_accion text := upper(btrim(coalesce(p_accion, '')));
  v_alcance text := upper(btrim(coalesce(p_alcance, '')));
  v_empleado_id text;
  v_consulta_ok boolean := true;
begin
  if auth.uid() is null or nullif(btrim(coalesce(p_empresa_id, '')), '') is null or nullif(btrim(coalesce(p_local_id, '')), '') is null then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'contexto_no_autorizado');
  end if;
  if v_alcance not in ('PROPIO','LOCAL','EMPRESA') then return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'alcance_no_valido'); end if;
  select * into v_cat from private.pm13_p05_acciones_catalogo c where c.clave = v_clave and c.accion = v_accion;
  if not found then return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'clave_no_catalogada'); end if;
  if not private.pm13_p05_alcance_cubre(v_cat.alcance_maximo, v_alcance) then return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'alcance_fuera_de_catalogo'); end if;
  select * into v_member from public.membresias_usuario m
   where m.user_id = auth.uid() and m.empresa_id = p_empresa_id and m.activo = true
     and ((m.todos_locales = false and m.local_id = p_local_id) or (m.todos_locales = true and m.local_id is null))
   order by case when m.todos_locales = false then 0 else 1 end, m.id desc limit 1;
  if not found then return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'membresia_no_autorizada'); end if;
  if not exists (select 1 from public.locales l where l.id = p_local_id and l.empresa_id = p_empresa_id and l.activo = true) then return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'local_no_disponible'); end if;
  if v_member.rol = 'Propietario' then return jsonb_build_object('ok', true, 'permitido', true, 'motivo', 'propietario_protegido', 'fuente', 'rol_tecnico', 'alcance', v_alcance); end if;
  select * into v_profile from public.perfiles p where p.user_id = auth.uid() and p.activo = true order by p.updated_at desc limit 1;
  v_empleado_id := coalesce(nullif(p_empleado_id, ''), v_profile.empleado_id);
  if v_empleado_id is null or v_profile.empleado_id is distinct from v_empleado_id then return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'empleado_no_vinculado'); end if;
  select * into v_employee from public.empleados e where e.id = v_empleado_id and e.empresa_id = p_empresa_id and e.local_id = p_local_id and e.estado = 'activo';
  if not found then return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'empleado_no_disponible'); end if;
  if v_alcance = 'PROPIO' and v_profile.empleado_id is distinct from v_employee.id then return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'alcance_propio_no_coincide'); end if;
  if not private.pm13_p05_rol_alcanza(v_member.rol, v_cat.rol_minimo) then return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'techo_rol_tecnico', 'fuente', 'rol_tecnico'); end if;
  select a.* into v_assignment
    from public.abc_cargo_asignaciones a
    join public.abc_cargos c on c.id = a.cargo_id and c.empresa_id = a.empresa_id and c.activo = true
   where a.empresa_id = p_empresa_id and a.local_id = p_local_id and a.empleado_id = v_employee.id and a.activo = true
   order by a.asignado_desde desc, a.created_at desc limit 1;
  if not found then return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'cargo_no_asignado'); end if;
  if v_cat.requiere_consulta and not exists (select 1 from public.abc_cargo_pantallas cp where cp.empresa_id = p_empresa_id and cp.cargo_id = v_assignment.cargo_id and cp.capacidad_consulta = v_cat.consulta_clave) then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'dependencia_consulta_faltante', 'fuente', 'cargo');
  end if;
  select * into v_excepcion from public.abc_permiso_excepciones ex
   where ex.empresa_id = p_empresa_id and ex.empleado_id = v_employee.id and ex.clave = v_cat.clave and ex.accion = v_cat.accion
     and ex.activo = true and private.pm13_p05_alcance_cubre(ex.alcance, v_alcance)
   order by ex.version desc limit 1;
  if found then
    if v_excepcion.permitido = false then return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'excepcion_denegada', 'fuente', 'excepcion'); end if;
    return jsonb_build_object('ok', true, 'permitido', true, 'motivo', 'excepcion_concedida', 'fuente', 'excepcion', 'alcance', v_alcance);
  end if;
  if exists (select 1 from public.abc_cargo_permisos cp where cp.empresa_id = p_empresa_id and cp.cargo_id = v_assignment.cargo_id and cp.clave = v_cat.clave and cp.accion = v_cat.accion and cp.activo = true and private.pm13_p05_alcance_cubre(cp.alcance, v_alcance) and cp.permitido = false) then
    return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'cargo_revocado', 'fuente', 'cargo');
  end if;
  select * into v_perm from public.abc_cargo_permisos cp
   where cp.empresa_id = p_empresa_id and cp.cargo_id = v_assignment.cargo_id and cp.clave = v_cat.clave and cp.accion = v_accion
     and cp.activo = true and private.pm13_p05_alcance_cubre(cp.alcance, v_alcance)
   order by cp.version desc limit 1;
  if not found then return jsonb_build_object('ok', true, 'permitido', false, 'motivo', 'denegado_por_defecto', 'fuente', 'cargo'); end if;
  return jsonb_build_object('ok', true, 'permitido', v_perm.permitido, 'motivo', case when v_perm.permitido then 'cargo_autorizado' else 'cargo_revocado' end, 'fuente', 'cargo', 'cargo_id', v_assignment.cargo_id, 'alcance', v_perm.alcance, 'version', v_perm.version);
end
$$;

revoke all on function public.pm13_resolver_cargo_permiso(text,text,text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.pm13_resolver_cargo_permiso(text,text,text,text,text,text) to authenticated;

-- Las RPC operativas deben usar siempre el resolver final. Retirar el fallback
-- por rol antiguo evita recuperar permisos al quitar una asignación.
create or replace function private.pm13_p05_accion_autorizada(
  p_empresa_id text,
  p_local_id text,
  p_clave text,
  p_accion text,
  p_alcance text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_resolucion jsonb;
begin
  if auth.uid() is null then return false; end if;
  v_resolucion := public.pm13_resolver_cargo_permiso(p_empresa_id, p_local_id, p_clave, p_accion, p_alcance, null);
  return coalesce((v_resolucion->>'permitido')::boolean, false);
end
$$;

revoke all on function private.pm13_p05_accion_autorizada(text,text,text,text,text) from public, anon, authenticated, service_role;
comment on function private.pm13_p05_accion_autorizada(text,text,text,text,text) is
  'Guard operativo estricto: toda mutación de Personal, Fichajes y Ausencias depende del resolver de cargo activo; no recupera permisos por rol heredado.';

commit;
