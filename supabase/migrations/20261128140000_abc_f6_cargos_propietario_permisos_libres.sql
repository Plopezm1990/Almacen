-- ABC F6 — cargos personalizados administrables por el Propietario.
-- QA únicamente: conserva las barreras de tenant, catálogo, alcance,
-- dependencia de consulta, asignación activa y denegación por defecto.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '30s';

do $preflight$
begin
  if to_regprocedure('private.pm13_p05_rol_alcanza(text,text)') is null then
    raise exception 'ABC_F6_CARGOS_PREFLIGHT_FALLO:pm13_p05_rol_alcanza';
  end if;
end $preflight$;

-- El rol técnico de la membresía identifica al usuario, pero no debe limitar
-- el cargo personalizado que el Propietario le haya asignado. El permiso
-- efectivo sigue requiriendo cargo activo, fila explícita en el catálogo de
-- permisos y, cuando corresponde, la pantalla de consulta asociada.
-- Propietario/administración de cargos continúa protegido por
-- pm13_cargo_validar_contexto y abc_config_puede_configurar.
create or replace function private.pm13_p05_rol_alcanza(p_rol text, p_rol_minimo text)
returns boolean
language sql
immutable
security definer
set search_path = 'pg_catalog'
as $$
  select coalesce(nullif(btrim(p_rol), ''), '') in (
    'Propietario', 'Encargado', 'Cajero/a', 'Camarero/a',
    'Churrero/a', 'Básico', 'Estándar'
  )
  and coalesce(nullif(btrim(p_rol_minimo), ''), '') in (
    'Camarero/a', 'Cajero/a', 'Encargado'
  )
$$;

revoke all on function private.pm13_p05_rol_alcanza(text,text) from public, anon, authenticated, service_role;

comment on function private.pm13_p05_rol_alcanza(text,text) is
  'Para cargos personalizados, valida una identidad técnica conocida sin imponer una jerarquía heredada; el resolver conserva catálogo, cargo activo, pantalla, alcance y deny por defecto.';

commit;
