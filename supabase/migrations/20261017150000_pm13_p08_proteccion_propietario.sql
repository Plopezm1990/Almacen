-- PM13-P08 — protección del propietario y separación de cargos personalizados.
-- Solo prepara el contrato servidor para QA; no se aplica automáticamente.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.abc_cargos') is null then v_missing := array_append(v_missing, 'abc_cargos'); end if;
  if to_regclass('public.abc_cargo_asignaciones') is null then v_missing := array_append(v_missing, 'abc_cargo_asignaciones'); end if;
  if to_regclass('public.perfiles') is null then v_missing := array_append(v_missing, 'perfiles'); end if;
  if to_regclass('public.membresias_usuario') is null then v_missing := array_append(v_missing, 'membresias_usuario'); end if;
  if cardinality(v_missing) > 0 then
    raise exception 'PM13_P08_PROPIETARIO_PREFLIGHT_FALLO:%', array_to_string(v_missing, ',');
  end if;
end $preflight$;

create or replace function private.pm13_cargo_guard_nombre()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.nombre_normalizado = any (array['propietario','encargado','cajero/a','camarero/a','churrero/a','básico','estándar']) then
    raise exception 'cargo_nombre_reservado';
  end if;
  return new;
end
$$;

drop trigger if exists pm13_cargo_guard_nombre on public.abc_cargos;
create trigger pm13_cargo_guard_nombre
  before insert or update of nombre, nombre_normalizado on public.abc_cargos
  for each row execute function private.pm13_cargo_guard_nombre();

create or replace function private.pm13_cargo_guard_propietario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
      from public.perfiles p
      join public.membresias_usuario m on m.user_id = p.user_id
     where p.empleado_id = new.empleado_id
       and p.activo = true
       and p.rol = 'Propietario'
       and m.empresa_id = new.empresa_id
       and m.activo = true
       and m.rol = 'Propietario'
       and (m.todos_locales = true or m.local_id = new.local_id)
  ) then
    raise exception 'cargo_propietario_no_asignable';
  end if;
  return new;
end
$$;

drop trigger if exists pm13_cargo_guard_propietario on public.abc_cargo_asignaciones;
create trigger pm13_cargo_guard_propietario
  before insert or update of empleado_id, empresa_id, local_id, cargo_id on public.abc_cargo_asignaciones
  for each row execute function private.pm13_cargo_guard_propietario();

revoke all on function private.pm13_cargo_guard_nombre() from public, anon, authenticated, service_role;
revoke all on function private.pm13_cargo_guard_propietario() from public, anon, authenticated, service_role;

comment on function private.pm13_cargo_guard_nombre() is 'Impide que un cargo personalizado se confunda con roles protegidos del sistema.';
comment on function private.pm13_cargo_guard_propietario() is 'Impide asignar cargos personalizados a una cuenta propietaria; no modifica perfiles ni membresías.';

commit;
