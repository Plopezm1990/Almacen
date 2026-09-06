-- PM11 · P04 hardening heredado necesario para Personal.
-- En QA se comprobó que la política histórica de UPDATE propio en perfiles permitía
-- a un authenticated cambiar rol/activo/empleado_id de su propia fila.
-- Este guard conserva las ediciones no sensibles (p.ej. nombre) pero impide que el
-- cliente autogestione columnas de autorización o el vínculo con empleados.
-- Producción/main no se toca.

create or replace function private.pm11_perfiles_guard_sensible()
returns trigger
language plpgsql
set search_path = 'public', 'auth', 'private', 'pg_temp'
as $$
begin
  if current_user = 'authenticated' then
    if new.rol is distinct from old.rol then
      raise exception 'perfil_rol_no_autogestionable';
    end if;
    if new.activo is distinct from old.activo then
      raise exception 'perfil_activo_no_autogestionable';
    end if;
    if new.empleado_id is distinct from old.empleado_id then
      raise exception 'perfil_empleado_no_autogestionable';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.pm11_perfiles_guard_sensible() from public, anon, authenticated;

drop trigger if exists pm11_perfiles_guard_sensible on public.perfiles;
create trigger pm11_perfiles_guard_sensible
before update on public.perfiles
for each row execute function private.pm11_perfiles_guard_sensible();
