-- ABC · capa de configuración por empresa y local, PIEZA 6d (parte de servidor; solo QA hasta que Pedro autorice otra cosa).
--
-- Decisión de Pedro (2/10/2026): «A · que el día operativo del cierre lo calcule el servidor». Plan en
-- docs/plan-abc/F6_PIEZA6D_CIERRE_DIFERENCIA_PLAN_2026-10-02.md.
--
-- Qué hace (aditiva; no cambia ninguna función ni ningún dato existente):
--  `abc_obtener_dia_operativo_local`: función de SOLO LECTURA que devuelve el día operativo actual del local según su
--  regla (hora de corte y zona horaria, pieza 1 y D06), con el mismo cálculo que ya usan los eventos de configuración
--  (`private.abc_config_dia_evento`). La pantalla de cierre de caja la usa para no depender de la última cuenta abierta
--  en el navegador. Solo quien opera la caja (`ABC_CAJA_OPERAR`: Propietario, Encargado o Cajero/a por defecto) y para un local
--  que exista y esté activo en la empresa.
--
-- Límite deliberado: es solo la etiqueta del día de los eventos del cierre; ninguna función del cierre (C04) cambia ni la valida.

set local lock_timeout = '10s';

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.locales') is null then v_missing:=array_append(v_missing,'locales'); end if;
  if to_regprocedure('private.abc_tiene_capacidad(text,text,text)') is null then v_missing:=array_append(v_missing,'abc_tiene_capacidad'); end if;
  if to_regprocedure('private.abc_config_dia_evento(text,text)') is null then v_missing:=array_append(v_missing,'abc_config_dia_evento (pieza 1)'); end if;
  if to_regprocedure('auth.uid()') is null then v_missing:=array_append(v_missing,'auth.uid'); end if;

  if cardinality(v_missing)>0 then
    raise exception 'ABC_CFG6D_PREFLIGHT_FALLO:%',array_to_string(v_missing,',');
  end if;

  if to_regprocedure('public.abc_obtener_dia_operativo_local(text,text)') is not null then
    raise exception 'ABC_CFG6D_PREFLIGHT_FALLO: objetos de la pieza 6d ya existen';
  end if;
end $$;

create function public.abc_obtener_dia_operativo_local(
  p_empresa_id text,
  p_local_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if auth.uid() is null
     or nullif(btrim(coalesce(p_empresa_id,'')),'') is null
     or nullif(btrim(coalesce(p_local_id,'')),'') is null
     or not coalesce(private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR'),false) then
    raise exception 'abc_caja_no_autorizado';
  end if;
  -- El Propietario lo es de toda la empresa: el local tiene que existir y estar activo en ella.
  if not exists(
    select 1 from public.locales l
     where l.empresa_id=p_empresa_id and l.id=p_local_id and l.activo
  ) then
    raise exception 'dia_operativo_local_no_disponible';
  end if;

  return jsonb_build_object(
    'ok',true,
    'operating_day',private.abc_config_dia_evento(p_empresa_id,p_local_id)
  );
end $$;

revoke all on function public.abc_obtener_dia_operativo_local(text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.abc_obtener_dia_operativo_local(text,text) to authenticated;

comment on function public.abc_obtener_dia_operativo_local(text,text) is
  'Día operativo actual del local según su regla (corte y zona horaria). Solo lectura; solo quien opera la caja (capa de configuración, pieza 6d).';
