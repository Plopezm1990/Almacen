-- Reparación de la membresía de la cuenta de ensayo
-- qa.permisos.20261116@qa.invalid → Empresa QA-EMP-A, Local QA-A1,
-- todos_locales false, Rol Camarero/a.
--
-- ESTO ESCRIBE. Léelo antes de ejecutarlo. Solo en QA
-- (qjqorixtkilwsndqayyx), nunca en producción.
--
-- Qué toca, exactamente: filas de `public.membresias_usuario` cuyo `user_id`
-- sea el de esa cuenta, y nada más. No toca `perfiles`, ni `empleados`, ni
-- `auth.users`, ni la contraseña, ni la verificación en dos pasos, ni ninguna
-- otra cuenta.
--
-- Es un solo bloque `do`, y eso importa: un bloque `do` es una única sentencia,
-- así que si algo no cuadra y lanza un error, PostgreSQL deshace TODO lo que el
-- bloque hubiera escrito. No puede quedarse a medias.
--
-- Antes de escribir nada comprueba cuatro cosas y se niega si alguna falla:
--   1. que la cuenta existe;
--   2. que el local QA-A1 de QA-EMP-A existe;
--   3. que el perfil de la cuenta dice Camarero/a (si dijera otra cosa, la
--      avería es otra y hay que decidirla, no taparla desde aquí);
--   4. que al terminar hay exactamente UNA membresía activa, y es la buena.
--
-- Se puede ejecutar dos veces: la segunda no cambia nada.
--
-- Comprobado antes de pasártelo: se ejecutó contra un PostgreSQL de verdad
-- (PGlite) con el esquema mínimo, en ocho escenarios, y pasó los ocho:
--   A · la cuenta no existe                  → se niega, cero filas escritas
--   B · existe pero sin perfil               → se niega, cero filas escritas
--   C · el perfil dice otro rol              → se niega, cero filas escritas
--   D · existe y no tiene ninguna membresía  → crea la buena (la avería que se sospecha)
--   E · la membresía está en otro local      → desactiva esa y pone la buena
--   F · está en QA-A1 con todos_locales true → la corrige en su sitio, sin duplicar
--   G · la buena existe pero desactivada     → la reactiva, sin duplicar
--   H · ejecutarla dos veces                 → la segunda no cambia nada
-- Es SQL de una sola vez, así que esa comprobación no se ha metido en la batería
-- de CI; queda dicho aquí que se hizo.

do $$
declare
  v_user       uuid;
  v_rol_perfil text;
  v_desactivadas int := 0;
  v_accion     text;
  v_activas    int;
  v_resumen    text;
begin
  -- ---- 1. la cuenta ----
  select id into v_user from auth.users where email = 'qa.permisos.20261116@qa.invalid';
  if v_user is null then
    raise exception 'REPARACION_ABORTADA: no hay ningun usuario con el correo qa.permisos.20261116@qa.invalid. No se ha escrito nada.';
  end if;

  -- ---- 2. el local ----
  if not exists (select 1 from public.locales l where l.empresa_id = 'QA-EMP-A' and l.id = 'QA-A1') then
    raise exception 'REPARACION_ABORTADA: el local QA-A1 de la empresa QA-EMP-A no existe. No se ha escrito nada.';
  end if;

  -- ---- 3. el perfil ----
  select p.rol into v_rol_perfil from public.perfiles p where p.user_id = v_user;
  if v_rol_perfil is null then
    raise exception 'REPARACION_ABORTADA: la cuenta no tiene fila en perfiles, asi que no tiene rol. Eso es otra averia y se decide aparte. No se ha escrito nada.';
  end if;
  if v_rol_perfil <> 'Camarero/a' then
    raise exception 'REPARACION_ABORTADA: el perfil de la cuenta dice «%» y no «Camarero/a». No se ha escrito nada.', v_rol_perfil;
  end if;

  -- ---- retirar lo que sobre ----
  -- Cualquier membresia activa de esta cuenta que no sea la buena se desactiva,
  -- no se borra: asi queda rastro de que estuvo ahi.
  update public.membresias_usuario m
     set activo = false, updated_at = now()
   where m.user_id = v_user
     and m.activo = true
     and not (m.empresa_id = 'QA-EMP-A' and m.local_id = 'QA-A1' and m.todos_locales = false and m.rol = 'Camarero/a');

  -- ---- poner la buena ----
  if exists (
    select 1 from public.membresias_usuario m
     where m.user_id = v_user and m.empresa_id = 'QA-EMP-A' and m.local_id = 'QA-A1'
  ) then
    update public.membresias_usuario m
       set todos_locales = false, rol = 'Camarero/a', activo = true, updated_at = now()
     where m.user_id = v_user and m.empresa_id = 'QA-EMP-A' and m.local_id = 'QA-A1';
    v_accion := 'actualizada la membresia que ya existia en QA-A1';
  else
    insert into public.membresias_usuario(user_id, empresa_id, local_id, todos_locales, rol, activo)
         values (v_user, 'QA-EMP-A', 'QA-A1', false, 'Camarero/a', true);
    v_accion := 'creada la membresia que faltaba en QA-A1';
  end if;

  -- ---- 4. comprobacion final: si no cuadra, se deshace todo ----
  select count(*) into v_activas from public.membresias_usuario m
   where m.user_id = v_user and m.activo = true;
  if v_activas <> 1 then
    raise exception 'REPARACION_DESHECHA: al terminar habia % membresias activas en vez de 1. No se ha escrito nada.', v_activas;
  end if;
  if not exists (
    select 1 from public.membresias_usuario m
     where m.user_id = v_user and m.activo = true
       and m.empresa_id = 'QA-EMP-A' and m.local_id = 'QA-A1'
       and m.todos_locales = false and m.rol = 'Camarero/a'
  ) then
    raise exception 'REPARACION_DESHECHA: la unica membresia activa no es QA-EMP-A / QA-A1 / todos_locales false / Camarero/a. No se ha escrito nada.';
  end if;

  select count(*) into v_desactivadas from public.membresias_usuario m
   where m.user_id = v_user and m.activo = false;

  v_resumen := 'REPARACION_OK: ' || v_accion
               || '; membresias inactivas de esta cuenta: ' || v_desactivadas
               || '; activa ahora: QA-EMP-A / QA-A1 / todos_locales false / Camarero/a.';
  raise notice '%', v_resumen;
end $$;

-- Comprobación aparte, para que veas el resultado y no tengas que creerte el
-- aviso de arriba (el editor de Supabase no siempre muestra los `notice`).
select 'activa: empresa ' || m.empresa_id
         || ' · local ' || coalesce(m.local_id, '(NULO)')
         || ' · todos_locales ' || m.todos_locales
         || ' · rol ' || m.rol as resultado
from public.membresias_usuario m
join auth.users u on u.id = m.user_id
where u.email = 'qa.permisos.20261116@qa.invalid' and m.activo = true;
