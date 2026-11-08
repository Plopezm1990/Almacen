-- PM13 2.6 (apoyo UI): lectura del corte del día operativo vigente de un local,
-- accesible a CUALQUIER miembro activo de la empresa+local (no solo Propietario),
-- para que el registro horario impute los fichajes al día operativo también cuando
-- lo consulta un empleado. Solo lectura; no cambia nada.
--
-- El dueño configura el corte con abc_configurar_dia_operativo (solo Propietario) y
-- se guarda, versionado y con vigencia, en private.abc_operating_day_reglas. Aquí se
-- devuelve la regla EFECTIVA ahora (vigente_desde <= now < vigente_hasta); si no hay
-- regla propia, el valor por defecto (00:00, Europe/Madrid) = día natural.

create or replace function public.pm13_corte_dia_operativo(
  p_empresa_id text,
  p_local_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $fn$
declare
  v_regla private.abc_operating_day_reglas%rowtype;
begin
  if auth.uid() is null
     or nullif(btrim(coalesce(p_empresa_id,'')),'') is null
     or nullif(btrim(coalesce(p_local_id,'')),'') is null then
    return jsonb_build_object('ok', false, 'codigo', 'contexto_no_autorizado');
  end if;
  -- Cualquier miembro ACTIVO de la empresa+local (sin filtro de rol).
  if not exists (
    select 1 from public.membresias_usuario m
     where m.user_id = auth.uid() and m.empresa_id = p_empresa_id and m.activo = true
       and ((m.todos_locales = false and m.local_id = p_local_id) or m.todos_locales = true)
  ) then
    return jsonb_build_object('ok', false, 'codigo', 'membresia_no_autorizada');
  end if;
  if not exists (
    select 1 from public.locales l
     where l.id = p_local_id and l.empresa_id = p_empresa_id and l.activo = true
  ) then
    return jsonb_build_object('ok', false, 'codigo', 'local_no_disponible');
  end if;
  select * into v_regla
    from private.abc_operating_day_reglas r
   where r.empresa_id = p_empresa_id and r.local_id = p_local_id
     and r.vigente_desde <= now() and (r.vigente_hasta is null or r.vigente_hasta > now())
   order by r.vigente_desde desc, r.version desc
   limit 1;
  if not found then
    return jsonb_build_object('ok', true, 'cutoff_time', '00:00:00', 'timezone_name', 'Europe/Madrid', 'origen', 'defecto');
  end if;
  return jsonb_build_object('ok', true,
    'cutoff_time', to_char(v_regla.cutoff_time, 'HH24:MI:SS'),
    'timezone_name', v_regla.timezone_name,
    'version', v_regla.version,
    'origen', 'regla');
end
$fn$;

revoke all on function public.pm13_corte_dia_operativo(text,text) from public, anon;
grant execute on function public.pm13_corte_dia_operativo(text,text) to authenticated;
