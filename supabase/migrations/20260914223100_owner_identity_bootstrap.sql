-- PM27 / P2: restablece solamente la identidad mínima del Propietario tras
-- el reset. No crea empresas, locales, membresías ni datos operativos.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '20s';

do $$
declare
  v_owner_id constant uuid := '685cfc8f-f674-4681-9a81-61d3a26c0287';
  v_owner_email constant text := 'pedroroger1990@gmail.com';
begin
  -- P1 debe estar aplicado primero: nunca se habilita una sesión antes de
  -- disponer de la generación que invalida la cola local heredada.
  if to_regclass('private.la_instalacion_estado') is null then
    raise exception 'PREFLIGHT_FALLO: aplicar primero la barrera post-reset P1';
  end if;

  if not exists (
    select 1
    from auth.users u
    where u.id = v_owner_id
      and lower(u.email) = v_owner_email
      and u.deleted_at is null
  ) then
    raise exception 'PREFLIGHT_FALLO: la cuenta de Propietario no coincide';
  end if;

  -- Este paso está diseñado para una instalación vacía. Si el estado cambia
  -- antes de aplicarlo, se detiene para revisión en vez de mezclar contextos.
  if exists (select 1 from public.perfiles)
     or exists (select 1 from public.membresias_usuario)
     or exists (select 1 from public.empresas)
     or exists (select 1 from public.locales) then
    raise exception 'PREFLIGHT_FALLO: la instalación ya no está vacía';
  end if;

  insert into public.perfiles (user_id, rol, empleado_id, nombre, activo)
  values (v_owner_id, 'Propietario', null, 'Pedro Roger', true);
end;
$$;

commit;
