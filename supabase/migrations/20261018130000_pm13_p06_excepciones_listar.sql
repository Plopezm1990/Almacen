-- PM13 P06 (apoyo a la UI): lectura de las excepciones individuales activas de un
-- empleado. Solo el Propietario de la empresa. No concede ni cambia nada: solo
-- lista lo que ya existe, para que la pantalla de cargos pueda mostrar el estado
-- actual (heredar/permitir/denegar) de cada acción por empleado.
--
-- Hace falta porque el resolver `pm13_resolver_cargo_permiso` evalua SIEMPRE para
-- auth.uid() (el llamante), y el Propietario sale como `propietario_protegido`, asi
-- que no sirve para ver el permiso efectivo de otra persona desde su pantalla.

create or replace function public.pm13_listar_excepciones_empleado(
  p_empresa_id text,
  p_local_id text,
  p_empleado_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $fn$
declare
  v_member public.membresias_usuario%rowtype;
  v_employee public.empleados%rowtype;
  v_items jsonb;
begin
  if auth.uid() is null
     or nullif(btrim(coalesce(p_empresa_id,'')),'') is null
     or nullif(btrim(coalesce(p_local_id,'')),'') is null
     or nullif(btrim(coalesce(p_empleado_id,'')),'') is null then
    return jsonb_build_object('ok', false, 'codigo', 'contexto_no_autorizado');
  end if;
  -- Solo el Propietario de la empresa (mismo criterio que configurar).
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
  select coalesce(jsonb_agg(jsonb_build_object(
           'clave', ex.clave,
           'accion', ex.accion,
           'alcance', ex.alcance,
           'permitido', ex.permitido,
           'efecto', case when ex.permitido then 'permitir' else 'denegar' end,
           'version', ex.version,
           'motivo', ex.motivo,
           'updated_at', ex.updated_at
         ) order by ex.clave, ex.accion, ex.alcance), '[]'::jsonb)
    into v_items
    from public.abc_permiso_excepciones ex
   where ex.empresa_id = p_empresa_id and ex.empleado_id = p_empleado_id and ex.activo = true;
  return jsonb_build_object('ok', true, 'excepciones', v_items);
end
$fn$;

revoke all on function public.pm13_listar_excepciones_empleado(text,text,text) from public, anon;
grant execute on function public.pm13_listar_excepciones_empleado(text,text,text) to authenticated;
